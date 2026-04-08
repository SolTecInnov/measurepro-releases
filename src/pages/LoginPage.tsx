import { useState } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, Mail, Eye, EyeOff, Zap, ArrowLeft, WifiOff, Wifi, Info, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';

declare const __BUILD_TIME__: number;
const CLIENT_BUILD_TIME: number =
  typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 0;

async function checkVersionAndReloadIfStale(intendedPath: string): Promise<boolean> {
  if (CLIENT_BUILD_TIME === 0) return false;
  try {
    const resp = await fetch(`${API_BASE_URL}/api/version`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { version: string };
    const serverBuildTime = parseInt(data.version, 10);
    if (!isNaN(serverBuildTime) && serverBuildTime !== 0 && serverBuildTime !== CLIENT_BUILD_TIME) {
      console.log('[LOGIN] Version mismatch — reloading to pick up new build before navigating');
      sessionStorage.setItem('post_login_redirect', intendedPath);
      window.location.reload();
      return true;
    }
  } catch {
  }
  return false;
}

type AuthTab = 'signin' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isOnline } = useAuth();
  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tab === 'signup') {
      navigate('/signup', { replace: false });
      return;
    }

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const success = await login(email, password);
      
      if (success) {
        localStorage.setItem('app_access', 'true');

        const reloading = await checkVersionAndReloadIfStale('/');
        if (reloading) return;
        
        if (isOnline) {
          /* toast removed */
        }
        
        const postLoginRedirect = sessionStorage.getItem('post_login_redirect');
        if (postLoginRedirect) {
          sessionStorage.removeItem('post_login_redirect');
          navigate(postLoginRedirect, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Incorrect password');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please try again later.');
      } else {
        toast.error('Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Network Status Indicator */}
        {!isOnline && (
          <div 
            className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-center gap-3"
            data-testid="banner-offline-mode"
          >
            <WifiOff className="w-5 h-5 text-orange-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-300">Offline Mode</p>
              <p className="text-xs text-orange-400/80">Login with previously used credentials</p>
            </div>
          </div>
        )}

        {isOnline && (
          <div 
            className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3"
            data-testid="banner-online-mode"
          >
            <Wifi className="w-5 h-5 text-green-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-300">Online</p>
              <p className="text-xs text-green-400/80">Full authentication available</p>
            </div>
          </div>
        )}

        {/* Offline Requirements Info */}
        <div
          className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3"
          data-testid="banner-offline-info"
        >
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-300 leading-relaxed">
            Internet is required for your first login. After that, the app works fully offline.
            Reconnect every 14–16 days to keep your session valid.
            Switching accounts requires an internet connection.
          </p>
        </div>

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">MeasurePRO</h1>
          <p className="text-gray-400">
            {isOnline 
              ? 'Sign in or create your account' 
              : 'Sign in with cached credentials'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex mb-6 bg-gray-800 rounded-xl p-1 border border-gray-700" data-testid="tab-auth">
          <button
            type="button"
            onClick={() => setTab('signin')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === 'signin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            data-testid="tab-signin"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === 'signup'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            data-testid="tab-signup"
          >
            Sign Up
          </button>
        </div>

        {/* Sign In Form */}
        {tab === 'signin' && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={isLoading}
                    data-testid="input-email"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-11 pr-12 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={isLoading}
                    data-testid="input-password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                data-testid="button-sign-in"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Offline switch-account notice */}
            {!isOnline && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg" data-testid="banner-offline-switch-account">
                <p className="text-xs text-amber-300 text-center">
                  You're offline. Switching to a different account requires an internet connection.
                </p>
              </div>
            )}

            {/* Back to Welcome Link */}
            <div className="mt-6 text-center pt-6 border-t border-gray-700">
              <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                data-testid="link-back-welcome"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Welcome
              </Link>
            </div>
          </div>
        )}

        {/* Sign Up Panel */}
        {tab === 'signup' && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Create Your Account</h2>
            <p className="text-gray-400 text-sm mb-6">
              Join MeasurePRO to start conducting professional road surveys with precision LiDAR technology.
            </p>
            {!isOnline && (
              <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg" data-testid="banner-signup-offline">
                <p className="text-xs text-orange-300">
                  An internet connection is required to create a new account.
                </p>
              </div>
            )}
            <Link
              to="/signup"
              className={`w-full inline-block py-3 rounded-lg font-semibold text-white transition-all ${
                isOnline
                  ? 'bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 shadow-lg'
                  : 'bg-gray-600 cursor-not-allowed pointer-events-none'
              }`}
              data-testid="button-go-signup"
            >
              Continue to Sign Up
            </Link>
            <div className="mt-6 pt-6 border-t border-gray-700">
              <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                data-testid="link-back-welcome-signup"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Welcome
              </Link>
            </div>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500" data-testid="text-security-note">
            {isOnline 
              ? 'Your credentials are secured with Firebase Authentication' 
              : 'Offline authentication uses locally cached credentials'}
          </p>
        </div>
      </div>
    </div>
  );
}
