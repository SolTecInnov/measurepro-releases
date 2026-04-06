import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import {
  ArrowLeft, Book, Settings, Zap, HelpCircle, ExternalLink, Mail,
  Ruler, MapPin, Mic, Download, Cpu, Radio, Truck, Navigation,
  Route, Brain, CheckCircle, Keyboard, Smartphone, FileText,
  Camera, Shield, AlertTriangle, Globe, Volume2, Layers, Cloud,
  Database, Wifi, Eye, Sun, CloudRain, Thermometer, ChevronDown,
  ChevronRight, Terminal, RotateCw, Save, Package, Activity,
  TrendingUp, Cable, Zap as ZapIcon, Train, Tree, Info, Wrench,
  ShieldAlert, Circle, XOctagon, ParkingCircle, Mountain
} from 'lucide-react';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: black !important; font-size: 10pt; font-family: Arial, sans-serif; }
  .print-root { background: white !important; }
  .doc-container { max-width: 100% !important; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14pt; }
  .doc-card { border: 1px solid #d1d5db !important; background: white !important; break-inside: avoid; page-break-inside: avoid; border-radius: 0 !important; }
  h2, h3 { break-after: avoid; page-break-after: avoid; }
  .faq-btn { display: none !important; }
  .faq-body { display: block !important; border-top: 1px solid #d1d5db; }
  .toc-box { display: none !important; }
  .doc-note { break-inside: avoid; page-break-inside: avoid; }

  /* backgrounds */
  .bg-gray-900, .bg-gray-800, .bg-gray-750, .bg-gray-700 { background: white !important; }
  div[class*="bg-gray-900\\/"] { background: #f9fafb !important; }
  div[class*="bg-blue-900\\/"], div[class*="bg-amber-900\\/"], div[class*="bg-red-900\\/"], div[class*="bg-green-900\\/"] { background: white !important; }

  /* borders */
  div[class*="border-gray-7"] { border-color: #d1d5db !important; }
  div[class*="border-blue-7"], div[class*="border-blue-8"] { border-color: #93c5fd !important; }
  div[class*="border-green-7"], div[class*="border-green-8"] { border-color: #86efac !important; }
  div[class*="border-amber-7"], div[class*="border-amber-8"] { border-color: #fcd34d !important; }
  div[class*="border-red-7"], div[class*="border-red-8"] { border-color: #fca5a5 !important; }
  div[class*="border-purple-7"], div[class*="border-purple-8"] { border-color: #d8b4fe !important; }
  div[class*="border-cyan-7"], div[class*="border-cyan-8"] { border-color: #a5f3fc !important; }
  div[class*="border-orange-7"], div[class*="border-orange-8"] { border-color: #fdba74 !important; }
  div[class*="border-yellow-7"] { border-color: #fde68a !important; }
  div[class*="border-indigo-7"], div[class*="border-indigo-8"] { border-color: #c7d2fe !important; }

  /* text — all light variants remapped to dark printable colors */
  .text-white { color: #111827 !important; }
  .text-blue-500, .text-blue-400, .text-blue-300, .text-blue-200 { color: #1d4ed8 !important; }
  .text-green-500, .text-green-400, .text-green-300, .text-green-200 { color: #15803d !important; }
  .text-amber-500, .text-amber-400, .text-amber-300, .text-amber-200 { color: #92400e !important; }
  .text-red-500, .text-red-400, .text-red-300, .text-red-200 { color: #991b1b !important; }
  .text-yellow-500, .text-yellow-400, .text-yellow-300 { color: #92400e !important; }
  .text-purple-500, .text-purple-400, .text-purple-300, .text-purple-200 { color: #6d28d9 !important; }
  .text-orange-500, .text-orange-400, .text-orange-300, .text-orange-200 { color: #c2410c !important; }
  .text-cyan-500, .text-cyan-400, .text-cyan-300 { color: #0e7490 !important; }
  .text-indigo-500, .text-indigo-400, .text-indigo-300 { color: #4338ca !important; }
  .text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }

  /* kbd */
  kbd { border: 1px solid #374151 !important; background: #f3f4f6 !important; color: #111 !important; }

  /* gradient headings */
  .min-h-screen { min-height: unset !important; }
  nav { display: none !important; }
}
@page { size: letter portrait; margin: 1.25cm 1.5cm; }
`;

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

function Card({ children, border = 'border-gray-700', className = '' }: { children: React.ReactNode; border?: string; className?: string }) {
  return (
    <div className={`doc-card bg-gray-800 border ${border} rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
}

function Note({ color = 'amber', children }: { color?: 'amber' | 'blue' | 'red' | 'green'; children: React.ReactNode }) {
  const map = {
    amber: 'bg-amber-900/30 border-amber-700/50 text-amber-300',
    blue: 'bg-blue-900/30 border-blue-700/50 text-blue-300',
    red: 'bg-red-900/30 border-red-700/50 text-red-300',
    green: 'bg-green-900/30 border-green-700/50 text-green-300',
  };
  return (
    <div className={`doc-note border rounded p-3 mt-3 text-xs ${map[color]}`}>
      {children}
    </div>
  );
}

function Check({ color = 'green', children }: { color?: 'green' | 'blue' | 'purple' | 'amber'; children: React.ReactNode }) {
  const cls = { green: 'text-green-400', blue: 'text-blue-400', purple: 'text-purple-400', amber: 'text-amber-400' }[color];
  return (
    <li className="flex items-start gap-2">
      <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${cls}`} />
      <span>{children}</span>
    </li>
  );
}

function Kbd({ k }: { k: string }) {
  return <kbd className="bg-gray-700 border border-gray-600 px-2 py-0.5 rounded text-xs font-mono">{k}</kbd>;
}

function CollapsibleFaq({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="faq-btn w-full text-left px-5 py-4 bg-gray-800 hover:bg-gray-750 flex items-center justify-between gap-3 text-white font-medium text-sm transition-colors"
        data-testid={`faq-toggle-${q.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
      >
        <span>{q}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      <div className={`faq-body px-5 py-4 bg-gray-800/50 text-sm text-gray-300 space-y-2 border-t border-gray-700 ${open ? 'block' : 'hidden'}`}>
        <p className="font-semibold text-white text-xs mb-2">{q}</p>
        {children}
      </div>
    </div>
  );
}

const TOC = [
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'hardware', label: 'Hardware Setup & Connection' },
  { id: 'survey', label: 'Survey Workflow & POI Types' },
  { id: 'autopart', label: 'Auto-Part Buffer System' },
  { id: 'roadprofile', label: 'Road Profile & GNSS Recording' },
  { id: 'detection', label: 'Detection Methods Explained' },
  { id: 'environment', label: 'Environmental Limitations' },
  { id: 'keyboard', label: 'Keyboard Shortcuts' },
  { id: 'voice', label: 'Voice Commands' },
  { id: 'modules', label: 'MeasurePRO+ Modules' },
  { id: 'export', label: 'Export Formats' },
  { id: 'offline', label: 'Offline & Data Safety' },
  { id: 'troubleshoot', label: 'Troubleshooting FAQ' },
  { id: 'support', label: 'Support & Contact' },
];

export default function DocumentationPage() {
  useEffect(() => {
    document.title = 'Documentation — MeasurePRO LiDAR Road Survey App | measure-pro.app';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Complete MeasurePRO documentation: hardware setup, GPS & laser configuration, survey workflow, auto-part buffer system, detection methods, environmental limitations, keyboard shortcuts, MeasurePRO+ modules, and export formats.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/documentation');
    return () => {
      document.title = 'MeasurePRO — LiDAR Road Survey App for Oversize & Overweight Transport | measure-pro.app';
      if (meta) meta.setAttribute('content', 'MeasurePRO by SolTec Innovation: professional LiDAR & GPS field app for OS/OW heavy haul surveys.');
      if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/');
    };
  }, []);

  return (
    <div className="print-root min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <style>{PRINT_STYLES}</style>
      {/* Nav */}
      <nav className="no-print border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-gray-300 hover:text-white transition-colors flex items-center gap-2" data-testid="link-back">
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/help" className="text-gray-300 hover:text-white transition-colors hidden sm:inline" data-testid="link-help">Help Center</Link>
            <Link to="/blog" className="text-gray-300 hover:text-white transition-colors hidden sm:inline" data-testid="link-blog">Blog</Link>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400 px-4 py-2 rounded-lg text-sm transition-colors"
              data-testid="button-print"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors" data-testid="button-signup">Get Started</Link>
          </div>
        </div>
      </nav>

      <div className="doc-container container mx-auto px-6 py-12 max-w-6xl">
        {/* Title */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Book className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-page-title">Documentation</h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto" data-testid="text-page-subtitle">
            Complete technical reference for MeasurePRO — hardware setup, detection methods, buffer management, environmental limitations, and all add-on modules.
          </p>
          <p className="text-gray-500 text-sm mt-2">For customer service and field operators · SolTec Innovation</p>
        </div>

        {/* Table of Contents */}
        <div className="toc-box mb-12 bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Contents</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {TOC.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                data-testid={`toc-link-${id}`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            1. QUICK START
        ═══════════════════════════════════════════════════════ */}
        <Section id="quickstart">
          <SectionTitle icon={<Zap className="w-6 h-6" />} title="Quick Start Guide" color="text-yellow-400" />
          <Card>
            <ol className="space-y-5 text-gray-300">
              {[
                { n: 1, title: 'Install as a PWA', body: <>Create your account at <Link to="/signup" className="text-blue-400 underline">measure-pro.app/signup</Link>. In Chrome or Edge on your Windows tablet or laptop, click the install icon in the address bar. MeasurePRO installs as a standalone desktop app with full offline capability.</> },
                { n: 2, title: 'Connect your laser', body: 'Plug the laser\'s USB-to-serial cable in. Open Settings → Hardware → Laser. Select the correct COM port (Windows shows it as "USB Serial Port" in Device Manager). The app auto-detects the protocol. The laser streams data automatically when powered — no TX commands are sent by the app.' },
                { n: 3, title: 'Connect your GPS', body: 'Plug the Swift Duro or USB GPS into another USB port. Open Settings → Hardware → GPS. Select the port and baud rate (usually 115200 for Duro, 9600 for standard GPS). Wait for the GPS fix indicator to turn green. For Bluetooth GPS, click "Scan Bluetooth" and pair from the list.' },
                { n: 4, title: 'Set your ground reference', body: <>Aim the vertical laser at the road surface directly below the sensor mount. Press <Kbd k="G" /> or click "Set Ground Reference" in the display panel. All subsequent height readings are automatically offset from this baseline. Re-set any time you reposition the sensor.</> },
                { n: 5, title: 'Start a survey', body: <>Open Survey Manager → New Survey. Fill in surveyor name, client, project number. Drive the route. Press <Kbd k="Space" /> each time you reach a POI (bridge, wire, power line, etc.) — GPS coordinates, laser reading, and a photo are captured together in one keystroke.</> },
                { n: 6, title: 'Export and deliver', body: 'When the survey is complete, click "Close Survey" then "Export". Choose your format (CSV, GeoJSON, ZIP bundle, LandXML, etc.) and send via email or download to device. Surveys also auto-sync to the cloud when online.' },
              ].map(({ n, title, body }) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="text-blue-500 font-bold text-lg w-6 shrink-0">{n}.</span>
                  <div>
                    <strong className="text-white">{title}</strong>
                    <p className="text-sm mt-1">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            2. HARDWARE SETUP
        ═══════════════════════════════════════════════════════ */}
        <Section id="hardware">
          <SectionTitle icon={<Cpu className="w-6 h-6" />} title="Hardware Setup & Connection" color="text-blue-400" />

          {/* Vertical Laser */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Ruler className="w-5 h-5 text-blue-400" />
              Vertical Laser Distance Meter (Primary Height Sensor)
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
              <div>
                <p className="text-white font-medium mb-2">Supported devices & protocols</p>
                <ul className="space-y-2">
                  <Check>SolTec LiDAR 2D — RSA 3-byte binary protocol, 19200 baud, 7-E-1</Check>
                  <Check>SolTec High Pole LiDAR — same RSA protocol</Check>
                  <Check>RSA High Pole Laser — 3-byte binary, 19200 baud, 7-E-1</Check>
                  <Check>Jenoptik laser — ASCII stream protocol</Check>
                  <Check>Mock mode — simulated measurements for demos and testing</Check>
                </ul>
              </div>
              <div>
                <p className="text-white font-medium mb-2">How to connect — step by step</p>
                <ol className="space-y-2 list-decimal list-inside">
                  <li>Power the laser from the 12V vehicle supply. The laser begins streaming on power-up.</li>
                  <li>Connect the USB-to-serial cable between laser and tablet.</li>
                  <li>Open <strong className="text-white">Settings → Hardware → Laser</strong>.</li>
                  <li>Click <strong className="text-white">Select Port</strong>. Choose the port labelled "USB Serial Port" (usually COM3–COM8 on Windows).</li>
                  <li>Select the correct protocol (RSA or Jenoptik). Leave baud rate at 19200 unless instructed otherwise.</li>
                  <li>The live reading should appear in the display panel within 2 seconds.</li>
                </ol>
                <Note color="blue">
                  <strong>No TX commands:</strong> MeasurePRO only reads the serial stream — it never sends commands to the laser. The laser must be powered before the app connects.
                </Note>
                <Note color="amber">
                  <strong>Accuracy:</strong> ±2 mm · Range: 0.2–250 m · Sampling: up to 30 kHz continuous stream
                </Note>
              </div>
            </div>
          </Card>

          {/* Multi-Laser System */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Multi-Laser System (Lateral Width & Rear Overhang)
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Up to 4 independent laser ports can be active simultaneously. The lateral and rear lasers use the <strong className="text-white">soltec-old protocol</strong> (19200 baud, 7-E-1) and are each assigned their own COM port separately from the vertical laser.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Vertical', key: 'Space', color: 'border-blue-700/50', desc: 'Primary height clearance. Points straight up.' },
                { label: 'Left Lateral', key: '[', color: 'border-green-700/50', desc: 'Measures distance to left road edge or obstacle.' },
                { label: 'Right Lateral', key: ']', color: 'border-yellow-700/50', desc: 'Measures distance to right road edge or obstacle.' },
                { label: 'Rear Overhang', key: "'", color: 'border-red-700/50', desc: 'Monitors rear of load (wind blades etc.) up to 80 m.' },
              ].map(l => (
                <div key={l.label} className={`bg-gray-750 border ${l.color} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white text-sm">{l.label}</span>
                    <Kbd k={l.key} />
                  </div>
                  <p className="text-xs text-gray-400">{l.desc}</p>
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong className="text-white">Lateral width modes:</strong> single laser (measures one side, user enters other) or dual laser (both sides measured simultaneously with automatic vehicle offset subtraction).</p>
              <p><strong className="text-white">Vehicle offset:</strong> Configure the distance from each laser to the vehicle centreline in <strong className="text-white">Settings → Lateral Laser</strong>. The app subtracts this automatically so the displayed value is clear lane width, not sensor-to-edge distance.</p>
              <p><strong className="text-white">Alert thresholds:</strong> Set a warning and a critical width in Settings. Warning triggers an amber alert; critical (threshold exceeded by 50%) triggers a red alert and audible alarm.</p>
              <p><strong className="text-white">Rear overhang:</strong> Configure expected load length and maximum permitted overhang in <strong className="text-white">Settings → Rear Overhang</strong>. Alerts are shown when the overhang reading exceeds the limit.</p>
            </div>
          </Card>

          {/* GPS */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" />
              GPS & GNSS Sources — Priority Architecture
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Multiple GPS sources can be connected at the same time. MeasurePRO automatically uses the highest-accuracy source available and switches seamlessly if a source drops out.
            </p>
            <div className="space-y-3 mb-4">
              {[
                { rank: 1, name: 'Swift Navigation Duro (RTK-GNSS)', color: 'text-green-400', badge: 'Highest priority', desc: 'Centimetre-level RTK accuracy. Full IMU output: roll, pitch, heading. Connects via USB serial or Ethernet. When Duro is actively sending data, USB GPS is completely ignored. If Duro stops transmitting for 5 seconds, USB GPS automatically takes over with no operator action required.' },
                { rank: 2, name: 'USB / Wired Serial GPS', color: 'text-blue-400', badge: '2nd priority', desc: 'Any NMEA-compatible GPS receiver at 9600–115200 baud. Metre-level accuracy. Active when Duro is not connected or has been silent for more than 5 seconds.' },
                { rank: 3, name: 'Bluetooth GPS', color: 'text-yellow-400', badge: '3rd priority', desc: 'Paired via Web Bluetooth API. Useful for tablets without USB serial ports. Metre-level accuracy.' },
                { rank: 4, name: 'Browser Geolocation', color: 'text-gray-400', badge: 'Fallback', desc: 'Uses the device\'s built-in GPS or Wi-Fi positioning. 3–15 m accuracy. Only used when no dedicated GPS is connected.' },
              ].map(g => (
                <div key={g.rank} className="flex items-start gap-4 bg-gray-900/40 rounded-lg p-4">
                  <span className={`text-2xl font-black ${g.color} w-8 shrink-0`}>{g.rank}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white text-sm">{g.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-700 ${g.color}`}>{g.badge}</span>
                    </div>
                    <p className="text-xs text-gray-400">{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white font-medium mb-2">Connecting Swift Duro</p>
                <ol className="text-gray-300 space-y-1 list-decimal list-inside text-xs">
                  <li>Power the Duro unit (12–30V DC input).</li>
                  <li>Connect Duro to the tablet via USB or Ethernet.</li>
                  <li>Open <strong>Settings → GNSS → Duro</strong>.</li>
                  <li>Select the COM port (USB) or enter the IP address (Ethernet).</li>
                  <li>Click Connect. The GNSS status panel shows fix type (RTK Fixed, Float, SBAS, etc.).</li>
                  <li>Wait for RTK Fixed status (green) — requires RTK base station or NTRIP corrections.</li>
                </ol>
              </div>
              <div>
                <p className="text-white font-medium mb-2">Connecting USB GPS</p>
                <ol className="text-gray-300 space-y-1 list-decimal list-inside text-xs">
                  <li>Plug GPS receiver into USB port.</li>
                  <li>Open <strong>Settings → GPS → USB Serial</strong>.</li>
                  <li>Select the COM port. Set baud rate (9600 or 115200).</li>
                  <li>Click Connect. The GPS coordinates should appear within 30 seconds of acquiring a fix.</li>
                </ol>
                <Note color="amber">
                  Web Serial API requires Chrome or Edge on desktop. Not supported on iOS Safari or Firefox on mobile.
                </Note>
              </div>
            </div>
          </Card>

          {/* Camera */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-purple-400" />
              Camera System
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
              <div>
                <p className="text-white font-medium mb-2">Standard camera</p>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li>Any USB webcam or laptop built-in camera</li>
                  <li>4 position slots: Front, Left, Right, Rear</li>
                  <li>Configure each position in <strong className="text-white">Settings → Multi-Camera</strong></li>
                  <li>Lateral POI capture uses the matching camera (left capture → left camera)</li>
                  <li>Fallback order: position camera → front camera → selected camera</li>
                  <li>10-second rolling frame buffer — auto-capture uses the frame from 5 seconds ago</li>
                  <li>Every photo gets EXIF GPS metadata embedded automatically</li>
                </ul>
              </div>
              <div>
                <p className="text-white font-medium mb-2">ZED 2i Stereo Camera (MeasurePRO+ only)</p>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li>Depth sensing + RGB video for Envelope Clearance module</li>
                  <li>Connects via USB 3.0 — requires ZED SDK companion server running locally</li>
                  <li>Streams depth data to app via WebSocket</li>
                  <li>Used for real-time load profile monitoring and obstacle detection</li>
                </ul>
                <p className="text-white font-medium mb-2 mt-3">Hesai Pandar40P LiDAR (3D Point Cloud)</p>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li>Requires Windows companion service: <strong>MeasurePRO LiDAR Service</strong></li>
                  <li>C# .NET 8 service — installed once on the field laptop</li>
                  <li>Default WebSocket port: 17777 (auto-fallback 17778–17787)</li>
                  <li>Captures stored at C:\MeasurePRO\Captures\ (configurable)</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Recommended Hardware */}
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-orange-400" />
              Recommended Field Hardware
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
              <ul className="space-y-2 list-disc list-inside ml-2">
                <li>Rugged Windows 10/11 tablet or laptop (SolTec field bundle)</li>
                <li>Chrome or Edge browser — latest version</li>
                <li>USB-C hub with 3–4 USB-A ports (laser + GPS + camera)</li>
                <li>12V vehicle power adapter for laser</li>
                <li>Minimum 8 GB RAM, 256 GB SSD storage</li>
                <li>4G/LTE data connection for cloud sync and voice commands</li>
              </ul>
              <ul className="space-y-2 list-disc list-inside ml-2">
                <li>External antenna for Swift Duro (patch or survey antenna)</li>
                <li>RAM mount or dashboard tablet holder</li>
                <li>Offline maps pre-cached before field work</li>
                <li>Windows laptop for Hesai Pandar40P LiDAR companion service</li>
                <li>.NET 8 Runtime installed for LiDAR service</li>
              </ul>
            </div>
          </Card>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            3. SURVEY WORKFLOW & POI TYPES
        ═══════════════════════════════════════════════════════ */}
        <Section id="survey">
          <SectionTitle icon={<FileText className="w-6 h-6" />} title="Survey Workflow & POI Types" color="text-green-400" />

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">Creating & Managing Surveys</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <Check>Open <strong className="text-white">Survey Manager → New Survey</strong></Check>
                <Check>Fill in: Surveyor name, Client, Project number, Origin → Destination</Check>
                <Check>Set vehicle profile for swept path / clearance modules</Check>
                <Check>Enable GPS trace recording if needed</Check>
                <Check>Survey is identified by a unique UID (first 8 characters shown, e.g., "Survey abc12345")</Check>
                <Check>Multiple parts (auto-split) are linked by rootSurveyId and partOrdinal</Check>
              </ul>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">POI Identification</h3>
              <div className="text-sm text-gray-300 space-y-2">
                <p>Every POI is assigned a collision-proof <strong className="text-white">unique ID</strong> (UUID) at creation time. The display shows only the first 8 characters: <code className="bg-gray-700 px-1 rounded text-xs">POI abc12345</code>.</p>
                <p>The old "POI #1 (Road Y)" sequential numbering is deprecated and removed from all displays. Legacy exports may still contain <code className="bg-gray-700 px-1 rounded text-xs">poiNumber</code> and <code className="bg-gray-700 px-1 rounded text-xs">roadNumber</code> fields for backward compatibility — do not use them for identification.</p>
                <Note color="blue">If a customer asks "where is POI #12", check the export CSV — the old sequential number may be in the <code>poiNumber</code> column, but the canonical reference is the UID.</Note>
              </div>
            </Card>
          </div>

          {/* Ground Reference & Thresholds */}
          <Card className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Ruler className="w-5 h-5 text-blue-400" />
              Ground Reference & Measurement Thresholds
            </h3>
            <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-300">
              <div>
                <p className="text-white font-medium mb-2">Ground Reference (<Kbd k="G" />)</p>
                <p>Aim the laser at the road surface and press G. The app stores this "ground height" and subtracts it from every subsequent reading. This means clearance measurements reflect the actual clearance above ground, not the sensor-to-object distance.</p>
                <p className="mt-2">Re-set the ground reference any time the sensor is repositioned or the truck bed height changes.</p>
              </div>
              <div>
                <p className="text-white font-medium mb-2">Ignore Above threshold</p>
                <p>Any laser reading above this value is discarded as noise or a false sky return. Useful when the laser occasionally picks up a clear sky return on bright days. Default: 20 m. Configure in <strong className="text-white">Settings → Laser Thresholds</strong>.</p>
              </div>
              <div>
                <p className="text-white font-medium mb-2">Ignore Below threshold</p>
                <p>Any reading below this value is discarded. Protects against ground returns when the vehicle pitches on bumps or when the laser briefly points at the road surface during travel. Default: 0.5 m. Adjust for low overhangs if needed.</p>
              </div>
            </div>
          </Card>

          {/* POI Types table */}
          <Card className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4">POI Types — Complete Reference</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                  <ZapIcon className="w-4 h-4" />
                  Height Clearance Auto-Captured
                </p>
                <p className="text-gray-400 text-xs mb-2">Laser reading is automatically recorded on capture. Must pass ignoreAbove / ignoreBelow filters.</p>
                <div className="space-y-1">
                  {[
                    ['overheadStructure', 'Overhead Structure'],
                    ['opticalFiber', 'Optical Fiber'],
                    ['railroad', 'Railroad'],
                    ['signalization', 'Signalization'],
                    ['overpass', 'Overpass'],
                    ['trafficLight', 'Traffic Light'],
                    ['powerLine', 'Power Line'],
                    ['bridgeAndWires', 'Bridge & Wires'],
                    ['wire', 'Wire'],
                    ['tree', 'Trees'],
                  ].map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2 bg-green-900/10 rounded px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                      <span className="text-gray-200 text-xs">{label}</span>
                      <code className="text-gray-500 text-xs ml-auto">{type}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Measurement-Free (No Auto Height)
                </p>
                <p className="text-gray-400 text-xs mb-2">GPS + photo captured. No automatic laser reading. User can manually enter measurements if required.</p>
                <div className="space-y-1">
                  {[
                    ['bridge', 'Bridge'], ['lateralObstruction', 'Lateral Obstruction'], ['road', 'Road'],
                    ['intersection', 'Intersection'], ['information', 'Information'], ['danger', 'Danger'],
                    ['importantNote', 'Important Note'], ['workRequired', 'Work Required'], ['restricted', 'Restricted'],
                    ['gradeUp/Down', 'Grade variants (all)'], ['autoturnRequired', 'Autoturn Required'],
                    ['voiceNote', 'Voice Note'], ['passingLane', 'Passing Lane'], ['parking', 'Parking'],
                    ['gravelRoad', 'Gravel Road'], ['deadEnd', 'Dead End'], ['culvert', 'Culvert'],
                    ['emergencyParking', 'Emergency Parking'], ['roundabout', 'Roundabout'],
                  ].map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2 bg-gray-900/30 rounded px-2 py-1">
                      <span className="w-3 h-3 shrink-0" />
                      <span className="text-gray-300 text-xs">{label}</span>
                      <code className="text-gray-500 text-xs ml-auto">{type}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Note color="blue">
              <strong>Special behaviours:</strong> <code>railroad</code>, <code>intersection</code>, <code>road</code>, <code>bridge</code>, and <code>danger</code> trigger <strong>auto-capture</strong> (photo taken automatically). <code>information</code>, <code>workRequired</code>, <code>importantNote</code>, <code>lateralObstruction</code>, and <code>restricted</code> open a <strong>modal dialog</strong> for the operator to enter additional details.
            </Note>
          </Card>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            4. AUTO-PART BUFFER SYSTEM
        ═══════════════════════════════════════════════════════ */}
        <Section id="autopart">
          <SectionTitle icon={<Package className="w-6 h-6" />} title="Auto-Part Buffer System" color="text-orange-400" />

          <div className="bg-orange-900/20 border border-orange-700/50 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <Package className="w-8 h-8 text-orange-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Why Auto-Part Exists</h3>
                <p className="text-gray-300 text-sm">
                  A very long survey (e.g., 500+ km, 5000+ POIs) stored in a single part creates two problems: the browser's memory fills up with data, and a single large export file becomes slow or unresponsive. The Auto-Part system solves this by automatically splitting a long survey into sequential numbered parts — without stopping the laser, GPS, or requiring any operator action. The survey continues seamlessly; only the internal data bucket is swapped.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4 text-orange-400" />
                Configuration
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-center justify-between bg-gray-900/40 rounded p-3">
                  <span>Default threshold</span>
                  <strong className="text-orange-400">200 POIs</strong>
                </div>
                <div className="flex items-center justify-between bg-gray-900/40 rounded p-3">
                  <span>Configurable range</span>
                  <strong className="text-white">100 – 1000 POIs</strong>
                </div>
                <div className="flex items-center justify-between bg-gray-900/40 rounded p-3">
                  <span>Warning notification at</span>
                  <strong className="text-amber-400">threshold − 50 POIs</strong>
                </div>
                <p className="text-xs text-gray-400">Configure in <strong className="text-white">Settings → Survey → Auto-Part Manager</strong>. You can also enable/disable auto-part here, or trigger a manual part transition at any time.</p>
                <Note color="blue">
                  For short surveys (under 150 POIs expected), you can leave auto-part enabled — it simply won't trigger. For very dense routes, reduce the threshold to 100–150.
                </Note>
              </div>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                What Stays Running During a Part Transition
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <Check color="green"><strong className="text-white">Laser</strong> — keeps streaming, not disconnected</Check>
                <Check color="green"><strong className="text-white">GPS / GNSS</strong> — keeps logging, no reconnect needed</Check>
                <Check color="green"><strong className="text-white">Video recording</strong> — if active, saved and restarted in new part</Check>
                <Check color="green"><strong className="text-white">Bluetooth connections</strong> — stay paired</Check>
                <Check color="amber"><strong className="text-white">Timelapse</strong> — saved and closed; restarts in new part</Check>
                <Check color="amber"><strong className="text-white">Cloud upload</strong> — runs in background if online; skipped if offline</Check>
              </ul>
            </Card>
          </div>

          {/* Step-by-step auto-part process */}
          <Card className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-blue-400" />
              What Happens During Auto-Part Transition — Step by Step
            </h3>
            <ol className="space-y-4">
              {[
                { n: 1, icon: <Volume2 className="w-4 h-4 text-yellow-400" />, title: 'Audible alert + notification', desc: 'A confirmation sound plays and a toast notification appears on screen: "Part X complete — saving and continuing in Part Y."' },
                { n: 2, icon: <Save className="w-4 h-4 text-green-400" />, title: 'Save Part X to hard drive (mandatory)', desc: 'A ZIP package (survey data + all photos + metadata.json) is generated and downloaded to the device automatically. This always happens, even offline.' },
                { n: 3, icon: <Cloud className="w-4 h-4 text-blue-400" />, title: 'Upload to cloud (if online + enabled)', desc: 'The ZIP package is uploaded to Firebase Storage. If offline, this step is skipped — the file is already safe on disk.' },
                { n: 4, icon: <Mail className="w-4 h-4 text-purple-400" />, title: 'Email notification (if configured)', desc: 'An email is sent to the survey owner and any completion email list recipients: "Part X auto-saved at N POIs. Continuing in Part Y."' },
                { n: 5, icon: <Globe className="w-4 h-4 text-cyan-400" />, title: 'RoadScope sync (if configured)', desc: 'POI data (not media files, for speed) is pushed to the RoadScope platform via API key.' },
                { n: 6, icon: <Database className="w-4 h-4 text-orange-400" />, title: 'Memory cache cleared', desc: 'All POI data for Part X is evicted from the in-memory cache. IndexedDB still holds the data until the operator deletes the survey.' },
                { n: 7, icon: <ZapIcon className="w-4 h-4 text-yellow-400" />, title: 'New Part Y created, survey continues', desc: 'A new survey record is created with the same project details, linked to the root survey via rootSurveyId. Laser and GPS continue without any interruption. The operator may not even notice the transition beyond the sound and notification.' },
              ].map(step => (
                <li key={step.n} className="flex items-start gap-4 bg-gray-900/30 rounded-lg p-3">
                  <span className="text-white font-bold w-6 shrink-0 text-sm">{step.n}.</span>
                  <span className="shrink-0 mt-0.5">{step.icon}</span>
                  <div>
                    <strong className="text-white text-sm">{step.title}</strong>
                    <p className="text-gray-400 text-xs mt-1">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {/* FAQ for auto-part */}
          <div className="space-y-3">
            <CollapsibleFaq q="A customer says the auto-save stopped at 200 POIs and they can't find the rest of the data.">
              <p>Auto-save does not delete data — it creates a new survey part and continues. The old part's data is still in IndexedDB. Tell the customer to open Survey Manager and look for "<strong>Survey Name (Part 1)</strong>", "<strong>Survey Name (Part 2)</strong>", etc. All parts appear in the list and can be exported individually.</p>
            </CollapsibleFaq>
            <CollapsibleFaq q="Can the operator manually force a part split without waiting for the threshold?">
              <p>Yes. Go to <strong>Settings → Survey → Auto-Part Manager → Force Part Transition Now</strong>. This triggers the exact same 7-step process immediately regardless of POI count. Useful before leaving a difficult area where re-exporting would be slow.</p>
            </CollapsibleFaq>
            <CollapsibleFaq q="The auto-save ZIP download dialog appeared at a bad moment (driving). Is the data safe?">
              <p>Yes. If the operator dismissed the save dialog or the browser blocked the download, the data is still in IndexedDB. They can re-export Part X manually from Survey Manager at any time. The automatic download is a convenience copy — the primary storage is IndexedDB.</p>
            </CollapsibleFaq>
            <CollapsibleFaq q="How do I change the auto-part threshold from 200 to 500?">
              <p>Go to <strong>Settings → Survey → Auto-Part Manager</strong>. Change the <strong>POI Threshold</strong> slider. Valid range: 100–1000. The setting is saved immediately and persists across sessions. Note: increasing the threshold means larger individual parts and bigger export files.</p>
            </CollapsibleFaq>
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            5. ROAD PROFILE & GNSS
        ═══════════════════════════════════════════════════════ */}
        <Section id="roadprofile">
          <SectionTitle icon={<TrendingUp className="w-6 h-6" />} title="Road Profile & GNSS Recording" color="text-purple-400" />
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">What Gets Recorded</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <Check color="purple"><strong className="text-white">Chainage</strong> — running distance along the route (m)</Check>
                <Check color="purple"><strong className="text-white">Altitude</strong> — GNSS ellipsoidal height with optional corrections</Check>
                <Check color="purple"><strong className="text-white">Grade %</strong> — rise/run between consecutive GNSS points</Check>
                <Check color="purple"><strong className="text-white">K-factor</strong> — rate of grade change (m per 1% grade change); used to detect crests and sags</Check>
                <Check color="purple"><strong className="text-white">Banking / cross-slope</strong> — from Duro IMU roll angle in degrees</Check>
                <Check color="purple"><strong className="text-white">Curve radius</strong> — calculated from 3 consecutive GPS points using circumradius formula</Check>
                <Check color="purple"><strong className="text-white">Speed</strong> — from GNSS Doppler</Check>
                <Check color="purple"><strong className="text-white">Alert segments</strong> — grade, banking, and curve events flagged with start/end chainage</Check>
              </ul>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">Banking / Cross-Slope Modes</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="bg-gray-900/40 rounded p-3">
                  <p className="text-white font-medium">Raw</p>
                  <p className="text-xs mt-1">Direct IMU roll reading. Fastest response but may include vibration noise from the road surface.</p>
                </div>
                <div className="bg-gray-900/40 rounded p-3">
                  <p className="text-white font-medium">Filtered (low-pass)</p>
                  <p className="text-xs mt-1">Rolling average applied to remove vibration. Recommended for normal operations.</p>
                </div>
                <div className="bg-gray-900/40 rounded p-3">
                  <p className="text-white font-medium">Stopped-only</p>
                  <p className="text-xs mt-1">Only records banking when speed is below 2 km/h. Most accurate for superelevation measurements at specific points.</p>
                </div>
                <p className="text-xs text-gray-400">Banking alert thresholds (configurable): 0–3° Normal · 3–5° Caution · 5–7° Warning · 7–10° Critical · &gt;10° Unacceptable</p>
              </div>
            </Card>
          </div>
          <Card>
            <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Data Persistence Architecture
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div className="bg-gray-900/30 rounded p-4">
                <p className="text-white font-medium mb-2">Background recording</p>
                <p className="text-xs">The ProfileRecordingBufferService is a singleton — it keeps recording even when the operator navigates to other pages within the app. GPS samples continue to accumulate in the background buffer.</p>
              </div>
              <div className="bg-gray-900/30 rounded p-4">
                <p className="text-white font-medium mb-2">30-second flush to IndexedDB</p>
                <p className="text-xs">Every 30 seconds the buffer writes GPS samples to IndexedDB. If the browser crashes or the device loses power, at most 30 seconds of data is lost.</p>
              </div>
              <div className="bg-gray-900/30 rounded p-4">
                <p className="text-white font-medium mb-2">Session recovery</p>
                <p className="text-xs">On next app open, session state is read from localStorage and samples restored from IndexedDB. Recording continues from where it left off with no manual steps.</p>
              </div>
            </div>
          </Card>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            6. DETECTION METHODS
        ═══════════════════════════════════════════════════════ */}
        <Section id="detection">
          <SectionTitle icon={<Eye className="w-6 h-6" />} title="Detection Methods Explained" color="text-cyan-400" />

          <div className="space-y-6">
            {/* Laser TOF */}
            <Card border="border-blue-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Ruler className="w-5 h-5 text-blue-400" />
                Laser Time-of-Flight (ToF) — Primary Height Measurement
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                <div>
                  <p className="mb-2"><strong className="text-white">How it works:</strong> The laser emits a pulse of infrared light. The sensor measures the time for the pulse to return from the target and calculates distance: <code className="bg-gray-700 px-1 rounded text-xs">distance = (speed of light × time) / 2</code>.</p>
                  <p>The RSA 3-byte binary protocol sends measurements as a 3-byte packet at up to 30 kHz. MeasurePRO reads the stream continuously and applies ground reference subtraction, unit conversion, and ignoreAbove/ignoreBelow filtering before displaying the reading.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Measurement pipeline</p>
                  <ol className="space-y-1 list-decimal list-inside text-xs">
                    <li>Raw 3-byte packet received from serial port</li>
                    <li>Decoded to millimetres by RSA protocol parser</li>
                    <li>Converted to metres (÷ 1000)</li>
                    <li>Ground reference subtracted</li>
                    <li>Filtered: values outside ignoreAbove / ignoreBelow discarded</li>
                    <li>Displayed in real time and logged on Space key press</li>
                  </ol>
                </div>
              </div>
            </Card>

            {/* AI Object Detection */}
            <Card border="border-purple-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                AI Object Detection — TensorFlow.js COCO-SSD (MeasurePRO+)
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                <div>
                  <p className="mb-2"><strong className="text-white">How it works:</strong> The COCO-SSD model (Single Shot Detector) runs entirely in the browser using TensorFlow.js — no server round-trip. Each video frame is passed through the neural network which returns bounding boxes, class labels, and confidence scores for detected objects.</p>
                  <p>The model recognises 80+ classes including: person, bicycle, car, truck, bus, train, traffic light, fire hydrant, stop sign, and common infrastructure objects.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Dual operating modes</p>
                  <div className="space-y-2">
                    <div className="bg-gray-900/40 rounded p-3">
                      <p className="text-white text-xs font-medium">Mock mode</p>
                      <p className="text-xs">Simulates detections without a camera. Used for training and demos. Fully offline.</p>
                    </div>
                    <div className="bg-gray-900/40 rounded p-3">
                      <p className="text-white text-xs font-medium">Production mode</p>
                      <p className="text-xs">Live camera feed. Detection events automatically log GPS coordinates, confidence score, and auto-capture a photo at the moment of detection.</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Configurable confidence threshold (default 60%). Lower = more detections, more false positives. Increase for cleaner logs.</p>
                </div>
              </div>
            </Card>

            {/* Envelope Clearance */}
            <Card border="border-blue-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                Envelope Clearance — ZED 2i Depth Camera (MeasurePRO+)
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                <div>
                  <p className="mb-2"><strong className="text-white">How it works:</strong> The ZED 2i stereo camera generates a real-time depth map by comparing the left and right camera images (stereo disparity). Obstacles in the field of view are located in 3D space relative to the vehicle. The app compares each obstacle position against the pre-configured vehicle load envelope.</p>
                  <p className="mt-2">If an obstacle falls within the envelope, a clearance violation is triggered. The system calculates the remaining clearance gap in centimetres and displays it colour-coded: green (safe) → amber (warning) → red (critical).</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Setup requirements</p>
                  <ul className="space-y-1 list-disc list-inside text-xs">
                    <li>ZED 2i camera mounted with clear forward view</li>
                    <li>ZED SDK companion server running on Windows laptop</li>
                    <li>Vehicle envelope profile configured (width × height × length)</li>
                    <li>25 configurable profiles available (one per vehicle)</li>
                    <li>Warning and critical thresholds set in cm</li>
                  </ul>
                  <Note color="amber">ZED 2i depth accuracy degrades beyond 20 m. Best performance within 0.5–15 m range. Outdoor sunlight can reduce depth map quality — see Environmental Limitations section.</Note>
                </div>
              </div>
            </Card>

            {/* GPS Route Deviation */}
            <Card border="border-green-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Route className="w-5 h-5 text-green-400" />
                GPS Route Deviation Detection — Permitted Route Enforcement (MeasurePRO+)
              </h3>
              <div className="text-sm text-gray-300">
                <p className="mb-3"><strong className="text-white">How it works:</strong> The operator uploads a GPX file of the approved permit route. MeasurePRO converts the route into a corridor by buffering the route line by a configurable distance (default 25 m either side). Every GPS position update is tested for containment within the corridor polygon.</p>
                <p>If the vehicle exits the corridor, a non-dismissable STOP alert appears on screen with an audible alarm. The event is logged with exact GPS coordinates and timestamp for the permit authority audit trail. The alert clears automatically when the vehicle re-enters the corridor.</p>
                <Note color="red">The corridor detection is GPS-accuracy dependent. With RTK-GNSS (Duro), detection is reliable to ±5 cm. With browser geolocation, expect ±5–15 m — tighten the buffer zone accordingly.</Note>
              </div>
            </Card>

            {/* Swept Path */}
            <Card border="border-orange-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Radio className="w-5 h-5 text-orange-400" />
                Swept Path Analysis — Turn Off-Tracking Simulation (MeasurePRO+)
              </h3>
              <div className="text-sm text-gray-300">
                <p className="mb-3"><strong className="text-white">How it works:</strong> Using the vehicle's GPS track and a configured vehicle profile (prime mover + trailer lengths, axle positions), the app calculates the swept path — the total road area the vehicle and trailer will occupy during a turn. A 90° circular arc is simulated for the turn. Off-tracking (how much the trailer cuts inside the turn compared to the prime mover) is calculated proportionally across all axle groups.</p>
                <p className="mb-3">The swept path is drawn as a canvas overlay on the map. Potential collision zones (where the swept path extends beyond the road boundary) are highlighted in red.</p>
                <Note color="amber">
                  <strong>MVP limitation:</strong> The current implementation uses simplified physics (proportional off-tracking distribution, 90° arc). It does not integrate with live road geometry or handle perpendicular approach edge cases perfectly. These limitations are documented and will be improved in a future release. Always verify critical turns on-site.
                </Note>
              </div>
            </Card>
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            7. ENVIRONMENTAL LIMITATIONS
        ═══════════════════════════════════════════════════════ */}
        <Section id="environment">
          <SectionTitle icon={<CloudRain className="w-6 h-6" />} title="Environmental Limitations" color="text-sky-400" />

          <div className="bg-sky-900/20 border border-sky-700/50 rounded-xl p-6 mb-6">
            <p className="text-gray-300 text-sm">
              The MeasurePRO laser, cameras, and GPS can all be affected by weather and environmental conditions. This section gives your customer service team the knowledge to diagnose complaints about erratic readings or poor performance in the field.
            </p>
          </div>

          <div className="space-y-4">

            {/* Rain */}
            <Card border="border-sky-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-sky-400" />
                Rain, Drizzle & Wet Surfaces
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                <div>
                  <p className="font-medium text-white mb-2">Effect on the laser</p>
                  <ul className="space-y-2 list-disc list-inside ml-2">
                    <li><strong>Light rain:</strong> Rain droplets in the laser beam path scatter the light. Some pulses return from the droplet instead of the target structure. This produces short-range "noise" readings that are lower than the actual clearance. The ignoreBelow filter helps reject most of these.</li>
                    <li><strong>Heavy rain:</strong> Dense rainfall can absorb enough laser energy to significantly reduce the signal. The app may display "No Reading" or very noisy values. Increasing ignoreBelow to 3–5 m can help.</li>
                    <li><strong>Wet road surface:</strong> High reflectivity of wet asphalt. The laser may return a strong ground reading even when aimed upward at a low angle. Re-set the ground reference on wet surfaces.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Effect on the camera / ZED</p>
                  <ul className="space-y-2 list-disc list-inside ml-2">
                    <li>Rain on the lens causes streaks and blur in photos. AI object detection and ZED depth accuracy both degrade.</li>
                    <li>A rain shield or lens cap (flip-open type) is recommended for field installations.</li>
                  </ul>
                  <p className="font-medium text-white mb-2 mt-3">Recommended actions</p>
                  <ul className="space-y-1 list-disc list-inside ml-2 text-xs">
                    <li>Increase ignoreBelow threshold during rain</li>
                    <li>Manually verify questionable readings</li>
                    <li>Add a "weather: rain" note in the survey notes field</li>
                    <li>Consider postponing if readings are consistently invalid</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Fog */}
            <Card border="border-gray-600/60">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-gray-400" />
                Fog, Mist & Smoke
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                <div>
                  <p className="font-medium text-white mb-2">Effect on the laser</p>
                  <p>Fog and thick mist scatter the laser beam similarly to rain but uniformly throughout the beam path. The laser may report a reading at the fog layer (typically 10–50 m) rather than the actual structure. This is one of the harder conditions to filter because the false readings can be plausible-looking distances.</p>
                  <p className="mt-2">Symptom: all readings cluster around the same short distance even as the vehicle approaches different structures.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Diagnostic steps for customer service</p>
                  <ol className="space-y-1 list-decimal list-inside text-xs">
                    <li>Ask: are all readings in the range 10–40 m regardless of what the laser is pointed at? → likely fog return.</li>
                    <li>Ask: is the reading stable or jumping? → stable at a short distance = fog; jumping = rain droplets.</li>
                    <li>If fog, recommend waiting for conditions to clear or manually entering known clearance values for critical structures.</li>
                  </ol>
                </div>
              </div>
            </Card>

            {/* Bright sun */}
            <Card border="border-yellow-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-400" />
                Bright Sunlight — "Blinding" the Laser
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                <div>
                  <p className="font-medium text-white mb-2">What happens</p>
                  <p className="mb-2">The laser receiver uses a photodiode detector. Intense ambient sunlight — particularly direct sun or sun reflecting off a shiny surface directly into the sensor aperture — can <strong className="text-white">saturate the detector</strong>. When saturated, the sensor cannot distinguish the returning laser pulse from the background solar radiation, causing:</p>
                  <ul className="space-y-1 list-disc list-inside ml-2">
                    <li>"No Reading" display</li>
                    <li>Random maximum-range readings (sensor reports nothing = max range)</li>
                    <li>Noisy, inconsistent readings</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">When it typically occurs</p>
                  <ul className="space-y-1 list-disc list-inside ml-2">
                    <li>Low sun angle (early morning or late afternoon) when sun is directly in the beam path</li>
                    <li>Driving toward the sun on an east/west road</li>
                    <li>Sun reflecting off a metallic structure or wet road directly into the sensor</li>
                    <li>White concrete surfaces with direct solar illumination</li>
                  </ul>
                  <p className="font-medium text-white mb-2 mt-3">Solutions</p>
                  <ul className="space-y-1 list-disc list-inside ml-2 text-xs">
                    <li>Tilt the laser slightly to avoid direct solar alignment</li>
                    <li>Use a physical sunshield or hood around the sensor aperture</li>
                    <li>Survey the same section at a different time of day</li>
                    <li>Note: some RSA lasers have an optical bandpass filter to reduce solar interference — check your sensor specification</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Dark surfaces */}
            <Card border="border-gray-700">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" />
                Dark & Low-Reflectivity Surfaces
              </h3>
              <div className="text-sm text-gray-300 grid md:grid-cols-2 gap-6">
                <div>
                  <p className="mb-2">Some surfaces absorb most of the laser energy rather than reflecting it back. Structures painted flat black, dark timber, carbon fibre, or heavily weathered concrete can return a very weak signal. The result is:</p>
                  <ul className="space-y-1 list-disc list-inside ml-2">
                    <li>Intermittent or missing readings</li>
                    <li>Readings that are slightly shorter than reality (early return from the leading edge)</li>
                    <li>Higher reading noise / standard deviation</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Retroreflective targets</p>
                  <p>Attaching a <strong className="text-white">retroreflective target sticker</strong> (the kind used for surveying prisms) to a dark surface dramatically improves signal return. If a customer consistently gets no reading from a specific structure, this is the recommended fix.</p>
                  <Note color="blue">Retroreflective tape (safety orange/silver survey tape) works well. Avoid standard painter's tape — it absorbs laser energy similarly to a dark surface.</Note>
                </div>
              </div>
            </Card>

            {/* Temperature */}
            <Card border="border-red-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-red-400" />
                Extreme Temperature Effects
              </h3>
              <div className="text-sm text-gray-300 grid md:grid-cols-2 gap-6">
                <div>
                  <p className="font-medium text-white mb-2">Cold (below −10°C)</p>
                  <ul className="space-y-1 list-disc list-inside ml-2">
                    <li>Laser takes longer to reach operating temperature — allow 5–10 minute warm-up</li>
                    <li>Battery life on Bluetooth GPS and tablet reduced significantly</li>
                    <li>Condensation can form on lenses as equipment warms up</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Heat (above 40°C direct sun)</p>
                  <ul className="space-y-1 list-disc list-inside ml-2">
                    <li>Tablet may thermal-throttle the processor, slowing the app</li>
                    <li>ZED camera depth accuracy decreases due to sensor noise</li>
                    <li>Serial USB cables can develop high-resistance connections — use quality shielded cables</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* GPS in challenging conditions */}
            <Card border="border-green-700/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-400" />
                GPS Accuracy in Challenging Environments
              </h3>
              <div className="text-sm text-gray-300 grid md:grid-cols-2 gap-6">
                <div>
                  <p className="font-medium text-white mb-2">Urban canyons (tall buildings)</p>
                  <p>Satellite signals reflected off building surfaces cause multipath errors — the GPS sees the signal arrive from multiple directions. Position accuracy degrades to 5–50 m. RTK-GNSS (Duro) mitigates this but cannot fully eliminate it in severe urban canyons.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Tree canopy & tunnels</p>
                  <p>Dense tree canopy absorbs GPS signals. In tunnels, GPS is completely unavailable. MeasurePRO continues recording with the last valid position (dead reckoning not implemented). A note is added to the survey log when GPS fix quality drops below acceptable thresholds.</p>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            8. KEYBOARD SHORTCUTS
        ═══════════════════════════════════════════════════════ */}
        <Section id="keyboard">
          <SectionTitle icon={<Keyboard className="w-6 h-6" />} title="Keyboard Shortcuts" color="text-yellow-400" />
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: 'Measurement', color: 'text-blue-400',
                  shortcuts: [
                    ['Space', 'Capture POI (vertical laser)'],
                    ['G', 'Set / update ground reference'],
                    ['[', 'Left lateral laser capture'],
                    [']', 'Right lateral laser capture'],
                    ['\\', 'Total lane width capture'],
                    ["'", 'Rear overhang capture'],
                    ['C', 'Take photo (current camera)'],
                    ['V', 'Start / stop video recording'],
                  ]
                },
                {
                  title: 'Navigation & App', color: 'text-green-400',
                  shortcuts: [
                    ['Ctrl+E', 'Open Export dialog'],
                    ['Ctrl+,', 'Open Settings'],
                    ['Ctrl+L', 'Lock application (requires PIN)'],
                    ['Ctrl+Z', 'Undo last POI capture'],
                    ['F1', 'Open Help / Documentation'],
                    ['F11', 'Toggle fullscreen'],
                    ['Esc', 'Close modal or dialog'],
                    ['P', 'Pause / resume GPS logging'],
                  ]
                },
                {
                  title: 'Audio & Advanced', color: 'text-purple-400',
                  shortcuts: [
                    ['M', 'Activate voice command mode'],
                    ['N', 'Record voice note (offline)'],
                    ['R', 'Start / stop GNSS road profile'],
                    ['T', 'Insert timestamp note'],
                    ['Ctrl+Shift+D', 'Open GNSS Diagnostics'],
                    ['Ctrl+Shift+P', 'Open Point Cloud viewer'],
                    ['Ctrl+Shift+M', 'Multi-laser monitor panel'],
                    ['Ctrl+Shift+A', 'AI Detection panel'],
                  ]
                }
              ].map(group => (
                <div key={group.title}>
                  <h4 className={`font-semibold mb-4 text-sm uppercase tracking-wide ${group.color}`}>{group.title}</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    {group.shortcuts.map(([key, label]) => (
                      <li key={key} className="flex justify-between items-center gap-2">
                        <span className="text-gray-300">{label}</span>
                        <Kbd k={key} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            9. VOICE COMMANDS
        ═══════════════════════════════════════════════════════ */}
        <Section id="voice">
          <SectionTitle icon={<Mic className="w-6 h-6" />} title="Voice Commands" color="text-green-400" />
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">How to Use</h3>
              <p className="text-sm text-gray-300 mb-3">
                Press <Kbd k="M" /> or say "Hey MeasurePRO" (if wake word is enabled in Settings). The microphone icon lights up. Speak your command clearly. The app confirms with a sound and on-screen feedback.
              </p>
              <p className="text-sm text-gray-300 mb-3">49+ commands supported in English, French, and Spanish.</p>
              <Note color="amber">
                <strong>Internet required:</strong> Voice command recognition uses the browser's Web Speech API which requires an active internet connection. Voice <em>notes</em> (key N) are recorded as audio files locally and work fully offline.
              </Note>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-white mb-3">Example Commands</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                {[
                  '"Capture measurement"',
                  '"Set ground reference"',
                  '"What is the current clearance?"',
                  '"What is my GPS location?"',
                  '"Take photo"',
                  '"Start recording"',
                  '"Stop recording"',
                  '"Export survey"',
                  '"Add note: check wire height"',
                  '"Mark bridge"',
                  '"Mark danger"',
                  '"Mark power line"',
                  '"Undo last capture"',
                  '"Close survey"',
                ].map(cmd => (
                  <li key={cmd} className="flex items-center gap-2">
                    <Volume2 className="w-3 h-3 text-green-400 shrink-0" />
                    <span className="font-mono text-xs">{cmd}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            10. MEASUREPRO+ MODULES
        ═══════════════════════════════════════════════════════ */}
        <Section id="modules">
          <SectionTitle icon={<Brain className="w-6 h-6" />} title="MeasurePRO+ Premium Modules" color="text-purple-400" />
          <p className="text-gray-400 text-sm mb-6">All modules below require a MeasurePRO+ subscription. They activate automatically in the app when your licence is verified — no separate installation needed.</p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: <Brain className="w-5 h-5 text-purple-400" />, title: 'AI Object Detection', border: 'border-purple-800/50',
                desc: 'Real-time object detection using TensorFlow.js COCO-SSD running in-browser. Identifies 80+ classes. Each detection is logged with GPS, timestamp, confidence, and an auto-captured photo.',
                items: ['Mock mode (offline) and Production mode (live camera)', 'Configurable confidence threshold (default 60%)', 'Admin-only YOLO training data export from Settings → AI Training', 'Detection log exportable as JSON']
              },
              {
                icon: <Truck className="w-5 h-5 text-blue-400" />, title: 'Envelope Clearance', border: 'border-blue-800/50',
                desc: 'Real-time load profile monitoring using ZED 2i stereo camera. Compares live depth data against vehicle load envelope. Alerts on intrusion.',
                items: ['25 configurable vehicle envelope profiles', 'Green / amber / red colour-coded clearance display', 'Warning + critical thresholds in cm', 'Violation log: GPS + photo + clearance value', 'Requires ZED 2i camera + ZED SDK companion server']
              },
              {
                icon: <Navigation className="w-5 h-5 text-orange-400" />, title: 'Convoy Guardian', border: 'border-orange-800/50',
                desc: 'Multi-vehicle convoy coordination via WebSocket. All vehicles share live position, speed, clearance readings, and alerts in real time.',
                items: ['Lead, escort, and observer roles', 'QR code for instant escort join', 'Black box logging for every move', 'Works on 4G/LTE or local WiFi hotspot', 'All convoy events exportable for authority audit']
              },
              {
                icon: <Route className="w-5 h-5 text-green-400" />, title: 'Permitted Route Enforcement', border: 'border-green-800/50',
                desc: 'Load a GPX permitted route. The app continuously monitors GPS position against the approved corridor. Off-route triggers a non-dismissable STOP alert.',
                items: ['GPX file upload with corridor map overlay', 'Configurable corridor width (default ±25 m)', 'Off-route events logged with GPS + timestamp', 'Export for police / permit authority audit', 'Alert clears automatically on return to route']
              },
              {
                icon: <Radio className="w-5 h-5 text-cyan-400" />, title: 'Swept Path Analysis', border: 'border-cyan-800/50',
                desc: 'Turn simulation and off-tracking visualisation for multi-segment vehicles. Canvas overlay shows predicted swept path and collision zones.',
                items: ['Configure prime mover + trailer dimensions', 'Real-time road boundary detection from map data', 'Swept path drawn as canvas overlay', 'Collision zone highlighted in red', 'Vehicle profile library (save multiple configs)', 'Note: MVP uses simplified physics (90° arc, proportional off-tracking)']
              },
              {
                icon: <Globe className="w-5 h-5 text-indigo-400" />, title: '3D Point Cloud Scanning', border: 'border-indigo-800/50',
                desc: 'High-resolution infrastructure scanning with Hesai Pandar40P LiDAR via the Windows MeasurePRO LiDAR Service. Real-time 3D visualisation in Three.js.',
                items: ['Requires Windows MeasurePRO LiDAR Service (C# .NET 8)', 'WebSocket streaming at 10 Hz', 'Export to LAZ / LAS (CloudCompare, Autodesk Civil 3D)', 'GPS georeferencing of every scan', 'POI linking for scan traceability', 'Mock mode available for testing without hardware']
              },
            ].map(m => (
              <Card key={m.title} border={m.border}>
                <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  {m.icon}
                  {m.title}
                </h3>
                <p className="text-sm text-gray-300 mb-3">{m.desc}</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  {m.items.map(item => (
                    <li key={item} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            11. EXPORT FORMATS
        ═══════════════════════════════════════════════════════ */}
        <Section id="export">
          <SectionTitle icon={<Download className="w-6 h-6" />} title="Data Export Formats" color="text-blue-400" />

          <div className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4">Survey Export Pipeline</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { format: 'CSV', color: 'green', desc: 'One row per POI. All fields. Compatible with Excel and Google Sheets. Best for permit applications and spreadsheet analysis.' },
                { format: 'JSON', color: 'blue', desc: 'Full nested structure with survey metadata, POIs, measurements, and timestamps. Best for system integration.' },
                { format: 'GeoJSON', color: 'yellow', desc: 'GIS-ready. Import directly into QGIS, ArcGIS, Mapbox, or Google Maps. Each POI is a GeoJSON Feature.' },
                { format: 'KML', color: 'red', desc: 'Included inside the survey ZIP: GPS trace + POI locations. Viewable in Google Earth.' },
                { format: 'ZIP Bundle', color: 'gray', desc: 'Complete package: all above formats + all photos/videos + metadata.json. Re-importable back into MeasurePRO.' },
              ].map(({ format, color, desc }) => (
                <div key={format} className={`bg-gray-800 border border-${color}-700/40 rounded-lg p-4`}>
                  <div className={`text-${color}-400 font-bold text-lg mb-2`}>{format}</div>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
            <Note color="blue">KML is only generated inside the survey ZIP bundle. It is not available as a standalone export format. YOLO format is admin-only (Settings → AI Training) and is not part of the standard survey export.</Note>
          </div>

          <div className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4">Road Profile Engineering Export Pipeline</h3>
            <p className="text-sm text-gray-400 mb-4">Accessed via the Road Profile page → Export button. Uses a separate export dialog (SurveyExportDialog) from the survey export.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { format: 'CSV', color: 'green', desc: 'Chainage, grade, K-factor, banking, curve radius per GPS sample.' },
                { format: 'GeoJSON', color: 'yellow', desc: 'GPS samples as features with all engineering attributes.' },
                { format: 'Shapefile', color: 'purple', desc: 'SHP + SHX + DBF + PRJ bundle. Native ArcGIS / QGIS format.' },
                { format: 'DXF', color: 'orange', desc: 'AutoCAD direct import. Road centreline as polyline, POIs as blocks.' },
                { format: 'LandXML', color: 'cyan', desc: 'Civil 3D and OpenRoads. Includes alignments, profile, COGO points.' },
              ].map(({ format, color, desc }) => (
                <div key={format} className={`bg-gray-800 border border-${color}-700/40 rounded-lg p-4`}>
                  <div className={`text-${color}-400 font-bold text-lg mb-2`}>{format}</div>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <Card>
            <h3 className="text-base font-semibold text-white mb-3">Coordinate Reference Systems (CRS)</h3>
            <div className="text-sm text-gray-300 grid md:grid-cols-2 gap-4">
              <ul className="space-y-2 list-disc list-inside ml-2">
                <li>WGS84 (EPSG:4326) — default for GeoJSON and KML</li>
                <li>Web Mercator (EPSG:3857) — for web mapping</li>
                <li>Australian MGA zones (EPSG:28348–28358) — for engineering work</li>
                <li>Custom EPSG code support for other regions</li>
              </ul>
              <ul className="space-y-2 list-disc list-inside ml-2">
                <li>Altitude modes: raw GNSS ellipsoidal, selected correction, all modes</li>
                <li>Resampling: full-density GPS samples or fixed chainage interval</li>
                <li>ZIP bundle exports include metadata.json with calibration provenance</li>
                <li>All ZIP exports are re-importable into MeasurePRO (round-trip capable)</li>
              </ul>
            </div>
          </Card>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            12. OFFLINE & DATA SAFETY
        ═══════════════════════════════════════════════════════ */}
        <Section id="offline">
          <SectionTitle icon={<Shield className="w-6 h-6" />} title="Offline & Data Safety" color="text-green-400" />
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-green-400" />
                Offline-First Design
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <Check color="green">Full survey capture works with no internet connection</Check>
                <Check color="green">All POI data, photos, and road profile samples stored in IndexedDB (local browser database)</Check>
                <Check color="green">Firebase authentication cached — sign-in persists offline after first login</Check>
                <Check color="green">Maps: pre-cached tiles available offline via Leaflet tile cache</Check>
                <Check color="green">Service Worker (Workbox) caches the entire app for offline loading</Check>
                <Check color="amber">Voice commands and cloud sync require internet</Check>
              </ul>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                Data Storage Layers
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="bg-gray-900/40 rounded p-3">
                  <p className="text-white font-medium text-xs">Primary: IndexedDB</p>
                  <p className="text-xs mt-1">All POI measurements, survey records, road profile samples, and training frames stored locally. Survives browser restarts. Maximum size: typically 500 MB – 2 GB depending on device storage.</p>
                </div>
                <div className="bg-gray-900/40 rounded p-3">
                  <p className="text-white font-medium text-xs">Backup: Firebase Storage & Firestore</p>
                  <p className="text-xs mt-1">Auto-sync when online. Survey ZIP packages uploaded to Firebase Storage. Firestore holds survey metadata for multi-device access.</p>
                </div>
                <div className="bg-gray-900/40 rounded p-3">
                  <p className="text-white font-medium text-xs">ACK-based Storage Health Monitor</p>
                  <p className="text-xs mt-1">Monitors IndexedDB write health. If pending writes or stale data are detected, a critical warning appears. Prevents silent data loss. Check Settings → Storage Health for status.</p>
                </div>
              </div>
            </Card>
          </div>
          <Card>
            <h3 className="text-base font-semibold text-white mb-3">Data Loss Prevention — What to Tell Customers</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div>
                <p className="text-white font-medium mb-2">Browser was closed mid-survey</p>
                <p className="text-xs">Data is safe. Reopen Chrome/Edge and navigate back to the survey app. The survey resumes from the last saved state. Road profile recording also resumes from IndexedDB. At most 30 seconds of road profile data may be lost.</p>
              </div>
              <div>
                <p className="text-white font-medium mb-2">Tablet ran out of battery</p>
                <p className="text-xs">Same as above — IndexedDB persists through power cycles. All POIs are safe. Road profile data is safe to the last 30-second flush. Note: Windows may run browser cache cleanup on startup; advise customers to disable aggressive storage clearing in Chrome settings.</p>
              </div>
              <div>
                <p className="text-white font-medium mb-2">Survey not appearing after reinstall</p>
                <p className="text-xs">Reinstalling the browser or clearing all site data in Chrome will erase the local IndexedDB. Always export a ZIP bundle before clearing browser data. If cloud sync was enabled, the survey data can be re-downloaded from Firebase after signing in.</p>
              </div>
            </div>
          </Card>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            13. TROUBLESHOOTING FAQ
        ═══════════════════════════════════════════════════════ */}
        <Section id="troubleshoot">
          <SectionTitle icon={<HelpCircle className="w-6 h-6" />} title="Troubleshooting FAQ" color="text-amber-400" />
          <p className="text-gray-400 text-sm mb-6">Common questions from field operators and customers — with diagnostic steps and solutions.</p>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-6 mb-3">Laser & Measurement</h3>
            <CollapsibleFaq q="The laser shows 'No Reading' or dashes.">
              <ol className="list-decimal list-inside space-y-1">
                <li>Check the laser is powered (12V supply active, power LED on).</li>
                <li>Check the USB-to-serial cable is seated correctly on both ends.</li>
                <li>Open Settings → Hardware → Laser and confirm the correct COM port is selected.</li>
                <li>Verify the protocol (RSA vs Jenoptik). Wrong protocol = no data parsed.</li>
                <li>Try clicking Disconnect then Reconnect in the laser settings panel.</li>
                <li>Check for bright sunlight directly into the sensor aperture — see Environmental Limitations.</li>
                <li>If using a USB hub, try a direct USB connection to rule out hub issues.</li>
              </ol>
            </CollapsibleFaq>
            <CollapsibleFaq q="The laser reading is jumping around or showing random values.">
              <ol className="list-decimal list-inside space-y-1">
                <li>Rain or fog in the beam path — see Environmental Limitations. Increase ignoreBelow threshold.</li>
                <li>Target surface is dark or non-reflective — try a retroreflective sticker.</li>
                <li>Beam is hitting the edge of a structure at an oblique angle — partial return causes noise.</li>
                <li>Cable issue: loose connector or damaged serial cable. Try replacing the cable.</li>
                <li>Electrical interference from the vehicle: ensure the serial cable is not routed near ignition wiring.</li>
              </ol>
            </CollapsibleFaq>
            <CollapsibleFaq q="The clearance reading seems wrong — it's too high or too low.">
              <ol className="list-decimal list-inside space-y-1">
                <li>Ground reference not set correctly. Press G to re-set with the laser pointing at the road surface.</li>
                <li>Check ignoreAbove and ignoreBelow thresholds in Settings — an incorrect threshold can filter the real reading and display nothing, causing the app to show a stale old value.</li>
                <li>Unit mismatch: confirm the display unit (m vs mm) matches the expected value.</li>
                <li>The laser is measuring a different object (e.g., a tree branch rather than the bridge deck). Aim the laser more precisely.</li>
              </ol>
            </CollapsibleFaq>

            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-6 mb-3">GPS & GNSS</h3>
            <CollapsibleFaq q="GPS position is not appearing or is stuck at 0,0.">
              <ol className="list-decimal list-inside space-y-1">
                <li>Check GPS is connected and COM port is selected in Settings → GPS.</li>
                <li>Wait up to 60 seconds for cold-start satellite acquisition.</li>
                <li>Ensure the vehicle is in an open-sky area — trees, buildings, and tunnels block signals.</li>
                <li>For Duro: check the antenna cable is connected and the antenna has a clear sky view.</li>
                <li>For USB GPS: check the COM port in Windows Device Manager. If the port is "Code 10 (device cannot start)", try a different USB port or reinstall the USB serial driver.</li>
              </ol>
            </CollapsibleFaq>
            <CollapsibleFaq q="GPS is showing but accuracy is very poor (position jumping 10–50 m).">
              <ol className="list-decimal list-inside space-y-1">
                <li>Check the fix type in the GPS status panel: Single Point or SBAS = normal GPS accuracy (3–10 m). RTK Float = partial corrections (0.5–2 m). RTK Fixed = centimetre level.</li>
                <li>For Duro: confirm NTRIP corrections are being received. Check Duro diagnostic panel for correction age — if older than 30 seconds, corrections are stale.</li>
                <li>In urban canyons: multipath errors are expected. This cannot be fully corrected by software.</li>
              </ol>
            </CollapsibleFaq>
            <CollapsibleFaq q="Duro is connected but the app is still showing USB GPS data.">
              <p>Duro takes priority only when it is actively sending data. If Duro is connected but not receiving corrections or has no satellite fix, it may not be sending NMEA data. Check the Duro LED indicators and the GNSS diagnostics panel. Once Duro sends its first valid fix, the app will automatically switch to it.</p>
            </CollapsibleFaq>

            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-6 mb-3">Survey & Data</h3>
            <CollapsibleFaq q="The survey shows 0 POIs after reopening the app.">
              <ol className="list-decimal list-inside space-y-1">
                <li>Open Survey Manager. The survey should be listed with all its parts.</li>
                <li>If the survey appears but shows 0 POIs, check the Storage Health panel (Settings → Storage Health) for any IndexedDB errors.</li>
                <li>If Chrome was updated and cleared its storage, data may be lost if no ZIP export was made. This is why we recommend exporting frequently and enabling Auto-Part.</li>
                <li>If cloud sync was enabled, sign out and back in — the cloud sync may restore the survey list.</li>
              </ol>
            </CollapsibleFaq>
            <CollapsibleFaq q="The export button is greyed out or the export fails.">
              <ol className="list-decimal list-inside space-y-1">
                <li>Ensure there is an active survey selected in Survey Manager.</li>
                <li>Check storage health — a stale IndexedDB can cause export failures.</li>
                <li>For very large surveys (1000+ POIs with photos), the export may take 30–60 seconds. Wait for the progress bar to complete.</li>
                <li>If the browser shows "not enough storage", free up disk space on the device.</li>
              </ol>
            </CollapsibleFaq>
            <CollapsibleFaq q="How do I merge all parts of a multi-part survey into one export?">
              <p>In Survey Manager, select the root survey (Part 1). All subsequent parts are linked by rootSurveyId. The export dialog offers an option to "Export all parts" which merges all POIs from all parts into a single CSV/GeoJSON/ZIP. Individual parts can also be exported separately.</p>
            </CollapsibleFaq>

            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-6 mb-3">Hardware & Connectivity</h3>
            <CollapsibleFaq q="The app is installed as a PWA but won't open without internet.">
              <ol className="list-decimal list-inside space-y-1">
                <li>The PWA requires an initial online install to cache the service worker. After that, it works offline.</li>
                <li>If the service worker was not registered (check Chrome DevTools → Application → Service Workers), navigate to the app online and refresh twice to force service worker registration.</li>
                <li>Some corporate IT policies block service workers. Ask the IT team to whitelist measure-pro.app.</li>
              </ol>
            </CollapsibleFaq>
            <CollapsibleFaq q="Serial port not showing up in the port selection list.">
              <ol className="list-decimal list-inside space-y-1">
                <li>Chrome or Edge must be running (Web Serial API not supported in Firefox or Safari).</li>
                <li>The site must be served over HTTPS (measure-pro.app uses HTTPS — this should not be an issue).</li>
                <li>Click "Request Port" and Windows will show a system dialog listing available COM ports. If the laser's port doesn't appear, check Device Manager.</li>
                <li>Install the USB serial driver for your cable (CH340, CP2102, or FTDI depending on the cable chipset).</li>
              </ol>
            </CollapsibleFaq>
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════════
            14. SUPPORT & CONTACT
        ═══════════════════════════════════════════════════════ */}
        <Section id="support">
          <SectionTitle icon={<Mail className="w-6 h-6" />} title="Support & Contact" color="text-blue-400" />
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center">
              <Mail className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Customer Support</h3>
              <p className="text-sm text-gray-400 mb-3">Technical questions, hardware issues, survey problems</p>
              <a href="mailto:support@soltec.ca" className="text-blue-400 hover:text-blue-300 text-sm underline" data-testid="link-support-email">support@soltec.ca</a>
            </Card>
            <Card className="text-center">
              <Globe className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Contact Form</h3>
              <p className="text-sm text-gray-400 mb-3">General enquiries, demos, and licensing</p>
              <Link to="/contact" className="text-green-400 hover:text-green-300 text-sm underline" data-testid="link-contact-page">measure-pro.app/contact</Link>
            </Card>
            <Card className="text-center">
              <HelpCircle className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Help Center</h3>
              <p className="text-sm text-gray-400 mb-3">Frequently asked questions and quick answers</p>
              <Link to="/help" className="text-purple-400 hover:text-purple-300 text-sm underline" data-testid="link-help-center">measure-pro.app/help</Link>
            </Card>
          </div>
          <div className="mt-6 text-center text-gray-500 text-sm">
            <p>MeasurePRO is developed and maintained by <strong className="text-gray-400">SolTec Innovation</strong></p>
            <p className="mt-1">© {new Date().getFullYear()} SolTec Innovation. All rights reserved.</p>
          </div>
        </Section>

      </div>
    </div>
  );
}
