/**
 * RoadScope Integration API Routes
 * Handles saving/loading RoadScope settings for users
 * Also proxies API calls to RoadScope to avoid CORS issues
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { roadScopeSettings, roadScopeSurveyMappings } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

// RoadScope API base URL
const ROADSCOPE_API_URL = process.env.ROADSCOPE_API_URL || 'https://roadscope.app/api/measurepro';

/**
 * Extract API key from request headers
 * Supports both x-api-key header and Authorization: Bearer header
 */
function extractApiKey(req: Request): string | null {
  // Check x-api-key header first
  const xApiKey = req.headers['x-api-key'] as string;
  if (xApiKey) {
    return xApiKey;
  }
  
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  return null;
}

/**
 * Proxy helper to forward requests to RoadScope API
 * @param authHeader - The raw Authorization header to forward (e.g., "Bearer mpro_xxx")
 */
async function proxyToRoadScope(
  endpoint: string,
  method: string,
  authHeader: string | null,
  body?: any,
  timeout: number = 30000
): Promise<{ status: number; data: any }> {
  const url = `${ROADSCOPE_API_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Forward Authorization header directly - this is critical!
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  console.log(`[RoadScope Proxy] ${method} ${url}`);
  console.log(`[RoadScope Proxy] Authorization header present: ${!!authHeader}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json().catch(() => ({}));
    console.log(`[RoadScope Proxy] Response: ${response.status}`);
    return { status: response.status, data };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return { status: 408, data: { success: false, error: 'Request timeout' } };
    }
    
    console.error('[RoadScope Proxy] Error:', error.message);
    return { status: 500, data: { success: false, error: error.message || 'Network error' } };
  }
}

// ===== PROXY ROUTES =====
// These routes forward requests to the RoadScope API to avoid CORS issues

// Health check (no auth required)
router.get('/proxy/health', async (_req: Request, res: Response) => {
  const result = await proxyToRoadScope('/health', 'GET', null);
  return res.status(result.status).json(result.data);
});

// Validate API key
router.post('/proxy/auth/validate', async (req: Request, res: Response) => {
  try {
    console.log('[RoadScope Proxy] /auth/validate called');
    console.log('[RoadScope Proxy] Request body:', JSON.stringify(req.body || {}));
    
    const body = req.body || {};
    const { apiKey, userId } = body;
    
    // Get API key from request body or from stored settings
    let keyToUse = apiKey;
    
    if (!keyToUse && userId) {
      try {
        console.log('[RoadScope Proxy] No apiKey in body, fetching from database for userId:', userId);
        const settings = await db.select()
          .from(roadScopeSettings)
          .where(eq(roadScopeSettings.userId, userId))
          .limit(1);
        
        if (settings.length > 0 && settings[0].apiKey) {
          keyToUse = settings[0].apiKey;
          console.log('[RoadScope Proxy] Found stored API key');
        } else {
          console.log('[RoadScope Proxy] No stored API key found');
        }
      } catch (err) {
        console.error('[RoadScope Proxy] Error fetching stored key:', err);
      }
    }
    
    if (!keyToUse) {
      console.log('[RoadScope Proxy] No API key available');
      return res.status(400).json({ success: false, error: 'No API key provided' });
    }
    
    // Construct the Authorization header
    const authHeader = `Bearer ${keyToUse}`;
    console.log('[RoadScope Proxy] Calling RoadScope /auth/validate with key:', keyToUse.substring(0, 10) + '...');
    const result = await proxyToRoadScope('/auth/validate', 'POST', authHeader, {});
    console.log('[RoadScope Proxy] RoadScope response:', result.status, JSON.stringify(result.data));
    
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    console.error('[RoadScope Proxy] Unexpected error in /auth/validate:', error);
    console.error('[RoadScope Proxy] Stack:', error.stack);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal proxy error', 
      details: error.message 
    });
  }
});

// Get POI types
router.get('/proxy/poi-types', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || null;
  const result = await proxyToRoadScope('/poi-types', 'GET', authHeader);
  return res.status(result.status).json(result.data);
});

// List surveys
router.get('/proxy/surveys', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || null;
  const result = await proxyToRoadScope('/surveys', 'GET', authHeader);
  return res.status(result.status).json(result.data);
});

// Create/update survey
router.post('/proxy/surveys', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || null;
  const result = await proxyToRoadScope('/surveys', 'POST', authHeader, req.body);
  return res.status(result.status).json(result.data);
});

// Batch upsert POIs
router.post('/proxy/surveys/:surveyId/pois', async (req: Request, res: Response) => {
  const { surveyId } = req.params;
  const authHeader = req.headers.authorization || null;
  const result = await proxyToRoadScope(`/surveys/${surveyId}/pois`, 'POST', authHeader, req.body);
  return res.status(result.status).json(result.data);
});

// Batch upsert routes
router.post('/proxy/surveys/:surveyId/routes', async (req: Request, res: Response) => {
  const { surveyId } = req.params;
  const authHeader = req.headers.authorization || null;
  const result = await proxyToRoadScope(`/surveys/${surveyId}/routes`, 'POST', authHeader, req.body);
  return res.status(result.status).json(result.data);
});

// Get upload URLs
router.post('/proxy/surveys/:surveyId/upload-urls', async (req: Request, res: Response) => {
  const { surveyId } = req.params;
  const authHeader = req.headers.authorization || null;
  const result = await proxyToRoadScope(`/surveys/${surveyId}/upload-urls`, 'POST', authHeader, req.body);
  return res.status(result.status).json(result.data);
});

// Register files
router.post('/proxy/surveys/:surveyId/files', async (req: Request, res: Response) => {
  const { surveyId } = req.params;
  const authHeader = req.headers.authorization || null;
  const result = await proxyToRoadScope(`/surveys/${surveyId}/files`, 'POST', authHeader, req.body);
  return res.status(result.status).json(result.data);
});

// ===== END PROXY ROUTES =====

// Get RoadScope settings for a user
router.get('/settings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const settings = await db.select()
      .from(roadScopeSettings)
      .where(eq(roadScopeSettings.userId, userId))
      .limit(1);

    if (settings.length === 0) {
      return res.json({ success: true, data: null });
    }

    // Mask the API key for security (only show last 4 characters)
    const data = settings[0];
    const maskedKey = data.apiKey 
      ? `mpro_${'*'.repeat(56)}${data.apiKey.slice(-4)}`
      : null;

    return res.json({
      success: true,
      data: {
        ...data,
        apiKey: maskedKey,
        hasApiKey: !!data.apiKey
      }
    });
  } catch (error) {
    console.error('[RoadScope] Error getting settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

// Save RoadScope settings for a user
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, apiKey, autoSyncEnabled, syncInterval } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({ success: false, error: 'userId and userEmail are required' });
    }

    // Validate API key format if provided: mpro_ (5 chars) + 64 hex chars = 69 total
    if (apiKey && (!apiKey.startsWith('mpro_') || apiKey.length !== 69)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid API key format. Must start with mpro_ followed by 64 characters.' 
      });
    }

    const existing = await db.select()
      .from(roadScopeSettings)
      .where(eq(roadScopeSettings.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const updateData: any = {
        userEmail,
        autoSyncEnabled: autoSyncEnabled ?? false,
        syncInterval: syncInterval ?? 60,
        updatedAt: new Date()
      };

      // Only update API key if a new one is provided (not masked)
      if (apiKey && !apiKey.includes('*')) {
        updateData.apiKey = apiKey;
        updateData.apiKeyValidated = false; // Reset validation on key change
      }

      await db.update(roadScopeSettings)
        .set(updateData)
        .where(eq(roadScopeSettings.userId, userId));
    } else {
      // Insert new
      await db.insert(roadScopeSettings).values({
        userId,
        userEmail,
        apiKey: apiKey && !apiKey.includes('*') ? apiKey : null,
        apiKeyValidated: false,
        autoSyncEnabled: autoSyncEnabled ?? false,
        syncInterval: syncInterval ?? 60
      });
    }

    return res.json({ success: true, message: 'Settings saved' });
  } catch (error) {
    console.error('[RoadScope] Error saving settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// Update API key validation status
router.post('/settings/validate', async (req: Request, res: Response) => {
  try {
    const { userId, valid, scopes, expiresAt } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    await db.update(roadScopeSettings)
      .set({
        apiKeyValidated: valid,
        apiKeyScopes: scopes,
        apiKeyExpiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date()
      })
      .where(eq(roadScopeSettings.userId, userId));

    return res.json({ success: true });
  } catch (error) {
    console.error('[RoadScope] Error updating validation:', error);
    return res.status(500).json({ success: false, error: 'Failed to update validation' });
  }
});

// Get the actual API key for sync (internal use only)
router.get('/settings/:userId/key', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const settings = await db.select()
      .from(roadScopeSettings)
      .where(eq(roadScopeSettings.userId, userId))
      .limit(1);

    if (settings.length === 0 || !settings[0].apiKey) {
      return res.json({ success: false, error: 'No API key found' });
    }

    return res.json({ success: true, apiKey: settings[0].apiKey });
  } catch (error) {
    console.error('[RoadScope] Error getting key:', error);
    return res.status(500).json({ success: false, error: 'Failed to get key' });
  }
});

// Delete API key
router.delete('/settings/:userId/key', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    await db.update(roadScopeSettings)
      .set({
        apiKey: null,
        apiKeyValidated: false,
        apiKeyScopes: null,
        apiKeyExpiresAt: null,
        updatedAt: new Date()
      })
      .where(eq(roadScopeSettings.userId, userId));

    return res.json({ success: true });
  } catch (error) {
    console.error('[RoadScope] Error deleting key:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete key' });
  }
});

// Survey Mappings

// Get mappings for a user
router.get('/mappings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const mappings = await db.select()
      .from(roadScopeSurveyMappings)
      .where(eq(roadScopeSurveyMappings.userId, userId));

    return res.json({ success: true, data: mappings });
  } catch (error) {
    console.error('[RoadScope] Error getting mappings:', error);
    return res.status(500).json({ success: false, error: 'Failed to get mappings' });
  }
});

// Get mapping for a specific survey
router.get('/mappings/:userId/:measureproSurveyId', async (req: Request, res: Response) => {
  try {
    const { userId, measureproSurveyId } = req.params;

    const mappings = await db.select()
      .from(roadScopeSurveyMappings)
      .where(
        and(
          eq(roadScopeSurveyMappings.userId, userId),
          eq(roadScopeSurveyMappings.measureproSurveyId, measureproSurveyId)
        )
      )
      .limit(1);

    if (mappings.length === 0) {
      return res.json({ success: true, data: null });
    }

    return res.json({ success: true, data: mappings[0] });
  } catch (error) {
    console.error('[RoadScope] Error getting mapping:', error);
    return res.status(500).json({ success: false, error: 'Failed to get mapping' });
  }
});

// Create/update survey mapping
router.post('/mappings', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      measureproSurveyId,
      roadscopeSurveyId,
      roadscopeSurveyName,
      linkType,
      syncStatus,
      lastSyncPoiCount,
      lastSyncRouteCount,
      lastSyncFileCount,
      syncError
    } = req.body;

    if (!userId || !measureproSurveyId || !roadscopeSurveyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId, measureproSurveyId, and roadscopeSurveyId are required' 
      });
    }

    // Check for existing mapping
    const existing = await db.select()
      .from(roadScopeSurveyMappings)
      .where(
        and(
          eq(roadScopeSurveyMappings.userId, userId),
          eq(roadScopeSurveyMappings.measureproSurveyId, measureproSurveyId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update
      await db.update(roadScopeSurveyMappings)
        .set({
          roadscopeSurveyId,
          roadscopeSurveyName,
          linkType: linkType || existing[0].linkType,
          syncStatus: syncStatus || existing[0].syncStatus,
          lastSyncAt: syncStatus === 'synced' ? new Date() : existing[0].lastSyncAt,
          lastSyncPoiCount: lastSyncPoiCount ?? existing[0].lastSyncPoiCount,
          lastSyncRouteCount: lastSyncRouteCount ?? existing[0].lastSyncRouteCount,
          lastSyncFileCount: lastSyncFileCount ?? existing[0].lastSyncFileCount,
          syncError: syncError ?? null,
          updatedAt: new Date()
        })
        .where(eq(roadScopeSurveyMappings.id, existing[0].id));

      return res.json({ success: true, data: { id: existing[0].id, updated: true } });
    } else {
      // Insert
      const result = await db.insert(roadScopeSurveyMappings).values({
        userId,
        measureproSurveyId,
        roadscopeSurveyId,
        roadscopeSurveyName,
        linkType: linkType || 'created',
        syncStatus: syncStatus || 'pending'
      }).returning();

      return res.json({ success: true, data: { id: result[0].id, created: true } });
    }
  } catch (error) {
    console.error('[RoadScope] Error saving mapping:', error);
    return res.status(500).json({ success: false, error: 'Failed to save mapping' });
  }
});

// Delete survey mapping
router.delete('/mappings/:userId/:measureproSurveyId', async (req: Request, res: Response) => {
  try {
    const { userId, measureproSurveyId } = req.params;

    await db.delete(roadScopeSurveyMappings)
      .where(
        and(
          eq(roadScopeSurveyMappings.userId, userId),
          eq(roadScopeSurveyMappings.measureproSurveyId, measureproSurveyId)
        )
      );

    return res.json({ success: true });
  } catch (error) {
    console.error('[RoadScope] Error deleting mapping:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete mapping' });
  }
});

export default router;
