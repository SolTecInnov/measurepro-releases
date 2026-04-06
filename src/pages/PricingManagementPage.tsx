import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Plus,
  Trash2,
  Check,
  X,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Calculator,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentUser } from '@/lib/firebase';
import { Pricing } from '../../shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthContext';

const MASTER_ADMIN_EMAIL = 'jfprince@soltec.ca';

export default function PricingManagementPage() {
  const navigate = useNavigate();
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin, isLoading, cachedUserData } = useAuth();

  const [newItem, setNewItem] = useState({
    itemType: 'addon' as 'subscription_tier' | 'addon',
    itemKey: '',
    displayName: '',
    description: '',
    price: 0,
    currency: 'USD',
    billingPeriod: '' as 'monthly' | 'yearly' | '',
    isActive: true,
  });

  useEffect(() => {
    const checkAuth = async () => {
      // WAIT for AuthContext to finish loading cached data
      if (isLoading) {
        return;
      }

      // WAIT for user data to be available (either Firebase user or cached user)
      if (!authContextUser && !cachedUserData) {
        return;
      }

      // Check cached master admin flag FIRST (works offline)
      if (cachedIsMasterAdmin) {
        setIsMasterAdmin(true);
        setIsCheckingAuth(false);
        return;
      }

      const firebaseUser = getCurrentUser();

      // Offline fallback - check cached user
      if (!firebaseUser) {
        if (authContextUser?.email && authContextUser.email === MASTER_ADMIN_EMAIL) {
          setIsMasterAdmin(true);
          setIsCheckingAuth(false);
          return;
        }
        toast.error('Unauthorized', {
          description: 'Please log in to access this page.',
        });
        navigate('/login');
        return;
      }

      // Online check - Master admin has access
      if (firebaseUser.email === MASTER_ADMIN_EMAIL) {
        setIsMasterAdmin(true);
      } else {
        toast.error('Access Denied', {
          description: 'Only the master admin can access pricing management.',
        });
        navigate('/');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [navigate, cachedIsMasterAdmin, authContextUser, cachedUserData, isLoading]);

  const { data: pricingData, isLoading: isLoadingPricing } = useQuery<{ pricing: Pricing[] }>({
    queryKey: ['/api/pricing'],
    enabled: isMasterAdmin && !isCheckingAuth,
  });

  const pricingItems = (pricingData?.pricing || []);

  const createMutation = useMutation({
    mutationFn: async (data: typeof newItem) => {
      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const idToken = await user.getIdToken();
      return apiRequest('/api/pricing', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Pricing item created successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/pricing'] });
      setShowAddModal(false);
      setNewItem({
        itemType: 'addon',
        itemKey: '',
        displayName: '',
        description: '',
        price: 0,
        currency: 'USD',
        billingPeriod: '',
        isActive: true,
      });
    },
    onError: (error: any) => {
      toast.error('Failed to create pricing item', {
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pricing> }) => {
      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const idToken = await user.getIdToken();
      return apiRequest(`/api/pricing/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Pricing item updated successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/pricing'] });
      setEditingId(null);
      setEditingField(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update pricing item', {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const idToken = await user.getIdToken();
      return apiRequest(`/api/pricing/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
    },
    onSuccess: () => {
      toast.success('Pricing item deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/pricing'] });
    },
    onError: (error: any) => {
      toast.error('Failed to delete pricing item', {
        description: error.message,
      });
    },
  });

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleCellClick = (id: string, field: string, currentValue: any) => {
    setEditingId(id);
    setEditingField(field);
    setEditValue(currentValue?.toString() || '');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingField) return;

    let value: any = editValue;
    if (editingField === 'price') {
      value = parseFloat(editValue) * 100; // Convert dollars to cents
    }

    await updateMutation.mutateAsync({
      id,
      data: { [editingField]: value },
    });
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await updateMutation.mutateAsync({
      id,
      data: { isActive: !currentStatus },
    });
  };

  const calculateMonthlyEquivalent = (price: number, period: string | null) => {
    if (period === 'yearly') {
      return price / 12;
    }
    return price;
  };

  if (isLoading || isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Pricing Management
        </h1>
        <p className="text-gray-600 mt-2">
          Master admin panel for managing subscription tiers and add-on pricing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card data-testid="card-total-items">
          <CardHeader className="pb-2">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-items">
              {pricingItems.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card data-testid="card-active-items">
          <CardHeader className="pb-2">
            <CardDescription>Active Items</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-active-items">
              {pricingItems.filter((item) => item.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card data-testid="card-subscriptions">
          <CardHeader className="pb-2">
            <CardDescription>Subscription Tiers</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-subscriptions">
              {pricingItems.filter((item) => item.itemType === 'subscription_tier').length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card data-testid="card-addons">
          <CardHeader className="pb-2">
            <CardDescription>Add-ons</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-addons">
              {pricingItems.filter((item) => item.itemType === 'addon').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pricing Items</CardTitle>
              <CardDescription>Click on price, billing period, or status to edit inline</CardDescription>
            </div>
            <Button onClick={() => setShowAddModal(true)} data-testid="button-add-pricing">
              <Plus className="h-4 w-4 mr-2" />
              Add Pricing Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPricing ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading pricing items...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item Key</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Monthly Equiv.</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-pricing-${item.id}`}>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          item.itemType === 'subscription_tier'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {item.itemType}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.itemKey}</TableCell>
                    <TableCell className="font-medium">{item.displayName}</TableCell>
                    <TableCell className="text-sm text-gray-600">{item.description || '-'}</TableCell>
                    <TableCell>
                      {editingId === item.id && editingField === 'price' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24"
                            step="0.01"
                            autoFocus
                            data-testid={`input-edit-price-${item.id}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(item.id)}
                            data-testid={`button-save-price-${item.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditingField(null);
                            }}
                            data-testid={`button-cancel-price-${item.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCellClick(item.id, 'price', item.price / 100)}
                          className="hover:bg-gray-100 px-2 py-1 rounded cursor-pointer flex items-center gap-1"
                          data-testid={`button-edit-price-${item.id}`}
                        >
                          {formatPrice(item.price)}
                          <Edit2 className="h-3 w-3 text-gray-400" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === item.id && editingField === 'billingPeriod' ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="border rounded px-2 py-1"
                            autoFocus
                            data-testid={`select-edit-period-${item.id}`}
                          >
                            <option value="">None</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(item.id)}
                            data-testid={`button-save-period-${item.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditingField(null);
                            }}
                            data-testid={`button-cancel-period-${item.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCellClick(item.id, 'billingPeriod', item.billingPeriod || '')}
                          className="hover:bg-gray-100 px-2 py-1 rounded cursor-pointer flex items-center gap-1"
                          data-testid={`button-edit-period-${item.id}`}
                        >
                          {item.billingPeriod || '-'}
                          <Edit2 className="h-3 w-3 text-gray-400" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        {formatPrice(calculateMonthlyEquivalent(item.price, item.billingPeriod || null))}/mo
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(item.id, item.isActive || false)}
                        className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded"
                        data-testid={`toggle-active-${item.id}`}
                      >
                        {item.isActive ? (
                          <>
                            <ToggleRight className="h-5 w-5 text-green-600" />
                            <span className="text-green-600 font-medium">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                            <span className="text-gray-400">Inactive</span>
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${item.displayName}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent data-testid="dialog-add-pricing">
          <DialogHeader>
            <DialogTitle>Add New Pricing Item</DialogTitle>
            <DialogDescription>Create a new subscription tier or add-on pricing item</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="itemType">Item Type</Label>
              <select
                id="itemType"
                value={newItem.itemType}
                onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value as any })}
                className="w-full border rounded px-3 py-2 mt-1"
                data-testid="select-item-type"
              >
                <option value="addon">Add-on</option>
                <option value="subscription_tier">Subscription Tier</option>
              </select>
            </div>

            <div>
              <Label htmlFor="itemKey">Item Key (unique identifier)</Label>
              <Input
                id="itemKey"
                value={newItem.itemKey}
                onChange={(e) => setNewItem({ ...newItem, itemKey: e.target.value })}
                placeholder="e.g., ai_detection"
                data-testid="input-item-key"
              />
            </div>

            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={newItem.displayName}
                onChange={(e) => setNewItem({ ...newItem, displayName: e.target.value })}
                placeholder="e.g., AI Object Detection"
                data-testid="input-display-name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Optional description"
                data-testid="input-description"
              />
            </div>

            <div>
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                type="number"
                value={newItem.price / 100}
                onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) * 100 })}
                step="0.01"
                placeholder="0.00"
                data-testid="input-price"
              />
            </div>

            <div>
              <Label htmlFor="billingPeriod">Billing Period</Label>
              <select
                id="billingPeriod"
                value={newItem.billingPeriod}
                onChange={(e) => setNewItem({ ...newItem, billingPeriod: e.target.value as any })}
                className="w-full border rounded px-3 py-2 mt-1"
                data-testid="select-billing-period"
              >
                <option value="">None</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newItem)}
              disabled={!newItem.itemKey || !newItem.displayName}
              data-testid="button-create-pricing"
            >
              Create Pricing Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
