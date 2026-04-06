import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2, Users, ArrowLeft, Plus, Trash2, KeyRound, Shield,
  Edit2, Save, X, Loader2, RefreshCw, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { queryClient } from '../lib/queryClient';
import { authedRequest } from '../lib/authedFetch';
import { useAuth } from '../lib/auth/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOnlineRequired } from '../hooks/useOfflineQueue';
import { OfflineActionBanner } from '../components/OfflineActionBanner';
import { enqueuePendingAction, cacheCompany, cacheCompanyMembers, getCachedCompany, getCachedMembers } from '../lib/companyOfflineStore';
import type { Company, CompanyMember } from '../../shared/schema';

type Tab = 'profile' | 'members';

interface CompanyData {
  company: Company | null;
  membership: CompanyMember | null;
  members: CompanyMember[];
}

// Friendly display names for add-on keys
const ADDON_DISPLAY_NAMES: Record<string, string> = {
  gnss_profiling: 'GNSS Profiling',
  ai_detection: 'AI Detection',
  swept_path_analysis: 'Swept Path Analysis',
  envelope_clearance: 'Envelope Clearance',
  convoy_guardian: 'Convoy Guardian',
  route_enforcement: 'Route Enforcement',
  point_cloud_scanning: '3D Point Cloud',
  calibration: 'Calibration',
};

function getAddonLabel(key: string): string {
  return ADDON_DISPLAY_NAMES[key] ?? key;
}

interface MemberAccessPanelProps {
  member: CompanyMember;
  companyAddons: string[];
  companyId: string;
  isSelf: boolean;
}

function MemberAccessPanel({ member, companyAddons, companyId, isSelf }: MemberAccessPanelProps) {
  const [saving, setSaving] = useState(false);

  const updateAccessMutation = useMutation({
    mutationFn: async (updates: { allowedAddons?: string[] | null; betaAccess?: boolean | null }) => {
      return authedRequest(`/api/companies/${companyId}/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-company'] });
      toast.success('Member access updated');
      setSaving(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSaving(false);
    },
  });

  const handleAddonToggle = (addonKey: string, enabled: boolean) => {
    if (isSelf) return;
    setSaving(true);
    const currentAllowed = member.allowedAddons ?? companyAddons;
    const newAllowed = enabled
      ? Array.from(new Set([...currentAllowed, addonKey]))
      : currentAllowed.filter(a => a !== addonKey);
    const isAllAddons = companyAddons.every(a => newAllowed.includes(a)) && newAllowed.every(a => companyAddons.includes(a));
    updateAccessMutation.mutate({ allowedAddons: isAllAddons ? null : newAllowed });
  };

  const handleBetaToggle = (enabled: boolean) => {
    if (isSelf) return;
    setSaving(true);
    updateAccessMutation.mutate({ betaAccess: enabled ? true : null });
  };

  const effectiveAllowed = member.allowedAddons ?? companyAddons;

  if (companyAddons.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-gray-700 bg-gray-850">
        <p className="text-xs text-gray-500 italic">No add-ons are enabled for this company.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 border-t border-gray-700 bg-gray-850 space-y-4" data-testid={`panel-member-access-${member.id}`}>
      {isSelf && (
        <p className="text-xs text-yellow-400/80 italic">You cannot modify your own add-on access.</p>
      )}

      {/* Beta Mode */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-200">Beta Mode</span>
          <p className="text-xs text-gray-400 mt-0.5">Forces this member into the simplified beta UI</p>
        </div>
        <button
          onClick={() => handleBetaToggle(!(member.betaAccess === true))}
          disabled={isSelf || saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            member.betaAccess === true
              ? 'bg-amber-600/30 text-amber-300 border border-amber-600/40'
              : 'bg-gray-700 text-gray-400 border border-gray-600 hover:text-gray-200'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          data-testid={`toggle-beta-access-${member.id}`}
        >
          {member.betaAccess === true ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {member.betaAccess === true ? 'On' : 'Off'}
        </button>
      </div>

      {/* Add-on Toggles */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Add-on Access</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {companyAddons.map(addon => {
            const isEnabled = effectiveAllowed.includes(addon);
            return (
              <div
                key={addon}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                  isEnabled
                    ? 'bg-blue-900/20 border-blue-700/40'
                    : 'bg-gray-700/40 border-gray-600/40'
                }`}
              >
                <span className={`text-xs font-medium ${isEnabled ? 'text-blue-300' : 'text-gray-400'}`}>
                  {getAddonLabel(addon)}
                </span>
                <button
                  onClick={() => handleAddonToggle(addon, !isEnabled)}
                  disabled={isSelf || saving}
                  className={`flex-shrink-0 ml-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isEnabled ? 'text-blue-400 hover:text-blue-200' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title={isEnabled ? 'Disable add-on for this member' : 'Enable add-on for this member'}
                  data-testid={`toggle-addon-${addon}-${member.id}`}
                >
                  {isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}

export default function CompanyAdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { executeAction } = useOnlineRequired();
  const [tab, setTab] = useState<Tab>('profile');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<Company>>({});
  const [showCreateMember, setShowCreateMember] = useState(false);
  const [newMember, setNewMember] = useState({ email: '', fullName: '', role: 'member' as 'company_admin' | 'member' });
  const [resetPasswordTarget, setResetPasswordTarget] = useState<CompanyMember | null>(null);
  const [cachedData, setCachedData] = useState<{ company: Company | null; members: CompanyMember[] } | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Load cached data for offline access
  useEffect(() => {
    const loadCache = async () => {
      if (!user?.uid) return;
      try {
        const { getUserCompanyMembership } = await import('../lib/companyOfflineStore');
        const membership = await getUserCompanyMembership(user.uid);
        if (membership) {
          setMembershipRole(membership.role);
          const company = await getCachedCompany(membership.companyId);
          const members = await getCachedMembers(membership.companyId);
          setCachedData({ company, members });
        }
      } catch {
        // Ignore
      }
    };
    loadCache();
  }, [user?.uid]);

  const { data, isLoading, refetch } = useQuery<CompanyData>({
    queryKey: ['/api/my-company'],
    enabled: !!user,
    queryFn: async () => {
      const json = await authedRequest<{ success: boolean; company: Company | null; membership: CompanyMember | null; members: CompanyMember[] }>('/api/my-company');
      return { company: json.company, membership: json.membership, members: json.members };
    },
  });

  // Cache data when fetched
  useEffect(() => {
    if (data?.company) {
      cacheCompany(data.company);
      if (data.members?.length) {
        cacheCompanyMembers(data.members);
      }
      setMembershipRole(data.membership?.role || null);
    }
  }, [data]);

  const company = data?.company || cachedData?.company || null;
  const membership = data?.membership || null;
  const members = data?.members || cachedData?.members || [];
  const companyId = company?.id;
  const companyAddons = company?.enabledAddons ?? [];

  // Check access
  const hasAccess = membership?.role === 'company_admin' || membershipRole === 'company_admin';

  // Update company profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Company>) => {
      if (!companyId) throw new Error('No company');
      return authedRequest(`/api/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(updates) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-company'] });
      toast.success('Company profile updated');
      setEditingProfile(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveProfile = async () => {
    if (!companyId) return;
    if (!isOnline) {
      await enqueuePendingAction({ type: 'update_company', companyId, payload: profileForm as Record<string, unknown> });
      toast.success('Changes queued — will sync when online');
      setEditingProfile(false);
      return;
    }
    updateProfileMutation.mutate(profileForm);
  };

  // Create member mutation
  const createMemberMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company');
      return authedRequest(`/api/companies/${companyId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          email: newMember.email,
          fullName: newMember.fullName,
          role: newMember.role,
          firebaseUid: `pending-${Date.now()}`,
          createFirebaseAccount: true,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-company'] });
      toast.success('User created — a password set-up email has been sent to them');
      setShowCreateMember(false);
      setNewMember({ email: '', fullName: '', role: 'member' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCreateMember = async () => {
    if (!newMember.email || !newMember.fullName) {
      toast.error('Email and full name are required');
      return;
    }
    if (!isOnline) {
      if (!companyId) return;
      await enqueuePendingAction({
        type: 'create_member',
        companyId,
        payload: {
          companyId,
          email: newMember.email,
          fullName: newMember.fullName,
          role: newMember.role,
          createFirebaseAccount: true,
          pendingSync: true,
        },
      });
      toast.info('User creation queued', {
        description: 'Will be created automatically when you reconnect. The new user will receive a password reset email.',
        duration: 6000,
      });
      setShowCreateMember(false);
      setNewMember({ email: '', fullName: '', role: 'member' });
      return;
    }
    createMemberMutation.mutate();
  };

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!companyId) throw new Error('No company');
      return authedRequest(`/api/companies/${companyId}/members/${memberId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-company'] });
      toast.success('User removed from company');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDeleteMember = async (member: CompanyMember) => {
    if (!companyId) return;
    await executeAction(
      { type: 'delete_member', companyId, payload: { memberId: member.id } },
      async () => { await deleteMemberMutation.mutateAsync(member.id); }
    );
  };

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      if (!companyId) throw new Error('No company');
      return authedRequest(`/api/companies/${companyId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-company'] });
      toast.success('Role updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleRoleChange = async (member: CompanyMember, newRole: 'company_admin' | 'member') => {
    if (!companyId) return;
    if (!isOnline) {
      await enqueuePendingAction({ type: 'update_member_role', companyId, payload: { memberId: member.id, role: newRole } });
      toast.success('Role change queued — will apply when online');
      return;
    }
    changeRoleMutation.mutate({ memberId: member.id, role: newRole });
  };

  // Send password reset link mutation
  const sendResetEmailMutation = useMutation({
    mutationFn: async ({ uid }: { uid: string }) => {
      if (!companyId) throw new Error('No company');
      return authedRequest(`/api/companies/${companyId}/members/${uid}/send-reset-link`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast.success('Password reset email sent', {
        description: 'The user will receive an email with a link to set their password.',
        duration: 5000,
      });
      setResetPasswordTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSendResetEmail = async () => {
    if (!resetPasswordTarget || !companyId) return;
    if (!isOnline) {
      await enqueuePendingAction({
        type: 'send_reset_email',
        companyId,
        payload: {
          uid: resetPasswordTarget.firebaseUid,
          memberName: resetPasswordTarget.fullName,
          memberEmail: resetPasswordTarget.email,
        },
      });
      toast.info('Password reset queued', {
        description: 'A reset email will be sent to the user automatically when you reconnect.',
        duration: 6000,
      });
      setResetPasswordTarget(null);
      return;
    }
    sendResetEmailMutation.mutate({ uid: resetPasswordTarget.firebaseUid });
  };

  // Loading state
  if (isLoading && !cachedData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // No company
  if (!company && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">No Company Found</h2>
          <p className="text-gray-400 text-sm mb-6">
            You are not associated with any company. Contact your app administrator.
          </p>
          <button onClick={() => navigate('/app')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
            Back to App
          </button>
        </div>
      </div>
    );
  }

  // No access
  if (!hasAccess && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm mb-6">
            You need Company Admin privileges to access this portal.
          </p>
          <button onClick={() => navigate('/app')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
            Back to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm"
            data-testid="button-back-to-app-company-admin"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <span className="text-lg font-semibold text-gray-100">{company?.name || 'Company Admin'}</span>
            <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full">Company Admin</span>
          </div>
        </div>
        <button onClick={() => refetch()} className="p-2 text-gray-400 hover:text-white" title="Refresh" data-testid="button-refresh-company">
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <OfflineActionBanner
        show={!isOnline}
        message="You are offline. Changes will be saved locally and applied when you reconnect."
      />

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex px-4">
          <button
            onClick={() => setTab('profile')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'profile' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            data-testid="tab-company-profile"
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Company Profile
          </button>
          <button
            onClick={() => setTab('members')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'members' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            data-testid="tab-team-members"
          >
            <Users className="w-4 h-4 inline mr-2" />
            Team Members
            <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">{members.length}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="p-6 max-w-4xl mx-auto">
        {/* Profile Tab */}
        {tab === 'profile' && company && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-100">Company Profile</h2>
              {!editingProfile ? (
                <button
                  onClick={() => { setEditingProfile(true); setProfileForm(company); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  data-testid="button-edit-company-profile"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                    data-testid="button-cancel-edit-profile"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-sm"
                    data-testid="button-save-company-profile"
                  >
                    <Save className="w-4 h-4" />
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  { key: 'name' as keyof Company, label: 'Company Name', required: true },
                  { key: 'email' as keyof Company, label: 'Email', type: 'email' },
                  { key: 'phone' as keyof Company, label: 'Phone' },
                  { key: 'website' as keyof Company, label: 'Website' },
                  { key: 'address' as keyof Company, label: 'Address' },
                  { key: 'city' as keyof Company, label: 'City' },
                  { key: 'province' as keyof Company, label: 'Province / State' },
                  { key: 'country' as keyof Company, label: 'Country' },
                ] as { key: keyof Company; label: string; required?: boolean; type?: string }[]
              ).map(field => (
                <div key={field.key} className={field.key === 'address' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{field.label}</label>
                  {editingProfile ? (
                    <input
                      type={field.type || 'text'}
                      value={(profileForm[field.key] as string) || ''}
                      onChange={e => setProfileForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                      data-testid={`input-profile-${field.key}`}
                    />
                  ) : (
                    <p className="text-gray-100 text-sm py-2" data-testid={`text-profile-${field.key}`}>
                      {(company[field.key] as string) || <span className="text-gray-500">—</span>}
                    </p>
                  )}
                </div>
              ))}

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">Notes</label>
                {editingProfile ? (
                  <textarea
                    value={profileForm.notes || ''}
                    onChange={e => setProfileForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                    data-testid="input-profile-notes"
                  />
                ) : (
                  <p className="text-gray-100 text-sm py-2" data-testid="text-profile-notes">
                    {company.notes || <span className="text-gray-500">—</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Enabled Add-ons (read-only for company admins) */}
            {company.enabledAddons && company.enabledAddons.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Enabled Add-ons</h3>
                <div className="flex flex-wrap gap-2">
                  {company.enabledAddons.map(addon => (
                    <span key={addon} className="px-2 py-1 text-xs bg-blue-900/40 text-blue-300 rounded-lg border border-blue-700/30">
                      {getAddonLabel(addon)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {tab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-100">Team Members</h2>
              <button
                onClick={() => setShowCreateMember(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                data-testid="button-add-member"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
            </div>

            {/* Create Member Form */}
            {showCreateMember && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">New User</h3>
                  <button onClick={() => setShowCreateMember(false)} className="text-gray-400 hover:text-gray-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <OfflineActionBanner
                  show={!isOnline}
                  message="Creating this user requires internet. The action will be queued and applied when you reconnect."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Email *</label>
                    <input
                      type="email"
                      value={newMember.email}
                      onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                      placeholder="user@company.com"
                      data-testid="input-new-member-email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Full Name *</label>
                    <input
                      value={newMember.fullName}
                      onChange={e => setNewMember(p => ({ ...p, fullName: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                      placeholder="Jane Smith"
                      data-testid="input-new-member-fullname"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
                    <select
                      value={newMember.role}
                      onChange={e => setNewMember(p => ({ ...p, role: e.target.value as 'company_admin' | 'member' }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                      data-testid="select-new-member-role"
                    >
                      <option value="member">Member</option>
                      <option value="company_admin">Company Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowCreateMember(false)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm" data-testid="button-cancel-create-member">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateMember}
                    disabled={createMemberMutation.isPending}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-sm"
                    data-testid="button-submit-create-member"
                  >
                    {createMemberMutation.isPending ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {members.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">No team members yet. Add one above.</div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {members.map(member => {
                    const isSelf = member.firebaseUid === user?.uid;
                    const isExpanded = expandedMember === member.id;
                    const hasRestrictions = member.allowedAddons !== null && member.allowedAddons !== undefined;
                    const isBetaForced = member.betaAccess === true;

                    return (
                      <div key={member.id} data-testid={`row-member-${member.id}`}>
                        {/* Member Row */}
                        <div className="flex items-center px-4 py-3 hover:bg-gray-700/30 transition-colors">
                          {/* Expand toggle */}
                          <button
                            onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                            className="p-1 text-gray-500 hover:text-gray-300 mr-2 flex-shrink-0"
                            title={isExpanded ? 'Collapse settings' : 'Expand access settings'}
                            data-testid={`button-expand-member-${member.id}`}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>

                          {/* Name & status badges */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-100 font-medium" data-testid={`text-member-name-${member.id}`}>
                                {member.fullName}
                              </span>
                              {isBetaForced && (
                                <span className="text-xs px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded border border-amber-700/30">
                                  Beta Mode
                                </span>
                              )}
                              {hasRestrictions && (
                                <span className="text-xs px-1.5 py-0.5 bg-gray-700/60 text-gray-400 rounded border border-gray-600/40">
                                  Restricted Add-ons
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{member.email}</p>
                          </div>

                          {/* Role selector */}
                          <div className="flex-shrink-0 mx-3">
                            <select
                              value={member.role}
                              onChange={e => handleRoleChange(member, e.target.value as 'company_admin' | 'member')}
                              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200"
                              disabled={isSelf}
                              data-testid={`select-member-role-${member.id}`}
                            >
                              <option value="member">Member</option>
                              <option value="company_admin">Company Admin</option>
                            </select>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => setResetPasswordTarget(member)}
                              className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded"
                              title="Send password reset email"
                              data-testid={`button-reset-password-${member.id}`}
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                              className="p-1.5 text-gray-400 hover:bg-gray-700 rounded"
                              title="Access settings"
                              data-testid={`button-access-settings-${member.id}`}
                            >
                              <Settings2 className="w-4 h-4" />
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleDeleteMember(member)}
                                disabled={deleteMemberMutation.isPending}
                                className="p-1.5 text-red-400 hover:bg-red-900/30 rounded"
                                title="Remove from company"
                                data-testid={`button-delete-member-${member.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable access panel */}
                        {isExpanded && companyId && (
                          <MemberAccessPanel
                            member={member}
                            companyAddons={companyAddons}
                            companyId={companyId}
                            isSelf={isSelf}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Send Password Reset Email Dialog */}
            {resetPasswordTarget && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl max-w-sm w-full p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-100">Send Password Reset</h4>
                    <button onClick={() => setResetPasswordTarget(null)} className="text-gray-400 hover:text-gray-200">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Send a password reset email to <span className="text-gray-200 font-medium">{resetPasswordTarget.fullName}</span> ({resetPasswordTarget.email}).
                    They will receive a secure link to set their own password.
                  </p>
                  <OfflineActionBanner
                    show={!isOnline}
                    message="The reset email will be sent automatically when you reconnect."
                  />
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => setResetPasswordTarget(null)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm" data-testid="button-cancel-reset-password">
                      Cancel
                    </button>
                    <button
                      onClick={handleSendResetEmail}
                      disabled={sendResetEmailMutation.isPending}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-sm"
                      data-testid="button-confirm-reset-password"
                    >
                      {sendResetEmailMutation.isPending ? 'Sending...' : (!isOnline ? 'Queue Reset Email' : 'Send Reset Email')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
