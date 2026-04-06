import { useState } from 'react';
import { KeyRound, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { updatePassword } from 'firebase/auth';
import { getCurrentUser } from '../lib/firebase';
import { toast } from 'sonner';
import { apiRequest } from '../lib/queryClient';

interface ForcePasswordChangeProps {
  onComplete: () => void;
}

export function ForcePasswordChange({ onComplete }: ForcePasswordChangeProps) {
  const { requiresPasswordChange, logout, cachedUserData, clearPasswordChange } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState('');

  if (!requiresPasswordChange) return null;

  const userEmail = cachedUserData?.email || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsChanging(true);
    try {
      const firebaseUser = getCurrentUser();
      if (!firebaseUser) throw new Error('Not authenticated — please log in again.');

      // Update the password in Firebase Auth
      await updatePassword(firebaseUser, newPassword);

      // Clear the requiresPasswordChange flag on the server
      const idToken = await firebaseUser.getIdToken();
      try {
        await apiRequest('/api/auth/clear-password-change-flag', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch {
        // Non-fatal — flag will be cleared on next login if this fails
      }

      toast.success('Password updated successfully!');
      // Clear the requiresPasswordChange flag from AuthContext and IndexedDB cache
      await clearPasswordChange();
      onComplete();
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Your session has expired. Please log out and log in again to change your password.');
      } else {
        setError(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      data-testid="modal-force-password-change"
    >
      <div className="w-full max-w-md bg-gray-900 border border-amber-700 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-full mb-4">
            <KeyRound className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Password Change Required</h2>
          <p className="text-gray-400 text-sm">
            Your administrator has issued a temporary password. Please set a new permanent password to continue.
          </p>
          {userEmail && (
            <p className="text-amber-400 text-sm mt-2 font-medium">{userEmail}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pr-11 pl-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={isChanging}
                autoFocus
                data-testid="input-new-password-force"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className="w-full pr-11 pl-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={isChanging}
                data-testid="input-confirm-password-force"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm" data-testid="text-force-pw-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={isChanging || !newPassword || !confirmPassword}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="button-set-new-password"
          >
            {isChanging ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Updating...</>
            ) : (
              <><CheckCircle className="w-5 h-5" />Set New Password</>
            )}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            data-testid="button-force-pw-logout"
          >
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
