import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Printer, Book, ChevronDown, ChevronRight,
  Ruler, MapPin, Camera, Mic, Download, Radio, Truck,
  Navigation, Route, Brain, Keyboard, Shield, AlertTriangle,
  Zap, Globe, Layers, Mountain,
  FileText, Database, Activity, Info,
  Wrench,
  CheckCircle, Monitor, Smartphone, Mail, Phone
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
  .manual-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; width: 100% !important; }
  .manual-section { margin-bottom: 10pt !important; }
  .manual-card { border: 1px solid #d1d5db !important; background: white !important; border-radius: 0 !important; padding: 8pt !important; margin-bottom: 8pt !important; }
  h1 { font-size: 20pt !important; break-after: avoid; page-break-after: avoid; }
  h2 { font-size: 16pt !important; break-after: avoid; page-break-after: avoid; margin-top: 12pt !important; }
  h3 { font-size: 12pt !important; break-after: avoid; page-break-after: avoid; }
  h4 { font-size: 10pt !important; break-after: avoid; page-break-after: avoid; }
  p, li, td, th { orphans: 2; widows: 2; }
  .toc-container { break-after: always; page-break-after: always; }
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
  .bg-gray-900, .bg-gray-800, .bg-gray-950, .bg-gray-900\\/50 { background: white !important; }
  div[class*="bg-gray-9"], div[class*="bg-gray-8"] { background: white !important; }
  div[class*="bg-blue-9"], div[class*="bg-amber-9"], div[class*="bg-red-9"], div[class*="bg-green-9"] { background: #f9fafb !important; }
  div[class*="border-gray-7"], div[class*="border-gray-8"] { border-color: #d1d5db !important; }
  div[class*="border-blue-"], div[class*="border-green-"], div[class*="border-amber-"], div[class*="border-red-"] { border-color: #d1d5db !important; }
  .text-blue-400, .text-blue-300, .text-blue-500 { color: #1d4ed8 !important; }
  .text-green-400, .text-green-300, .text-green-500 { color: #15803d !important; }
  .text-amber-400, .text-amber-300, .text-amber-500 { color: #92400e !important; }
  .text-red-400, .text-red-300, .text-red-500 { color: #b91c1c !important; }
  .text-gray-400, .text-gray-300, .text-gray-500 { color: #4b5563 !important; }
  .text-cyan-300, .text-cyan-400 { color: #0e7490 !important; }
  .text-purple-300, .text-purple-400 { color: #6d28d9 !important; }
  .print-page-header { display: block !important; text-align: center; font-size: 8pt; color: #9ca3af; border-bottom: 0.5pt solid #d1d5db; padding-bottom: 4pt; margin-bottom: 10pt; }
  .cover-page { break-after: always; page-break-after: always; min-height: 6in; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 2in !important; }
  kbd { border: 1px solid #374151 !important; background: #f3f4f6 !important; color: #111 !important; font-size: 8pt !important; padding: 1pt 3pt !important; }
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
}
`;

const SECTIONS = [
  { id: 'part1', title: 'Part 1: Introduction', icon: Book },
  { id: 'part2', title: 'Part 2: Getting Started', icon: Zap },
  { id: 'part3', title: 'Part 3: Account Creation', icon: Shield },
  { id: 'part4', title: 'Part 4: Login & Authentication', icon: Globe },
  { id: 'part5', title: 'Part 5: Hardware Setup — Laser', icon: Ruler },
  { id: 'part6', title: 'Part 6: Hardware Setup — GPS', icon: MapPin },
  { id: 'part7', title: 'Part 7: Hardware Setup — Camera', icon: Camera },
  { id: 'part8', title: 'Part 8: Survey Management', icon: Database },
  { id: 'part9', title: 'Part 9: Measurement & Logging', icon: Activity },
  { id: 'part10', title: 'Part 10: Points of Interest (POI)', icon: Info },
  { id: 'part11', title: 'Part 11: Alerts & Thresholds', icon: AlertTriangle },
  { id: 'part12', title: 'Part 12: Data Export', icon: Download },
  { id: 'part13', title: 'Part 13: Voice Commands', icon: Mic },
  { id: 'part14', title: 'Part 14: AI Object Detection', icon: Brain },
  { id: 'part15', title: 'Part 15: Envelope Clearance', icon: Layers },
  { id: 'part16', title: 'Part 16: Convoy Guardian', icon: Truck },
  { id: 'part17', title: 'Part 17: Route Enforcement', icon: Route },
  { id: 'part18', title: 'Part 18: GNSS Profiling & 3D LiDAR', icon: Navigation },
  { id: 'part19', title: 'Part 19: Slave App & Live Monitor', icon: Monitor },
  { id: 'part20', title: 'Part 20: Administration', icon: Shield },
  { id: 'appendixA', title: 'Appendix A: Keyboard Shortcuts', icon: Keyboard },
  { id: 'appendixB', title: 'Appendix B: POI Types Reference', icon: Mountain },
  { id: 'appendixC', title: 'Appendix C: Export Formats', icon: FileText },
  { id: 'appendixD', title: 'Appendix D: Troubleshooting', icon: Wrench },
  { id: 'appendixE', title: 'Appendix E: Glossary', icon: FileText },
];

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-4" data-testid={`screenshot-${alt.replace(/\s+/g, '-').toLowerCase()}`}>
      <img
        src={src}
        alt={alt}
        className="screenshot-img rounded-lg border border-gray-700 w-full max-w-2xl mx-auto block"
        loading="lazy"
      />
      {caption && <figcaption className="text-center text-gray-400 text-sm mt-2 italic">{caption}</figcaption>}
    </figure>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`manual-card bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6 ${className}`}>
      {children}
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 my-4">
      <p className="text-blue-300 text-sm flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{children}</span>
      </p>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 my-4">
      <p className="text-amber-300 text-sm flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{children}</span>
      </p>
    </div>
  );
}

function ShortcutTable({ rows }: { rows: { shortcut: string; action: string; description: string }[] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm" data-testid="shortcut-table">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-300 font-medium">Shortcut</th>
            <th className="text-left py-2 px-3 text-gray-300 font-medium">Action</th>
            <th className="text-left py-2 px-3 text-gray-300 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-700/50">
              <td className="py-2 px-3"><code className="bg-gray-700 px-2 py-0.5 rounded text-blue-300 text-xs">{r.shortcut}</code></td>
              <td className="py-2 px-3 text-white">{r.action}</td>
              <td className="py-2 px-3 text-gray-400">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UserManualPage() {
  const [tocOpen, setTocOpen] = useState(true);

  useEffect(() => {
    document.title = 'MeasurePRO User Manual | SolTec Innovation';
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white print-root">
      <style>{PRINT_STYLES}</style>

      <div className="print-page-header print-only hidden" aria-hidden="true">
        MeasurePRO User Manual — SolTec Innovation — www.SolTecInnovation.com
      </div>

      <div className="no-print sticky top-0 z-50 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-blue-400 hover:text-blue-300" data-testid="link-back-home">
          <ArrowLeft className="w-4 h-4" />
          Back to App
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
          data-testid="button-print"
        >
          <Printer className="w-4 h-4" />
          Print Manual
        </button>
      </div>

      <div className="manual-container max-w-5xl mx-auto px-4 py-8">

        <header className="text-center mb-12 cover-page" data-testid="manual-header">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="MeasurePRO Logo" className="h-16" />
          </div>
          <h1 className="text-4xl font-bold mb-2" data-testid="text-manual-title">MeasurePRO User Manual</h1>
          <p className="text-xl text-gray-400 mb-1">Complete Reference Guide</p>
          <p className="text-gray-500 text-sm">Version 2.0 — {new Date().getFullYear()}</p>
          <div className="mt-4 text-gray-400 text-sm space-y-1" data-testid="text-branding">
            <p className="font-semibold text-white">SolTec Innovation</p>
            <p><Globe className="w-3 h-3 inline mr-1" />www.SolTecInnovation.com</p>
            <p><Phone className="w-3 h-3 inline mr-1" />1.438.533.5344</p>
            <p><Mail className="w-3 h-3 inline mr-1" />support@soltec.ca</p>
          </div>
        </header>

        <nav className="toc-container mb-12" data-testid="table-of-contents">
          <SectionCard>
            <button
              className="w-full flex items-center justify-between text-left"
              onClick={() => setTocOpen(!tocOpen)}
              data-testid="button-toggle-toc"
            >
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Book className="w-6 h-6 text-blue-400" />
                Table of Contents
              </h2>
              {tocOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>
            {tocOpen && (
              <ol className="mt-4 space-y-2">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 py-1"
                      data-testid={`toc-link-${s.id}`}
                    >
                      <s.icon className="w-4 h-4" />
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </nav>

        {/* PART 1: Introduction */}
        <section id="part1" className="manual-section mb-12" data-testid="section-part1">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Book className="w-8 h-8 text-blue-400" />
            Part 1: Introduction
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">What is MeasurePRO?</h3>
            <p className="text-gray-300 mb-4">
              MeasurePRO is a professional-grade desktop application designed for overhead clearance measurement, route surveying, and infrastructure inspection. Built for the oversize/overweight (OS/OW) transport industry, it combines laser distance measurement, GPS tracking, camera documentation, AI-powered object detection, and advanced analytics into a single field-ready platform.
            </p>
            <p className="text-gray-300 mb-4">
              The application works offline-first, storing all data locally in IndexedDB and syncing to the cloud when connectivity is available. It supports multiple hardware configurations including laser distance meters, GNSS receivers, LiDAR scanners, and stereo cameras.
            </p>
            <h3 className="text-xl font-semibold mb-4 mt-6">Key Features</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-300">
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />Real-time laser distance measurement (30 Hz)</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />GPS/GNSS position tracking</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />29+ Point of Interest (POI) types</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />AI object detection (MeasurePRO+)</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />Voice commands in 3 languages</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />Envelope clearance monitoring</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />Multi-vehicle convoy management</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />Export to CSV, GeoJSON, KML, JSON</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />Offline-first PWA architecture</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />3D LiDAR & Point Cloud scanning</li>
            </ul>
            <Screenshot src="./screenshots/home.jpg" alt="home" caption="MeasurePRO Home Page" />
          </SectionCard>
        </section>

        {/* PART 2: Getting Started */}
        <section id="part2" className="manual-section mb-12" data-testid="section-part2">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Zap className="w-8 h-8 text-blue-400" />
            Part 2: Getting Started
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">System Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-blue-300 mb-2 flex items-center gap-2"><Monitor className="w-4 h-4" />Desktop</h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• MeasurePRO desktop app (Serial port support built-in)</li>
                  <li>• Windows 10/11, macOS 12+, or Linux</li>
                  <li>• USB port for laser/GPS connection</li>
                  <li>• Webcam for photo documentation</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-blue-300 mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4" />Mobile / Tablet</h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Android with Chrome 89+ (Web Serial via OTG)</li>
                  <li>• iOS Safari 16.4+ (limited serial support)</li>
                  <li>• GPS and camera access</li>
                  <li>• Stable internet for initial setup</li>
                </ul>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-4 mt-6">Hardware Requirements</h3>
            <ul className="text-gray-300 space-y-2 text-sm">
              <li className="flex items-start gap-2"><Ruler className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" /><strong>Laser Distance Meter</strong> — Dimetix FLS-C, Jenoptik LDS-30/70, or compatible serial-output laser</li>
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /><strong>GPS Receiver</strong> — Swift Navigation Duro, u-blox, or any NMEA-compatible serial GPS</li>
              <li className="flex items-start gap-2"><Camera className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" /><strong>Camera</strong> — Built-in webcam, USB camera, or ZED 2i stereo camera</li>
              <li className="flex items-start gap-2"><Radio className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" /><strong>LiDAR (Optional)</strong> — Hesai Pandar40P for 3D point cloud scanning</li>
            </ul>
            <h3 className="text-xl font-semibold mb-4 mt-6">Supported Hardware Reference</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-supported-hardware">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-300">Device</th>
                    <th className="text-left py-2 px-3 text-gray-300">Model</th>
                    <th className="text-left py-2 px-3 text-gray-300">Connection</th>
                    <th className="text-left py-2 px-3 text-gray-300">Protocol</th>
                    <th className="text-left py-2 px-3 text-gray-300">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">Laser</td><td className="py-2 px-3">Dimetix FLS-C</td><td className="py-2 px-3">USB Serial</td><td className="py-2 px-3">Dimetix ASCII</td><td className="py-2 px-3">30 Hz, ±1mm accuracy</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">Laser</td><td className="py-2 px-3">Jenoptik LDS-30</td><td className="py-2 px-3">USB Serial</td><td className="py-2 px-3">Custom ASCII</td><td className="py-2 px-3">30m range</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">Laser</td><td className="py-2 px-3">Jenoptik LDS-70A</td><td className="py-2 px-3">USB Serial</td><td className="py-2 px-3">Custom ASCII</td><td className="py-2 px-3">70m range, outdoor use</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">GPS</td><td className="py-2 px-3">Swift Navigation Duro</td><td className="py-2 px-3">USB Serial</td><td className="py-2 px-3">NMEA 0183</td><td className="py-2 px-3">RTK-capable, cm accuracy</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">GPS</td><td className="py-2 px-3">u-blox (various)</td><td className="py-2 px-3">USB Serial</td><td className="py-2 px-3">NMEA 0183</td><td className="py-2 px-3">Sub-meter accuracy</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">GPS</td><td className="py-2 px-3">Bluetooth GNSS</td><td className="py-2 px-3">Web Bluetooth</td><td className="py-2 px-3">NMEA 0183</td><td className="py-2 px-3">Wireless, mobile-friendly</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">Camera</td><td className="py-2 px-3">ZED 2i Stereo</td><td className="py-2 px-3">USB 3.0</td><td className="py-2 px-3">WebRTC</td><td className="py-2 px-3">Stereo depth, 3D mapping</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">Camera</td><td className="py-2 px-3">USB Webcam</td><td className="py-2 px-3">USB</td><td className="py-2 px-3">WebRTC</td><td className="py-2 px-3">720p–4K supported</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3 font-medium text-white">LiDAR</td><td className="py-2 px-3">Hesai Pandar40P</td><td className="py-2 px-3">Ethernet</td><td className="py-2 px-3">UDP packets</td><td className="py-2 px-3">40-channel, 360° scan</td></tr>
                </tbody>
              </table>
            </div>
            <Screenshot src="./screenshots/features.jpg" alt="features" caption="MeasurePRO Features Overview" />
          </SectionCard>
        </section>

        {/* PART 3: Account Creation */}
        <section id="part3" className="manual-section mb-12" data-testid="section-part3">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-400" />
            Part 3: Account Creation
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Creating Your Account</h3>
            <p className="text-gray-300 mb-4">MeasurePRO offers a multi-step registration process. No credit card is required for the Free tier.</p>
            <ol className="text-gray-300 space-y-3 list-decimal list-inside">
              <li>Navigate to the MeasurePRO website and click <strong>"Create Free Account"</strong></li>
              <li>Enter your email address and create a secure password (minimum 8 characters)</li>
              <li>Optionally enter company details (name, address, phone number)</li>
              <li>Select a subscription plan: <strong>Free</strong>, <strong>Basic</strong>, <strong>Plus</strong>, or <strong>Pro</strong></li>
              <li>Review and accept the Terms & Conditions and Privacy Policy</li>
              <li>Complete the hardware checklist acknowledgment</li>
              <li>Click <strong>"Create Account"</strong> — a verification email will be sent</li>
              <li>Verify your email by clicking the link in the verification email</li>
            </ol>
            <Screenshot src="./screenshots/register.jpg" alt="register" caption="Account Registration Form" />
            <Screenshot src="./screenshots/signup.jpg" alt="signup" caption="Sign Up Flow" />
            <TipBox>After email verification, your account enters a pending approval state. An administrator will review and approve your account.</TipBox>
            <Screenshot src="./screenshots/awaiting-approval.jpg" alt="awaiting-approval" caption="Awaiting Admin Approval Screen" />
          </SectionCard>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Subscription Plans</h3>
            <p className="text-gray-300 mb-4">Choose the plan that fits your needs. All plans include core measurement features.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-subscription-plans">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-300">Feature</th>
                    <th className="text-center py-2 px-3 text-gray-300">Free</th>
                    <th className="text-center py-2 px-3 text-gray-300">Basic</th>
                    <th className="text-center py-2 px-3 text-gray-300">Plus</th>
                    <th className="text-center py-2 px-3 text-gray-300">Pro</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3">Laser Measurement</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3">GPS Tracking</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3">Data Export</td><td className="text-center">CSV</td><td className="text-center">All</td><td className="text-center">All</td><td className="text-center">All</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3">AI Detection</td><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3">Voice Commands</td><td className="text-center">—</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3">Convoy Guardian</td><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">✓</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-2 px-3">3D LiDAR</td><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">✓</td></tr>
                </tbody>
              </table>
            </div>
            <Screenshot src="./screenshots/pricing.jpg" alt="pricing" caption="Pricing Plans" />
            <Screenshot src="./screenshots/subscription.jpg" alt="subscription" caption="Subscription Management" />
          </SectionCard>
        </section>

        {/* PART 4: Login & Authentication */}
        <section id="part4" className="manual-section mb-12" data-testid="section-part4">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Globe className="w-8 h-8 text-blue-400" />
            Part 4: Login & Authentication
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Logging In</h3>
            <p className="text-gray-300 mb-4">MeasurePRO uses password-based authentication with Firebase. Simply enter your password on the login screen to access the application.</p>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside">
              <li>Navigate to the MeasurePRO login page</li>
              <li>Enter your password in the password field</li>
              <li>Click <strong>"Enter Password →"</strong></li>
              <li>On mobile/tablet: Select between Master App, Slave App, or Live Monitor</li>
              <li>On desktop: The full interface loads automatically</li>
            </ol>
            <Screenshot src="./screenshots/login.jpg" alt="login" caption="Login Screen" />
            <TipBox>If you forget your password, use the "Forgot Password" link to receive a reset email.</TipBox>
            <Screenshot src="./screenshots/forgot-password.jpg" alt="forgot-password" caption="Password Recovery" />
          </SectionCard>
        </section>

        {/* PART 5: Hardware Setup — Laser */}
        <section id="part5" className="manual-section mb-12" data-testid="section-part5">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Ruler className="w-8 h-8 text-blue-400" />
            Part 5: Hardware Setup — Laser Distance Meter
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Connecting Your Laser</h3>
            <p className="text-gray-300 mb-4">MeasurePRO connects to laser distance meters via the Web Serial API. Supported models include Dimetix FLS-C, Jenoptik LDS-30, and LDS-70A.</p>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside">
              <li>Navigate to the Settings page</li>
              <li>Locate the <strong>"Laser Distance Meter"</strong> card</li>
              <li>Click <strong>"Connect Laser"</strong> — the browser serial port picker appears</li>
              <li>Select your laser meter from the list (e.g., "USB Serial Port")</li>
              <li>Click <strong>"Connect"</strong></li>
              <li>Configure the laser type: Standard Pole, High Pole, or Telescopic Pole</li>
              <li>Set the ground reference height (pole height above ground)</li>
            </ol>
            <WarningBox>Ensure your laser meter is in continuous measurement mode before connecting. USB connections are more reliable than Bluetooth.</WarningBox>
            <h3 className="text-xl font-semibold mb-4 mt-6">Laser Configuration</h3>
            <ul className="text-gray-300 space-y-2 text-sm">
              <li><strong>Ground Reference Height:</strong> The height of your measurement pole from the ground. This value is automatically subtracted from all readings to give true overhead clearance.</li>
              <li><strong>Measurement Rate:</strong> Most supported lasers operate at 30 Hz (30 readings per second).</li>
              <li><strong>Auto-Part Buffer:</strong> Automatically segments long surveys into manageable parts to prevent data loss.</li>
            </ul>
            <Screenshot src="./screenshots/app-main.jpg" alt="app-main" caption="Main Application Interface with Laser Connected" />
          </SectionCard>
        </section>

        {/* PART 6: Hardware Setup — GPS */}
        <section id="part6" className="manual-section mb-12" data-testid="section-part6">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <MapPin className="w-8 h-8 text-blue-400" />
            Part 6: Hardware Setup — GPS
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">GPS Connection Options</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-green-300 mb-2">Hardware GPS (Recommended)</h4>
                <p className="text-gray-300 text-sm mb-2">Connect a serial GNSS receiver (Swift Navigation Duro, u-blox) via USB for best accuracy.</p>
                <ol className="text-gray-300 space-y-1 list-decimal list-inside text-sm">
                  <li>Navigate to GPS Settings card</li>
                  <li>Click <strong>"Connect GPS"</strong></li>
                  <li>Select GPS device from the serial port picker</li>
                  <li>Wait 30–60 seconds for satellite fix</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-amber-300 mb-2">Device GPS Fallback</h4>
                <p className="text-gray-300 text-sm">If no hardware GPS is available, MeasurePRO automatically falls back to the browser's geolocation API. Accuracy is reduced but still functional for basic surveying.</p>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-4 mt-6">GPS Priority Hierarchy</h3>
            <p className="text-gray-300 text-sm mb-3">MeasurePRO automatically selects the best available GPS source in this priority order:</p>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside text-sm mb-4">
              <li><strong className="text-green-300">Swift Navigation Duro</strong> — Highest priority. RTK-capable GNSS with centimeter accuracy. Connects via serial.</li>
              <li><strong className="text-blue-300">USB GPS Receiver</strong> — Any NMEA-compatible serial GPS (u-blox, etc.). Sub-meter accuracy typical.</li>
              <li><strong className="text-amber-300">Bluetooth GPS</strong> — Wireless GNSS receivers paired via Web Bluetooth. Good mobility.</li>
              <li><strong className="text-gray-300">Browser Geolocation</strong> — Built-in device GPS/Wi-Fi positioning. Lowest accuracy (3–15 meters).</li>
            </ol>
            <TipBox>When multiple GPS sources are connected, MeasurePRO automatically uses the highest-priority source. If a higher-priority source disconnects, it seamlessly falls back to the next available source.</TipBox>
            <h3 className="text-xl font-semibold mb-4 mt-6">GPS Data Display</h3>
            <ul className="text-gray-300 space-y-1 text-sm">
              <li>• <strong>Coordinates:</strong> Latitude/Longitude in decimal degrees</li>
              <li>• <strong>Altitude:</strong> Height above sea level (meters)</li>
              <li>• <strong>Speed:</strong> Current velocity (km/h)</li>
              <li>• <strong>Satellites:</strong> Number of visible satellites (aim for 10+)</li>
              <li>• <strong>HDOP:</strong> Horizontal accuracy indicator (lower is better, target &lt; 2.0)</li>
              <li>• <strong>Fix Quality:</strong> No Fix, 2D Fix, 3D Fix, RTK Float, RTK Fixed</li>
            </ul>
            <Screenshot src="./screenshots/gnss-profiling.jpg" alt="gnss-profiling" caption="GNSS Profiling Interface" />
          </SectionCard>
        </section>

        {/* PART 7: Hardware Setup — Camera */}
        <section id="part7" className="manual-section mb-12" data-testid="section-part7">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Camera className="w-8 h-8 text-blue-400" />
            Part 7: Hardware Setup — Camera
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Camera Configuration</h3>
            <p className="text-gray-300 mb-4">MeasurePRO supports standard webcams and the ZED 2i stereo camera for photo documentation during surveys.</p>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside">
              <li>Navigate to Camera Settings</li>
              <li>Select camera type: <strong>Standard Camera</strong> or <strong>ZED 2i Stereo Camera</strong></li>
              <li>Choose resolution: 720p, 1080p, or 4K</li>
              <li>Set frame rate: 15, 30, or 60 FPS</li>
              <li>Grant camera permission when prompted by the browser</li>
            </ol>
            <h3 className="text-xl font-semibold mb-4 mt-6">Capturing Images</h3>
            <ul className="text-gray-300 space-y-1 text-sm">
              <li>• Press <code className="bg-gray-700 px-1 rounded text-blue-300 text-xs">Alt+1</code> or click the camera icon to capture</li>
              <li>• Images are saved with measurement metadata (height, GPS, timestamp)</li>
              <li>• Captured images appear in the "Captured Images" section</li>
              <li>• Click thumbnails to view full-size, or download to device</li>
            </ul>
            <TipBox>30 FPS at 1080p is recommended for most field conditions. Higher resolution improves quality but may reduce performance on older devices.</TipBox>
          </SectionCard>
        </section>

        {/* PART 8: Survey Management */}
        <section id="part8" className="manual-section mb-12" data-testid="section-part8">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-400" />
            Part 8: Survey Management
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Creating & Managing Surveys</h3>
            <p className="text-gray-300 mb-4">Surveys are the primary organizational unit in MeasurePRO. Each survey contains a collection of measurements, POIs, photos, and GPS tracks.</p>
            <h4 className="font-medium text-blue-300 mb-2">Creating a New Survey</h4>
            <ol className="text-gray-300 space-y-1 list-decimal list-inside text-sm">
              <li>Click <strong>"New Survey"</strong> from the main interface</li>
              <li>Enter a descriptive survey name (e.g., "Highway 401 Bridge Survey")</li>
              <li>Optionally add notes or route description</li>
              <li>The survey is automatically saved to IndexedDB</li>
            </ol>
            <h4 className="font-medium text-blue-300 mb-2 mt-4">Survey Data Storage</h4>
            <p className="text-gray-300 text-sm">All survey data is stored locally in IndexedDB for offline-first operation. When internet connectivity is available, data syncs to Firebase Firestore for cloud backup and cross-device access.</p>
            <h4 className="font-medium text-blue-300 mb-2 mt-4">Auto-Part System</h4>
            <p className="text-gray-300 text-sm">For long surveys, MeasurePRO automatically segments data into "parts" to prevent memory issues and ensure reliable data persistence. Each part contains up to a configurable number of measurements.</p>
          </SectionCard>
        </section>

        {/* PART 9: Measurement & Logging */}
        <section id="part9" className="manual-section mb-12" data-testid="section-part9">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            Part 9: Measurement & Logging
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Logging Modes</h3>
            <p className="text-gray-300 mb-4">MeasurePRO offers four logging modes to suit different survey scenarios:</p>
            <div className="space-y-4">
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-green-300 mb-1">Manual Mode</h4>
                <p className="text-gray-400 text-sm">You control when measurements are logged. Press <code className="bg-gray-700 px-1 rounded text-blue-300 text-xs">Alt+G</code> to log each measurement individually. Best for specific points of interest.</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-amber-300 mb-1">All Data Mode</h4>
                <p className="text-gray-400 text-sm">Continuously logs every measurement at 30 Hz. Creates comprehensive datasets for complete route surveys. Generates large data files.</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-purple-300 mb-1">Detection Mode (MeasurePRO+)</h4>
                <p className="text-gray-400 text-sm">AI automatically logs when it detects overhead objects (bridges, wires, trees). Requires MeasurePRO+ subscription.</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-cyan-300 mb-1">Manual + Detection Mode (MeasurePRO+)</h4>
                <p className="text-gray-400 text-sm">Combines manual control with AI detection. Both automatic detections and manual logs are recorded.</p>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-4 mt-6">Logging Controls</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+3', action: 'Start Logging', description: 'Begin logging session' },
              { shortcut: 'Alt+4', action: 'Stop Logging', description: 'End logging session' },
              { shortcut: 'Alt+5', action: 'Pause Logging', description: 'Pause current session' },
              { shortcut: 'Alt+G', action: 'Log Measurement', description: 'Log current measurement (Manual mode)' },
              { shortcut: 'Ctrl+Backspace', action: 'Delete Last Entry', description: 'Remove most recent log entry' },
              { shortcut: 'Alt+6', action: 'Start GPS Trace', description: 'Begin GPS tracking without laser' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">Multi-Laser Shortcuts</h3>
            <p className="text-gray-300 text-sm mb-3">When using multi-laser setups for wide load measurements, these shortcuts control individual laser readings:</p>
            <ShortcutTable rows={[
              { shortcut: '[', action: 'Left Laser', description: 'Read from left-side laser meter' },
              { shortcut: ']', action: 'Right Laser', description: 'Read from right-side laser meter' },
              { shortcut: '\\', action: 'Total Width', description: 'Calculate total width from both lasers' },
              { shortcut: "'", action: 'Rear Overhang', description: 'Measure rear overhang distance' },
            ]} />
            <TipBox>Multi-laser mode requires two connected laser meters. Configure each laser in Settings before using width measurements.</TipBox>
          </SectionCard>
        </section>

        {/* PART 10: Points of Interest */}
        <section id="part10" className="manual-section mb-12" data-testid="section-part10">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Info className="w-8 h-8 text-blue-400" />
            Part 10: Points of Interest (POI)
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">POI Types</h3>
            <p className="text-gray-300 mb-4">MeasurePRO supports 29+ POI types for categorizing measurements. Each POI type has a unique keyboard shortcut for rapid field switching.</p>
            <h4 className="font-medium text-blue-300 mb-2">Infrastructure & Overhead</h4>
            <ShortcutTable rows={[
              { shortcut: 'Alt+B', action: 'Bridge', description: 'Bridge overhead structure' },
              { shortcut: 'Alt+W', action: 'Wire', description: 'Overhead wire/cable' },
              { shortcut: 'Alt+P', action: 'High Voltage Power Line', description: 'High voltage electrical lines' },
              { shortcut: 'Alt+K', action: 'Overpass', description: 'Road or highway overpass' },
              { shortcut: 'Alt+Shift+B', action: 'Bridge & Wires', description: 'Combined bridge and wires' },
              { shortcut: 'Alt+Shift+O', action: 'Overhead Structure', description: 'General overhead structures' },
              { shortcut: 'Alt+Shift+F', action: 'Optical Fiber', description: 'Optical fiber cables' },
            ]} />
            <h4 className="font-medium text-blue-300 mb-2 mt-4">Traffic & Road</h4>
            <ShortcutTable rows={[
              { shortcut: 'Alt+L', action: 'Traffic Light', description: 'Traffic signal' },
              { shortcut: 'Alt+U', action: 'Signalization', description: 'Road signalization' },
              { shortcut: 'Alt+I', action: 'Intersection', description: 'Road intersection' },
              { shortcut: 'Alt+R', action: 'Road', description: 'General road feature' },
              { shortcut: 'Alt+E', action: 'Dead End', description: 'Road dead end/cul-de-sac' },
              { shortcut: 'Alt+Q', action: 'Railroad', description: 'Railroad crossing' },
            ]} />
            <h4 className="font-medium text-blue-300 mb-2 mt-4">Terrain & Environment</h4>
            <ShortcutTable rows={[
              { shortcut: 'Alt+T', action: 'Trees', description: 'Trees or vegetation' },
              { shortcut: 'Alt+Shift+U', action: 'Grade Up (12%+)', description: 'Steep uphill grade' },
              { shortcut: 'Alt+Shift+D', action: 'Grade Down (12%+)', description: 'Steep downhill grade' },
              { shortcut: 'Alt+C', action: 'Culvert', description: 'Drainage culvert' },
            ]} />
          </SectionCard>
        </section>

        {/* PART 11: Alerts & Thresholds */}
        <section id="part11" className="manual-section mb-12" data-testid="section-part11">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-blue-400" />
            Part 11: Alerts & Thresholds
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Configuring Alert Thresholds</h3>
            <p className="text-gray-300 mb-4">Set warning and critical alert thresholds to receive visual and audio notifications when overhead clearance approaches dangerous levels.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
                <h4 className="font-medium text-amber-300 mb-2">Warning Alert (Yellow)</h4>
                <p className="text-gray-300 text-sm">Screen turns yellow, warning sound plays. Indicates clearance is approaching minimum safe height.</p>
              </div>
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">Critical Alert (Red)</h4>
                <p className="text-gray-300 text-sm">Screen turns red, critical alarm sounds. Indicates insufficient clearance — stop immediately.</p>
              </div>
            </div>
            <h4 className="font-medium text-blue-300 mb-2">Alert Controls</h4>
            <ShortcutTable rows={[
              { shortcut: 'Alt+2', action: 'Clear Alert', description: 'Clear current alert' },
              { shortcut: 'Alt+Z', action: 'Clear All Alerts', description: 'Clear all active alerts' },
            ]} />
            <WarningBox>Critical threshold must always be set lower than warning threshold. Alerts are automatically logged in measurement data.</WarningBox>
          </SectionCard>
        </section>

        {/* PART 12: Data Export */}
        <section id="part12" className="manual-section mb-12" data-testid="section-part12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Download className="w-8 h-8 text-blue-400" />
            Part 12: Data Export
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Export Formats</h3>
            <p className="text-gray-300 mb-4">MeasurePRO supports multiple export formats to integrate with your existing workflows and GIS software.</p>
            <div className="space-y-4">
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-green-300 mb-1">CSV (Comma-Separated Values)</h4>
                <p className="text-gray-400 text-sm">Universal spreadsheet format. Opens in Excel, Google Sheets, and most analysis tools. Contains all measurement data in tabular format.</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-blue-300 mb-1">GeoJSON</h4>
                <p className="text-gray-400 text-sm">Geographic data format for GIS applications. Import into QGIS, ArcGIS, or Mapbox for spatial analysis and mapping.</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-amber-300 mb-1">KML (Keyhole Markup Language)</h4>
                <p className="text-gray-400 text-sm">Google Earth compatible format. Visualize survey routes in 3D with measurement data overlaid on satellite imagery.</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-purple-300 mb-1">JSON (Full Data Export)</h4>
                <p className="text-gray-400 text-sm">Complete raw data export with all metadata. Ideal for custom processing, API integration, and archival purposes.</p>
              </div>
            </div>
            <Screenshot src="./screenshots/export.jpg" alt="export" caption="Data Export Interface" />
          </SectionCard>
        </section>

        {/* PART 13: Voice Commands */}
        <section id="part13" className="manual-section mb-12" data-testid="section-part13">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Mic className="w-8 h-8 text-blue-400" />
            Part 13: Voice Commands
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Voice Assistant Setup</h3>
            <p className="text-gray-300 mb-4">MeasurePRO includes a voice assistant supporting 49+ commands in English, French, and Spanish. Perfect for hands-free operation while driving.</p>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside text-sm">
              <li>Navigate to Voice Command Settings</li>
              <li>Enable the "Voice Assistant" toggle</li>
              <li>Grant microphone permission when prompted</li>
              <li>Select your language: English (US), Français, or Español</li>
              <li>Adjust voice response volume</li>
              <li>Say <strong>"Help"</strong> to hear available commands</li>
            </ol>
            <h3 className="text-xl font-semibold mb-4 mt-6">Complete Voice Command Catalog (49+ Commands)</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-green-300 mb-2">Information Queries (8 commands)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-gray-300 text-sm">
                  <p>• "Last measurement" — reads last logged value</p>
                  <p>• "GPS location" — reads current coordinates</p>
                  <p>• "GPS status" — reports fix quality and satellites</p>
                  <p>• "Laser status" — reports connection and measurement</p>
                  <p>• "Speed" — reads current vehicle speed</p>
                  <p>• "Altitude" — reads current elevation</p>
                  <p>• "Survey status" — reads measurement count and duration</p>
                  <p>• "Help" — lists available voice commands</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-blue-300 mb-2">Actions (10 commands)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-gray-300 text-sm">
                  <p>• "Capture image" / "Take photo"</p>
                  <p>• "Log measurement" / "Log"</p>
                  <p>• "Clear alert" / "Clear warning"</p>
                  <p>• "Clear all alerts"</p>
                  <p>• "Start logging"</p>
                  <p>• "Stop logging"</p>
                  <p>• "Pause logging"</p>
                  <p>• "Start GPS trace"</p>
                  <p>• "Delete last" / "Undo"</p>
                  <p>• "New survey"</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-amber-300 mb-2">Logging Mode Switching (4 commands)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-gray-300 text-sm">
                  <p>• "Manual mode"</p>
                  <p>• "All data mode"</p>
                  <p>• "Detection mode"</p>
                  <p>• "Manual detection mode"</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-purple-300 mb-2">POI Type Selection (20+ commands)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1 text-gray-300 text-sm">
                  <p>• "Bridge"</p>
                  <p>• "Wire" / "Cable"</p>
                  <p>• "Power line"</p>
                  <p>• "Trees" / "Vegetation"</p>
                  <p>• "Traffic light"</p>
                  <p>• "Overpass"</p>
                  <p>• "Intersection"</p>
                  <p>• "Railroad"</p>
                  <p>• "Road"</p>
                  <p>• "Signalization"</p>
                  <p>• "Dead end"</p>
                  <p>• "Culvert"</p>
                  <p>• "Lateral obstruction"</p>
                  <p>• "Danger" / "Hazard"</p>
                  <p>• "Information"</p>
                  <p>• "Important note"</p>
                  <p>• "Work required"</p>
                  <p>• "Restricted access"</p>
                  <p>• "Parking"</p>
                  <p>• "Emergency parking"</p>
                  <p>• "Grade up" / "Grade down"</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300 mb-2">Advanced Controls (7 commands)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-gray-300 text-sm">
                  <p>• "Accept detection"</p>
                  <p>• "Reject detection"</p>
                  <p>• "Toggle envelope"</p>
                  <p>• "Cycle vehicle profile"</p>
                  <p>• "Toggle city mode"</p>
                  <p>• "Record video" / "Stop video"</p>
                  <p>• "Voice note"</p>
                </div>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-4 mt-6">Multilingual Support</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-voice-languages">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-300">English</th>
                    <th className="text-left py-2 px-3 text-gray-300">Français</th>
                    <th className="text-left py-2 px-3 text-gray-300">Español</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-700/50"><td className="py-1 px-3">"Bridge"</td><td className="py-1 px-3">"Pont"</td><td className="py-1 px-3">"Puente"</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-1 px-3">"Start logging"</td><td className="py-1 px-3">"Démarrer"</td><td className="py-1 px-3">"Iniciar"</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-1 px-3">"Capture image"</td><td className="py-1 px-3">"Capturer"</td><td className="py-1 px-3">"Capturar"</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-1 px-3">"Last measurement"</td><td className="py-1 px-3">"Dernière mesure"</td><td className="py-1 px-3">"Última medición"</td></tr>
                  <tr className="border-b border-gray-700/50"><td className="py-1 px-3">"Clear alert"</td><td className="py-1 px-3">"Effacer alerte"</td><td className="py-1 px-3">"Borrar alerta"</td></tr>
                </tbody>
              </table>
            </div>
            <TipBox>Voice commands work best in quiet environments with a stable internet connection. Speak clearly and naturally. The system uses the Web Speech API which requires an active internet connection for recognition.</TipBox>
          </SectionCard>
        </section>

        {/* PART 14: AI Object Detection */}
        <section id="part14" className="manual-section mb-12" data-testid="section-part14">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Brain className="w-8 h-8 text-blue-400" />
            Part 14: AI Object Detection
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">MeasurePRO+ AI Detection</h3>
            <p className="text-gray-300 mb-4">The AI detection system automatically identifies overhead objects based on measurement patterns. It uses signal analysis to distinguish between different obstruction types such as bridges, wires, trees, and power lines.</p>
            <h4 className="font-medium text-blue-300 mb-2">How It Works</h4>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside text-sm">
              <li>The system continuously analyzes laser measurement data</li>
              <li>Signal patterns are compared against trained profiles</li>
              <li>When a pattern matches, the system auto-classifies the object</li>
              <li>A detection notification appears with the classified POI type</li>
              <li>You can accept, reject, or correct the detection</li>
            </ol>
            <h4 className="font-medium text-blue-300 mb-2 mt-4">Detection Controls</h4>
            <ShortcutTable rows={[
              { shortcut: 'Alt+7', action: 'Accept Detection', description: 'Accept AI detection result' },
              { shortcut: 'Alt+8', action: 'Reject Detection', description: 'Reject AI detection' },
              { shortcut: 'Alt+9', action: 'Correct Detection', description: 'Modify detection result' },
              { shortcut: 'Alt+0', action: 'Test Detection', description: 'Run test detection' },
              { shortcut: 'Alt+Shift+Y', action: 'Toggle City Mode', description: 'Enable city detection parameters' },
            ]} />
            <Screenshot src="./screenshots/demo.jpg" alt="demo" caption="AI Detection Demo" />
          </SectionCard>
        </section>

        {/* PART 15: Envelope Clearance */}
        <section id="part15" className="manual-section mb-12" data-testid="section-part15">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Layers className="w-8 h-8 text-blue-400" />
            Part 15: Envelope Clearance
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Envelope Clearance Monitoring</h3>
            <p className="text-gray-300 mb-4">Envelope clearance monitoring compares real-time measurements against predefined vehicle height profiles to determine if a route is passable for a specific load configuration.</p>
            <h4 className="font-medium text-blue-300 mb-2">Vehicle Profiles</h4>
            <p className="text-gray-300 text-sm mb-4">Configure vehicle height profiles for different load types. The system continuously compares overhead clearance against the active profile and alerts when clearance is insufficient.</p>
            <h4 className="font-medium text-blue-300 mb-2">Controls</h4>
            <ShortcutTable rows={[
              { shortcut: 'Alt+Shift+E', action: 'Toggle Monitoring', description: 'Enable/disable envelope monitoring' },
              { shortcut: 'Alt+Shift+P', action: 'Cycle Profiles', description: 'Switch between vehicle profiles' },
            ]} />
            <TipBox>Set up vehicle profiles before heading into the field. Include safety margins appropriate for your jurisdiction's regulations.</TipBox>
          </SectionCard>
        </section>

        {/* PART 16: Convoy Guardian */}
        <section id="part16" className="manual-section mb-12" data-testid="section-part16">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-400" />
            Part 16: Convoy Guardian
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Multi-Vehicle Convoy Management</h3>
            <p className="text-gray-300 mb-4">Convoy Guardian enables real-time coordination between a lead survey vehicle and one or more follower vehicles. The leader surveys the route while followers receive live clearance alerts.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <h4 className="font-medium text-green-300 mb-2">Leader Vehicle</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Surveys the route with laser & GPS</li>
                  <li>• Broadcasts measurements in real-time</li>
                  <li>• Creates convoy session with unique code</li>
                  <li>• Manages follower permissions</li>
                </ul>
              </div>
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <h4 className="font-medium text-blue-300 mb-2">Follower Vehicle</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Joins convoy with session code</li>
                  <li>• Receives live clearance data</li>
                  <li>• Gets alerted before approaching low objects</li>
                  <li>• Sees leader position on map</li>
                </ul>
              </div>
            </div>
            <Screenshot src="./screenshots/convoy-leader.jpg" alt="convoy-leader" caption="Convoy Leader Interface" />
            <Screenshot src="./screenshots/convoy-follower.jpg" alt="convoy-follower" caption="Convoy Follower Interface" />
          </SectionCard>
        </section>

        {/* PART 17: Route Enforcement */}
        <section id="part17" className="manual-section mb-12" data-testid="section-part17">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Route className="w-8 h-8 text-blue-400" />
            Part 17: Route Enforcement
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Permitted Route Enforcement</h3>
            <p className="text-gray-300 mb-4">Route Enforcement ensures drivers follow their permitted route exactly. The system compares real-time GPS position against the pre-planned route and alerts for deviations.</p>
            <h4 className="font-medium text-blue-300 mb-2">Dispatch View</h4>
            <p className="text-gray-300 text-sm mb-2">Dispatchers create routes with waypoints, assign drivers, and monitor compliance in real-time from the dispatch dashboard.</p>
            <Screenshot src="./screenshots/route-dispatch.jpg" alt="route-dispatch" caption="Route Dispatch Dashboard" />
            <h4 className="font-medium text-blue-300 mb-2 mt-4">Driver View</h4>
            <p className="text-gray-300 text-sm mb-2">Drivers see their assigned route on a map with turn-by-turn guidance. Deviation alerts appear if they leave the permitted corridor.</p>
            <Screenshot src="./screenshots/route-driver.jpg" alt="route-driver" caption="Route Driver Navigation" />
          </SectionCard>
        </section>

        {/* PART 18: GNSS Profiling & 3D LiDAR */}
        <section id="part18" className="manual-section mb-12" data-testid="section-part18">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Navigation className="w-8 h-8 text-blue-400" />
            Part 18: GNSS Profiling & 3D LiDAR
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">GNSS Road Profiling</h3>
            <p className="text-gray-300 mb-4">Advanced GNSS profiling uses high-precision positioning to create detailed road surface profiles. Combined with laser measurements, this provides comprehensive overhead clearance mapping along entire routes.</p>
            <Screenshot src="./screenshots/road-profile.jpg" alt="road-profile" caption="Road Profile Visualization" />
            <h3 className="text-xl font-semibold mb-4 mt-6">3D LiDAR Integration</h3>
            <p className="text-gray-300 mb-4">MeasurePRO supports Hesai Pandar40P LiDAR for 3D point cloud scanning. Capture detailed 3D representations of overhead structures and surrounding environment.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-cyan-300 mb-2">LiDAR Features</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• 40-channel point cloud capture</li>
                  <li>• Real-time 3D visualization</li>
                  <li>• Point cloud export (LAS, PLY)</li>
                  <li>• Integration with GPS positioning</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300 mb-2">Point Cloud Scanner</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Web-based 3D viewer</li>
                  <li>• Measurement tools</li>
                  <li>• Cross-section analysis</li>
                  <li>• Color-coded height mapping</li>
                </ul>
              </div>
            </div>
            <Screenshot src="./screenshots/lidar.jpg" alt="lidar" caption="3D LiDAR Interface" />
            <Screenshot src="./screenshots/lidar-source.jpg" alt="lidar-source" caption="LiDAR Source Configuration" />
            <Screenshot src="./screenshots/point-cloud-scanner.jpg" alt="point-cloud-scanner" caption="Point Cloud Scanner" />
          </SectionCard>
        </section>

        {/* APPENDIX A: Keyboard Shortcuts */}
        <section id="appendixA" className="manual-section mb-12" data-testid="section-appendixA">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Keyboard className="w-8 h-8 text-blue-400" />
            Appendix A: Keyboard Shortcuts
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">POI Shortcuts — Infrastructure</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+B', action: 'Bridge', description: 'Bridge overhead structure' },
              { shortcut: 'Alt+W', action: 'Wire', description: 'Overhead wire/cable' },
              { shortcut: 'Alt+P', action: 'High Voltage Power Line', description: 'High voltage electrical lines' },
              { shortcut: 'Alt+K', action: 'Overpass', description: 'Road or highway overpass' },
              { shortcut: 'Alt+Shift+B', action: 'Bridge & Wires', description: 'Combined bridge and wires' },
              { shortcut: 'Alt+Shift+O', action: 'Overhead Structure', description: 'General overhead structures' },
              { shortcut: 'Alt+Shift+F', action: 'Optical Fiber', description: 'Optical fiber cables' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">POI Shortcuts — Traffic & Road</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+L', action: 'Traffic Light', description: 'Traffic signal' },
              { shortcut: 'Alt+U', action: 'Signalization', description: 'Road signalization' },
              { shortcut: 'Alt+I', action: 'Intersection', description: 'Road intersection' },
              { shortcut: 'Alt+R', action: 'Road', description: 'General road feature' },
              { shortcut: 'Alt+Shift+L', action: 'Passing Lane', description: 'Passing/overtaking lane' },
              { shortcut: 'Alt+Shift+G', action: 'Gravel Road', description: 'Unpaved/gravel road' },
              { shortcut: 'Alt+E', action: 'Dead End', description: 'Road dead end/cul-de-sac' },
              { shortcut: 'Alt+Q', action: 'Railroad', description: 'Railroad crossing' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">POI Shortcuts — Terrain & Alerts</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+T', action: 'Trees', description: 'Trees or vegetation' },
              { shortcut: 'Alt+Shift+U', action: 'Grade Up (12%+)', description: 'Steep uphill grade' },
              { shortcut: 'Alt+Shift+D', action: 'Grade Down (12%+)', description: 'Steep downhill grade' },
              { shortcut: 'Alt+C', action: 'Culvert', description: 'Drainage culvert' },
              { shortcut: 'Alt+O', action: 'Lateral Obstruction', description: 'Side obstruction/barrier' },
              { shortcut: 'Alt+Shift+K', action: 'Parking', description: 'Parking area' },
              { shortcut: 'Alt+Shift+R', action: 'Emergency Parking', description: 'Emergency stopping zone' },
              { shortcut: 'Alt+H', action: 'Danger', description: 'Hazard or danger zone' },
              { shortcut: 'Alt+N', action: 'Information', description: 'Informational note' },
              { shortcut: 'Alt+J', action: 'Important Note', description: 'Critical information' },
              { shortcut: 'Alt+F', action: 'Work Required', description: 'Construction or maintenance' },
              { shortcut: 'Alt+X', action: 'Restricted Access', description: 'Access restrictions' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">System Controls</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+1', action: 'Capture Image', description: 'Capture photo from camera' },
              { shortcut: 'Alt+G', action: 'Log Measurement', description: 'Log current measurement' },
              { shortcut: 'Ctrl+Backspace', action: 'Delete Last Entry', description: 'Remove most recent log' },
              { shortcut: 'Alt+Shift+M', action: 'Manual Log Entry', description: 'Open manual entry dialog' },
              { shortcut: 'Alt+2', action: 'Clear Alert', description: 'Clear current alert' },
              { shortcut: 'Alt+Z', action: 'Clear All Alerts', description: 'Clear all active alerts' },
              { shortcut: 'Alt+3', action: 'Start Logging', description: 'Begin logging session' },
              { shortcut: 'Alt+4', action: 'Stop Logging', description: 'End logging session' },
              { shortcut: 'Alt+5', action: 'Pause Logging', description: 'Pause current session' },
              { shortcut: 'Alt+6', action: 'Start GPS Trace', description: 'Begin GPS tracking' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">Logging Modes</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+M', action: 'Manual Mode', description: 'Manual POI logging only' },
              { shortcut: 'Alt+A', action: 'All Data Mode', description: 'Log all measurements' },
              { shortcut: 'Alt+D', action: 'Detection Mode (AI)', description: 'AI-powered detection' },
              { shortcut: 'Alt+Shift+S', action: 'Manual + Detection', description: 'Manual with detection assist' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">AI Detection & Advanced</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+7', action: 'Accept Detection', description: 'Accept AI detection result' },
              { shortcut: 'Alt+8', action: 'Reject Detection', description: 'Reject AI detection' },
              { shortcut: 'Alt+9', action: 'Correct Detection', description: 'Modify detection result' },
              { shortcut: 'Alt+0', action: 'Test Detection', description: 'Run test detection' },
              { shortcut: 'Alt+V', action: 'Toggle Video', description: 'Start/stop video recording' },
              { shortcut: 'Alt+Shift+E', action: 'Toggle Envelope', description: 'Enable/disable clearance monitoring' },
              { shortcut: 'Alt+Shift+P', action: 'Cycle Profiles', description: 'Switch vehicle profiles' },
              { shortcut: 'Alt+Shift+Y', action: 'Toggle City Mode', description: 'Enable city detection mode' },
              { shortcut: 'Escape', action: 'Deselect POI', description: 'Clear selected POI type' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">Multi-Laser Controls</h3>
            <ShortcutTable rows={[
              { shortcut: '[', action: 'Left Laser', description: 'Read from left-side laser meter' },
              { shortcut: ']', action: 'Right Laser', description: 'Read from right-side laser meter' },
              { shortcut: '\\', action: 'Total Width', description: 'Calculate total width from both lasers' },
              { shortcut: "'", action: 'Rear Overhang', description: 'Measure rear overhang distance' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">Special POI Shortcuts</h3>
            <ShortcutTable rows={[
              { shortcut: 'Alt+Shift+A', action: 'Autoturn Required', description: 'Mark location requiring autoturn analysis' },
              { shortcut: 'Alt+Shift+N', action: 'Voice Note', description: 'Record audio note at current location' },
              { shortcut: 'Alt+C', action: 'Clear Captured Images', description: 'Clear all pending captured images' },
            ]} />
            <h3 className="text-xl font-semibold mb-4 mt-6">Notes</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Shortcuts are case-sensitive — uppercase shortcuts (with Shift) differ from lowercase</li>
              <li>• Alt key is the primary modifier — designed for easy one-handed operation</li>
              <li>• Stream Deck compatible — all shortcuts work with Elgato Stream Deck integration</li>
              <li>• Field-optimized — designed for hands-free or one-handed use while driving</li>
              <li>• Customizable in <strong>Settings → Keyboard Shortcuts</strong></li>
            </ul>
          </SectionCard>
        </section>

        {/* APPENDIX B: POI Types Reference */}
        <section id="appendixB" className="manual-section mb-12" data-testid="section-appendixB">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Mountain className="w-8 h-8 text-blue-400" />
            Appendix B: POI Types Reference
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Complete POI Type List</h3>
            <p className="text-gray-300 mb-4">All 29 POI types organized by category with descriptions and use cases.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-poi-types">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-300">#</th>
                    <th className="text-left py-2 px-3 text-gray-300">POI Type</th>
                    <th className="text-left py-2 px-3 text-gray-300">Category</th>
                    <th className="text-left py-2 px-3 text-gray-300">Use Case</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {[
                    ['1', 'Bridge', 'Infrastructure', 'Bridge overhead clearance measurement'],
                    ['2', 'Wire', 'Infrastructure', 'Overhead cables and wiring'],
                    ['3', 'High Voltage Power Line', 'Infrastructure', 'Electrical transmission lines'],
                    ['4', 'Overpass', 'Infrastructure', 'Highway/road overpasses'],
                    ['5', 'Bridge & Wires', 'Infrastructure', 'Combined bridge with attached wiring'],
                    ['6', 'Overhead Structure', 'Infrastructure', 'General overhead obstructions'],
                    ['7', 'Optical Fiber', 'Infrastructure', 'Fiber optic cable runs'],
                    ['8', 'Traffic Light', 'Traffic', 'Traffic signal height clearance'],
                    ['9', 'Signalization', 'Traffic', 'Road signs and signals'],
                    ['10', 'Intersection', 'Traffic', 'Road intersection documentation'],
                    ['11', 'Road', 'Traffic', 'General road features'],
                    ['12', 'Passing Lane', 'Traffic', 'Lane availability for oversize loads'],
                    ['13', 'Gravel Road', 'Traffic', 'Unpaved road segments'],
                    ['14', 'Dead End', 'Traffic', 'Turn-around requirements'],
                    ['15', 'Railroad', 'Railroad', 'Railroad crossing locations'],
                    ['16', 'Trees', 'Terrain', 'Vegetation clearance issues'],
                    ['17', 'Grade Up (12%+)', 'Terrain', 'Steep uphill sections'],
                    ['18', 'Grade Down (12%+)', 'Terrain', 'Steep downhill sections'],
                    ['19', 'Culvert', 'Terrain', 'Drainage structures and weight limits'],
                    ['20', 'Lateral Obstruction', 'Obstruction', 'Side clearance issues'],
                    ['21', 'Parking', 'Obstruction', 'Available parking for oversize loads'],
                    ['22', 'Emergency Parking', 'Obstruction', 'Emergency stopping areas'],
                    ['23', 'Danger', 'Alert', 'Hazardous locations'],
                    ['24', 'Information', 'Alert', 'General informational notes'],
                    ['25', 'Important Note', 'Alert', 'Critical observations'],
                    ['26', 'Work Required', 'Alert', 'Construction/maintenance zones'],
                    ['27', 'Restricted Access', 'Alert', 'Access limitation areas'],
                    ['28', 'Autoturn Required', 'Special', 'Locations needing autoturn analysis'],
                    ['29', 'Voice Note', 'Special', 'Audio note recording locations'],
                  ].map(([num, type, cat, use]) => (
                    <tr key={num} className="border-b border-gray-700/50">
                      <td className="py-2 px-3 text-gray-500">{num}</td>
                      <td className="py-2 px-3 font-medium text-white">{type}</td>
                      <td className="py-2 px-3">{cat}</td>
                      <td className="py-2 px-3 text-gray-400">{use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </section>

        {/* APPENDIX C: Export Formats */}
        <section id="appendixC" className="manual-section mb-12" data-testid="section-appendixC">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-400" />
            Appendix C: Export Formats
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">CSV Format Specification</h3>
            <p className="text-gray-300 text-sm mb-4">The CSV export includes the following columns:</p>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-300 overflow-x-auto mb-4">
              timestamp, measurement_m, poi_type, latitude, longitude, altitude_m, speed_kmh, course_deg, satellites, hdop, fix_quality, alert_status, survey_id, part_number, notes
            </div>
            <h3 className="text-xl font-semibold mb-4 mt-6">GeoJSON Format</h3>
            <p className="text-gray-300 text-sm mb-4">Each measurement is exported as a GeoJSON Feature with Point geometry:</p>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-300 overflow-x-auto mb-4">
{`{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [-73.456, 45.123, 25.5] },
    "properties": {
      "measurement": 6.5,
      "poiType": "Bridge",
      "timestamp": "2025-01-15T14:30:00Z",
      "alertStatus": "normal"
    }
  }]
}`}
            </div>
            <h3 className="text-xl font-semibold mb-4 mt-6">KML Format</h3>
            <p className="text-gray-300 text-sm mb-4">KML exports create placemarks for each measurement with extended data attributes. Compatible with Google Earth, Google Maps, and most GIS platforms.</p>
            <h3 className="text-xl font-semibold mb-4 mt-6">JSON Full Export</h3>
            <p className="text-gray-300 text-sm">The full JSON export includes all raw data, metadata, survey settings, and device configuration. This is the most complete format for data archival and custom processing pipelines.</p>
          </SectionCard>
        </section>

        {/* APPENDIX D: Troubleshooting */}
        <section id="appendixD" className="manual-section mb-12" data-testid="section-appendixD">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-blue-400" />
            Appendix D: Troubleshooting
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Common Issues</h3>
            <div className="space-y-4">
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">Laser won't connect</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Ensure you're using Chrome or Edge (Serial port support built-in)</li>
                  <li>• Check USB cable connection</li>
                  <li>• Try a different USB port</li>
                  <li>• Verify laser is powered on and in continuous mode</li>
                  <li>• Check that no other application is using the serial port</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">GPS shows "No Fix"</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Move to an area with clear sky view</li>
                  <li>• Wait 30–60 seconds for satellite acquisition</li>
                  <li>• Check GPS antenna connection</li>
                  <li>• Verify correct baud rate in settings</li>
                  <li>• Try device GPS fallback if hardware fails</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">App won't load offline</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Ensure the app was loaded at least once with internet</li>
                  <li>• Check that the service worker is registered (Settings → Debug)</li>
                  <li>• Clear browser cache and reload with internet first</li>
                  <li>• Verify sufficient storage space on device</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">Voice commands not recognized</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Check microphone permission in browser settings</li>
                  <li>• Ensure internet connection (speech recognition requires it)</li>
                  <li>• Speak clearly and at normal volume</li>
                  <li>• Verify correct language is selected</li>
                  <li>• Reduce background noise</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">Data not syncing to cloud</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Check internet connectivity</li>
                  <li>• Verify you are logged in</li>
                  <li>• Check Firebase status in Settings → Debug</li>
                  <li>• Data syncs automatically when connectivity is restored</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">Camera feed not showing</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Grant camera permission in browser settings</li>
                  <li>• Check that no other app is using the camera</li>
                  <li>• Try selecting a different camera if multiple are available</li>
                  <li>• Reload the page</li>
                </ul>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-4 mt-6">Getting Help</h3>
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <p className="text-blue-300 text-sm mb-2">If you need additional support, contact SolTec Innovation:</p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li><Mail className="w-3 h-3 inline mr-1" />Email: <a href="mailto:support@soltec.ca" className="text-blue-400 hover:underline" data-testid="link-support-email">support@soltec.ca</a></li>
                <li><Phone className="w-3 h-3 inline mr-1" />Phone: 1.438.533.5344</li>
                <li><Globe className="w-3 h-3 inline mr-1" />Web: <a href="https://www.SolTecInnovation.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" data-testid="link-support-website">www.SolTecInnovation.com</a></li>
              </ul>
            </div>
            <Screenshot src="./screenshots/help.jpg" alt="help" caption="Help & Support Page" />
            <Screenshot src="./screenshots/documentation.jpg" alt="documentation" caption="Documentation Center" />
          </SectionCard>
        </section>

        {/* PART 19: Slave App & Live Monitor */}
        <section id="part19" className="manual-section mb-12" data-testid="section-part19">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Monitor className="w-8 h-8 text-blue-400" />
            Part 19: Slave App & Live Monitor
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Slave App (Follower Device)</h3>
            <p className="text-gray-300 mb-4">The Slave App transforms a secondary device (tablet, phone) into a read-only companion display. It pairs with the Master App to show real-time measurement data, GPS position, and alert status without controlling the hardware directly.</p>
            <h4 className="font-medium text-blue-300 mb-2">How to Set Up</h4>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside text-sm mb-4">
              <li>On the Master device, navigate to <strong>Settings → Slave Pairing</strong></li>
              <li>Click <strong>"Generate Pairing Code"</strong> — a 6-digit code appears</li>
              <li>On the Slave device, log in and select <strong>"Slave App"</strong> at the app selection screen</li>
              <li>Enter the 6-digit pairing code from the Master</li>
              <li>Click <strong>"Connect"</strong> — data streaming begins immediately</li>
            </ol>
            <h4 className="font-medium text-blue-300 mb-2">Slave App Features</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Real-time measurement display mirroring the Master</li>
              <li>• GPS position and speed from the Master device</li>
              <li>• Visual and audio alerts matching the Master</li>
              <li>• Independent camera capture (uses Slave device camera)</li>
              <li>• Read-only — cannot control laser, GPS, or logging</li>
            </ul>
            <Screenshot src="./screenshots/slave-app.jpg" alt="slave-app" caption="Slave App Interface" />
          </SectionCard>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Live Monitor Dashboard</h3>
            <p className="text-gray-300 mb-4">Live Monitor provides a web-based dashboard for remote observation of active survey sessions. Office staff can monitor field crews in real-time from any browser.</p>
            <h4 className="font-medium text-blue-300 mb-2">Capabilities</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• View live measurement data from active field sessions</li>
              <li>• Track vehicle positions on an interactive map</li>
              <li>• Receive alert notifications when clearance thresholds are breached</li>
              <li>• Monitor multiple survey sessions simultaneously</li>
              <li>• View survey statistics (measurement count, distance covered, alerts triggered)</li>
            </ul>
            <Screenshot src="./screenshots/live-monitor.jpg" alt="live-monitor" caption="Live Monitor Dashboard" />
            <TipBox>Live Monitor requires an active internet connection on both the field device and the monitoring device. Data is streamed via Firebase Realtime Database.</TipBox>
          </SectionCard>
        </section>

        {/* PART 20: Administration */}
        <section id="part20" className="manual-section mb-12" data-testid="section-part20">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-400" />
            Part 20: Administration
          </h2>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Admin Panel Overview</h3>
            <p className="text-gray-300 mb-4">The MeasurePRO Admin Panel provides comprehensive management tools for system administrators. Access requires master admin credentials and is protected by a secondary password prompt.</p>
            <Screenshot src="./screenshots/admin.jpg" alt="admin" caption="Admin Panel Login" />
            <h3 className="text-xl font-semibold mb-4 mt-6">Account Management</h3>
            <p className="text-gray-300 text-sm mb-3">View, approve, modify, and deactivate user accounts. Administrators can:</p>
            <ul className="text-gray-300 text-sm space-y-1 mb-4">
              <li>• Approve pending registrations</li>
              <li>• Assign subscription tiers (Free, Basic, Plus, Pro)</li>
              <li>• Enable/disable specific feature flags per user</li>
              <li>• Force password changes</li>
              <li>• View login history and last active timestamps</li>
            </ul>
            <Screenshot src="./screenshots/admin-accounts.jpg" alt="admin-accounts" caption="Account Management Dashboard" />
          </SectionCard>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">License Management</h3>
            <p className="text-gray-300 text-sm mb-3">Create, assign, and track software licenses across your organization.</p>
            <ul className="text-gray-300 text-sm space-y-1 mb-4">
              <li>• Generate license keys with configurable expiration dates</li>
              <li>• Assign licenses to specific users or email domains</li>
              <li>• Monitor active vs. available license counts</li>
              <li>• Revoke or transfer licenses between users</li>
            </ul>
            <Screenshot src="./screenshots/admin-licensing.jpg" alt="admin-licensing" caption="License Management" />
          </SectionCard>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Pricing Configuration</h3>
            <p className="text-gray-300 text-sm mb-3">Configure subscription pricing, feature bundles, and promotional offers.</p>
            <Screenshot src="./screenshots/admin-pricing.jpg" alt="admin-pricing" caption="Pricing Configuration" />
            <h3 className="text-xl font-semibold mb-4 mt-6">Analytics Dashboard</h3>
            <p className="text-gray-300 text-sm mb-3">View usage analytics including active users, measurement counts, storage usage, and feature adoption metrics.</p>
            <Screenshot src="./screenshots/admin-analytics.jpg" alt="admin-analytics" caption="Analytics Dashboard" />
          </SectionCard>
          <SectionCard>
            <h3 className="text-xl font-semibold mb-4">Terms & Conditions Management</h3>
            <p className="text-gray-300 text-sm mb-3">Update terms of service and privacy policy. When terms are updated, all users are prompted to re-accept before continuing.</p>
            <Screenshot src="./screenshots/admin-terms2.jpg" alt="admin-terms" caption="Terms Management" />
            <h3 className="text-xl font-semibold mb-4 mt-6">Debug Tools</h3>
            <p className="text-gray-300 text-sm mb-3">Advanced diagnostic tools for system troubleshooting:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-cyan-300 mb-2">IndexedDB Inspector</h4>
                <p className="text-gray-400 text-sm">Browse, query, and export local IndexedDB data stores. Useful for diagnosing sync issues and recovering orphaned measurements.</p>
                <Screenshot src="./screenshots/admin-debug-indexeddb.jpg" alt="admin-debug-indexeddb" caption="IndexedDB Inspector" />
              </div>
              <div>
                <h4 className="font-medium text-cyan-300 mb-2">Stress Testing</h4>
                <p className="text-gray-400 text-sm">Run performance stress tests to verify system stability under high measurement rates and large dataset scenarios.</p>
                <Screenshot src="./screenshots/admin-debug-stress.jpg" alt="admin-debug-stress" caption="Stress Testing" />
              </div>
            </div>
            <WarningBox>Debug tools are intended for system administrators only. Improper use of the IndexedDB inspector may cause data corruption.</WarningBox>
          </SectionCard>
        </section>

        {/* APPENDIX E: Glossary */}
        <section id="appendixE" className="manual-section mb-12" data-testid="section-appendixE">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-400" />
            Appendix E: Glossary
          </h2>
          <SectionCard>
            <div className="space-y-3 text-sm">
              {[
                ['Auto-Part', 'Automatic segmentation of long surveys into manageable data parts to prevent memory issues and ensure reliable persistence.'],
                ['Baud Rate', 'Serial communication speed (bits per second). Common GPS rates: 9600, 38400, 115200.'],
                ['Convoy Guardian', 'Multi-vehicle coordination system where a leader surveys a route and followers receive live clearance data.'],
                ['CORS', 'Continuously Operating Reference Stations — fixed GPS stations that provide RTK correction data for centimeter-level accuracy.'],
                ['Duro', 'Swift Navigation Duro — a high-precision RTK-capable GNSS receiver supported by MeasurePRO as the highest-priority GPS source.'],
                ['Envelope Clearance', 'The minimum overhead space required for a specific vehicle/load configuration to pass safely.'],
                ['Firebase', 'Google cloud platform used by MeasurePRO for authentication, real-time database sync, and cloud storage.'],
                ['GeoJSON', 'Open standard format for encoding geographic data structures. Used for GIS data exchange.'],
                ['GNSS', 'Global Navigation Satellite System — umbrella term for GPS, GLONASS, Galileo, and BeiDou positioning systems.'],
                ['HDOP', 'Horizontal Dilution of Precision — a measure of GPS horizontal accuracy. Lower values indicate better accuracy (target < 2.0).'],
                ['IndexedDB', 'Browser-based database used by MeasurePRO for offline-first local data storage.'],
                ['KML', 'Keyhole Markup Language — XML format for geographic data, used by Google Earth.'],
                ['LiDAR', 'Light Detection and Ranging — laser-based remote sensing technology for 3D point cloud capture.'],
                ['NMEA', 'National Marine Electronics Association — standard protocol for GPS data communication (NMEA 0183).'],
                ['OS/OW', 'Oversize/Overweight — transport loads exceeding standard legal dimensions or weight limits.'],
                ['Point Cloud', 'A set of 3D data points in space, typically captured by LiDAR scanners.'],
                ['POI', 'Point of Interest — a categorized measurement location (e.g., Bridge, Wire, Tree).'],
                ['PWA', 'Progressive Web App — a web application that can be installed on devices and works offline.'],
                ['RTK', 'Real-Time Kinematic — GPS correction technique providing centimeter-level positioning accuracy.'],
                ['Service Worker', 'Browser background process that enables offline functionality and push notifications in PWAs.'],
                ['Swept Path', 'The area traversed by a vehicle (including overhang) when making turns.'],
                ['Web Serial API', 'Browser API enabling direct communication with serial devices (lasers, GPS) from web applications.'],
                ['ZED 2i', 'Stereolabs ZED 2i — a stereo depth camera supported by MeasurePRO for 3D imaging.'],
              ].map(([term, def]) => (
                <div key={term} className="border-b border-gray-700/50 pb-2">
                  <dt className="font-semibold text-white inline">{term}: </dt>
                  <dd className="text-gray-300 inline">{def}</dd>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        <footer className="text-center text-gray-500 text-sm py-8 border-t border-gray-800 mt-8" data-testid="manual-footer">
          <p className="font-semibold text-gray-400 mb-1">SolTec Innovation</p>
          <p>www.SolTecInnovation.com | 1.438.533.5344 | support@soltec.ca</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} SolTec Innovation. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
