import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  HelpCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Download,
  Camera,
  MapPin,
  Ruler,
  Wifi,
  Shield,
  Database,
  Settings,
  AlertTriangle,
  Mail,
  FileText,
  Monitor,
  CheckCircle,
  Mic,
  CloudRain,
  Cpu,
  Keyboard,
  Package,
  ScanLine,
  Printer,
  ExternalLink
} from 'lucide-react';

export default function HelpPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const Section = ({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => {
    const isExpanded = expandedSections.has(id);
    
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden" data-testid={`section-${id}`}>
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-750 transition-colors"
          data-testid={`button-toggle-${id}`}
        >
          <div className="flex items-center gap-3">
            <div className="text-blue-500">{icon}</div>
            <h3 className="text-xl font-semibold text-white text-left">{title}</h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <div className="p-6 pt-0 border-t border-gray-700">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Navigation */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
                data-testid="link-back"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/features"
                className="text-gray-300 hover:text-white transition-colors"
                data-testid="link-features"
              >
                Features
              </Link>
              <Link
                to="/pricing"
                className="text-gray-300 hover:text-white transition-colors"
                data-testid="link-pricing"
              >
                Pricing
              </Link>
              <Link
                to="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                data-testid="button-signup"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <HelpCircle className="w-16 h-16 text-blue-500 mx-auto mb-6" />
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-page-title">
            Help & Documentation
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed" data-testid="text-page-subtitle">
            Everything you need to get started with MeasurePRO and maximize your surveying efficiency
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="space-y-4">
          {/* Getting Started */}
          <Section
            id="getting-started"
            title="Getting Started"
            icon={<Zap className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Quick Setup (5 Minutes)</h4>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Install MeasurePRO — a <strong>7-day free trial</strong> starts automatically (no license key needed)</li>
                  <li>Connect your laser distance meter via USB/Serial</li>
                  <li>Grant GPS and camera permissions when prompted</li>
                  <li>Create your first survey and start measuring!</li>
                  <li>During the trial, send your <strong>Machine ID</strong> to your administrator to get your permanent license key</li>
                </ol>
              </div>

              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                <h5 className="font-semibold text-blue-400 mb-2">License Activation:</h5>
                <p className="text-sm">
                  Click <strong>"Activate License"</strong> in the trial banner to see your Machine ID, copy it, and email it to your administrator. Once you receive your license key, paste it in the same panel to activate all your features instantly — no internet required.
                </p>
              </div>
            </div>
          </Section>

          {/* Hardware Requirements */}
          <Section
            id="hardware"
            title="Hardware Requirements"
            icon={<Settings className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Compatible Devices</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <Ruler className="w-5 h-5 text-blue-500 mt-1" />
                      <div>
                        <h5 className="font-semibold text-white">Laser Distance Meters</h5>
                        <ul className="text-sm mt-2 space-y-1">
                          <li>• SolTec laser (recommended)</li>
                          <li>• Any Web Serial API compatible device</li>
                          <li>• RS-232 or USB connection</li>
                          <li>• 9600-115200 baud rate</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <MapPin className="w-5 h-5 text-green-500 mt-1" />
                      <div>
                        <h5 className="font-semibold text-white">GPS Modules</h5>
                        <ul className="text-sm mt-2 space-y-1">
                          <li>• NMEA 0183 compatible GPS</li>
                          <li>• Serial or USB connection</li>
                          <li>• Device geolocation fallback</li>
                          <li>• 1-10 Hz update rate</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <Camera className="w-5 h-5 text-purple-500 mt-1" />
                      <div>
                        <h5 className="font-semibold text-white">Cameras</h5>
                        <ul className="text-sm mt-2 space-y-1">
                          <li>• Standard webcam (720p+)</li>
                          <li>• ZED 2i stereo camera (premium)</li>
                          <li>• MediaStream API compatible</li>
                          <li>• 30 FPS minimum</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <Monitor className="w-5 h-5 text-amber-500 mt-1" />
                      <div>
                        <h5 className="font-semibold text-white">Computer</h5>
                        <ul className="text-sm mt-2 space-y-1">
                          <li>• Windows 10+ / Chrome OS</li>
                          <li>• Chrome/Edge browser (latest)</li>
                          <li>• 4GB RAM minimum</li>
                          <li>• USB ports for devices</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* RTK-GNSS FAQ */}
          <Section
            id="gnss"
            title="GPS & RTK-GNSS"
            icon={<MapPin className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What GPS sources does MeasurePRO support?</h4>
                <p>MeasurePRO supports 4 GPS sources in priority order: <strong>Swift Navigation Duro</strong> (RTK-GNSS via USB serial — highest priority, centimetre-level accuracy), <strong>USB GPS dongle</strong> (NMEA over serial), <strong>Bluetooth GPS</strong>, and the browser's built-in <strong>Geolocation API</strong> (fallback). The system automatically selects the highest-accuracy source and displays which source is active.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How does the Duro/GNSS automatic failover work?</h4>
                <p>When the Swift Navigation Duro is connected and actively sending data, it takes full priority and USB GPS data is ignored. If the Duro stops sending data for more than <strong>5 seconds</strong>, MeasurePRO automatically falls back to the USB GPS (or next available source). This ensures uninterrupted recording even in areas with temporary RTK signal loss.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What does the Duro provide beyond basic GPS?</h4>
                <p>The Swift Navigation Duro provides full <strong>GNSS + IMU</strong> data: precise position (lat/lon/altitude), velocity, and inertial measurements (roll, pitch, yaw). The IMU roll angle is used directly by MeasurePRO to compute real-time road banking / cross-slope angle, which is essential for OS/OW safety analysis and exported with road profile data.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">My GPS position is jumping. What should I check?</h4>
                <p>1. Verify the correct COM port is selected under Settings → GPS. 2. For Duro, check the RTK fix status indicator — a float fix is less stable than a fixed RTK solution. 3. Ensure the Duro has a clear sky view and the base station / NTRIP corrections are configured. 4. In the GPS Diagnostics panel, inspect raw NMEA sentences for parsing errors. Contact <a href="mailto:support@soltecinnovation.com" className="text-blue-400 hover:text-blue-300 underline">support@soltecinnovation.com</a> if issues persist.</p>
              </div>
            </div>
          </Section>

          {/* Multi-Laser FAQ */}
          <Section
            id="multi-laser"
            title="Multi-Laser System"
            icon={<Ruler className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How many lasers can be connected simultaneously?</h4>
                <p>MeasurePRO supports up to <strong>4 independent laser ports</strong> simultaneously: the primary vertical clearance laser, left lateral laser, right lateral laser, and rear overhang laser. Each is assigned its own COM port in Settings → Multi-Laser, and each can be linked to a position-specific camera.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What are the keyboard shortcuts for the lateral / rear lasers?</h4>
                <p>
                  <code className="bg-gray-700 px-1 rounded">Alt + [</code> — Capture left lateral measurement<br />
                  <code className="bg-gray-700 px-1 rounded">Alt + ]</code> — Capture right lateral measurement<br />
                  <code className="bg-gray-700 px-1 rounded">Alt + \</code> — Capture total lane width (left + right + vehicle width)<br />
                  <code className="bg-gray-700 px-1 rounded">Alt + '</code> — Capture rear overhang measurement
                </p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How are lateral width measurements calculated?</h4>
                <p>In dual-laser mode, total lane width = left laser reading + vehicle width + right laser reading (vehicle offsets are configured in Settings → Multi-Laser). In single-laser mode, the vehicle width offset is added to the single reading. All thresholds (warning and critical levels) are configurable per laser.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">My lateral laser is not showing readings. What should I check?</h4>
                <p>The lateral and rear lasers use the <strong>Soltec-old protocol</strong> (19200 baud, 7E1 framing). Ensure Settings → Multi-Laser has the correct COM port selected and "Soltec-old" protocol selected. The laser must be powered on (12 V) — no TX command is required. Check that no other application is holding the serial port open.</p>
              </div>
            </div>
          </Section>

          {/* Account Management */}
          <Section
            id="account"
            title="Account Management"
            icon={<Shield className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How do I create an account?</h4>
                <p>Visit the <Link to="/signup" className="text-blue-400 hover:text-blue-300 underline">signup page</Link> and complete the 6-step registration process. You'll need to provide your name, email, company details, select a subscription plan, and accept the terms & conditions.</p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Why is admin approval required?</h4>
                <p>MeasurePRO is a professional tool, and we manually review all registrations to ensure quality and prevent misuse. Approval typically takes 1-24 hours.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How do I reset my password?</h4>
                <p>Click "Forgot Password" on the <Link to="/login" className="text-blue-400 hover:text-blue-300 underline">login page</Link>. You'll receive an email with a password reset link valid for 1 hour.</p>
              </div>
            </div>
          </Section>

          {/* Subscription & Billing */}
          <Section
            id="billing"
            title="Subscription & Billing"
            icon={<FileText className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What subscription plans are available?</h4>
                <p>MeasurePRO offers a base software licence (monthly or annual) plus optional premium add-on modules (MeasurePRO+ AI, Envelope Clearance, Convoy Guardian, Swept Path Analysis, etc.). Hardware bundle pricing (LiDAR system, rugged tablet, GPS) is managed separately by SolTec Innovation. See the <Link to="/pricing" className="text-blue-400 hover:text-blue-300 underline">pricing page</Link> for current rates, or <Link to="/contact" className="text-blue-400 hover:text-blue-300 underline">contact us</Link> for a quote.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Is there a Beta Tester access?</h4>
                <p>Yes — Beta Tester access is available by application. Beta testers get early access to new features in exchange for providing feedback. Apply via the <Link to="/signup" className="text-blue-400 hover:text-blue-300 underline">sign-up page</Link> and select Beta Tester, subject to admin approval.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How do I cancel or change my subscription?</h4>
                <p>Go to Settings → Subscription to manage your plan. Your access continues until the end of your current billing period. All your survey data remains exportable at any time.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Where is hardware bundle pricing?</h4>
                <p>Complete hardware bundles (SolTec LiDAR 2D system, Swift Duro RTK-GNSS, rugged tablet, vehicle mounting kit, training, and 1-year support) are priced through <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">soltecinnovation.com</a>. <Link to="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact us</Link> for a quote.</p>
              </div>
            </div>
          </Section>

          {/* Offline Mode */}
          <Section
            id="offline"
            title="Offline Mode & Grace Period"
            icon={<Wifi className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How does offline mode work?</h4>
                <p>MeasurePRO is offline-first. All data is stored locally in IndexedDB and syncs to cloud when online. You can work completely offline for extended periods.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is the 10-day grace period?</h4>
                <p>If you haven't synced with our servers for 7 days, you'll see a warning. After 10 days offline, the app enters read-only mode until you reconnect. This ensures license compliance while allowing field work in remote areas.</p>
              </div>

              <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-amber-400 mb-1">Important:</h5>
                    <p className="text-sm">Your data is never deleted during the grace period. Everything syncs automatically when you reconnect to the internet.</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Data Export & Backup */}
          <Section
            id="export"
            title="Data Export & Backup"
            icon={<Database className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What export formats are supported?</h4>
                <p>MeasurePRO has three separate export pipelines depending on what you are exporting:</p>
                <ul className="list-none mt-3 space-y-2 text-sm">
                  <li><strong className="text-white">Survey POI / Measurement data:</strong> <strong>CSV</strong> (date, time, height, GPS, POI type, notes), <strong>JSON</strong> (raw structured data), <strong>GeoJSON</strong> (Point features with all attributes for QGIS / ArcGIS). Full survey as a <strong>ZIP package</strong> — includes all of the above plus photos, videos, timelapse frames, voice notes, geo-referenced video, activity logs, and GPS vehicle traces (exported as GeoJSON + KML inside the bundle).</li>
                  <li><strong className="text-white">Road Profile engineering (GNSS pipeline):</strong> <strong>CSV</strong> (chainage, grade, K-factor per point), <strong>GeoJSON</strong> (alignment + profile features), <strong>Shapefile</strong> (.shp/.shx/.dbf/.prj — ArcGIS/QGIS native), <strong>DXF</strong> (AutoCAD direct import with profile layers), <strong>LandXML</strong> (Civil 3D / OpenRoads compatible), or <strong>ZIP bundle</strong> containing all formats with metadata + re-import capability. CRS options: WGS84, Web Mercator, Australian MGA zones (GDA2020), and custom EPSG codes.</li>
                  <li><strong className="text-white">Point cloud scans (Hesai Pandar40P LiDAR):</strong> <strong>PLY</strong> (binary, includes RGB colour) and <strong>LAS</strong> (industry-standard for CloudCompare, Civil 3D, Recap).</li>
                </ul>
                <p className="mt-2 text-xs text-gray-400">Note: YOLO v5/v8 training data export is available in Settings → AI Training for admin/developer use only, not part of the standard survey export.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How do I backup my data?</h4>
                <p>Go to Settings → Data Export → Download All Data. This creates a ZIP file with all measurements, photos, videos, and survey metadata.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Can I email reports automatically?</h4>
                <p>Yes! Configure email settings in Settings → Email Integration. You can automatically send reports when surveys are completed or thresholds are exceeded.</p>
              </div>
            </div>
          </Section>

          {/* Troubleshooting */}
          <Section
            id="troubleshooting"
            title="Troubleshooting"
            icon={<AlertTriangle className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Laser not connecting?</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4 text-sm">
                  <li>Check USB cable connection</li>
                  <li>Verify device is powered on</li>
                  <li>Try Settings → Serial Config → Auto-detect</li>
                  <li>Manually select correct COM port and baud rate</li>
                  <li>Grant browser serial port permissions when prompted</li>
                </ol>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">GPS not working?</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4 text-sm">
                  <li>Check GPS module connection (if using hardware GPS)</li>
                  <li>Grant device geolocation permission</li>
                  <li>Ensure GPS has clear view of sky</li>
                  <li>Wait 30-60 seconds for GPS lock</li>
                  <li>Device GPS fallback activates automatically if hardware GPS fails</li>
                </ol>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Camera not displaying?</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4 text-sm">
                  <li>Grant browser camera permission when prompted</li>
                  <li>Check camera is not in use by another application</li>
                  <li>Try Settings → Camera → Select Camera</li>
                  <li>Refresh the page</li>
                  <li>Restart MeasurePRO if issue persists</li>
                </ol>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Data not syncing?</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4 text-sm">
                  <li>Check internet connection</li>
                  <li>Verify Firebase credentials (if using cloud sync)</li>
                  <li>Go to Settings → Sync → Manual Sync</li>
                  <li>Check console for error messages</li>
                  <li>Contact support if issue persists</li>
                </ol>
              </div>

              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                <h5 className="font-semibold text-blue-400 mb-2">Still Having Issues?</h5>
                <p className="text-sm mb-3">
                  Most problems can be resolved by restarting MeasurePRO, restarting the browser, or checking permissions.
                </p>
                <p className="text-sm">
                  For persistent issues, use the Serial Tester (Settings → Serial Tester) to diagnose hardware communication problems.
                </p>
              </div>
            </div>
          </Section>

          {/* Voice Commands & Voice Notes */}
          <Section
            id="voice-commands"
            title="Voice Commands & Voice Notes"
            icon={<Mic className="w-6 h-6" />}
          >
            <div className="space-y-6 text-gray-300">
              {/* Introduction */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Multilingual Voice Control</h4>
                <p>
                  MeasurePRO features a multilingual voice assistant that supports English, French, and Spanish voice commands. Control the application hands-free while working in the field.
                </p>
              </div>

              <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4" data-testid="warning-voice-offline">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-300 mb-1">Internet Connection Required</h4>
                    <p className="text-sm text-amber-100/90">
                      Voice commands require an active internet connection due to browser limitations. Voice notes work completely offline.
                    </p>
                  </div>
                </div>
              </div>

              {/* Getting Started */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Getting Started with Voice Commands</h4>
                
                <div className="space-y-4">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-blue-500" />
                      Activating Voice Control
                    </h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Go to <strong>Settings → Voice Commands</strong></li>
                      <li>Toggle "Enable Voice Assistant" to ON</li>
                      <li>Grant microphone permissions when prompted</li>
                      <li>The voice assistant icon will appear in the header</li>
                      <li>Say "help" to hear available commands</li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                      <h5 className="font-semibold text-white mb-2">Language Selection</h5>
                      <p className="text-sm mb-2">Choose your preferred command language:</p>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>EN</strong> - English commands</li>
                        <li>• <strong>FR</strong> - French commands (Français)</li>
                        <li>• <strong>ES</strong> - Spanish commands (Español)</li>
                      </ul>
                      <p className="text-xs text-gray-400 mt-2">
                        Change language in Settings → Voice Commands → Language
                      </p>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                      <h5 className="font-semibold text-white mb-2">Microphone Permissions</h5>
                      <p className="text-sm mb-2">Browser will request microphone access:</p>
                      <ul className="text-sm space-y-1">
                        <li>• Click "Allow" when prompted</li>
                        <li>• Ensure microphone is not muted</li>
                        <li>• Check browser privacy settings</li>
                        <li>• Test mic in Settings → Voice Commands</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Volume Control</h5>
                    <p className="text-sm mb-2">Adjust voice response volume:</p>
                    <ul className="text-sm space-y-1">
                      <li>• Say <strong>"volume up"</strong> to increase response volume</li>
                      <li>• Say <strong>"volume down"</strong> to decrease response volume</li>
                      <li>• Set default volume in Settings → Voice Commands</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Complete Command Reference */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Complete Command Reference</h4>
                <p className="text-sm mb-4 text-gray-400">All commands work in English, French, and Spanish</p>

                {/* Information Queries */}
                <div className="mb-6">
                  <h5 className="font-semibold text-blue-400 mb-3 text-lg">Information Queries</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"last measurement"</span>
                        <span className="text-gray-400">Get most recent reading</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"GPS location"</span>
                        <span className="text-gray-400">Current coordinates</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"laser status"</span>
                        <span className="text-gray-400">Laser connection status</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"GPS status"</span>
                        <span className="text-gray-400">GPS connection & fix</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"fix quality"</span>
                        <span className="text-gray-400">Satellite count & accuracy</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"speed"</span>
                        <span className="text-gray-400">Current vehicle speed</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* General Actions */}
                <div className="mb-6">
                  <h5 className="font-semibold text-purple-400 mb-3 text-lg">General Actions</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"capture image"</span>
                        <span className="text-gray-400">Take a photo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"clear alert"</span>
                        <span className="text-gray-400">Dismiss current alert</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"clear images"</span>
                        <span className="text-gray-400">Delete all captured images</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"log measurement"</span>
                        <span className="text-gray-400">Save current measurement</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logging Controls */}
                <div className="mb-6">
                  <h5 className="font-semibold text-amber-400 mb-3 text-lg">Logging Controls</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"start logging"</span>
                        <span className="text-gray-400">Begin data logging</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"stop logging"</span>
                        <span className="text-gray-400">End data logging</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"pause logging"</span>
                        <span className="text-gray-400">Pause data logging</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"manual mode"</span>
                        <span className="text-gray-400">Switch to manual logging</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"all data mode"</span>
                        <span className="text-gray-400">Log all data continuously</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"detection mode"</span>
                        <span className="text-gray-400">AI-triggered logging</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"manual detection mode"</span>
                        <span className="text-gray-400">Manual AI logging</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"clear all alerts"</span>
                        <span className="text-gray-400">Clear all active alerts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"GPS trace"</span>
                        <span className="text-gray-400">Start GPS trace recording</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Recording */}
                <div className="mb-6">
                  <h5 className="font-semibold text-red-400 mb-3 text-lg">Video Recording</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"toggle video"</span>
                        <span className="text-gray-400">Start/stop video recording</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Detection Operations */}
                <div className="mb-6">
                  <h5 className="font-semibold text-cyan-400 mb-3 text-lg">AI Detection Operations</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"accept detection"</span>
                        <span className="text-gray-400">Accept AI detection</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"reject detection"</span>
                        <span className="text-gray-400">Reject AI detection</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"correct detection"</span>
                        <span className="text-gray-400">Correct AI detection</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"test detection"</span>
                        <span className="text-gray-400">Test detection system</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Envelope Clearance */}
                <div className="mb-6">
                  <h5 className="font-semibold text-orange-400 mb-3 text-lg">Envelope Clearance</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"toggle envelope"</span>
                        <span className="text-gray-400">Enable/disable monitoring</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"cycle vehicle profile"</span>
                        <span className="text-gray-400">Switch vehicle profile</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* POI Type Selection */}
                <div className="mb-6">
                  <h5 className="font-semibold text-pink-400 mb-3 text-lg">POI Type Selection (16 Types)</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-3">Say the POI type name to select it for the next measurement</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                      <span className="text-green-400 font-mono">"bridge"</span>
                      <span className="text-green-400 font-mono">"trees"</span>
                      <span className="text-green-400 font-mono">"wire"</span>
                      <span className="text-green-400 font-mono">"power line"</span>
                      <span className="text-green-400 font-mono">"traffic light"</span>
                      <span className="text-green-400 font-mono">"walkways"</span>
                      <span className="text-green-400 font-mono">"obstruction"</span>
                      <span className="text-green-400 font-mono">"road"</span>
                      <span className="text-green-400 font-mono">"intersection"</span>
                      <span className="text-green-400 font-mono">"signalization"</span>
                      <span className="text-green-400 font-mono">"railroad"</span>
                      <span className="text-green-400 font-mono">"information"</span>
                      <span className="text-green-400 font-mono">"danger"</span>
                      <span className="text-green-400 font-mono">"important note"</span>
                      <span className="text-green-400 font-mono">"work required"</span>
                      <span className="text-green-400 font-mono">"restricted"</span>
                    </div>
                  </div>
                </div>

                {/* Audio & Misc */}
                <div className="mb-6">
                  <h5 className="font-semibold text-indigo-400 mb-3 text-lg">Audio & Miscellaneous</h5>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"volume up"</span>
                        <span className="text-gray-400">Increase voice volume</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"volume down"</span>
                        <span className="text-gray-400">Decrease voice volume</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"record note"</span>
                        <span className="text-gray-400">Record voice note</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"manual log"</span>
                        <span className="text-gray-400">Trigger manual log entry</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"clear warnings"</span>
                        <span className="text-gray-400">Clear warning alerts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-400 font-mono">"clear critical"</span>
                        <span className="text-gray-400">Clear critical alerts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips & Best Practices */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Tips & Best Practices</h4>
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Speak clearly and naturally</strong> - No need to shout or speak robotically</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Commands work in any supported language</strong> - Switch between EN/FR/ES anytime</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Visual and audio feedback confirms commands</strong> - Look for on-screen confirmations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Say "help" to hear available commands</strong> - Assistant will list all options</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Commands match keyboard shortcuts</strong> - Same actions, different input method</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Quiet environment recommended</strong> - Reduces background noise interference</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Voice Notes */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Voice Notes (Fully Offline)</h4>
                <p className="mb-3">
                  Unlike voice commands, <strong>voice notes work completely offline</strong>. Record audio notes attached to measurements for documentation and field observations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Features</h5>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Works offline without internet</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Stored locally in IndexedDB</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Attached to specific measurements</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Playback in measurement history</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">How to Record</h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Say "record note" or click mic icon</li>
                      <li>Speak your observation</li>
                      <li>Click stop to save</li>
                      <li>Note is attached to current measurement</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Troubleshooting */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Troubleshooting Voice Commands</h4>
                <div className="space-y-4">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Microphone Not Working</h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Check browser permissions (click lock icon in address bar)</li>
                      <li>Verify microphone is not muted in system settings</li>
                      <li>Test microphone in another application</li>
                      <li>Try a different browser (Chrome/Edge recommended)</li>
                      <li>Restart MeasurePRO and reload page</li>
                    </ol>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Commands Not Recognized</h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Verify internet connection (required for voice recognition)</li>
                      <li>Speak more clearly and at normal volume</li>
                      <li>Check selected language matches your speech</li>
                      <li>Reduce background noise</li>
                      <li>Try saying command differently (e.g., "start log" vs "start logging")</li>
                      <li>Say "help" to hear valid command examples</li>
                    </ol>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Language Selection Issues</h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Go to Settings → Voice Commands → Language</li>
                      <li>Select correct language (EN/FR/ES)</li>
                      <li>Toggle voice assistant OFF then ON</li>
                      <li>Speak in selected language only</li>
                      <li>Check voice feedback is in correct language</li>
                    </ol>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Browser Compatibility</h5>
                    <p className="text-sm mb-2">Voice commands require modern browser features:</p>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <strong>Recommended:</strong> Chrome 90+, Edge 90+
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <strong>Supported:</strong> Opera, Brave, Vivaldi
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <strong>Limited:</strong> Firefox (experimental support)
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <strong>Not Supported:</strong> Safari, Internet Explorer
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Settings Access */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Voice Settings Configuration</h4>
                <p className="mb-3">Access comprehensive voice settings in <strong>Settings → Voice Commands</strong>:</p>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Enable/Disable Voice Assistant</strong> - Toggle voice control on/off</li>
                    <li>• <strong>Language Selection</strong> - Choose EN/FR/ES for commands</li>
                    <li>• <strong>Voice Response Volume</strong> - Adjust audio feedback level</li>
                    <li>• <strong>Voice Gender & Style</strong> - Select preferred voice type</li>
                    <li>• <strong>Confidence Threshold</strong> - Adjust command recognition sensitivity</li>
                    <li>• <strong>Test Microphone</strong> - Verify audio input is working</li>
                    <li>• <strong>Command History</strong> - View recently recognized commands</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          {/* Weather Effects on LiDAR */}
          <Section
            id="weather-lidar"
            title="Weather Effects on LiDAR Measurements"
            icon={<CloudRain className="w-6 h-6" />}
          >
            <div className="space-y-6 text-gray-300">
              <p className="text-lg">
                Understanding how weather conditions affect LiDAR performance is essential for field professionals. 
                Weather can significantly impact measurement accuracy, detection range, and data quality.
              </p>

              {/* How LiDAR Works */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">How LiDAR Technology Works</h4>
                <p className="mb-3">
                  LiDAR (Light Detection and Ranging) uses laser pulses to measure distances with remarkable precision. 
                  The principle is straightforward: <strong>Distance = (Speed of Light × Time of Flight) ÷ 2</strong>. 
                  Modern systems perform millions of calculations per second, creating detailed "point clouds" that capture 
                  environmental details with centimeter-level accuracy.
                </p>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Key Components</h5>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Laser Source:</strong> Creates energy pulses (typically near-infrared spectrum)</li>
                    <li>• <strong>Scanner:</strong> Guides laser beams across target areas via rotating mirrors</li>
                    <li>• <strong>Detector:</strong> Picks up reflected light and converts to electrical signals</li>
                    <li>• <strong>Processing Unit:</strong> Converts signals into usable positional data</li>
                  </ul>
                </div>
              </div>

              {/* Rain Effects */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Rain Effects on LiDAR</h4>
                <p className="mb-4">
                  Rain affects LiDAR through multiple physical mechanisms. Airborne raindrops directly block laser beams, 
                  causing scattering, refraction, and premature reflection. Water droplets on sensor surfaces act like 
                  tiny lenses that distort optical paths.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Performance Impact by Rainfall Intensity</h5>
                    <ul className="text-sm space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span><strong>Light rain (10-20mm/h):</strong> 15-20% range reduction</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span><strong>Heavy rain (25mm/h):</strong> 30% range reduction, 45% point cloud drop</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span><strong>Extreme rain (40mm/h+):</strong> Detection may fail completely</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Technical Challenges</h5>
                    <ul className="text-sm space-y-1">
                      <li>• False positives from raindrops at short range (&lt;50m)</li>
                      <li>• Range measurement errors up to 20cm in heavy rain</li>
                      <li>• Signal absorption reduces return strength</li>
                      <li>• Water on sensor surfaces creates uneven distortion</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Fog Effects */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Fog Effects on LiDAR</h4>
                <p className="mb-4">
                  Surprisingly, LiDAR often outperforms cameras and human vision in fog. This is because LiDAR's 
                  focused laser energy has approximately 7× more optical power density than visible light at 100 meters, 
                  allowing it to push through moderate fog more effectively.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                    <h5 className="font-semibold text-blue-400 mb-2">LiDAR Advantage in Fog</h5>
                    <p className="text-sm">
                      Research shows LiDAR can detect objects at 50+ meters when cameras fail completely. 
                      Fog causes mainly <em>diffusion</em> (light scattered by tiny water molecules), which 
                      affects visible light cameras more than focused laser pulses.
                    </p>
                  </div>
                  <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4">
                    <h5 className="font-semibold text-amber-400 mb-2">Limitations in Dense Fog</h5>
                    <p className="text-sm">
                      Dense fog (visibility ≤50m) causes approximately 50% range reduction and may cause 
                      localization algorithms to fail due to low feature point count. Avoid critical operations 
                      in thick fog conditions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Snow Effects */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Snow Effects on LiDAR</h4>
                <p className="mb-4">
                  Snow presents unique challenges because snowflakes are larger than fog droplets, causing 
                  more significant backscatter of laser beams. Snowflakes create false returns at varying 
                  ranges from actual targets.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Snow Challenges</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Larger particles cause greater laser beam backscatter</li>
                      <li>• False detections with high density, low intensity patterns</li>
                      <li>• Close-range noise with fast signal decay</li>
                      <li>• Standard filtering algorithms show many false positives</li>
                    </ul>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">Ice Accumulation Issues</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Ice on sensor housings changes reflective properties</li>
                      <li>• Weakens returned laser signals significantly</li>
                      <li>• Reduces point cloud density and intensity</li>
                      <li>• Requires frequent sensor cleaning during operations</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Temperature Effects */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Temperature Effects</h4>
                <p className="mb-4">
                  Extreme temperatures affect LiDAR sensor components at the molecular level. Cold weather 
                  can reduce laser echo counts by up to 50%, while high temperatures increase thermal noise 
                  in detection circuits.
                </p>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Temperature Considerations</h5>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Below -10°C:</strong> Up to 50% reduction in sensing range</li>
                    <li>• <strong>High temperatures:</strong> Increased dark current in APD sensors</li>
                    <li>• <strong>Condensation:</strong> Forms on sensor windows in humid conditions</li>
                    <li>• <strong>Thermal expansion:</strong> Affects optical component alignment</li>
                  </ul>
                </div>
              </div>

              {/* Best Practices */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">Best Practices for Weather Operations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
                    <h5 className="font-semibold text-green-400 mb-2">Recommended Conditions</h5>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Clear or overcast skies</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Light rain (&lt;20mm/h) - proceed with caution</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Weak fog (&gt;150m visibility)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Temperature between -10°C and 40°C</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
                    <h5 className="font-semibold text-red-400 mb-2">Avoid or Exercise Extreme Caution</h5>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>Heavy rain (&gt;30mm/h)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>Thick fog (≤50m visibility)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>Heavy snowfall or blizzard conditions</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>Ice accumulation on sensors</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* MeasurePRO Solutions */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-xl font-semibold text-white mb-4">MeasurePRO Weather Solutions</h4>
                <p className="mb-4">
                  MeasurePRO includes intelligent noise filtering and signal processing algorithms designed 
                  to maintain measurement accuracy in challenging conditions:
                </p>
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Adaptive Noise Filtering:</strong> Automatically filters rain, snow, and dust particles from measurements</li>
                    <li>• <strong>Signal Quality Indicators:</strong> Real-time feedback on measurement confidence levels</li>
                    <li>• <strong>Multi-sample Averaging:</strong> Reduces random errors from atmospheric interference</li>
                    <li>• <strong>Height Clearance Thresholds:</strong> Configurable ignoreAbove/ignoreBelow settings filter outliers</li>
                    <li>• <strong>Weather Logging:</strong> Document conditions for measurement context and quality assurance</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          {/* Road Profiling */}
          <Section
            id="road-profiling"
            title="Road Profiling & Grade Analysis"
            icon={<MapPin className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is Road Profiling?</h4>
                <p>Road Profiling is a GNSS-powered module that records the longitudinal profile of a road as you drive. It calculates <strong>chainage</strong> (distance along the route), <strong>grade</strong> (slope as a percentage), and <strong>K-factor</strong> (rate of change of grade — used to design vertical curves) at each GPS point. The resulting profile is used for OS/OW route engineering, pavement condition assessment, and civil design exports.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How to activate Road Profiling</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4 text-sm">
                  <li>Connect the Swift Navigation Duro (RTK-GNSS) — Road Profiling requires centimetre-level elevation data, not available from USB/BT GPS or device geolocation</li>
                  <li>Wait for RTK Fixed fix (green indicator in the GNSS panel)</li>
                  <li>Open <strong>Settings → Road Profile</strong> and toggle "Enable Road Profile Recording"</li>
                  <li>Create or open a survey and start logging (<code className="bg-gray-700 px-1 rounded">Alt+3</code>)</li>
                  <li>The profile records automatically — no additional key presses needed</li>
                </ol>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Chainage</h5>
                  <p className="text-sm">Cumulative distance in metres from the survey start point. Automatically computed from GPS coordinates and vehicle trajectory.</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Grade (%)</h5>
                  <p className="text-sm">Rise over run expressed as a percentage. Positive = uphill, negative = downhill. A 12%+ grade is flagged with a POI automatically.</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">K-factor</h5>
                  <p className="text-sm">Rate of change between consecutive grade segments. Used in civil design to size vertical curves for safe stopping sight distance.</p>
                </div>
              </div>
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                <h5 className="font-semibold text-blue-400 mb-2">Export formats for Road Profile data:</h5>
                <p className="text-sm">CSV (chainage/grade/K-factor per point) · GeoJSON · Shapefile (.shp) · DXF (AutoCAD) · LandXML (Civil 3D / OpenRoads) · ZIP bundle with all formats</p>
              </div>
            </div>
          </Section>

          {/* Banking & Cross-Slope */}
          <Section
            id="banking"
            title="Banking & Cross-Slope Detection"
            icon={<Ruler className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is Cross-Slope / Banking?</h4>
                <p>Cross-slope (also called road banking or superelevation) is the lateral tilt of the road surface, measured in degrees. MeasurePRO reads the <strong>IMU roll angle</strong> from the Swift Navigation Duro in real time — no separate inclinometer is needed. This angle represents the tilt of the vehicle (and therefore the road) perpendicular to the direction of travel.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Why it matters for OS/OW permits</h4>
                <p className="text-sm">For oversize / overweight loads, excessive road banking can shift the centre of gravity of a tall load towards the low side, reducing stability and potentially causing rollover. MeasurePRO flags and records banking angles that exceed safe thresholds for the vehicle profile selected.</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h5 className="font-semibold text-white mb-3">Banking Severity Scale</h5>
                <div className="space-y-2 text-sm">
                  {[['Normal', '0–3°', 'text-green-400', 'Standard road — no concern'], ['Caution', '3–5°', 'text-yellow-400', 'Monitor load stability'], ['Warning', '5–7°', 'text-amber-400', 'Reduce speed, note in survey'], ['Critical', '7–10°', 'text-red-400', 'Flag for engineering review'], ['Unacceptable', '>10°', 'text-red-600', 'Route not recommended for tall OS/OW loads']].map(([label, range, cls, note]) => (
                    <div key={label} className="flex items-center gap-4">
                      <span className={`font-bold w-28 shrink-0 ${cls}`}>{label}</span>
                      <code className="bg-gray-700 px-1 rounded text-xs font-mono w-14">{range}</code>
                      <span className="text-gray-400">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <p className="text-sm">Banking data is only available when the Swift Navigation Duro is connected and providing IMU roll output. USB GPS and device geolocation do not provide this data.</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Amplitude Filter */}
          <Section
            id="amplitude-filter"
            title="Amplitude Filter (Laser Signal Quality)"
            icon={<Cpu className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is the Amplitude Filter?</h4>
                <p>The amplitude filter discards laser returns whose signal strength (amplitude) falls below a configurable threshold. Weak returns typically indicate one of: a surface at extreme range, rain/dust scatter, a dark or non-reflective surface, or a grazing-angle reflection. By rejecting these weak returns, the filter prevents noisy, unreliable readings from polluting your survey data.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">When to adjust it</h4>
                <div className="space-y-2 text-sm">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                    <strong className="text-amber-400">Increase the minimum amplitude</strong> when: driving in rain or dusty conditions (to reject false rain-drop returns), or when the laser is picking up low-quality echoes from leaves and foliage.
                  </div>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                    <strong className="text-blue-400">Decrease the minimum amplitude</strong> when: measuring dark asphalt surfaces, surfaces at maximum range, or when valid readings are being incorrectly rejected.
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400">Configure in: <strong className="text-white">Settings → Laser → Amplitude Filter</strong></p>
            </div>
          </Section>

          {/* Convoy Guardian */}
          <Section
            id="convoy-guardian"
            title="Convoy Guardian (Multi-Vehicle)"
            icon={<Shield className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is Convoy Guardian?</h4>
                <p>Convoy Guardian is a premium add-on that connects multiple survey vehicles in real time over a WebSocket network. The lead vehicle hosts the convoy session; support vehicles (pilot cars, chase cars) join by scanning a QR code. All vehicles share GPS positions, clearance measurements, alerts, and communications on a live dashboard.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Key features</h5>
                  <ul className="text-sm space-y-1">
                    <li>• Up to 100 vehicles per convoy</li>
                    <li>• Real-time GPS positions for all vehicles</li>
                    <li>• Shared clearance measurements and alerts</li>
                    <li>• Live voice and text messaging between vehicles</li>
                    <li>• Emergency alert broadcast to entire convoy</li>
                    <li>• Video feeds from all vehicle cameras (optional)</li>
                  </ul>
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Black Box Logging</h5>
                  <p className="text-sm">Every measurement, GPS track, alert, and communication from every vehicle is recorded in the forensic-grade black box. If anything goes wrong, you have complete timestamped evidence of what every vehicle knew, when, and where. Black box files run 1–5 GB per 8-hour operation.</p>
                </div>
              </div>
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                <h5 className="font-semibold text-blue-400 mb-1">Licensing:</h5>
                <p className="text-sm">Only the lead vehicle needs a Convoy Guardian subscription ($2,000/month). Support vehicles join for free via QR code.</p>
              </div>
            </div>
          </Section>

          {/* Swept Path Analysis */}
          <Section
            id="swept-path"
            title="Swept Path Analysis"
            icon={<Monitor className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is Swept Path Analysis?</h4>
                <p>Swept Path Analysis predicts the area swept by a vehicle and its load as it navigates turns and tight sections. MeasurePRO overlays the swept path corridor on the map based on the selected vehicle profile (length, width, overhang, turning radius), helping operators identify sections where the load may encroach on kerbs, barriers, or opposing traffic.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How to use</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4 text-sm">
                  <li>Activate the Swept Path module in Settings → Premium → Swept Path</li>
                  <li>Select or configure a vehicle profile (dimensions, overhang, turning radius)</li>
                  <li>The swept path overlay appears on the map as you drive or replay a GPS route</li>
                  <li>Red zones indicate sections where the swept envelope exceeds the available lane width</li>
                  <li>Export the analysis as GeoJSON or PDF for inclusion in permit packages</li>
                </ol>
              </div>
            </div>
          </Section>

          {/* Route Enforcement */}
          <Section
            id="route-enforcement"
            title="Route Enforcement"
            icon={<MapPin className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is Route Enforcement?</h4>
                <p>Route Enforcement ensures drivers stay on their permitted route. A GPX file (GPS Exchange Format) is uploaded by dispatch to define the approved path. The driver's device monitors GPS position continuously and triggers an alert if the vehicle deviates from the route. It is used for OS/OW loads, hazmat transport, or any operation requiring strict route compliance.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">The STOP Modal</h4>
                <p className="text-sm">If a driver goes off-route for <strong>7 or more consecutive seconds</strong>, a full-screen red <strong>STOP modal</strong> is triggered on the driver's device. The modal cannot be dismissed by the driver — only dispatch can clear it remotely after assessing the situation. This ensures every off-route incident is acknowledged and documented.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Setup (Dispatch side)</h5>
                  <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                    <li>Go to Route Enforcement → New Convoy</li>
                    <li>Upload the GPX route file</li>
                    <li>Configure buffer zones (15 m urban / 30 m rural)</li>
                    <li>Share the convoy QR code with drivers</li>
                    <li>Monitor the live dispatch console</li>
                  </ol>
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Clearing a STOP modal</h5>
                  <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                    <li>Dispatch sees the off-route alert on the console</li>
                    <li>Contact the driver via the in-app call button</li>
                    <li>Assess the situation (detour? wrong turn? GPS error?)</li>
                    <li>Click "Clear Violation" to dismiss driver's STOP modal</li>
                    <li>Add resolution notes for compliance records</li>
                  </ol>
                </div>
              </div>
            </div>
          </Section>

          {/* RoadScope */}
          <Section
            id="roadscope"
            title="RoadScope Mobile Integration"
            icon={<Monitor className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What is RoadScope?</h4>
                <p>RoadScope is the lightweight mobile companion app for MeasurePRO, available for iOS and Android. It provides a streamlined view of live survey data, alerts, and GPS position for secondary operators (pilot car drivers, flaggers) who need situational awareness without operating the full MeasurePRO interface.</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Key capabilities</h4>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Real-time clearance alerts from the primary vehicle</li>
                  <li>Live GPS map showing all convoy vehicle positions</li>
                  <li>One-tap call to dispatch or lead vehicle</li>
                  <li>Receive STOP modal when route enforcement triggers</li>
                  <li>Offline-capable for areas with poor cell coverage</li>
                </ul>
              </div>
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                <p className="text-sm"><strong>Login:</strong> Use your existing MeasurePRO credentials. RoadScope automatically connects to any active convoy or Route Enforcement session your account is enrolled in.</p>
              </div>
            </div>
          </Section>

          {/* Auto-Part Manager */}
          <Section
            id="auto-part"
            title="Auto-Part Manager (200-POI Auto-Split)"
            icon={<Package className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">What does Auto-Part Manager do?</h4>
                <p>When a survey accumulates <strong>200 Point of Interest (POI) entries</strong>, MeasurePRO automatically saves and closes the current survey part and opens a new part — all without interrupting the survey drive. This prevents individual survey files from becoming unmanageably large and ensures data is saved at regular intervals, reducing the impact of any crash or storage event.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">How it works</h5>
                  <ul className="text-sm space-y-1">
                    <li>• Threshold: <strong>200 POIs per part</strong> (configurable in Settings → Survey → Auto-Part)</li>
                    <li>• Split is automatic — no operator action required</li>
                    <li>• Parts are named sequentially: Survey_Part1, Survey_Part2, etc.</li>
                    <li>• All parts are linked to the same parent survey project</li>
                  </ul>
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Retrieving parts</h5>
                  <ul className="text-sm space-y-1">
                    <li>• Open Survey Manager — parts appear as sub-entries under the parent survey</li>
                    <li>• Each part can be viewed, exported, or combined individually</li>
                    <li>• Export all parts together via "Export All Parts" on the parent survey</li>
                    <li>• Manual split: use the "Split Survey" button in Survey Manager → Options</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          {/* Contact Support */}
          <Section
            id="contact"
            title="Contact Support"
            icon={<Mail className="w-6 h-6" />}
          >
            <div className="space-y-4 text-gray-300">
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Email Support</h4>
                <p className="mb-2">For technical support and general inquiries:</p>
                <a
                  href="mailto:info@soltecinnovation.com"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  data-testid="button-email-support"
                >
                  <Mail className="w-5 h-5" />
                  info@soltecinnovation.com
                </a>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Contact Form</h4>
                <p className="mb-2">Use our contact form for detailed inquiries:</p>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  data-testid="link-contact-form"
                >
                  Contact Us
                </Link>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Response Time</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span><strong>Professional/Enterprise:</strong> Priority support (4-8 hours)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span><strong>Basic:</strong> Standard support (24-48 hours)</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>
        </div>
      </section>

      {/* Printable Documents */}
      <section className="container mx-auto px-6 py-12 bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2" data-testid="text-downloads-title">
              Printable Documents
            </h2>
            <p className="text-gray-400 text-sm">All guides are formatted for Letter (8.5×11 in) · Open any guide and click <strong className="text-white">Print</strong> to save as PDF</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Laser Quick Start */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3 hover:border-blue-600/60 transition-colors" data-testid="card-doc-help-laser">
              <div className="flex items-center gap-3">
                <div className="bg-blue-900/40 border border-blue-700/50 rounded-lg p-2.5 shrink-0">
                  <Cpu className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-blue-300 mb-0.5">LiDAR Kit</div>
                  <h3 className="text-sm font-semibold text-white leading-tight">Quick Start — Laser</h3>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">12V wiring, USB-serial connection, app setup, ground reference, multi-laser system.</p>
              <Link to="/docs/laser-quickstart" className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors" data-testid="button-open-help-laser">
                <Printer className="w-3.5 h-3.5" /> Open &amp; Print
              </Link>
            </div>

            {/* GNSS Quick Start */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3 hover:border-green-600/60 transition-colors" data-testid="card-doc-help-gnss">
              <div className="flex items-center gap-3">
                <div className="bg-green-900/40 border border-green-700/50 rounded-lg p-2.5 shrink-0">
                  <MapPin className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-green-300 mb-0.5">GNSS Kit</div>
                  <h3 className="text-sm font-semibold text-white leading-tight">Quick Start — GNSS</h3>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">Antenna install, Duro power, RTK fix types, NTRIP configuration.</p>
              <Link to="/docs/gnss-quickstart" className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors" data-testid="button-open-help-gnss">
                <Printer className="w-3.5 h-3.5" /> Open &amp; Print
              </Link>
            </div>

            {/* Field Reference Card */}
            <div className="bg-gray-800 border border-yellow-700/40 rounded-xl p-5 flex flex-col gap-3 hover:border-yellow-500/60 transition-colors" data-testid="card-doc-help-field">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-900/40 border border-yellow-700/50 rounded-lg p-2.5 shrink-0">
                  <Keyboard className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-yellow-300 mb-0.5">Both Kits</div>
                  <h3 className="text-sm font-semibold text-white leading-tight">Field Reference Card</h3>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">All keyboard shortcuts, POI types, startup sequence. Print and laminate for in-cab use.</p>
              <Link to="/docs/field-card" className="flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors" data-testid="button-open-help-field">
                <Printer className="w-3.5 h-3.5" /> Open &amp; Print
              </Link>
            </div>

            {/* Environmental Guide */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3 hover:border-sky-600/60 transition-colors" data-testid="card-doc-help-env">
              <div className="flex items-center gap-3">
                <div className="bg-sky-900/40 border border-sky-700/50 rounded-lg p-2.5 shrink-0">
                  <CloudRain className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-sky-300 mb-0.5">Both Kits</div>
                  <h3 className="text-sm font-semibold text-white leading-tight">Environmental Conditions</h3>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">Rain, fog, direct sun, dark surfaces, extreme temperatures — effects on laser and camera.</p>
              <Link to="/docs/environmental" className="flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors" data-testid="button-open-help-env">
                <Printer className="w-3.5 h-3.5" /> Open &amp; Print
              </Link>
            </div>

            {/* Auto-Part Guide */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3 hover:border-orange-600/60 transition-colors" data-testid="card-doc-help-autopart">
              <div className="flex items-center gap-3">
                <div className="bg-orange-900/40 border border-orange-700/50 rounded-lg p-2.5 shrink-0">
                  <Package className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-orange-300 mb-0.5">Both Kits</div>
                  <h3 className="text-sm font-semibold text-white leading-tight">Auto-Part System</h3>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">Auto-save at 200 POIs, retrieving parts, configuring threshold, manual transition.</p>
              <Link to="/docs/autopart" className="flex items-center justify-center gap-2 bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors" data-testid="button-open-help-autopart">
                <Printer className="w-3.5 h-3.5" /> Open &amp; Print
              </Link>
            </div>

            {/* Pandar40P Guide */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3 hover:border-purple-600/60 transition-colors" data-testid="card-doc-help-pandar">
              <div className="flex items-center gap-3">
                <div className="bg-purple-900/40 border border-purple-700/50 rounded-lg p-2.5 shrink-0">
                  <ScanLine className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-purple-300 mb-0.5">LiDAR 3D Kit</div>
                  <h3 className="text-sm font-semibold text-white leading-tight">Pandar40P LiDAR Guide</h3>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">Lemo connector, 12V power, Ethernet, static IP, Windows service, 3 capture modes.</p>
              <Link to="/docs/pandar40p" className="flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors" data-testid="button-open-help-pandar">
                <Printer className="w-3.5 h-3.5" /> Open &amp; Print
              </Link>
            </div>

            {/* Voice Command Reference */}
            <div className="bg-gray-800 border border-violet-700/40 rounded-xl p-5 flex flex-col gap-3 hover:border-violet-500/60 transition-colors" data-testid="card-doc-help-voice">
              <div className="flex items-center gap-3">
                <div className="bg-violet-900/40 border border-violet-700/50 rounded-lg p-2.5 shrink-0">
                  <Mic className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <div className="text-xs font-medium text-violet-300 mb-0.5">Both Kits</div>
                  <h3 className="text-sm font-semibold text-white leading-tight">Voice Command Reference</h3>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">All 65+ voice commands by category: status queries, logging, POI types, AI detection, and audio controls.</p>
              <Link to="/docs/voice-commands" className="flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors" data-testid="button-open-help-voice">
                <Printer className="w-3.5 h-3.5" /> Open &amp; Print
              </Link>
            </div>

          </div>

          <div className="mt-6 flex items-center justify-center">
            <Link to="/docs" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors" data-testid="link-all-docs">
              <ExternalLink className="w-4 h-4" /> View all documents
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-2 border-blue-500 rounded-xl p-12 text-center max-w-4xl mx-auto" data-testid="section-cta">
          <h2 className="text-4xl font-bold text-white mb-4" data-testid="text-cta-title">
            Need More Help?
          </h2>
          <p className="text-xl text-gray-300 mb-8" data-testid="text-cta-subtitle">
            Our support team is here to help you succeed with MeasurePRO
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
              data-testid="button-cta-contact"
            >
              <Mail className="w-5 h-5" />
              Contact Support
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
              data-testid="button-cta-signup"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-product">Product</h3>
              <div className="space-y-2">
                <Link to="/features" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-features">
                  Features
                </Link>
                <Link to="/pricing" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-pricing">
                  Pricing
                </Link>
                <Link to="/help" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-help">
                  Documentation
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-company">Company</h3>
              <div className="space-y-2">
                <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-company">
                  SolTecInnovation
                </a>
                <Link to="/contact" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-contact">
                  Contact Us
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-legal">Legal</h3>
              <div className="space-y-2">
                <Link to="/terms" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-terms">
                  Terms & Conditions
                </Link>
                <Link to="/privacy" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-privacy">
                  Privacy Policy
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-support">Support</h3>
              <div className="space-y-2">
                <Link to="/help" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-documentation">
                  Documentation
                </Link>
                <a href="mailto:info@soltecinnovation.com" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-email">
                  Email Support
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p data-testid="text-footer-copyright">
              © 2025 SolTecInnovation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
