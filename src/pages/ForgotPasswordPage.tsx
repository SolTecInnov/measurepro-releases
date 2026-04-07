import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, Phone, ArrowLeft, Zap, CheckCircle, WifiOff, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react';

type Step = 'contact' | 'verify' | 'password';
type ContactMethod = 'email' | 'phone';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('contact');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');
  const [contactValue, setContactValue] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const isOffline = !navigator.onLine;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactValue.trim()) {
      toast.error(`Please enter your ${contactMethod === 'email' ? 'email address' : 'phone number'}`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: contactMethod, value: contactValue.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        /* toast removed */
        setStep('verify');
      } else {
        toast.error(data.error || 'Failed to send verification code. Please try again.');
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: contactMethod, value: contactValue.trim(), code: otpCode }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        /* toast removed */
        setStep('password');
      } else {
        toast.error(data.error || 'Invalid or expired code. Please try again.');
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: contactMethod,
          value: contactValue.trim(),
          code: otpCode,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        /* toast removed */
        setDone(true);
      } else {
        toast.error(data.error || 'Failed to update password. Please start over.');
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const stepNum = step === 'contact' ? 1 : step === 'verify' ? 2 : 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          {!done && (
            <p className="text-gray-400">
              Step {stepNum} of 3
            </p>
          )}
        </div>

        {/* Step progress */}
        {!done && (
          <div className="flex items-center gap-2 mb-6" data-testid="step-progress">
            {(['contact', 'verify', 'password'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : stepNum > i + 1
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {stepNum > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                {i < 2 && <div className={`flex-1 h-0.5 mx-1 ${stepNum > i + 1 ? 'bg-green-500' : 'bg-gray-700'}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8">
          {/* Success state */}
          {done ? (
            <div className="text-center" data-testid="section-success">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Password Updated!</h2>
              <p className="text-gray-400 mb-6">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="w-full inline-block py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg text-center transition-all"
                data-testid="link-go-login"
              >
                Sign In
              </Link>
            </div>
          ) : isOffline && step === 'contact' ? (
            /* Offline state — can't send OTP */
            <div className="text-center" data-testid="section-offline-reset">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500/20 rounded-full mb-4">
                <WifiOff className="w-10 h-10 text-orange-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">You're Offline</h2>
              <p className="text-gray-400 mb-4">
                Password reset requires an internet connection.
              </p>
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-300 font-medium mb-1">Options:</p>
                <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                  <li>Connect to the internet and reload this page to reset your password.</li>
                  <li>Contact your administrator — they can set a temporary password for you.</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 mb-4" data-testid="text-offline-contact-admin">
                Ask your admin to reset your password from the Admin panel.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                data-testid="button-reload-page"
              >
                Reload When Online
              </button>
            </div>
          ) : step === 'contact' ? (
            /* Step 1: Choose method & enter contact */
            <form onSubmit={handleSendOtp} className="space-y-6" data-testid="form-contact">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">How would you like to verify?</h2>
                <p className="text-gray-400 text-sm mb-4">
                  We'll send you a 6-digit code to verify your identity.
                </p>

                {/* Offline warning */}
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    This step requires an internet connection. Make sure you're online before proceeding.
                  </p>
                </div>

                {/* Method toggle */}
                <div className="flex bg-gray-900 rounded-lg p-1 mb-4 border border-gray-700" data-testid="toggle-contact-method">
                  <button
                    type="button"
                    onClick={() => setContactMethod('email')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-all ${
                      contactMethod === 'email'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                    data-testid="button-method-email"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMethod('phone')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-all ${
                      contactMethod === 'phone'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                    data-testid="button-method-phone"
                  >
                    <Phone className="w-4 h-4" />
                    SMS
                  </button>
                </div>

                {/* Contact input */}
                <div className="relative">
                  {contactMethod === 'email' ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  )}
                  <input
                    type={contactMethod === 'email' ? 'email' : 'tel'}
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    placeholder={contactMethod === 'email' ? 'your.email@example.com' : '+1 (555) 000-0000'}
                    className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={isLoading}
                    data-testid="input-contact"
                    autoComplete={contactMethod === 'email' ? 'email' : 'tel'}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                data-testid="button-send-otp"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>
          ) : step === 'verify' ? (
            /* Step 2: Enter OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-6" data-testid="form-verify">
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full mb-4">
                  <ShieldCheck className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1">Enter Verification Code</h2>
                <p className="text-gray-400 text-sm mb-4">
                  We sent a 6-digit code to <span className="text-blue-400 font-medium">{contactValue}</span>.
                  The code expires in 10 minutes. Check your spam folder if you don't see it.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full text-center text-3xl tracking-[0.5em] py-4 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                  disabled={isLoading}
                  data-testid="input-otp"
                  autoComplete="one-time-code"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                data-testid="button-verify-otp"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('contact')}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                data-testid="button-back-to-contact"
                disabled={isLoading}
              >
                Didn't receive a code? Go back
              </button>
            </form>
          ) : (
            /* Step 3: Set new password */
            <form onSubmit={handleUpdatePassword} className="space-y-6" data-testid="form-new-password">
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-full mb-4">
                  <KeyRound className="w-7 h-7 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1">Set New Password</h2>
                <p className="text-gray-400 text-sm mb-4">
                  Create a strong password for your account.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full pl-11 pr-12 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        disabled={isLoading}
                        data-testid="input-new-password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                        data-testid="button-toggle-new-password"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat your password"
                        className="w-full pl-11 pr-12 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        disabled={isLoading}
                        data-testid="input-confirm-password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                        data-testid="button-toggle-confirm-password"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                data-testid="button-update-password"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}

          {/* Back to Login Link */}
          {!done && (
            <div className="mt-6 text-center pt-6 border-t border-gray-700">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                data-testid="link-back-login"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500" data-testid="text-help-note">
            If you continue to have problems, please contact your administrator or support at support@measurepro.com
          </p>
        </div>
      </div>
    </div>
  );
}
