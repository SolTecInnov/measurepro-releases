import { useState, useEffect } from 'react';
import { useSettingsStore, forceSyncNow } from '../../lib/settings';
import { useLoadSettings } from '../../lib/hooks';
import { Bot, Key, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Sparkles, Trash2, LifeBuoy, ExternalLink, Lock, Clock, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAITrial, resetTrialCache } from '../../hooks/useAITrial';
import { getCurrentUser } from '../../lib/firebase';

const AIAssistantSettings = () => {
  useLoadSettings();
  const { aiAssistantSettings, setAIAssistantSettings } = useSettingsStore();
  const trialStatus = useAITrial();
  
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  const [zendeskSubdomain, setZendeskSubdomain] = useState('');
  const [zendeskEmail, setZendeskEmail] = useState('');
  const [zendeskToken, setZendeskToken] = useState('');
  const [showZendeskToken, setShowZendeskToken] = useState(false);
  const [isValidatingZendesk, setIsValidatingZendesk] = useState(false);
  const [zendeskStatus, setZendeskStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  // Admin-only: shared trial key management
  const [trialKey, setTrialKey] = useState('');
  const [showTrialKey, setShowTrialKey] = useState(false);
  const [trialKeyStatus, setTrialKeyStatus] = useState<'none' | 'saved' | 'error'>('none');
  const [isSavingTrialKey, setIsSavingTrialKey] = useState(false);
  const [adminTrialKeyMasked, setAdminTrialKeyMasked] = useState<string | null>(null);

  useEffect(() => {
    setIsAdminUnlocked(sessionStorage.getItem('admin_unlocked') === 'true');
  }, []);

  useEffect(() => {
    if (aiAssistantSettings?.openaiApiKey) {
      setApiKey(aiAssistantSettings.openaiApiKey);
      setKeyStatus('valid');
    }
    if (aiAssistantSettings?.zendeskSubdomain) setZendeskSubdomain(aiAssistantSettings.zendeskSubdomain);
    if (aiAssistantSettings?.zendeskEmail) setZendeskEmail(aiAssistantSettings.zendeskEmail);
    if (aiAssistantSettings?.zendeskApiToken) {
      setZendeskToken(aiAssistantSettings.zendeskApiToken);
      setZendeskStatus('valid');
    }
  }, [aiAssistantSettings?.openaiApiKey, aiAssistantSettings?.zendeskSubdomain, aiAssistantSettings?.zendeskEmail, aiAssistantSettings?.zendeskApiToken]);
  
  const validateAndSaveKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    if (!apiKey.startsWith('sk-')) {
      toast.error('Invalid API key format. OpenAI keys start with "sk-"');
      setKeyStatus('invalid');
      return;
    }
    setIsValidating(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (response.ok) {
        await setAIAssistantSettings({ ...aiAssistantSettings, openaiApiKey: apiKey, enabled: true });
        await forceSyncNow();
        setKeyStatus('valid');
        toast.success('API key validated and saved!');
      } else if (response.status === 401) {
        setKeyStatus('invalid');
        toast.error('Invalid API key. Please check your key and try again.');
      } else {
        setKeyStatus('invalid');
        toast.error(`API validation failed: ${response.statusText}`);
      }
    } catch {
      setKeyStatus('invalid');
      toast.error('Failed to validate API key. Please check your internet connection.');
    } finally {
      setIsValidating(false);
    }
  };
  
  const removeApiKey = async () => {
    await setAIAssistantSettings({ ...aiAssistantSettings, openaiApiKey: '', enabled: false });
    await forceSyncNow();
    setApiKey('');
    setKeyStatus('none');
    toast.success('API key removed');
  };

  const validateAndSaveZendesk = async () => {
    if (!zendeskSubdomain.trim() || !zendeskEmail.trim() || !zendeskToken.trim()) {
      toast.error('Please fill in all Zendesk fields');
      return;
    }
    setIsValidatingZendesk(true);
    try {
      const subdomain = zendeskSubdomain.trim().replace(/^https?:\/\//, '').replace(/\.zendesk\.com.*$/, '');
      const email = zendeskEmail.trim();
      const token = zendeskToken.trim();
      const response = await fetch('/api/zendesk/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, email, token }),
      });
      const data = await response.json() as { success: boolean; user?: { name: string; role: string }; error?: string };
      if (data.success) {
        await setAIAssistantSettings({
          ...aiAssistantSettings,
          zendeskSubdomain: subdomain,
          zendeskEmail: email,
          zendeskApiToken: token,
        });
        // Force immediate Postgres write — don't rely on the 2-second debounce
        // so credentials survive a page reload or server restart.
        await forceSyncNow();
        setZendeskSubdomain(subdomain);
        setZendeskStatus('valid');
        toast.success(`Zendesk connected — signed in as ${data.user?.name ?? email}`);
      } else {
        setZendeskStatus('invalid');
        toast.error(`Zendesk: ${data.error ?? 'Authentication failed'}`, { duration: 10000 });
      }
    } catch (err: unknown) {
      setZendeskStatus('invalid');
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Connection failed: ${msg}`, { duration: 10000 });
    } finally {
      setIsValidatingZendesk(false);
    }
  };

  const removeZendesk = async () => {
    await setAIAssistantSettings({
      ...aiAssistantSettings,
      zendeskSubdomain: '',
      zendeskEmail: '',
      zendeskApiToken: '',
    });
    await forceSyncNow();
    setZendeskSubdomain('');
    setZendeskEmail('');
    setZendeskToken('');
    setZendeskStatus('none');
    toast.success('Zendesk integration removed');
  };

  // Fetch existing (masked) admin trial key when admin is unlocked
  useEffect(() => {
    if (!isAdminUnlocked) return;
    const fetchAdminTrialKey = async () => {
      try {
        const user = getCurrentUser();
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/ai-trial-config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { sharedTrialKey: string | null; isSet: boolean };
          setAdminTrialKeyMasked(data.isSet ? data.sharedTrialKey : null);
        }
      } catch {
        // ignore
      }
    };
    fetchAdminTrialKey();
  }, [isAdminUnlocked]);

  const saveAdminTrialKey = async () => {
    if (!trialKey.trim()) {
      toast.error('Please enter a trial API key');
      return;
    }
    if (!trialKey.startsWith('sk-')) {
      toast.error('Invalid key format — OpenAI keys start with "sk-"');
      return;
    }
    setIsSavingTrialKey(true);
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/ai-trial-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sharedTrialKey: trialKey.trim() }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setTrialKeyStatus('saved');
        setAdminTrialKeyMasked(`sk-...${trialKey.trim().slice(-4)}`);
        setTrialKey('');
        resetTrialCache();
        toast.success('Shared trial key saved — new users will now have AI access for 45 days');
      } else {
        setTrialKeyStatus('error');
        toast.error(data.error ?? 'Failed to save trial key');
      }
    } catch (err: unknown) {
      setTrialKeyStatus('error');
      toast.error(err instanceof Error ? err.message : 'Failed to save trial key');
    } finally {
      setIsSavingTrialKey(false);
    }
  };

  const removeAdminTrialKey = async () => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      await fetch('/api/admin/ai-trial-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sharedTrialKey: '' }),
      });
      setAdminTrialKeyMasked(null);
      setTrialKeyStatus('none');
      resetTrialCache();
      toast.success('Shared trial key removed');
    } catch {
      toast.error('Failed to remove trial key');
    }
  };

  const maskedKey = apiKey ? `sk-...${apiKey.slice(-4)}` : '';
  const maskedToken = zendeskToken ? `...${zendeskToken.slice(-4)}` : '';
  const trialPct = trialStatus.inTrial
    ? Math.round((trialStatus.daysUsed / trialStatus.trialDuration) * 100)
    : 100;
  
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">AI Support Assistant</h3>
          <p className="text-sm text-gray-400">Powered by GPT-4o — ask anything about MeasurePRO, manage your data, and get support</p>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-emerald-300 mb-2">What the AI Assistant can do</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Answer any question about MeasurePRO features, hardware, and workflows</li>
              <li>• Query and manage your survey POI data with natural language</li>
              <li>• Analyze photos attached to POIs using GPT-4 Vision</li>
              <li>• Bulk-edit POIs with preview and undo support</li>
              <li>• Search help articles from the knowledge base</li>
              <li>• Create a support ticket directly from the chat</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Trial Status Banner */}
      {trialStatus.loaded && (
        <div className={`border rounded-lg p-4 ${
          trialStatus.inTrial && trialStatus.hasTrialKey
            ? 'bg-emerald-900/20 border-emerald-700/40'
            : !trialStatus.inTrial
            ? 'bg-amber-900/20 border-amber-700/40'
            : 'bg-gray-800/50 border-gray-700'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {trialStatus.inTrial && trialStatus.hasTrialKey ? (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">Free Trial Active</span>
                <span className="ml-auto text-sm font-bold text-white">{trialStatus.daysRemaining} <span className="text-gray-400 font-normal text-xs">days left</span></span>
              </>
            ) : !trialStatus.inTrial ? (
              <>
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">Trial Expired</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-300">No trial key configured</span>
              </>
            )}
          </div>
          {trialStatus.inTrial && trialStatus.hasTrialKey && (
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
                style={{ width: `${trialPct}%` }}
              />
            </div>
          )}
          <p className="text-xs text-gray-400">
            {trialStatus.inTrial && trialStatus.hasTrialKey
              ? `${trialStatus.daysUsed} of ${trialStatus.trialDuration} days used. After the trial, add your own OpenAI key below to continue.`
              : !trialStatus.inTrial
              ? 'The 45-day free trial has ended. Add your own OpenAI API key below to continue using the AI Assistant.'
              : 'Contact your administrator to enable the shared trial key.'}
          </p>
        </div>
      )}

      {/* OpenAI API Key */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-amber-400" />
          <h4 className="font-semibold">OpenAI API Key</h4>
          {keyStatus === 'valid' && (
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Connected
            </span>
          )}
          {keyStatus === 'invalid' && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" /> Invalid
            </span>
          )}
        </div>
        
        <p className="text-sm text-gray-400">
          Get your key from{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1">
            platform.openai.com <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={showKey ? apiKey : (apiKey ? maskedKey : '')}
              onChange={(e) => { setApiKey(e.target.value); setKeyStatus('none'); }}
              placeholder="sk-..."
              className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              data-testid="input-openai-api-key"
            />
            <button type="button" onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              data-testid="button-toggle-key-visibility">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={validateAndSaveKey} disabled={isValidating || !apiKey.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
            data-testid="button-validate-save-key">
            {isValidating ? <><Loader2 className="w-4 h-4 animate-spin" />Validating...</> : 'Save Key'}
          </button>
          {keyStatus === 'valid' && (
            <button onClick={removeApiKey}
              className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
              title="Remove API key" data-testid="button-remove-key">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <p className="text-xs text-gray-500">
          Your key is stored in your browser only and never sent to SolTec servers. Standard OpenAI API pricing applies.
        </p>
      </div>

      {/* Zendesk Integration — Admin only */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-blue-400" />
          <h4 className="font-semibold">Support Integration (Zendesk)</h4>
          {isAdminUnlocked && zendeskStatus === 'valid' && (
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Connected
            </span>
          )}
          {isAdminUnlocked && zendeskStatus === 'invalid' && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" /> Invalid
            </span>
          )}
          {!isAdminUnlocked && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full ml-auto">
              <Lock className="w-3 h-3" /> Admin only
            </span>
          )}
        </div>

        {!isAdminUnlocked ? (
          <div className="flex items-center gap-3 py-4 text-gray-500">
            <Lock className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">
              Zendesk integration is managed by administrators. Unlock the Admin panel first to configure this section.
              {aiAssistantSettings?.zendeskSubdomain && (
                <span className="block mt-1 text-green-600 text-xs">
                  ✓ Currently connected to {aiAssistantSettings.zendeskSubdomain}.zendesk.com
                </span>
              )}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400">
              Connect your Zendesk account so the AI can search your help articles and create support tickets on your behalf.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Zendesk Subdomain</label>
                <input
                  type="text"
                  value={zendeskSubdomain}
                  onChange={(e) => { setZendeskSubdomain(e.target.value); setZendeskStatus('none'); }}
                  placeholder="yourcompany  (from yourcompany.zendesk.com)"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  data-testid="input-zendesk-subdomain"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Agent Email</label>
                <input
                  type="email"
                  value={zendeskEmail}
                  onChange={(e) => { setZendeskEmail(e.target.value); setZendeskStatus('none'); }}
                  placeholder="agent@yourcompany.com"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  data-testid="input-zendesk-email"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Token</label>
                <div className="relative">
                  <input
                    type={showZendeskToken ? 'text' : 'password'}
                    value={showZendeskToken ? zendeskToken : (zendeskToken ? maskedToken : '')}
                    onChange={(e) => { setZendeskToken(e.target.value); setZendeskStatus('none'); }}
                    placeholder="Zendesk API token"
                    className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    data-testid="input-zendesk-token"
                  />
                  <button type="button" onClick={() => setShowZendeskToken(!showZendeskToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showZendeskToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Generate a token at Admin Center → Apps &amp; Integrations → APIs → Zendesk API
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={validateAndSaveZendesk}
                disabled={isValidatingZendesk || !zendeskSubdomain.trim() || !zendeskEmail.trim() || !zendeskToken.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                data-testid="button-validate-zendesk">
                {isValidatingZendesk ? <><Loader2 className="w-4 h-4 animate-spin" />Connecting...</> : 'Connect Zendesk'}
              </button>
              {zendeskStatus === 'valid' && (
                <button onClick={removeZendesk}
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                  title="Remove Zendesk integration" data-testid="button-remove-zendesk">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Admin-only: Shared Trial Key Management */}
      {isAdminUnlocked && (
        <div className="bg-gray-800/50 border border-violet-700/40 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <h4 className="font-semibold">Shared Trial Key</h4>
            {adminTrialKeyMasked && (
              <span className="flex items-center gap-1 text-xs text-violet-300 bg-violet-900/30 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" /> Set ({adminTrialKeyMasked})
              </span>
            )}
            <span className="ml-auto text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">Admin only</span>
          </div>
          <p className="text-sm text-gray-400">
            New users will automatically use this key for their first <strong className="text-white">45 days</strong>, with no configuration required on their part. After the trial, they must add their own key.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showTrialKey ? 'text' : 'password'}
                value={trialKey}
                onChange={(e) => { setTrialKey(e.target.value); setTrialKeyStatus('none'); }}
                placeholder={adminTrialKeyMasked ? `Current: ${adminTrialKeyMasked} — enter new key to replace` : 'sk-...'}
                className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                data-testid="input-admin-trial-key"
              />
              <button type="button" onClick={() => setShowTrialKey(!showTrialKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                {showTrialKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={saveAdminTrialKey}
              disabled={isSavingTrialKey || !trialKey.trim()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
              data-testid="button-save-trial-key"
            >
              {isSavingTrialKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {adminTrialKeyMasked ? 'Update' : 'Save'}
            </button>
            {adminTrialKeyMasked && (
              <button
                onClick={removeAdminTrialKey}
                className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                title="Remove shared trial key"
                data-testid="button-remove-trial-key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {trialKeyStatus === 'saved' && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Saved — new and existing trial users will now use this key.
            </p>
          )}
        </div>
      )}

      {(keyStatus === 'valid' || (trialStatus.inTrial && trialStatus.hasTrialKey)) && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h4 className="font-semibold">Ready to Use</h4>
          </div>
          <p className="text-sm text-gray-400">
            Open the <strong>AI Assistant</strong> tab to start chatting. Ask anything about MeasurePRO, your surveys, or get support.
            {zendeskStatus === 'valid' ? ' Zendesk help search and ticket creation are also enabled.' : ''}
          </p>
        </div>
      )}
      
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h5 className="font-medium text-amber-300 mb-1">Privacy Note</h5>
            <p className="text-sm text-gray-400">
              When analyzing POI photos, images are sent to OpenAI's API. Survey text data included in chat messages is also processed by OpenAI. No data is stored by OpenAI beyond their standard retention policy. Zendesk credentials are stored locally in your browser only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantSettings;
