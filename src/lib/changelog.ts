export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  changes: {
    type: 'added' | 'improved' | 'fixed' | 'security';
    description: string;
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.1.0',
    date: '2026-04-03',
    title: 'Enterprise Admin, Insta360 360° Camera & GNSS Profile Export',
    highlights: [
      'Insta360 360° camera add-on',
      'Survey Route Lock (GPS-enforced)',
      'Enterprise Admin Panel',
      'KML/KMZ/GPX GNSS profile export',
      'Pandar40P real UDP decoder',
      '40+ structured POI types'
    ],
    changes: [
      { type: 'added', description: 'Insta360 360° camera add-on — real-time 360° video capture with GPS sync, equirectangular preview, and full survey integration as a premium hardware add-on' },
      { type: 'added', description: 'Survey Route Lock — GPS-enforced navigation mode that restricts movement to operator-approved permitted routes; non-dismissable STOP alert on deviation (premium)' },
      { type: 'added', description: 'Enterprise Admin Panel — company management dashboard with user assignment, team grouping, per-member add-on control, and licence seat tracking' },
      { type: 'added', description: 'GNSS Profile Export in KML/KMZ and GPX formats with grade colour-coding, in addition to existing CSV/GeoJSON/Shapefile/DXF/LandXML outputs' },
      { type: 'added', description: 'Pandar40P real UDP decoder — live point cloud streaming via the real Hesai UDP protocol (replaces previous simulated data path)' },
      { type: 'added', description: 'Expanded POI type library to 40+ structured types covering bridges, overhead wires, traffic signals, rail crossings, road features, and more' },
      { type: 'added', description: 'OTP-based password reset flow — users receive a one-time code by email to securely reset their password without admin intervention' },
      { type: 'added', description: 'Analytics session tracking — anonymised session events logged for product improvement, with user opt-out in settings' },
      { type: 'improved', description: 'Voice command system expanded with additional POI type triggers and improved fuzzy-match recognition for noisy in-cab environments' },
      { type: 'improved', description: 'GNSS settings page rebuilt with clearer source priority UI and live satellite signal strength indicators' },
      { type: 'fixed', description: 'GNSS settings crash on devices without a connected Duro receiver — page now loads gracefully with an offline state banner' },
      { type: 'fixed', description: 'Phantom profile entries appearing in the road profile list after session close — caused by a double-flush race condition in the background service worker' },
      { type: 'fixed', description: 'Serial connection reliability — intermittent drops on Windows when tablet USB port enters selective suspend; keep-alive packet now sent every 25 s' },
      { type: 'fixed', description: 'Measurement pipeline edge case where a zero-distance laser return was accepted and logged as a valid reading; readings below 0.15 m are now rejected with a console warning' }
    ]
  },
  {
    version: '2.0.2',
    date: '2026-01-20',
    title: 'Real-time Road Profile Updates & Multi-Camera Support',
    highlights: [
      'Instant road profile visualization',
      'Multi-camera position support',
      'Background recording persistence'
    ],
    changes: [
      { type: 'added', description: 'Multi-camera position support for front, left, right, and rear cameras with automatic switching' },
      { type: 'improved', description: 'RoadProfileCard now updates in real-time via direct buffer subscription instead of polling' },
      { type: 'improved', description: 'GNSS session state displays immediately on component mount for faster feedback' },
      { type: 'improved', description: 'Position-specific camera capture for lateral/rear POI detection' },
      { type: 'improved', description: 'Background road profile recording continues when navigating between pages' },
      { type: 'fixed', description: 'Resource cleanup in camera capture with proper try/finally blocks' },
      { type: 'added', description: 'Public changelog page with version history for users' }
    ]
  },
  {
    version: '2.0.1',
    date: '2025-12-14',
    title: 'Multi-Laser System & Heavy Haul Safety Features',
    highlights: [
      'Up to 4 simultaneous laser connections',
      'Banking/cross-slope detection',
      'Curve radius safety alerts'
    ],
    changes: [
      { type: 'added', description: 'Multi-laser system supporting vertical, left lateral, right lateral, and rear ports simultaneously' },
      { type: 'added', description: 'Lateral width measurement with single or dual laser mode and vehicle offset calculations' },
      { type: 'added', description: 'Rear overhang monitoring for dry runs (wind blade transport) with threshold alerts up to 80m' },
      { type: 'added', description: 'Cross-slope detection from Duro IMU roll data with 3 modes: raw, filtered, stopped-only' },
      { type: 'added', description: 'Configurable banking alert thresholds: Normal (0-3°), Caution (3-5°), Warning (5-7°), Critical (7-10°)' },
      { type: 'added', description: 'Curve radius calculation from GPS trajectory using 3-point circumradius' },
      { type: 'added', description: 'Keyboard shortcuts for lateral width ([, ], \\) and rear overhang (\') capture' },
      { type: 'improved', description: 'Multi-laser store for managing independent laser connections with real-time status' }
    ]
  },
  {
    version: '2.0.0',
    date: '2025-11-01',
    title: 'Major Platform Update - Professional Export & GNSS Integration',
    highlights: [
      'Complete survey export pipeline',
      '3D LiDAR integration',
      'Swift Navigation Duro support',
      'Professional CAD formats'
    ],
    changes: [
      { type: 'added', description: 'Survey export pipeline with 5 professional formats: CSV, GeoJSON, Shapefile, DXF, LandXML' },
      { type: 'added', description: '3D LiDAR integration with Hesai Pandar40P via Windows companion service' },
      { type: 'added', description: 'Swift Navigation Duro GNSS receiver integration with full IMU data capture' },
      { type: 'added', description: 'Road profile recording with grade and K-factor analysis' },
      { type: 'added', description: 'POI UID-based identification system for collision-proof naming' },
      { type: 'added', description: 'CRS transformations supporting WGS84, Web Mercator, and Australian MGA zones' },
      { type: 'added', description: 'Automated survey closure with cloud-based package delivery via Firebase Storage' },
      { type: 'added', description: 'Survey import from ZIP files for data recovery and sharing' },
      { type: 'improved', description: 'Offline-first architecture with IndexedDB persistence and background sync' },
      { type: 'improved', description: 'Zero-lag logging pipeline with worker-based processing' }
    ]
  },
  {
    version: '1.8.0',
    date: '2025-09-15',
    title: 'Swept Path Analysis & Road Detection',
    highlights: [
      'Real-time road boundary detection',
      'Multi-segment vehicle modeling',
      'Collision prediction'
    ],
    changes: [
      { type: 'added', description: 'Swept Path Analysis for oversized vehicle route planning' },
      { type: 'added', description: 'Real-time road boundary detection using GPS trajectory' },
      { type: 'added', description: 'Multi-segment vehicle modeling for articulated loads' },
      { type: 'added', description: 'Off-tracking calculation for trailers and semi-trailers' },
      { type: 'added', description: 'Visual collision prediction with road edge warnings' },
      { type: 'improved', description: 'Simplified physics model for MVP release (Option B)' }
    ]
  },
  {
    version: '1.7.0',
    date: '2025-08-20',
    title: 'Voice Commands & Accessibility',
    highlights: [
      'Hands-free operation',
      'Voice-activated POI capture',
      'Multi-language support'
    ],
    changes: [
      { type: 'added', description: 'Voice command system using Web Speech API for hands-free operation' },
      { type: 'added', description: 'Voice-activated POI capture with customizable trigger phrases' },
      { type: 'added', description: 'Voice note recording for field observations' },
      { type: 'added', description: 'Comprehensive keyboard shortcuts for all major functions' },
      { type: 'improved', description: 'Accessibility improvements for screen readers' },
      { type: 'improved', description: 'High contrast mode for outdoor visibility' }
    ]
  },
  {
    version: '1.6.0',
    date: '2025-07-10',
    title: 'Point Cloud Scanning System',
    highlights: [
      'Real-time 3D visualization',
      'Three.js integration',
      'LAZ/LAS export'
    ],
    changes: [
      { type: 'added', description: 'Point Cloud Scanning System for 3D environment capture' },
      { type: 'added', description: 'Real-time 3D visualization using Three.js' },
      { type: 'added', description: 'LAZ/LAS format export for CloudCompare and Civil3D compatibility' },
      { type: 'added', description: 'Point cloud colorization from camera imagery' },
      { type: 'added', description: 'Segment-based capture with start/stop controls' },
      { type: 'improved', description: 'Performance optimization for large point datasets' }
    ]
  },
  {
    version: '1.5.0',
    date: '2025-06-01',
    title: 'AI-Powered Detection (MeasurePRO+)',
    highlights: [
      'Intelligent object detection',
      'Automatic clearance alerts',
      'Premium AI features'
    ],
    changes: [
      { type: 'added', description: 'MeasurePRO+ premium tier with AI-powered features' },
      { type: 'added', description: 'Intelligent object detection using TensorFlow.js COCO-SSD' },
      { type: 'added', description: 'Automatic clearance alerts for overhead structures' },
      { type: 'added', description: 'Envelope Clearance module for vehicle clearance monitoring' },
      { type: 'added', description: 'Convoy Guardian for oversized convoy coordination' },
      { type: 'added', description: 'Permitted Route Enforcement for GPS-based route compliance' },
      { type: 'added', description: 'ZED 2i stereo camera integration via WebSocket server' }
    ]
  },
  {
    version: '1.4.0',
    date: '2025-04-15',
    title: 'Enhanced POI System & Media Capture',
    highlights: [
      'Auto-capture on events',
      'Geo-referenced video',
      '10-second frame buffer'
    ],
    changes: [
      { type: 'added', description: 'Auto-capture POI system with configurable event triggers' },
      { type: 'added', description: 'Geo-referenced video recording with POI timestamp synchronization' },
      { type: 'added', description: '10-second rolling frame buffer for retroactive capture' },
      { type: 'added', description: 'Optimized media compression for storage efficiency' },
      { type: 'added', description: 'POI type classification: auto-capture, modal, and measurement-free' },
      { type: 'improved', description: 'Height clearance auto-recording for specific POI types' }
    ]
  },
  {
    version: '1.3.0',
    date: '2025-03-01',
    title: 'Weather Quality Filtering & RSA Laser Support',
    highlights: [
      'RSA vertical clearance laser',
      'Weather quality filters',
      'Noise reduction'
    ],
    changes: [
      { type: 'added', description: 'RSA vertical clearance laser integration with 3-byte binary protocol' },
      { type: 'added', description: 'Weather quality filtering for measurement reliability' },
      { type: 'added', description: 'Jenoptik ASCII protocol support' },
      { type: 'added', description: 'Configurable ignore above/below thresholds' },
      { type: 'added', description: 'Ground reference subtraction for accurate height measurements' },
      { type: 'improved', description: 'Laser hardware abstraction layer for multiple protocols' },
      { type: 'fixed', description: 'Measurement noise reduction in adverse conditions' }
    ]
  },
  {
    version: '1.2.0',
    date: '2025-02-01',
    title: 'Bluetooth GPS & Multi-Device Sync',
    highlights: [
      'Bluetooth GPS support',
      'WebSocket synchronization',
      'iOS companion app'
    ],
    changes: [
      { type: 'added', description: 'Bluetooth GPS device support via Web Bluetooth API' },
      { type: 'added', description: 'Multi-device synchronization using WebSockets' },
      { type: 'added', description: 'iOS slave app for camera-based measurements' },
      { type: 'added', description: 'GPS priority architecture: Duro > USB GPS > Bluetooth GPS' },
      { type: 'improved', description: 'Automatic GPS source failover when connections drop' },
      { type: 'improved', description: 'Real-time data streaming between devices' }
    ]
  },
  {
    version: '1.1.0',
    date: '2025-01-15',
    title: 'Survey Management & Export',
    highlights: [
      'Survey lifecycle management',
      'Multiple export formats',
      'Data backup system'
    ],
    changes: [
      { type: 'added', description: 'Complete survey lifecycle management with start/pause/resume/close' },
      { type: 'added', description: 'Data export to CSV, JSON, GeoJSON, KML, and ZIP formats' },
      { type: 'added', description: 'Automatic backup and restore functionality' },
      { type: 'added', description: 'Survey part management for long surveys' },
      { type: 'added', description: 'Measurement history tracking with statistics' },
      { type: 'security', description: 'Server-side BCC enforcement for email communications' },
      { type: 'security', description: 'bcrypt password hashing and JWT validation' }
    ]
  },
  {
    version: '1.0.0',
    date: '2025-01-01',
    title: 'Initial Release',
    highlights: [
      'Professional measurement PWA',
      'Offline-first design',
      'Cloud sync with Firebase'
    ],
    changes: [
      { type: 'added', description: 'Real-time measurement from laser distance meters via Web Serial API' },
      { type: 'added', description: 'GPS integration with browser Geolocation API and external devices' },
      { type: 'added', description: 'Live camera feed with measurement overlays using MediaStream API' },
      { type: 'added', description: 'Comprehensive data logging with IndexedDB storage' },
      { type: 'added', description: 'Firebase authentication and real-time cloud synchronization' },
      { type: 'added', description: 'Progressive Web App with offline support via Workbox service workers' },
      { type: 'added', description: 'Interactive mapping with Leaflet and React Leaflet' },
      { type: 'added', description: 'Configurable alert system with warning and critical thresholds' }
    ]
  }
];

export function getLatestVersion(): ChangelogEntry | undefined {
  return CHANGELOG[0];
}

export function getVersionHistory(limit?: number): ChangelogEntry[] {
  return limit ? CHANGELOG.slice(0, limit) : CHANGELOG;
}
