import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2, Trash2, Eye, EyeOff, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  insertSubscriptionSchema,
  type Subscription,
  type InsertSubscription,
  type Customer,
} from '../../../../shared/schema';
import { queryClient, apiRequest } from '../../../lib/queryClient';

const FEATURE_LABELS = {
  convoy_guardian: 'Convoy Guardian ($650)',
  ai_detection: 'AI Detection ($255/$355)',
  envelope_clearance: 'Envelope Clearance ($125)',
  permitted_route_enforcement: 'Permitted Route Enforcement ($350)',
  swept_path_analysis: 'Swept Path Analysis ($450/month)',
};

const SubscriptionManager = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Fetch subscriptions
  const { data: subscriptionsData, isLoading } = useQuery({
    queryKey: ['/api/subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions');
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      const data = await response.json();
      return data.subscriptions as Subscription[];
    },
  });

  // Fetch customers for dropdown
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: async () => {
      const response = await fetch('/api/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      return data.customers as Customer[];
    },
  });

  const subscriptions = subscriptionsData || [];
  const customers = customersData || [];

  // Form setup
  const form = useForm<InsertSubscription>({
    resolver: zodResolver(insertSubscriptionSchema),
    defaultValues: {
      customerId: '',
      feature: 'ai_detection',
      password: '',
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      notes: '',
    },
  });

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const password = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    form.setValue('password', password);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertSubscription) => {
      return apiRequest<{ subscription: Subscription }>('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      toast.success('Subscription created successfully');
      setShowDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create subscription');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertSubscription }) => {
      return apiRequest<{ subscription: Subscription }>(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      toast.success('Subscription updated successfully');
      setShowDialog(false);
      setEditingSubscription(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update subscription');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/subscriptions/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      toast.success('Subscription deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete subscription');
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (subscription: Subscription) => {
      const customer = customers.find(c => c.id === subscription.customerId);
      if (!customer) throw new Error('Customer not found');

      return apiRequest('/api/subscriptions/send-credentials', {
        method: 'POST',
        body: JSON.stringify({
          customerEmail: customer.email,
          customerName: customer.name,
          feature: subscription.feature,
          password: subscription.password,
          validFrom: subscription.validFrom,
          validUntil: subscription.validUntil,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Credentials email sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send email');
    },
  });

  const handleAdd = () => {
    setEditingSubscription(null);
    form.reset({
      customerId: '',
      feature: 'ai_detection',
      password: '',
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      notes: '',
    });
    setShowDialog(true);
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    form.reset({
      customerId: subscription.customerId,
      feature: subscription.feature,
      password: subscription.password,
      validFrom: subscription.validFrom.split('T')[0],
      validUntil: subscription.validUntil.split('T')[0],
      isActive: subscription.isActive,
      notes: subscription.notes || '',
    });
    setShowDialog(true);
  };

  const handleSubmit = (data: InsertSubscription) => {
    if (editingSubscription) {
      updateMutation.mutate({ id: editingSubscription.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

  const isSubscriptionActive = (subscription: Subscription) => {
    const now = new Date();
    const validFrom = new Date(subscription.validFrom);
    const validUntil = new Date(subscription.validUntil);
    return now >= validFrom && now <= validUntil && subscription.isActive;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Subscription Management</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          data-testid="button-add-subscription"
        >
          <Plus className="w-4 h-4" />
          Add Subscription
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Feature</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Password</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Valid From</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Valid Until</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading subscriptions...</td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No subscriptions found</td>
                </tr>
              ) : (
                subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-200">
                      {getCustomerName(subscription.customerId)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-900/40 text-purple-300 rounded">
                        {FEATURE_LABELS[subscription.feature]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-300 font-mono">
                          {visiblePasswords.has(subscription.id) ? subscription.password : '••••••••••••'}
                        </span>
                        <button
                          onClick={() => togglePasswordVisibility(subscription.id)}
                          className="p-1 text-gray-400 hover:text-gray-200"
                          data-testid={`button-toggle-password-${subscription.id}`}
                        >
                          {visiblePasswords.has(subscription.id) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(subscription.validFrom).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(subscription.validUntil).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {isSubscriptionActive(subscription) ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-900/40 text-green-300 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-900/40 text-red-300 rounded">
                          Expired
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => sendEmailMutation.mutate(subscription)}
                          disabled={sendEmailMutation.isPending}
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded"
                          title="Send Credentials Email"
                          data-testid={`button-send-email-${subscription.id}`}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(subscription)}
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded"
                          data-testid={`button-edit-subscription-${subscription.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(subscription.id)}
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded"
                          data-testid={`button-delete-subscription-${subscription.id}`}
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

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h4 className="text-lg font-semibold text-gray-100 mb-4">
              {editingSubscription ? 'Edit Subscription' : 'Add Subscription'}
            </h4>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer *
                </label>
                <select
                  {...form.register('customerId')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="select-customer"
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </option>
                  ))}
                </select>
                {form.formState.errors.customerId && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.customerId.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Feature *
                </label>
                <select
                  {...form.register('feature')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="select-feature"
                >
                  {Object.entries(FEATURE_LABELS || {}).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Password *
                </label>
                <div className="flex gap-2">
                  <input
                    {...form.register('password')}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 font-mono"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-gray-100"
                    data-testid="button-generate-password"
                  >
                    Generate
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.password.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Valid From *
                  </label>
                  <input
                    {...form.register('validFrom')}
                    type="date"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                    data-testid="input-valid-from"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Valid Until *
                  </label>
                  <input
                    {...form.register('validUntil')}
                    type="date"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                    data-testid="input-valid-until"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    {...form.register('isActive')}
                    type="checkbox"
                    className="w-4 h-4 bg-gray-700 border border-gray-600 rounded"
                    data-testid="checkbox-is-active"
                  />
                  <span className="text-sm text-gray-300">Active</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  {...form.register('notes')}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="input-notes"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDialog(false);
                    setEditingSubscription(null);
                    form.reset();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  data-testid="button-cancel-subscription"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
                  data-testid="button-submit-subscription"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h4 className="text-lg font-semibold text-gray-100 mb-2">Confirm Delete</h4>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this subscription? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                data-testid="button-cancel-delete-subscription"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg transition-colors"
                data-testid="button-confirm-delete-subscription"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
