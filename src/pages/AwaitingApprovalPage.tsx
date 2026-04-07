import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { getCurrentUser, listenToAccountStatus, signOutUser } from '@/lib/firebase';
import { Account } from '../../shared/schema';
import { toast } from 'sonner';

export default function AwaitingApprovalPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();

    if (!user) {
      // If not authenticated, redirect to login
      navigate('/login');
      return;
    }

    // Listen to account status changes
    const unsubscribe = listenToAccountStatus(user.uid, (updatedAccount) => {
      setIsLoading(false);

      if (!updatedAccount) {
        return;
      }

      setAccount(updatedAccount);

      // If account is approved, navigate to home
      if (updatedAccount.status === 'approved') {
        /* toast removed */
        navigate('/');
      }

      // If account is rejected, show message and sign out
      if (updatedAccount.status === 'rejected') {
        toast.error('Account rejected', {
          description: 'Your account application was not approved. Please contact support for more information.',
        });
        signOutUser();
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await signOutUser();
    navigate('/login');
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />;
    }

    if (!account) {
      return <XCircle className="h-16 w-16 text-red-500" />;
    }

    switch (account.status) {
      case 'pending':
        return <Clock className="h-16 w-16 text-yellow-500" />;
      case 'approved':
        return <CheckCircle2 className="h-16 w-16 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-16 w-16 text-red-500" />;
      default:
        return <Clock className="h-16 w-16 text-blue-500" />;
    }
  };

  const getStatusMessage = () => {
    if (isLoading) {
      return {
        title: 'Loading...',
        description: 'Checking your account status...',
      };
    }

    if (!account) {
      return {
        title: 'Account Not Found',
        description: 'We could not find your account. Please contact support.',
      };
    }

    switch (account.status) {
      case 'pending':
        return {
          title: 'Account Pending Approval',
          description: 'Your account is currently under review by our admin team. You will receive an email notification once your account is approved.',
        };
      case 'email_pending':
        return {
          title: 'Email Verification Pending',
          description: 'Please verify your email address to continue with the registration process.',
        };
      case 'approved':
        return {
          title: 'Account Approved!',
          description: 'Your account has been approved. Redirecting you to the app...',
        };
      case 'rejected':
        return {
          title: 'Account Rejected',
          description: 'Unfortunately, your account application was not approved. Please contact support for more information.',
        };
      default:
        return {
          title: 'Unknown Status',
          description: 'Your account status is unclear. Please contact support.',
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-lg">
              {getStatusIcon()}
            </div>
          </div>
          <CardTitle className="text-3xl font-bold" data-testid="text-title">
            {statusMessage.title}
          </CardTitle>
          <CardDescription className="text-base" data-testid="text-description">
            {statusMessage.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {account && account.status === 'pending' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    What happens next?
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Our admin team will review your application</li>
                    <li>You'll receive an email notification when approved</li>
                    <li>This page will automatically update when your status changes</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {account && (
            <div className="border-t pt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Email:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100" data-testid="text-email">
                  {account.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Full Name:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100" data-testid="text-fullName">
                  {account.fullName}
                </span>
              </div>
              {account.company && (
                <div className="flex justify-between">
                  <span>Company:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100" data-testid="text-company">
                    {account.company}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Status:</span>
                <span 
                  className={`font-medium px-2 py-1 rounded-full text-xs uppercase ${
                    account.status === 'approved' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : account.status === 'rejected'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                  data-testid="text-status"
                >
                  {account.status}
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col space-y-3">
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full"
              data-testid="button-signout"
            >
              Sign Out
            </Button>
            
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              Need help? Contact us at{' '}
              <a href="mailto:admin@soltec.ca" className="text-blue-600 dark:text-blue-400 hover:underline">
                admin@soltec.ca
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
