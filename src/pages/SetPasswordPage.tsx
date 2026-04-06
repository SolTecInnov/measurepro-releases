import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Loader2, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
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
import { createUser } from '@/lib/firebase';
import { apiRequest } from '@/lib/queryClient';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type PasswordForm = z.infer<typeof passwordSchema>;

function getPasswordStrength(password: string): { score: number; label: 'weak' | 'medium' | 'strong' } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const label = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';
  return { score, label };
}

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Get email and accountId from localStorage
    const storedEmail = localStorage.getItem('registration_email');
    const storedAccountId = localStorage.getItem('registration_accountId');

    if (!storedEmail || !storedAccountId) {
      toast.error('Registration data not found');
      navigate('/register');
      return;
    }

    setEmail(storedEmail);
    setAccountId(storedAccountId);
  }, [navigate]);

  const onSubmit = async (data: PasswordForm) => {
    setIsLoading(true);

    try {
      // Create Firebase Auth user with email and password
      const user = await createUser(email, data.password);

      // Link the auth UID to the account in Firebase
      await apiRequest('/api/registration/finalize', {
        method: 'POST',
        body: JSON.stringify({
          accountId,
          authUid: user.uid,
        }),
      });

      toast.success('Account created successfully!', {
        description: 'Your account is pending admin approval.',
      });

      // Clear registration data from localStorage
      localStorage.removeItem('registration_email');
      localStorage.removeItem('registration_accountId');

      // Navigate to awaiting approval page
      navigate('/awaiting-approval');
    } catch (error: any) {
      let errorMessage = 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      }

      toast.error('Account creation failed', {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 flex items-center justify-center shadow-lg">
              <Lock className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Create Password</CardTitle>
          <CardDescription className="text-base">
            Choose a strong password for <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    {field.value && (() => {
                      const strength = getPasswordStrength(field.value);
                      const checks = [
                        { label: 'At least 8 characters', met: field.value.length >= 8 },
                        { label: 'Uppercase letter', met: /[A-Z]/.test(field.value) },
                        { label: 'Lowercase letter', met: /[a-z]/.test(field.value) },
                        { label: 'Number', met: /\d/.test(field.value) },
                        { label: 'Special character', met: /[^a-zA-Z0-9]/.test(field.value) },
                      ];
                      return (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-1">
                            <div className={`h-1 flex-1 rounded-full ${strength.score >= 1 ? (strength.label === 'strong' ? 'bg-green-500' : strength.label === 'medium' ? 'bg-yellow-500' : 'bg-red-500') : 'bg-slate-200 dark:bg-slate-700'}`} />
                            <div className={`h-1 flex-1 rounded-full ${strength.score >= 3 ? (strength.label === 'strong' ? 'bg-green-500' : 'bg-yellow-500') : 'bg-slate-200 dark:bg-slate-700'}`} />
                            <div className={`h-1 flex-1 rounded-full ${strength.label === 'strong' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                          </div>
                          <p className={`text-xs font-medium ${strength.label === 'weak' ? 'text-red-500' : strength.label === 'medium' ? 'text-yellow-500' : 'text-green-500'}`} data-testid="text-password-strength">
                            Password strength: {strength.label}
                          </p>
                          <div className="grid grid-cols-1 gap-1">
                            {checks.map((c) => (
                              <div key={c.label} className="flex items-center gap-1.5">
                                {c.met ? <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" /> : <XCircle className="h-3 w-3 text-slate-400 dark:text-slate-600 flex-shrink-0" />}
                                <span className={`text-xs ${c.met ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>{c.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirm Password */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          {...field}
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          data-testid="input-confirmPassword"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          data-testid="button-toggle-confirmPassword"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
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
                data-testid="button-create-account"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    Create Account
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
