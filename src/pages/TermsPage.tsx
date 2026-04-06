import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, FileCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TermsVersion } from '../../shared/schema';
import { useAuth } from '@/lib/auth/AuthContext';
import { getCurrentUser } from '@/lib/firebase';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
  const { user } = useAuth();

  // Fetch latest terms from API
  const { data: terms, isLoading, error } = useQuery<TermsVersion>({
    queryKey: ['/api/terms/latest'],
  });

  // Check if user has accepted the latest terms
  const { data: acceptanceData } = useQuery({
    queryKey: ['/api/terms/check-acceptance'],
    enabled: !!user,
  });

  const hasAccepted = acceptanceData?.hasAccepted ?? true;

  // Accept terms mutation
  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');
      
      const idToken = await currentUser.getIdToken();
      
      // Get IP and geolocation (same as TermsReacceptanceModal)
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
        headers: { Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          termsVersionId: terms!.id,
          ipAddress,
          geolocation,
          userAgent: navigator.userAgent,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Terms accepted');
      queryClient.invalidateQueries({ queryKey: ['/api/terms/check-acceptance'] });
    },
    onError: (error: any) => {
      toast.error('Failed to accept terms', {
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400" data-testid="text-loading">Loading terms and conditions...</p>
        </div>
      </div>
    );
  }

  if (error || !terms) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4" data-testid="text-error">Failed to load terms and conditions</p>
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 underline"
            data-testid="link-back-to-home"
          >
            Return to home page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
                data-testid="link-back"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/features"
                className="text-gray-300 hover:text-white transition-colors"
                data-testid="link-features"
              >
                Features
              </Link>
              <Link
                to="/pricing"
                className="text-gray-300 hover:text-white transition-colors"
                data-testid="link-pricing"
              >
                Pricing
              </Link>
              <Link
                to="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                data-testid="button-signup"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileCheck className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-page-title">{terms.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-gray-400">
            <p className="text-lg" data-testid="text-version">
              Version {terms.version}
            </p>
            <span>•</span>
            <p className="text-lg" data-testid="text-effective-date">
              Effective Date: {new Date(terms.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Terms Content */}
        <div 
          className="bg-gray-800 border border-gray-700 rounded-lg p-8 prose prose-invert prose-lg max-w-none
                     [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mb-4
                     [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mb-2
                     [&_p]:text-gray-300 [&_p]:leading-relaxed [&_p]:mb-4
                     [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:ml-4 [&_ul]:text-gray-300
                     [&_li]:text-gray-300
                     [&_a]:text-blue-400 [&_a]:hover:text-blue-300 [&_a]:underline
                     [&_strong]:text-white [&_strong]:font-semibold"
          data-testid="section-terms-content"
          dangerouslySetInnerHTML={{ __html: terms.content }}
        />

        {/* Accept Button - For authenticated users who haven't accepted */}
        {user && !hasAccepted && terms && (
          <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid="section-accept-terms">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Accept Terms & Conditions
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              By clicking accept, you agree to be bound by these terms. Your acceptance will be logged with your IP address and timestamp for legal compliance.
            </p>
            <Button
              onClick={() => acceptTermsMutation.mutate()}
              disabled={acceptTermsMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-accept-terms-page"
            >
              {acceptTermsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept Terms & Conditions
                </>
              )}
            </Button>
          </div>
        )}

        {/* Acceptance Status Badge - For authenticated users who have accepted */}
        {user && hasAccepted && (
          <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg" data-testid="section-accepted-badge">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                You have accepted these terms and conditions.
              </p>
            </div>
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Questions About These Terms?</h3>
          <p className="text-blue-300 mb-4">
            If you have any questions or concerns about these Terms and Conditions, please contact us:
          </p>
          <div className="text-blue-300">
            <p><strong>SolTecInnovation</strong></p>
            <p>
              Email: <a href="mailto:info@soltecinnovation.com" className="text-blue-400 hover:text-blue-300 underline" data-testid="link-email">
                info@soltecinnovation.com
              </a>
            </p>
            <p>
              Website: <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline" data-testid="link-company">
                soltecinnovation.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-product">Product</h3>
              <div className="space-y-2">
                <Link to="/features" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-features">
                  Features
                </Link>
                <Link to="/pricing" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-pricing">
                  Pricing
                </Link>
                <Link to="/help" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-help">
                  Documentation
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-company">Company</h3>
              <div className="space-y-2">
                <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-company">
                  SolTecInnovation
                </a>
                <Link to="/contact" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-contact">
                  Contact Us
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-legal">Legal</h3>
              <div className="space-y-2">
                <Link to="/terms" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-terms">
                  Terms & Conditions
                </Link>
                <Link to="/privacy" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-privacy">
                  Privacy Policy
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-support">Support</h3>
              <div className="space-y-2">
                <Link to="/help" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-documentation">
                  Documentation
                </Link>
                <a href="mailto:info@soltecinnovation.com" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-email">
                  Email Support
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p data-testid="text-footer-copyright">
              © 2025 SolTecInnovation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
