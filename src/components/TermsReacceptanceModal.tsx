import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/firebase';
import { TermsVersion } from '../../shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';
import { isMasterAdmin } from '@/lib/auth/masterAdmin';
import { useAuth } from '@/lib/auth/AuthContext';

interface TermsReacceptanceModalProps {
  latestVersion: TermsVersion | null;
  onAccepted: () => void;
}

export default function TermsReacceptanceModal({
  latestVersion,
  onAccepted,
}: TermsReacceptanceModalProps) {
  const [hasRead, setHasRead] = useState(false);
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin } = useAuth();
  
  // Master admin bypasses terms reacceptance
  // Check cached master admin flag FIRST (works offline)
  if (cachedIsMasterAdmin) {
    return null;
  }

  const firebaseUser = getCurrentUser();
  if (!firebaseUser) {
    // In offline mode, fall back to cached user
    if (authContextUser?.email && isMasterAdmin(authContextUser.email)) {
      return null;
    }
    // If no user at all, nothing to show
    if (!authContextUser) return null;
  }

  // Check Firebase user (online mode)
  if (firebaseUser?.email && isMasterAdmin(firebaseUser.email)) {
    return null;
  }

  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      if (!latestVersion) throw new Error('No terms version available');

      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const idToken = await user.getIdToken();

      let ipAddress = 'unknown';
      let geolocation = 'unknown';
      
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;

        const geoResponse = await fetch(`https://ipapi.co/${ipAddress}/json/`);
        const geoData = await geoResponse.json();
        geolocation = `${geoData.city || 'Unknown'}, ${geoData.region || 'Unknown'}, ${geoData.country_name || 'Unknown'}`;
      } catch (error) {
      }

      return apiRequest('/api/terms/accept', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          termsVersionId: latestVersion.id,
          ipAddress,
          geolocation,
          userAgent: navigator.userAgent,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Terms accepted', {
        description: 'You have accepted the updated terms and conditions.',
      });
      onAccepted();
    },
    onError: (error: any) => {
      toast.error('Acceptance failed', {
        description: error.message || 'Failed to accept terms. Please try again.',
      });
    },
  });

  if (!latestVersion) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-3xl max-h-[80vh] overflow-y-auto"
        data-testid="dialog-terms-reacceptance"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2" data-testid="heading-terms-modal">
            <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Updated Terms & Conditions
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400" data-testid="text-terms-description">
            We've updated our terms and conditions. Please review and accept to continue using MeasurePRO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4" data-testid="card-version-info">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100" data-testid="text-version-title">
                  {latestVersion.title}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1" data-testid="text-version-details">
                  Version {latestVersion.version} • Effective{' '}
                  {new Date(latestVersion.effectiveDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-h-96 overflow-y-auto" data-testid="container-terms-content">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap" data-testid="text-terms-content">
                {latestVersion.content}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="card-acceptance-required">
            <input
              type="checkbox"
              id="terms-read"
              checked={hasRead}
              onChange={(e) => setHasRead(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              data-testid="checkbox-terms-read"
            />
            <label
              htmlFor="terms-read"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
              data-testid="label-terms-read"
            >
              I have read and understood the updated Terms & Conditions and agree to be bound by them. I understand
              that my acceptance will be logged with my IP address and timestamp for legal compliance purposes.
            </label>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400" data-testid="text-legal-notice">
            <p>🔒 Your acceptance will be securely logged with IP address and timestamp</p>
          </div>
          <Button
            onClick={() => acceptTermsMutation.mutate()}
            disabled={!hasRead || acceptTermsMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50"
            data-testid="button-accept-terms"
          >
            {acceptTermsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept Terms & Continue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
