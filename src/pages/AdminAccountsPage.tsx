import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Users, AlertCircle, RefreshCw, UserPlus, KeyRound, Settings2, ChevronDown, ChevronUp, BarChart2, Mail, Building2, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { getCurrentUser } from '@/lib/firebase';
import { Account, ADDON_DISPLAY_NAMES } from '../../shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';
import { isMasterAdmin } from '@/lib/auth/masterAdmin';
import { useAuth } from '@/lib/auth/AuthContext';

const ADDONS = [
  { id: 'ai_plus', label: 'AI+' },
  { id: 'envelope', label: 'Envelope Analysis' },
  { id: 'convoy', label: 'Convoy Mode' },
  { id: 'route_analysis', label: 'Route Analysis' },
  { id: 'swept_path', label: 'Swept Path' },
  { id: 'calibration', label: 'Calibration' },
  { id: '3d_view', label: '3D View' },
  { id: 'gnss', label: 'GNSS' },
];

type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  company?: string;
  title?: string;
  subscriptionTier?: string;
  enabledAddons?: string[];
  accountStatus?: string;
  status?: string;
  createdAt?: string;
  requiresPasswordChange?: boolean;
  subscriptionEndDate?: string; // ISO date string — access expires after this date
  freeUntil?: string;           // ISO date string — free trial access until this date
  // Augmented fields from company_members and addon_overrides
  linkedCompanyName?: string | null;
  activeAddonKeys?: string[];
  nearestAddonExpiry?: string | null;
};

async function getAuthHeader() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

export default function AdminAccountsPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin, isLoading, cachedUserData } = useAuth();

  // Create user form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    fullName: '',
    company: '',
    title: '',
    phone: '',
    address: '',
    subscriptionTier: 'pro',
    enabledAddons: [] as string[],
    sendWelcomeEmail: false,
  });

  // Reset password dialog state
  const [showResetPwDialog, setShowResetPwDialog] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<UserRecord | null>(null);

  // Subscription edit dialog state
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subEditUser, setSubEditUser] = useState<UserRecord | null>(null);
  const [subTier, setSubTier] = useState('pro');
  const [subAddons, setSubAddons] = useState<string[]>([]);
  const [subEndDate, setSubEndDate] = useState('');     // subscription expiry date (YYYY-MM-DD)
  const [subFreeUntil, setSubFreeUntil] = useState(''); // free-trial-until date (YYYY-MM-DD)

  // Resend welcome email dialog state
  const [showResendEmailDialog, setShowResendEmailDialog] = useState(false);
  const [resendEmailUser, setResendEmailUser] = useState<UserRecord | null>(null);
  const [resendNewPassword, setResendNewPassword] = useState('');

  // Company & add-on assignment dialog state
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [companyEditUser, setCompanyEditUser] = useState<UserRecord | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companyMembership, setCompanyMembership] = useState<{ id: string; companyId: string; role: string } | null>(null);
  // enabledAddons returned by /membership response — used as immediate source while /companies may still be loading
  const [membershipCompanyAddons, setMembershipCompanyAddons] = useState<string[]>([]);
  const [addonToggles, setAddonToggles] = useState<Record<string, boolean>>({});
  const [addonExpiries, setAddonExpiries] = useState<Record<string, string>>({});
  const [companyMembershipLoading, setCompanyMembershipLoading] = useState(false);

  // Check if user is admin (master admin email OR Firebase custom claim admin:true)
  useEffect(() => {
    const checkAdmin = async () => {
      if (isLoading) return;
      if (!authContextUser && !cachedUserData) return;

      if (cachedIsMasterAdmin) {
        setIsAdmin(true);
        setIsCheckingAdmin(false);
        return;
      }

      const firebaseUser = getCurrentUser();

      if (!firebaseUser) {
        if (authContextUser?.email && (isMasterAdmin(authContextUser.email) || authContextUser.email === 'admin@soltec.ca')) {
          setIsAdmin(true);
          setIsCheckingAdmin(false);
          return;
        }
        navigate('/login');
        return;
      }

      // Check both master-admin email AND Firebase custom claim admin:true
      const isMasterAdminEmail = isMasterAdmin(firebaseUser.email) || firebaseUser.email === 'admin@soltec.ca';
      let hasAdminClaim = false;
      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        hasAdminClaim = tokenResult.claims['admin'] === true;
      } catch {
        hasAdminClaim = false;
      }

      if (isMasterAdminEmail || hasAdminClaim) {
        setIsAdmin(true);
      } else {
        toast.error('Unauthorized', { description: 'You do not have admin access.' });
        navigate('/');
      }
      setIsCheckingAdmin(false);
    };

    checkAdmin();
  }, [navigate, cachedIsMasterAdmin, authContextUser, cachedUserData, isLoading]);

  // Fetch pending accounts
  const { data: accountsData, isLoading: isLoadingAccounts, refetch } = useQuery<{ accounts: Account[] }>({
    queryKey: ['/api/admin/accounts/pending'],
    enabled: isAdmin && !isCheckingAdmin,
  });

  const pendingAccounts: Account[] = accountsData?.accounts || [];

  // Fetch all users
  const { data: allUsersData, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<UserRecord[] | { users: UserRecord[] }>({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin && !isCheckingAdmin,
  });

  // The default fetcher may unwrap single-key responses (returning the array directly)
  // or return the full object — handle both shapes gracefully
  const allUsers: UserRecord[] = Array.isArray(allUsersData)
    ? allUsersData
    : ((allUsersData as { users?: UserRecord[] })?.users || []);

  // Check Firebase Admin SDK availability
  const { data: firebaseStatus, error: firebaseStatusError, isLoading: isCheckingFirebase } = useQuery<{ available: boolean; message: string }>({
    queryKey: ['/api/admin/firebase-status'],
    enabled: isAdmin && !isCheckingAdmin,
    retry: false,
  });

  const isFirebaseAdminAvailable = firebaseStatusError
    ? false
    : (firebaseStatus?.available ?? false);

  // Approve account mutation
  const approveMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const headers = await getAuthHeader();
      return apiRequest(`/api/admin/accounts/${accountId}/approve`, { method: 'POST', headers });
    },
    onSuccess: () => {
      /* toast removed */
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounts/pending'] });
    },
    onError: (error: any) => {
      toast.error('Approval failed', { description: error.message || 'Failed to approve account.' });
    },
  });

  // Create beta account mutation
  const createBetaMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeader();
      return apiRequest('/api/admin/create-beta-account', { method: 'POST', headers });
    },
    onSuccess: (data: any) => {
      /* toast removed */
    },
    onError: (error: any) => {
      toast.error('Failed to create beta account', { description: error.message || 'Please try manual creation instead.' });
    },
  });

  // Reject account mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ accountId, reason }: { accountId: string; reason?: string }) => {
      const headers = await getAuthHeader();
      return apiRequest(`/api/admin/accounts/${accountId}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      /* toast removed */
      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedAccount(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounts/pending'] });
    },
    onError: (error: any) => {
      toast.error('Rejection failed', { description: error.message || 'Failed to reject account.' });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeader();
      return apiRequest('/api/admin/users/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          fullName: createForm.fullName,
          company: createForm.company || undefined,
          title: createForm.title || undefined,
          phone: createForm.phone || undefined,
          address: createForm.address || undefined,
          subscriptionTier: createForm.subscriptionTier,
          enabledAddons: createForm.enabledAddons,
          sendWelcomeEmailFlag: createForm.sendWelcomeEmail,
        }),
      });
    },
    onSuccess: (data: any) => {
      /* toast removed */
      setShowCreateForm(false);
      setCreateForm({
        email: '', password: '', fullName: '', company: '', title: '',
        phone: '', address: '', subscriptionTier: 'pro', enabledAddons: [], sendWelcomeEmail: false,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: any) => {
      toast.error('Failed to create user', { description: error.message || 'Please check the fields and try again.' });
    },
  });

  // Reset password mutation
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);
  const [adminSetPassword, setAdminSetPassword] = useState('');
  const [useCustomPassword, setUseCustomPassword] = useState(false);

  const resetPwMutation = useMutation({
    mutationFn: async () => {
      if (!resetPwUser) throw new Error('No user selected');
      const headers = await getAuthHeader();
      const body: Record<string, string> = {};
      if (useCustomPassword && adminSetPassword.length >= 6) {
        body.newPassword = adminSetPassword;
      }
      return apiRequest(`/api/admin/users/${resetPwUser.id}/reset-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data: any) => {
      setGeneratedTempPassword(data.temporaryPassword || null);
      /* toast removed */
    },
    onError: (error: any) => {
      toast.error('Failed to reset password', { description: error.message || 'Please try again.' });
    },
  });

  // Update subscription mutation
  const updateSubMutation = useMutation({
    mutationFn: async () => {
      if (!subEditUser) throw new Error('No user selected');
      const headers = await getAuthHeader();
      return apiRequest(`/api/admin/users/${subEditUser.id}/subscription`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          subscriptionTier: subTier,
          enabledAddons: subAddons,
          subscriptionEndDate: subEndDate || null,
          freeUntil: subFreeUntil || null,
        }),
      });
    },
    onSuccess: () => {
      /* toast removed */
      setShowSubDialog(false);
      setSubEditUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update subscription', { description: error.message });
    },
  });

  // Resend welcome email mutation
  const resendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!resendEmailUser) throw new Error('No user selected');
      const headers = await getAuthHeader();
      const body: Record<string, string> = {};
      if (resendNewPassword.length >= 6) body.newPassword = resendNewPassword;
      return apiRequest(`/api/admin/users/${resendEmailUser.id}/resend-welcome-email`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data: any) => {
      /* toast removed */
      setShowResendEmailDialog(false);
      setResendEmailUser(null);
      setResendNewPassword('');
    },
    onError: (error: any) => {
      toast.error('Failed to send email', { description: error.message || 'Please try again.' });
    },
  });

  const handleOpenResendEmail = (user: UserRecord) => {
    setResendEmailUser(user);
    setResendNewPassword('');
    setShowResendEmailDialog(true);
  };

  // Fetch all companies (for company selector)
  const { data: companiesData } = useQuery<{ success: boolean; companies: { id: string; name: string; enabledAddons?: string[] }[] }>({
    queryKey: ['/api/companies'],
    enabled: isAdmin && !isCheckingAdmin,
    queryFn: async () => {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE_URL}/api/companies`, { headers });
      if (!res.ok) throw new Error('Failed to fetch companies');
      return res.json();
    },
  });
  const allCompanies = companiesData?.companies || [];

  const assignCompanyMutation = useMutation({
    mutationFn: async ({ uid, companyId, fullName, email, addonOverrides }: {
      uid: string;
      companyId: string;
      fullName: string;
      email: string;
      addonOverrides: { addonKey: string; expiresAt: string }[];
    }) => {
      const headers = await getAuthHeader();
      return apiRequest(`/api/admin/users/${uid}/assign-company`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ companyId, fullName, email, addonOverrides }),
      });
    },
    onSuccess: () => {
      /* toast removed */
      setShowCompanyDialog(false);
      setCompanyEditUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update company assignment', { description: error.message });
    },
  });

  const removeCompanyMutation = useMutation({
    mutationFn: async (uid: string) => {
      const headers = await getAuthHeader();
      return apiRequest(`/api/admin/users/${uid}/company`, { method: 'DELETE', headers });
    },
    onSuccess: () => {
      /* toast removed */
      setCompanyMembership(null);
      setSelectedCompanyId('');
      setAddonToggles({});
      setAddonExpiries({});
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: any) => {
      toast.error('Failed to remove company', { description: error.message });
    },
  });

  const handleOpenCompanyDialog = async (user: UserRecord) => {
    setCompanyEditUser(user);
    setCompanyMembershipLoading(true);
    setCompanyMembership(null);
    setSelectedCompanyId('');
    setMembershipCompanyAddons([]);
    setAddonToggles({});
    setAddonExpiries({});
    setShowCompanyDialog(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}/membership`, { headers });
      const data = await res.json();
      if (data.membership) {
        setCompanyMembership(data.membership);
        setSelectedCompanyId(data.membership.companyId);
        // Store the company's enabledAddons from the membership response so the toggle
        // list renders immediately without waiting for the separate /companies query
        if (Array.isArray(data.company?.enabledAddons)) {
          setMembershipCompanyAddons(data.company.enabledAddons);
        }
      }
      if (data.activeOverrides?.length) {
        // The /membership endpoint returns `company` with its enabledAddons alongside the
        // overrides, so we don't depend on the async /companies list being loaded yet.
        // Only pre-populate toggles for add-ons that are currently enabled by the company,
        // filtering out stale overrides for since-disabled add-ons.
        const memberCompanyAddons: string[] | undefined = data.company?.enabledAddons;
        if (memberCompanyAddons && memberCompanyAddons.length > 0) {
          const toggles: Record<string, boolean> = {};
          const expiries: Record<string, string> = {};
          for (const o of data.activeOverrides) {
            if (memberCompanyAddons.includes(o.addonKey)) {
              toggles[o.addonKey] = true;
              expiries[o.addonKey] = o.expiresAt ? new Date(o.expiresAt).toISOString().split('T')[0] : '';
            }
          }
          setAddonToggles(toggles);
          setAddonExpiries(expiries);
        }
      }
    } catch (e: any) {
      toast.error('Failed to load membership data');
    } finally {
      setCompanyMembershipLoading(false);
    }
  };

  const handleSaveCompanyAssignment = () => {
    if (!companyEditUser || !selectedCompanyId) {
      toast.error('Please select a company');
      return;
    }
    const addonOverrides: { addonKey: string; expiresAt: string }[] = [];
    for (const [addonKey, enabled] of Object.entries(addonToggles)) {
      if (enabled) {
        const expiry = addonExpiries[addonKey];
        if (!expiry) {
          toast.error(`Please set an expiry date for ${ADDON_DISPLAY_NAMES[addonKey] || addonKey}`);
          return;
        }
        if (new Date(expiry) <= new Date()) {
          toast.error(`Expiry date for ${ADDON_DISPLAY_NAMES[addonKey] || addonKey} must be in the future`);
          return;
        }
        addonOverrides.push({ addonKey, expiresAt: new Date(expiry + 'T23:59:59').toISOString() });
      }
    }
    assignCompanyMutation.mutate({
      uid: companyEditUser.id,
      companyId: selectedCompanyId,
      fullName: companyEditUser.fullName,
      email: companyEditUser.email,
      addonOverrides,
    });
  };

  const selectedCompany = allCompanies.find(c => c.id === selectedCompanyId);
  // Use company list data when available; fall back to the enabledAddons returned by /membership
  // so the toggle list renders immediately without waiting for the /companies query to load
  const companyEnabledAddons = selectedCompany?.enabledAddons ?? membershipCompanyAddons;

  const handleApprove = (account: Account) => approveMutation.mutate(account.id);

  const handleRejectClick = (account: Account) => {
    setSelectedAccount(account);
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = () => {
    if (selectedAccount) rejectMutation.mutate({ accountId: selectedAccount.id, reason: rejectionReason || undefined });
  };

  const handleOpenResetPw = (user: UserRecord) => {
    setResetPwUser(user);
    setGeneratedTempPassword(null);
    setAdminSetPassword('');
    setUseCustomPassword(false);
    setShowResetPwDialog(true);
  };

  const handleOpenSubEdit = (user: UserRecord) => {
    setSubEditUser(user);
    setSubTier(user.subscriptionTier || 'pro');
    setSubAddons(user.enabledAddons || []);
    // Pre-populate date fields — convert ISO string to YYYY-MM-DD for <input type="date">
    setSubEndDate(user.subscriptionEndDate ? user.subscriptionEndDate.slice(0, 10) : '');
    setSubFreeUntil(user.freeUntil ? user.freeUntil.slice(0, 10) : '');
    setShowSubDialog(true);
  };

  const toggleCreateAddon = (id: string) => {
    setCreateForm(prev => ({
      ...prev,
      enabledAddons: prev.enabledAddons.includes(id)
        ? prev.enabledAddons.filter(a => a !== id)
        : [...prev.enabledAddons, id],
    }));
  };

  const toggleSubAddon = (id: string) => {
    setSubAddons(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  if (isLoading || isCheckingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Admin nav */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Admin Panel</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/analytics')}
            data-testid="button-go-to-analytics"
          >
            <BarChart2 className="w-4 h-4 mr-2 text-blue-500" />
            Analytics
          </Button>
        </div>

        {/* ============================================================ */}
        {/* CREATE USER PANEL                                             */}
        {/* ============================================================ */}
        <Card className="shadow-xl border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <UserPlus className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">Create User</CardTitle>
                  <CardDescription>Directly provision a new user account with subscription — no approval required</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(v => !v)}
                data-testid="button-toggle-create-form"
              >
                {showCreateForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {showCreateForm ? 'Collapse' : 'New User'}
              </Button>
            </div>
          </CardHeader>

          {showCreateForm && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cu-email">Email *</Label>
                  <Input
                    id="cu-email"
                    type="email"
                    placeholder="user@company.com"
                    value={createForm.email}
                    onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                    data-testid="input-create-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cu-password">Password *</Label>
                  <Input
                    id="cu-password"
                    type="text"
                    placeholder="Temporary password"
                    value={createForm.password}
                    onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                    data-testid="input-create-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cu-fullname">Full Name *</Label>
                  <Input
                    id="cu-fullname"
                    placeholder="Jane Smith"
                    value={createForm.fullName}
                    onChange={e => setCreateForm(p => ({ ...p, fullName: e.target.value }))}
                    data-testid="input-create-fullname"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cu-company">Company</Label>
                  <Input
                    id="cu-company"
                    placeholder="Acme Corp"
                    value={createForm.company}
                    onChange={e => setCreateForm(p => ({ ...p, company: e.target.value }))}
                    data-testid="input-create-company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cu-title">Title</Label>
                  <Input
                    id="cu-title"
                    placeholder="Surveyor"
                    value={createForm.title}
                    onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
                    data-testid="input-create-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cu-phone">Phone</Label>
                  <Input
                    id="cu-phone"
                    placeholder="+1 555 000 0000"
                    value={createForm.phone}
                    onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))}
                    data-testid="input-create-phone"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="cu-address">Address</Label>
                  <Input
                    id="cu-address"
                    placeholder="123 Main St, City, Province"
                    value={createForm.address}
                    onChange={e => setCreateForm(p => ({ ...p, address: e.target.value }))}
                    data-testid="input-create-address"
                  />
                </div>

                {/* Subscription Tier */}
                <div className="space-y-2">
                  <Label>Subscription Tier *</Label>
                  <Select value={createForm.subscriptionTier} onValueChange={v => setCreateForm(p => ({ ...p, subscriptionTier: v }))}>
                    <SelectTrigger data-testid="select-create-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pro">PRO</SelectItem>
                      <SelectItem value="pro_plus">PRO+</SelectItem>
                      <SelectItem value="beta_tester">Beta Tester (restricted)</SelectItem>
                      <SelectItem value="lite">Lite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Add-ons */}
                <div className="space-y-2 md:col-span-2">
                  <Label>Enabled Add-ons</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ADDONS.map(addon => (
                      <div key={addon.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`cu-addon-${addon.id}`}
                          checked={createForm.enabledAddons.includes(addon.id)}
                          onChange={() => toggleCreateAddon(addon.id)}
                          className="w-4 h-4 rounded accent-green-600 cursor-pointer"
                          data-testid={`checkbox-create-addon-${addon.id}`}
                        />
                        <Label htmlFor={`cu-addon-${addon.id}`} className="font-normal cursor-pointer">{addon.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Welcome email */}
                <div className="flex items-center space-x-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="cu-welcome-email"
                    checked={createForm.sendWelcomeEmail}
                    onChange={e => setCreateForm(p => ({ ...p, sendWelcomeEmail: e.target.checked }))}
                    className="w-4 h-4 rounded accent-green-600 cursor-pointer"
                    data-testid="checkbox-create-welcome-email"
                  />
                  <Label htmlFor="cu-welcome-email" className="font-normal cursor-pointer">
                    Send welcome email to new user
                  </Label>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => createUserMutation.mutate()}
                  disabled={createUserMutation.isPending || !isFirebaseAdminAvailable || !createForm.email || !createForm.password || !createForm.fullName}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-create-user"
                >
                  {createUserMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                  ) : (
                    <><UserPlus className="h-4 w-4 mr-2" />Create User</>
                  )}
                </Button>
              </div>

              {!isFirebaseAdminAvailable && (
                <div className="mt-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-700 rounded p-3">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 font-semibold">
                    Firebase Admin SDK not available — set FIREBASE_SERVICE_ACCOUNT_KEY to enable user creation.
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ============================================================ */}
        {/* ALL USERS / SUBSCRIPTION CONTROL PANEL                        */}
        {/* ============================================================ */}
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Settings2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">All Users</CardTitle>
                  <CardDescription>Manage subscriptions and reset passwords for all users</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchUsers()}
                disabled={isLoadingUsers}
                data-testid="button-refresh-users"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            ) : allUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No users found.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Add-ons</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map(user => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                          {user.fullName}
                        </TableCell>
                        <TableCell data-testid={`text-useremail-${user.id}`}>{user.email}</TableCell>
                        <TableCell data-testid={`text-company-${user.id}`}>
                          {user.linkedCompanyName
                            ? <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{user.linkedCompanyName}</span>
                            : <span className="text-xs text-slate-400">—</span>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={user.subscriptionTier === 'pro_plus' ? 'default' : 'outline'}
                              className={user.subscriptionTier === 'beta_tester' ? 'border-yellow-500 text-yellow-500' : user.subscriptionTier === 'lite' ? 'border-gray-400 text-gray-400' : user.subscriptionTier === 'hardware_bundle' ? 'border-orange-500 text-orange-500' : ''}
                              data-testid={`badge-tier-${user.id}`}
                            >
                              {user.subscriptionTier === 'pro_plus' ? 'PRO+' :
                               user.subscriptionTier === 'pro' ? 'PRO' :
                               user.subscriptionTier === 'beta_tester' ? 'BETA' :
                               user.subscriptionTier === 'lite' ? 'LITE' :
                               user.subscriptionTier === 'hardware_bundle' ? 'HW BUNDLE' :
                               user.subscriptionTier || 'Unknown'}
                            </Badge>
                            {user.freeUntil && (
                              <span className={`text-xs ${new Date(user.freeUntil) < new Date() ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}
                                data-testid={`text-free-until-${user.id}`}>
                                {new Date(user.freeUntil) < new Date() ? '⚠ Trial expired' : '🆓 Free until'}{' '}
                                {new Date(user.freeUntil).toLocaleDateString()}
                              </span>
                            )}
                            {user.subscriptionEndDate && (
                              <span className={`text-xs ${new Date(user.subscriptionEndDate) < new Date() ? 'text-red-500' : 'text-slate-500'}`}
                                data-testid={`text-end-date-${user.id}`}>
                                {new Date(user.subscriptionEndDate) < new Date() ? '⛔ Expired' : '📅 Ends'}{' '}
                                {new Date(user.subscriptionEndDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1" data-testid={`text-addons-${user.id}`}>
                            {(user.activeAddonKeys || []).length === 0
                              ? <span className="text-xs text-slate-400">None</span>
                              : (user.activeAddonKeys || []).map(a => (
                                <Badge
                                  key={a}
                                  variant="secondary"
                                  className="text-xs cursor-help"
                                  title={user.nearestAddonExpiry
                                    ? `Nearest expiry: ${new Date(user.nearestAddonExpiry).toLocaleDateString()}`
                                    : undefined
                                  }
                                >
                                  {ADDON_DISPLAY_NAMES[a] || a}
                                </Badge>
                              ))
                            }
                            {user.nearestAddonExpiry && (user.activeAddonKeys || []).length > 0 && (
                              <span className="text-xs text-slate-500 ml-1" data-testid={`text-addon-expiry-${user.id}`}>
                                (exp. {new Date(user.nearestAddonExpiry).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={(user.accountStatus || user.status) === 'active' ? 'default' : 'destructive'}
                            data-testid={`badge-status-${user.id}`}
                          >
                            {user.accountStatus || user.status || 'unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCompanyDialog(user)}
                            data-testid={`button-company-${user.id}`}
                          >
                            <Building2 className="h-3 w-3 mr-1" />
                            Company
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenSubEdit(user)}
                            data-testid={`button-edit-sub-${user.id}`}
                          >
                            <Settings2 className="h-3 w-3 mr-1" />
                            Subscription
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResetPw(user)}
                            data-testid={`button-reset-pw-${user.id}`}
                          >
                            <KeyRound className="h-3 w-3 mr-1" />
                            Reset PW
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResendEmail(user)}
                            data-testid={`button-resend-email-${user.id}`}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Send Email
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* BETA ACCOUNT PANEL                                             */}
        {/* ============================================================ */}
        <Card className="shadow-xl border-blue-200 dark:border-blue-800">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Beta Test Account</CardTitle>
                <CardDescription>Create beta test account for restricted testing</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Beta Test Account</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Email: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">info@groupebellemare.com</code>
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Password: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">oversize</code>
                    </p>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    <p>Manual POI logging, GPS, Photos, Counter mode, Export</p>
                    <p>No: Calibration, AI+, Envelope, Convoy, Route, Swept Path, Admin, 3D, GNSS</p>
                  </div>
                </div>
                <Button
                  onClick={() => createBetaMutation.mutate()}
                  disabled={createBetaMutation.isPending || !isFirebaseAdminAvailable || isCheckingFirebase}
                  className="bg-blue-600 hover:bg-blue-700 shrink-0 disabled:opacity-50"
                  data-testid="button-create-beta"
                >
                  {createBetaMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                  ) : isCheckingFirebase ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</>
                  ) : (
                    <><UserPlus className="h-4 w-4 mr-2" />{isFirebaseAdminAvailable ? 'Create Account' : 'SDK Unavailable'}</>
                  )}
                </Button>
              </div>

              {!isFirebaseAdminAvailable && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-700 rounded p-3 mb-3">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-semibold">Automatic creation unavailable</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      Firebase Admin SDK not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or use manual creation.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 space-y-3">
                <details className="text-xs text-blue-600 dark:text-blue-400">
                  <summary className="cursor-pointer font-semibold hover:text-blue-800 dark:hover:text-blue-200">
                    Manual Creation Instructions
                  </summary>
                  <ol className="mt-2 space-y-1 list-decimal list-inside ml-2">
                    <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Firebase Console</a></li>
                    <li>Select your project → Authentication → Users</li>
                    <li>Add User: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">info@groupebellemare.com</code> / <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">oversize</code></li>
                    <li>Edit user and check "Email verified"</li>
                  </ol>
                </details>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* PENDING ACCOUNT APPROVALS                                      */}
        {/* ============================================================ */}
        <Card className="shadow-xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">Account Approvals</CardTitle>
                  <CardDescription>Review and approve pending user registrations</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoadingAccounts}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingAccounts ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAccounts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : pendingAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Pending Accounts</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">All account applications have been processed.</p>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAccounts.map((account) => (
                      <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                        <TableCell className="font-medium" data-testid={`text-name-${account.id}`}>{account.fullName}</TableCell>
                        <TableCell data-testid={`text-email-${account.id}`}>{account.email}</TableCell>
                        <TableCell data-testid={`text-company-${account.id}`}>{account.company || '-'}</TableCell>
                        <TableCell data-testid={`text-title-${account.id}`}>{account.title || '-'}</TableCell>
                        <TableCell data-testid={`text-phone-${account.id}`}>{account.phone || '-'}</TableCell>
                        <TableCell data-testid={`text-created-${account.id}`}>{new Date(account.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(account)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-approve-${account.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectClick(account)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-reject-${account.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* REJECT DIALOG                                                  */}
      {/* ============================================================ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>Reject Account Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject the application for <strong>{selectedAccount?.fullName}</strong>? The user will be notified via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason" className="text-sm font-medium">Reason (Optional)</Label>
            <Input
              id="rejection-reason"
              placeholder="Why is this application being rejected?"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              data-testid="input-rejection-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectionReason(''); setSelectedAccount(null); }} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm} disabled={rejectMutation.isPending} data-testid="button-confirm-reject">
              {rejectMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rejecting...</> : 'Reject Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* RESET PASSWORD DIALOG                                          */}
      {/* ============================================================ */}
      <Dialog open={showResetPwDialog} onOpenChange={(open) => {
        setShowResetPwDialog(open);
        if (!open) { setGeneratedTempPassword(null); setResetPwUser(null); }
      }}>
        <DialogContent data-testid="dialog-reset-password">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {generatedTempPassword
                ? `A temporary password has been generated for ${resetPwUser?.fullName}. Share it with the user — they must change it on next login.`
                : `Generate a temporary password for ${resetPwUser?.fullName} (${resetPwUser?.email}). The user will be prompted to change it on next login.`
              }
            </DialogDescription>
          </DialogHeader>
          {!generatedTempPassword && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-custom-password"
                  checked={useCustomPassword}
                  onChange={e => setUseCustomPassword(e.target.checked)}
                  data-testid="checkbox-use-custom-password"
                />
                <Label htmlFor="use-custom-password" className="cursor-pointer">
                  Set a specific temporary password (leave unchecked to auto-generate)
                </Label>
              </div>
              {useCustomPassword && (
                <div>
                  <Label htmlFor="admin-set-password">Temporary Password (min 6 chars)</Label>
                  <Input
                    id="admin-set-password"
                    type="text"
                    placeholder="Enter temporary password..."
                    value={adminSetPassword}
                    onChange={e => setAdminSetPassword(e.target.value)}
                    data-testid="input-admin-set-password"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}
          {generatedTempPassword && (
            <div className="space-y-3">
              <Label>Temporary Password (share with user):</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={generatedTempPassword}
                  className="font-mono text-lg tracking-wider"
                  data-testid="text-generated-password"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(generatedTempPassword); /* toast removed */ }}
                  data-testid="button-copy-password"
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-amber-600">This password is shown once. Make sure to copy it before closing.</p>
            </div>
          )}
          <DialogFooter>
            {generatedTempPassword ? (
              <Button onClick={() => { setShowResetPwDialog(false); setGeneratedTempPassword(null); setResetPwUser(null); setAdminSetPassword(''); setUseCustomPassword(false); }} data-testid="button-close-reset-pw">
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setShowResetPwDialog(false); setGeneratedTempPassword(null); setAdminSetPassword(''); setUseCustomPassword(false); }} data-testid="button-cancel-reset-pw">
                  Cancel
                </Button>
                <Button
                  onClick={() => resetPwMutation.mutate()}
                  disabled={resetPwMutation.isPending || (useCustomPassword && adminSetPassword.length < 6)}
                  data-testid="button-confirm-reset-pw"
                >
                  {resetPwMutation.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{useCustomPassword ? 'Setting...' : 'Generating...'}</>
                    : useCustomPassword ? 'Set Temporary Password' : 'Generate Temporary Password'
                  }
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* RESEND WELCOME EMAIL DIALOG                                     */}
      {/* ============================================================ */}
      <Dialog open={showResendEmailDialog} onOpenChange={open => {
        if (!open) { setShowResendEmailDialog(false); setResendEmailUser(null); setResendNewPassword(''); }
      }}>
        <DialogContent data-testid="dialog-resend-email">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Send Welcome Email
            </DialogTitle>
            <DialogDescription>
              Sending to: <strong>{resendEmailUser?.email}</strong> ({resendEmailUser?.fullName})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
              The welcome email includes login instructions and the MeasurePRO URL.
              Optionally enter a new temporary password below to include login credentials — leave blank to send without credentials.
            </div>
            <div>
              <Label htmlFor="resend-new-password">New Temporary Password (optional, min 6 chars)</Label>
              <Input
                id="resend-new-password"
                type="text"
                placeholder="Leave blank to send without credentials..."
                value={resendNewPassword}
                onChange={e => setResendNewPassword(e.target.value)}
                data-testid="input-resend-new-password"
                className="mt-1 font-mono"
              />
              {resendNewPassword.length > 0 && resendNewPassword.length < 6 && (
                <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters.</p>
              )}
              {resendNewPassword.length >= 6 && (
                <p className="text-xs text-amber-600 mt-1">The user's password will be reset to this value and they will be prompted to change it on next login.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowResendEmailDialog(false); setResendEmailUser(null); setResendNewPassword(''); }}
              data-testid="button-cancel-resend-email"
            >
              Cancel
            </Button>
            <Button
              onClick={() => resendEmailMutation.mutate()}
              disabled={resendEmailMutation.isPending || (resendNewPassword.length > 0 && resendNewPassword.length < 6)}
              data-testid="button-confirm-resend-email"
            >
              {resendEmailMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                : <><Mail className="mr-2 h-4 w-4" />Send Welcome Email</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* SUBSCRIPTION EDIT DIALOG                                       */}
      {/* ============================================================ */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent data-testid="dialog-edit-subscription">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Update the subscription tier and add-ons for <strong>{subEditUser?.fullName}</strong> ({subEditUser?.email}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select value={subTier} onValueChange={setSubTier}>
                <SelectTrigger data-testid="select-sub-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">PRO</SelectItem>
                  <SelectItem value="pro_plus">PRO+</SelectItem>
                  <SelectItem value="beta_tester">Beta Tester (restricted)</SelectItem>
                  <SelectItem value="lite">Lite</SelectItem>
                  <SelectItem value="hardware_bundle">Hardware Bundle</SelectItem>
                </SelectContent>
              </Select>
              {subTier === 'beta_tester' && (
                <p className="text-xs text-yellow-500 mt-1">
                  Beta Tester: blocks AI detection, convoy guardian, route enforcement, swept path, point cloud scanning, GNSS profiling, and admin access.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Enabled Add-ons</Label>
              <div className="grid grid-cols-2 gap-2">
                {ADDONS.map(addon => (
                  <div key={addon.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`sub-addon-${addon.id}`}
                      checked={subAddons.includes(addon.id)}
                      onChange={() => toggleSubAddon(addon.id)}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                      data-testid={`checkbox-sub-addon-${addon.id}`}
                    />
                    <Label htmlFor={`sub-addon-${addon.id}`} className="font-normal cursor-pointer">{addon.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* ---- Date limits ---- */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Access Limits (optional)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="sub-end-date" className="flex items-center gap-1">
                    Subscription End Date
                    <span className="text-xs text-slate-400 font-normal">(access expires)</span>
                  </Label>
                  <Input
                    id="sub-end-date"
                    type="date"
                    value={subEndDate}
                    onChange={e => setSubEndDate(e.target.value)}
                    data-testid="input-sub-end-date"
                    className="w-full"
                  />
                  {subEndDate && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-red-400 underline"
                      onClick={() => setSubEndDate('')}
                    >
                      Clear (no expiry)
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sub-free-until" className="flex items-center gap-1">
                    Free Until
                    <span className="text-xs text-slate-400 font-normal">(trial end date)</span>
                  </Label>
                  <Input
                    id="sub-free-until"
                    type="date"
                    value={subFreeUntil}
                    onChange={e => setSubFreeUntil(e.target.value)}
                    data-testid="input-sub-free-until"
                    className="w-full"
                  />
                  {subFreeUntil && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-red-400 underline"
                      onClick={() => setSubFreeUntil('')}
                    >
                      Clear (no trial limit)
                    </button>
                  )}
                </div>
              </div>
              {(subEndDate || subFreeUntil) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {subEndDate && subFreeUntil
                    ? 'Free trial ends on the "Free Until" date. Paid subscription expires on the "End Date".'
                    : subEndDate
                      ? 'Account access will expire on the end date.'
                      : 'Account has free trial access until the "Free Until" date.'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubDialog(false)} data-testid="button-cancel-sub-edit">
              Cancel
            </Button>
            <Button onClick={() => updateSubMutation.mutate()} disabled={updateSubMutation.isPending} data-testid="button-confirm-sub-edit">
              {updateSubMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* COMPANY & ADD-ONS ASSIGNMENT DIALOG                           */}
      {/* ============================================================ */}
      <Dialog open={showCompanyDialog} onOpenChange={open => {
        if (!open) { setShowCompanyDialog(false); setCompanyEditUser(null); }
      }}>
        <DialogContent className="max-w-xl" data-testid="dialog-company-assignment">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              Company & Add-on Assignment
            </DialogTitle>
            <DialogDescription>
              Assign <strong>{companyEditUser?.fullName}</strong> ({companyEditUser?.email}) to a company and grant per-user add-on access.
            </DialogDescription>
          </DialogHeader>

          {companyMembershipLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Company selector */}
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={selectedCompanyId} onValueChange={id => {
                  setSelectedCompanyId(id);
                  setAddonToggles({});
                  setAddonExpiries({});
                }}>
                  <SelectTrigger data-testid="select-company-assignment">
                    <SelectValue placeholder="Select a company…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanies.length === 0
                      ? <SelectItem value="__none__" disabled>No companies found</SelectItem>
                      : allCompanies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                {companyMembership && selectedCompanyId === companyMembership.companyId && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-green-600 border-green-500">Currently assigned</Badge>
                    <button
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => removeCompanyMutation.mutate(companyEditUser!.id)}
                      disabled={removeCompanyMutation.isPending}
                      data-testid="button-remove-company"
                    >
                      {removeCompanyMutation.isPending ? 'Removing…' : 'Remove from company'}
                    </button>
                  </div>
                )}
              </div>

              {/* Add-on toggles (only shown when a company is selected) */}
              {selectedCompanyId && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    Add-on Access
                  </Label>
                  {companyEnabledAddons.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">This company has no add-ons enabled. Enable add-ons for the company first.</p>
                  ) : (
                    <div className="space-y-3 overflow-y-auto max-h-[45vh] pr-1">
                      {companyEnabledAddons.map(addonKey => {
                        const label = ADDON_DISPLAY_NAMES[addonKey] || addonKey;
                        const enabled = addonToggles[addonKey] ?? false;
                        const expiry = addonExpiries[addonKey] ?? '';
                        const minDate = new Date();
                        minDate.setDate(minDate.getDate() + 1);
                        const minDateStr = minDate.toISOString().split('T')[0];
                        return (
                          <div key={addonKey} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2" data-testid={`addon-row-${addonKey}`}>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`assign-addon-${addonKey}`}
                                checked={enabled}
                                onChange={e => {
                                  setAddonToggles(prev => ({ ...prev, [addonKey]: e.target.checked }));
                                  if (!e.target.checked) {
                                    setAddonExpiries(prev => { const n = { ...prev }; delete n[addonKey]; return n; });
                                  }
                                }}
                                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                data-testid={`checkbox-assign-addon-${addonKey}`}
                              />
                              <Label htmlFor={`assign-addon-${addonKey}`} className="font-medium cursor-pointer">{label}</Label>
                            </div>
                            {enabled && (
                              <div className="ml-7 space-y-1">
                                <Label className="text-xs text-slate-500">Expiry date</Label>
                                <Input
                                  type="date"
                                  value={expiry}
                                  min={minDateStr}
                                  onChange={e => setAddonExpiries(prev => ({ ...prev, [addonKey]: e.target.value }))}
                                  className="w-full max-w-xs"
                                  data-testid={`input-addon-expiry-${addonKey}`}
                                />
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {[
                                    { label: '30 days', days: 30 },
                                    { label: '90 days', days: 90 },
                                    { label: '6 months', days: 180 },
                                    { label: '1 year', days: 365 },
                                  ].map(preset => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + preset.days);
                                    const v = d.toISOString().split('T')[0];
                                    return (
                                      <button
                                        key={preset.days}
                                        type="button"
                                        onClick={() => setAddonExpiries(prev => ({ ...prev, [addonKey]: v }))}
                                        className={`px-2 py-0.5 rounded text-xs transition-colors ${expiry === v ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                        data-testid={`button-addon-preset-${addonKey}-${preset.days}`}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompanyDialog(false)} data-testid="button-cancel-company-assignment">
              Cancel
            </Button>
            <Button
              onClick={handleSaveCompanyAssignment}
              disabled={assignCompanyMutation.isPending || !selectedCompanyId || !selectedCompany}
              title={selectedCompanyId && !selectedCompany ? 'Loading company details…' : undefined}
              data-testid="button-save-company-assignment"
            >
              {assignCompanyMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
