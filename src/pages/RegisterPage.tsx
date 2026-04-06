/**
 * RegisterPage — Primary customer-facing registration flow (Route: /register)
 *
 * This is the main public-facing registration path:
 *  1. User fills in profile details (name, email, company, etc.)
 *  2. /api/registration/start creates a Firestore account (status: email_pending) and sends a verification code
 *  3. User is redirected to /verify-email to enter the 6-digit code
 *  4. On success the account moves to status: pending → user goes to /set-password
 *  5. /api/registration/finalize links the Firebase Auth UID and notifies the admin
 *  6. User lands on /awaiting-approval until an admin approves their account
 *
 * Contrast with SignupPage (/signup) which is the sales-initiated 6-step wizard
 * that stores progress in PostgreSQL (signup_progress table) and does NOT create
 * a Firestore account until all six steps are completed.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Mail, User, Building2, Briefcase, Phone, MapPin, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.tsx';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx';
import { registrationStartSchema, RegistrationStart } from '../../shared/schema';
import { apiRequest } from '@/lib/queryClient';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegistrationStart>({
    resolver: zodResolver(registrationStartSchema),
    defaultValues: {
      fullName: '',
      email: '',
      company: '',
      title: '',
      phone: '',
      address: '',
      referredBy: '',
    },
  });

  const onSubmit = async (data: RegistrationStart) => {
    setIsLoading(true);

    try {
      const response = await apiRequest<{ accountId: string; message: string }>('/api/registration/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      toast.success('Verification code sent!', {
        description: 'Please check your email for the verification code.',
      });

      // Store email, phone and accountId for the verification pages
      localStorage.setItem('registration_email', data.email);
      localStorage.setItem('registration_phone', data.phone || '');
      localStorage.setItem('registration_accountId', response.accountId);

      // Navigate to email verification page
      navigate('/verify');
    } catch (error: any) {
      // Check if error is due to Firebase Admin unavailability
      if (error.code === 'FIREBASE_ADMIN_UNAVAILABLE' || error.status === 503) {
        toast.error('Registration System Unavailable', {
          description: 'Server-side registration requires Firebase credentials. Please contact the administrator or use the login page if you already have an account.',
          duration: 8000,
        });
      } else {
        toast.error('Registration failed', {
          description: error.message || 'Failed to start registration. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Create Your Account</CardTitle>
          <CardDescription className="text-base">
            Join MeasurePRO to access professional survey and measurement tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Full Name */}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Full Name *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          placeholder="John Doe"
                          className="pl-10"
                          data-testid="input-fullName"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Email Address *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="john@example.com"
                          className="pl-10"
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      We'll send a verification code to this email
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company */}
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Company (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          placeholder="Acme Corp"
                          className="pl-10"
                          data-testid="input-company"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Job Title (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          placeholder="Survey Engineer"
                          className="pl-10"
                          data-testid="input-title"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          type="tel"
                          placeholder="+1.438.533.5344"
                          className="pl-10"
                          data-testid="input-phone"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Address (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          placeholder="123 Main St, City, State"
                          className="pl-10"
                          data-testid="input-address"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Referred By */}
              <FormField
                control={form.control}
                name="referredBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Referred By (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          placeholder="Name of person who referred you"
                          className="pl-10"
                          data-testid="input-referredBy"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending Verification Code...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-5 w-5" />
                    Send Verification Code
                  </>
                )}
              </Button>

              <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  data-testid="link-login"
                >
                  Sign in
                </button>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
