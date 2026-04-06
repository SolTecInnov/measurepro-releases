/**
 * Road Profile API Routes
 * RESTful endpoints for road profiling, grade analysis, and event detection
 * Stage 3: Enhanced with strict identifier validation
 */

import { Router, Request, Response } from 'express';
import { GnssFirestore } from './firestore.js';
import { generateRoadProfile, detectGradeEvents, detectKFactorEvents, detectRailCrossings, calculateProfileSummary } from './roadProfile.js';
import { gnssConfig } from './config.js';
import { GnssSample, RoadProfile, ProfileSection, RailCrossingEvent } from './types.js';
import {
  StrictRoadProfileSchema,
  StrictRailCrossingEventSchema,
  createValidationErrorResponse,
  profileHasRequiredIdentifiers,
  eventHasRequiredIdentifiers,
} from './validation.js';
import {
  logGnssRejection,
  logGnssSync,
  logGnssValidation,
  getRequestId,
} from './logger.js';

export function createProfileRoutes(gnssFirestore: GnssFirestore): Router {
  const router = Router();

  /**
   * GET /api/road-profile/by-time
   * Generate road profile from time range
   * 
   * Query params:
   * - start: ISO timestamp (required)
   * - end: ISO timestamp (required)
   * - step: Resampling interval in meters (default 5)
   * - gradeThreshold: Grade trigger percentage (default 12)
   * - kFactorConvexMin: Convex K-factor warning threshold (default from config)
   * - kFactorConcaveMin: Concave K-factor warning threshold (default from config)
   * - sessionId: Session ID filter (optional)
   */
  router.get('/by-time', async (req: Request, res: Response) => {
    try {
      const { start, end, step, gradeThreshold, kFactorConvexMin, kFactorConcaveMin, sessionId } = req.query;

      // Validate required params
      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameters: start and end timestamps are required',
        });
      }

      const startDate = new Date(start as string);
      const endDate = new Date(end as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-15T10:30:00Z)',
        });
      }

      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start time must be before end time',
        });
      }

      // Parse options
      const step_m = step ? parseFloat(step as string) : gnssConfig.profileDefaultStep_m;
      const grade_trigger_pct = gradeThreshold
        ? parseFloat(gradeThreshold as string)
        : gnssConfig.profileDefaultGradeTrigger_pct;
      const k_factor_convex_min = kFactorConvexMin
        ? parseFloat(kFactorConvexMin as string)
        : gnssConfig.kFactorConvexWarning_m;
      const k_factor_concave_min = kFactorConcaveMin
        ? parseFloat(kFactorConcaveMin as string)
        : gnssConfig.kFactorConcaveWarning_m;

      // Fetch GNSS samples
      const samples = await gnssFirestore.querySamplesByTime(
        startDate,
        endDate,
        sessionId as string | undefined
      );

      if (samples.length === 0) {
        return res.json({
          success: true,
          message: 'No GNSS samples found for the specified time range',
          profile: null,
          gradeEvents: [],
          kFactorEvents: [],
          railCrossings: [],
        });
      }

      // Generate profile
      const result = generateRoadProfile(samples, {
        step_m,
        grade_trigger_pct,
        k_factor_convex_min,
        k_factor_concave_min,
        sessionId: sessionId as string | undefined,
      });

      return res.json({
        success: true,
        profile: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          step_m,
          grade_trigger_pct,
          k_factor_convex_min,
          k_factor_concave_min,
          summary: result.summary,
          points: result.points,
          sampleCount: samples.length,
        },
        gradeEvents: result.gradeEvents,
        kFactorEvents: result.kFactorEvents,
        railCrossings: result.railCrossings,
      });
    } catch (error: any) {
      console.error('Get profile by time error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate road profile',
      });
    }
  });

  /**
   * GET /api/road-profile/recent
   * Generate road profile from recent samples
   * 
   * Query params:
   * - duration_sec: Duration in seconds to look back (default 300 = 5 minutes)
   * - step: Resampling interval in meters (default 5)
   * - gradeThreshold: Grade trigger percentage (default 12)
   * - kFactorConvexMin: Convex K-factor warning threshold
   * - kFactorConcaveMin: Concave K-factor warning threshold
   * - sessionId: Session ID filter (optional)
   */
  router.get('/recent', async (req: Request, res: Response) => {
    try {
      const { duration_sec, step, gradeThreshold, kFactorConvexMin, kFactorConcaveMin, sessionId } = req.query;

      const durationSec = duration_sec ? parseInt(duration_sec as string, 10) : 300; // default 5 min
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - durationSec * 1000);

      const step_m = step ? parseFloat(step as string) : gnssConfig.profileDefaultStep_m;
      const grade_trigger_pct = gradeThreshold
        ? parseFloat(gradeThreshold as string)
        : gnssConfig.profileDefaultGradeTrigger_pct;
      const k_factor_convex_min = kFactorConvexMin
        ? parseFloat(kFactorConvexMin as string)
        : gnssConfig.kFactorConvexWarning_m;
      const k_factor_concave_min = kFactorConcaveMin
        ? parseFloat(kFactorConcaveMin as string)
        : gnssConfig.kFactorConcaveWarning_m;

      // Fetch recent samples
      const samples = await gnssFirestore.querySamplesByTime(
        startDate,
        endDate,
        sessionId as string | undefined
      );

      if (samples.length === 0) {
        return res.json({
          success: true,
          message: `No GNSS samples found in the last ${durationSec} seconds`,
          profile: null,
          gradeEvents: [],
          kFactorEvents: [],
          railCrossings: [],
        });
      }

      // Generate profile
      const result = generateRoadProfile(samples, {
        step_m,
        grade_trigger_pct,
        k_factor_convex_min,
        k_factor_concave_min,
        sessionId: sessionId as string | undefined,
      });

      return res.json({
        success: true,
        profile: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          step_m,
          grade_trigger_pct,
          k_factor_convex_min,
          k_factor_concave_min,
          summary: result.summary,
          points: result.points,
          sampleCount: samples.length,
        },
        gradeEvents: result.gradeEvents,
        kFactorEvents: result.kFactorEvents,
        railCrossings: result.railCrossings,
      });
    } catch (error: any) {
      console.error('Get recent profile error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate recent road profile',
      });
    }
  });

  /**
   * POST /api/road-profile/save-by-time
   * Compute and save road profile to Firestore with all events
   * 
   * Body:
   * - start: ISO timestamp (required)
   * - end: ISO timestamp (required)
   * - surveyId: Survey ID (optional - for survey integration)
   * - sessionId: Session ID (optional - for convoy integration)
   * - step: Resampling interval (optional)
   * - gradeThreshold: Grade trigger percentage (optional)
   * - kFactorConvexMin: Convex K-factor threshold (optional)
   * - kFactorConcaveMin: Concave K-factor threshold (optional)
   * - label: Profile label/name (optional)
   */
  router.post('/save-by-time', async (req: Request, res: Response) => {
    try {
      const {
        start,
        end,
        surveyId,
        sessionId,
        step,
        gradeThreshold,
        kFactorConvexMin,
        kFactorConcaveMin,
        label,
      } = req.body;

      // Validate required fields
      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: start and end timestamps are required',
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format',
        });
      }

      const step_m = step ?? gnssConfig.profileDefaultStep_m;
      const grade_trigger_pct = gradeThreshold ?? gnssConfig.profileDefaultGradeTrigger_pct;
      const k_factor_convex_min = kFactorConvexMin ?? gnssConfig.kFactorConvexWarning_m;
      const k_factor_concave_min = kFactorConcaveMin ?? gnssConfig.kFactorConcaveWarning_m;

      // Fetch samples
      const samples = await gnssFirestore.querySamplesByTime(startDate, endDate, sessionId);

      if (samples.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No GNSS samples found for the specified time range',
        });
      }

      // Generate profile
      const result = generateRoadProfile(samples, {
        step_m,
        grade_trigger_pct,
        k_factor_convex_min,
        k_factor_concave_min,
        sessionId,
      });

      // Save profile to Firestore
      const profileData: Omit<RoadProfile, 'id' | 'created_at'> = {
        surveyId,
        sessionId,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        step_m,
        grade_trigger_pct,
        k_factor_convex_min,
        k_factor_concave_min,
        summary: result.summary,
        points: result.points,
        ...(label && { label }),
      };

      // Stage 3: Validate profile data with Zod schema
      const requestId = getRequestId(req.headers);
      const profileValidation = StrictRoadProfileSchema.safeParse(profileData);
      
      if (!profileValidation.success) {
        logGnssValidation({
          timestamp: Date.now(),
          type: 'profile',
          success: false,
          errorCount: profileValidation.error.issues.length,
          errors: profileValidation.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
          requestId,
        });
        
        logGnssRejection({
          timestamp: Date.now(),
          endpoint: req.path,
          reason: 'Missing or invalid required identifiers for profile',
          missingFields: profileValidation.error.issues.map(i => i.path.join('.')),
          count: 1,
          requestId,
        });
        
        return res.status(422).json(createValidationErrorResponse(profileValidation.error));
      }

      const profileId = await gnssFirestore.saveProfile(profileData);
      
      console.log(`[Road Profile] Saving events for profileId=${profileId}, surveyId=${surveyId}, sessionId=${sessionId}`);
      
      const savedGradeEvents = await Promise.all(
        result.gradeEvents.map(event =>
          gnssFirestore.saveGradeEvent({ ...event, profileId, surveyId, sessionId })
        )
      );

      const savedKFactorEvents = await Promise.all(
        result.kFactorEvents.map(event =>
          gnssFirestore.saveKFactorEvent({ ...event, profileId, surveyId, sessionId })
        )
      );

      const savedRailCrossings = await Promise.all(
        result.railCrossings.map(event =>
          gnssFirestore.saveRailCrossingEvent({ ...event, profileId, surveyId, sessionId })
        )
      );
      
      console.log(`[Road Profile] Saved ${savedGradeEvents.length} grade events, ${savedKFactorEvents.length} K-factor events, ${savedRailCrossings.length} rail crossings`);
      
      logGnssSync({
        timestamp: Date.now(),
        operation: 'profile',
        accepted: 1 + savedGradeEvents.length + savedKFactorEvents.length + savedRailCrossings.length,
        rejected: 0,
        surveyId,
        sessionId,
        profileId,
        requestId,
      });

      return res.status(201).json({
        success: true,
        profileId,
        summary: result.summary,
        eventCounts: {
          gradeEvents: savedGradeEvents.length,
          kFactorEvents: savedKFactorEvents.length,
          railCrossings: savedRailCrossings.length,
        },
      });
    } catch (error: any) {
      console.error('Save profile by time error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to save road profile',
      });
    }
  });

  /**
   * POST /api/road-profile/save-section
   * Extract and save a section of an existing profile
   * 
   * Body:
   * - profileId: Source profile ID (required)
   * - fromDistance_m: Start distance in meters (required)
   * - toDistance_m: End distance in meters (required)
   * - label: Section label/name (optional)
   */
  router.post('/save-section', async (req: Request, res: Response) => {
    try {
      const { profileId, fromDistance_m, toDistance_m, label } = req.body;

      // Validate required fields
      if (!profileId || fromDistance_m === undefined || toDistance_m === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: profileId, fromDistance_m, and toDistance_m are required',
        });
      }

      if (fromDistance_m >= toDistance_m) {
        return res.status(400).json({
          success: false,
          error: 'fromDistance_m must be less than toDistance_m',
        });
      }

      // Load profile
      const profile = await gnssFirestore.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: `Profile not found: ${profileId}`,
        });
      }

      // Extract section points
      const sectionPoints = profile.points.filter(
        point => point.distance_m >= fromDistance_m && point.distance_m <= toDistance_m
      );

      if (sectionPoints.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No points found in the specified distance range',
        });
      }

      // Adjust distances to start from 0
      const adjustedPoints = sectionPoints.map(point => ({
        ...point,
        distance_m: point.distance_m - fromDistance_m,
      }));

      // CRITICAL: Recompute events for THIS SECTION using detection functions
      const gradeEvents = detectGradeEvents(adjustedPoints, profile.grade_trigger_pct);
      const kFactorEvents = detectKFactorEvents(
        adjustedPoints,
        profile.k_factor_convex_min,
        profile.k_factor_concave_min
      );
      const railCrossings = detectRailCrossings(
        adjustedPoints,
        gnssConfig.railCrossingElevationThreshold_m,
        gnssConfig.railCrossingWindowSize
      );

      // Recompute summary using calculateProfileSummary
      const summary = calculateProfileSummary(
        adjustedPoints,
        gradeEvents,
        kFactorEvents,
        railCrossings
      );

      // Save section
      const sectionData: Omit<ProfileSection, 'id' | 'profileId' | 'created_at'> = {
        fromDistance_m,
        toDistance_m,
        summary,
        points: adjustedPoints,
        ...(label && { label }),
      };

      const sectionId = await gnssFirestore.saveProfileSection(profileId, sectionData);

      // Inherit surveyId/sessionId from parent profile
      const parentProfile = await gnssFirestore.getProfile(profileId);
      const { surveyId, sessionId } = parentProfile || {};

      // STEP 3 & 5: Validate required identifiers before saving events
      if (!surveyId || !sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required identifiers for profile section',
          missing: { surveyId: !surveyId, sessionId: !sessionId },
          profileId
        });
      }
      
      console.log(`[Road Profile] Saving section events: sectionId=${sectionId}, surveyId=${surveyId}, sessionId=${sessionId}`);

      // Save events with profileId, sectionId, and inherited survey/session IDs
      await Promise.all([
        ...gradeEvents.map(event =>
          gnssFirestore.saveGradeEvent({ ...event, sectionId, profileId, surveyId, sessionId })
        ),
        ...kFactorEvents.map(event =>
          gnssFirestore.saveKFactorEvent({ ...event, sectionId, profileId, surveyId, sessionId })
        ),
        ...railCrossings.map(event =>
          gnssFirestore.saveRailCrossingEvent({ ...event, sectionId, profileId, surveyId, sessionId })
        ),
      ]);

      return res.status(201).json({
        success: true,
        id: sectionId,
        summary,
        eventCounts: {
          gradeEvents: gradeEvents.length,
          kFactorEvents: kFactorEvents.length,
          railCrossings: railCrossings.length,
        },
      });
    } catch (error: any) {
      console.error('Save profile section error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to save profile section',
      });
    }
  });

  /**
   * POST /api/road-profile/rail-crossing/manual
   * Manually log a rail crossing event
   * 
   * Body:
   * - lat: Latitude (optional - may not be available for manual events)
   * - lon: Longitude (optional - may not be available for manual events)
   * - timestamp: ISO timestamp (optional, defaults to now)
   * - distance_m: Distance along route (optional, defaults to 0)
   * - notes: Notes about the crossing (optional)
   * - surveyId: Survey ID (required)
   * - sessionId: Session ID (required)
   * - profileId: Profile ID (required)
   */
  router.post('/rail-crossing/manual', async (req: Request, res: Response) => {
    try {
      const { lat, lon, timestamp, distance_m, notes, sessionId, profileId } = req.body;

      // STEP 3: Manual rail crossing requires surveyId
      // Extract from request body or from profile if profileId is provided
      const { surveyId: reqSurveyId } = req.body;
      let finalSurveyId = reqSurveyId;
      let finalSessionId = sessionId;
      let finalProfileId = profileId;
      
      if (!finalSurveyId && profileId) {
        // Try to get surveyId from profile
        const profile = await gnssFirestore.getProfile(profileId);
        if (profile) {
          finalSurveyId = profile.surveyId;
          finalSessionId = finalSessionId || profile.sessionId;
        }
      }
      
      if (!finalSurveyId || !finalSessionId || !finalProfileId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: surveyId, sessionId, and profileId are required for manual rail crossing events',
        });
      }

      // Build event data with optional coordinates
      const eventData: any = {
        detection_method: 'manual' as const,
        distance_m: distance_m ?? 0,
        surveyId: finalSurveyId,
        sessionId: finalSessionId,
        profileId: finalProfileId,
      };

      // Only include coordinates if provided
      if (lat !== undefined) eventData.latitude = lat;
      if (lon !== undefined) eventData.longitude = lon;
      if (timestamp) eventData.timestamp = timestamp;
      if (notes) eventData.notes = notes;

      // Stage 3: Validate event data with Zod schema
      const requestId = getRequestId(req.headers);
      const eventValidation = StrictRailCrossingEventSchema.safeParse(eventData);
      
      if (!eventValidation.success) {
        logGnssValidation({
          timestamp: Date.now(),
          type: 'event',
          success: false,
          errorCount: eventValidation.error.issues.length,
          errors: eventValidation.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
          requestId,
        });
        
        logGnssRejection({
          timestamp: Date.now(),
          endpoint: req.path,
          reason: 'Missing or invalid required identifiers for manual rail crossing',
          missingFields: eventValidation.error.issues.map(i => i.path.join('.')),
          count: 1,
          requestId,
        });
        
        return res.status(422).json(createValidationErrorResponse(eventValidation.error));
      }

      console.log(`[Road Profile] Saving manual rail crossing: surveyId=${finalSurveyId}, sessionId=${finalSessionId}, profileId=${finalProfileId}`);
      const eventId = await gnssFirestore.saveRailCrossingEvent(eventValidation.data);
      
      logGnssSync({
        timestamp: Date.now(),
        operation: 'event',
        accepted: 1,
        rejected: 0,
        surveyId: finalSurveyId,
        sessionId: finalSessionId,
        profileId: finalProfileId,
        requestId,
      });

      return res.status(201).json({
        success: true,
        eventId,
        message: 'Rail crossing event logged successfully',
      });
    } catch (error: any) {
      console.error('Manual rail crossing log error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to log rail crossing event',
      });
    }
  });

  /**
   * GET /api/road-profile/grade-events
   * Get grade events by profileId or sessionId
   * 
   * Query params:
   * - profileId: Profile ID (optional)
   * - sessionId: Session ID (optional)
   */
  router.get('/grade-events', async (req: Request, res: Response) => {
    try {
      const { profileId, sessionId } = req.query;

      if (!profileId && !sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Must provide profileId or sessionId',
        });
      }

      let events: any[];
      if (profileId) {
        events = await gnssFirestore.getGradeEventsByProfile(profileId as string);
      } else {
        events = await gnssFirestore.getGradeEventsBySession(sessionId as string);
      }

      return res.json({ success: true, data: events });
    } catch (error: any) {
      console.error('Get grade events error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch grade events',
      });
    }
  });

  /**
   * GET /api/road-profile/k-factor-events
   * Get K-factor events by profileId or sessionId
   * 
   * Query params:
   * - profileId: Profile ID (optional)
   * - sessionId: Session ID (optional)
   */
  router.get('/k-factor-events', async (req: Request, res: Response) => {
    try {
      const { profileId, sessionId } = req.query;

      if (!profileId && !sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Must provide profileId or sessionId',
        });
      }

      let events: any[];
      if (profileId) {
        events = await gnssFirestore.getKFactorEventsByProfile(profileId as string);
      } else {
        events = await gnssFirestore.getKFactorEventsBySession(sessionId as string);
      }

      return res.json({ success: true, data: events });
    } catch (error: any) {
      console.error('Get K-factor events error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch K-factor events',
      });
    }
  });

  /**
   * GET /api/road-profile/rail-crossing-events
   * Get rail crossing events by profileId or sessionId
   * 
   * Query params:
   * - profileId: Profile ID (optional)
   * - sessionId: Session ID (optional)
   */
  router.get('/rail-crossing-events', async (req: Request, res: Response) => {
    try {
      const { profileId, sessionId } = req.query;

      if (!profileId && !sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Must provide profileId or sessionId',
        });
      }

      let events: any[];
      if (profileId) {
        events = await gnssFirestore.getRailCrossingEventsByProfile(profileId as string);
      } else {
        events = await gnssFirestore.getRailCrossingEventsBySession(sessionId as string);
      }

      return res.json({ success: true, data: events });
    } catch (error: any) {
      console.error('Get rail crossing events error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch rail crossing events',
      });
    }
  });

  /**
   * GET /api/road-profile/list
   * Get all saved profiles
   * 
   * Query params:
   * - limit: Maximum number of profiles to return (default 100)
   */
  router.get('/list', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string || '100', 10);
      const profiles = await gnssFirestore.listProfiles(limit);

      return res.json({ success: true, data: profiles });
    } catch (error: any) {
      console.error('List profiles error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to list profiles',
      });
    }
  });

  /**
   * GET /api/road-profile/by-survey/:surveyId
   * List all profiles linked to a specific survey
   */
  router.get('/by-survey/:surveyId', async (req: Request, res: Response) => {
    try {
      const { surveyId } = req.params;

      const profiles = await gnssFirestore.getProfilesBySurvey(surveyId);

      return res.json({
        success: true,
        surveyId,
        count: profiles.length,
        data: profiles,
      });
    } catch (error: any) {
      console.error('Get profiles by survey error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch profiles for survey',
      });
    }
  });

  /**
   * GET /api/road-profile/:profileId
   * Get saved road profile by ID
   */
  router.get('/:profileId', async (req: Request, res: Response) => {
    try {
      const { profileId } = req.params;

      const profile = await gnssFirestore.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: `Profile not found: ${profileId}`,
        });
      }

      // Fetch associated events
      const [gradeEvents, kFactorEvents, railCrossings] = await Promise.all([
        gnssFirestore.getGradeEventsByProfile(profileId),
        gnssFirestore.getKFactorEventsByProfile(profileId),
        gnssFirestore.getRailCrossingEventsByProfile(profileId),
      ]);

      return res.json({
        success: true,
        profile,
        gradeEvents,
        kFactorEvents,
        railCrossings,
      });
    } catch (error: any) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get road profile',
      });
    }
  });

  return router;
}
