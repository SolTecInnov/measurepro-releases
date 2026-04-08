import React, { useState } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { insertCustomerSchema, type Customer, type InsertCustomer } from '../../../../shared/schema';
import { queryClient, apiRequest } from '../../../lib/queryClient';

const CustomerManager = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      return data.customers as Customer[];
    },
  });

  const customers = customersData || [];

  // Form setup
  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      name: '',
      email: '',
      company: '',
      phone: '',
      notes: '',
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertCustomer) => {
      return apiRequest<{ customer: Customer }>('/api/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      // toast suppressed
      setShowDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create customer');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertCustomer }) => {
      return apiRequest<{ customer: Customer }>(`/api/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      // toast suppressed
      setShowDialog(false);
      setEditingCustomer(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/customers/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      // toast suppressed
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  const handleAdd = () => {
    setEditingCustomer(null);
    form.reset({
      name: '',
      email: '',
      company: '',
      phone: '',
      notes: '',
    });
    setShowDialog(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      name: customer.name,
      email: customer.email,
      company: customer.company || '',
      phone: customer.phone || '',
      notes: customer.notes || '',
    });
    setShowDialog(true);
  };

  const handleSubmit = (data: InsertCustomer) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Customer Management</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          data-testid="button-add-customer"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Email</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Company</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Phone</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Created</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading customers...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No customers found</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-200" data-testid={`text-customer-name-${customer.id}`}>
                      {customer.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">{customer.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{customer.company || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{customer.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded"
                          data-testid={`button-edit-customer-${customer.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(customer.id)}
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded"
                          data-testid={`button-delete-customer-${customer.id}`}
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
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </h4>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  {...form.register('name')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="input-customer-name"
                />
                {form.formState.errors.name && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  {...form.register('email')}
                  type="email"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="input-customer-email"
                />
                {form.formState.errors.email && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Company
                </label>
                <input
                  {...form.register('company')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="input-customer-company"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  {...form.register('phone')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="input-customer-phone"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  {...form.register('notes')}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  data-testid="input-customer-notes"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDialog(false);
                    setEditingCustomer(null);
                    form.reset();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  data-testid="button-cancel-customer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
                  data-testid="button-submit-customer"
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
              Are you sure you want to delete this customer? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                data-testid="button-cancel-delete-customer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg transition-colors"
                data-testid="button-confirm-delete-customer"
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

export default CustomerManager;
