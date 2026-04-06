/**
 * GNSS Configuration
 * Centralized configuration for Duro TCP, correction services, and road profiling
 */

export interface GnssConfig {
  // Server settings
  serverPort: number;
  
  // Duro TCP settings
  duroMode: 'tcp' | 'disabled';
  duroTcpHost: string;
  duroTcpPort: number;
  duroReconnectDelay_ms: number;
  duroReconnectMaxDelay_ms: number;
  duroReconnectBackoffMultiplier: number;
  
  // Road profile defaults
  profileDefaultStep_m: number;
  profileDefaultGradeTrigger_pct: number;
  
  // K-Factor thresholds (AASHTO/Transport Canada typical values)
  kFactorConvexWarning_m: number; // sharp crest warning
  kFactorConvexCritical_m: number; // sharp crest critical
  kFactorConcaveWarning_m: number; // sharp sag warning (negative)
  kFactorConcaveCritical_m: number; // sharp sag critical (negative)
  
  // Rail crossing detection
  railCrossingElevationThreshold_m: number; // elevation spike to detect bump
  railCrossingWindowSize: number; // number of points to analyze
  
  // NTRIP client settings (for PPP/RTK corrections)
  ntripEnabled: boolean;
  ntripHost?: string;
  ntripPort?: number;
  ntripMountpoint?: string;
  ntripUsername?: string;
  ntripPassword?: string;
  
  // Firebase/Firestore
  firestoreEnabled: boolean;
  firestoreRetentionDays: number; // auto-cleanup old samples
  
  // WebSocket broadcasting
  wsEnabled: boolean;
  wsBroadcastGnss: boolean;
  wsBroadcastEvents: boolean;
}

/**
 * Load configuration from environment variables
 */
export function loadGnssConfig(): GnssConfig {
  return {
    serverPort: parseInt(process.env.SERVER_PORT || '3001', 10),
    
    // Duro settings
    duroMode: (process.env.DURO_MODE as 'tcp' | 'disabled') || 'disabled',
    duroTcpHost: process.env.DURO_TCP_HOST || '192.168.0.10',
    duroTcpPort: parseInt(process.env.DURO_TCP_PORT || '2101', 10),
    duroReconnectDelay_ms: 2000, // start with 2s
    duroReconnectMaxDelay_ms: 60000, // max 60s
    duroReconnectBackoffMultiplier: 1.5,
    
    // Road profile defaults
    profileDefaultStep_m: parseFloat(process.env.ROAD_PROFILE_DEFAULT_STEP_M || '5'),
    profileDefaultGradeTrigger_pct: parseFloat(process.env.ROAD_PROFILE_DEFAULT_GRADE_TRIGGER_PCT || '10'),
    
    // K-Factor defaults (AASHTO Design Guide typical values)
    // Convex (crests): K < 10,000m is sharp, K < 5,000m is critical
    // Concave (sags): K > -8,000m is sharp, K > -4,000m is critical
    kFactorConvexWarning_m: parseFloat(process.env.K_FACTOR_CONVEX_WARNING || '10000'),
    kFactorConvexCritical_m: parseFloat(process.env.K_FACTOR_CONVEX_CRITICAL || '5000'),
    kFactorConcaveWarning_m: parseFloat(process.env.K_FACTOR_CONCAVE_WARNING || '-8000'),
    kFactorConcaveCritical_m: parseFloat(process.env.K_FACTOR_CONCAVE_CRITICAL || '-4000'),
    
    // Rail crossing detection
    railCrossingElevationThreshold_m: parseFloat(process.env.RAIL_CROSSING_THRESHOLD || '0.15'), // 15cm spike
    railCrossingWindowSize: parseInt(process.env.RAIL_CROSSING_WINDOW || '5', 10),
    
    // NTRIP settings
    ntripEnabled: process.env.NTRIP_ENABLED === 'true',
    ntripHost: process.env.NTRIP_HOST,
    ntripPort: process.env.NTRIP_PORT ? parseInt(process.env.NTRIP_PORT, 10) : undefined,
    ntripMountpoint: process.env.NTRIP_MOUNTPOINT,
    ntripUsername: process.env.NTRIP_USERNAME,
    ntripPassword: process.env.NTRIP_PASSWORD,
    
    // Firestore
    firestoreEnabled: true,
    firestoreRetentionDays: parseInt(process.env.FIRESTORE_RETENTION_DAYS || '90', 10),
    
    // WebSocket
    wsEnabled: true,
    wsBroadcastGnss: true,
    wsBroadcastEvents: true,
  };
}

// Global config instance
export const gnssConfig = loadGnssConfig();
