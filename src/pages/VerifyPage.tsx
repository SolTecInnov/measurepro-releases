import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card.tsx';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx';
import { registrationVerifySchema, RegistrationVerify } from '../../shared/schema';
import { apiRequest } from '@/lib/queryClient';

export default function VerifyPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');

  const form = useForm<RegistrationVerify>({
    resolver: zodResolver(registrationVerifySchema),
    defaultValues: {
      email: '',
      code: '',
    },
  });

  useEffect(() => {
    // Get email from localStorage (set during registration)
    const storedEmail = localStorage.getItem('registration_email');
    if (storedEmail) {
      setEmail(storedEmail);
      form.setValue('email', storedEmail);
    } else {
      // If no email found, redirect to registration
      toast.error('No registration email found');
      navigate('/register');
    }
  }, [navigate, form]);

  const onSubmit = async (data: RegistrationVerify) => {
    setIsLoading(true);

    try {
      const response = await apiRequest<{ accountId: string; message: string }>('/api/registration/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      /* toast removed */

      // Store accountId for subsequent pages
      localStorage.setItem('registration_accountId', response.accountId);

      // Navigate to SMS verification (next step before password creation)
      navigate('/verify-sms');
    } catch (error: any) {
      toast.error('Verification failed', {
        description: error.message || 'Invalid or expired verification code.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);

    try {
      // Call the dedicated resend endpoint with only email
      await apiRequest('/api/registration/resend', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      /* toast removed */
    } catch (error: any) {
      toast.error('Failed to resend code', {
        description: error.message || 'Please try again later.',
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
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center shadow-lg">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Verify Your Email</CardTitle>
          <CardDescription className="text-base">
            We sent a 6-digit code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Hidden Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input {...field} type="hidden" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Verification Code */}
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="123456"
                        maxLength={6}
                        className="text-center text-2xl font-mono tracking-widest"
                        autoFocus
                        data-testid="input-code"
                        onChange={(e) => {
                          // Only allow digits
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the 6-digit code from your email
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading}
                data-testid="button-verify"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Verify Email
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <div className="text-sm text-center text-slate-600 dark:text-slate-400">
            Didn't receive the code?{' '}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              data-testid="button-resend"
            >
              Resend
            </button>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate('/register')}
            className="w-full"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Registration
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
