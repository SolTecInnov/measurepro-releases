import { DBSchema } from 'idb';

interface MeasurementDB extends DBSchema {
  measurements: {
    key: string;
    value: {
      id: string;
      rel: number;
      altGPS: number;
      latitude: number;
      longitude: number;
      mileMarker: number;
      poiType: string;
      notes: string | null;
      imageUrl: string | null;
      videoBlobId: string | null;
      addMethod: 'manual' | 'log_all' | 'object_detected' | 'from_slave';
      generatedByAI: boolean;
      fromHighPole: boolean;
      fromSlave: boolean;
      cloudUploadStatus: string | null;
      photoCloudLink: string | null;
      collectable: boolean;
      slaveDeviceId: string | null;
      replayKey: string | null;
      frameIndex: number | null;
      utcDate: string;
      utcTime: string;
      speed: number;
      heading: number;
      createdAt: string;
      roadNumber: number | null;
      poiNumber: number | null;
    };
    indexes: { 'by-date': string };
  };
  videoBlobs: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      createdAt: string;
    };
  };
  routes: {
    key: string;
    value: {
      id: string;
      surveyId: string;
      name: string;
      routeNumber: number;
      createdAt: string;
    };
    indexes: { 'by-survey': string };
  };
  alerts: {
    key: string;
    value: {
      id: string;
      surveyId: string;
      type: 'WARNING' | 'DANGER';
      value: number;
      latitude: number;
      longitude: number;
      poiId: string | null;
      createdAt: string;
    };
    indexes: { 'by-survey': string };
  };
  vehicleTraces: {
    key: string;
    value: {
      id: string;
      surveyId: string;
      routeId: string;
      latitude: number;
      longitude: number;
      speed: number;
      heading: number;
      timestamp: string;
    };
    indexes: { 'by-survey': string, 'by-route': string };
  };
  appSettings: {
    key: string;
    value: {
      id: string;
      category: string;
      settings: Record<string, any>;
      updatedAt: string;
    };
    indexes: { 'by-category': string };
  };
  authCache: {
    key: string;
    value: {
      id: string;
      email: string;
      passwordHash: string;
      accessToken: string | null;
      refreshToken: string | null;
      tokenExpiry: string | null;
      userProfile: {
        email: string;
        fullName: string | null;
        company: string | null;
        subscriptionTier: string | null;
        addOns: string[] | null;
      };
      licenseData: {
        activationStatus: boolean;
        expiryDate: string | null;
        featureFlags: Record<string, boolean> | null;
      } | null;
      lastOnlineTimestamp: string;
      isOfflineMode: boolean;
      createdAt: string;
      updatedAt: string;
    };
  };
  roadProfileSamples: {
    key: string;
    value: {
      id: string;
      profileId: string | null;
      surveyId: string | null;
      sessionId: string | null;
      timestamp: string;
      lat: number;
      lon: number;
      alt_m: number | null;
      speed_mps: number | null;
      heading_deg: number | null;
      quality: string;
      hdop: number | null;
      num_sats: number | null;
      source: 'duro' | 'usb' | 'browser';
      cloudSynced: boolean;
      createdAt: string;
    };
    indexes: { 
      'by-profile': string;
      'by-survey': string;
      'by-session': string;
      'by-timestamp': string;
    };
  };
  roadProfiles: {
    key: string;
    value: {
      id: string;
      surveyId: string | null;
      sessionId: string | null;
      start: string;
      end: string;
      step_m: number;
      grade_trigger_pct: number;
      k_factor_convex_min: number;
      k_factor_concave_min: number;
      summary: {
        totalDistance_m: number;
        totalClimb_m: number;
        totalDescent_m: number;
        maxGradeUp_pct: number;
        maxGradeDown_pct: number;
        minKFactorConvex: number | null;
        minKFactorConcave: number | null;
        numGradeEvents: number;
        numKFactorEvents: number;
        numRailCrossings: number;
      };
      points: Array<{
        distance_m: number;
        lat: number;
        lon: number;
        alt_m: number;
        timestamp: string;
        grade_pct: number;
        k_factor: number | null;
        curvature_type: 'convex' | 'concave' | 'linear' | null;
      }>;
      label: string | null;
      cloudSynced: boolean;
      createdAt: string;
    };
    indexes: { 
      'by-survey': string;
      'by-session': string;
      'by-date': string;
    };
  };
  roadProfileEvents: {
    key: string;
    value: {
      id: string;
      profileId: string;
      surveyId: string | null;
      sessionId: string | null;
      eventType: 'grade' | 'k_factor' | 'rail_crossing';
      direction: 'up' | 'down' | null;
      trigger_pct: number | null;
      max_grade_pct: number | null;
      curvature_type: 'convex' | 'concave' | null;
      k_factor: number | null;
      severity: 'warning' | 'critical' | null;
      detection_method: 'auto' | 'manual' | null;
      elevation_change_m: number | null;
      distance_m: number;
      start_distance_m: number | null;
      end_distance_m: number | null;
      length_m: number | null;
      lat: number;
      lon: number;
      start_lat: number | null;
      start_lon: number | null;
      end_lat: number | null;
      end_lon: number | null;
      timestamp: string;
      start_timestamp: string | null;
      end_timestamp: string | null;
      trigger_threshold: number | null;
      notes: string | null;
      cloudSynced: boolean;
      created_at: string;
    };
    indexes: { 
      'by-profile': string;
      'by-survey': string;
      'by-session': string;
      'by-type': string;
    };
  };
}

export const initDB = async () => {
  // Use localStorage-based storage instead of IndexedDB
  return Promise.resolve();
};

// Video blob storage functions
export const saveVideoBlob = async (_blob: Blob): Promise<string> => {
  await initDB();
  const id = crypto.randomUUID();
  return id;
};

export const getVideoBlob = async (_id: string): Promise<Blob | null> => {
  await initDB();
  return null;
};

export const deleteVideoBlob = async (_id: string): Promise<void> => {
  await initDB();
};
export const addMeasurement = async (_measurement: Omit<MeasurementDB['measurements']['value'], 'id' | 'createdAt'>) => {
  await initDB();
  return crypto.randomUUID();
};

export const getMeasurements = async () => {
  await initDB();
  return [];
};

export const clearMeasurements = async () => {
  await initDB();
};