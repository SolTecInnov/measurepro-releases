import { useState } from 'react';
import { Key, Check, AlertCircle, Loader2 } from 'lucide-react';
import { activateLicenseCode } from '../../lib/licensing';
import { toast } from 'sonner';
import { getSafeAuth } from '../../lib/firebase';

interface LicenseActivationProps {
  onActivationSuccess?: () => void;
}

const LicenseActivation = ({ onActivationSuccess }: LicenseActivationProps) => {
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{
    success: boolean;
    message: string;
    licenseDetails?: any;
  } | null>(null);

  const auth = getSafeAuth();

  const handleActivate = async () => {
    if (!activationCode.trim()) {
      toast.error('Please enter an activation code');
      return;
    }

    if (!auth?.currentUser) {
      toast.error('You must be logged in to activate a license');
      return;
    }

    setIsActivating(true);
    setActivationResult(null);

    try {
      const result = await activateLicenseCode({
        code: activationCode.trim(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          hardwareConcurrency: (navigator as any).hardwareConcurrency,
          deviceMemory: (navigator as any).deviceMemory,
        },
      });
      
      if (result.success) {
        setActivationResult({
          success: true,
          message: 'License activated successfully!',
          licenseDetails: result.license,
        });
        // toast suppressed
        setActivationCode('');
        
        if (onActivationSuccess) {
          onActivationSuccess();
        }
      } else {
        setActivationResult({
          success: false,
          message: result.error || 'Activation failed',
        });
        toast.error(result.error || 'Activation failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to activate license';
      setActivationResult({
        success: false,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsActivating(false);
    }
  };

  const formatCode = (value: string) => {
    // Remove all non-alphanumeric characters
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Split into groups of 4
    const groups = clean.match(/.{1,4}/g) || [];
    
    // Join with hyphens, limit to 4 groups (16 characters total)
    return groups.slice(0, 4).join('-');
  };

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setActivationCode(formatted);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
          <Key className="w-5 h-5 text-purple-400" />
          Activate License
        </h3>
        <p className="text-sm text-gray-400">
          Enter your activation code to unlock premium features
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Activation Code
          </label>
          <input
            type="text"
            value={activationCode}
            onChange={handleCodeInput}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-center text-lg tracking-wider placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            maxLength={19}
            disabled={isActivating}
            data-testid="input-activation-code"
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: XXXX-XXXX-XXXX-XXXX (automatically formatted)
          </p>
        </div>

        <button
          onClick={handleActivate}
          disabled={!activationCode.trim() || isActivating || activationCode.length < 19}
          className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          data-testid="button-activate"
        >
          {isActivating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <Key className="w-5 h-5" />
              Activate License
            </>
          )}
        </button>

        {/* Activation Result */}
        {activationResult && (
          <div
            className={`p-4 rounded-lg border ${
              activationResult.success
                ? 'bg-green-900/20 border-green-700'
                : 'bg-red-900/20 border-red-700'
            }`}
          >
            <div className="flex items-start gap-3">
              {activationResult.success ? (
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    activationResult.success ? 'text-green-300' : 'text-red-300'
                  }`}
                >
                  {activationResult.message}
                </p>
                {activationResult.success && activationResult.licenseDetails && (
                  <div className="mt-2 space-y-1 text-sm text-gray-400">
                    <p>
                      License Type:{' '}
                      <span className="text-white">
                        {activationResult.licenseDetails.licenseType === 'package'
                          ? 'Feature Package'
                          : 'Single Feature'}
                      </span>
                    </p>
                    {activationResult.licenseDetails.expiresAt && (
                      <p>
                        Expires:{' '}
                        <span className="text-white">
                          {new Date(activationResult.licenseDetails.expiresAt).toLocaleDateString()}
                        </span>
                      </p>
                    )}
                    {!activationResult.licenseDetails.expiresAt && (
                      <p className="text-green-400">Lifetime License</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-300 mb-2">Where to get activation codes?</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Contact your administrator or sales team</li>
            <li>• Check your purchase confirmation email</li>
            <li>• Visit your account dashboard on our website</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LicenseActivation;
