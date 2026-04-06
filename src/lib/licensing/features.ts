/**
 * Licensed Feature Keys
 * These correspond to the feature keys created in the admin licensing panel
 */
export const LICENSED_FEATURES = {
  // AI & Detection
  AI_DETECTION: 'ai_detection',
  AI_TRAINING_DATA: 'ai_training_data',
  ROI_DETECTION: 'roi_detection',
  
  // Premium Camera Features
  ZED2I_SUPPORT: 'zed2i_support',
  STEREO_DEPTH: 'stereo_depth',
  ENVELOPE_CLEARANCE: 'envelope_clearance',
  
  // Advanced Analysis
  SWEPT_PATH_ANALYSIS: 'swept_path_analysis',
  TURN_PREDICTION: 'turn_prediction',
  COLLISION_DETECTION: 'collision_detection',
  
  // Convoy Features
  CONVOY_GUARDIAN: 'convoy_guardian',
  CONVOY_BLACKBOX: 'convoy_blackbox',
  MULTI_VEHICLE_COORDINATION: 'multi_vehicle_coordination',
  
  // Route Enforcement
  ROUTE_ENFORCEMENT: 'route_enforcement',
  ROUTE_COMPLIANCE: 'route_compliance',
  GEOFENCING: 'geofencing',
  
  // Data & Export
  ADVANCED_EXPORT: 'advanced_export',
  CLOUD_SYNC: 'cloud_sync',
  YOLO_EXPORT: 'yolo_export',
  
  // Video & Media
  GEO_REFERENCED_VIDEO: 'geo_referenced_video',
  TIMELAPSE: 'timelapse',
  POI_SYNC: 'poi_sync',
  
  // Professional Tools
  LIVE_MONITORING: 'live_monitoring',
  SLAVE_APP: 'slave_app',
  STREAM_DECK_INTEGRATION: 'stream_deck_integration',
  
  // Hardware Integration
  LASER_DISTANCE_METER: 'laser_distance_meter',
  GPS_HARDWARE: 'gps_hardware',
  SERIAL_DEVICES: 'serial_devices',
  
  // 3D Scanning
  POINT_CLOUD_SCANNING: 'point_cloud_scanning',
} as const;

/**
 * Feature Categories for organization
 */
export const FEATURE_CATEGORIES = {
  CORE: 'core',
  PREMIUM: 'premium',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

/**
 * Feature Display Names and Descriptions
 * Used for UI display and documentation
 */
export const FEATURE_INFO: Record<string, { name: string; description: string; category: string; [key: string]: any }> = {
  [LICENSED_FEATURES.AI_DETECTION]: {
    name: 'AI Object Detection',
    description: 'Real-time AI-powered object detection using TensorFlow.js',
    category: FEATURE_CATEGORIES.PREMIUM,
  },
  [LICENSED_FEATURES.ZED2I_SUPPORT]: {
    name: 'ZED 2i Camera Support',
    description: 'Support for ZED 2i stereo camera with depth sensing',
    category: FEATURE_CATEGORIES.PROFESSIONAL,
  },
  [LICENSED_FEATURES.ENVELOPE_CLEARANCE]: {
    name: 'Envelope Clearance Monitoring',
    description: 'Real-time vehicle clearance monitoring with color-coded alerts',
    category: FEATURE_CATEGORIES.PROFESSIONAL,
  },
  [LICENSED_FEATURES.SWEPT_PATH_ANALYSIS]: {
    name: 'Swept Path Analysis',
    description: 'Real-time road boundary detection and turn simulation with off-tracking calculation',
    category: FEATURE_CATEGORIES.PROFESSIONAL,
  },
  [LICENSED_FEATURES.CONVOY_GUARDIAN]: {
    name: 'Convoy Guardian',
    description: 'Multi-vehicle convoy coordination with black box logging',
    category: FEATURE_CATEGORIES.ENTERPRISE,
  },
  [LICENSED_FEATURES.ROUTE_ENFORCEMENT]: {
    name: 'Permitted Route Enforcement',
    description: 'GPS-based route compliance monitoring for permitted loads',
    category: FEATURE_CATEGORIES.ENTERPRISE,
  },
  [LICENSED_FEATURES.GEO_REFERENCED_VIDEO]: {
    name: 'Geo-Referenced Video Recording',
    description: 'Video recording with GPS coordinates and POI synchronization',
    category: FEATURE_CATEGORIES.PREMIUM,
  },
  [LICENSED_FEATURES.LIVE_MONITORING]: {
    name: 'Live Monitoring',
    description: 'Real-time monitoring dashboard for remote oversight',
    category: FEATURE_CATEGORIES.PROFESSIONAL,
  },
  [LICENSED_FEATURES.CLOUD_SYNC]: {
    name: 'Cloud Synchronization',
    description: 'Automatic sync of data to Firebase cloud storage',
    category: FEATURE_CATEGORIES.PREMIUM,
  },
  [LICENSED_FEATURES.POINT_CLOUD_SCANNING]: {
    name: '3D Point Cloud Scanning',
    description: 'Professional infrastructure scanning with ZED 2i camera',
    category: FEATURE_CATEGORIES.PREMIUM,
    storageQuota: {
      basic: 20 * 1024 * 1024, // 20MB
      pro: 50 * 1024 * 1024,   // 50MB
      enterprise: 100 * 1024 * 1024 // 100MB
    }
  },
};

/**
 * Check if a feature is available in the free tier
 */
export function isFreeTierFeature(featureKey: string): boolean {
  const freeTierFeatures = [
    // Core measurement features
    'basic_measurement',
    'overhead_detection',
    'gps_tracking',
    'photo_capture',
    'data_logging',
    'local_storage',
    'offline_mode',
  ];
  
  return freeTierFeatures.includes(featureKey);
}

/**
 * Get user-friendly error message for unlicensed feature
 */
export function getUnlicensedMessage(featureKey: string): string {
  const featureInfo = FEATURE_INFO[featureKey];
  const featureName = featureInfo?.name || 'This feature';
  
  return `${featureName} requires a valid license. Please contact your administrator or activate a license code to access this feature.`;
}
