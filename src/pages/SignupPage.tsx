/**
 * SignupPage — Sales-initiated / direct-link 6-step signup wizard (Route: /signup)
 *
 * This wizard is designed for accounts opened via a sales link or direct invitation:
 *  Step 1 — Account credentials (name, email, password hash stored in PostgreSQL)
 *           → Email verification sub-step before advancing (sends 6-digit code)
 *  Step 2 — Optional company profile details
 *  Step 3 — Subscription tier and add-on selection
 *  Step 4 — Terms & Conditions acceptance
 *  Step 5 — Hardware setup acknowledgement checklist
 *  Step 6 — Final review + password re-entry → creates Firebase Auth user + Firestore profile
 *
 * All intermediate state is stored in the PostgreSQL `signup_progress` table keyed by signupId.
 * The Firebase Auth user and Firestore documents are only created at Step 6 (signup/complete).
 * Incomplete signups (status=in_progress, >48h old) are cleaned up via
 * POST /admin/cleanup-incomplete-signups.
 *
 * Contrast with RegisterPage (/register) which is the public-facing flow that creates
 * a Firestore account immediately after Step 1 and uses /api/registration/start.
 */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Mail,
  User,
  Building2,
  Briefcase,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Zap,
  DollarSign,
  FileText,
  Shield,
  HardDrive,
  Laptop,
  Wifi,
  Camera,
  Navigation,
  Ruler,
  CheckSquare,
  ExternalLink,
  Info,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';

// Inline validation schemas to avoid module resolution issues
// Step 1: Account Information
const signupStep1Schema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone number is required for SMS verification'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupStep1 = z.infer<typeof signupStep1Schema>;

// Step 2: Company Details
const signupStep2Schema = z.object({
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().regex(/^[\d\s\-\+\(\)]*$/, 'Invalid phone number format').optional().or(z.literal('')),
  address: z.string().optional(),
});

type SignupStep2 = z.infer<typeof signupStep2Schema>;

// Step 3: Subscription Selection
const signupStep3Schema = z.object({
  subscriptionTier: z.string().min(1, 'Subscription tier is required'),
  selectedAddons: z.array(z.string()).default([]),
  totalPrice: z.number().nonnegative('Total price must be non-negative'),
});

type SignupStep3 = z.infer<typeof signupStep3Schema>;

// Step 4: Terms & Conditions
const signupStep4Schema = z.object({
  termsVersionId: z.string().min(1, 'Terms version ID is required'),
  acceptedTerms: z.object({
    mainTerms: z.boolean(),
    privacyPolicy: z.boolean(),
    dataUsage: z.boolean(),
    paymentTerms: z.boolean(),
  }),
  acceptedAll: z.boolean(),
}).refine((data) => data.acceptedAll && data.acceptedTerms.mainTerms && data.acceptedTerms.privacyPolicy && data.acceptedTerms.dataUsage && data.acceptedTerms.paymentTerms, {
  message: "All terms must be accepted",
  path: ["acceptedAll"],
});

type SignupStep4 = z.infer<typeof signupStep4Schema>;

const STEPS = [
  { number: 1, name: 'Account Info', description: 'Create your account' },
  { number: 2, name: 'Company Details', description: 'Tell us about yourself' },
  { number: 3, name: 'Subscription', description: 'Choose your plan' },
  { number: 4, name: 'Terms', description: 'Accept terms' },
  { number: 5, name: 'Hardware', description: 'Setup checklist' },
  { number: 6, name: 'Confirmation', description: 'Review and confirm' },
];

type SignupFormData = {
  step1: SignupStep1;
  step2: SignupStep2;
  step3: SignupStep3;
  step4: SignupStep4;
};

export default function SignupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [signupId, setSignupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  // Email verification sub-step (between Step 1 and Step 2)
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  // SMS verification sub-step (after email, before Step 2)
  const [showSmsVerify, setShowSmsVerify] = useState(false);
  const [smsVerifyCode, setSmsVerifyCode] = useState('');
  const [isVerifyingSms, setIsVerifyingSms] = useState(false);
  const [isResendingSms, setIsResendingSms] = useState(false);
  const [smsDevMode, setSmsDevMode] = useState(false);

  const [step3Error, setStep3Error] = useState<string | null>(null);

  // Step 3 state — subscription selection
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);

  // Hardware Bundle voucher state
  const [hardwareVoucherCode, setHardwareVoucherCode] = useState('');
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);
  const [voucherValidated, setVoucherValidated] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // Step 3 payment sub-step state
  // The wizard shows tier selection first, then a Square payment form.
  // If payment fails the tier selection is preserved so the user can retry.
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [squareCard, setSquareCard] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Step 4 state
  const [acceptedTerms, setAcceptedTerms] = useState({
    mainTerms: false,
    privacyPolicy: false,
    dataUsage: false,
    paymentTerms: false,
  });
  const [acceptAll, setAcceptAll] = useState(false);

  // Step 5 state
  const [hardwareAcknowledged, setHardwareAcknowledged] = useState(false);
  const [acknowledgedItems, setAcknowledgedItems] = useState<string[]>([]);

  // Step 6 state - Password re-entry for security
  const [confirmationPassword, setConfirmationPassword] = useState('');
  const [showConfirmationPassword, setShowConfirmationPassword] = useState(false);

  // Form state for each step
  const [formData, setFormData] = useState<SignupFormData>({
    step1: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    step2: {
      company: '',
      title: '',
      phone: '',
      address: '',
    },
    step3: {
      subscriptionTier: '',
      selectedAddons: [],
      totalPrice: 0,
    },
    step4: {
      termsVersionId: '',
      acceptedTerms: {
        mainTerms: false,
        privacyPolicy: false,
        dataUsage: false,
        paymentTerms: false,
      },
      acceptedAll: false,
    },
  });

  // Fetch pricing data for Step 3
  interface PricingItem {
    id: string;
    itemType: 'subscription_tier' | 'addon';
    itemKey: string;
    displayName: string;
    description: string | null;
    price: number;
    currency: string;
    billingPeriod: 'monthly' | 'yearly' | null;
    isActive: boolean;
    metadata?: Record<string, any> | string;
  }
  const { data: pricingData, isLoading: pricingLoading } = useQuery<{ success: boolean; pricing: PricingItem[] }>({
    queryKey: ['/api/pricing/public'],
    enabled: currentStep === 3,
  });

  // Fetch latest terms for Step 4
  const { data: termsData, isLoading: termsLoading } = useQuery<{
    success: boolean;
    terms: {
      id: string;
      version: string;
      title: string;
      content: string;
      effectiveDate: string;
      isActive: boolean;
    };
  }>({
    queryKey: ['/api/terms/latest'],
    enabled: currentStep === 4,
  });

  // Step 1 Form
  const step1Form = useForm<SignupStep1>({
    resolver: zodResolver(signupStep1Schema),
    defaultValues: formData.step1,
  });

  // Step 2 Form
  const step2Form = useForm<SignupStep2>({
    resolver: zodResolver(signupStep2Schema),
    defaultValues: formData.step2,
  });

  // Load Square Web Payments SDK script on mount (sandbox or production).
  // The SDK initialises the card form in initSquareCard() when the user
  // advances to the payment sub-step. Nothing breaks if the env vars are absent.
  useEffect(() => {
    const appId = import.meta.env.VITE_SQUARE_APP_ID as string | undefined;
    if (!appId) return; // Skip if not configured
    const isSandbox = appId.startsWith('sandbox-');
    const src = isSandbox
      ? 'https://sandbox.web.squarecdn.com/v1/square.js'
      : 'https://web.squarecdn.com/v1/square.js';
    if (document.querySelector(`script[src="${src}"]`)) return; // Already loaded
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Calculate password strength
  useEffect(() => {
    const password = step1Form.watch('password');
    if (!password) {
      setPasswordStrength('weak');
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) setPasswordStrength('weak');
    else if (strength <= 4) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [step1Form.watch('password')]);

  // Submit Step 1 - saves data then shows email verification sub-step
  const onStep1Submit = async (data: SignupStep1) => {
    setIsLoading(true);

    try {
      const response = await apiRequest<{ signupId: string; message: string }>('/api/signup/start', {
        method: 'POST',
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          password: data.password,
        }),
      });

      const id = response.signupId;
      setSignupId(id);
      setFormData((prev) => ({ ...prev, step1: data }));

      // Send verification code and show email verification sub-step
      await apiRequest('/api/signup/send-verification', {
        method: 'POST',
        body: JSON.stringify({ signupId: id }),
      });

      setShowEmailVerify(true);
      setEmailVerifyCode('');
      /* toast removed */
    } catch (error: any) {
      toast.error('Failed to save account information', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Verify the email code entered by the user — then trigger SMS verification
  const handleVerifyEmail = async () => {
    if (!signupId || !emailVerifyCode.trim()) return;
    setIsVerifyingCode(true);
    try {
      await apiRequest('/api/signup/verify-code', {
        method: 'POST',
        body: JSON.stringify({ signupId, code: emailVerifyCode.trim() }),
      });
      /* toast removed */
      // Transition to SMS sub-step
      setShowEmailVerify(false);
      setSmsVerifyCode('');
      // Send SMS code automatically
      const smsResp = await apiRequest<{ devMode?: boolean }>('/api/signup/send-sms-verification', {
        method: 'POST',
        body: JSON.stringify({ signupId }),
      });
      setSmsDevMode(smsResp.devMode || false);
      setShowSmsVerify(true);
    } catch (error: any) {
      toast.error('Verification failed', {
        description: error.message || 'Invalid or expired code. Please try again.',
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Resend the email verification code
  const handleResendCode = async () => {
    if (!signupId) return;
    setIsResendingCode(true);
    try {
      await apiRequest('/api/signup/send-verification', {
        method: 'POST',
        body: JSON.stringify({ signupId }),
      });
      setEmailVerifyCode('');
      /* toast removed */
    } catch (error: any) {
      toast.error('Failed to resend code', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsResendingCode(false);
    }
  };

  // Verify SMS code
  const handleVerifySms = async () => {
    if (!signupId || !smsVerifyCode.trim()) return;
    setIsVerifyingSms(true);
    try {
      await apiRequest('/api/signup/verify-sms-code', {
        method: 'POST',
        body: JSON.stringify({ signupId, code: smsVerifyCode.trim() }),
      });
      setShowSmsVerify(false);
      setCurrentStep(2);
      /* toast removed */
    } catch (error: any) {
      toast.error('SMS verification failed', {
        description: error.message || 'Invalid or expired code. Please try again.',
      });
    } finally {
      setIsVerifyingSms(false);
    }
  };

  // Resend SMS verification code
  const handleResendSms = async () => {
    if (!signupId) return;
    setIsResendingSms(true);
    try {
      const smsResp = await apiRequest<{ devMode?: boolean }>('/api/signup/send-sms-verification', {
        method: 'POST',
        body: JSON.stringify({ signupId }),
      });
      setSmsDevMode(smsResp.devMode || false);
      setSmsVerifyCode('');
      /* toast removed */
    } catch (error: any) {
      toast.error('Failed to resend SMS', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsResendingSms(false);
    }
  };

  // Submit Step 2
  const onStep2Submit = async (data: SignupStep2) => {
    if (!signupId) {
      toast.error('Invalid signup session. Please start over.');
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest(`/api/signup/progress/${signupId}`, {
        method: 'PUT',
        body: JSON.stringify({ step: 2, ...data }),
      });

      setFormData((prev) => ({ ...prev, step2: data }));
      /* toast removed */
      setCurrentStep(3);
    } catch (error: any) {
      toast.error('Failed to save company details', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Validate a hardware bundle voucher code
  const validateVoucher = async () => {
    if (!hardwareVoucherCode.trim()) return;
    setIsValidatingVoucher(true);
    setVoucherError(null);
    try {
      const resp = await apiRequest<{ valid: boolean; message?: string; error?: string }>('/api/voucher/validate', {
        method: 'POST',
        body: JSON.stringify({ code: hardwareVoucherCode.trim() }),
      });
      if (resp.valid) {
        setVoucherValidated(true);
        /* toast removed */
      } else {
        setVoucherError(resp.error || 'Invalid voucher code');
        setVoucherValidated(false);
      }
    } catch (error: any) {
      setVoucherError(error.message || 'Failed to validate voucher. Please try again.');
      setVoucherValidated(false);
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  // Free tiers that skip payment
  const FREE_TIERS = ['beta_tester', 'hardware_bundle'];

  // Step 3 Phase 1 — Save subscription selection and open the payment form.
  // Tier and add-on selections are preserved in React state so that if payment
  // fails the user does NOT need to re-select them.
  const onStep3Submit = async () => {
    if (!signupId) {
      toast.error('Invalid signup session. Please start over.');
      return;
    }

    if (!selectedTier) {
      toast.error('Please select a subscription tier');
      return;
    }

    // Hardware bundle requires a validated voucher code
    if (selectedTier === 'hardware_bundle' && !voucherValidated) {
      toast.error('Please validate your hardware voucher code first');
      return;
    }

    setIsLoading(true);
    setStep3Error(null);

    try {
      await apiRequest(`/api/signup/progress/${signupId}`, {
        method: 'PUT',
        body: JSON.stringify({
          step: 3,
          subscriptionTier: selectedTier,
          selectedAddons,
          totalPrice,
          hardwareVoucherCode: selectedTier === 'hardware_bundle' ? hardwareVoucherCode.trim().toUpperCase() : undefined,
        }),
      });

      setFormData((prev) => ({
        ...prev,
        step3: {
          subscriptionTier: selectedTier,
          selectedAddons,
          totalPrice,
        },
      }));

      // Free tiers skip payment and go straight to Step 4
      if (FREE_TIERS.includes(selectedTier)) {
        /* toast removed */
        setCurrentStep(4);
        return;
      }

      /* toast removed */
      setPaymentError(null);
      setShowPaymentForm(true);
      // Initialise the Square card form after the DOM renders
      setTimeout(() => initSquareCard(), 300);
    } catch (error: any) {
      const msg = error.message || 'Failed to save subscription selection. Please try again.';
      setStep3Error(msg);
      toast.error('Failed to save subscription selection', { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialise the Square Web Payments SDK card form.
  // Falls back to a placeholder UI when VITE_SQUARE_APP_ID is not configured
  // (e.g. in development without Square credentials).
  const initSquareCard = async () => {
    const appId = import.meta.env.VITE_SQUARE_APP_ID as string | undefined;
    const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined;

    if (!appId || !locationId) {
      setSquareCard(null); // mock mode — no card form rendered
      return;
    }

    try {
      const squareJs = (window as any).Square;
      if (!squareJs) {
        console.warn('Square Web Payments SDK not loaded');
        setSquareCard(null);
        return;
      }
      const payments = squareJs.payments(appId, locationId);
      const card = await payments.card();
      await card.attach('#square-card-container');
      setSquareCard(card);
    } catch (err) {
      console.error('Failed to initialise Square card form:', err);
      setSquareCard(null);
    }
  };

  // Step 3 Phase 2 — Tokenise card via Square SDK and send to backend.
  // On any failure the tier/add-on selection is preserved; only paymentError changes.
  const onStep3PaymentSubmit = async () => {
    if (!signupId) return;
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      let sourceId: string | null = null;

      if (squareCard) {
        const result = await squareCard.tokenize();
        if (result.status !== 'OK') {
          const errMsg = result.errors?.[0]?.message || 'Card tokenisation failed';
          throw new Error(errMsg);
        }
        sourceId = result.token;
      } else {
        // Square not configured — send a sentinel to trigger deferred mode
        sourceId = 'MOCK_DEV_TOKEN';
      }

      const response = await apiRequest(`/api/signup/process-payment/${signupId}`, {
        method: 'POST',
        body: JSON.stringify({ sourceId }),
      });

      const responseData = response as any;
      setPaymentId(responseData.paymentId || null);
      /* toast removed */
      setShowPaymentForm(false);
      setCurrentStep(4);
    } catch (error: any) {
      const msg = error.message || 'Payment failed. Please check your card details and try again.';
      setPaymentError(msg);
      toast.error('Payment failed', { description: msg });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Submit Step 4
  const onStep4Submit = async () => {
    if (!signupId || !termsData?.terms) {
      toast.error('Invalid signup session or terms data. Please try again.');
      return;
    }

    if (!acceptAll) {
      toast.error('You must accept all terms to continue');
      return;
    }

    setIsLoading(true);

    try {
      // First, save terms acceptance to backend
      await apiRequest('/api/terms/accept', {
        method: 'POST',
        body: JSON.stringify({
          signupId,
          termsVersionId: termsData.terms.id,
          acceptedTerms,
        }),
      });

      // Then update signup progress
      await apiRequest(`/api/signup/progress/${signupId}`, {
        method: 'PUT',
        body: JSON.stringify({
          step: 4,
          termsVersionId: termsData.terms.id,
          acceptedTerms,
          acceptedAll: acceptAll,
        }),
      });

      setFormData((prev) => ({
        ...prev,
        step4: {
          termsVersionId: termsData.terms.id,
          acceptedTerms,
          acceptedAll: acceptAll,
        },
      }));
      /* toast removed */
      setCurrentStep(5);
    } catch (error: any) {
      toast.error('Failed to record terms acceptance', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total price in real-time for Step 3
  useEffect(() => {
    const pricing = pricingData?.pricing || [];
    if (!pricing.length) return;

    let total = 0;

    // Add selected tier price
    if (selectedTier) {
      const tier = pricing.find(
        (p) => p.itemType === 'subscription_tier' && p.itemKey === selectedTier
      );
      if (tier) {
        total += tier.price / 100; // Convert cents to dollars
      }
    }

    // Add selected addon prices
    selectedAddons.forEach((addonKey) => {
      const addon = pricing.find(
        (p) => p.itemType === 'addon' && p.itemKey === addonKey
      );
      if (addon) {
        total += addon.price / 100; // Convert cents to dollars
      }
    });

    setTotalPrice(total);
  }, [selectedTier, selectedAddons, pricingData]);

  // Handle "Accept All" checkbox for Step 4
  useEffect(() => {
    const allChecked =
      acceptedTerms.mainTerms &&
      acceptedTerms.privacyPolicy &&
      acceptedTerms.dataUsage &&
      acceptedTerms.paymentTerms;

    setAcceptAll(allChecked);
  }, [acceptedTerms]);

  // Submit Step 5
  const onStep5Submit = async () => {
    if (!signupId) {
      toast.error('Invalid signup session. Please start over.');
      return;
    }

    if (!hardwareAcknowledged) {
      toast.error('Please acknowledge the hardware requirements');
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest(`/api/signup/progress/${signupId}`, {
        method: 'PUT',
        body: JSON.stringify({
          step: 5,
          hardwareAcknowledged,
          acknowledgedItems,
        }),
      });

      /* toast removed */
      setCurrentStep(6);
    } catch (error: any) {
      toast.error('Failed to save hardware checklist', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Complete Signup (Step 6)
  const onCompleteSignup = async () => {
    if (!signupId) {
      toast.error('Invalid signup session. Please start over.');
      return;
    }

    // Validate password is entered
    if (!confirmationPassword) {
      toast.error('Please enter your password to complete signup');
      return;
    }

    if (confirmationPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Send password in request body for verification and Firebase user creation
      await apiRequest(`/api/signup/complete/${signupId}`, {
        method: 'PUT',
        body: JSON.stringify({ password: confirmationPassword }),
      });

      /* toast removed */
      
      // Clear password from memory
      setConfirmationPassword('');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      toast.error('Failed to complete signup', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back button
  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      setCurrentStep(3);
    } else if (currentStep === 5) {
      setCurrentStep(4);
    } else if (currentStep === 6) {
      setCurrentStep(5);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-100 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Zap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2" data-testid="text-signup-title">
            Create Your Account
          </h1>
          <p className="text-gray-400 text-lg" data-testid="text-signup-description">
            Join MeasurePRO for professional measurement and surveying tools
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all
                      ${
                        step.number < currentStep
                          ? 'bg-green-600 text-white'
                          : step.number === currentStep
                          ? 'bg-blue-600 text-white ring-4 ring-blue-600/30'
                          : 'bg-gray-700 text-gray-400'
                      }
                    `}
                    data-testid={`step-indicator-${step.number}`}
                  >
                    {step.number < currentStep ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>
                  <div className="mt-2 text-center hidden md:block">
                    <p className={`text-xs font-medium ${step.number === currentStep ? 'text-blue-400' : 'text-gray-500'}`}>
                      {step.name}
                    </p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      h-0.5 flex-1 mx-2 transition-all
                      ${step.number < currentStep ? 'bg-green-600' : 'bg-gray-700'}
                    `}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center md:hidden">
            <p className="text-sm text-gray-400">
              {STEPS[currentStep - 1]?.name} - {STEPS[currentStep - 1]?.description}
            </p>
          </div>
        </div>

        {/* Step 1: Email Verification Sub-Step */}
        {currentStep === 1 && showEmailVerify && !showSmsVerify && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              {/* Sequential verification progress indicator */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">1</div>
                  <span className="text-sm font-medium text-blue-400">Email Verification</span>
                </div>
                <div className="flex-1 h-px bg-gray-600" />
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-400 text-xs font-bold">2</div>
                  <span className="text-sm text-gray-500">Phone Verification</span>
                </div>
              </div>
              <CardTitle className="text-2xl text-white flex items-center gap-2" data-testid="text-email-verify-title">
                <Mail className="h-6 w-6 text-blue-400" />
                Verify Your Email
              </CardTitle>
              <CardDescription className="text-gray-400">
                We sent a 6-digit code to <strong className="text-gray-200">{formData.step1.email}</strong>. Enter it below to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Email Verification Code</label>
                <Input
                  value={emailVerifyCode}
                  onChange={(e) => setEmailVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="bg-gray-900 border-gray-600 text-white text-center text-2xl tracking-widest font-mono placeholder:text-gray-600"
                  data-testid="input-email-verify-code"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && emailVerifyCode.length === 6) handleVerifyEmail(); }}
                />
              </div>
              <Button
                onClick={handleVerifyEmail}
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                disabled={isVerifyingCode || emailVerifyCode.length !== 6}
                data-testid="button-verify-email"
              >
                {isVerifyingCode ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verifying email...</>
                ) : (
                  <><CheckCircle className="mr-2 h-5 w-5" />Verify Email &amp; Continue</>
                )}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Didn't receive the code?</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResendingCode}
                  className="text-blue-400 hover:underline font-medium disabled:opacity-50 flex items-center gap-1"
                  data-testid="button-resend-code"
                >
                  {isResendingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Resend email code
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailVerify(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-300 underline mt-1"
                data-testid="button-back-to-step1"
              >
                Go back and edit account information
              </button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: SMS Verification Sub-Step (after email is verified) */}
        {currentStep === 1 && showSmsVerify && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              {/* Sequential verification progress indicator */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span className="text-sm text-green-400 font-medium">Email Verified</span>
                </div>
                <div className="flex-1 h-px bg-blue-600" />
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">2</div>
                  <span className="text-sm font-medium text-blue-400">Phone Verification</span>
                </div>
              </div>
              <CardTitle className="text-2xl text-white flex items-center gap-2" data-testid="text-sms-verify-title">
                <Phone className="h-6 w-6 text-blue-400" />
                Verify Your Phone
              </CardTitle>
              <CardDescription className="text-gray-400">
                We sent a 6-digit code via SMS to <strong className="text-gray-200">{formData.step1.phone}</strong>. Enter it below.
                {smsDevMode && (
                  <span className="block mt-1 text-yellow-400 text-xs">
                    Dev mode: SMS not sent — check the server console for the code.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">SMS Verification Code</label>
                <Input
                  value={smsVerifyCode}
                  onChange={(e) => setSmsVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="bg-gray-900 border-gray-600 text-white text-center text-2xl tracking-widest font-mono placeholder:text-gray-600"
                  data-testid="input-sms-verify-code"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && smsVerifyCode.length === 6) handleVerifySms(); }}
                />
              </div>
              <Button
                onClick={handleVerifySms}
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                disabled={isVerifyingSms || smsVerifyCode.length !== 6}
                data-testid="button-verify-sms"
              >
                {isVerifyingSms ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verifying phone...</>
                ) : (
                  <><CheckCircle className="mr-2 h-5 w-5" />Verify Phone &amp; Continue</>
                )}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Didn't receive the SMS?</span>
                <button
                  type="button"
                  onClick={handleResendSms}
                  disabled={isResendingSms}
                  className="text-blue-400 hover:underline font-medium disabled:opacity-50 flex items-center gap-1"
                  data-testid="button-resend-sms"
                >
                  {isResendingSms ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Resend SMS
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Account Information */}
        {currentStep === 1 && !showEmailVerify && !showSmsVerify && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white" data-testid="text-step1-title">
                Account Information
              </CardTitle>
              <CardDescription className="text-gray-400">
                Create your account credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-6">
                  {/* Full Name */}
                  <FormField
                    control={step1Form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Full Name *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              placeholder="John Doe"
                              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-fullName"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={step1Form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Email Address *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="john@example.com"
                              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Phone Number */}
                  <FormField
                    control={step1Form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Phone Number *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="tel"
                              placeholder="+1 (555) 000-0000"
                              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-phone"
                            />
                          </div>
                        </FormControl>
                        <FormDescription className="text-gray-400">
                          Used for SMS verification — include country code (e.g. +1)
                        </FormDescription>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Password */}
                  <FormField
                    control={step1Form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Password *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              className="pl-10 pr-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3 text-gray-400 hover:text-gray-200"
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormDescription className="text-gray-400">
                          Must be at least 8 characters
                        </FormDescription>
                        {/* Password Strength Indicator */}
                        {field.value && (
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2 mb-1">
                              <div className={`h-1 flex-1 rounded ${passwordStrength === 'weak' ? 'bg-red-500' : passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                              <div className={`h-1 flex-1 rounded ${passwordStrength === 'medium' || passwordStrength === 'strong' ? passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500' : 'bg-gray-700'}`} />
                              <div className={`h-1 flex-1 rounded ${passwordStrength === 'strong' ? 'bg-green-500' : 'bg-gray-700'}`} />
                            </div>
                            <p className={`text-xs ${passwordStrength === 'weak' ? 'text-red-400' : passwordStrength === 'medium' ? 'text-yellow-400' : 'text-green-400'}`} data-testid="text-password-strength">
                              Password strength: {passwordStrength}
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                              {[
                                { label: '8+ characters', met: field.value.length >= 8 },
                                { label: 'Uppercase', met: /[A-Z]/.test(field.value) },
                                { label: 'Lowercase', met: /[a-z]/.test(field.value) },
                                { label: 'Number', met: /\d/.test(field.value) },
                              ].map((c) => (
                                <div key={c.label} className="flex items-center gap-1">
                                  {c.met ? <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" /> : <XCircle className="h-3 w-3 text-gray-600 flex-shrink-0" />}
                                  <span className={`text-xs ${c.met ? 'text-green-400' : 'text-gray-500'}`}>{c.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Confirm Password */}
                  <FormField
                    control={step1Form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Confirm Password *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              className="pl-10 pr-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-confirmPassword"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-3 text-gray-400 hover:text-gray-200"
                              data-testid="button-toggle-confirmPassword"
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading || !step1Form.formState.isValid}
                    data-testid="button-next-step1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  <p className="text-sm text-center text-gray-400">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="text-blue-400 hover:underline font-medium"
                      data-testid="link-login"
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Company Details */}
        {currentStep === 2 && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white" data-testid="text-step2-title">
                Company Details
              </CardTitle>
              <CardDescription className="text-gray-400">
                Tell us more about yourself (optional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-6">
                  {/* Company Name */}
                  <FormField
                    control={step2Form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Company Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              placeholder="Acme Corp"
                              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-company"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Job Title */}
                  <FormField
                    control={step2Form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Job Title</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              placeholder="Survey Engineer"
                              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-title"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Phone Number */}
                  <FormField
                    control={step2Form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Phone Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="tel"
                              placeholder="+1.438.533.5344"
                              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                              data-testid="input-phone"
                            />
                          </div>
                        </FormControl>
                        <FormDescription className="text-gray-400">
                          International format accepted
                        </FormDescription>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Address */}
                  <FormField
                    control={step2Form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-200">Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Textarea
                              {...field}
                              placeholder="123 Main St, City, State, ZIP"
                              className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 min-h-[100px]"
                              data-testid="input-address"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* Navigation Buttons */}
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1 h-12 text-base bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      data-testid="button-back-step2"
                    >
                      <ArrowLeft className="mr-2 h-5 w-5" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
                      disabled={isLoading}
                      data-testid="button-next-step2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Subscription Selection */}
        {currentStep === 3 && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center" data-testid="text-step3-title">
                <DollarSign className="mr-2 h-6 w-6 text-blue-500" />
                Subscription Selection
              </CardTitle>
              <CardDescription className="text-gray-400">
                Choose your plan and optional add-ons
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pricingLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Base Plans Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Choose Your Plan</h3>
                    <p className="text-sm text-gray-400 mb-4">Select one base plan to get started</p>
                    <div className="grid grid-cols-1 gap-4">
                      {/* MeasurePRO Lite - Lifetime */}
                      {(() => {
                        const lite = (pricingData?.pricing || []).find((p: any) => p.itemKey === 'measurepro_lite');
                        if (!lite) return null;
                        const metadata = typeof lite.metadata === 'string' ? JSON.parse(lite.metadata) : lite.metadata;
                        return (
                          <button
                            key={lite.id}
                            onClick={() => setSelectedTier('measurepro_lite')}
                            className={`p-6 rounded-lg border-2 transition-all text-left ${
                              selectedTier === 'measurepro_lite'
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                            }`}
                            data-testid="tier-option-measurepro_lite"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <h4 className="text-xl font-bold text-white">{lite.displayName}</h4>
                                <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded-full border border-green-600/30">
                                  LIFETIME
                                </span>
                              </div>
                              {selectedTier === 'measurepro_lite' && <CheckCircle className="h-6 w-6 text-blue-500" />}
                            </div>
                            <p className="text-gray-400 text-sm mb-3">{lite.description}</p>
                            <div className="text-2xl font-bold text-green-400">
                              ${(lite.price / 100).toFixed(0)} <span className="text-sm text-gray-400">one-time</span>
                            </div>
                            {metadata?.features && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {metadata.features.slice(0, 3).map((f: string, i: number) => (
                                  <span key={i} className="text-xs text-gray-400 bg-gray-600/50 px-2 py-1 rounded">{f}</span>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })()}

                      {/* MeasurePRO Monthly/Annual */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          const monthly = (pricingData?.pricing || []).find((p: any) => p.itemKey === 'measurepro_monthly');
                          if (!monthly) return null;
                          return (
                            <button
                              key={monthly.id}
                              onClick={() => setSelectedTier('measurepro_monthly')}
                              className={`p-6 rounded-lg border-2 transition-all text-left ${
                                selectedTier === 'measurepro_monthly'
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                              }`}
                              data-testid="tier-option-measurepro_monthly"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xl font-bold text-white">{monthly.displayName}</h4>
                                {selectedTier === 'measurepro_monthly' && <CheckCircle className="h-6 w-6 text-blue-500" />}
                              </div>
                              <p className="text-gray-400 text-sm mb-3">{monthly.description}</p>
                              <div className="text-2xl font-bold text-blue-400">
                                ${(monthly.price / 100).toFixed(0)}<span className="text-sm text-gray-400">/month</span>
                              </div>
                            </button>
                          );
                        })()}

                        {(() => {
                          const annual = (pricingData?.pricing || []).find((p: any) => p.itemKey === 'measurepro_annual');
                          if (!annual) return null;
                          const metadata = typeof annual.metadata === 'string' ? JSON.parse(annual.metadata) : annual.metadata;
                          return (
                            <button
                              key={annual.id}
                              onClick={() => setSelectedTier('measurepro_annual')}
                              className={`p-6 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                                selectedTier === 'measurepro_annual'
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                              }`}
                              data-testid="tier-option-measurepro_annual"
                            >
                              <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                2 MONTHS FREE!
                              </div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xl font-bold text-white">{annual.displayName}</h4>
                                {selectedTier === 'measurepro_annual' && <CheckCircle className="h-6 w-6 text-blue-500" />}
                              </div>
                              <p className="text-gray-400 text-sm mb-3">Pay 12 months, get 14 months!</p>
                              <div className="text-2xl font-bold text-purple-400">
                                ${(annual.price / 100).toFixed(0)}<span className="text-sm text-gray-400">/year</span>
                              </div>
                              <p className="text-xs text-purple-300 mt-1">= $214/month effective rate</p>
                            </button>
                          );
                        })()}
                      </div>

                      {/* Beta Tester - Free with Approval */}
                      {(() => {
                        const beta = (pricingData?.pricing || []).find((p: any) => p.itemKey === 'beta_tester');
                        if (!beta) return null;
                        return (
                          <button
                            key={beta.id}
                            onClick={() => setSelectedTier('beta_tester')}
                            className={`p-6 rounded-lg border-2 transition-all text-left ${
                              selectedTier === 'beta_tester'
                                ? 'border-yellow-500 bg-yellow-500/10'
                                : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                            }`}
                            data-testid="tier-option-beta_tester"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <h4 className="text-xl font-bold text-white">{beta.displayName}</h4>
                                <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-semibold rounded-full border border-yellow-600/30">
                                  REQUIRES APPROVAL
                                </span>
                              </div>
                              {selectedTier === 'beta_tester' && <CheckCircle className="h-6 w-6 text-yellow-500" />}
                            </div>
                            <p className="text-gray-400 text-sm mb-3">{beta.description}</p>
                            <div className="text-2xl font-bold text-yellow-400">
                              FREE <span className="text-sm text-gray-400">pending admin approval</span>
                            </div>
                            <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-yellow-300">
                                  Beta tester accounts require manual approval by an administrator. You will be notified once your account is approved.
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })()}

                      {/* Hardware Bundle tier — voucher-only, no payment */}
                      <button
                        type="button"
                        onClick={() => { setSelectedTier('hardware_bundle'); setVoucherError(null); }}
                        className={`p-6 rounded-lg border-2 transition-all text-left ${
                          selectedTier === 'hardware_bundle'
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }`}
                        data-testid="tier-option-hardware_bundle"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <h4 className="text-xl font-bold text-white">Hardware Bundle</h4>
                            <span className="px-2 py-1 bg-orange-600/20 text-orange-400 text-xs font-semibold rounded-full border border-orange-600/30">
                              VOUCHER REQUIRED
                            </span>
                          </div>
                          {selectedTier === 'hardware_bundle' && <CheckCircle className="h-6 w-6 text-orange-500" />}
                        </div>
                        <p className="text-gray-400 text-sm mb-3">
                          Included with your SolTec hardware purchase. Enter your voucher code to activate 6 months of MeasurePRO at no additional cost.
                        </p>
                        <div className="text-2xl font-bold text-orange-400">
                          6 months free <span className="text-sm text-gray-400">with hardware purchase</span>
                        </div>
                        {selectedTier === 'hardware_bundle' && (
                          <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                            <div className="p-3 bg-orange-900/20 border border-orange-600/30 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-orange-300">
                                  Your hardware bundle includes a voucher code in the format <strong>SOLT-XXXX-XXXX</strong>. Enter it below to activate your subscription.
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={hardwareVoucherCode}
                                onChange={(e) => {
                                  setHardwareVoucherCode(e.target.value.toUpperCase());
                                  setVoucherValidated(false);
                                  setVoucherError(null);
                                }}
                                placeholder="SOLT-XXXX-XXXX"
                                maxLength={14}
                                className="flex-1 px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                data-testid="input-voucher-code"
                              />
                              <button
                                type="button"
                                onClick={validateVoucher}
                                disabled={isValidatingVoucher || !hardwareVoucherCode.trim() || voucherValidated}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                                data-testid="button-validate-voucher"
                              >
                                {isValidatingVoucher ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : voucherValidated ? (
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                ) : (
                                  'Validate'
                                )}
                              </button>
                            </div>
                            {voucherValidated && (
                              <div className="flex items-center gap-2 text-green-400 text-sm">
                                <CheckCircle className="h-4 w-4" />
                                <span>Voucher validated successfully!</span>
                              </div>
                            )}
                            {voucherError && (
                              <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                <span>{voucherError}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* MeasurePRO+ Add-ons Section */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">MeasurePRO+ Add-ons</h3>
                      <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs font-semibold rounded-full border border-purple-600/30">
                        PREMIUM
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Enhance MeasurePRO with AI and advanced features</p>
                    <div className="space-y-3">
                      {(pricingData?.pricing || [])
                        .filter((p: any) => p.itemType === 'addon' && !p.itemKey.startsWith('roadscope'))
                        .map((addon: any) => {
                          const isSelected = selectedAddons.includes(addon.itemKey);
                          const metadata = typeof addon.metadata === 'string' ? JSON.parse(addon.metadata) : addon.metadata;
                          return (
                            <label
                              key={addon.id}
                              className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected ? 'border-purple-500 bg-purple-500/5' : 'border-gray-600 bg-gray-750 hover:border-gray-500'
                              }`}
                              data-testid={`addon-option-${addon.itemKey}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAddons([...selectedAddons, addon.itemKey]);
                                  } else {
                                    setSelectedAddons(selectedAddons.filter((k) => k !== addon.itemKey));
                                  }
                                }}
                                className="mt-1 mr-3 h-5 w-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                                data-testid={`checkbox-addon-${addon.itemKey}`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-white">{addon.displayName}</h4>
                                  <span className="text-lg font-bold text-purple-400">
                                    ${(addon.price / 100).toFixed(0)}/mo
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400">{addon.description}</p>
                                {metadata?.convoysIncluded && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Includes {metadata.convoysIncluded} convoys, ${(metadata.additionalConvoyPrice / 100).toFixed(0)}/convoy additional
                                  </p>
                                )}
                                {metadata?.features && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {metadata.features.slice(0, 4).map((f: string, i: number) => (
                                      <span key={i} className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">{f}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  {/* RoadScope Integration Section */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">RoadScope Integration</h3>
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full border border-blue-600/30">
                        OPTIONAL
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Sync your survey data directly to RoadScope platform</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(() => {
                        const rsMonthly = (pricingData?.pricing || []).find((p: any) => p.itemKey === 'roadscope_monthly');
                        if (!rsMonthly) return null;
                        const isSelected = selectedAddons.includes('roadscope_monthly');
                        return (
                          <label
                            className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected ? 'border-blue-500 bg-blue-500/5' : 'border-gray-600 bg-gray-750 hover:border-gray-500'
                            }`}
                            data-testid="addon-option-roadscope_monthly"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAddons([...selectedAddons.filter(k => !k.startsWith('roadscope')), 'roadscope_monthly']);
                                } else {
                                  setSelectedAddons(selectedAddons.filter((k) => k !== 'roadscope_monthly'));
                                }
                              }}
                              className="mt-1 mr-3 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                              data-testid="checkbox-addon-roadscope_monthly"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-white">Monthly</h4>
                                <span className="text-lg font-bold text-blue-400">
                                  ${(rsMonthly.price / 100).toFixed(0)}/mo
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">Flexible month-to-month billing</p>
                            </div>
                          </label>
                        );
                      })()}

                      {(() => {
                        const rsAnnual = (pricingData?.pricing || []).find((p: any) => p.itemKey === 'roadscope_annual');
                        if (!rsAnnual) return null;
                        const isSelected = selectedAddons.includes('roadscope_annual');
                        return (
                          <label
                            className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden ${
                              isSelected ? 'border-blue-500 bg-blue-500/5' : 'border-gray-600 bg-gray-750 hover:border-gray-500'
                            }`}
                            data-testid="addon-option-roadscope_annual"
                          >
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-bl-lg">
                              2 MONTHS FREE!
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAddons([...selectedAddons.filter(k => !k.startsWith('roadscope')), 'roadscope_annual']);
                                } else {
                                  setSelectedAddons(selectedAddons.filter((k) => k !== 'roadscope_annual'));
                                }
                              }}
                              className="mt-1 mr-3 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                              data-testid="checkbox-addon-roadscope_annual"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-white">Annual</h4>
                                <span className="text-lg font-bold text-blue-400">
                                  ${(rsAnnual.price / 100).toFixed(0)}/yr
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">Pay 12 months, get 14 months!</p>
                            </div>
                          </label>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Price Summary */}
                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <h3 className="text-lg font-semibold text-white mb-4">Price Summary</h3>
                    <div className="space-y-2">
                      {selectedTier && (() => {
                        const tier = (pricingData?.pricing || []).find((p: any) => p.itemKey === selectedTier);
                        if (!tier) return null;
                        const isLifetime = !tier.billingPeriod;
                        const isAnnual = tier.billingPeriod === 'yearly';
                        return (
                          <div className="flex justify-between text-gray-300">
                            <span>{tier.displayName}:</span>
                            <span className="font-semibold">
                              ${(tier.price / 100).toFixed(0)}
                              {isLifetime ? ' (lifetime)' : isAnnual ? '/year' : '/mo'}
                            </span>
                          </div>
                        );
                      })()}
                      {selectedAddons.length > 0 && (
                        <div className="border-t border-gray-600 pt-2 mt-2">
                          {selectedAddons.map((addonKey) => {
                            const addon = (pricingData?.pricing || []).find((p: any) => p.itemKey === addonKey);
                            if (!addon) return null;
                            const isAnnual = addon.billingPeriod === 'yearly';
                            return (
                              <div key={addonKey} className="flex justify-between text-gray-300 text-sm">
                                <span>{addon.displayName}:</span>
                                <span>${(addon.price / 100).toFixed(0)}{isAnnual ? '/yr' : '/mo'}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="border-t-2 border-gray-600 pt-3 mt-3">
                        <div className="flex justify-between text-xl font-bold text-white">
                          <span>Total:</span>
                          <span className="text-blue-400" data-testid="text-total-monthly">
                            ${totalPrice.toFixed(0)}
                            {(() => {
                              const tier = (pricingData?.pricing || []).find((p: any) => p.itemKey === selectedTier);
                              if (!tier) return '';
                              if (!tier.billingPeriod) return ' (one-time)';
                              if (tier.billingPeriod === 'yearly') return '/year';
                              return '/mo';
                            })()}
                          </span>
                        </div>
                        {selectedTier === 'beta_tester' && (
                          <p className="text-sm text-yellow-400 mt-2">
                            * Beta tester account requires admin approval before activation
                          </p>
                        )}
                        {selectedTier === 'hardware_bundle' && (
                          <p className="text-sm text-orange-400 mt-2">
                            * 6 months included with your SolTec hardware — no payment required
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step 3 Phase 1 — Save-selection error banner */}
                  {step3Error && !showPaymentForm && (
                    <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-700 rounded-lg" data-testid="step3-error-banner">
                      <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-300 font-medium">Failed to save selection</p>
                        <p className="text-xs text-red-400 mt-0.5">{step3Error}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setStep3Error(null); onStep3Submit(); }}
                        className="flex items-center gap-1 text-xs text-red-300 hover:text-red-100 font-medium"
                        data-testid="button-retry-step3"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    </div>
                  )}

                  {/* Navigation Buttons — Phase 1 (tier selection) */}
                  {!showPaymentForm && (
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1 h-12 text-base bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                        data-testid="button-back-step3"
                      >
                        <ArrowLeft className="mr-2 h-5 w-5" />
                        Back
                      </Button>
                      <Button
                        onClick={() => { setStep3Error(null); onStep3Submit(); }}
                        className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
                        disabled={isLoading || !selectedTier}
                        data-testid="button-next-step3"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : ['beta_tester', 'hardware_bundle'].includes(selectedTier) ? (
                          <>
                            <CheckCircle className="mr-2 h-5 w-5" />
                            Continue
                          </>
                        ) : (
                          <>
                            <DollarSign className="mr-2 h-5 w-5" />
                            Proceed to Payment
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Phase 2 — Square Payment Form */}
                  {showPaymentForm && (
                    <div className="space-y-4" data-testid="payment-form-section">
                      {/* Summary */}
                      <div className="bg-gray-700/60 rounded-lg p-4 border border-gray-600">
                        <p className="text-sm text-gray-400 mb-1">Selected plan</p>
                        <p className="text-white font-semibold capitalize">{selectedTier.replace(/_/g, ' ')}</p>
                        {selectedAddons.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">+ {selectedAddons.length} add-on(s)</p>
                        )}
                        <p className="text-lg font-bold text-green-400 mt-2">${totalPrice.toFixed(2)} / year</p>
                        <button
                          type="button"
                          onClick={() => { setShowPaymentForm(false); setPaymentError(null); }}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-1 underline"
                          data-testid="button-change-plan"
                        >
                          Change plan
                        </button>
                      </div>

                      {/* Card input (Square Web Payments SDK or mock) */}
                      {import.meta.env.VITE_SQUARE_APP_ID ? (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Card details</p>
                          <div
                            id="square-card-container"
                            className="min-h-[100px] bg-white rounded-lg p-2"
                            data-testid="square-card-container"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 p-4" data-testid="payment-dev-notice">
                          <p className="text-yellow-400 text-sm font-medium">Development mode</p>
                          <p className="text-yellow-300 text-xs mt-1">
                            Square credentials (VITE_SQUARE_APP_ID / VITE_SQUARE_LOCATION_ID) are not configured.
                            Click "Complete Payment" to record a deferred payment and continue.
                          </p>
                        </div>
                      )}

                      {/* Payment failure error banner with retry */}
                      {paymentError && (
                        <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-700 rounded-lg" data-testid="payment-error-banner">
                          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-red-300 font-medium">Payment failed</p>
                            <p className="text-xs text-red-400 mt-0.5">{paymentError}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Your plan selection is saved. Check your card details and try again.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setPaymentError(null); onStep3PaymentSubmit(); }}
                            className="flex items-center gap-1 text-xs text-red-300 hover:text-red-100 font-medium"
                            data-testid="button-retry-payment"
                          >
                            <RefreshCw className="h-3 w-3" /> Retry
                          </button>
                        </div>
                      )}

                      {/* Payment navigation */}
                      <div className="flex gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setShowPaymentForm(false); setPaymentError(null); }}
                          className="flex-1 h-12 text-base bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                          disabled={isProcessingPayment}
                          data-testid="button-back-to-selection"
                        >
                          <ArrowLeft className="mr-2 h-5 w-5" />
                          Back to Plan
                        </Button>
                        <Button
                          onClick={onStep3PaymentSubmit}
                          className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700"
                          disabled={isProcessingPayment}
                          data-testid="button-complete-payment"
                        >
                          {isProcessingPayment ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 h-5 w-5" />
                              Complete Payment
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Terms & Conditions */}
        {currentStep === 4 && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center" data-testid="text-step4-title">
                <FileText className="mr-2 h-6 w-6 text-blue-500" />
                Terms & Conditions
              </CardTitle>
              <CardDescription className="text-gray-400">
                Review and accept our terms to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              {termsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Terms Content */}
                  <div className="bg-gray-900 rounded-lg p-6 max-h-96 overflow-y-auto border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">{termsData?.terms?.title}</h3>
                      <span className="text-sm text-gray-400">Version {termsData?.terms?.version}</span>
                    </div>
                    <div className="prose prose-invert max-w-none text-gray-300 text-sm" data-testid="text-terms-content">
                      <p className="whitespace-pre-wrap">{termsData?.terms?.content}</p>
                    </div>
                  </div>

                  {/* Individual Checkboxes */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Acceptance Checklist</h3>
                    
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTerms.mainTerms}
                        onChange={(e) =>
                          setAcceptedTerms({ ...acceptedTerms, mainTerms: e.target.checked })
                        }
                        className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                        data-testid="checkbox-main-terms"
                      />
                      <span className="text-gray-300">
                        I have read and agree to the <strong className="text-white">Main Terms of Service</strong>
                      </span>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTerms.privacyPolicy}
                        onChange={(e) =>
                          setAcceptedTerms({ ...acceptedTerms, privacyPolicy: e.target.checked })
                        }
                        className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                        data-testid="checkbox-privacy-policy"
                      />
                      <span className="text-gray-300">
                        I acknowledge the <strong className="text-white">Privacy Policy</strong> and data handling practices
                      </span>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTerms.dataUsage}
                        onChange={(e) =>
                          setAcceptedTerms({ ...acceptedTerms, dataUsage: e.target.checked })
                        }
                        className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                        data-testid="checkbox-data-usage"
                      />
                      <span className="text-gray-300">
                        I consent to <strong className="text-white">Data Usage</strong> as described in the terms
                      </span>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTerms.paymentTerms}
                        onChange={(e) =>
                          setAcceptedTerms({ ...acceptedTerms, paymentTerms: e.target.checked })
                        }
                        className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                        data-testid="checkbox-payment-terms"
                      />
                      <span className="text-gray-300">
                        I agree to the <strong className="text-white">Payment Terms</strong> and billing policies
                      </span>
                    </label>

                    {/* Accept All Master Checkbox */}
                    <div className="border-t border-gray-700 pt-4 mt-4">
                      <label className="flex items-start space-x-3 cursor-pointer bg-blue-500/10 border-2 border-blue-500 rounded-lg p-4">
                        <input
                          type="checkbox"
                          checked={acceptAll}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAcceptAll(checked);
                            setAcceptedTerms({
                              mainTerms: checked,
                              privacyPolicy: checked,
                              dataUsage: checked,
                              paymentTerms: checked,
                            });
                          }}
                          className="mt-1 h-6 w-6 rounded border-blue-500 bg-gray-700 text-blue-600 focus:ring-blue-500"
                          data-testid="checkbox-accept-all"
                        />
                        <div className="flex-1">
                          <span className="text-white font-semibold text-lg block mb-1">
                            <Shield className="inline-block h-5 w-5 mr-2" />
                            I Accept All Terms
                          </span>
                          <span className="text-gray-400 text-sm">
                            By checking this box, you agree to all the terms and conditions listed above
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1 h-12 text-base bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      data-testid="button-back-step4"
                    >
                      <ArrowLeft className="mr-2 h-5 w-5" />
                      Back
                    </Button>
                    <Button
                      onClick={onStep4Submit}
                      className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
                      disabled={isLoading || !acceptAll}
                      data-testid="button-next-step4"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Hardware Compatibility Checklist */}
        {currentStep === 5 && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center" data-testid="text-step5-title">
                <HardDrive className="mr-2 h-6 w-6 text-blue-500" />
                Hardware Compatibility Checklist
              </CardTitle>
              <CardDescription className="text-gray-400">
                Review the required hardware for MeasurePRO
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Information Banner */}
                <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-white font-semibold mb-1">Hardware Requirements</h4>
                      <p className="text-gray-300 text-sm">
                        MeasurePRO requires specific hardware to function properly. You don't need to have all
                        equipment now, but you should plan to acquire it for full functionality.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hardware Items List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Required Hardware</h3>

                  {/* Laser Distance Meter */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Ruler className="h-8 w-8 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">Laser Distance Meter</h4>
                        <p className="text-gray-400 text-sm mb-2">
                          Web Serial API compatible laser distance meter for precise measurements.
                          Recommended: Jenoptik LDS-30 or equivalent.
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Compatible Devices:</span>
                          <span className="text-xs text-blue-400">Jenoptik LDS-30</span>
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-blue-400">Leica DISTO</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GPS Device */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Navigation className="h-8 w-8 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">GPS Device</h4>
                        <p className="text-gray-400 text-sm mb-2">
                          NMEA 0183 compatible GPS receiver for location tracking and geo-referencing.
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Protocol:</span>
                          <span className="text-xs text-green-400">NMEA 0183</span>
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-gray-400">Serial or USB connection</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ZED 2i Camera */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Camera className="h-8 w-8 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">
                          ZED 2i Stereo Camera
                          <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                            MeasurePRO+ Only
                          </span>
                        </h4>
                        <p className="text-gray-400 text-sm mb-2">
                          Required for premium features including AI object detection and 3D depth sensing.
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Model:</span>
                          <span className="text-xs text-purple-400">Stereolabs ZED 2i</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tablet/Laptop */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Laptop className="h-8 w-8 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">Tablet or Laptop</h4>
                        <p className="text-gray-400 text-sm mb-2">
                          Computer with modern web browser supporting Web Serial API and PWA features.
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">OS:</span>
                          <span className="text-xs text-yellow-400">Windows 10/11</span>
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-yellow-400">macOS 11+</span>
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-yellow-400">Linux</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Internet Connection */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Wifi className="h-8 w-8 text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">Internet Connection</h4>
                        <p className="text-gray-400 text-sm mb-2">
                          Stable internet connection for initial setup, cloud sync, and map features.
                          Offline mode available after setup.
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Required for:</span>
                          <span className="text-xs text-cyan-400">Initial setup</span>
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-cyan-400">Cloud sync</span>
                          <span className="text-xs text-gray-600">|</span>
                          <span className="text-xs text-cyan-400">Maps</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommended Vendors (Optional) */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2 text-gray-400" />
                    Recommended Vendors & Resources
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <a
                      href="https://www.jenoptik.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                      data-testid="link-vendor-jenoptik"
                    >
                      Jenoptik - Laser Distance Meters →
                    </a>
                    <a
                      href="https://www.stereolabs.com/zed-2i"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                      data-testid="link-vendor-stereolabs"
                    >
                      Stereolabs - ZED 2i Camera →
                    </a>
                    <a
                      href="https://www.garmin.com/en-US/c/outdoor-recreation/satellite-communicators-networks/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                      data-testid="link-vendor-garmin"
                    >
                      Garmin - GPS Devices →
                    </a>
                    <a
                      href="mailto:admin@soltec.ca?subject=Hardware%20Inquiry"
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                      data-testid="link-contact-hardware"
                    >
                      Contact us for hardware support →
                    </a>
                  </div>
                </div>

                {/* Acknowledgment Checkbox */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                  <label className="flex items-start space-x-3 cursor-pointer bg-blue-500/10 border-2 border-blue-500 rounded-lg p-4">
                    <input
                      type="checkbox"
                      checked={hardwareAcknowledged}
                      onChange={(e) => setHardwareAcknowledged(e.target.checked)}
                      className="mt-1 h-6 w-6 rounded border-blue-500 bg-gray-700 text-blue-600 focus:ring-blue-500"
                      data-testid="checkbox-hardware-acknowledged"
                    />
                    <div className="flex-1">
                      <span className="text-white font-semibold text-lg block mb-1">
                        <CheckSquare className="inline-block h-5 w-5 mr-2" />
                        I Acknowledge Hardware Requirements
                      </span>
                      <span className="text-gray-400 text-sm">
                        I understand the hardware requirements and confirm that I have or will acquire the necessary equipment
                        to use MeasurePRO. I can proceed without all hardware items now, but full functionality will require them.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 h-12 text-base bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    data-testid="button-back-step5"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Back
                  </Button>
                  <Button
                    onClick={onStep5Submit}
                    className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading || !hardwareAcknowledged}
                    data-testid="button-next-step5"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Confirmation */}
        {currentStep === 6 && (
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center" data-testid="text-step6-title">
                <CheckCircle className="mr-2 h-6 w-6 text-green-500" />
                Review & Confirm
              </CardTitle>
              <CardDescription className="text-gray-400">
                Review your signup details and complete registration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Signup Summary */}
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <User className="mr-2 h-5 w-5 text-blue-400" />
                    Account Summary
                  </h3>

                  {/* Account Information */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                      <span className="text-gray-400">Full Name:</span>
                      <span className="text-white font-medium" data-testid="text-summary-name">{formData.step1.fullName}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                      <span className="text-gray-400">Email:</span>
                      <span className="text-white font-medium" data-testid="text-summary-email">{formData.step1.email}</span>
                    </div>

                    {/* Company Details (if provided) */}
                    {(formData.step2.company || formData.step2.title) && (
                      <>
                        <div className="pt-2">
                          <h4 className="text-sm font-semibold text-gray-300 mb-2">Company Details</h4>
                        </div>
                        {formData.step2.company && (
                          <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                            <span className="text-gray-400">Company:</span>
                            <span className="text-white font-medium" data-testid="text-summary-company">{formData.step2.company}</span>
                          </div>
                        )}
                        {formData.step2.title && (
                          <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                            <span className="text-gray-400">Title:</span>
                            <span className="text-white font-medium" data-testid="text-summary-title">{formData.step2.title}</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Subscription Details */}
                    <div className="pt-4">
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Subscription Details</h4>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                      <span className="text-gray-400">Plan:</span>
                      <span className="text-white font-medium" data-testid="text-summary-tier">
                        {selectedTier === 'measure_pro' ? 'MeasurePRO' : 
                         selectedTier === 'measure_pro_plus' ? 'MeasurePRO+' : 
                         selectedTier}
                      </span>
                    </div>

                    {/* Add-ons (if selected) */}
                    {selectedAddons.length > 0 && (
                      <div className="flex justify-between items-start pb-2 border-b border-gray-800">
                        <span className="text-gray-400">Add-ons:</span>
                        <div className="text-right">
                          {selectedAddons.map((addon, idx) => (
                            <div key={idx} className="text-white font-medium text-sm" data-testid={`text-summary-addon-${idx}`}>
                              {addon === 'convoy_guardian' ? 'Convoy Guardian' :
                               addon === 'swept_path' ? 'Swept Path Analysis' :
                               addon}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Total Price */}
                    <div className="flex justify-between items-center pt-4 border-t-2 border-blue-500">
                      <span className="text-lg font-semibold text-white">Total:</span>
                      <span className="text-2xl font-bold text-blue-400" data-testid="text-summary-total">
                        ${totalPrice.toFixed(2)}/month
                      </span>
                    </div>
                  </div>
                </div>

                {/* Activation Code Instructions */}
                <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Shield className="mr-2 h-5 w-5 text-blue-400" />
                    Activation Process
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-300">
                      <strong className="text-white">Payment Processing:</strong> Payment is handled separately from this signup.
                      After completing this registration, you'll receive instructions for payment processing.
                    </p>
                    <p className="text-gray-300">
                      <strong className="text-white">Activation Code:</strong> Once your payment is processed, you will receive
                      an activation code via email. This code is required to unlock your subscription in the MeasurePRO app.
                    </p>
                    <p className="text-gray-300">
                      <strong className="text-white">How to Activate:</strong> After receiving your activation code, log in to
                      MeasurePRO and enter the code in the License Management section to activate your subscription.
                    </p>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Next Steps</h3>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                        1
                      </div>
                      <div>
                        <p className="text-white font-medium">Complete Registration</p>
                        <p className="text-gray-400 text-sm">Click "Complete Signup" below to finalize your registration</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                        2
                      </div>
                      <div>
                        <p className="text-white font-medium">Contact for Payment</p>
                        <p className="text-gray-400 text-sm">
                          Email{' '}
                          <a href="mailto:admin@soltec.ca" className="text-blue-400 hover:underline" data-testid="link-payment-email">
                            admin@soltec.ca
                          </a>
                          {' '}to arrange payment for your subscription
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                        3
                      </div>
                      <div>
                        <p className="text-white font-medium">Receive Activation Code</p>
                        <p className="text-gray-400 text-sm">Your activation code will be sent via email within 24 hours of payment</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                        4
                      </div>
                      <div>
                        <p className="text-white font-medium">Activate Your Subscription</p>
                        <p className="text-gray-400 text-sm">Log in and enter your activation code to unlock MeasurePRO</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Support Information */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">
                    <strong className="text-white">Need Help?</strong> Contact our support team at{' '}
                    <a href="mailto:admin@soltec.ca" className="text-blue-400 hover:underline" data-testid="link-support-email">
                      admin@soltec.ca
                    </a>
                    {' '}for any questions about your signup, payment, or activation process.
                  </p>
                </div>

                {/* Password Confirmation - SECURITY */}
                <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-6">
                  <div className="flex items-start mb-4">
                    <Shield className="mr-3 h-6 w-6 text-yellow-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        Confirm Your Password
                      </h3>
                      <p className="text-gray-300 text-sm">
                        For security purposes, please re-enter your password to complete account creation.
                        Your password is never stored in plaintext.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white" data-testid="label-confirmation-password">
                      Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <Input
                        type={showConfirmationPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={confirmationPassword}
                        onChange={(e) => setConfirmationPassword(e.target.value)}
                        className="pl-10 pr-10 bg-gray-800 border-gray-600 text-white placeholder-gray-500 h-12"
                        data-testid="input-confirmation-password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmationPassword(!showConfirmationPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                        data-testid="button-toggle-confirmation-password"
                      >
                        {showConfirmationPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {confirmationPassword && confirmationPassword.length < 8 && (
                      <p className="text-red-400 text-sm mt-1" data-testid="text-password-error">
                        Password must be at least 8 characters
                      </p>
                    )}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 h-12 text-base bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    data-testid="button-back-step6"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Back
                  </Button>
                  <Button
                    onClick={onCompleteSignup}
                    className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white font-semibold"
                    disabled={isLoading || !confirmationPassword || confirmationPassword.length < 8}
                    data-testid="button-complete-signup"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Complete Signup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
