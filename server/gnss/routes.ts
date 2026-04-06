/**
 * GNSS API Routes
 * Endpoints for GNSS data ingestion, querying, and status monitoring
 * Stage 3: Enhanced with strict identifier validation
 * Stage 4: Fixed config persistence and error handling
 */

import { Router, Request, Response } from 'express';
import { Socket } from 'net';
import { GnssFirestore } from './firestore.js';
import { GnssSample } from './types.js';
import { duroClient } from './duroClient.js';
import { gnssConfigService, GnssConfigData } from './configService.js';
import {
  StrictGnssSampleSchema,
  StrictRailCrossingEventSchema,
  createValidationErrorResponse,
  validateAndFilterArray,
} from './validation.js';
import {
  logGnssRejection,
  logGnssSync,
  logGnssValidation,
  getRequestId,
} from './logger.js';

export function createGnssRoutes(gnssFirestore: GnssFirestore): Router {
  const router = Router();

  /**
   * POST /api/gnss/ingest
   * Ingest GNSS samples from PWA (USB GPS or browser geolocation)
   * Stage 3: Enhanced with strict identifier validation
   */
  router.post('/ingest', async (req: Request, res: Response) => {
    try {
      const requestId = getRequestId(req.headers);
      const { sample, samples } = req.body;

      // Handle single sample
      if (sample) {
        // Validate sample with Zod schema
        const validation = StrictGnssSampleSchema.safeParse(sample);
        
        if (!validation.success) {
          logGnssValidation({
            timestamp: Date.now(),
            type: 'sample',
            success: false,
            errorCount: validation.error.issues.length,
            errors: validation.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
            requestId,
          });
          
          logGnssRejection({
            timestamp: Date.now(),
            endpoint: req.path,
            reason: 'Missing or invalid required identifiers',
            missingFields: validation.error.issues.map(i => i.path.join('.')),
            count: 1,
            requestId,
            sampleData: sample,
          });
          
          return res.status(422).json(createValidationErrorResponse(validation.error));
        }

        const id = await gnssFirestore.insertSample(validation.data);
        
        logGnssSync({
          timestamp: Date.now(),
          operation: 'ingest',
          accepted: 1,
          rejected: 0,
          surveyId: validation.data.surveyId,
          sessionId: validation.data.sessionId,
          requestId,
        });
        
        return res.json({ success: true, id });
      }

      // Handle batch samples
      if (samples && Array.isArray(samples)) {
        // Validate and filter samples
        const { valid, rejected, errors } = validateAndFilterArray(samples, StrictGnssSampleSchema);
        
        if (rejected > 0) {
          const missingFields = Array.from(
            new Set(
              errors.flatMap(e => e.issues.map(i => i.path.join('.')))
            )
          );
          
          logGnssRejection({
            timestamp: Date.now(),
            endpoint: req.path,
            reason: 'Missing or invalid required identifiers in batch',
            missingFields,
            count: rejected,
            requestId,
          });
        }

        if (valid.length === 0) {
          return res.status(422).json({
            success: false,
            error: 'No valid samples in batch',
            rejected: rejected,
            message: 'All samples rejected due to missing or invalid identifiers',
          });
        }

        const result = await gnssFirestore.insertSamplesBatch(valid);
        
        logGnssSync({
          timestamp: Date.now(),
          operation: 'batch',
          accepted: result.accepted,
          rejected: result.rejected + rejected,
          surveyId: valid[0]?.surveyId,
          sessionId: valid[0]?.sessionId,
          requestId,
        });
        
        return res.json({
          success: true,
          accepted: result.accepted,
          rejected: result.rejected + rejected,
          message: rejected > 0 ? `${rejected} samples rejected due to missing identifiers` : undefined,
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Must provide either "sample" or "samples" in request body',
      });
    } catch (error: any) {
      console.error('[GNSS API] Ingest error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/gnss/latest
   * Get latest GNSS samples
   */
  router.get('/latest', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string || '100', 10);
      const sessionId = req.query.sessionId as string | undefined;

      const samples = await gnssFirestore.getLatestSamples(limit, sessionId);
      return res.json({ success: true, samples });
    } catch (error: any) {
      console.error('[GNSS API] Latest query error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/gnss/range
   * Get GNSS samples by time range
   */
  router.get('/range', async (req: Request, res: Response) => {
    try {
      const start = req.query.start as string;
      const end = req.query.end as string;
      const sessionId = req.query.sessionId as string | undefined;
      const limit = parseInt(req.query.limit as string || '10000', 10);

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Must provide start and end timestamps (ISO 8601)',
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timestamp format. Use ISO 8601',
        });
      }

      const samples = await gnssFirestore.querySamplesByTime(
        startDate,
        endDate,
        sessionId,
        limit
      );

      return res.json({ success: true, samples });
    } catch (error: any) {
      console.error('[GNSS API] Range query error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/gnss/health
   * Get GNSS system health status
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const duroStatus = duroClient.getStatus();

      return res.json({
        success: true,
        duro: duroStatus,
        firestore: {
          enabled: true,
        },
      });
    } catch (error: any) {
      console.error('[GNSS API] Health check error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/gnss/rail-crossing
   * Manually log a rail crossing event
   * Stage 3: Enhanced with strict identifier validation
   */
  router.post('/rail-crossing', async (req: Request, res: Response) => {
    try {
      const requestId = getRequestId(req.headers);
      const { surveyId, sessionId, profileId, lat, lon, distance_m, notes } = req.body;

      // Build event object for validation
      const eventData = {
        surveyId,
        sessionId,
        profileId,
        detection_method: 'manual' as const,
        distance_m: distance_m || 0,
        lat,
        lon,
        timestamp: new Date().toISOString(),
        notes,
      };

      // Validate with Zod schema
      const validation = StrictRailCrossingEventSchema.safeParse(eventData);
      
      if (!validation.success) {
        logGnssValidation({
          timestamp: Date.now(),
          type: 'event',
          success: false,
          errorCount: validation.error.issues.length,
          errors: validation.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
          requestId,
        });
        
        logGnssRejection({
          timestamp: Date.now(),
          endpoint: req.path,
          reason: 'Missing or invalid required identifiers for rail crossing event',
          missingFields: validation.error.issues.map(i => i.path.join('.')),
          count: 1,
          requestId,
        });
        
        return res.status(422).json(createValidationErrorResponse(validation.error));
      }

      const eventId = await gnssFirestore.saveRailCrossingEvent(validation.data);
      
      logGnssSync({
        timestamp: Date.now(),
        operation: 'event',
        accepted: 1,
        rejected: 0,
        surveyId: validation.data.surveyId,
        sessionId: validation.data.sessionId,
        profileId: validation.data.profileId,
        requestId,
      });

      return res.json({ success: true, id: eventId });
    } catch (error: any) {
      console.error('[GNSS API] Rail crossing error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/gnss/config
   * Get current GNSS configuration
   */
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = gnssConfigService.getConfig();
      console.log('[GNSS API] Config retrieved successfully');
      return res.json(config);
    } catch (error: any) {
      console.error('[GNSS API] Config read error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to read configuration',
        details: error.message 
      });
    }
  });

  /**
   * POST /api/gnss/config
   * Update GNSS configuration with persistence
   */
  router.post('/config', (req: Request, res: Response) => {
    try {
      const body = req.body;
      
      if (!body || typeof body !== 'object') {
        return res.status(400).json({
          error: 'Request body must be a JSON object',
          details: { received: typeof body }
        });
      }

      // Validate mode if provided
      if (body.mode !== undefined && !['direct', 'nmea'].includes(body.mode)) {
        return res.status(400).json({
          error: 'Invalid mode value',
          details: { validValues: ['direct', 'nmea'], received: body.mode }
        });
      }

      // Validate serverMode if provided
      if (body.serverMode !== undefined && !['local', 'cloud'].includes(body.serverMode)) {
        return res.status(400).json({
          error: 'Invalid serverMode value',
          details: { validValues: ['local', 'cloud'], received: body.serverMode }
        });
      }

      // Validate ports if provided
      if (body.dataPort !== undefined) {
        const port = parseInt(body.dataPort);
        if (isNaN(port) || port < 1 || port > 65535) {
          return res.status(400).json({
            error: 'Invalid dataPort value',
            details: { validRange: '1-65535', received: body.dataPort }
          });
        }
        body.dataPort = port;
      }

      if (body.nmeaPort !== undefined) {
        const port = parseInt(body.nmeaPort);
        if (isNaN(port) || port < 1 || port > 65535) {
          return res.status(400).json({
            error: 'Invalid nmeaPort value',
            details: { validRange: '1-65535', received: body.nmeaPort }
          });
        }
        body.nmeaPort = port;
      }

      // Validate host if provided
      if (body.host !== undefined && typeof body.host !== 'string') {
        return res.status(400).json({
          error: 'Invalid host value',
          details: { expected: 'string', received: typeof body.host }
        });
      }

      const updatedConfig = gnssConfigService.updateConfig(body);
      console.log('[GNSS API] Config updated:', updatedConfig);

      // Handle enable/disable state changes
      if (body.enabled === false) {
        // User explicitly disabled - disconnect immediately
        console.log('[GNSS API] Duro disabled by user, disconnecting...');
        duroClient.disconnect();
      } else if (updatedConfig.enabled && (body.host || body.dataPort || body.mode || body.enabled === true)) {
        // Enabled and connection params changed - reconnect
        console.log('[GNSS API] Reconnecting with new settings...');
        duroClient.disconnect();
        setTimeout(() => {
          duroClient.connect();
        }, 1000);
      }

      return res.json(updatedConfig);
    } catch (error: any) {
      console.error('[GNSS API] Config update error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update configuration',
        details: error.message 
      });
    }
  });

  /**
   * POST /api/gnss/reconnect
   * Force Duro reconnect with status response
   */
  router.post('/reconnect', (req: Request, res: Response) => {
    try {
      const config = gnssConfigService.getConfig();

      // Check if in cloud mode with private network target
      if (config.serverMode === 'cloud' && gnssConfigService.isPrivateNetwork(config.host)) {
        return res.status(400).json({
          error: 'Cannot connect to private network from cloud server',
          details: {
            host: config.host,
            serverMode: config.serverMode,
            suggestion: 'Run the server locally to connect to LAN devices, or set serverMode to "local"'
          }
        });
      }

      if (!config.enabled) {
        return res.status(400).json({
          error: 'GNSS connection is disabled',
          details: {
            enabled: false,
            suggestion: 'Enable GNSS in configuration first by setting enabled: true'
          }
        });
      }

      const activePort = gnssConfigService.getActivePort();
      console.log(`[GNSS API] Reconnecting to ${config.host}:${activePort} (${config.mode} mode)`);

      duroClient.disconnect();
      setTimeout(() => {
        duroClient.connect();
      }, 500);

      const status = duroClient.getStatus();

      return res.json({
        status: 'reconnecting',
        host: config.host,
        port: activePort,
        mode: config.mode,
        uptimeSec: status.uptime_s || 0,
        samples: status.samples_received || 0
      });
    } catch (error: any) {
      console.error('[GNSS API] Reconnect error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to initiate reconnect',
        details: error.message 
      });
    }
  });

  /**
   * POST /api/gnss/test-connection
   * Test TCP connection to the Duro without establishing persistent connection
   */
  router.post('/test-connection', async (req: Request, res: Response) => {
    try {
      const config = gnssConfigService.getConfig();
      const { host, port } = req.body;
      
      const testHost = host || config.host;
      const testPort = port || gnssConfigService.getActivePort();
      const isPrivate = gnssConfigService.isPrivateNetwork(testHost);

      // Auto-detect if we're running on cloud (Replit) or local
      const isRunningOnCloud = process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT;
      
      // Check if trying to test cloud -> private network
      if (isRunningOnCloud && isPrivate) {
        return res.json({
          success: false,
          host: testHost,
          port: testPort,
          status: 'network_unreachable',
          isPrivateNetwork: true,
          isCloudServer: true,
          error: 'This server is running on Replit cloud and cannot reach private LAN addresses like 192.168.x.x',
          suggestion: 'To connect to your Duro receiver, you need to run MeasurePRO locally on a device that is on the same network as the Duro (e.g., your field laptop).',
          details: {
            serverEnvironment: 'Replit Cloud',
            targetNetwork: 'Private LAN (192.168.x.x, 10.x.x.x, or 172.16-31.x.x)',
            reason: 'Cloud servers on the internet cannot route to private IP addresses'
          }
        });
      }

      console.log(`[GNSS API] Testing TCP connection to ${testHost}:${testPort}...`);

      const result = await testTcpConnection(testHost, testPort, 5000);
      
      return res.json({
        success: result.success,
        host: testHost,
        port: testPort,
        status: result.success ? 'connected' : 'failed',
        isPrivateNetwork: isPrivate,
        isCloudServer: !!isRunningOnCloud,
        latencyMs: result.latencyMs,
        error: result.error,
        details: result.success 
          ? { message: `Successfully connected to Duro at ${testHost}:${testPort} in ${result.latencyMs}ms` }
          : { 
              message: `Failed to connect to ${testHost}:${testPort}`,
              possibleCauses: [
                'Duro receiver is not powered on',
                'Duro IP address is incorrect (check receiver settings)',
                'Port number is wrong (Direct Mode: 55556, NMEA Mode: 2101)',
                'Firewall blocking the connection',
                'Device not on the same network as Duro'
              ]
            }
      });
    } catch (error: any) {
      console.error('[GNSS API] Test connection error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to test connection',
        details: error.message 
      });
    }
  });

  /**
   * GET /api/gnss/ping
   * Simple diagnostic endpoint to check network reachability
   */
  router.get('/ping', async (req: Request, res: Response) => {
    const host = req.query.host as string;
    const config = gnssConfigService.getConfig();
    const targetHost = host || config.host;
    const isPrivate = gnssConfigService.isPrivateNetwork(targetHost);
    const isRunningOnCloud = !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT);

    // DNS resolution check (doesn't require the device to be reachable)
    let dnsResult = { resolved: false, addresses: [] as string[], error: '' };
    
    try {
      const dns = await import('dns').then(m => m.promises);
      const addresses = await dns.lookup(targetHost, { all: true });
      dnsResult = { 
        resolved: true, 
        addresses: addresses.map(a => a.address),
        error: ''
      };
    } catch (err: any) {
      dnsResult = { 
        resolved: false, 
        addresses: [],
        error: err.code === 'ENOTFOUND' ? 'Hostname not found' : err.message
      };
    }

    return res.json({
      success: true,
      targetHost,
      isPrivateNetwork: isPrivate,
      isCloudServer: isRunningOnCloud,
      canReach: isRunningOnCloud && isPrivate ? false : 'unknown',
      dns: dnsResult,
      serverInfo: {
        environment: isRunningOnCloud ? 'Replit Cloud' : 'Local/Self-hosted',
        replId: process.env.REPL_ID || null,
      },
      recommendation: isRunningOnCloud && isPrivate 
        ? 'Run MeasurePRO on a local device to connect to LAN hardware'
        : 'Use Test Connection to verify TCP connectivity'
    });
  });

  /**
   * GET /api/gnss/live
   * Get real-time GNSS data including position, IMU/attitude, and velocity
   * Used by the PWA's DuroGpsService for live data polling
   */
  router.get('/live', (req: Request, res: Response) => {
    try {
      const liveData = duroClient.getLiveData();
      return res.json(liveData);
    } catch (error: any) {
      console.error('[GNSS API] Live data error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get live GNSS data',
        details: error.message 
      });
    }
  });

  /**
   * GET /api/gnss/status
   * Get detailed connection status
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const config = gnssConfigService.getConfig();
      const duroStatus = duroClient.getStatus();
      const activePort = gnssConfigService.getActivePort();

      return res.json({
        connected: duroStatus.connected,
        enabled: config.enabled,
        host: config.host,
        port: activePort,
        mode: config.mode,
        serverMode: config.serverMode,
        uptimeSec: duroStatus.uptime_s || 0,
        samples: duroStatus.samples_received || 0,
        reconnectAttempts: duroStatus.reconnect_attempts || 0,
        warning: config.serverMode === 'cloud' && gnssConfigService.isPrivateNetwork(config.host)
          ? 'Cloud server cannot reach private network addresses. Run locally.'
          : undefined
      });
    } catch (error: any) {
      console.error('[GNSS API] Status error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get status',
        details: error.message 
      });
    }
  });

  return router;
}

/**
 * Test TCP connection with timeout
 */
function testTcpConnection(host: string, port: number, timeout: number): Promise<{
  success: boolean;
  latencyMs?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new Socket();

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const latencyMs = Date.now() - startTime;
      cleanup();
      resolve({ success: true, latencyMs });
    });

    socket.on('error', (err) => {
      cleanup();
      resolve({ success: false, error: err.message });
    });

    socket.on('timeout', () => {
      cleanup();
      resolve({ success: false, error: 'Connection timed out' });
    });

    socket.connect(port, host);
  });
}
