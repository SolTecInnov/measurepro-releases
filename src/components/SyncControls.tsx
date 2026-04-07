import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw, Trash2, Database, Wifi, WifiOff, AlertTriangle, Check, LogIn, LogOut, UserPlus } from 'lucide-react';
import { syncManager } from '../lib/sync';
import { isOnline, signInWithEmail, createUser, signOutUser, getCurrentUser, initAuthListener, importSurveysFromFirebase } from '../lib/firebase';
import { toast } from 'sonner';

const SyncControls: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>(isOnline() ? 'online' : 'offline');
  const [pendingChanges, setPendingChanges] = useState(syncManager.pendingChanges);
  const [syncStatus, setSyncStatus] = useState(syncManager.status);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(syncManager.lastSyncTime);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [testOfflineMode, setTestOfflineMode] = useState(false);
  const [syncResults, setSyncResults] = useState<{syncedItems: number, totalItems: number} | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set up auth state listener
    const unsubscribe = initAuthListener((user: any) => {
      setCurrentUser(user);
    });

    // Check pending changes periodically (reduced to 15s to prevent DB pressure during rapid logging)
    const intervalId = setInterval(() => {
      syncManager.checkPendingChanges().then(count => {
        setPendingChanges(count);
      });
    }, 15000);

    // Listen for sync status changes
    const handleSyncStatusChange = (event: CustomEvent) => {
      const { status, pendingChanges, lastSyncTime } = event.detail;
      
      // Store sync results if available
      if (event.detail.syncedItems !== undefined && event.detail.totalItems !== undefined) {
        setSyncResults({
          syncedItems: event.detail.syncedItems,
          totalItems: event.detail.totalItems
        });
      }
      
      if (status) setSyncStatus(status);
      if (pendingChanges !== undefined) setPendingChanges(pendingChanges);
      if (lastSyncTime) setLastSyncTime(new Date(lastSyncTime));
    };

    window.addEventListener('sync-status-change', handleSyncStatusChange as EventListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      window.removeEventListener('sync-status-change', handleSyncStatusChange as EventListener);
      clearInterval(intervalId);
    };
  }, []);

  const handleSyncNow = () => {
    if (networkStatus === 'offline') {
      toast.error('Cannot sync while offline', {
        description: 'Please check your internet connection and try again.'
      });
      return;
    }

    // Check if user is signed in
    if (!currentUser) {
      setShowAuthForm(true);
      return;
    }

    syncManager.startSync();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    setIsAuthenticating(true);
    
    try {
      await signInWithEmail(email, password);
      // toast suppressed
      
      // Update current user state
      setCurrentUser(getCurrentUser());
      
      setShowAuthForm(false);
      
      // Start sync after successful sign-in
      syncManager.startSync();
    } catch (error: any) {
      toast.error('Sign in failed', {
        description: error.message
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setIsAuthenticating(true);
    
    try {
      await createUser(email, password);
      // toast suppressed
      
      // Update current user state
      setCurrentUser(getCurrentUser());
      
      setShowAuthForm(false);
      
      // Start sync after successful sign-up
      syncManager.startSync();
    } catch (error: any) {
      toast.error('Sign up failed', {
        description: error.message
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      
      // Update current user state
      setCurrentUser(null);
      
      // toast suppressed
    } catch (error: any) {
      toast.error('Sign out failed', {
        description: error.message
      });
    }
  };

  const handleClearCache = async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }

    try {
      // Clear IndexedDB
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }

      // Clear localStorage but preserve user preferences
      const userPreferences = {
        layout_config: localStorage.getItem('layout_config'),
        layout_version: localStorage.getItem('layout_version'),
        poi_action_config: localStorage.getItem('poi_action_config'),
        left_column_width: localStorage.getItem('left_column_width'),
        soundConfigVersion: localStorage.getItem('soundConfigVersion'),
        soundConfig: localStorage.getItem('soundConfig')
      };
      
      localStorage.clear();
      
      // Restore user preferences
      Object.entries(userPreferences).forEach(([key, value]) => {
        if (value !== null) {
          localStorage.setItem(key, value);
        }
      });

      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // toast suppressed

      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      toast.error('Failed to clear cache', {
        description: error.message
      });
    } finally {
      setClearConfirm(false);
    }
  };

  const toggleTestOfflineMode = () => {
    setTestOfflineMode(!testOfflineMode);
    
    if (!testOfflineMode) {
      // Enable test offline mode
      // This doesn't actually disconnect from the internet,
      // but it simulates offline behavior for testing
      Object.defineProperty(navigator, 'onLine', {
        get: function() {
          return false;
        },
        configurable: true
      });
      
      // Dispatch offline event
      window.dispatchEvent(new Event('offline'));
      
      // toast suppressed
    } else {
      // Disable test offline mode
      // Restore the original navigator.onLine property
      delete (navigator as any).onLine;
      
      // Dispatch online event if actually online
      if (window.navigator.onLine) {
        window.dispatchEvent(new Event('online'));
      }
      
      // toast suppressed
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cloud className="w-6 h-6 text-blue-400" />
            Sync & Offline Settings
          </h2>
          
          {/* Authentication Status */}
          <div className="flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">
                  Signed in as {currentUser.email}
                </div>
                <button
                  onClick={handleSyncNow}
                  disabled={networkStatus === 'offline' || syncStatus === 'syncing' || pendingChanges === 0}
                  className={`flex items-center gap-2 px-3 py-1.5 ${
                    networkStatus === 'offline' || syncStatus === 'syncing' || pendingChanges === 0
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } rounded-lg text-sm`}
                >
                  <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Network Status */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                {networkStatus === 'online' ? (
                  <Wifi className="w-5 h-5 text-green-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400" />
                )}
                Network Status
              </h3>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                networkStatus === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {networkStatus === 'online' ? 'Online' : 'Offline'}
              </div>
            </div>
            
            <p className="text-gray-300 mb-4">
              {networkStatus === 'online' 
                ? 'You are connected to the internet. Changes will be synced to the cloud automatically.' 
                : 'You are currently offline. Changes will be saved locally and synced when you reconnect.'}
            </p>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSyncNow}
                disabled={networkStatus === 'offline' || syncStatus === 'syncing' || pendingChanges === 0}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  networkStatus === 'offline' || syncStatus === 'syncing' || pendingChanges === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </button>
              
              <button
                onClick={toggleTestOfflineMode}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  testOfflineMode
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {testOfflineMode ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    Disable Test Offline Mode
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    Test Offline Mode
                  </>
                )}
              </button>
            </div>
          </div>
          {/* Sync Status */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                Sync Status
              </h3>
              <div className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                syncStatus === 'syncing' ? 'bg-blue-500/20 text-blue-400' :
                syncStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                syncStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Syncing
                  </>
                ) : syncStatus === 'success' ? (
                  <>
                    <Check className="w-3 h-3" />
                    Synced
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Error
                  </>
                ) : (
                  <>
                    <Cloud className="w-3 h-3" />
                    Idle
                  </>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Pending Changes</span>
                <span className={`font-mono ${pendingChanges > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {pendingChanges}
                  {syncResults && syncStatus === 'error' && (
                    <span className="ml-2 text-xs text-gray-400">
                      (Last sync: {syncResults.syncedItems} of {syncResults.totalItems} items)
                    </span>
                  )}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Last Sync</span>
                <span className="font-mono text-gray-300">
                  {lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Auto-Sync</span>
                <span className="font-mono text-green-400">
                  {currentUser ? 'Enabled' : 'Disabled (Sign in required)'}
                  {currentUser && pendingChanges > 0 && (
                    <button 
                      onClick={handleSyncNow}
                      className="ml-2 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      Sync Now
                    </button>
                  )}
                </span>
              </div>
            </div>
            
            {/* Import from Cloud */}
            {currentUser && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                <button
                  onClick={async () => {
                    const btn = document.activeElement as HTMLButtonElement;
                    if (btn) btn.disabled = true;
                    try {
                      console.log('[SyncControls] Starting import from cloud...');
                      const surveys = await importSurveysFromFirebase();
                      console.log('[SyncControls] Import complete, surveys:', surveys.length);
                      // Trigger survey list refresh
                      window.dispatchEvent(new CustomEvent('surveys-imported'));
                    } catch (error) {
                      console.error('[SyncControls] Import error:', error);
                    } finally {
                      if (btn) btn.disabled = false;
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  <Cloud className="w-4 h-4" />
                  Import Surveys from Cloud
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  Import your surveys and POIs from the cloud to this device
                </p>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-600">
              <button
                onClick={handleClearCache}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm ${
                  clearConfirm
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 text-white'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {clearConfirm ? 'Confirm Clear All Local Data' : 'Clear All Local Data'}
              </button>
              
              {clearConfirm && (
                <p className="text-xs text-red-400 mt-2">
                  Warning: This will delete all locally stored data. This action cannot be undone.
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Authentication Section */}
        <div className="mt-6 bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-blue-400" />
            Cloud Synchronization
          </h3>
          
          {currentUser ? (
            <div className="space-y-4">
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <h4 className="font-medium">Signed In</h4>
                </div>
                <p className="text-gray-300">
                  You are signed in as <span className="font-medium text-green-400">{currentUser.email}</span>. 
                  Your data will be automatically synced to the cloud when you're online.
                </p>
                <button
                  onClick={handleSignOut}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-blue-400" />
                  <h4 className="font-medium">Not Signed In</h4>
                </div>
                <p className="text-gray-300">
                  Sign in to enable cloud synchronization. Your data will still be saved locally even if you don't sign in.
                </p>
                <button
                  onClick={() => setShowAuthForm(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2 text-blue-400">Offline Capabilities</h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
              <span>All data is stored locally and will be available even without an internet connection</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
              <span>Changes made offline will automatically sync when you reconnect to the internet</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
              <span>Automatic backups are created to prevent data loss</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
              <span>You can manually trigger synchronization when online</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
              <span>The app will notify you when you go offline or come back online</span>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Authentication Modal */}
      {showAuthForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </h3>
            
            <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAuthForm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {authMode === 'signin' ? 'Signing In...' : 'Creating Account...'}
                    </>
                  ) : (
                    <>
                      {authMode === 'signin' ? (
                        <>
                          <LogIn className="w-4 h-4" />
                          Sign In
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Create Account
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
              
              <div className="text-center mt-4 text-sm">
                {authMode === 'signin' ? (
                  <p>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Create one
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SyncControls;