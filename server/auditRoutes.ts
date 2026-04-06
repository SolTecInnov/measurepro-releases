import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { loginLogs, activityLogs } from '../db/schema.js';
import { desc, eq, and, gte, lte, sql, SQL } from 'drizzle-orm';
import type { InsertLoginLog, InsertActivityLog } from '../shared/schema.js';
import { verifyMasterAdminAccess } from './middleware/adminAuth.js';

const router = Router();

// Helper to parse device info from user agent
function parseUserAgent(ua: string | undefined): { browser: string; browserVersion: string; os: string; osVersion: string; deviceType: string } {
  if (!ua) return { browser: 'Unknown', browserVersion: '', os: 'Unknown', osVersion: '', deviceType: 'unknown' };
  
  let browser = 'Unknown';
  let browserVersion = '';
  let os = 'Unknown';
  let osVersion = '';
  let deviceType = 'desktop';

  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    browser = 'Chrome';
    const match = ua.match(/Chrome\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
    const match = ua.match(/Firefox\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
    const match = ua.match(/Version\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Edg')) {
    browser = 'Edge';
    const match = ua.match(/Edg\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  }

  // Detect OS
  if (ua.includes('Windows')) {
    os = 'Windows';
    if (ua.includes('Windows NT 10')) osVersion = '10/11';
    else if (ua.includes('Windows NT 6.3')) osVersion = '8.1';
    else if (ua.includes('Windows NT 6.1')) osVersion = '7';
  } else if (ua.includes('Mac OS X')) {
    os = 'macOS';
    const match = ua.match(/Mac OS X ([\d_]+)/);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
    const match = ua.match(/Android ([\d.]+)/);
    osVersion = match ? match[1] : '';
    deviceType = 'mobile';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
    const match = ua.match(/OS ([\d_]+)/);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
    deviceType = ua.includes('iPad') ? 'tablet' : 'mobile';
  }

  // Device type detection
  if (ua.includes('Mobile') || ua.includes('Android')) {
    deviceType = 'mobile';
  } else if (ua.includes('Tablet') || ua.includes('iPad')) {
    deviceType = 'tablet';
  }

  return { browser, browserVersion, os, osVersion, deviceType };
}

// Get client IP address
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// POST /api/audit/login - Log a login event
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { 
      userId, 
      userEmail, 
      loginMethod,
      success = true,
      failureReason,
      screenResolution,
      language,
      timezone,
      referrerUrl,
      sessionId,
      metadata 
    } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({ error: 'userId and userEmail are required' });
    }

    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = getClientIP(req);
    const { browser, browserVersion, os, osVersion, deviceType } = parseUserAgent(userAgent);

    const [result] = await db.insert(loginLogs).values({
      userId,
      userEmail,
      ipAddress,
      userAgent,
      deviceType,
      browser,
      browserVersion,
      operatingSystem: os,
      osVersion,
      screenResolution: screenResolution || null,
      language: language || null,
      timezone: timezone || null,
      loginMethod: loginMethod || 'email',
      referrerUrl: referrerUrl || null,
      success,
      failureReason: failureReason || null,
      sessionId: sessionId || null,
      metadata: metadata || null,
    }).returning();

    res.json({ success: true, logId: result.id });
  } catch (error) {
    console.error('[Audit] Error logging login:', error);
    res.status(500).json({ error: 'Failed to log login' });
  }
});

// POST /api/audit/logout - Log a logout event (updates existing login log)
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId } = req.body;

    if (!sessionId && !userId) {
      return res.status(400).json({ error: 'sessionId or userId is required' });
    }

    const now = new Date();
    
    // Find the most recent login for this session/user
    const [existingLog] = await db.select()
      .from(loginLogs)
      .where(sessionId ? eq(loginLogs.sessionId, sessionId) : eq(loginLogs.userId, userId))
      .orderBy(desc(loginLogs.loginAt))
      .limit(1);

    if (existingLog) {
      const loginTime = new Date(existingLog.loginAt);
      const sessionDuration = Math.floor((now.getTime() - loginTime.getTime()) / 1000);

      await db.update(loginLogs)
        .set({
          logoutAt: now,
          sessionDurationSeconds: sessionDuration,
        })
        .where(eq(loginLogs.id, existingLog.id));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Audit] Error logging logout:', error);
    res.status(500).json({ error: 'Failed to log logout' });
  }
});

// POST /api/audit/activity - Log an activity event
router.post('/activity', async (req: Request, res: Response) => {
  try {
    const { 
      userId, 
      userEmail, 
      actionType,
      actionDetails,
      resourceType,
      resourceId,
      resourceName,
      metadata 
    } = req.body;

    if (!userId || !userEmail || !actionType) {
      return res.status(400).json({ error: 'userId, userEmail, and actionType are required' });
    }

    const ipAddress = getClientIP(req);
    const { deviceType } = parseUserAgent(req.headers['user-agent']);

    const [result] = await db.insert(activityLogs).values({
      userId,
      userEmail,
      actionType,
      actionDetails: actionDetails || null,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      resourceName: resourceName || null,
      ipAddress,
      deviceType,
      metadata: metadata || null,
    }).returning();

    res.json({ success: true, logId: result.id });
  } catch (error) {
    console.error('[Audit] Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// GET /api/audit/logins - Get login logs (admin only)
router.get('/logins', async (req: Request, res: Response) => {
  try {
    const { 
      userId, 
      startDate, 
      endDate, 
      limit = '100',
      offset = '0' 
    } = req.query;

    const conditions: SQL<unknown>[] = [];
    if (userId) {
      conditions.push(eq(loginLogs.userId, userId as string));
    }
    if (startDate) {
      conditions.push(gte(loginLogs.loginAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(loginLogs.loginAt, new Date(endDate as string)));
    }

    const results = await db.select()
      .from(loginLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(loginLogs.loginAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(loginLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      logs: results,
      total: countResult?.count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('[Audit] Error fetching login logs:', error);
    res.status(500).json({ error: 'Failed to fetch login logs' });
  }
});

// GET /api/audit/activities - Get activity logs (admin only)
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const { 
      userId, 
      actionType,
      startDate, 
      endDate, 
      limit = '100',
      offset = '0' 
    } = req.query;

    const conditions: SQL<unknown>[] = [];
    if (userId) {
      conditions.push(eq(activityLogs.userId, userId as string));
    }
    if (actionType) {
      conditions.push(eq(activityLogs.actionType, actionType as string));
    }
    if (startDate) {
      conditions.push(gte(activityLogs.timestamp, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(activityLogs.timestamp, new Date(endDate as string)));
    }

    const results = await db.select()
      .from(activityLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityLogs.timestamp))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      logs: results,
      total: countResult?.count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('[Audit] Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// GET /api/audit/stats - Get audit statistics (admin only)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Login stats
    const [loginsLast24h] = await db.select({ count: sql<number>`count(*)` })
      .from(loginLogs)
      .where(gte(loginLogs.loginAt, last24h));

    const [loginsLast7d] = await db.select({ count: sql<number>`count(*)` })
      .from(loginLogs)
      .where(gte(loginLogs.loginAt, last7d));

    const [loginsLast30d] = await db.select({ count: sql<number>`count(*)` })
      .from(loginLogs)
      .where(gte(loginLogs.loginAt, last30d));

    // Unique users
    const [uniqueUsersLast24h] = await db.select({ count: sql<number>`count(distinct user_id)` })
      .from(loginLogs)
      .where(gte(loginLogs.loginAt, last24h));

    const [uniqueUsersLast7d] = await db.select({ count: sql<number>`count(distinct user_id)` })
      .from(loginLogs)
      .where(gte(loginLogs.loginAt, last7d));

    // Failed logins
    const [failedLogins] = await db.select({ count: sql<number>`count(*)` })
      .from(loginLogs)
      .where(and(eq(loginLogs.success, false), gte(loginLogs.loginAt, last7d)));

    // Activity stats
    const [activitiesLast24h] = await db.select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(gte(activityLogs.timestamp, last24h));

    res.json({
      logins: {
        last24h: loginsLast24h?.count || 0,
        last7d: loginsLast7d?.count || 0,
        last30d: loginsLast30d?.count || 0,
        failedLast7d: failedLogins?.count || 0,
      },
      uniqueUsers: {
        last24h: uniqueUsersLast24h?.count || 0,
        last7d: uniqueUsersLast7d?.count || 0,
      },
      activities: {
        last24h: activitiesLast24h?.count || 0,
      },
    });
  } catch (error) {
    console.error('[Audit] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

// ============================================================
// ANALYTICS ENDPOINTS — Master admin only (jfprince@soltec.ca)
// ============================================================

// GET /api/audit/analytics/overview - Key metrics dashboard
router.get('/analytics/overview', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const { userEmail } = req.query;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const selectedWindow = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const emailCond = userEmail ? eq(loginLogs.userEmail, userEmail as string) : undefined;
    const actEmailCond = userEmail ? eq(activityLogs.userEmail, userEmail as string) : undefined;

    const baseLoginWhere = (since: Date) => emailCond ? and(gte(loginLogs.loginAt, since), emailCond) : gte(loginLogs.loginAt, since);
    const baseActWhere = (since: Date, type?: string) => {
      const conds = [gte(activityLogs.timestamp, since)];
      if (type) conds.push(eq(activityLogs.actionType, type));
      if (actEmailCond) conds.push(actEmailCond);
      return and(...conds);
    };

    const totalWhere = emailCond ? emailCond : undefined;

    const [total, last24hLogins, last7dLogins, last30dLogins, last90dLogins, selectedLogins] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(totalWhere),
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(baseLoginWhere(last24h)),
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(baseLoginWhere(last7d)),
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(baseLoginWhere(last30d)),
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(baseLoginWhere(last90d)),
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(baseLoginWhere(selectedWindow)),
    ]);

    const [uniqueUsers24h, uniqueUsers7d, uniqueUsers30d, uniqueUsers90d, uniqueUsersSelected] = await Promise.all([
      db.select({ count: sql<number>`count(distinct user_id)` }).from(loginLogs).where(baseLoginWhere(last24h)),
      db.select({ count: sql<number>`count(distinct user_id)` }).from(loginLogs).where(baseLoginWhere(last7d)),
      db.select({ count: sql<number>`count(distinct user_id)` }).from(loginLogs).where(baseLoginWhere(last30d)),
      db.select({ count: sql<number>`count(distinct user_id)` }).from(loginLogs).where(baseLoginWhere(last90d)),
      db.select({ count: sql<number>`count(distinct user_id)` }).from(loginLogs).where(baseLoginWhere(selectedWindow)),
    ]);

    const failedCond = emailCond
      ? and(eq(loginLogs.success, false), gte(loginLogs.loginAt, selectedWindow), emailCond)
      : and(eq(loginLogs.success, false), gte(loginLogs.loginAt, selectedWindow));
    const offlineCond = emailCond
      ? and(eq(loginLogs.loginMethod, 'offline'), gte(loginLogs.loginAt, selectedWindow), emailCond)
      : and(eq(loginLogs.loginMethod, 'offline'), gte(loginLogs.loginAt, selectedWindow));

    const [failedLoginsSelected, offlineLoginsSelected, activities24h, activitiesSelected,
      surveysCreatedSelected, surveysClosedSelected, surveysExportedSelected] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(failedCond),
      db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(offlineCond),
      db.select({ count: sql<number>`count(*)` }).from(activityLogs).where(baseActWhere(last24h)),
      db.select({ count: sql<number>`count(*)` }).from(activityLogs).where(baseActWhere(selectedWindow)),
      db.select({ count: sql<number>`count(*)` }).from(activityLogs).where(baseActWhere(selectedWindow, 'survey_create')),
      db.select({ count: sql<number>`count(*)` }).from(activityLogs).where(baseActWhere(selectedWindow, 'survey_close')),
      db.select({ count: sql<number>`count(*)` }).from(activityLogs).where(baseActWhere(selectedWindow, 'survey_export')),
    ]);

    res.json({
      totalLogins: total[0]?.count || 0,
      days,
      logins: {
        last24h: last24hLogins[0]?.count || 0,
        last7d: last7dLogins[0]?.count || 0,
        last30d: last30dLogins[0]?.count || 0,
        last90d: last90dLogins[0]?.count || 0,
        selected: selectedLogins[0]?.count || 0,
      },
      uniqueUsers: {
        last24h: uniqueUsers24h[0]?.count || 0,
        last7d: uniqueUsers7d[0]?.count || 0,
        last30d: uniqueUsers30d[0]?.count || 0,
        last90d: uniqueUsers90d[0]?.count || 0,
        selected: uniqueUsersSelected[0]?.count || 0,
      },
      failedLoginsSelected: failedLoginsSelected[0]?.count || 0,
      offlineLoginsSelected: offlineLoginsSelected[0]?.count || 0,
      activities: {
        last24h: activities24h[0]?.count || 0,
        selected: activitiesSelected[0]?.count || 0,
      },
      surveys: {
        createdSelected: surveysCreatedSelected[0]?.count || 0,
        closedSelected: surveysClosedSelected[0]?.count || 0,
        exportedSelected: surveysExportedSelected[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('[Analytics] Error fetching overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// GET /api/audit/analytics/logins-over-time - Daily login counts for chart
router.get('/analytics/logins-over-time', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { userEmail } = req.query;
    const whereClause = userEmail
      ? and(gte(loginLogs.loginAt, since), eq(loginLogs.userEmail, userEmail as string))
      : gte(loginLogs.loginAt, since);

    const results = await db.select({
      date: sql<string>`date_trunc('day', login_at)::date`,
      count: sql<number>`count(*)`,
      uniqueUsers: sql<number>`count(distinct user_id)`,
    })
      .from(loginLogs)
      .where(whereClause)
      .groupBy(sql`date_trunc('day', login_at)`)
      .orderBy(sql`date_trunc('day', login_at)`);

    res.json({ data: results, days });
  } catch (error) {
    console.error('[Analytics] Error fetching logins-over-time:', error);
    res.status(500).json({ error: 'Failed to fetch login time series' });
  }
});

// GET /api/audit/analytics/activity-breakdown - Activity counts by type
router.get('/analytics/activity-breakdown', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { userEmail } = req.query;
    const whereClause = userEmail
      ? and(gte(activityLogs.timestamp, since), eq(activityLogs.userEmail, userEmail as string))
      : gte(activityLogs.timestamp, since);

    const results = await db.select({
      actionType: activityLogs.actionType,
      count: sql<number>`count(*)`,
    })
      .from(activityLogs)
      .where(whereClause)
      .groupBy(activityLogs.actionType)
      .orderBy(desc(sql`count(*)`));

    res.json({ data: results, days });
  } catch (error) {
    console.error('[Analytics] Error fetching activity-breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch activity breakdown' });
  }
});

// GET /api/audit/analytics/top-users - Most active users
router.get('/analytics/top-users', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 10;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { userEmail } = req.query;
    const whereClause = userEmail
      ? and(gte(loginLogs.loginAt, since), eq(loginLogs.userEmail, userEmail as string))
      : gte(loginLogs.loginAt, since);

    const results = await db.select({
      userId: loginLogs.userId,
      userEmail: loginLogs.userEmail,
      loginCount: sql<number>`count(*)`,
      lastLogin: sql<string>`max(login_at)`,
    })
      .from(loginLogs)
      .where(whereClause)
      .groupBy(loginLogs.userId, loginLogs.userEmail)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    res.json({ data: results, days });
  } catch (error) {
    console.error('[Analytics] Error fetching top-users:', error);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

// GET /api/audit/analytics/device-breakdown - OS/browser/device breakdown
router.get('/analytics/device-breakdown', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { userEmail } = req.query;
    const loginWhere = (extraCond?: ReturnType<typeof eq>) =>
      extraCond ? and(gte(loginLogs.loginAt, since), extraCond) : gte(loginLogs.loginAt, since);
    const emailCond = userEmail ? eq(loginLogs.userEmail, userEmail as string) : undefined;

    const [byDevice, byBrowser, byOS] = await Promise.all([
      db.select({
        deviceType: loginLogs.deviceType,
        count: sql<number>`count(*)`,
      }).from(loginLogs).where(loginWhere(emailCond)).groupBy(loginLogs.deviceType).orderBy(desc(sql`count(*)`)),
      db.select({
        browser: loginLogs.browser,
        count: sql<number>`count(*)`,
      }).from(loginLogs).where(loginWhere(emailCond)).groupBy(loginLogs.browser).orderBy(desc(sql`count(*)`)),
      db.select({
        os: loginLogs.operatingSystem,
        count: sql<number>`count(*)`,
      }).from(loginLogs).where(loginWhere(emailCond)).groupBy(loginLogs.operatingSystem).orderBy(desc(sql`count(*)`)),
    ]);

    res.json({ byDevice, byBrowser, byOS, days });
  } catch (error) {
    console.error('[Analytics] Error fetching device-breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch device breakdown' });
  }
});

// GET /api/audit/analytics/recent-activity - Latest activity log entries
// Supports: ?limit=N, ?userEmail=foo, ?actionType=bar, ?startDate=ISO, ?endDate=ISO
router.get('/analytics/recent-activity', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { userEmail, actionType, startDate, endDate } = req.query;

    const conditions: SQL<unknown>[] = [];
    if (userEmail) conditions.push(eq(activityLogs.userEmail, userEmail as string));
    if (actionType) conditions.push(eq(activityLogs.actionType, actionType as string));
    if (startDate) conditions.push(gte(activityLogs.timestamp, new Date(startDate as string)));
    if (endDate) conditions.push(lte(activityLogs.timestamp, new Date(endDate as string)));

    const results = await db.select()
      .from(activityLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);

    res.json({ data: results });
  } catch (error) {
    console.error('[Analytics] Error fetching recent-activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// GET /api/audit/analytics/export-formats - Survey export format popularity
router.get('/analytics/export-formats', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { userEmail } = req.query;

    const conditions = [
      eq(activityLogs.actionType, 'survey_export'),
      gte(activityLogs.timestamp, since),
    ];
    if (userEmail) conditions.push(eq(activityLogs.userEmail, userEmail as string));

    // Pull all survey_export activity logs in the window, then group by metadata.format
    const rows = await db.select({
      metadata: activityLogs.metadata,
    })
      .from(activityLogs)
      .where(and(...conditions));

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const meta = row.metadata as Record<string, unknown> | null | undefined;
      const fmt = (typeof meta?.format === 'string' ? meta.format : null) || 'unknown';
      counts[fmt] = (counts[fmt] || 0) + 1;
    }

    const data = Object.entries(counts)
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ data, days, total: rows.length });
  } catch (error) {
    console.error('[Analytics] Error fetching export-formats:', error);
    res.status(500).json({ error: 'Failed to fetch export format breakdown' });
  }
});

// GET /api/audit/analytics/survey-activity - Daily survey creates/closes/exports timeseries
router.get('/analytics/survey-activity', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { userEmail } = req.query;

    const conditions = [
      sql`action_type IN ('survey_create','survey_close','survey_export')`,
      gte(activityLogs.timestamp, since),
    ];
    if (userEmail) conditions.push(eq(activityLogs.userEmail, userEmail as string));

    const rows = await db.select({
      date: sql<string>`date_trunc('day', timestamp)::date`,
      actionType: activityLogs.actionType,
      count: sql<number>`count(*)`,
    })
      .from(activityLogs)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', timestamp)`, activityLogs.actionType)
      .orderBy(sql`date_trunc('day', timestamp)`);

    // Pivot by date
    const byDate: Record<string, { date: string; creates: number; closes: number; exports: number }> = {};
    for (const row of rows) {
      const d = row.date;
      if (!byDate[d]) byDate[d] = { date: d, creates: 0, closes: 0, exports: 0 };
      if (row.actionType === 'survey_create') byDate[d].creates = Number(row.count);
      if (row.actionType === 'survey_close') byDate[d].closes = Number(row.count);
      if (row.actionType === 'survey_export') byDate[d].exports = Number(row.count);
    }

    res.json({ data: Object.values(byDate), days });
  } catch (error) {
    console.error('[Analytics] Error fetching survey-activity:', error);
    res.status(500).json({ error: 'Failed to fetch survey activity' });
  }
});

// GET /api/audit/analytics/login-methods - Online vs offline and method breakdown
router.get('/analytics/login-methods', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { userEmail } = req.query;
    const whereClause = userEmail
      ? and(gte(loginLogs.loginAt, since), eq(loginLogs.userEmail, userEmail as string))
      : gte(loginLogs.loginAt, since);

    const rows = await db.select({
      loginMethod: loginLogs.loginMethod,
      count: sql<number>`count(*)`,
    })
      .from(loginLogs)
      .where(whereClause)
      .groupBy(loginLogs.loginMethod)
      .orderBy(desc(sql`count(*)`));

    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    const offlineCount = rows.find(r => r.loginMethod === 'offline')?.count || 0;
    const onlineCount = total - Number(offlineCount);

    res.json({
      byMethod: rows,
      summary: { total, online: onlineCount, offline: Number(offlineCount) },
      days,
    });
  } catch (error) {
    console.error('[Analytics] Error fetching login-methods:', error);
    res.status(500).json({ error: 'Failed to fetch login methods' });
  }
});

// GET /api/audit/analytics/feature-usage - Top features accessed
router.get('/analytics/feature-usage', verifyMasterAdminAccess, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const limit = parseInt(req.query.limit as string) || 15;
    const { userEmail } = req.query;

    const conditions = [
      eq(activityLogs.actionType, 'feature_access'),
      gte(activityLogs.timestamp, since),
    ];
    if (userEmail) conditions.push(eq(activityLogs.userEmail, userEmail as string));

    const rows = await db.select({
      featureName: activityLogs.resourceName,
      userCount: sql<number>`count(distinct user_id)`,
      accessCount: sql<number>`count(*)`,
    })
      .from(activityLogs)
      .where(and(...conditions))
      .groupBy(activityLogs.resourceName)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    res.json({ data: rows, days });
  } catch (error) {
    console.error('[Analytics] Error fetching feature-usage:', error);
    res.status(500).json({ error: 'Failed to fetch feature usage' });
  }
});

export default router;
