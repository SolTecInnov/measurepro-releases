import { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';

export const MarketingPasswordGate = ({ children }: { children: React.ReactNode }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check sessionStorage
    const unlocked = sessionStorage.getItem('marketingUnlocked') === 'true';
    setIsUnlocked(unlocked);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === (import.meta.env.VITE_MARKETING_PASSWORD || '')) {
      sessionStorage.setItem('marketingUnlocked', 'true');
      sessionStorage.setItem('marketingPassword', password);
      setIsUnlocked(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Marketing Resources</h1>
          <p className="text-gray-400">Enter password to access marketing materials</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              data-testid="input-marketing-password"
            />
          </div>
          
          {error && (
            <div className="text-red-400 text-sm text-center" data-testid="text-password-error">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
            data-testid="button-unlock"
          >
            <div className="flex items-center justify-center gap-2">
              <Unlock className="w-5 h-5" />
              <span>Unlock</span>
            </div>
          </button>
        </form>
      </div>
    </div>
  );
};
