import { DemoChapter } from './demoStore';

export const DEMO_CHAPTERS: DemoChapter[] = [
  {
    id: 'intro',
    title: 'Welcome',
    icon: 'Zap',
    steps: [
      {
        id: 'intro-1',
        title: 'Welcome to MeasurePRO',
        description: 'A professional measurement and surveying application for field teams. This demo will guide you through the main features with live simulated data.',
        position: 'center',
        duration: 5000,
      },
      {
        id: 'intro-2',
        title: 'Creating a Survey',
        description: 'Let\'s start by looking at the survey panel. A survey groups all your measurements, photos, and GPS data for a project.',
        targetSelector: '[data-testid="survey-manager"]',
        position: 'right',
        duration: 5000,
      },
    ],
  },
  {
    id: 'survey',
    title: 'Survey',
    icon: 'FileText',
    steps: [
      {
        id: 'survey-1',
        title: 'Demo Survey Created',
        description: 'A demo survey has been automatically created. You can see the project details here: name, client, and current status.',
        targetSelector: '[data-testid="survey-manager"]',
        position: 'right',
        duration: 4000,
      },
      {
        id: 'survey-2',
        title: 'Survey Management',
        description: 'You can create multiple surveys, switch between them, export data, or close them from this panel.',
        targetSelector: '[data-testid="survey-manager"]',
        position: 'right',
        duration: 4000,
      },
    ],
  },
  {
    id: 'laser',
    title: 'Laser Measurements',
    icon: 'Gauge',
    steps: [
      {
        id: 'laser-1',
        title: 'Real-Time Measurements',
        description: 'Laser measurements are displayed in real-time. Watch the values change - current height, minimum, maximum, and average readings.',
        targetSelector: '[data-testid="measurement-display"]',
        position: 'bottom',
        duration: 5000,
      },
      {
        id: 'laser-2',
        title: 'Automatic Logging',
        description: 'Each measurement is automatically recorded in the activity log with timestamp and GPS coordinates when available.',
        targetSelector: '[data-testid="measurement-log"]',
        position: 'left',
        duration: 4000,
      },
      {
        id: 'laser-3',
        title: 'Points of Interest (POI)',
        description: 'Critical points are marked as POI with photos and location data. They appear on the map for easy reference.',
        targetSelector: '[data-testid="poi-list"]',
        position: 'left',
        duration: 4000,
      },
    ],
  },
  {
    id: 'gps',
    title: 'GPS & Map',
    icon: 'MapPin',
    steps: [
      {
        id: 'gps-1',
        title: 'Real-Time GPS Tracking',
        description: 'Your position is continuously tracked. The route trace is displayed on the map along with all marked POIs.',
        targetSelector: '[data-testid="gps-display"]',
        position: 'bottom',
        duration: 4000,
      },
      {
        id: 'gps-2',
        title: 'Interactive Map',
        description: 'Zoom, navigate, and click on POIs to view their details. Export includes coordinates in GeoJSON and KML formats.',
        targetSelector: '[data-testid="map-container"]',
        position: 'top',
        duration: 4000,
      },
    ],
  },
  {
    id: 'camera',
    title: 'Camera & AI',
    icon: 'Camera',
    steps: [
      {
        id: 'camera-1',
        title: 'Photo/Video Capture',
        description: 'Capture geolocalized photos to document each measurement. The system can also record videos with GPS metadata.',
        targetSelector: '[data-testid="camera-preview"]',
        position: 'bottom',
        duration: 4000,
      },
      {
        id: 'camera-2',
        title: 'AI Detection (MeasurePRO+)',
        description: 'AI mode automatically detects objects (vehicles, obstacles) and calculates clearance distances.',
        targetSelector: '[data-testid="camera-preview"]',
        position: 'bottom',
        duration: 4000,
      },
    ],
  },
  {
    id: 'export',
    title: 'Export',
    icon: 'Download',
    steps: [
      {
        id: 'export-1',
        title: 'Export Formats',
        description: 'Export your data as CSV, JSON, GeoJSON, KML, or a complete ZIP package with all photos and videos.',
        targetSelector: '[data-testid="export-button"]',
        position: 'top',
        duration: 4000,
      },
      {
        id: 'export-2',
        title: 'Cloud Synchronization',
        description: 'Surveys automatically sync with cloud storage for multi-device access and secure backup.',
        targetSelector: '[data-testid="sync-controls"]',
        position: 'left',
        duration: 4000,
      },
    ],
  },
  {
    id: 'cta',
    title: 'Get Started',
    icon: 'Rocket',
    steps: [
      {
        id: 'cta-1',
        title: 'Ready to Get Started?',
        description: 'You\'ve seen the main features of MeasurePRO. Connect your laser and GPS devices to start your own surveys.',
        position: 'center',
        duration: 5000,
      },
    ],
  },
];
