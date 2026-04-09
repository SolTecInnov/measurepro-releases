import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Keyboard, FileText, ExternalLink, Printer, Cpu, MapPin,
  CloudRain, Package, ScanLine, BookMarked, Zap, Target, Video,
  Navigation, Radio, Layers, AlertTriangle, ChevronRight
} from 'lucide-react';

type DocTab = 'documents' | 'shortcuts' | 'quickref';

const DOCUMENTS = [
  {
    id: 'manual',
    icon: <BookOpen className="w-6 h-6 text-blue-400" />,
    bg: 'bg-blue-900/30 border-blue-700/40',
    badge: 'Full Manual',
    badgeColor: 'bg-blue-800/60 text-blue-300',
    title: 'Complete User Manual',
    desc: '22 parts + 6 appendices — laser setup, GPS, POI types, AI detection, export formats, admin and more.',
    meta: 'measure-pro.app/manual',
    href: '/manual',
    external: true,
    action: 'Open Manual',
  },
  {
    id: 'technical-docs',
    icon: <FileText className="w-6 h-6 text-cyan-400" />,
    bg: 'bg-cyan-900/30 border-cyan-700/40',
    badge: 'Technical',
    badgeColor: 'bg-cyan-800/60 text-cyan-300',
    title: 'Technical Documentation',
    desc: 'Hardware protocols, GPS architecture, export formats (CSV, LandXML, GeoJSON, Shapefile).',
    meta: '/documentation',
    href: '/documentation',
    external: false,
    action: 'Open',
  },
  {
    id: 'laser-quickstart',
    icon: <Cpu className="w-6 h-6 text-blue-400" />,
    bg: 'bg-blue-900/20 border-blue-800/30',
    badge: 'LiDAR Kit',
    badgeColor: 'bg-blue-900/60 text-blue-300',
    title: 'Quick Start Guide — Laser',
    desc: '12V wiring, USB-serial connection, app setup, ground reference configuration, multi-laser system.',
    meta: 'Letter format · Printable',
    href: '/docs/laser-quickstart',
    external: false,
    action: 'Open',
  },
  {
    id: 'gnss-quickstart',
    icon: <MapPin className="w-6 h-6 text-green-400" />,
    bg: 'bg-green-900/20 border-green-800/30',
    badge: 'GNSS Kit',
    badgeColor: 'bg-green-900/60 text-green-300',
    title: 'Quick Start Guide — GNSS',
    desc: 'Antenna installation, Duro power, app connection, RTK fix types, NTRIP configuration.',
    meta: 'Letter format · Printable',
    href: '/docs/gnss-quickstart',
    external: false,
    action: 'Open',
  },
  {
    id: 'field-card',
    icon: <Keyboard className="w-6 h-6 text-yellow-400" />,
    bg: 'bg-yellow-900/20 border-yellow-800/30',
    badge: 'Both Kits',
    badgeColor: 'bg-yellow-900/60 text-yellow-300',
    title: 'Field Reference Card',
    desc: 'All keyboard shortcuts, voice commands, startup sequence — compact format, print and laminate.',
    meta: 'Letter format · Printable',
    href: '/docs/field-card',
    external: false,
    action: 'Open',
  },
  {
    id: 'environmental',
    icon: <CloudRain className="w-6 h-6 text-sky-400" />,
    bg: 'bg-sky-900/20 border-sky-800/30',
    badge: 'Both Kits',
    badgeColor: 'bg-sky-900/60 text-sky-300',
    title: 'Environmental Conditions Guide',
    desc: 'Effects of rain, fog, direct sun, dark surfaces, and extreme temperatures on laser and camera.',
    meta: 'Letter format · Printable',
    href: '/docs/environmental',
    external: false,
    action: 'Open',
  },
  {
    id: 'autopart',
    icon: <Package className="w-6 h-6 text-orange-400" />,
    bg: 'bg-orange-900/20 border-orange-800/30',
    badge: 'Both Kits',
    badgeColor: 'bg-orange-900/60 text-orange-300',
    title: 'Auto-Part System Guide',
    desc: 'Automatic save at 200 POIs threshold, retrieving parts, configuring the threshold, manual transitions.',
    meta: 'Letter format · Printable',
    href: '/docs/autopart',
    external: false,
    action: 'Open',
  },
  {
    id: 'pandar40p',
    icon: <ScanLine className="w-6 h-6 text-purple-400" />,
    bg: 'bg-purple-900/20 border-purple-800/30',
    badge: 'LiDAR 3D Kit',
    badgeColor: 'bg-purple-900/60 text-purple-300',
    title: 'Pandar40P LiDAR Guide',
    desc: 'Physical connection (Lemo, 12V power box, Ethernet), static IP configuration, Windows service, 3 capture modes and troubleshooting.',
    meta: 'Letter format · Printable',
    href: '/docs/pandar40p',
    external: false,
    action: 'Open',
  },
];

function formatKey(key: string, ctrl?: boolean, alt?: boolean, shift?: boolean): string {
  const parts: string[] = [];
  if (ctrl) parts.push('Ctrl');
  if (alt) parts.push('Alt');
  if (shift) parts.push('Shift');
  const displayKey = key === ' ' ? 'Space' : key.toUpperCase();
  parts.push(displayKey);
  return parts.join('+');
}

function Kbd({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label.split('+').map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-gray-600 text-xs">+</span>}
          <kbd className="bg-gray-700 border border-gray-600 px-1.5 py-0.5 rounded text-xs font-mono text-gray-200 whitespace-nowrap">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

function ShortcutRow({ label, keys, note }: { label: string; keys: string; note?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 gap-3">
      <span className="text-gray-300 text-sm flex-1">{label}</span>
      {note && <span className="text-xs text-amber-400 shrink-0">{note}</span>}
      <Kbd label={keys} />
    </div>
  );
}

function ShortcutGroup({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className={`px-4 py-2.5 flex items-center gap-2 ${color}`}>
        {icon}
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="px-4 divide-y divide-gray-700/30">
        {children}
      </div>
    </div>
  );
}

function DocumentsTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm">All in-app documents, guides, and reference materials available in MeasurePRO.</p>
      <div className="grid md:grid-cols-2 gap-3">
        {DOCUMENTS.map(doc => (
          <div
            key={doc.id}
            className={`border rounded-xl p-4 flex flex-col gap-3 ${doc.bg}`}
            data-testid={`card-doccenter-${doc.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="bg-gray-800/60 rounded-lg p-2 shrink-0">{doc.icon}</div>
              <div className="flex-1 min-w-0">
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 ${doc.badgeColor}`}>
                  {doc.badge}
                </span>
                <h3 className="text-white font-semibold text-sm leading-tight">{doc.title}</h3>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{doc.desc}</p>
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/10">
              <span className="text-xs text-gray-500">{doc.meta}</span>
              <button
                onClick={() => {
                  if (doc.external) {
                    window.open(doc.href, '_blank');
                  } else {
                    navigate(doc.href);
                  }
                }}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                data-testid={`button-doccenter-${doc.id}`}
              >
                {doc.id === 'manual' || doc.external
                  ? <ExternalLink className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
                {doc.action}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-400">
        <p className="font-semibold text-gray-300 mb-1.5 flex items-center gap-2">
          <Printer className="w-4 h-4 text-gray-400" />
          Printing Field Guides
        </p>
        <ul className="space-y-1 list-disc list-inside ml-1 text-xs">
          <li>Open any guide → click the <strong className="text-white">Print</strong> button at the top</li>
          <li>Letter format · Portrait orientation · Normal margins</li>
          <li>Disable browser headers/footers for a clean print</li>
          <li>The Field Reference Card can be printed double-sided and laminated</li>
        </ul>
      </div>
    </div>
  );
}

function ShortcutsTab() {
  return (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm">All default keyboard shortcuts. Shortcuts can be customized in Settings → Keyboard.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <ShortcutGroup title="Core Actions" icon={<Zap className="w-4 h-4 text-blue-300" />} color="bg-blue-900/40 text-blue-300">
          <ShortcutRow label="Capture Image" keys="Alt+1" />
          <ShortcutRow label="Clear Alert" keys="Alt+2" />
          <ShortcutRow label="Clear All Captured Images" keys="Alt+C" />
          <ShortcutRow label="Log Measurement" keys="Alt+G" />
          <ShortcutRow label="Delete Last Entry" keys="Ctrl+Backspace" />
          <ShortcutRow label="Deselect POI Type (None)" keys="Alt+Shift+N" />
          <ShortcutRow label="Open Manual Log Entry" keys="Alt+Shift+M" />
        </ShortcutGroup>

        <ShortcutGroup title="Logging Controls" icon={<Target className="w-4 h-4 text-green-300" />} color="bg-green-900/40 text-green-300">
          <ShortcutRow label="Start Logging" keys="Alt+3" />
          <ShortcutRow label="Stop Logging" keys="Alt+4" />
          <ShortcutRow label="Pause Logging" keys="Alt+5" />
          <ShortcutRow label="Resume Logging" keys="Alt+6" />
          <ShortcutRow label="Start GPS Trace" keys="Alt+7" />
          <ShortcutRow label="Switch to Manual Mode" keys="Alt+M" />
          <ShortcutRow label="Switch to All Data Mode" keys="Alt+A" />
          <ShortcutRow label="Switch to Detection Mode (AI)" keys="Alt+D" />
          <ShortcutRow label="Switch to Manual Detection Mode" keys="Alt+Shift+S" />
          <ShortcutRow label="Switch to Counter Detection Mode" keys="Alt+Shift+C" />
          <ShortcutRow label="Clear All Alerts" keys="Alt+Z" />
        </ShortcutGroup>

        <ShortcutGroup title="AI Detection (MeasurePRO+)" icon={<Radio className="w-4 h-4 text-purple-300" />} color="bg-purple-900/40 text-purple-300">
          <ShortcutRow label="Accept Detection" keys="Alt+7" note="Same as GPS Trace" />
          <ShortcutRow label="Reject Detection" keys="Alt+8" />
          <ShortcutRow label="Correct Detection" keys="Alt+9" />
          <ShortcutRow label="Test Detection" keys="Alt+0" />
          <ShortcutRow label="Toggle Envelope Monitoring" keys="Alt+Shift+E" />
          <ShortcutRow label="Cycle Vehicle Profiles" keys="Alt+Shift+P" />
</ShortcutGroup>

        <ShortcutGroup title="Lateral & Rear Capture" icon={<Layers className="w-4 h-4 text-amber-300" />} color="bg-amber-900/40 text-amber-300">
          <ShortcutRow label="Capture Left Lateral Clearance POI" keys="Alt+[" />
          <ShortcutRow label="Capture Right Lateral Clearance POI" keys="Alt+]" />
          <ShortcutRow label="Capture Total Width POI" keys="Alt+\" />
          <ShortcutRow label="Capture Rear Overhang POI" keys="Alt+'" />
        </ShortcutGroup>

        <ShortcutGroup title="Video" icon={<Video className="w-4 h-4 text-red-300" />} color="bg-red-900/40 text-red-300">
          <ShortcutRow label="Start / Stop Video Recording" keys="Alt+V" />
        </ShortcutGroup>
      </div>

      <ShortcutGroup title="POI Type Selection" icon={<Navigation className="w-4 h-4 text-cyan-300" />} color="bg-cyan-900/40 text-cyan-300">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
          {[
            { label: 'Bridge', keys: 'Alt+B' },
            { label: 'Trees', keys: 'Alt+T' },
            { label: 'Wire', keys: 'Alt+W' },
            { label: 'Power Line', keys: 'Alt+P' },
            { label: 'Traffic Light', keys: 'Alt+L' },
            { label: 'Overpass', keys: 'Alt+K' },
            { label: 'Lateral Obstruction', keys: 'Alt+O' },
            { label: 'Road', keys: 'Alt+R' },
            { label: 'Intersection', keys: 'Alt+I' },
            { label: 'Signalization', keys: 'Alt+U' },
            { label: 'Railroad', keys: 'Alt+Q' },
            { label: 'Information', keys: 'Alt+N' },
            { label: 'Danger', keys: 'Alt+H' },
            { label: 'Important Note', keys: 'Alt+J' },
            { label: 'Work Required', keys: 'Alt+F' },
            { label: 'Restricted', keys: 'Alt+X' },
            { label: 'Dead End', keys: 'Alt+E' },
            { label: 'Culvert', keys: 'Alt+C' },
            { label: 'Roundabout', keys: 'Alt+Y' },
            { label: 'Bridge & Wires', keys: 'Alt+Shift+B' },
            { label: 'Overhead Structure', keys: 'Alt+Shift+O' },
            { label: 'Optical Fiber', keys: 'Alt+Shift+F' },
            { label: 'Grade Up (12%+)', keys: 'Alt+Shift+U' },
            { label: 'Grade Down (12%+)', keys: 'Alt+Shift+D' },
            { label: 'Voice Note', keys: 'Alt+Shift+N' },
            { label: 'Passing Lane', keys: 'Alt+Shift+L' },
            { label: 'Parking', keys: 'Alt+Shift+K' },
            { label: 'Gravel Road', keys: 'Alt+Shift+G' },
            { label: 'Emergency Parking', keys: 'Alt+Shift+R' },
            { label: 'Autoturn Required', keys: 'Alt+Shift+A' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-700/30 last:border-0 gap-2">
              <span className="text-gray-300 text-xs flex-1">{row.label}</span>
              <Kbd label={row.keys} />
            </div>
          ))}
        </div>
      </ShortcutGroup>

      <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 flex gap-2 text-xs text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          <strong>Note:</strong> Alt+7 is shared by "Start GPS Trace" and "Accept Detection" — the active mode determines which action fires.
          Alt+C is shared by "Clear All Captured Images" and "Culvert" (case-sensitive). Alt+Shift+N is shared by "Deselect POI Type" and "Voice Note".
          You can reassign any shortcut in Settings → Keyboard.
        </p>
      </div>
    </div>
  );
}

function QuickRefTab() {
  return (
    <div className="space-y-5">
      <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4">
        <h3 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Startup Sequence
        </h3>
        <ol className="space-y-2">
          {[
            ['1', 'Power laser', '12V via cigarette lighter or 120V-to-12V converter'],
            ['2', 'Connect USB-serial cable', 'Between laser enclosure and tablet'],
            ['3', 'Open app', 'Chrome or Edge → measure-pro.app'],
            ['4', 'Connect laser', 'Settings → Hardware → Laser → Select Port · Protocol: SolTec · Baud: 115,200'],
            ['5', 'Connect GPS', 'Settings → GNSS/Duro → Connect (or USB GPS in Laser & GPS tab)'],
            ['6', 'Set ground reference', 'Measure tape from laser enclosure/sun shade junction to ground → enter in Settings → Laser'],
            ['7', 'Create or open a survey', 'Survey Manager → New Survey (or continue existing)'],
            ['8', 'Start logging', 'Alt+3 to start · Alt+1 to capture image · Alt+G to log measurement'],
          ].map(([step, title, detail]) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="bg-green-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{step}</span>
              <div>
                <span className="text-white font-medium">{title}</span>
                <span className="text-gray-400"> — {detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <BookMarked className="w-4 h-4" />
            System Requirements
          </h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li><span className="text-gray-500 w-24 inline-block">Browser</span> Chrome or Edge (Serial port support built-in)</li>
            <li><span className="text-gray-500 w-24 inline-block">Connection</span> HTTPS or localhost</li>
            <li><span className="text-gray-500 w-24 inline-block">Hardware</span> USB laser + GPS with drivers installed</li>
            <li><span className="text-gray-500 w-24 inline-block">Permissions</span> Camera, location, serial port access</li>
            <li><span className="text-gray-500 w-24 inline-block">OS</span> Windows 10/11 (for LiDAR service)</li>
            <li><span className="text-gray-500 w-24 inline-block">Runtime</span> .NET 8 (for Pandar40P Windows service)</li>
          </ul>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Common Issues — Quick Fixes
          </h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li><span className="text-red-400 font-medium">Laser not connecting</span><br /><span className="text-gray-400 text-xs">Try a different USB port, verify power is on, check drivers in Device Manager</span></li>
            <li><span className="text-red-400 font-medium">GPS shows No Fix</span><br /><span className="text-gray-400 text-xs">Move outdoors with clear sky view, wait 1-2 min for first satellite lock</span></li>
            <li><span className="text-red-400 font-medium">Camera permission denied</span><br /><span className="text-gray-400 text-xs">Allow camera in browser site settings, ensure no other app is using the camera</span></li>
            <li><span className="text-red-400 font-medium">Data not syncing</span><br /><span className="text-gray-400 text-xs">Check internet connection, verify Firebase is configured in cloud settings</span></li>
          </ul>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <h3 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
            <ScanLine className="w-4 h-4" />
            Auto-Height POI Types
          </h3>
          <p className="text-xs text-gray-400 mb-2">The following POI types automatically record height clearance from the laser:</p>
          <div className="flex flex-wrap gap-1.5">
            {['Overhead Structure', 'Optical Fiber', 'Railroad', 'Signalization', 'Overpass', 'Traffic Light', 'Power Line', 'Bridge & Wires', 'Wire', 'Trees'].map(t => (
              <span key={t} className="bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">All other POI types are measurement-free (no auto height capture).</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <h3 className="font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            GPS Priority
          </h3>
          <p className="text-xs text-gray-400 mb-2">When multiple GPS sources are connected, priority is:</p>
          <ol className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span className="bg-cyan-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div><span className="text-white font-medium">Duro / GNSS (RTK)</span> <span className="text-xs text-cyan-400">— Highest accuracy</span></div>
            </li>
            <li className="flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div><span className="text-white font-medium">USB GPS</span> <span className="text-xs text-gray-400">— Takes over if Duro stops for 5s</span></div>
            </li>
            <li className="flex items-center gap-2">
              <span className="bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <div><span className="text-white font-medium">Bluetooth GPS</span> <span className="text-xs text-gray-400">— Fallback (serial or Web Bluetooth)</span></div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function DocCenter() {
  const [tab, setTab] = useState<DocTab>('documents');
  const navigate = useNavigate();

  const tabs: { id: DocTab; label: string; icon: React.ReactNode }[] = [
    { id: 'documents', label: 'All Documents', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'quickref', label: 'Quick Reference', icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/30 px-6 py-4 border-b border-gray-700 flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-blue-400" />
        <div>
          <h2 className="text-white font-bold text-lg">Documentation Center</h2>
          <p className="text-gray-400 text-xs">All guides, references, and keyboard shortcuts in one place</p>
        </div>
      </div>

      <div className="flex border-b border-gray-700 bg-gray-850">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? 'border-blue-500 text-blue-400 bg-blue-900/10'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-700/30'
            }`}
            data-testid={`tab-doccenter-${t.id}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'documents' && <DocumentsTab navigate={navigate} />}
        {tab === 'shortcuts' && <ShortcutsTab />}
        {tab === 'quickref' && <QuickRefTab />}
      </div>
    </div>
  );
}
