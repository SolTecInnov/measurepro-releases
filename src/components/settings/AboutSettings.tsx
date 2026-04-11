import { useState, useEffect } from 'react';
import { ExternalLink, Info, Calendar, Code, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { UpdateChecker } from '@/components/AutoUpdater';
import { APP_VERSION, BUILD_DATE, APP_NAME, COMPANY_NAME, COMPANY_URL, SUPPORT_EMAIL } from '@/lib/version';
import { getCurrentUser } from '@/lib/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthContext';

const AboutSettings = () => {
  const { clearPasswordChange } = useAuth();

  // Change password form state
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [pwError, setPwError] = useState('');

  // Pending offline change — stored as a flag only (no credentials stored, for security)
  const [pendingOfflineChange, setPendingOfflineChange] = useState<boolean>(() => {
    return !!sessionStorage.getItem('pending_pw_change_flag');
  });

  // When connectivity is restored, notify the user to re-submit (no auto-flush of stored credentials)
  useEffect(() => {
    const handleOnline = () => {
      if (sessionStorage.getItem('pending_pw_change_flag')) {
        setShowChangePw(true);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }

    const firebaseUser = getCurrentUser();
    if (!firebaseUser || !firebaseUser.email) {
      setPwError('Not authenticated. Please log out and log back in.');
      return;
    }

    // Offline: record intent only (no credentials stored) — remind user to retry when online
    if (!navigator.onLine) {
      sessionStorage.setItem('pending_pw_change_flag', '1');
      setPendingOfflineChange(true);
      setShowChangePw(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      return;
    }

    setIsChanging(true);
    try {
      // Re-authenticate before changing password
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPw);
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update the password
      await updatePassword(firebaseUser, newPw);

      // Clear any forced-change flag on server
      try {
        const idToken = await firebaseUser.getIdToken();
        await apiRequest('/api/auth/clear-password-change-flag', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch {
        // Non-fatal
      }

      // Clear local cache flag
      await clearPasswordChange();

      // Clear pending offline intent flag on successful change
      if (sessionStorage.getItem('pending_pw_change_flag')) {
        sessionStorage.removeItem('pending_pw_change_flag');
        setPendingOfflineChange(false);
      }

      setShowChangePw(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.');
      } else if (err.code === 'auth/too-many-requests') {
        setPwError('Too many attempts. Please try again later.');
      } else if (err.code === 'auth/requires-recent-login') {
        setPwError('Session expired. Please log out and log back in, then try again.');
      } else if (err.code === 'auth/network-request-failed') {
        // Connectivity dropped — record intent flag only, no credentials stored
        sessionStorage.setItem('pending_pw_change_flag', '1');
        setPendingOfflineChange(true);
        setShowChangePw(false);
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        setPwError(err.message || 'Failed to change password. Please try again.');
      }
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Info className="w-6 h-6 text-blue-400" />
        About {APP_NAME}
      </h2>

      <div className="space-y-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-center mb-4">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white">{APP_NAME}</h3>
              <p className="text-gray-400">Professional Measurement & Surveying</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Code className="w-4 h-4" />
                Version
              </div>
              <div className="text-lg font-semibold text-white" data-testid="text-version">
                {APP_VERSION}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Build Date
              </div>
              <div className="text-lg font-semibold text-white" data-testid="text-build-date">
                {BUILD_DATE}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <UpdateChecker />
          </div>
        </div>

        {/* ============================================================ */}
        {/* CHANGE PASSWORD SECTION                                        */}
        {/* ============================================================ */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Change Password
            </h3>
            <button
              onClick={() => { setShowChangePw(v => !v); setPwError(''); }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              data-testid="button-toggle-change-password"
            >
              {showChangePw ? 'Cancel' : 'Change'}
            </button>
          </div>

          {pendingOfflineChange && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-900/40 border border-amber-600/50 p-3">
              <span className="text-amber-400 text-sm">
                Password change pending — you must be online to complete it. Reconnect and return to this screen.
              </span>
              <button
                onClick={() => { sessionStorage.removeItem('pending_pw_change_flag'); setPendingOfflineChange(false); }}
                className="ml-auto text-xs text-amber-400 underline whitespace-nowrap"
                data-testid="button-cancel-queued-pw-change"
              >
                Cancel
              </button>
            </div>
          )}

          {!showChangePw ? (
            <p className="text-gray-400 text-sm">
              Update your account password. You'll need to verify your current password first.
            </p>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3 mt-2">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pr-10 pl-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isChanging}
                    data-testid="input-current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pr-10 pl-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isChanging}
                    data-testid="input-settings-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isChanging}
                  data-testid="input-settings-confirm-password"
                />
              </div>

              {pwError && (
                <p className="text-red-400 text-sm" data-testid="text-pw-change-error">{pwError}</p>
              )}

              <button
                type="submit"
                disabled={isChanging || !currentPw || !newPw || !confirmPw}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                data-testid="button-submit-change-password"
              >
                {isChanging ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Updating...</>
                ) : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Developed By</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-lg">{COMPANY_NAME}</p>
              <p className="text-gray-400 text-sm">Innovative Solutions for Field Professionals</p>
            </div>
            <a
              href={COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              data-testid="link-soltec-website"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Website
            </a>
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Support</h3>
          <p className="text-gray-400 text-sm mb-3">
            For technical support, feature requests, or inquiries, please contact us:
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-blue-400 hover:text-blue-300 underline"
            data-testid="link-support-email"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>

        <div className="text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default AboutSettings;
