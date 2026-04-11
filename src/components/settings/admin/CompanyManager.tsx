import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2, Trash2, Package, UserCheck, X, Search, Loader2, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { insertCompanySchema, type Company, type InsertCompany, type CompanyMember } from '../../../../shared/schema';
import { queryClient } from '../../../lib/queryClient';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useOnlineRequired } from '../../../hooks/useOfflineQueue';
import { OfflineActionBanner } from '../../OfflineActionBanner';
import { getAuth } from 'firebase/auth';
import { enqueuePendingAction, getPendingActionsForUser } from '../../../lib/companyOfflineStore';
import { authedRequest } from '../../../lib/authedFetch';

const COMPANY_ADDONS = [
  { id: 'ai_plus', label: 'AI+' },
  { id: 'envelope', label: 'Envelope Analysis' },
  { id: 'convoy', label: 'Convoy Mode' },
  { id: 'route_analysis', label: 'Route Analysis' },
  { id: 'swept_path', label: 'Swept Path' },
  { id: 'calibration', label: 'Calibration' },
  { id: '3d_view', label: '3D View' },
  { id: 'gnss', label: 'GNSS' },
];

type ActiveDialog = null | 'edit' | 'delete' | 'addons' | 'designate' | 'create_user' | 'members';


const CompanyManager: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const { executeAction } = useOnlineRequired();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [designateEmail, setDesignateEmail] = useState('');
  const [designateFullName, setDesignateFullName] = useState('');
  const [designateUid, setDesignateUid] = useState('');
  const [designateRole, setDesignateRole] = useState<'company_admin' | 'member'>('company_admin');
  const [designateLookupLoading, setDesignateLookupLoading] = useState(false);
  const [designateLookupError, setDesignateLookupError] = useState<string | null>(null);
  // Create User (new Firebase account) state
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserFullName, setCreateUserFullName] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserRole, setCreateUserRole] = useState<'company_admin' | 'member'>('member');
  const [addonEditing, setAddonEditing] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const currentUid = getAuth().currentUser?.uid;
      const actions = await getPendingActionsForUser(currentUid);
      const active = actions.filter(a => a.status !== 'flushed');
      setPendingCount(active.length);
    } catch {}
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const { data: companiesData, isLoading, isError, error, refetch } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const json = await authedRequest<{ success: boolean; companies: Company[] }>('/api/companies');
      return json.companies;
    },
    staleTime: 0,
    retry: 1,
  });

  const companies = Array.isArray(companiesData) ? companiesData : [];

  const form = useForm<InsertCompany>({
    resolver: zodResolver(insertCompanySchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      province: '',
      country: '',
      phone: '',
      email: '',
      website: '',
      notes: '',
      enabledAddons: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCompany) =>
      authedRequest<{ success: boolean; company: Company }>('/api/companies', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setActiveDialog(null);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create company'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCompany> }) =>
      authedRequest<{ success: boolean; company: Company }>(`/api/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setActiveDialog(null);
      setEditingCompany(null);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update company'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      authedRequest(`/api/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setDeleteConfirmId(null);
      setActiveDialog(null);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete company'),
  });

  const addonsMutation = useMutation({
    mutationFn: async ({ id, enabledAddons }: { id: string; enabledAddons: string[] }) =>
      authedRequest(`/api/companies/${id}/addons`, {
        method: 'POST',
        body: JSON.stringify({ enabledAddons }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setActiveDialog(null);
      // Notify active sessions that company add-ons changed.
      // Custom event covers the current tab; BroadcastChannel covers other open tabs.
      window.dispatchEvent(new CustomEvent('company-addons-changed'));
      try {
        const bc = new BroadcastChannel('company-addons-changed');
        bc.postMessage('changed');
        bc.close();
      } catch { /* BroadcastChannel not available in all environments */ }
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update add-ons'),
  });

  const designateMutation = useMutation({
    mutationFn: async ({ companyId, email, fullName, firebaseUid, role }: {
      companyId: string;
      email: string;
      fullName: string;
      firebaseUid: string;
      role: 'company_admin' | 'member';
    }) =>
      authedRequest<{ success: boolean; member: CompanyMember }>(`/api/companies/${companyId}/members`, {
        method: 'POST',
        body: JSON.stringify({ companyId, email, fullName, firebaseUid, role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setActiveDialog(null);
      setDesignateEmail('');
      setDesignateFullName('');
      setDesignateUid('');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add member'),
  });

  const createUserMutation = useMutation({
    mutationFn: async ({ companyId, email, fullName, password, role }: {
      companyId: string;
      email: string;
      fullName: string;
      password: string;
      role: 'company_admin' | 'member';
    }) =>
      authedRequest<{ success: boolean; member: CompanyMember }>(`/api/companies/${companyId}/members`, {
        method: 'POST',
        body: JSON.stringify({ companyId, email, fullName, password, role, createFirebaseAccount: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setActiveDialog(null);
      setCreateUserEmail('');
      setCreateUserFullName('');
      setCreateUserPassword('');
      setCreateUserRole('member');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create user'),
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<CompanyMember[]>({
    queryKey: ['/api/companies', selectedCompany?.id, 'members'],
    queryFn: async () => {
      const json = await authedRequest<{ success: boolean; members: CompanyMember[] }>(
        `/api/companies/${selectedCompany!.id}/members`
      );
      return json.members;
    },
    enabled: activeDialog === 'members' && !!selectedCompany?.id,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ companyId, memberId }: { companyId: string; memberId: string }) =>
      authedRequest(`/api/companies/${companyId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', selectedCompany?.id, 'members'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to remove member'),
  });

  /** Enqueue an offline action (userUid auto-tagged by enqueuePendingAction), then refresh count */
  const enqueue = useCallback(async (action: Parameters<typeof enqueuePendingAction>[0]) => {
    await enqueuePendingAction(action);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const handleAdd = () => {
    setEditingCompany(null);
    form.reset({ name: '', address: '', city: '', province: '', country: '', phone: '', email: '', website: '', notes: '', enabledAddons: [] });
    setActiveDialog('edit');
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    form.reset({
      name: company.name,
      address: company.address || '',
      city: company.city || '',
      province: company.province || '',
      country: company.country || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      notes: company.notes || '',
      enabledAddons: company.enabledAddons || [],
    });
    setActiveDialog('edit');
  };

  const handleSubmit = async (data: InsertCompany) => {
    if (!isOnline) {
      if (editingCompany) {
        await enqueue({ type: 'update_company', companyId: editingCompany.id, payload: { ...data, pendingSync: true } as Record<string, unknown> });
      } else {
        await enqueue({ type: 'create_company', companyId: 'pending', payload: { ...data, pendingSync: true } as Record<string, unknown> });
      }
      setActiveDialog(null);
      form.reset();
      return;
    }
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = async (id: string) => {
    const { blocked } = await executeAction(
      { type: 'delete_company', companyId: id, payload: {} },
      async () => { await deleteMutation.mutateAsync(id); }
    );
    if (!blocked) setDeleteConfirmId(null);
  };

  const handleOpenAddons = (company: Company) => {
    setSelectedCompany(company);
    setAddonEditing(company.enabledAddons || []);
    setActiveDialog('addons');
  };

  const handleSaveAddons = async () => {
    if (!selectedCompany) return;
    if (!isOnline) {
      await enqueue({ type: 'update_addons', companyId: selectedCompany.id, payload: { enabledAddons: addonEditing } });
      setActiveDialog(null);
      return;
    }
    addonsMutation.mutate({ id: selectedCompany.id, enabledAddons: addonEditing });
  };

  /** Search for an existing Firebase user by email and auto-populate their UID */
  const handleLookupUser = async () => {
    if (!designateEmail) {
      setDesignateLookupError('Enter an email to search');
      return;
    }
    setDesignateLookupLoading(true);
    setDesignateLookupError(null);
    try {
      const result = await authedRequest<{ success: boolean; users: { uid: string; email: string; displayName?: string }[] }>(
        `/api/companies/users/lookup?query=${encodeURIComponent(designateEmail)}`
      );
      const found = result.users?.[0];
      if (found) {
        setDesignateUid(found.uid);
        if (!designateFullName && found.displayName) {
          setDesignateFullName(found.displayName);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'User not found';
      setDesignateLookupError(msg);
    } finally {
      setDesignateLookupLoading(false);
    }
  };

  const handleOpenMembers = (company: Company) => {
    setSelectedCompany(company);
    setActiveDialog('members');
  };

  const handleOpenDesignate = (company: Company) => {
    setSelectedCompany(company);
    setDesignateEmail('');
    setDesignateFullName('');
    setDesignateUid('');
    setDesignateRole('company_admin');
    setDesignateLookupError(null);
    setActiveDialog('designate');
  };

  const handleOpenCreateUser = (company: Company) => {
    setSelectedCompany(company);
    setCreateUserEmail('');
    setCreateUserFullName('');
    setCreateUserPassword('');
    setCreateUserRole('member');
    setActiveDialog('create_user');
  };

  const handleCreateUser = () => {
    if (!selectedCompany) return;
    if (!isOnline) {
      toast.error('An internet connection is required to create a new user account');
      return;
    }
    if (!createUserEmail || !createUserFullName || !createUserPassword) {
      toast.error('Email, full name, and password are required');
      return;
    }
    createUserMutation.mutate({
      companyId: selectedCompany.id,
      email: createUserEmail,
      fullName: createUserFullName,
      password: createUserPassword,
      role: createUserRole,
    });
  };

  const handleDesignate = async () => {
    if (!selectedCompany) return;
    if (!designateEmail || !designateFullName || !designateUid) {
      toast.error('Email, full name, and Firebase UID are required');
      return;
    }
    if (!isOnline) {
      await enqueue({
        type: 'create_member',
        companyId: selectedCompany.id,
        payload: {
          companyId: selectedCompany.id,
          email: designateEmail,
          fullName: designateFullName,
          firebaseUid: designateUid,
          role: designateRole,
          createFirebaseAccount: false,
          pendingSync: true,
        },
      });
      setActiveDialog(null);
      setDesignateEmail('');
      setDesignateFullName('');
      setDesignateUid('');
      return;
    }
    designateMutation.mutate({
      companyId: selectedCompany.id,
      email: designateEmail,
      fullName: designateFullName,
      firebaseUid: designateUid,
      role: designateRole,
    });
  };

  const toggleAddon = (id: string) => {
    setAddonEditing(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setEditingCompany(null);
    setSelectedCompany(null);
    setDeleteConfirmId(null);
    form.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Company Management</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          data-testid="button-add-company"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </button>
      </div>

      <OfflineActionBanner
        show={!isOnline}
        message={
          pendingCount > 0
            ? `You are offline. ${pendingCount} action(s) queued — will sync when you reconnect.`
            : 'You are offline. Actions will be queued and synced when you reconnect.'
        }
      />

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Company</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Contact</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Add-ons</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading companies...
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                      <div className="text-red-400 font-medium">Failed to load companies</div>
                      <div className="text-xs text-gray-500 max-w-md text-center">
                        {(error as Error)?.message || 'Unknown error'}
                      </div>
                      <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        data-testid="button-retry-companies"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No companies found. Add one to get started.</td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="border-b border-gray-700 hover:bg-gray-700/50" data-testid={`row-company-${company.id}`}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-100" data-testid={`text-company-name-${company.id}`}>{company.name}</div>
                      {company.email && <div className="text-xs text-gray-400">{company.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {[company.city, company.province, company.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {company.phone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(company.enabledAddons || []).slice(0, 3).map(addon => (
                          <span key={addon} className="px-1.5 py-0.5 text-xs bg-blue-900/40 text-blue-300 rounded">
                            {COMPANY_ADDONS.find(a => a.id === addon)?.label || addon}
                          </span>
                        ))}
                        {(company.enabledAddons || []).length > 3 && (
                          <span className="text-xs text-gray-400">+{(company.enabledAddons || []).length - 3}</span>
                        )}
                        {(!company.enabledAddons || company.enabledAddons.length === 0) && (
                          <span className="text-xs text-gray-500">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(company)}
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded"
                          title="Edit company"
                          data-testid={`button-edit-company-${company.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenAddons(company)}
                          className="p-1.5 text-purple-400 hover:bg-purple-900/30 rounded"
                          title="Manage add-ons"
                          data-testid={`button-addons-company-${company.id}`}
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenCreateUser(company)}
                          className="p-1.5 text-yellow-400 hover:bg-yellow-900/30 rounded"
                          title="Create new user account for this company"
                          data-testid={`button-create-user-company-${company.id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenMembers(company)}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded"
                          title="View all members"
                          data-testid={`button-members-company-${company.id}`}
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDesignate(company)}
                          className="p-1.5 text-green-400 hover:bg-green-900/30 rounded"
                          title="Add existing user to company"
                          data-testid={`button-designate-company-${company.id}`}
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(company.id)}
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded"
                          title="Delete company"
                          data-testid={`button-delete-company-${company.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Dialog */}
      {activeDialog === 'edit' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-100">
                {editingCompany ? 'Edit Company' : 'Add Company'}
              </h4>
              <button onClick={closeDialog} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Company Name *</label>
                <input
                  {...form.register('name')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  placeholder="Acme Corp"
                  data-testid="input-company-name"
                />
                {form.formState.errors.name && (
                  <p className="text-red-400 text-xs mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                  <input {...form.register('address')} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" placeholder="123 Main St" data-testid="input-company-address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                  <input {...form.register('city')} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" placeholder="Toronto" data-testid="input-company-city" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Province / State</label>
                  <input {...form.register('province')} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" placeholder="ON" data-testid="input-company-province" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                  <input {...form.register('country')} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" placeholder="Canada" data-testid="input-company-country" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input {...form.register('phone')} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" placeholder="+1 555 000 0000" data-testid="input-company-phone" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input {...form.register('email')} type="email" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" placeholder="info@company.com" data-testid="input-company-email" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
                <input {...form.register('website')} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" placeholder="https://company.com" data-testid="input-company-website" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <textarea {...form.register('notes')} rows={2} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100" data-testid="input-company-notes" />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  data-testid="button-cancel-company"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
                  data-testid="button-submit-company"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : (!isOnline ? 'Queue Offline' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-sm w-full p-6 border border-gray-700">
            <h4 className="text-lg font-semibold text-gray-100 mb-2">Delete Company</h4>
            <p className="text-gray-400 text-sm mb-4">
              {isOnline
                ? 'Are you sure you want to permanently delete this company and all its members?'
                : 'You are offline. The deletion will be queued and applied when you reconnect.'}
            </p>
            <div className="flex gap-3">
              <button onClick={closeDialog} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg" data-testid="button-cancel-delete">Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? 'Deleting...' : (!isOnline ? 'Queue Delete' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Dialog */}
      {activeDialog === 'members' && selectedCompany && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 border border-gray-700 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-100">Members — {selectedCompany.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {membersLoading ? 'Loading…' : `${(Array.isArray(membersData) ? membersData : []).length} member${(Array.isArray(membersData) ? membersData : []).length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button onClick={closeDialog} className="text-gray-400 hover:text-gray-200" data-testid="button-close-members">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {membersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : (Array.isArray(membersData) ? membersData : []).length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No members yet.</p>
                  <p className="text-xs mt-1">Use the + or ✓ buttons on the company row to add members.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Email</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Role</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium w-16">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(membersData) ? membersData : []).map((member) => (
                      <tr key={member.id} className="border-t border-gray-700 hover:bg-gray-700/40" data-testid={`row-member-${member.id}`}>
                        <td className="px-3 py-2.5 text-gray-100 font-medium">{member.fullName || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-300">{member.email}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            member.role === 'company_admin'
                              ? 'bg-purple-900/50 text-purple-300'
                              : 'bg-gray-700 text-gray-300'
                          }`}>
                            {member.role === 'company_admin' ? 'Admin' : 'Member'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => removeMemberMutation.mutate({ companyId: selectedCompany.id, memberId: member.id })}
                            disabled={removeMemberMutation.isPending}
                            className="p-1 text-red-400 hover:bg-red-900/30 rounded disabled:opacity-40"
                            title="Remove from company"
                            data-testid={`button-remove-member-${member.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-700 mt-4">
              <button
                onClick={() => { closeDialog(); handleOpenCreateUser(selectedCompany); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-600/30 rounded-lg text-sm transition-colors"
                data-testid="button-members-create-user"
              >
                <Plus className="w-3.5 h-3.5" />
                Create new user
              </button>
              <button
                onClick={() => { closeDialog(); handleOpenDesignate(selectedCompany); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-600/30 rounded-lg text-sm transition-colors"
                data-testid="button-members-add-existing"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Add existing user
              </button>
              <button onClick={closeDialog} className="ml-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm" data-testid="button-close-members-footer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add-ons Dialog */}
      {activeDialog === 'addons' && selectedCompany && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-100">Manage Add-ons — {selectedCompany.name}</h4>
              <button onClick={closeDialog} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {COMPANY_ADDONS.map(addon => (
                <label key={addon.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600" data-testid={`checkbox-addon-${addon.id}`}>
                  <input
                    type="checkbox"
                    checked={addonEditing.includes(addon.id)}
                    onChange={() => toggleAddon(addon.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-200">{addon.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={closeDialog} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg" data-testid="button-cancel-addons">Cancel</button>
              <button
                onClick={handleSaveAddons}
                disabled={addonsMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg"
                data-testid="button-save-addons"
              >
                {addonsMutation.isPending ? 'Saving...' : (!isOnline ? 'Queue Save' : 'Save Add-ons')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member / Designate Admin Dialog */}
      {activeDialog === 'designate' && selectedCompany && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-100">Add Member — {selectedCompany.name}</h4>
              <button onClick={closeDialog} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-xs mb-3">
              Enter a user's email to look them up and automatically fill their Firebase UID. You can also enter the UID manually.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={designateEmail}
                    onChange={e => { setDesignateEmail(e.target.value); setDesignateLookupError(null); }}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                    placeholder="user@company.com"
                    data-testid="input-designate-email"
                  />
                  <button
                    type="button"
                    onClick={handleLookupUser}
                    disabled={designateLookupLoading || !isOnline}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 rounded-lg text-sm flex items-center gap-1"
                    title={!isOnline ? 'User lookup requires an internet connection' : 'Search by email'}
                    data-testid="button-lookup-user"
                  >
                    {designateLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
                {designateLookupError && (
                  <p className="text-red-400 text-xs mt-1">{designateLookupError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                <input
                  value={designateFullName}
                  onChange={e => setDesignateFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  placeholder="Jane Smith"
                  data-testid="input-designate-fullname"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Firebase UID *</label>
                <input
                  value={designateUid}
                  onChange={e => setDesignateUid(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 font-mono text-sm"
                  placeholder="Auto-filled by email search or enter manually"
                  data-testid="input-designate-uid"
                />
                {designateUid && (
                  <p className="text-green-400 text-xs mt-1">✓ UID resolved</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={designateRole}
                  onChange={e => setDesignateRole(e.target.value as 'company_admin' | 'member')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="select-designate-role"
                >
                  <option value="company_admin">Company Admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={closeDialog} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg" data-testid="button-cancel-designate">Cancel</button>
              <button
                onClick={handleDesignate}
                disabled={designateMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg"
                data-testid="button-confirm-designate"
              >
                {designateMutation.isPending ? 'Adding...' : (!isOnline ? 'Queue Add' : 'Add Member')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New User Dialog */}
      {activeDialog === 'create_user' && selectedCompany && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-100">Create New User — {selectedCompany.name}</h4>
              <button onClick={closeDialog} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-xs mb-4">
              Creates a new Firebase account and automatically adds the user to this company. Requires an internet connection.
            </p>
            {!isOnline && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-600/50 rounded text-red-300 text-xs">
                Internet connection required to create a new user account.
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={createUserEmail}
                  onChange={e => setCreateUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  placeholder="newuser@company.com"
                  data-testid="input-create-user-email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                <input
                  value={createUserFullName}
                  onChange={e => setCreateUserFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  placeholder="Jane Smith"
                  data-testid="input-create-user-fullname"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  value={createUserPassword}
                  onChange={e => setCreateUserPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  placeholder="Min 8 characters"
                  data-testid="input-create-user-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={createUserRole}
                  onChange={e => setCreateUserRole(e.target.value as 'company_admin' | 'member')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="select-create-user-role"
                >
                  <option value="member">Member</option>
                  <option value="company_admin">Company Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={closeDialog} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg" data-testid="button-cancel-create-user">Cancel</button>
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending || !isOnline}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg"
                data-testid="button-confirm-create-user"
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManager;
