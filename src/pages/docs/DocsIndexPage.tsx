import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft, Printer, FileText, Cpu, MapPin, Keyboard, CloudRain, Package, ScanLine, Mic, Camera, Download } from 'lucide-react';

const DOCS = [
  {
    id: 'laser-quickstart',
    icon: <Cpu className="w-8 h-8 text-blue-400" />,
    kit: 'LiDAR Kit',
    kitColor: 'bg-blue-900/40 border-blue-700/50 text-blue-300',
    title: 'Quick Start Guide — Laser',
    desc: '12V laser wiring, USB-serial connection, app setup, ground reference, multi-laser system. Letter format.',
    pages: 'Letter format',
    href: '/docs/laser-quickstart',
    download: null,
  },
  {
    id: 'gnss-quickstart',
    icon: <MapPin className="w-8 h-8 text-green-400" />,
    kit: 'GNSS Kit',
    kitColor: 'bg-green-900/40 border-green-700/50 text-green-300',
    title: 'Quick Start Guide — GNSS',
    desc: 'Antenna installation, Duro power, app connection, RTK fix types, NTRIP configuration. Letter format.',
    pages: 'Letter format',
    href: '/docs/gnss-quickstart',
    download: null,
  },
  {
    id: 'field-card',
    icon: <Keyboard className="w-8 h-8 text-yellow-400" />,
    kit: 'Both Kits',
    kitColor: 'bg-yellow-900/40 border-yellow-700/50 text-yellow-300',
    title: 'Field Reference Card',
    desc: 'All keyboard shortcuts, voice commands, startup sequence. Compact format — print and laminate.',
    pages: 'Letter format',
    href: '/docs/field-card',
    download: null,
  },
  {
    id: 'environmental',
    icon: <CloudRain className="w-8 h-8 text-sky-400" />,
    kit: 'Both Kits',
    kitColor: 'bg-sky-900/40 border-sky-700/50 text-sky-300',
    title: 'Environmental Conditions Guide',
    desc: 'Effects of rain, fog, direct sun, dark surfaces, and extreme temperatures on the laser and camera.',
    pages: 'Letter format',
    href: '/docs/environmental',
    download: null,
  },
  {
    id: 'autopart',
    icon: <Package className="w-8 h-8 text-orange-400" />,
    kit: 'Both Kits',
    kitColor: 'bg-orange-900/40 border-orange-700/50 text-orange-300',
    title: 'Auto-Part System Guide',
    desc: 'Automatic save at 200 POIs, retrieving parts, configuring the threshold, manual transition.',
    pages: 'Letter format',
    href: '/docs/autopart',
    download: null,
  },
  {
    id: 'pandar40p',
    icon: <ScanLine className="w-8 h-8 text-purple-400" />,
    kit: 'LiDAR 3D Kit',
    kitColor: 'bg-purple-900/40 border-purple-700/50 text-purple-300',
    title: 'Pandar40P LiDAR Guide',
    desc: 'Physical connection (Lemo, 12V power box, Ethernet), static IP configuration, Windows service installation, 3 capture modes (Survey, Static Scan, Auto POI) and troubleshooting.',
    pages: 'Letter format',
    href: '/docs/pandar40p',
    download: null,
  },
  {
    id: 'voice-commands',
    icon: <Mic className="w-8 h-8 text-violet-400" />,
    kit: 'Both Kits',
    kitColor: 'bg-violet-900/40 border-violet-700/50 text-violet-300',
    title: 'Voice Command Reference',
    desc: 'Complete list of all 65+ voice commands organized by category: status queries, logging, POI types (basic, extended, advanced), AI detection, and audio. Letter format.',
    pages: 'Letter format',
    href: '/docs/voice-commands',
    download: null,
  },
  {
    id: 'camera-bridge',
    icon: <Camera className="w-8 h-8 text-violet-400" />,
    kit: '360° Camera Kit',
    kitColor: 'bg-violet-900/40 border-violet-800/50 text-violet-300',
    title: 'Camera Bridge — Setup Guide',
    desc: 'Windows background service for Insta360 X5 integration. Download the installer, step-by-step setup, Task Scheduler registration, and API reference.',
    pages: 'Setup guide + download',
    href: '/docs/camera-bridge',
    download: '/downloads/measurepro-camera-bridge.tar.gz',
  },
];

export default function DocsIndexPage() {
  useEffect(() => {
    document.title = 'Printable Documents — MeasurePRO | measure-pro.app';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/documentation" className="text-gray-300 hover:text-white transition-colors flex items-center gap-2" data-testid="link-back-docs">
            <ArrowLeft className="w-5 h-5" />
            Documentation
          </Link>
          <Link to="/" className="text-gray-300 hover:text-white transition-colors text-sm" data-testid="link-home">Home</Link>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-docs-title">Printable Documents</h1>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Letter-format documents · For inclusion in MeasurePRO LiDAR and GNSS kits · SolTec Innovation
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {DOCS.map(doc => (
            <div key={doc.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col gap-4 hover:border-gray-600 transition-colors" data-testid={`card-doc-${doc.id}`}>
              <div className="flex items-start gap-4">
                <div className="bg-gray-700 rounded-lg p-3 shrink-0">{doc.icon}</div>
                <div className="flex-1">
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${doc.kitColor}`}>
                    {doc.kit}
                  </span>
                  <h2 className="text-white font-semibold leading-tight">{doc.title}</h2>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{doc.desc}</p>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-700">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {doc.pages}
                </span>
                <div className="flex items-center gap-2">
                  {doc.download && (
                    <a
                      href={doc.download}
                      download
                      className="flex items-center gap-1.5 border border-violet-600 hover:bg-violet-600/20 text-violet-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  )}
                  <Link
                    to={doc.href}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    data-testid={`button-open-${doc.id}`}
                  >
                    <Printer className="w-4 h-4" />
                    Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-gray-800 border border-gray-700 rounded-xl p-6 text-sm text-gray-400">
          <p className="font-semibold text-gray-300 mb-2">Print Instructions</p>
          <ul className="space-y-1 list-disc list-inside ml-2">
            <li>Open the document → click <strong className="text-white">Print</strong> at the top of the page</li>
            <li>Letter format · Portrait orientation · Normal margins</li>
            <li>Disable browser headers/footers in the print dialog for a clean print</li>
            <li>The field reference card can be printed double-sided and laminated</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
