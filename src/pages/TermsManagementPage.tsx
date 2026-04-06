import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, CheckCircle2, Loader2, Send } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea.tsx';
import { getCurrentUser } from '@/lib/firebase';
import { TermsVersion } from '../../shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';
import { isMasterAdmin, MASTER_ADMIN_EMAIL } from '@/lib/auth/masterAdmin';
import { useAuth } from '@/lib/auth/AuthContext';

type TermsVersionWithCount = TermsVersion & { acceptanceCount?: number };

export default function TermsManagementPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [versionStr, setVersionStr] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin, isLoading, cachedUserData } = useAuth();

  useEffect(() => {
    const checkAdmin = async () => {
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
        setIsAdmin(true);
        setIsCheckingAdmin(false);
        return;
      }

      const firebaseUser = getCurrentUser();

      // Offline fallback - check cached user
      if (!firebaseUser) {
        if (authContextUser?.email && (isMasterAdmin(authContextUser.email) || authContextUser.email === 'admin@soltec.ca')) {
          setIsAdmin(true);
          setIsCheckingAdmin(false);
          return;
        }
        navigate('/login');
        return;
      }

      // Online check - Master admin or admin@soltec.ca have access
      if (isMasterAdmin(firebaseUser.email) || firebaseUser.email === 'admin@soltec.ca') {
        setIsAdmin(true);
      } else {
        toast.error('Unauthorized', {
          description: 'You do not have admin access.',
        });
        navigate('/');
      }
      setIsCheckingAdmin(false);
    };

    checkAdmin();
  }, [navigate, cachedIsMasterAdmin, authContextUser, cachedUserData, isLoading]);

  const { data: versionsData, isLoading: isLoadingVersions } = useQuery<{ versions: TermsVersionWithCount[] }>({
    queryKey: ['/api/admin/terms/versions'],
    enabled: isAdmin && !isCheckingAdmin,
  });

  const versions = versionsData?.versions || [];

  const createVersionMutation = useMutation({
    mutationFn: async () => {
      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const idToken = await user.getIdToken();
      return apiRequest('/api/admin/terms/versions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          version: versionStr,
          title,
          content,
          effectiveDate: new Date(effectiveDate).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      toast.success('Terms version created', {
        description: 'New terms version has been created successfully.',
      });
      setShowCreateDialog(false);
      setVersionStr('');
      setTitle('');
      setContent('');
      setEffectiveDate('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/terms/versions'] });
    },
    onError: (error: any) => {
      toast.error('Creation failed', {
        description: error.message || 'Failed to create terms version.',
      });
    },
  });

  const notifyUsersMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const user = getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const idToken = await user.getIdToken();
      return apiRequest('/api/admin/terms/notify-users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ versionId }),
      });
    },
    onSuccess: (data: any) => {
      toast.success('Users notified', {
        description: `${data.notified} users have been notified via email.`,
      });
    },
    onError: (error: any) => {
      toast.error('Notification failed', {
        description: error.message || 'Failed to notify users.',
      });
    },
  });

  if (isLoading || isCheckingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" data-testid="loader-checking-admin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2" data-testid="heading-terms-management">
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                Terms & Conditions Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2" data-testid="text-page-description">
                Create and manage terms versions, view acceptance statistics
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              data-testid="button-create-version"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Version
            </Button>
          </div>
        </div>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" data-testid="card-terms-versions">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white" data-testid="heading-versions-list">Terms Versions</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400" data-testid="text-versions-description">
              All terms versions and their acceptance statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" data-testid="loader-versions" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400" data-testid="text-no-versions">
                No terms versions found. Create your first version to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-gray-700">
                      <TableHead className="text-gray-900 dark:text-white">Version</TableHead>
                      <TableHead className="text-gray-900 dark:text-white">Title</TableHead>
                      <TableHead className="text-gray-900 dark:text-white">Effective Date</TableHead>
                      <TableHead className="text-gray-900 dark:text-white">Created</TableHead>
                      <TableHead className="text-gray-900 dark:text-white">Acceptances</TableHead>
                      <TableHead className="text-gray-900 dark:text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id} className="border-gray-200 dark:border-gray-700" data-testid={`row-version-${v.id}`}>
                        <TableCell className="font-medium text-gray-900 dark:text-white" data-testid={`text-version-number-${v.id}`}>
                          {v.version}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300" data-testid={`text-version-title-${v.id}`}>
                          {v.title}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300" data-testid={`text-effective-date-${v.id}`}>
                          {new Date(v.effectiveDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300" data-testid={`text-created-at-${v.id}`}>
                          {new Date(v.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300" data-testid={`text-acceptance-count-${v.id}`}>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            {v.acceptanceCount ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => notifyUsersMutation.mutate(v.id)}
                            disabled={notifyUsersMutation.isPending}
                            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            data-testid={`button-notify-users-${v.id}`}
                          >
                            {notifyUsersMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Notify Users
                              </>
                            )}
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" data-testid="dialog-create-version">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white" data-testid="heading-create-dialog">Create New Terms Version</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400" data-testid="text-create-description">
              Create a new version of the terms and conditions. Users will be notified and required to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="versionStr" className="text-gray-900 dark:text-white">Version Number *</Label>
              <Input
                id="versionStr"
                value={versionStr}
                onChange={(e) => setVersionStr(e.target.value)}
                placeholder="e.g., 1.0.0"
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                data-testid="input-version-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-900 dark:text-white">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Updated Privacy Terms"
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                data-testid="input-version-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content" className="text-gray-900 dark:text-white">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter the full terms and conditions text..."
                rows={10}
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                data-testid="input-version-content"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveDate" className="text-gray-900 dark:text-white">Effective Date</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                data-testid="input-effective-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createVersionMutation.mutate()}
              disabled={!versionStr || !title || !content || !effectiveDate || createVersionMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              data-testid="button-submit-create"
            >
              {createVersionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
