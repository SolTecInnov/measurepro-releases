import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, LogIn, RefreshCw, Search, Calendar, User, Globe, Monitor, Smartphone, Tablet } from 'lucide-react';
import { format } from 'date-fns';

interface LoginLog {
  id: number;
  userId: string;
  userEmail: string;
  loginAt: string;
  logoutAt: string | null;
  ipAddress: string | null;
  deviceType: string | null;
  browser: string | null;
  browserVersion: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  screenResolution: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  loginMethod: string | null;
  success: boolean;
  failureReason: string | null;
  sessionDurationSeconds: number | null;
}

interface ActivityLog {
  id: number;
  userId: string;
  userEmail: string;
  actionType: string;
  actionDetails: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  ipAddress: string | null;
  deviceType: string | null;
  timestamp: string;
}

interface AuditStats {
  logins: {
    last24h: number;
    last7d: number;
    last30d: number;
    failedLast7d: number;
  };
  uniqueUsers: {
    last24h: number;
    last7d: number;
  };
  activities: {
    last24h: number;
  };
}

function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
      return <Smartphone className="w-4 h-4" />;
    case 'tablet':
      return <Tablet className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatActionType(actionType: string): string {
  return actionType.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export function AuditLogViewer() {
  const [activeTab, setActiveTab] = useState<'logins' | 'activities'>('logins');
  const [searchEmail, setSearchEmail] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<AuditStats>({
    queryKey: ['/api/audit/stats'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch login logs
  const { data: loginData, isLoading: loginsLoading, refetch: refetchLogins } = useQuery<{ logs: LoginLog[]; total: number }>({
    queryKey: ['/api/audit/logins', searchEmail],
    enabled: activeTab === 'logins',
  });

  // Fetch activity logs
  const { data: activityData, isLoading: activitiesLoading, refetch: refetchActivities } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: ['/api/audit/activities', searchEmail, actionTypeFilter !== 'all' ? actionTypeFilter : undefined],
    enabled: activeTab === 'activities',
  });

  const handleRefresh = () => {
    if (activeTab === 'logins') {
      refetchLogins();
    } else {
      refetchActivities();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-blue-400" />
                Audit Logs
              </CardTitle>
              <CardDescription className="text-gray-400">
                Track user logins and activity across the platform
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="border-gray-600"
              data-testid="button-refresh-audit"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="text-2xl font-bold text-white">{stats?.logins.last24h ?? '-'}</div>
              <div className="text-sm text-gray-400">Logins (24h)</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="text-2xl font-bold text-white">{stats?.uniqueUsers.last24h ?? '-'}</div>
              <div className="text-sm text-gray-400">Unique Users (24h)</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="text-2xl font-bold text-white">{stats?.logins.last7d ?? '-'}</div>
              <div className="text-sm text-gray-400">Logins (7d)</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="text-2xl font-bold text-red-400">{stats?.logins.failedLast7d ?? '-'}</div>
              <div className="text-sm text-gray-400">Failed Logins (7d)</div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'logins' | 'activities')}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-gray-900">
                <TabsTrigger value="logins" className="data-[state=active]:bg-gray-700">
                  <LogIn className="w-4 h-4 mr-2" />
                  Login History
                </TabsTrigger>
                <TabsTrigger value="activities" className="data-[state=active]:bg-gray-700">
                  <Activity className="w-4 h-4 mr-2" />
                  Activity Log
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Filter by email..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="pl-9 w-64 bg-gray-900 border-gray-700"
                    data-testid="input-search-email"
                  />
                </div>
                {activeTab === 'activities' && (
                  <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                    <SelectTrigger className="w-40 bg-gray-900 border-gray-700" data-testid="select-action-type">
                      <SelectValue placeholder="Action Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="survey_create">Survey Create</SelectItem>
                      <SelectItem value="survey_close">Survey Close</SelectItem>
                      <SelectItem value="survey_export">Survey Export</SelectItem>
                      <SelectItem value="survey_email">Survey Email</SelectItem>
                      <SelectItem value="feature_access">Feature Access</SelectItem>
                      <SelectItem value="settings_change">Settings Change</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Login History Tab */}
            <TabsContent value="logins">
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-900 border-gray-700">
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Login Time</TableHead>
                      <TableHead className="text-gray-400">Device</TableHead>
                      <TableHead className="text-gray-400">Location</TableHead>
                      <TableHead className="text-gray-400">IP Address</TableHead>
                      <TableHead className="text-gray-400">Session</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : !loginData?.logs?.length ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                          No login records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      loginData.logs.map((log) => (
                        <TableRow key={log.id} className="border-gray-700 hover:bg-gray-800/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <div>
                                <div className="text-white text-sm">{log.userEmail}</div>
                                <div className="text-xs text-gray-500">{log.userId.slice(0, 8)}...</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-300">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <div>
                                <div className="text-sm">{format(new Date(log.loginAt), 'MMM d, yyyy')}</div>
                                <div className="text-xs text-gray-500">{format(new Date(log.loginAt), 'HH:mm:ss')}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-300">
                              <DeviceIcon deviceType={log.deviceType} />
                              <div>
                                <div className="text-sm">{log.browser || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{log.operatingSystem || 'Unknown OS'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-300">
                              <Globe className="w-4 h-4 text-gray-500" />
                              <span className="text-sm">
                                {log.city && log.country 
                                  ? `${log.city}, ${log.country}` 
                                  : log.country || '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-400 font-mono">
                              {log.ipAddress || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-300">
                              {formatDuration(log.sessionDurationSeconds)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.success ? (
                              <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                                Success
                              </Badge>
                            ) : (
                              <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {loginData?.total && loginData.total > 0 && (
                <div className="mt-4 text-sm text-gray-500 text-center">
                  Showing {loginData.logs.length} of {loginData.total} records
                </div>
              )}
            </TabsContent>

            {/* Activity Log Tab */}
            <TabsContent value="activities">
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-900 border-gray-700">
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Timestamp</TableHead>
                      <TableHead className="text-gray-400">Action</TableHead>
                      <TableHead className="text-gray-400">Details</TableHead>
                      <TableHead className="text-gray-400">Resource</TableHead>
                      <TableHead className="text-gray-400">Device</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activitiesLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : !activityData?.logs?.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          No activity records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      activityData.logs.map((log) => (
                        <TableRow key={log.id} className="border-gray-700 hover:bg-gray-800/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="text-white text-sm">{log.userEmail}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-gray-300">
                              <div className="text-sm">{format(new Date(log.timestamp), 'MMM d, yyyy')}</div>
                              <div className="text-xs text-gray-500">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-gray-600 text-gray-300">
                              {formatActionType(log.actionType)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-300">
                              {log.actionDetails || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.resourceName ? (
                              <div>
                                <div className="text-sm text-gray-300">{log.resourceName}</div>
                                <div className="text-xs text-gray-500">{log.resourceType}</div>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-400">
                              <DeviceIcon deviceType={log.deviceType} />
                              <span className="text-sm capitalize">{log.deviceType || 'Unknown'}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {activityData?.total && activityData.total > 0 && (
                <div className="mt-4 text-sm text-gray-500 text-center">
                  Showing {activityData.logs.length} of {activityData.total} records
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuditLogViewer;
