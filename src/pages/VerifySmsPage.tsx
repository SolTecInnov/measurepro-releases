import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Phone, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card.tsx';
import { apiRequest } from '@/lib/queryClient';

export default function VerifySmsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [accountId, setAccountId] = useState('');
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    const storedPhone = localStorage.getItem('registration_phone');
    const storedAccountId = localStorage.getItem('registration_accountId');

    if (!storedAccountId) {
      toast.error('Session expired');
      navigate('/register');
      return;
    }

    setPhone(storedPhone || '');
    setAccountId(storedAccountId);

    // Auto-send SMS on mount
    sendSms(storedAccountId);
  }, []);

  const sendSms = async (id: string) => {
    setIsSending(true);
    try {
      const resp = await apiRequest<{ devMode?: boolean }>('/api/registration/send-sms', {
        method: 'POST',
        body: JSON.stringify({ accountId: id }),
      });
      setDevMode(resp.devMode || false);
    } catch (error: any) {
      toast.error('Failed to send SMS', {
        description: error.message || 'Please try resending.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (!accountId || code.length !== 6) return;
    setIsLoading(true);
    try {
      await apiRequest('/api/registration/verify-sms', {
        method: 'POST',
        body: JSON.stringify({ accountId, code }),
      });
      /* toast removed */
      navigate('/set-password');
    } catch (error: any) {
      toast.error('Verification failed', {
        description: error.message || 'Invalid or expired code. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!accountId) return;
    setIsResending(true);
    try {
      const resp = await apiRequest<{ devMode?: boolean }>('/api/registration/send-sms', {
        method: 'POST',
        body: JSON.stringify({ accountId }),
      });
      setDevMode(resp.devMode || false);
      setCode('');
      /* toast removed */
    } catch (error: any) {
      toast.error('Failed to resend SMS', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg">
              <Phone className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold" data-testid="text-sms-verify-title">Verify Your Phone</CardTitle>
          <CardDescription className="text-base">
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending SMS to {phone || 'your phone'}...
              </span>
            ) : (
              <>We sent a 6-digit code via SMS to <strong>{phone || 'your phone number'}</strong></>
            )}
          </CardDescription>
          {devMode && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 mt-2">
              Dev mode active — SMS not sent. Check the server console for the code.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">SMS Verification Code</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl font-mono tracking-widest"
              autoFocus
              data-testid="input-sms-code"
              onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) handleVerify(); }}
            />
          </div>

          <Button
            onClick={handleVerify}
            className="w-full h-12 text-base"
            disabled={isLoading || isSending || code.length !== 6}
            data-testid="button-verify-sms"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verifying...</>
            ) : (
              <><CheckCircle className="mr-2 h-5 w-5" />Verify Phone</>
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <div className="text-sm text-center text-slate-600 dark:text-slate-400">
            Didn't receive the SMS?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || isSending}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50 inline-flex items-center gap-1"
              data-testid="button-resend-sms"
            >
              {isResending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Resend
            </button>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate('/verify')}
            className="w-full"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Email Verification
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
