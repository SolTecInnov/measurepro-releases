import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowLeft, Printer, Book, Zap, Mic,
  Truck, Navigation, Route, Brain, Keyboard,
  Layers, ChevronDown, ChevronRight,
  Play, CheckCircle, Clock, Target, Shield,
  Video, FileText, Ruler,
  Star, BarChart3
} from 'lucide-react';

const PRINT_STYLES = `
@page {
  size: letter;
  margin: 0.75in;
}
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  * { box-sizing: border-box !important; }
  html, body { background: white !important; color: black !important; font-size: 10pt !important; font-family: Arial, Helvetica, sans-serif !important; line-height: 1.4 !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .min-h-screen { min-height: unset !important; }
  .print-root { background: white !important; padding: 0 !important; }
  .doc-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; width: 100% !important; }
  .doc-section { margin-bottom: 10pt !important; }
  .doc-card { border: 1px solid #d1d5db !important; background: white !important; border-radius: 0 !important; padding: 8pt !important; margin-bottom: 8pt !important; }
  h1 { font-size: 20pt !important; break-after: avoid; page-break-after: avoid; }
  h2 { font-size: 16pt !important; break-after: avoid; page-break-after: avoid; margin-top: 12pt !important; }
  h3 { font-size: 12pt !important; break-after: avoid; page-break-after: avoid; }
  h4 { font-size: 10pt !important; break-after: avoid; page-break-after: avoid; }
  p, li, td, th { orphans: 2; widows: 2; }
  nav { display: none !important; }
  .toc-box { break-after: always; page-break-after: always; }
  .screenshot-container { break-inside: avoid; page-break-inside: avoid; margin: 8pt 0 !important; }
  .screenshot-img { max-width: 5.5in !important; width: auto !important; height: auto !important; max-height: 4in !important; display: block !important; margin: 0 auto !important; border: 1px solid #d1d5db !important; }
  table { width: 100% !important; border-collapse: collapse !important; font-size: 8pt !important; }
  th, td { padding: 3pt 4pt !important; border: 0.5pt solid #d1d5db !important; word-wrap: break-word !important; overflow-wrap: break-word !important; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .grid { display: block !important; }
  .grid > * { display: block !important; width: 100% !important; margin-bottom: 4pt !important; }
  .overflow-x-auto { overflow: visible !important; }
  .text-white, [class*="text-white"] { color: #111827 !important; }
  .bg-gray-900, .bg-gray-800, .bg-gray-950, .bg-gray-750, .bg-gray-700 { background: white !important; }
  div[class*="bg-gray-9"], div[class*="bg-gray-8"], div[class*="bg-gray-7"] { background: white !important; }
  div[class*="bg-blue-9"], div[class*="bg-amber-9"], div[class*="bg-red-9"], div[class*="bg-green-9"], div[class*="bg-purple-9"] { background: #f9fafb !important; }
  div[class*="border-gray-"], div[class*="border-blue-"], div[class*="border-green-"], div[class*="border-amber-"], div[class*="border-red-"], div[class*="border-purple-"] { border-color: #d1d5db !important; }
  .text-blue-500, .text-blue-400, .text-blue-300, .text-blue-200 { color: #1d4ed8 !important; }
  .text-green-500, .text-green-400, .text-green-300, .text-green-200 { color: #15803d !important; }
  .text-amber-500, .text-amber-400, .text-amber-300, .text-amber-200 { color: #92400e !important; }
  .text-red-500, .text-red-400, .text-red-300, .text-red-200 { color: #991b1b !important; }
  .text-purple-500, .text-purple-400, .text-purple-300, .text-purple-200 { color: #6d28d9 !important; }
  .text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  kbd { border: 1px solid #374151 !important; background: #f3f4f6 !important; color: #111 !important; font-size: 8pt !important; padding: 1pt 3pt !important; }
  .print-page-header { display: block !important; text-align: center; font-size: 8pt; color: #9ca3af; border-bottom: 0.5pt solid #d1d5db; padding-bottom: 4pt; margin-bottom: 10pt; }
  .cover-page { break-after: always; page-break-after: always; min-height: 6in; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 2in !important; }
  .flex { display: block !important; }
  .gap-2, .gap-3, .gap-4 { gap: 4pt !important; }
  .space-y-2 > * + * { margin-top: 4pt !important; }
  .space-y-4 > * + * { margin-top: 6pt !important; }
  .mb-6 { margin-bottom: 8pt !important; }
  .mb-12 { margin-bottom: 14pt !important; }
  .px-4, .px-6 { padding-left: 0 !important; padding-right: 0 !important; }
  .py-8, .py-12 { padding-top: 0 !important; padding-bottom: 0 !important; }
  .rounded-lg, .rounded-xl { border-radius: 0 !important; }
  .shadow-lg, .shadow-xl { box-shadow: none !important; }
  .hidden-on-screen { display: block !important; }
  .tutorial-card .no-print + .tutorial-body { border-top: none !important; }
  .tutorial-card .print-tutorial-title { display: block !important; }
}
.hidden-on-screen { display: none; }
`;

interface TutorialStep {
  action: string;
  details?: string;
  expected?: string;
  narration?: string;
}

interface Tutorial {
  id: string;
  number: string;
  title: string;
  goal: string;
  duration: string;
  prerequisites: string;
  steps: TutorialStep[];
  tips: string[];
}

interface TutorialSection {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  screenshot?: string;
  tutorials: Tutorial[];
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <div id={id} className="doc-section mb-14 scroll-mt-24">{children}</div>;
}

function SectionTitle({ icon, title, color = 'text-blue-400' }: { icon: React.ReactNode; title: string; color?: string }) {
  return (
    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
      <span className={color}>{icon}</span>
      {title}
    </h2>
  );
}

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="doc-card tutorial-card border border-gray-700 rounded-lg mb-4 bg-gray-800/50" data-testid={`tutorial-card-${tutorial.id}`}>
      <button
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors rounded-lg no-print"
        onClick={() => setExpanded(!expanded)}
        data-testid={`toggle-tutorial-${tutorial.id}`}
      >
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{tutorial.number} {tutorial.title}</h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
            <span className="flex items-center gap-1"><Target size={14} /> {tutorial.goal}</span>
            <span className="flex items-center gap-1"><Clock size={14} /> {tutorial.duration}</span>
          </div>
        </div>
        {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
      </button>
      <div className={`px-5 pb-5 border-t border-gray-700 tutorial-body ${expanded ? '' : 'hidden-on-screen'}`}>
          <h3 className="print-tutorial-title hidden text-lg font-semibold text-white mt-3 mb-1">{tutorial.number} {tutorial.title}</h3>
          <div className="flex items-center gap-4 mb-2 text-sm text-gray-400 print-tutorial-title hidden">
            <span>{tutorial.goal}</span>
            <span>{tutorial.duration}</span>
          </div>
          <div className="mt-3 mb-4 text-sm text-gray-400">
            <span className="font-medium text-gray-300">Prerequisites:</span> {tutorial.prerequisites}
          </div>
          <ol className="space-y-3">
            {tutorial.steps.map((step, i) => (
              <li key={i} className="pl-4 border-l-2 border-blue-600/40">
                <p className="font-medium text-white">{i + 1}. {step.action}</p>
                {step.details && <p className="text-gray-300 text-sm mt-1">{step.details}</p>}
                {step.expected && <p className="text-green-400 text-sm mt-1 flex items-center gap-1"><CheckCircle size={13} /> {step.expected}</p>}
                {step.narration && <p className="text-blue-300 text-sm mt-1 italic">"{step.narration}"</p>}
              </li>
            ))}
          </ol>
          {tutorial.tips.length > 0 && (
            <div className="mt-4 p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg">
              <p className="text-amber-400 font-medium text-sm mb-2 flex items-center gap-1"><Star size={14} /> Tips</p>
              <ul className="text-sm text-gray-300 space-y-1">
                {tutorial.tips.map((tip, i) => <li key={i}>• {tip}</li>)}
              </ul>
            </div>
          )}
        </div>
    </div>
  );
}

const SECTIONS: TutorialSection[] = [
  {
    id: 'getting-started',
    number: '1',
    title: 'Getting Started',
    icon: <Play size={24} />,
    color: 'text-green-400',
    screenshot: '/screenshots/signup.jpg',
    tutorials: [
      {
        id: 'create-account',
        number: '1.1',
        title: 'Creating Your First Account',
        goal: 'New user creates a free MeasurePRO account',
        duration: '~3 minutes',
        prerequisites: 'None',
        steps: [
          { action: 'Navigate to MeasurePRO', details: 'Visit the MeasurePRO website and click "Create Free Account" button.', narration: "Let's create your free MeasurePRO account - no credit card required!" },
          { action: 'Account Information', details: 'Enter your email, create a secure password (min 8 characters), confirm password, click "Next".', expected: 'Form validates and moves to next step', narration: 'Enter your email and create a strong password' },
          { action: 'Company Details (Optional)', details: 'Enter company name, address, phone number (all optional). Click "Next".', expected: 'Progress to subscription selection', narration: 'Company details are optional but help with organization' },
          { action: 'Subscription Selection', details: 'Review available plans: Free, Basic, Plus, Pro. Select "Free" plan. Click "Next".', expected: 'Moves to Terms & Conditions', narration: 'Start with the free plan - you can upgrade anytime' },
          { action: 'Terms & Conditions', details: 'Review the terms, check "I agree to Terms & Conditions" and "I agree to Privacy Policy". Click "Next".', expected: 'Moves to hardware checklist', narration: 'Make sure to review and accept the terms' },
          { action: 'Hardware Checklist', details: 'Review hardware compatibility info. Check "I understand the hardware requirements". Click "Create Account".', expected: 'Account created, email verification sent', narration: "You'll receive a verification email shortly" },
          { action: 'Email Verification', details: 'Open your email inbox, find the MeasurePRO verification email, click the verification link.', expected: 'Email verified, pending admin approval', narration: 'Click the link in your email to verify your account' },
        ],
        tips: ['Use a professional email address', 'Save your password securely', "Check spam folder if email doesn't arrive within 5 minutes"],
      },
      {
        id: 'login',
        number: '1.2',
        title: 'Logging In with Password',
        goal: 'Existing user logs in using password authentication',
        duration: '~1 minute',
        prerequisites: 'Verified account',
        steps: [
          { action: 'Access Login', details: 'Navigate to MeasurePRO homepage, enter your password, click "Enter Password →" button.', expected: 'Redirected to app selection screen', narration: 'Simply enter your password to access the app' },
          { action: 'Select App Type (Mobile/Tablet)', details: 'See "Master App", "Slave App", and "Live Monitor" options. Click "Master App".', expected: 'Main measurement interface loads', narration: 'Master App gives you full control of all features' },
          { action: 'OR Select Desktop App', details: 'On desktop, automatically loads full interface.', expected: 'Settings page with all features visible', narration: 'Desktop users get immediate access to all features' },
        ],
        tips: ['Password is case-sensitive', "Use \"Sign In\" link if you don't have an account yet"],
      },
      {
        id: 'first-setup',
        number: '1.3',
        title: 'First-Time Setup & Permissions',
        goal: 'Grant necessary permissions for GPS, Camera, and Voice',
        duration: '~2 minutes',
        prerequisites: 'Logged in',
        steps: [
          { action: 'Mobile Permission Prompt', details: 'Click "Request GPS Permission", then click "Allow" in browser prompt.', expected: 'GPS permission granted', narration: 'GPS permission is required for location tracking' },
          { action: 'Camera Permission', details: 'Click "Request Camera Permission", then click "Allow" in browser prompt.', expected: 'Camera permission granted', narration: 'Camera access lets you document measurements' },
          { action: 'Notification Permission (Optional)', details: 'Click "Request Notification Permission", then click "Allow".', expected: 'Notification permission granted', narration: 'Notifications alert you to important events' },
          { action: 'Continue to App', details: 'Click "Continue to App" button.', expected: 'Main interface loads', narration: "You're all set! Let's start measuring" },
        ],
        tips: ['Permissions can be changed later in device settings', 'Desktop users may not see all permission prompts', 'Voice commands require microphone permission when first activated'],
      },
    ],
  },
  {
    id: 'core-measurements',
    number: '2',
    title: 'Core Measurement Features',
    icon: <Ruler size={24} />,
    color: 'text-blue-400',
    screenshot: '/screenshots/app-main.jpg',
    tutorials: [
      {
        id: 'connect-laser',
        number: '2.1',
        title: 'Connecting a Laser Distance Meter',
        goal: 'Connect and configure a laser distance meter via Web Serial',
        duration: '~3 minutes',
        prerequisites: 'USB laser meter, logged in',
        steps: [
          { action: 'Access Laser Settings', details: 'Navigate to Settings page, locate "Laser Distance Meter" card, click "Connect Laser" button.', expected: 'Browser serial port picker appears', narration: "Let's connect your laser distance meter" },
          { action: 'Select Serial Port', details: 'In browser prompt, select your laser meter (e.g., "USB Serial Port"), click "Connect".', expected: 'Connection established, status shows "Connected"', narration: 'Select your laser meter from the list' },
          { action: 'Configure Laser Type', details: 'In Laser Settings, find "Laser Type" dropdown. Select: Standard Pole, High Pole, or Telescopic Pole.', expected: 'Laser type updates', narration: "Choose the pole type you're using" },
          { action: 'Set Ground Reference', details: 'Find "Ground Reference Height" input, enter your pole height above ground (e.g., 0.5m).', expected: 'Ground reference saved, measurements auto-subtract this value', narration: 'This ensures measurements are from ground level, not pole tip' },
          { action: 'Test Measurement', details: 'Point laser at ceiling or overhead object, press trigger on laser meter.', expected: 'Live measurement appears in "Current Measurement" display, updates 30 times per second', narration: 'Watch the live measurement stream in real-time' },
        ],
        tips: ['Ensure laser meter is in continuous measurement mode', 'USB connection is more reliable than Bluetooth', 'Ground reference is subtracted automatically from all measurements'],
      },
      {
        id: 'connect-gps',
        number: '2.2',
        title: 'Connecting GPS Device',
        goal: 'Connect hardware GPS or use browser GPS fallback',
        duration: '~3 minutes',
        prerequisites: 'GPS device (optional), logged in',
        steps: [
          { action: 'Hardware GPS (Preferred)', details: 'Navigate to GPS Settings card, click "Connect GPS", select GPS device from serial port list.', expected: 'GPS status shows "Connected", fix quality appears (e.g., "3D Fix")', narration: 'Hardware GPS provides the best accuracy' },
          { action: 'View GPS Data', details: 'See current coordinates, altitude, speed, course, satellite count, and HDOP.', expected: 'Data updates every second', narration: 'All GPS data updates in real-time' },
          { action: 'Browser GPS Fallback (No Hardware)', details: 'If no hardware GPS, app auto-switches to browser GPS. Click "Allow" in location prompt.', expected: 'GPS source shows "Browser Geolocation", coordinates appear', narration: 'No GPS hardware? No problem - browser GPS works as a backup' },
          { action: 'View Position on Map', details: 'Navigate to "Map" tab, see blue marker at your current position.', expected: 'Marker updates as you move', narration: 'See your position live on the map' },
        ],
        tips: ['Hardware GPS is more accurate than browser geolocation', 'Wait 30-60 seconds for GPS fix when first connecting', '3D Fix is ideal (10+ satellites)'],
      },
      {
        id: 'setup-camera',
        number: '2.3',
        title: 'Setting Up Camera Feed',
        goal: 'Configure camera for live feed and photo capture',
        duration: '~2 minutes',
        prerequisites: 'Camera permission granted',
        steps: [
          { action: 'Enable Camera', details: 'Navigate to Camera Settings, select "Standard Camera" or "ZED 2i Stereo Camera".', expected: 'Live camera feed appears', narration: 'Your camera feed appears automatically' },
          { action: 'Configure Camera Settings', details: 'Select resolution (720p, 1080p, 4K) and frame rate (15, 30, 60 fps).', expected: 'Feed updates with new settings', narration: 'Adjust resolution and FPS based on your needs' },
          { action: 'Test Camera', details: 'Point camera at overhead object, click "Capture Image" button (camera icon).', expected: 'Camera shutter sound plays, image saved to "Captured Images" list', narration: 'Capture images while measuring for documentation' },
          { action: 'View Captured Images', details: 'Scroll to "Captured Images" section, click thumbnail to view full size, download icon to save.', expected: 'Image downloads to device', narration: 'All images are saved and downloadable' },
        ],
        tips: ['Higher resolution = better quality but slower performance', '30 FPS is recommended for most use cases', 'Images include measurement data in metadata'],
      },
    ],
  },
  {
    id: 'data-logging',
    number: '3',
    title: 'Data Logging & Management',
    icon: <Database size={24} />,
    color: 'text-purple-400',
    screenshot: '/screenshots/export.jpg',
    tutorials: [
      {
        id: 'logging-modes',
        number: '3.1',
        title: 'Understanding Logging Modes',
        goal: 'Learn the four logging modes and when to use each',
        duration: '~4 minutes',
        prerequisites: 'Laser connected',
        steps: [
          { action: 'Manual Mode', details: 'Select "Manual Mode" in logging selector. Press "Log Measurement" (Alt+G) to log a single point.', expected: 'Single measurement logged with timestamp and GPS', narration: 'Manual Mode: You control when measurements are logged. Use for specific points of interest, bridge heights.' },
          { action: 'All Data Mode', details: 'Change to "All Data", click "Start Logging". Measurements auto-log every reading at 30 Hz.', expected: 'Log counter increments rapidly', narration: 'All Data Mode: Continuous logging of every measurement. Use for complete route surveys.' },
          { action: 'Detection Mode (MeasurePRO+ Only)', details: 'Change to "Detection Mode", click "Start Logging". Only logs when AI detects an object.', expected: 'Detection triggers, measurement auto-logged', narration: 'Detection Mode: AI automatically logs when it sees obstacles.' },
          { action: 'Manual + Detection Mode (MeasurePRO+ Only)', details: 'Change to "Manual + Detection". Both manual logging and AI detection active simultaneously.', expected: 'Both manual logging and AI detection active', narration: 'Best of both worlds: AI automation + manual control.' },
        ],
        tips: ['Manual Mode is best for beginners', 'All Data Mode generates large datasets', 'Detection Mode requires MeasurePRO+ subscription'],
      },
      {
        id: 'poi-logging',
        number: '3.2',
        title: 'Logging Points of Interest (POIs)',
        goal: 'Select POI types and log categorized measurements',
        duration: '~3 minutes',
        prerequisites: 'Laser connected',
        steps: [
          { action: 'Select POI Type', details: 'Find "POI Type" selector (16 options): Bridge, Trees, Wire, Power Line, Traffic Light, Walkways, Lateral Obstruction, Road, Intersection, Signalization, Railroad, Information, Danger, Important Note, Work Required, Restricted. Select "Bridge".', expected: 'POI type indicator updates to "Bridge", sound effect plays', narration: 'Choose the type that matches what you\'re measuring' },
          { action: 'Log Categorized Measurement', details: 'Point laser at bridge overhead, press "Log Measurement" (Alt+G).', expected: 'Measurement logged with "Bridge" category, appears in table with bridge icon', narration: 'POI type is automatically attached to each measurement' },
          { action: 'Change POI Mid-Survey', details: 'Change POI type to "Trees", log another measurement. Change to "Power Line", log again.', expected: 'Different POI types in measurement log', narration: 'Switch POI types as you go to categorize your survey' },
          { action: 'POI Keyboard Shortcuts', details: 'Press 1→Bridge, 2→Trees, 3→Wire, 4→Power Line. Number keys 1-9 for instant switching.', expected: 'POI type changes instantly, sound effect confirms change', narration: 'Use number keys 1-9 for instant POI switching' },
        ],
        tips: ['POI types help organize large surveys', 'Keyboard shortcuts speed up field work', 'Export filters by POI type for analysis'],
      },
      {
        id: 'alerts',
        number: '3.3',
        title: 'Managing Alerts and Thresholds',
        goal: 'Configure warning and critical alert thresholds',
        duration: '~3 minutes',
        prerequisites: 'Laser connected',
        steps: [
          { action: 'Set Warning Threshold', details: 'Find "Alert Settings" card, locate "Warning Threshold", enter value (e.g., 5.5m).', expected: 'Threshold saved', narration: 'Warning alerts notify you when clearance is getting low' },
          { action: 'Set Critical Threshold', details: 'Locate "Critical Threshold" input, enter value lower than warning (e.g., 5.0m).', expected: 'Threshold saved, validates critical < warning', narration: 'Critical alerts mean immediate danger' },
          { action: 'Trigger Warning Alert', details: 'Point laser to measure ~5.5m object.', expected: 'Screen turns YELLOW, warning sound plays, alert message "WARNING"', narration: "Yellow screen means you're approaching minimum clearance" },
          { action: 'Trigger Critical Alert', details: 'Point laser to measure ~5.0m or less object.', expected: 'Screen turns RED, critical alarm sounds (louder), alert message "CRITICAL"', narration: 'Red screen means STOP - insufficient clearance' },
          { action: 'Clear Alerts', details: 'Point laser away from low object (measurement > warning) or click "Clear Alert".', expected: 'Screen returns to normal, sounds stop', narration: 'Alerts clear automatically when safe' },
        ],
        tips: ['Set thresholds before starting survey', 'Critical should always be lower than warning', 'Alerts are logged in measurement data'],
      },
      {
        id: 'export-data',
        number: '3.4',
        title: 'Viewing and Exporting Data',
        goal: 'Review logged measurements and export in multiple formats',
        duration: '~4 minutes',
        prerequisites: 'Some measurements logged',
        steps: [
          { action: 'View Measurement Table', details: 'Scroll to "Logged Measurements" section. See columns: Timestamp, Measurement, POI Type, GPS Coordinates, Speed, Alert Status.', expected: 'All logged measurements displayed', narration: 'Every measurement is recorded with full context' },
          { action: 'Filter by POI Type', details: 'Click POI filter dropdown above table, select "Bridge". Select "All" to clear filter.', expected: 'Table shows only bridge measurements, then all', narration: 'Quickly filter to specific POI types' },
          { action: 'Export to CSV', details: 'Click "Export", select "CSV". Open CSV in Excel/Google Sheets.', expected: 'CSV file downloads with all measurement data', narration: 'CSV format works with Excel and Google Sheets' },
          { action: 'Export to GeoJSON', details: 'Click "Export", select "GeoJSON". Import into GIS software (QGIS, ArcGIS).', expected: 'GeoJSON file downloads, measurements appear on map', narration: 'GeoJSON is perfect for GIS analysis' },
          { action: 'Export to KML', details: 'Click "Export", select "KML". Import into Google Earth.', expected: 'KML file downloads, 3D visualization of survey route', narration: 'KML format works with Google Earth' },
          { action: 'Export to JSON', details: 'Click "Export", select "JSON".', expected: 'Full data export with all metadata', narration: 'JSON includes complete raw data for custom processing' },
        ],
        tips: ['Export often to backup your data', 'Use GeoJSON for professional GIS workflows', 'CSV is easiest for simple analysis'],
      },
    ],
  },
  {
    id: 'voice-commands',
    number: '4',
    title: 'Voice Commands',
    icon: <Mic size={24} />,
    color: 'text-amber-400',
    tutorials: [
      {
        id: 'voice-setup',
        number: '4.1',
        title: 'Enabling and Configuring Voice Commands',
        goal: 'Activate voice control and select language',
        duration: '~2 minutes',
        prerequisites: 'Microphone permission',
        steps: [
          { action: 'Enable Voice Assistant', details: 'Navigate to Voice Command Settings card, find "Voice Assistant" toggle, click to enable. Allow microphone access when prompted.', expected: 'Voice assistant activates, status shows "Listening" with microphone icon', narration: 'Voice commands require microphone permission' },
          { action: 'Select Language', details: 'Find "Language Settings" section. Three options: English (US), Français (France), Español (España). Click your preferred language.', expected: 'Language updates, recognition switches', narration: 'Voice commands work in English, French, and Spanish' },
          { action: 'Adjust Voice Volume', details: 'Find "Voice Response Settings", toggle on "Voice Talks", adjust volume slider (0-100%).', expected: 'Test voice speaks at new volume', narration: 'Control how loud the voice assistant responds' },
          { action: 'Test Voice Recognition', details: 'Say: "Help".', expected: 'Voice assistant responds with available commands, transcript appears', narration: "Say 'help' to hear all available commands" },
        ],
        tips: ['Speak clearly and naturally', 'Works best in quiet environments', 'Internet connection required for speech recognition'],
      },
      {
        id: 'voice-usage',
        number: '4.2',
        title: 'Using Voice Commands',
        goal: 'Control the app hands-free with 49+ voice commands',
        duration: '~5 minutes',
        prerequisites: 'Voice assistant enabled',
        steps: [
          { action: 'Information Queries', details: 'Say: "Last measurement", "GPS location", "Laser status", "GPS status". Each returns current sensor info.', expected: 'Voice responds with relevant data', narration: 'Query any sensor status by voice' },
          { action: 'General Actions', details: 'Say: "Capture image" (takes photo), "Log measurement" (logs current reading), "Clear alert" (clears active alerts).', expected: 'Actions execute hands-free', narration: 'Control core functions hands-free' },
          { action: 'Logging Control', details: 'Say: "Start logging", "Stop logging", "Pause logging".', expected: 'Logging state changes with voice confirmation', narration: 'Full logging control via voice' },
          { action: 'Mode Switching', details: 'Say: "Manual mode", "All data mode", "Detection mode".', expected: 'Switches to named mode', narration: 'Change logging modes instantly' },
          { action: 'POI Type Selection', details: 'Say: "Bridge", "Trees", "Power line", etc.', expected: 'POI type changes to spoken type', narration: 'Switch POI types without touching the screen' },
          { action: 'Audio Control', details: 'Say: "Volume up", "Volume down", "Mute", "Unmute".', expected: 'Volume adjusts accordingly', narration: 'Control audio without touching device' },
        ],
        tips: ['Commands are not case-sensitive', 'Wait for beep before speaking', 'Say "help" for full command list'],
      },
    ],
  },
  {
    id: 'ai-detection',
    number: '5',
    title: 'AI Detection (MeasurePRO+)',
    icon: <Brain size={24} />,
    color: 'text-cyan-400',
    tutorials: [
      {
        id: 'ai-setup',
        number: '5.1',
        title: 'Setting Up AI Detection',
        goal: 'Configure the automatic object detection system',
        duration: '~3 minutes',
        prerequisites: 'MeasurePRO+ subscription, camera enabled',
        steps: [
          { action: 'Enable AI Detection', details: 'Navigate to AI Detection settings card, find "Enable AI Detection" toggle, click to enable.', expected: 'AI detection initializes, TensorFlow model loads', narration: "Let's enable the AI detection system" },
          { action: 'Configure Detection Sensitivity', details: 'Find "Detection Sensitivity" slider. Low = fewer detections (only obvious), Medium = balanced, High = more detections (may include false positives).', expected: 'Sensitivity updates', narration: 'Adjust sensitivity based on environment' },
          { action: 'Set Detection Targets', details: 'Find "Detection Targets" checklist: Bridges, Power Lines, Trees, Signs, Traffic Signals, Wires. Check the types you want to detect.', expected: 'Detection targets updated', narration: 'Choose which objects the AI should look for' },
          { action: 'Test Detection', details: 'Point camera at overhead object. Press Alt+0 or click "Test Detection".', expected: 'AI processes frame, shows detection result with bounding box and confidence', narration: 'Test the system before starting your survey' },
        ],
        tips: ['Medium sensitivity recommended for most surveys', 'AI works best in good lighting conditions', 'Test detection before relying on it for a survey'],
      },
      {
        id: 'ai-usage',
        number: '5.2',
        title: 'Real-Time AI Detection in Action',
        goal: 'See AI detect and classify objects automatically',
        duration: '~5 minutes',
        prerequisites: 'AI detection enabled, camera active',
        steps: [
          { action: 'Start Detection Survey', details: 'Set logging mode to "Detection" or "Manual + Detection". Click "Start Logging".', expected: 'AI processing indicator appears', narration: 'AI is now watching the camera feed' },
          { action: 'Drive Under Objects', details: 'As you pass under bridge, wires, trees, AI analyzes camera feed in real-time.', expected: 'Bounding box appears around detected object, object type labeled', narration: 'Watch the AI identify objects automatically' },
          { action: 'Automatic Logging', details: 'When AI detects an object, measurement is auto-logged with detection info.', expected: 'Auto-logged entry shows AI classification and confidence score', narration: 'No manual intervention needed - AI logs everything' },
          { action: 'Review AI Detections', details: 'Scroll to measurement log, see AI-detected entries marked with brain icon.', expected: 'AI detections highlighted in log', narration: 'AI detections are clearly marked in your data' },
          { action: 'Accept/Reject Detections', details: 'For each AI detection: Alt+7 to accept, Alt+8 to reject, Alt+9 to correct classification.', expected: 'Feedback stored for model improvement', narration: 'Your feedback helps improve the AI' },
        ],
        tips: ['Review AI detections after survey for accuracy', 'Rejected detections help train better models', 'AI confidence >80% is generally reliable'],
      },
    ],
  },
  {
    id: 'envelope-clearance',
    number: '6',
    title: 'Envelope Clearance',
    icon: <Layers size={24} />,
    color: 'text-orange-400',
    tutorials: [
      {
        id: 'vehicle-profiles',
        number: '6.1',
        title: 'Setting Up Vehicle Profiles',
        goal: 'Create and configure vehicle dimension profiles',
        duration: '~4 minutes',
        prerequisites: 'MeasurePRO+ subscription',
        steps: [
          { action: 'Access Vehicle Profiles', details: 'Navigate to Envelope Clearance settings, click "Vehicle Profiles" section.', expected: 'Profile management panel appears', narration: 'Vehicle profiles define your load dimensions' },
          { action: 'Create New Profile', details: 'Click "Add Vehicle Profile" button. Enter: Profile name (e.g., "Flatbed Trailer"), Total height (e.g., 4.5m), Width (e.g., 3.5m), Length (e.g., 16.0m).', expected: 'New profile created, dimensions validated', narration: 'Enter exact dimensions for accurate clearance checking' },
          { action: 'Set Vertical Safety Margin', details: 'Find "Safety Margin" input, enter additional buffer (e.g., 0.3m). This adds to required clearance.', expected: 'Safety margin saved, total clearance requirement updated', narration: 'Safety margin provides extra clearance above your load' },
          { action: 'Enable Envelope Monitoring', details: 'Click "Enable Envelope Monitoring" toggle (or press Alt+Shift+E).', expected: 'Envelope monitoring activates, live clearance checking begins', narration: 'Now monitoring real-time clearance against vehicle profile' },
        ],
        tips: ['Measure vehicle height with load as loaded for transport', 'Include safety margin of at least 0.15m', 'Save profiles for frequently used vehicle configurations'],
      },
      {
        id: 'realtime-monitoring',
        number: '6.2',
        title: 'Real-Time Clearance Monitoring',
        goal: 'Monitor overhead clearance against vehicle envelope',
        duration: '~4 minutes',
        prerequisites: 'Vehicle profile configured, envelope monitoring enabled',
        steps: [
          { action: 'View Clearance Display', details: 'See live clearance panel showing: Current overhead height, Required clearance (vehicle + margin), Available clearance (overhead - required), Status (SAFE/WARNING/CRITICAL).', expected: 'Live clearance data visible', narration: 'The clearance display updates with every measurement' },
          { action: 'Safe Clearance (Green)', details: 'When clearance > vehicle height + safety margin.', expected: 'Green indicator, "SAFE" status, no alarms', narration: 'Green means safe to proceed' },
          { action: 'Warning Clearance (Yellow)', details: 'When approaching minimum clearance.', expected: 'Yellow indicator, warning sound, "CAUTION" status', narration: 'Yellow means clearance is tight - proceed carefully' },
          { action: 'Critical Violation (Red)', details: 'When clearance < vehicle height.', expected: 'Red indicator, loud alarm, "VIOLATION" status, violation logged', narration: 'Red means STOP - insufficient clearance for your load' },
        ],
        tips: ['Never ignore red alerts', 'Test system before actual convoy', 'Review violation log after each trip'],
      },
      {
        id: 'cycle-profiles',
        number: '6.3',
        title: 'Cycling Vehicle Profiles',
        goal: 'Switch between vehicle profiles on-the-fly',
        duration: '~2 minutes',
        prerequisites: 'Multiple profiles configured',
        steps: [
          { action: 'Manual Profile Change', details: 'Click "Vehicle Profile" dropdown, select different profile.', expected: 'Profile switches, clearance recalculated with new dimensions', narration: 'Switch profiles when changing vehicles' },
          { action: 'Cycle Profiles with Keyboard', details: 'Press Alt+Shift+P. Cycles to next profile in list.', expected: 'Cycles to next profile, toast shows profile name', narration: 'Quickly cycle through profiles without mouse' },
          { action: 'Cycle Profiles with Voice', details: 'Say: "Cycle vehicle profile".', expected: 'Switches to next profile with voice confirmation', narration: 'Hands-free profile switching during operation' },
        ],
        tips: ['Set up all profiles before convoy', 'Label profiles clearly (e.g., "Trailer A", "Trailer B")', 'Cycling order is based on profile creation order'],
      },
    ],
  },
  {
    id: 'convoy-guardian',
    number: '7',
    title: 'Convoy Guardian',
    icon: <Truck size={24} />,
    color: 'text-red-400',
    screenshot: '/screenshots/convoy-leader.jpg',
    tutorials: [
      {
        id: 'convoy-setup',
        number: '7.1',
        title: 'Setting Up Master-Slave Network',
        goal: 'Configure multi-vehicle convoy with lead and following vehicles',
        duration: '~5 minutes',
        prerequisites: 'MeasurePRO+ subscription, multiple devices',
        steps: [
          { action: 'Create Convoy (Master Device)', details: 'On lead vehicle, navigate to Convoy Settings, click "Create New Convoy", enter convoy name, click "Generate Convoy Code".', expected: 'Unique convoy code generated (e.g., "ABC-123"), QR code displayed', narration: 'Master vehicle controls the convoy and logs all data' },
          { action: 'Join Convoy (Slave Devices)', details: 'On following vehicles, go to Convoy Settings, click "Join Existing Convoy". Scan QR code or enter code manually.', expected: 'Joins convoy', narration: 'Following vehicles connect to share data with master' },
          { action: 'Verify Connection', details: 'On master, see "Connected Vehicles" list with vehicle ID, connection status, last update time, GPS location.', expected: 'Shows all slave vehicles with active status', narration: 'All vehicles now sharing data in real-time' },
        ],
        tips: ['Master device should be in lead vehicle', 'Ensure all devices have internet connection', 'Test connections before departing'],
      },
      {
        id: 'convoy-operation',
        number: '7.2',
        title: 'Convoy Operation & Black Box Logging',
        goal: 'Monitor convoy in real-time and log all events',
        duration: '~4 minutes',
        prerequisites: 'Convoy established, multiple vehicles connected',
        steps: [
          { action: 'Start Convoy Operation', details: 'On master device, click "Start Convoy". All slave devices notified.', expected: 'Convoy status "Active", black box logging begins on all devices', narration: 'Black box logs every event for safety compliance' },
          { action: 'Monitor Vehicle Positions', details: 'View convoy map on master device showing all vehicle positions, formation, and distances.', expected: 'See all vehicle positions in real-time', narration: 'Master monitors entire convoy formation' },
          { action: 'Event Logging', details: 'Various events auto-logged: clearance violations, speed changes, position updates, alert triggers, communications.', expected: 'All events timestamped and logged', narration: 'Every significant event is recorded' },
          { action: 'View Black Box Log', details: 'Navigate to "Black Box Log" tab. See chronological event list with timestamp, vehicle ID, event type, details, GPS.', expected: 'Complete audit trail', narration: 'Black box provides complete journey history' },
          { action: 'Emergency Alert', details: 'On any vehicle, click "Emergency Alert" button.', expected: 'All vehicles receive emergency notification, alarm sounds, event logged', narration: 'Emergency alert instantly notifies entire convoy' },
        ],
        tips: ['Black box cannot be paused or deleted during convoy', 'All data synchronized to master device', 'Export black box log after each convoy for records'],
      },
      {
        id: 'live-monitor',
        number: '7.3',
        title: 'Live Monitor Mode',
        goal: 'Set up remote monitoring station for convoy oversight',
        duration: '~3 minutes',
        prerequisites: 'Convoy active',
        steps: [
          { action: 'Access Live Monitor', details: 'On desktop/tablet (not in convoy), click "Live Monitor" on app selector.', expected: 'Monitor interface loads', narration: 'Live Monitor is for oversight personnel' },
          { action: 'Connect to Convoy', details: 'Enter convoy code from master device, click "Connect to Convoy".', expected: 'Real-time data stream begins, dashboard shows all vehicles', narration: 'Monitor sees exactly what master sees' },
          { action: 'Monitor Dashboard', details: 'View: Map View (all positions), Status Panel (each vehicle status), Event Stream (live log), Alerts Panel (active alerts).', expected: 'Updates in real-time (1-second intervals)', narration: 'Full convoy oversight from remote location' },
          { action: 'Send Messages to Convoy', details: 'Type message, click "Send to All Vehicles".', expected: 'Message appears on all vehicle devices, logged in black box', narration: 'Communicate with convoy from monitoring station' },
        ],
        tips: ['Live Monitor requires stable internet', 'Multiple monitors can connect to same convoy', 'Monitor mode is view-only (cannot control vehicles)'],
      },
    ],
  },
  {
    id: 'route-enforcement',
    number: '8',
    title: 'Permitted Route Enforcement',
    icon: <Route size={24} />,
    color: 'text-indigo-400',
    screenshot: '/screenshots/route-dispatch.jpg',
    tutorials: [
      {
        id: 'upload-route',
        number: '8.1',
        title: 'Uploading Permitted Route',
        goal: 'Load GPX route file for compliance monitoring',
        duration: '~3 minutes',
        prerequisites: 'MeasurePRO+ subscription, GPX file',
        steps: [
          { action: 'Access Route Enforcement', details: 'Navigate to Route Enforcement settings, click "Enable Route Enforcement" toggle.', expected: 'Route enforcement panel appears', narration: 'Route enforcement ensures permitted path compliance' },
          { action: 'Upload GPX File', details: 'Click "Upload Route (GPX)", select your GPX file. Route parses and displays on map.', expected: 'Route displayed on map, success message with distance and waypoints', narration: 'GPX files from route planning software work perfectly' },
          { action: 'Configure Buffer Zone', details: 'Find "Route Buffer" slider, set buffer distance (e.g., 50 meters).', expected: 'Buffer zone visualized around route on map as shaded corridor', narration: 'Buffer allows for minor GPS drift and maneuvering' },
          { action: 'View Route Details', details: 'See route statistics: total distance, waypoints, start/end coordinates, buffer width.', expected: 'All route info displayed', narration: 'Confirm route details before starting enforcement' },
        ],
        tips: ['Export route from Google Maps, QGIS, or routing software as GPX', 'Recommended buffer: 25-50m for highways, 10-20m for urban', 'Test route before actual permitted load'],
      },
      {
        id: 'route-compliance',
        number: '8.2',
        title: 'Real-Time Route Compliance Monitoring',
        goal: 'Monitor vehicle position relative to permitted route',
        duration: '~4 minutes',
        prerequisites: 'Route uploaded, route enforcement enabled',
        steps: [
          { action: 'Start Route Monitoring', details: 'Begin driving along route. Your position shown as blue dot on map against the route.', expected: 'Position updates in real-time', narration: 'Your vehicle is tracked against the permitted route' },
          { action: 'On-Route Status (Green)', details: 'While on permitted route, status indicator is GREEN.', expected: 'Message: "On Permitted Route", distance from route small', narration: "Green means you're compliant with permit" },
          { action: 'Approaching Buffer Edge (Yellow)', details: 'Drift toward edge of buffer zone.', expected: 'Status turns YELLOW, warning beep, "Warning: Approaching Route Boundary"', narration: "Yellow means you're getting close to route edge" },
          { action: 'Off-Route Violation (Red + STOP Modal)', details: 'Cross outside buffer zone. NON-DISMISSABLE MODAL appears blocking entire app.', expected: 'Red alarm, "ROUTE VIOLATION" modal with no close button, must return to route', narration: 'STOP modal cannot be dismissed - you MUST return to route' },
          { action: 'Return to Route', details: 'Turn back toward permitted route. As you re-enter buffer, modal auto-dismisses.', expected: 'Status returns to yellow, then green, alarm stops', narration: 'Modal only clears when back on permitted route' },
          { action: 'Violation Logging', details: 'Navigate to "Route Violations" log. See table: timestamp, GPS coordinates, distance from route, duration, severity.', expected: 'All violations permanently logged', narration: 'Every off-route event is recorded for compliance' },
        ],
        tips: ['STOP modal is intentionally non-dismissable for safety', 'Violations may result in permit penalties', 'Review violation log after trip to understand any issues'],
      },
    ],
  },
  {
    id: 'swept-path',
    number: '9',
    title: 'Swept Path Analysis',
    icon: <Navigation size={24} />,
    color: 'text-pink-400',
    tutorials: [
      {
        id: 'swept-config',
        number: '9.1',
        title: 'Configuring Swept Path Analysis',
        goal: 'Set up vehicle articulation simulation for turn prediction',
        duration: '~4 minutes',
        prerequisites: 'MeasurePRO Pro subscription, swept path enabled',
        steps: [
          { action: 'Access Swept Path Settings', details: 'Navigate to Swept Path Analysis settings, click "Enable Swept Path Analysis" toggle.', expected: 'Swept path configuration panel appears', narration: 'Swept path predicts vehicle path during turns' },
          { action: 'Configure Vehicle Geometry', details: 'Enter: Tractor Length (6.5m), Trailer Length (14.0m), Wheelbase (3.8m), Kingpin Offset (1.2m), Track Width (2.5m). Click "Save Vehicle Configuration".', expected: 'Vehicle model updated, visual representation shows on canvas', narration: 'Accurate dimensions ensure correct path prediction' },
          { action: 'Set Turn Parameters', details: 'Set minimum turn radius (e.g., 12m) and typical turning speed (e.g., 15 km/h).', expected: 'Parameters saved', narration: 'Turn parameters affect off-tracking calculation' },
          { action: 'Enable Collision Detection', details: 'Enable "Collision Detection" toggle, set collision threshold (e.g., 0.5m safety margin).', expected: 'Collision detection activates', narration: 'Collision detection warns if turn will hit boundaries' },
        ],
        tips: ['Get exact vehicle dimensions from manufacturer specs', 'Trailer length includes hitch and overhang', 'Test with known safe turns first'],
      },
      {
        id: 'swept-realtime',
        number: '9.2',
        title: 'Real-Time Turn Simulation',
        goal: 'Visualize vehicle path during turns with collision detection',
        duration: '~5 minutes',
        prerequisites: 'Swept path configured, road detection active',
        steps: [
          { action: 'Activate Road Detection', details: 'Ensure camera enabled and pointed forward, click "Start Road Detection".', expected: 'Road boundaries detected and highlighted with green overlay, confidence score displayed', narration: 'AI detects road boundaries from camera feed' },
          { action: 'Initiate Turn Simulation', details: 'Approach an intersection or turn. GPS detects potential turn (course change > 15°).', expected: 'Turn simulation activates automatically, canvas overlay appears', narration: 'System automatically predicts turns from GPS data' },
          { action: 'View Swept Path Overlay', details: 'See: Blue outline (front axle path), Red outline (rear axle off-tracking), Yellow corridor (full vehicle envelope), Green dots (road boundary).', expected: 'Overlay updates in real-time as you turn', narration: 'Swept path shows exactly where trailer will track' },
          { action: 'Safe Turn (No Collision)', details: 'Execute turn within road boundaries.', expected: 'Yellow envelope stays within green boundary, "Safe Turn" status', narration: 'Green means you have clearance for the turn' },
          { action: 'Collision Warning', details: 'Attempt tight turn where trailer would cross boundary.', expected: 'Red collision indicator, warning sound, "COLLISION PREDICTED" message', narration: 'Red means trailer will cross the line - turn is too tight' },
        ],
        tips: ['Off-tracking increases with longer trailers', 'Slower speeds reduce off-tracking slightly', 'Road detection works best in good visibility'],
      },
      {
        id: 'swept-analysis',
        number: '9.3',
        title: 'Analyzing Turn Data',
        goal: 'Review turn logs and collision events',
        duration: '~3 minutes',
        prerequisites: 'Some turns simulated',
        steps: [
          { action: 'Access Turn Log', details: 'Navigate to "Turn Analysis" tab. See table: timestamp, GPS location, turn angle, off-tracking, collision status, speed.', expected: 'All turns recorded', narration: 'Every turn is logged for analysis' },
          { action: 'Filter Collision Events', details: 'Click "Show Collisions Only" filter.', expected: 'Table shows only turns with predicted collisions', narration: 'Quickly identify problematic turns' },
          { action: 'Export Turn Data', details: 'Click "Export Turn Analysis", select format (CSV, JSON).', expected: 'Export includes all turn parameters, collisions, GPS coordinates, road boundary data', narration: 'Use exported data for route planning improvements' },
        ],
        tips: ['Review turn log to find consistently problematic locations', 'Share collision data with route planners', 'Use data to adjust permitted routes'],
      },
    ],
  },
  {
    id: 'advanced-features',
    number: '10',
    title: 'Advanced Features',
    icon: <Zap size={24} />,
    color: 'text-yellow-400',
    screenshot: '/screenshots/lidar.jpg',
    tutorials: [
      {
        id: 'geo-video',
        number: '10.1',
        title: 'Geo-Referenced Video Recording',
        goal: 'Record video with GPS timestamp synchronization',
        duration: '~4 minutes',
        prerequisites: 'Camera enabled, GPS connected',
        steps: [
          { action: 'Start Video Recording', details: 'Click "Record Video" button (red circle) or press Alt+V.', expected: 'Recording indicator (red dot), timer shows elapsed time, GPS overlay visible', narration: 'Video includes GPS timestamp and measurement data' },
          { action: 'Mark POI During Recording', details: 'While recording, press "Mark POI" button at important locations.', expected: 'POI marker added at current timestamp', narration: 'POI markers let you jump to key moments' },
          { action: 'Stop Recording', details: 'Click "Stop Recording" or press Alt+V again.', expected: 'Video saved to IndexedDB, appears in "Recorded Videos" list', narration: 'Videos are stored locally for offline access' },
          { action: 'Playback Geo-Referenced Video', details: 'Click on recorded video. See GPS position updates during playback, map shows video path.', expected: 'Video jumps to POI moment when marker clicked', narration: 'Navigate video by GPS locations and POI markers' },
          { action: 'Export Video', details: 'Click "Download Video" button.', expected: 'VP9-encoded video downloads (~500kbps compressed)', narration: 'Videos are compressed for efficient storage' },
        ],
        tips: ['Video quality optimized for surveying (500kbps VP9)', 'POI markers sync with GPS coordinates', 'Videos stored in IndexedDB work offline'],
      },
      {
        id: 'timelapse',
        number: '10.2',
        title: 'Timelapse Mode',
        goal: 'Create time-lapse sequence of survey route',
        duration: '~3 minutes',
        prerequisites: 'Camera enabled',
        steps: [
          { action: 'Configure Timelapse', details: 'Find "Timelapse" card. Set interval (1s, 5s, 10s) and quality (Low, Medium, High).', expected: 'Settings saved', narration: 'Timelapse captures frames at regular intervals' },
          { action: 'Start Timelapse', details: 'Click "Start Timelapse" button. Begin survey route.', expected: 'Indicator shows "Timelapse Active", frame counter begins', narration: 'Timelapse runs in background during your survey' },
          { action: 'Stop Timelapse', details: 'Click "Stop Timelapse" button.', expected: 'Timelapse stops, shows total frames captured', narration: 'Timelapse can run for hours' },
          { action: 'Export Timelapse', details: 'Click "Export Timelapse" button.', expected: 'ZIP file downloads with all JPEG frames numbered sequentially', narration: 'Create professional timelapse videos for presentations' },
        ],
        tips: ['1-second interval for detailed capture', '10-second interval for long routes', '75% JPEG quality balances size and quality'],
      },
      {
        id: 'multi-device',
        number: '10.3',
        title: 'Multi-Device Synchronization',
        goal: 'Use master and slave apps for collaborative surveying',
        duration: '~4 minutes',
        prerequisites: 'Two devices, MeasurePRO accounts',
        steps: [
          { action: 'Set Up Master App', details: 'On primary device, log in and select "Master App". Start logging measurements.', expected: 'Full app interface loads, "Master" badge visible', narration: 'Master app controls surveying operations' },
          { action: 'Set Up Slave App', details: 'On secondary device, log in and select "Slave App".', expected: 'Simplified interface loads, "Slave" badge visible, shows live data from master', narration: "Slave app displays master's data in real-time" },
          { action: 'Live Data Sync', details: 'On master, log measurements and capture images.', expected: 'Measurements and images appear on slave within 1-2 seconds', narration: 'All data syncs automatically via WebSocket' },
          { action: 'Slave Monitoring', details: 'Slave shows: live measurements, GPS, alert status, POI type, logging status (all read-only).', expected: 'All data read-only on slave', narration: 'Perfect for passenger to monitor operations' },
        ],
        tips: ['Master and slave must be on same network', 'Slave is view-only (cannot start/stop logging)', 'Great for driver/navigator team'],
      },
    ],
  },
  {
    id: 'admin-panel',
    number: '11',
    title: 'Admin Panel',
    icon: <Shield size={24} />,
    color: 'text-emerald-400',
    screenshot: '/screenshots/admin.jpg',
    tutorials: [
      {
        id: 'admin-customers',
        number: '11.1',
        title: 'Managing Customers and Subscriptions',
        goal: 'Add customers and assign subscription plans',
        duration: '~5 minutes',
        prerequisites: 'Admin account',
        steps: [
          { action: 'Access Admin Panel', details: 'Log in with admin account, navigate to /admin, enter admin password.', expected: 'Admin dashboard loads', narration: 'Admin panel requires special authentication' },
          { action: 'View Customer List', details: 'See "Customers" tab with table: name, email, company, subscription plan, status, actions.', expected: 'All registered users displayed', narration: 'Manage all customer accounts from one place' },
          { action: 'Approve Pending Account', details: 'Find pending account (yellow badge), click "Approve". Optionally select subscription plan before approving.', expected: 'Account approved, user can now log in', narration: 'Review and approve new accounts' },
          { action: 'Change Subscription Plan', details: 'Click "Edit" on customer row. Change plan: Free, Basic, Plus, Pro. Click "Save".', expected: 'Plan updated, features change immediately', narration: 'Upgrade or downgrade at any time' },
          { action: 'Suspend/Delete Account', details: 'Click "Suspend" to temporarily disable, or "Delete" to permanently remove.', expected: 'Account status changes', narration: 'Manage account lifecycle' },
        ],
        tips: ['Review pending accounts daily', 'Communicate plan changes to customers', 'Suspended accounts can be reactivated'],
      },
      {
        id: 'admin-analytics',
        number: '11.2',
        title: 'Viewing Analytics and Audit Logs',
        goal: 'Monitor usage and review system events',
        duration: '~3 minutes',
        prerequisites: 'Admin access',
        steps: [
          { action: 'View Analytics Dashboard', details: 'Click "Analytics" tab. See: total users, active sessions, surveys completed, measurements logged.', expected: 'Dashboard with key metrics', narration: 'Analytics show system-wide usage' },
          { action: 'View Usage Trends', details: 'See charts for: daily active users, measurements per day, popular features, subscription distribution.', expected: 'Charts and graphs render', narration: 'Track growth and feature adoption' },
          { action: 'Review Audit Logs', details: 'Click "Audit Logs" tab. See chronological event log: logins, account changes, subscription modifications, admin actions.', expected: 'Complete audit trail', narration: 'Every admin action is logged for accountability' },
          { action: 'Export Reports', details: 'Click "Export Report" button, select date range and format.', expected: 'Report downloads', narration: 'Export reports for business analysis' },
        ],
        tips: ['Check analytics weekly for trends', 'Audit logs cannot be modified or deleted', 'Export reports for stakeholder presentations'],
      },
    ],
  },
];

const KEYBOARD_SHORTCUTS = [
  { category: 'General Actions', shortcuts: [
    { keys: 'Alt+1', action: 'Capture Image' },
    { keys: 'Alt+G', action: 'Log Measurement' },
    { keys: 'Alt+2', action: 'Clear Alert' },
    { keys: 'Alt+C', action: 'Clear All Captured Images' },
    { keys: 'Ctrl+Backspace', action: 'Delete Last Entry' },
  ]},
  { category: 'Logging Controls', shortcuts: [
    { keys: 'Alt+3', action: 'Start Logging' },
    { keys: 'Alt+4', action: 'Stop Logging' },
    { keys: 'Alt+5', action: 'Pause Logging' },
    { keys: 'Alt+6', action: 'Start GPS Trace' },
    { keys: 'Alt+Z', action: 'Clear All Alerts' },
  ]},
  { category: 'Logging Modes', shortcuts: [
    { keys: 'Alt+M', action: 'Manual Mode' },
    { keys: 'Alt+A', action: 'All Data Mode' },
    { keys: 'Alt+D', action: 'Detection Mode' },
    { keys: 'Alt+Shift+S', action: 'Manual + Detection Mode' },
  ]},
  { category: 'Video', shortcuts: [
    { keys: 'Alt+V', action: 'Toggle Video Recording' },
  ]},
  { category: 'AI Detection', shortcuts: [
    { keys: 'Alt+7', action: 'Accept Detection' },
    { keys: 'Alt+8', action: 'Reject Detection' },
    { keys: 'Alt+9', action: 'Correct Detection' },
    { keys: 'Alt+0', action: 'Test Detection' },
  ]},
  { category: 'Envelope Clearance', shortcuts: [
    { keys: 'Alt+Shift+E', action: 'Toggle Envelope Monitoring' },
    { keys: 'Alt+Shift+P', action: 'Cycle Vehicle Profile' },
  ]},
  { category: 'POI Types (Number Keys)', shortcuts: [
    { keys: '1', action: 'Bridge' },
    { keys: '2', action: 'Trees' },
    { keys: '3', action: 'Wire' },
    { keys: '4', action: 'Power Line' },
    { keys: '5', action: 'Traffic Light' },
    { keys: '6', action: 'Walkways' },
    { keys: '7', action: 'Lateral Obstruction' },
    { keys: '8', action: 'Road' },
    { keys: '9', action: 'Intersection' },
    { keys: '0', action: 'Signalization' },
  ]},
];

function Database({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

export default function ScribeTutorialPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    document.title = 'MeasurePRO Scribe Tutorials | SolTec Innovation';
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTIONS.map(s => ({ id: s.id, el: document.getElementById(s.id) }));
      for (const { id, el } of sections.reverse()) {
        if (el && el.getBoundingClientRect().top <= 150) {
          setActiveSection(id);
          return;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 print-root" data-testid="scribe-tutorial-page">
      <div className="print-page-header print-only hidden" aria-hidden="true">
        MeasurePRO Scribe Tutorials — SolTec Innovation — www.SolTecInnovation.com
      </div>
      <div className="no-print sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-white transition-colors" data-testid="link-home">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-bold text-white flex items-center gap-2" data-testid="text-page-title">
              <Book size={20} className="text-blue-400" /> MeasurePRO Scribe Tutorials
            </h1>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded-lg transition-colors"
            data-testid="button-print"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 doc-container">
        <div className="text-center mb-10 cover-page">
          <h1 className="text-4xl font-bold text-white mb-3" data-testid="text-main-title">MeasurePRO Scribe Tutorials</h1>
          <p className="text-gray-400 text-lg mb-2">Complete step-by-step scripts for every MeasurePRO feature</p>
          <div className="text-gray-500 text-sm" data-testid="text-branding">
            <p>SolTec Innovation &bull; <a href="https://www.SolTecInnovation.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" data-testid="link-soltec-website">www.SolTecInnovation.com</a></p>
            <p>1.438.533.5344 &bull; <a href="mailto:support@soltec.ca" className="text-blue-400 hover:underline" data-testid="link-soltec-email">support@soltec.ca</a></p>
          </div>
        </div>

        <div className="toc-box bg-gray-800/60 border border-gray-700 rounded-xl p-6 mb-12" data-testid="toc-container">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><FileText size={20} className="text-blue-400" /> Table of Contents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SECTIONS.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${activeSection === section.id ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40' : 'hover:bg-gray-700/50 text-gray-300'}`}
                data-testid={`toc-link-${section.id}`}
              >
                <span className={section.color}>{section.icon}</span>
                <span className="font-medium">{section.number}.</span> {section.title}
                <span className="ml-auto text-gray-500 text-xs">{section.tutorials.length} tutorial{section.tutorials.length > 1 ? 's' : ''}</span>
              </a>
            ))}
            <a href="#keyboard-shortcuts" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700/50 text-gray-300 text-sm" data-testid="toc-link-keyboard-shortcuts">
              <span className="text-gray-400"><Keyboard size={20} /></span>
              <span className="font-medium">12.</span> Keyboard Shortcuts Reference
            </a>
            <a href="#recording-tips" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700/50 text-gray-300 text-sm" data-testid="toc-link-recording-tips">
              <span className="text-gray-400"><Video size={20} /></span>
              Tips for Recording Scribe Tutorials
            </a>
          </div>
        </div>

        {SECTIONS.map(section => (
          <Section key={section.id} id={section.id}>
            <SectionTitle icon={section.icon} title={`${section.number}. ${section.title}`} color={section.color} />
            {section.screenshot && (
              <div className="mb-6 rounded-lg overflow-hidden border border-gray-700" data-testid={`screenshot-${section.id}`}>
                <img src={section.screenshot} alt={section.title} className="w-full max-h-64 object-cover" loading="lazy" />
              </div>
            )}
            {section.tutorials.map(tutorial => (
              <TutorialCard key={tutorial.id} tutorial={tutorial} />
            ))}
          </Section>
        ))}

        <Section id="keyboard-shortcuts">
          <SectionTitle icon={<Keyboard size={24} />} title="12. Keyboard Shortcuts Reference" color="text-gray-300" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {KEYBOARD_SHORTCUTS.map(group => (
              <div key={group.category} className="doc-card border border-gray-700 rounded-lg p-4 bg-gray-800/50" data-testid={`shortcuts-${group.category.toLowerCase().replace(/\s+/g, '-')}`}>
                <h3 className="text-sm font-semibold text-blue-400 mb-3">{group.category}</h3>
                <div className="space-y-2">
                  {group.shortcuts.map(s => (
                    <div key={s.keys} className="flex items-center justify-between text-sm">
                      <kbd className="px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-gray-200">{s.keys}</kbd>
                      <span className="text-gray-300">{s.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="recording-tips">
          <SectionTitle icon={<Video size={24} />} title="Tips for Recording Scribe Tutorials" color="text-yellow-400" />
          <div className="doc-card border border-gray-700 rounded-lg p-5 bg-gray-800/50" data-testid="recording-tips-card">
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">1.</span> <span><strong className="text-white">Clear Audio:</strong> Speak clearly and at moderate pace</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">2.</span> <span><strong className="text-white">Show Mouse Movements:</strong> Exaggerate clicks and hovers for visibility</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">3.</span> <span><strong className="text-white">Pause Between Steps:</strong> Give viewers time to absorb each action</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">4.</span> <span><strong className="text-white">Show Expected Results:</strong> Always show what happens after each action</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">5.</span> <span><strong className="text-white">Highlight Important Elements:</strong> Use Scribe's annotation features</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">6.</span> <span><strong className="text-white">Test Equipment First:</strong> Ensure laser, GPS, camera work before recording</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">7.</span> <span><strong className="text-white">Use Real Data:</strong> Authentic measurements are more believable than demos</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">8.</span> <span><strong className="text-white">Record in Segments:</strong> Break long tutorials into 3-5 minute sections</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">9.</span> <span><strong className="text-white">Include Troubleshooting:</strong> Show common issues and how to fix them</span></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 font-bold">10.</span> <span><strong className="text-white">Add Written Steps:</strong> Scribe auto-generates these, but review and edit for clarity</span></li>
            </ol>
          </div>
        </Section>

        <Section id="priority-order">
          <SectionTitle icon={<BarChart3 size={24} />} title="Scribe Tutorial Priority Order" color="text-green-400" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="priority-order-grid">
            <div className="doc-card border border-green-700/40 rounded-lg p-4 bg-green-900/10">
              <h3 className="text-sm font-semibold text-green-400 mb-3">Start with these (highest priority)</h3>
              <ol className="space-y-1 text-sm text-gray-300">
                <li>1. Creating Account & Logging In (1.1, 1.2)</li>
                <li>2. Connecting Laser & GPS (2.1, 2.2)</li>
                <li>3. Understanding Logging Modes (3.1)</li>
                <li>4. Logging POIs (3.2)</li>
                <li>5. Enabling Voice Commands (4.1)</li>
              </ol>
            </div>
            <div className="doc-card border border-amber-700/40 rounded-lg p-4 bg-amber-900/10">
              <h3 className="text-sm font-semibold text-amber-400 mb-3">Then move to premium features</h3>
              <ol className="space-y-1 text-sm text-gray-300" start={6}>
                <li>6. AI Detection Setup (5.1)</li>
                <li>7. Envelope Clearance (6.1, 6.2)</li>
                <li>8. Route Enforcement (8.1, 8.2)</li>
              </ol>
            </div>
            <div className="doc-card border border-purple-700/40 rounded-lg p-4 bg-purple-900/10">
              <h3 className="text-sm font-semibold text-purple-400 mb-3">Advanced users</h3>
              <ol className="space-y-1 text-sm text-gray-300" start={9}>
                <li>9. Convoy Guardian (7.1, 7.2)</li>
                <li>10. Swept Path Analysis (9.1, 9.2)</li>
                <li>11. Admin Panel (11.1, 11.2)</li>
              </ol>
            </div>
          </div>
        </Section>

        <footer className="mt-16 pt-8 border-t border-gray-700 text-center text-gray-500 text-sm pb-8" data-testid="footer-branding">
          <p className="font-medium text-gray-400">SolTec Innovation</p>
          <p><a href="https://www.SolTecInnovation.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" data-testid="link-footer-website">www.SolTecInnovation.com</a> &bull; 1.438.533.5344 &bull; <a href="mailto:support@soltec.ca" className="text-blue-400 hover:underline" data-testid="link-footer-email">support@soltec.ca</a></p>
          <p className="mt-2">MeasurePRO Scribe Tutorial Documentation</p>
        </footer>
      </div>
    </div>
  );
}
