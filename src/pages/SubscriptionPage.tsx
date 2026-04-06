import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Download, Pause, XCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionTier {
  id: string;
  tierKey: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  includedFeatures: string[];
}

interface Addon {
  id: string;
  itemKey: string;
  displayName: string;
  description: string;
  price: number;
  billingPeriod: string;
}

interface SubscriptionData {
  subscription: {
    id: string;
    email: string;
    currentStep: number;
    step3Data?: {
      selectedTier?: string;
      selectedAddons?: string[];
    };
    status: string;
    startedAt: string;
    completedAt?: string;
    pausedAt?: string;
    cancelledAt?: string;
    daysUntilDeletion?: number | null;
    gracePeriodExpired?: boolean;
  };
  tier: SubscriptionTier | null;
  addons: Addon[];
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Fetch current subscription
  const { data: subscriptionData, isLoading, error } = useQuery<{ success: boolean; data: SubscriptionData }>({
    queryKey: ['/api/subscription/current'],
    enabled: !!user,
  });

  // Pause subscription mutation
  const pauseMutation = useMutation({
    mutationFn: () => apiRequest('/api/subscription/pause', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast.success('Subscription Paused', {
        description: 'Your subscription has been paused. You have 90 days before data deletion.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
      setShowPauseDialog(false);
    },
    onError: (error: any) => {
      toast.error('Error', {
        description: error.message || 'Failed to pause subscription',
      });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: () => apiRequest('/api/subscription/cancel', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast.error('Subscription Cancelled', {
        description: 'Your subscription has been cancelled. You have 30 days before data deletion.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
      setShowCancelDialog(false);
    },
    onError: (error: any) => {
      toast.error('Error', {
        description: error.message || 'Failed to cancel subscription',
      });
    },
  });

  // Unpause subscription mutation
  const unpauseMutation = useMutation({
    mutationFn: () => apiRequest('/api/subscription/unpause', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast.success('Subscription Resumed', {
        description: 'Your subscription has been resumed and is now active.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
    },
    onError: (error: any) => {
      toast.error('Error', {
        description: error.message || 'Failed to resume subscription',
      });
    },
  });

  // Uncancel subscription mutation
  const uncancelMutation = useMutation({
    mutationFn: () => apiRequest('/api/subscription/uncancel', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast.success('Cancellation Reversed', {
        description: 'Your subscription cancellation has been reversed and is now active.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
    },
    onError: (error: any) => {
      toast.error('Error', {
        description: error.message || 'Failed to reverse cancellation',
      });
    },
  });

  // Download data handler
  const handleDownloadData = async () => {
    try {
      const response = await fetch('/api/subscription/export-data', {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const data = await response.json();
      
      // Convert to JSON and download
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `measurepro-data-export-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Data Exported', {
        description: 'Your data has been downloaded successfully.',
      });
    } catch (error: any) {
      toast.error('Export Failed', {
        description: error.message || 'Failed to export data',
      });
    }
  };

  // Calculate total costs
  const calculateTotals = () => {
    if (!subscriptionData?.data) return { monthly: 0, yearly: 0 };
    
    const tier = subscriptionData.data.tier;
    const addons = subscriptionData.data.addons;
    
    let monthly = tier?.monthlyPrice || 0;
    let yearly = tier?.yearlyPrice || 0;
    
    addons.forEach(addon => {
      if (addon.billingPeriod === 'monthly') {
        monthly += addon.price;
        yearly += addon.price * 12;
      } else if (addon.billingPeriod === 'yearly') {
        yearly += addon.price;
        monthly += Math.round(addon.price / 12);
      }
    });
    
    return { monthly, yearly };
  };

  const totals = calculateTotals();
  
  // Get deletion info from backend
  const getDeletionInfo = () => {
    const sub = subscriptionData?.data.subscription;
    if (!sub || !sub.daysUntilDeletion) return null;
    
    if (sub.cancelledAt) {
      return { days: sub.daysUntilDeletion, type: 'cancelled' as const, expired: sub.gracePeriodExpired };
    }
    
    if (sub.pausedAt) {
      return { days: sub.daysUntilDeletion, type: 'paused' as const, expired: sub.gracePeriodExpired };
    }
    
    return null;
  };
  
  const deletionInfo = getDeletionInfo();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 dark:bg-gray-900 text-white dark:text-white p-8" data-testid="loading-subscription">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white dark:border-white mx-auto mb-4"></div>
              <p className="text-gray-400 dark:text-gray-400">Loading subscription...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !subscriptionData?.data) {
    return (
      <div className="min-h-screen bg-gray-900 dark:bg-gray-900 text-white dark:text-white p-8" data-testid="error-subscription">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Subscription Not Found</h2>
              <p className="text-gray-400 dark:text-gray-400">No subscription found for your account.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { subscription, tier, addons } = subscriptionData.data;

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-900 text-white dark:text-white p-8" data-testid="page-subscription">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" data-testid="heading-subscription">Subscription Management</h1>
          <p className="text-gray-400 dark:text-gray-400">Manage your MeasurePro subscription and billing</p>
        </div>

        {/* Status Alert */}
        {deletionInfo && (
          <div 
            className={`mb-6 p-4 rounded-lg border ${
              deletionInfo.expired
                ? 'bg-red-900/30 dark:bg-red-900/30 border-red-600 dark:border-red-600'
                : deletionInfo.type === 'cancelled' 
                ? 'bg-red-900/20 dark:bg-red-900/20 border-red-500 dark:border-red-500' 
                : 'bg-yellow-900/20 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-500'
            }`}
            data-testid="alert-deletion-warning"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-semibold">
                  {deletionInfo.expired 
                    ? 'Grace Period Expired - Data Pending Deletion'
                    : deletionInfo.type === 'cancelled' ? 'Subscription Cancelled' : 'Subscription Paused'}
                </p>
                <p className="text-sm">
                  {deletionInfo.expired 
                    ? 'Your grace period has expired. Data will be deleted soon. Contact support if you need assistance.'
                    : `Your data will be deleted in ${deletionInfo.days} day${deletionInfo.days !== 1 ? 's' : ''} ${
                        deletionInfo.type === 'paused' ? '(90-day grace period)' : '(30-day grace period)'
                      }`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Plan Card */}
          <Card className="bg-gray-800 dark:bg-gray-800 border-gray-700 dark:border-gray-700 p-6" data-testid="card-current-plan">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-500 dark:text-green-500" />
              <h2 className="text-2xl font-bold">Current Plan</h2>
            </div>

            {tier ? (
              <>
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-blue-400 dark:text-blue-400 mb-2" data-testid="text-tier-name">
                    {tier.displayName}
                  </h3>
                  <p className="text-gray-400 dark:text-gray-400 text-sm" data-testid="text-tier-description">
                    {tier.description}
                  </p>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 dark:text-gray-400">Monthly:</span>
                    <span className="font-semibold" data-testid="text-tier-monthly">
                      ${(tier.monthlyPrice / 100).toFixed(2)}/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 dark:text-gray-400">Yearly:</span>
                    <span className="font-semibold" data-testid="text-tier-yearly">
                      ${(tier.yearlyPrice / 100).toFixed(2)}/yr
                    </span>
                  </div>
                </div>

                {tier.includedFeatures && tier.includedFeatures.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Included Features:</p>
                    <ul className="space-y-1" data-testid="list-tier-features">
                      {tier.includedFeatures.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-400 dark:text-gray-400 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400 dark:text-gray-400">No tier selected</p>
            )}

            <div className="mt-4 pt-4 border-t border-gray-700 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span data-testid="text-subscription-status">
                  Status: <span className={`font-semibold ${
                    subscription.cancelledAt ? 'text-red-500 dark:text-red-500' :
                    subscription.pausedAt ? 'text-yellow-500 dark:text-yellow-500' :
                    'text-green-500 dark:text-green-500'
                  }`}>
                    {subscription.cancelledAt ? 'Cancelled' :
                     subscription.pausedAt ? 'Paused' :
                     'Active'}
                  </span>
                </span>
              </div>
            </div>
          </Card>

          {/* Add-Ons Card */}
          <Card className="bg-gray-800 dark:bg-gray-800 border-gray-700 dark:border-gray-700 p-6" data-testid="card-addons">
            <h2 className="text-2xl font-bold mb-4">Active Add-Ons</h2>

            {addons.length > 0 ? (
              <div className="space-y-3" data-testid="list-addons">
                {addons.map((addon) => (
                  <div 
                    key={addon.id} 
                    className="p-3 bg-gray-700 dark:bg-gray-700 rounded-lg"
                    data-testid={`addon-${addon.itemKey}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold" data-testid={`text-addon-name-${addon.itemKey}`}>
                        {addon.displayName}
                      </h3>
                      <span className="font-semibold text-blue-400 dark:text-blue-400" data-testid={`text-addon-price-${addon.itemKey}`}>
                        ${(addon.price / 100).toFixed(2)}/{addon.billingPeriod === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                    {addon.description && (
                      <p className="text-sm text-gray-400 dark:text-gray-400">{addon.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-400">No add-ons selected</p>
            )}
          </Card>

          {/* Billing Summary Card */}
          <Card className="bg-gray-800 dark:bg-gray-800 border-gray-700 dark:border-gray-700 p-6" data-testid="card-billing-summary">
            <h2 className="text-2xl font-bold mb-4">Billing Summary</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 dark:text-gray-400 mb-2">Monthly Total</p>
                <p className="text-3xl font-bold text-blue-400 dark:text-blue-400" data-testid="text-total-monthly">
                  ${(totals.monthly / 100).toFixed(2)}<span className="text-lg">/mo</span>
                </p>
              </div>

              <div className="pt-4 border-t border-gray-700 dark:border-gray-700">
                <p className="text-sm text-gray-400 dark:text-gray-400 mb-2">Yearly Total</p>
                <p className="text-3xl font-bold text-green-400 dark:text-green-400" data-testid="text-total-yearly">
                  ${(totals.yearly / 100).toFixed(2)}<span className="text-lg">/yr</span>
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
                  Save ${((totals.monthly * 12 - totals.yearly) / 100).toFixed(2)} per year
                </p>
              </div>
            </div>
          </Card>

          {/* Actions Card */}
          <Card className="bg-gray-800 dark:bg-gray-800 border-gray-700 dark:border-gray-700 p-6" data-testid="card-actions">
            <h2 className="text-2xl font-bold mb-4">Subscription Actions</h2>

            <div className="space-y-3">
              <Button
                onClick={handleDownloadData}
                className="w-full bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white dark:text-white"
                data-testid="button-download-data"
              >
                <Download className="h-4 w-4 mr-2" />
                Download All Data
              </Button>

              {/* Active subscription - show pause/cancel */}
              {!subscription.pausedAt && !subscription.cancelledAt && (
                <>
                  <Button
                    onClick={() => setShowPauseDialog(true)}
                    variant="outline"
                    className="w-full border-yellow-500 dark:border-yellow-500 text-yellow-500 dark:text-yellow-500 hover:bg-yellow-500/10 dark:hover:bg-yellow-500/10"
                    data-testid="button-pause"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause Subscription
                  </Button>
                  <Button
                    onClick={() => setShowCancelDialog(true)}
                    variant="outline"
                    className="w-full border-red-500 dark:border-red-500 text-red-500 dark:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/10"
                    data-testid="button-cancel"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Subscription
                  </Button>
                </>
              )}

              {/* Paused subscription - show unpause */}
              {subscription.pausedAt && !subscription.cancelledAt && (
                <Button
                  onClick={() => unpauseMutation.mutate()}
                  disabled={unpauseMutation.isPending || (deletionInfo?.expired ?? false)}
                  className="w-full bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700 text-white dark:text-white"
                  data-testid="button-unpause"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {unpauseMutation.isPending ? 'Resuming...' : 'Resume Subscription'}
                </Button>
              )}

              {/* Cancelled subscription - show uncancel */}
              {subscription.cancelledAt && (
                <Button
                  onClick={() => uncancelMutation.mutate()}
                  disabled={uncancelMutation.isPending || (deletionInfo?.expired ?? false)}
                  className="w-full bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700 text-white dark:text-white"
                  data-testid="button-uncancel"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {uncancelMutation.isPending ? 'Reversing...' : 'Reverse Cancellation'}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Pause Confirmation Dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <div className="fixed inset-0 z-50 bg-black/80 dark:bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-800 dark:bg-gray-800 rounded-lg p-6 max-w-md w-full" data-testid="dialog-pause-confirmation">
            <div className="flex items-center gap-3 mb-4">
              <Pause className="h-6 w-6 text-yellow-500 dark:text-yellow-500" />
              <h3 className="text-xl font-bold">Pause Subscription?</h3>
            </div>
            
            <p className="text-gray-300 dark:text-gray-300 mb-4">
              Pausing your subscription will:
            </p>
            
            <ul className="space-y-2 mb-6 text-sm text-gray-400 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 dark:text-yellow-500">•</span>
                <span>Stop billing immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 dark:text-yellow-500">•</span>
                <span>Retain your data for 90 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 dark:text-yellow-500">•</span>
                <span>Allow you to resume anytime within the grace period</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 dark:text-red-500">•</span>
                <span>Delete all data after 90 days if not resumed</span>
              </li>
            </ul>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowPauseDialog(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-cancel-pause"
              >
                Cancel
              </Button>
              <Button
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className="flex-1 bg-yellow-600 dark:bg-yellow-600 hover:bg-yellow-700 dark:hover:bg-yellow-700"
                data-testid="button-confirm-pause"
              >
                {pauseMutation.isPending ? 'Pausing...' : 'Pause Subscription'}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <div className="fixed inset-0 z-50 bg-black/80 dark:bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-800 dark:bg-gray-800 rounded-lg p-6 max-w-md w-full" data-testid="dialog-cancel-confirmation">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-6 w-6 text-red-500 dark:text-red-500" />
              <h3 className="text-xl font-bold">Cancel Subscription?</h3>
            </div>
            
            <div className="bg-red-900/20 dark:bg-red-900/20 border border-red-500 dark:border-red-500 rounded p-3 mb-4">
              <p className="text-red-400 dark:text-red-400 text-sm font-semibold">
                ⚠️ This action cannot be undone after 30 days
              </p>
            </div>
            
            <p className="text-gray-300 dark:text-gray-300 mb-4">
              Cancelling your subscription will:
            </p>
            
            <ul className="space-y-2 mb-6 text-sm text-gray-400 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-red-500 dark:text-red-500">•</span>
                <span>Stop billing immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 dark:text-red-500">•</span>
                <span>Retain your data for only 30 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 dark:text-red-500">•</span>
                <span>Permanently delete all data after 30 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 dark:text-yellow-500">•</span>
                <span>Download your data before deletion using the export button</span>
              </li>
            </ul>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowCancelDialog(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-cancel-cancellation"
              >
                Keep Subscription
              </Button>
              <Button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-600 dark:bg-red-600 hover:bg-red-700 dark:hover:bg-red-700"
                data-testid="button-confirm-cancel"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
