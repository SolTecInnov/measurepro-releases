import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Activity,
  TrendingUp,
  FileText,
  Monitor,
  Globe,
  Clock,
  AlertTriangle,
  WifiOff,
  Wifi,
  RefreshCw,
  ChevronLeft,
  LogIn,
  Package,
  BarChart2,
  Search,
  Cpu,
  Map,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { getCurrentUser } from '@/lib/firebase';
import { useAuth } from '@/lib/auth/AuthContext';
import { isMasterAdmin } from '@/lib/auth/masterAdmin';

async function getAuthHeader() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

async function fetchAnalytics(endpoint: string) {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/api/audit/${endpoint}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
  return res.json();
}

interface OverviewData {
  totalLogins: number;
  days: number;
  logins: { last24h: number; last7d: number; last30d: number; last90d: number; selected: number };
  uniqueUsers: { last24h: number; last7d: number; last30d: number; last90d: number; selected: number };
  failedLoginsSelected: number;
  offlineLoginsSelected: number;
  activities: { last24h: number; selected: number };
  surveys: { createdSelected: number; closedSelected: number; exportedSelected: number };
}

interface TimeSeriesPoint {
  date: string;
  count: number;
  uniqueUsers: number;
}

interface ActivityBreakdown {
  actionType: string;
  count: number;
}

interface TopUser {
  userId: string;
  userEmail: string;
  loginCount: number;
  lastLogin: string;
}

interface DeviceBreakdown {
  byDevice: { deviceType: string | null; count: number }[];
  byBrowser: { browser: string | null; count: number }[];
  byOS: { os: string | null; count: number }[];
}

interface RecentActivity {
  id: number;
  userId: string;
  userEmail: string;
  actionType: string;
  actionDetails: string | null;
  resourceType: string | null;
  resourceName: string | null;
  timestamp: string;
}

interface ExportFormat {
  format: string;
  count: number;
}

interface SurveyActivityPoint {
  date: string;
  creates: number;
  closes: number;
  exports: number;
}

interface LoginMethods {
  byMethod: { loginMethod: string | null; count: number }[];
  summary: { total: number; online: number; offline: number };
}

interface FeatureUsage {
  featureName: string | null;
  userCount: number;
  accessCount: number;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  survey_create: 'Survey Created',
  survey_close: 'Survey Closed',
  survey_export: 'Survey Exported',
  survey_email: 'Survey Emailed',
  feature_access: 'Feature Access',
  settings_change: 'Settings Changed',
  hardware_connect: 'Hardware Connect',
  gps_session: 'GPS Session',
  poi_capture: 'POI Captured',
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  survey_create: 'bg-green-500/20 text-green-400',
  survey_close: 'bg-blue-500/20 text-blue-400',
  survey_export: 'bg-purple-500/20 text-purple-400',
  survey_email: 'bg-yellow-500/20 text-yellow-400',
  feature_access: 'bg-cyan-500/20 text-cyan-400',
  settings_change: 'bg-orange-500/20 text-orange-400',
  hardware_connect: 'bg-pink-500/20 text-pink-400',
  gps_session: 'bg-indigo-500/20 text-indigo-400',
  poi_capture: 'bg-teal-500/20 text-teal-400',
};

function StatCard({ title, value, sub, icon: Icon, iconColor = 'text-blue-400' }: {
  title: string;
  value: string | number;
  sub?: string;
  icon: any;
  iconColor?: string;
}) {
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <Icon className={`w-8 h-8 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownBar({ label, count, total, color = 'bg-blue-500' }: {
  label: string;
  count: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-sm text-gray-300 w-28 truncate flex-shrink-0">{label || 'Unknown'}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-14 text-right">{count} ({pct}%)</span>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const { isMasterAdmin: cachedIsMasterAdmin, isLoading } = useAuth();
  const [isMaster, setIsMaster] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [days, setDays] = useState(30);
  const [emailFilter, setEmailFilter] = useState('');
  const [appliedEmailFilter, setAppliedEmailFilter] = useState('');

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [activityBreakdown, setActivityBreakdown] = useState<ActivityBreakdown[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [devices, setDevices] = useState<DeviceBreakdown | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>([]);
  const [surveyActivity, setSurveyActivity] = useState<SurveyActivityPoint[]>([]);
  const [loginMethods, setLoginMethods] = useState<LoginMethods | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const checkAccess = async () => {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) { navigate('/login'); return; }
        const email = currentUser.email || '';
        if (!isMasterAdmin(email)) { navigate('/admin/accounts'); return; }
        setIsMaster(true);
        await loadData();
      } catch {
        navigate('/login');
      } finally {
        setIsCheckingAccess(false);
      }
    };
    checkAccess();
  }, [isLoading]);

  const loadData = async (emailOverride?: string) => {
    setError(null);
    const email = emailOverride !== undefined ? emailOverride : appliedEmailFilter;
    const qs = (base: string) => `${base}${email ? `&userEmail=${encodeURIComponent(email)}` : ''}`;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    try {
      const [ov, ts, ab, tu, dv, ra, ef, sa, lm, fu] = await Promise.all([
        fetchAnalytics(qs(`analytics/overview?days=${days}`)),
        fetchAnalytics(qs(`analytics/logins-over-time?days=${days}`)),
        fetchAnalytics(qs(`analytics/activity-breakdown?days=${days}`)),
        fetchAnalytics(qs(`analytics/top-users?days=${days}&limit=10`)),
        fetchAnalytics(qs(`analytics/device-breakdown?days=${days}`)),
        fetchAnalytics(qs(`analytics/recent-activity?limit=50&startDate=${since}`)),
        fetchAnalytics(qs(`analytics/export-formats?days=${days}`)),
        fetchAnalytics(qs(`analytics/survey-activity?days=${days}`)),
        fetchAnalytics(qs(`analytics/login-methods?days=${days}`)),
        fetchAnalytics(qs(`analytics/feature-usage?days=${days}&limit=15`)),
      ]);
      setOverview(ov);
      setTimeSeries(ts.data || []);
      setActivityBreakdown(ab.data || []);
      setTopUsers(tu.data || []);
      setDevices(dv);
      setRecentActivity(ra.data || []);
      setExportFormats(ef.data || []);
      setSurveyActivity(sa.data || []);
      setLoginMethods(lm || null);
      setFeatureUsage(fu.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleApplyEmailFilter = () => {
    setAppliedEmailFilter(emailFilter);
    loadData(emailFilter);
  };

  const handleClearEmailFilter = () => {
    setEmailFilter('');
    setAppliedEmailFilter('');
    loadData('');
  };

  useEffect(() => {
    if (isMaster) loadData();
  }, [days]);

  if (isLoading || isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!isMaster) return null;

  const totalDevices = (devices?.byDevice || []).reduce((s, d) => s + Number(d.count), 0);
  const totalBrowsers = (devices?.byBrowser || []).reduce((s, d) => s + Number(d.count), 0);
  const totalOS = (devices?.byOS || []).reduce((s, d) => s + Number(d.count), 0);
  const totalActivity = activityBreakdown.reduce((s, d) => s + Number(d.count), 0);
  const totalExports = exportFormats.reduce((s, f) => s + Number(f.count), 0);
  const totalFeatureAccess = featureUsage.reduce((s, f) => s + Number(f.accessCount), 0);

  const deviceColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500'];
  const browserColors = ['bg-blue-500', 'bg-orange-500', 'bg-green-500', 'bg-gray-500', 'bg-red-500'];
  const osColors = ['bg-blue-500', 'bg-gray-400', 'bg-yellow-500', 'bg-green-500'];
  const exportColors = ['bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];

  const surveyMax = surveyActivity.reduce((m, p) => Math.max(m, p.creates + p.closes + p.exports), 1);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/accounts')} data-testid="button-back-to-accounts">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Accounts
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-blue-400" />
                Analytics & Usage Insights
              </h1>
              <p className="text-gray-400 text-sm">Master admin view — all users</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Filter all by email..."
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyEmailFilter()}
                  className="pl-8 h-9 w-52 bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 text-sm"
                  data-testid="input-email-filter-header"
                />
              </div>
              <Button size="sm" variant="secondary" onClick={handleApplyEmailFilter} data-testid="button-apply-email-filter-header">Apply</Button>
              {appliedEmailFilter && (
                <Button size="sm" variant="ghost" onClick={handleClearEmailFilter} className="text-blue-400">Clear</Button>
              )}
            </div>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32 bg-gray-800 border-gray-700" data-testid="select-days-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} data-testid="button-refresh-analytics">
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        {appliedEmailFilter && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-blue-900/30 border border-blue-700 text-sm text-blue-300 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            All analytics filtered for user: <strong>{appliedEmailFilter}</strong>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Overview Stats */}
        {overview && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard title="Total Logins (all time)" value={overview.totalLogins.toLocaleString()} icon={LogIn} iconColor="text-blue-400" />
              <StatCard title={`Unique Users (${days}d)`} value={overview.uniqueUsers.selected.toLocaleString()} sub={`${overview.uniqueUsers.last24h} today`} icon={Users} iconColor="text-green-400" />
              <StatCard title={`Activities (${days}d)`} value={overview.activities.selected.toLocaleString()} sub={`${overview.activities.last24h} today`} icon={Activity} iconColor="text-purple-400" />
              <StatCard title={`Surveys Exported (${days}d)`} value={overview.surveys.exportedSelected.toLocaleString()} sub={`${overview.surveys.createdSelected} created, ${overview.surveys.closedSelected} closed`} icon={Package} iconColor="text-yellow-400" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard title="Logins (24h)" value={overview.logins.last24h} icon={TrendingUp} iconColor="text-cyan-400" />
              <StatCard title="Logins (7d)" value={overview.logins.last7d} icon={TrendingUp} iconColor="text-cyan-400" />
              <StatCard title={`Failed Logins (${days}d)`} value={overview.failedLoginsSelected} icon={AlertTriangle} iconColor={overview.failedLoginsSelected > 5 ? 'text-red-400' : 'text-gray-400'} />
              <StatCard title={`Offline Logins (${days}d)`} value={overview.offlineLoginsSelected} icon={WifiOff} iconColor="text-orange-400" />
            </div>

            {/* Active Users 7 / 30 / 90 day breakdown */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <StatCard title="Active Users (7d)" value={overview.uniqueUsers.last7d.toLocaleString()} sub={`${overview.logins.last7d} logins`} icon={Users} iconColor="text-blue-300" />
              <StatCard title="Active Users (30d)" value={overview.uniqueUsers.last30d.toLocaleString()} sub={`${overview.logins.last30d} logins`} icon={Users} iconColor="text-blue-400" />
              <StatCard title="Active Users (90d)" value={overview.uniqueUsers.last90d.toLocaleString()} sub={`${overview.logins.last90d} logins`} icon={Users} iconColor="text-blue-500" />
            </div>
          </>
        )}

        {/* Online vs Offline + Login Methods */}
        {loginMethods && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-400" />
                  Online vs Offline Sessions ({days}d)
                </CardTitle>
                <CardDescription className="text-gray-400">{loginMethods.summary.total} total logins</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm text-gray-300">Online</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{loginMethods.summary.online}</span>
                      <span className="text-xs text-gray-400">
                        ({loginMethods.summary.total > 0 ? Math.round((loginMethods.summary.online / loginMethods.summary.total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: loginMethods.summary.total > 0 ? `${(loginMethods.summary.online / loginMethods.summary.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm text-gray-300">Offline (cached license)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{loginMethods.summary.offline}</span>
                      <span className="text-xs text-gray-400">
                        ({loginMethods.summary.total > 0 ? Math.round((loginMethods.summary.offline / loginMethods.summary.total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{ width: loginMethods.summary.total > 0 ? `${(loginMethods.summary.offline / loginMethods.summary.total) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-blue-400" />
                  Login Methods ({days}d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loginMethods.byMethod.length === 0 ? (
                  <p className="text-gray-500 text-sm">No login data yet</p>
                ) : (
                  <div className="space-y-2">
                    {loginMethods.byMethod.map((m, i) => (
                      <BreakdownBar
                        key={m.loginMethod ?? 'unknown'}
                        label={m.loginMethod || 'Unknown'}
                        count={Number(m.count)}
                        total={loginMethods.summary.total}
                        color={['bg-blue-500', 'bg-orange-500', 'bg-green-500', 'bg-gray-500'][i % 4]}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Activity Breakdown */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Activity by Type ({days}d)
              </CardTitle>
              <CardDescription className="text-gray-400">{totalActivity} total events</CardDescription>
            </CardHeader>
            <CardContent>
              {activityBreakdown.length === 0 ? (
                <p className="text-gray-500 text-sm">No activity data yet</p>
              ) : (
                <div className="space-y-2">
                  {activityBreakdown.map((item, i) => (
                    <BreakdownBar
                      key={item.actionType}
                      label={ACTION_TYPE_LABELS[item.actionType] || item.actionType}
                      count={Number(item.count)}
                      total={totalActivity}
                      color={['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'][i % 9]}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Users */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-green-400" />
                Most Active Users ({days}d)
              </CardTitle>
              <CardDescription className="text-gray-400">By login count</CardDescription>
            </CardHeader>
            <CardContent>
              {topUsers.length === 0 ? (
                <p className="text-gray-500 text-sm">No login data yet</p>
              ) : (
                <div className="space-y-2">
                  {topUsers.map((u, i) => (
                    <div key={u.userId} className="flex items-center justify-between py-1 border-b border-gray-700 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
                        <div>
                          <p className="text-sm font-medium">{u.userEmail}</p>
                          <p className="text-xs text-gray-400">Last: {new Date(u.lastLogin).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-2">{u.loginCount} logins</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Export Format Popularity + Feature Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-violet-400" />
                Export Format Popularity ({days}d)
              </CardTitle>
              <CardDescription className="text-gray-400">{totalExports} total exports</CardDescription>
            </CardHeader>
            <CardContent>
              {exportFormats.length === 0 ? (
                <p className="text-gray-500 text-sm">No export data yet. Formats will appear once users export surveys.</p>
              ) : (
                <div className="space-y-2">
                  {exportFormats.map((f, i) => (
                    <BreakdownBar
                      key={f.format}
                      label={f.format.toUpperCase()}
                      count={Number(f.count)}
                      total={totalExports}
                      color={exportColors[i % exportColors.length]}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Feature Usage ({days}d)
              </CardTitle>
              <CardDescription className="text-gray-400">{totalFeatureAccess} total accesses</CardDescription>
            </CardHeader>
            <CardContent>
              {featureUsage.length === 0 ? (
                <p className="text-gray-500 text-sm">No feature access data yet. Will populate as users access modules.</p>
              ) : (
                <div className="space-y-2">
                  {featureUsage.map((f, i) => (
                    <BreakdownBar
                      key={f.featureName ?? 'unknown'}
                      label={f.featureName || 'Unknown'}
                      count={Number(f.accessCount)}
                      total={totalFeatureAccess}
                      color={['bg-cyan-500', 'bg-blue-500', 'bg-teal-500', 'bg-indigo-500', 'bg-violet-500'][i % 5]}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Survey Activity Over Time */}
        {surveyActivity.length > 0 && (
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Map className="w-4 h-4 text-yellow-400" />
                Survey Activity — Last {days} Days
              </CardTitle>
              <CardDescription className="text-gray-400">Creates (green) · Closes (blue) · Exports (purple)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="flex gap-1 items-end h-24 mb-2">
                  {surveyActivity.map((p) => {
                    const total = p.creates + p.closes + p.exports;
                    const pct = Math.max((total / surveyMax) * 100, 4);
                    return (
                      <div key={p.date} className="flex-1 flex flex-col items-center gap-0 group relative" title={`${p.date}: ${p.creates} created, ${p.closes} closed, ${p.exports} exported`}>
                        <div className="w-full flex flex-col justify-end" style={{ height: `${pct}%` }}>
                          <div className="bg-purple-500 w-full" style={{ height: `${total > 0 ? (p.exports / total) * 100 : 0}%` }} />
                          <div className="bg-blue-500 w-full" style={{ height: `${total > 0 ? (p.closes / total) * 100 : 0}%` }} />
                          <div className="bg-green-500 w-full rounded-t" style={{ height: `${total > 0 ? (p.creates / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1">
                  {surveyActivity.map((p) => (
                    <div key={p.date} className="flex-1 text-center">
                      <span className="text-[9px] text-gray-500">{new Date(p.date).getDate()}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Day of month. Hover bars for daily details.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Device Types */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                Device Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!devices?.byDevice?.length ? (
                <p className="text-gray-500 text-sm">No data</p>
              ) : (
                <div className="space-y-1">
                  {devices.byDevice.map((d, i) => (
                    <BreakdownBar key={d.deviceType ?? 'unknown'} label={d.deviceType || 'Unknown'} count={Number(d.count)} total={totalDevices} color={deviceColors[i % deviceColors.length]} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Browsers */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                Browsers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!devices?.byBrowser?.length ? (
                <p className="text-gray-500 text-sm">No data</p>
              ) : (
                <div className="space-y-1">
                  {devices.byBrowser.map((d, i) => (
                    <BreakdownBar key={d.browser ?? 'unknown'} label={d.browser || 'Unknown'} count={Number(d.count)} total={totalBrowsers} color={browserColors[i % browserColors.length]} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Operating Systems */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-400" />
                Operating Systems
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!devices?.byOS?.length ? (
                <p className="text-gray-500 text-sm">No data</p>
              ) : (
                <div className="space-y-1">
                  {devices.byOS.map((d, i) => (
                    <BreakdownBar key={d.os ?? 'unknown'} label={d.os || 'Unknown'} count={Number(d.count)} total={totalOS} color={osColors[i % osColors.length]} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Logins Chart */}
        {timeSeries.length > 0 && (
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Daily Logins — Last {days} Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="flex gap-1 items-end h-24 mb-2">
                  {timeSeries.map((p) => {
                    const maxCount = Math.max(...timeSeries.map(t => t.count), 1);
                    const pct = Math.max((p.count / maxCount) * 100, 4);
                    return (
                      <div key={p.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition-colors cursor-default"
                          style={{ height: `${pct}%` }}
                          title={`${p.date}: ${p.count} logins, ${p.uniqueUsers} users`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1">
                  {timeSeries.map((p) => (
                    <div key={p.date} className="flex-1 text-center">
                      <span className="text-[9px] text-gray-500">{new Date(p.date).getDate()}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Day of month labels. Hover bars for details.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity Feed */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              Recent Activity Feed
            </CardTitle>
            <CardDescription className="text-gray-400">Last 50 events — filter by user email applies dashboard-wide</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Dashboard-wide email filter bar */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Filter all charts by user email..."
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyEmailFilter()}
                  className="pl-9 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                  data-testid="input-email-filter"
                />
              </div>
              <Button size="sm" onClick={handleApplyEmailFilter} data-testid="button-apply-email-filter">Apply</Button>
              {appliedEmailFilter && (
                <Button size="sm" variant="ghost" onClick={handleClearEmailFilter} data-testid="button-clear-email-filter">Clear</Button>
              )}
            </div>
            {appliedEmailFilter && (
              <p className="text-xs text-blue-400 mb-3">All charts filtered for: <strong>{appliedEmailFilter}</strong></p>
            )}
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {appliedEmailFilter ? `No activity found for "${appliedEmailFilter}".` : 'No activity logged yet. Activity will appear once users create surveys, export data, or connect hardware.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-700 last:border-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${ACTION_TYPE_COLORS[item.actionType] || 'bg-gray-600 text-gray-300'}`}>
                      {ACTION_TYPE_LABELS[item.actionType] || item.actionType}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{item.actionDetails || item.resourceName || '—'}</p>
                      <p className="text-xs text-gray-500">{item.userEmail}</p>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
