import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer, BookOpen } from 'lucide-react';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: black !important; font-size: 8.5pt; font-family: Arial, sans-serif; }
  .print-page { background: white !important; }
  .doc-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; }
  .card { border: 1px solid #999 !important; background: white !important; break-inside: avoid; page-break-inside: avoid; }
  h3, h4 { break-after: avoid; page-break-after: avoid; }
  .text-blue-400, .text-blue-300, .text-blue-200 { color: #1d4ed8 !important; }
  .text-green-400, .text-green-300, .text-green-200 { color: #15803d !important; }
  .text-yellow-400, .text-yellow-300, .text-yellow-200 { color: #92400e !important; }
  .text-purple-400, .text-purple-300, .text-purple-200 { color: #6d28d9 !important; }
  .text-violet-400, .text-violet-300, .text-violet-200 { color: #7c3aed !important; }
  .bg-violet-800 { background: #5b21b6 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .text-amber-400, .text-amber-300, .text-amber-200 { color: #92400e !important; }
  .text-red-400, .text-red-300, .text-red-200 { color: #991b1b !important; }
  .text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  .text-white { color: #111827 !important; }
  .bg-gray-800, .bg-gray-700, .bg-gray-900 { background: white !important; }
  .border-gray-700, .border-gray-600 { border-color: #d1d5db !important; }
  .kbd { border: 1px solid #374151 !important; background: #f3f4f6 !important; color: #111 !important; padding: 1px 4px !important; }
  .header-band { background: #1d4ed8 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head { background: #1e40af !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-green { background: #166534 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@page { size: letter portrait; margin: 1cm 1.25cm; }
`;

function Kbd({ k }: { k: string }) {
  return <kbd className="kbd bg-gray-700 border border-gray-600 px-1.5 py-0.5 rounded text-xs font-mono text-gray-200 whitespace-nowrap">{k}</kbd>;
}

const STARTUP_STEPS = [
  ['1', 'Power laser', '12V via cigarette lighter or 120V-to-12V converter'],
  ['2', 'USB-serial cable', 'Connect between laser and tablet'],
  ['3', 'Open app', 'Chrome or Edge → measure-pro.app'],
  ['4', 'Connect laser', 'Settings → Hardware → Laser → Select Port · Protocol: SolTec or RSA · Baud: 115,200'],
  ['5', 'Connect GPS', 'Settings → GPS → Connect'],
  ['6', 'Ground reference', 'Measure with tape from laser enclosure/sun shade junction to ground → enter in Settings → Laser → Ground Reference'],
  ['7', 'New survey', 'Survey Manager → New Survey'],
  ['8', 'Start logging', 'Alt+3 = start logging · Alt+1 = capture image · Alt+G = log measurement'],
];

const SHORTCUTS = [
  { group: 'General', color: 'text-blue-400', keys: [
    ['Alt+1', 'Capture image'],
    ['Alt+2', 'Clear alert'],
    ['Alt+C', 'Clear all captured images'],
    ['Alt+G', 'Log measurement'],
    ['Ctrl+Backspace', 'Delete last entry'],
    ['Alt+Shift+M', 'Manual log entry'],
  ]},
  { group: 'Logging', color: 'text-green-400', keys: [
    ['Alt+3', 'Start logging'],
    ['Alt+4', 'Stop logging'],
    ['Alt+5', 'Pause logging'],
    ['Alt+6', 'Resume logging'],
    ['Alt+M', 'Manual mode'],
    ['Alt+A', 'All data mode'],
    ['Alt+D', 'Detection mode (AI)'],
    ['Alt+V', 'Start / stop video'],
    ['Alt+Z', 'Clear all alerts'],
    ['Alt+7', 'Start GPS trace'],
  ]},
  { group: 'AI Detection (MeasurePRO+)', color: 'text-purple-400', keys: [
    ['Alt+7', 'Accept detection'],
    ['Alt+8', 'Reject detection'],
    ['Alt+9', 'Correct detection'],
    ['Alt+0', 'Test detection'],
    ['Alt+Shift+E', 'Toggle envelope monitoring'],
    ['Alt+Shift+P', 'Cycle vehicle profiles'],
  ]},
];

const POI_SHORTCUTS = [
  // --- Original types ---
  ['Alt+B', 'Bridge'], ['Alt+T', 'Trees'], ['Alt+W', 'Wire'], ['Alt+P', 'Power Line'],
  ['Alt+L', 'Traffic Light'], ['Alt+K', 'Overpass'], ['Alt+O', 'Lateral Obstruction'],
  ['Alt+R', 'Road'], ['Alt+I', 'Intersection'], ['Alt+U', 'Signalization'],
  ['Alt+Q', 'Railroad'], ['Alt+N', 'Information'], ['Alt+H', 'Danger'],
  ['Alt+J', 'Important Note'], ['Alt+F', 'Work Required'], ['Alt+X', 'Restricted'],
  ['Alt+Shift+B', 'Bridge & Wires'], ['Alt+Shift+O', 'Overhead Structure'],
  ['Alt+Shift+F', 'Optical Fiber'], ['Alt+Shift+U', 'Grade Up (12%+)'],
  ['Alt+Shift+D', 'Grade Down (12%+)'], ['Alt+Shift+A', 'Autoturn Required'],
  ['Alt+Shift+N', 'Voice Note'], ['Alt+Shift+L', 'Passing Lane'],
  ['Alt+Shift+K', 'Parking'], ['Alt+Shift+G', 'Gravel Road'],
  ['Alt+E', 'Dead End'], ['Alt+C', 'Culvert'],
  ['Alt+Shift+R', 'Emergency Parking'], ['Alt+Y', 'Roundabout'],
  // --- Power group ---
  ['Alt+Shift+H', 'Power No Slack'], ['Alt+Shift+V', 'Power Slack'], ['Alt+Shift+Q', 'High Voltage'],
  // --- Communication group ---
  ['Ctrl+Alt+C', 'Communication Cable'], ['Ctrl+Alt+D', 'Communication Cluster'],
  // --- Bridge/Overpass group ---
  ['Ctrl+Alt+P', 'Pedestrian Bridge'], ['Ctrl+Alt+M', 'Motorcycle Bridge'],
  ['Ctrl+Alt+T', 'Tunnel'], ['Ctrl+Alt+F', 'Flyover'],
  // --- Traffic group ---
  ['Ctrl+Alt+W', 'Traffic Wire'], ['Ctrl+Alt+X', 'Traffic Mast'], ['Ctrl+Alt+S', 'Traffic Signal Truss'],
  // --- Infrastructure group ---
  ['Ctrl+Alt+L', 'Toll Truss'], ['Ctrl+Alt+O', 'Toll Plaza'],
  ['Ctrl+Alt+R', 'Pipe Rack'], ['Ctrl+Alt+I', 'Light Pole'],
  // --- Railroad group ---
  ['Ctrl+Alt+J', 'Railroad Mast'], ['Ctrl+Alt+K', 'Railroad Truss'], ['Ctrl+Alt+Q', 'Railroad Crossing'],
  // --- Signage / VMS group ---
  ['Ctrl+Alt+G', 'Sign Mast'], ['Ctrl+Alt+H', 'Sign Truss'],
  ['Ctrl+Alt+V', 'VMS Truss'], ['Ctrl+Alt+B', 'VMS Mast'],
  // --- Road / Turn group ---
  ['Alt+Shift+I', 'Left Turn'], ['Alt+Shift+J', 'Right Turn'], ['Alt+Shift+T', 'U-Turn'],
  ['Alt+Shift+W', 'Highway Entrance'], ['Alt+Shift+X', 'Highway Exit'],
  // --- Notes / Log group ---
  ['Alt+Shift+Z', 'Clear Note'], ['Ctrl+Alt+N', 'Log Note'],
  ['Ctrl+Alt+E', 'Construction'], ['Ctrl+Alt+U', 'Gate'],
  // --- Measurement group ---
  ['Ctrl+Alt+Y', 'Pitch'], ['Ctrl+Alt+Z', 'Roll'],
  // --- Unpaved road ---
  ['Ctrl+Alt+2', 'Unpaved Road'],
];

const MULTI_LATERAL = [['Alt+[', 'Left lateral clearance POI'], ['Alt+]', 'Right lateral clearance POI'], ['Alt+\\', 'Total width POI'], ["Alt+'", 'Rear overhang POI']];

const AUTO_HEIGHT_POIS = [
  'overheadStructure', 'opticalFiber', 'railroad', 'signalization', 'overpass', 'trafficLight',
  'powerLine', 'bridgeAndWires', 'wire', 'tree',
  'powerNoSlack', 'powerSlack', 'highVoltage',
  'communicationCable', 'communicationCluster',
  'pedestrianBridge', 'motorcycleBridge', 'tunnel', 'flyover',
  'trafficWire', 'trafficMast', 'trafficSignalizationTruss',
  'tollTruss', 'pipeRack', 'lightPole',
  'railroadMast', 'railroadTruss',
  'signMast', 'signTruss', 'vmsTruss', 'vmsMast',
];

function printShortcutsOnly() {
  const rows = (arr: string[][]) =>
    arr.map(([k, l]) =>
      `<tr><td class="key">${k}</td><td class="lbl">${l}</td></tr>`
    ).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>MeasurePRO Keyboard Shortcuts</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 7.5pt; color: #111; background: white; }
  @page { size: letter portrait; margin: 0.7cm 0.9cm; }
  h1 { font-size: 11pt; font-weight: 900; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 2px; margin-bottom: 4px; letter-spacing: 0.03em; }
  .sub { font-size: 6.5pt; color: #6b7280; margin-bottom: 8px; }
  .layout { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .section { break-inside: avoid; page-break-inside: avoid; }
  h2 { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: white; background: #1d4ed8; padding: 2px 5px; border-radius: 2px; margin-bottom: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2.green { background: #15803d; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; vertical-align: top; line-height: 1.4; }
  td.key { font-family: monospace; font-size: 6.5pt; background: #f3f4f6; border: 1px solid #9ca3af; border-radius: 2px; white-space: nowrap; padding: 1px 3px; color: #111; font-weight: 600; width: 1%; }
  td.lbl { padding-left: 4px; color: #1f2937; }
  .grp { font-weight: 700; color: #1e40af; font-size: 6.5pt; margin: 3px 0 1px; text-transform: uppercase; letter-spacing: 0.06em; }
  .grp.green { color: #15803d; }
  .grp.purple { color: #6d28d9; }
  .grp.yellow { color: #92400e; }
  .poi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6px; }
  .poi-row { display: flex; gap: 3px; align-items: baseline; padding: 0.5px 0; }
  .poi-key { font-family: monospace; font-size: 6pt; background: #f3f4f6; border: 1px solid #9ca3af; border-radius: 2px; white-space: nowrap; padding: 0px 3px; color: #111; font-weight: 600; }
  .poi-lbl { font-size: 6.5pt; color: #1f2937; }
  .footer { margin-top: 8px; font-size: 6pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 4px; display: flex; justify-content: space-between; }
</style></head>
<body>
<h1>MeasurePRO — Keyboard Shortcut Reference Card</h1>
<div class="sub">SolTec Innovation &nbsp;·&nbsp; measure-pro.app &nbsp;·&nbsp; support@soltecinnovation.com</div>

<div class="layout">
  <!-- COL 1: General + Logging -->
  <div class="section">
    <h2>General</h2>
    <table>${rows([
      ['Alt+1', 'Capture image'],
      ['Alt+2', 'Clear alert'],
      ['Alt+C', 'Clear captured images'],
      ['Alt+G', 'Log measurement'],
      ['Ctrl+Bksp', 'Delete last entry'],
      ['Alt+Shift+M', 'Manual log entry'],
    ])}</table>
    <div class="grp green">Logging</div>
    <table>${rows([
      ['Alt+3', 'Start logging'],
      ['Alt+4', 'Stop logging'],
      ['Alt+5', 'Pause logging'],
      ['Alt+6', 'Resume logging'],
      ['Alt+M', 'Manual mode'],
      ['Alt+A', 'All data mode'],
      ['Alt+D', 'Detection mode (AI)'],
      ['Alt+V', 'Start / stop video'],
      ['Alt+Z', 'Clear all alerts'],
      ['Alt+7', 'Start GPS trace'],
    ])}</table>
    <div class="grp purple">AI Detection (MeasurePRO+)</div>
    <table>${rows([
      ['Alt+7', 'Accept detection'],
      ['Alt+8', 'Reject detection'],
      ['Alt+9', 'Correct detection'],
      ['Alt+0', 'Test detection'],
      ['Alt+Shift+E', 'Toggle envelope monitoring'],
      ['Alt+Shift+P', 'Cycle vehicle profiles'],
    ])}</table>
    <div class="grp yellow">Multi-Laser (Lateral / Rear)</div>
    <table>${rows([
      ['Alt+[', 'Left lateral clearance POI'],
      ['Alt+]', 'Right lateral clearance POI'],
      ['Alt+\\\\', 'Total width POI'],
      ["Alt+'", 'Rear overhang POI'],
    ])}</table>
  </div>

  <!-- COL 2+3: POI Shortcuts (spans two cols) -->
  <div class="section" style="grid-column: span 2;">
    <h2>POI Type Shortcuts</h2>
    <div class="poi-grid">
      ${POI_SHORTCUTS.map(([k, l]) =>
        `<div class="poi-row"><span class="poi-key">${k}</span><span class="poi-lbl">${l}</span></div>`
      ).join('')}
    </div>
    <div style="margin-top:4px;font-size:6pt;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:3px;">
      Key families: &nbsp;<strong>Alt+letter</strong> = basic types &nbsp;·&nbsp; <strong>Alt+Shift+letter</strong> = extended types &nbsp;·&nbsp; <strong>Ctrl+Alt+letter</strong> = advanced types
    </div>
  </div>
</div>

<div class="footer">
  <span>MeasurePRO · SolTec Innovation · © ${new Date().getFullYear()}</span>
  <span>measure-pro.app</span>
</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

export default function FieldReferencePage() {
  useEffect(() => { document.title = 'Field Reference Card — MeasurePRO'; }, []);

  return (
    <div className="print-page min-h-screen bg-gray-900 text-gray-100">
      <style>{PRINT_STYLES}</style>

      <div className="no-print sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <Link to="/docs" className="text-gray-300 hover:text-white flex items-center gap-2 text-sm" data-testid="link-back-field">
          <ArrowLeft className="w-4 h-4" /> Documents
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs hidden sm:block">Print on Letter · Laminate if desired</span>
          <button onClick={printShortcutsOnly}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            data-testid="button-print-shortcuts-card"
            title="Print a compact shortcuts-only reminder card (1 page)">
            <BookOpen className="w-4 h-4" /> Shortcuts Card
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            data-testid="button-print-field">
            <Printer className="w-4 h-4" /> Print All
          </button>
        </div>
      </div>

      <div className="doc-container max-w-4xl mx-auto px-6 py-6">

        {/* HEADER BAND */}
        <div className="doc-section header-band bg-blue-700 text-white rounded-t-lg px-5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-75 font-semibold tracking-widest uppercase">SolTec Innovation</div>
              <h1 className="text-xl font-black">Field Reference Card — MeasurePRO</h1>
            </div>
            <div className="text-right text-xs opacity-75">
              <div>measure-pro.app</div><div>support@soltecinnovation.com</div>
            </div>
          </div>
        </div>

        {/* STARTUP SEQUENCE */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3 mb-0">
          <div className="section-head bg-blue-800 text-white text-xs font-bold px-3 py-1 rounded mb-3 uppercase tracking-wide -mx-2">Startup Sequence</div>
          <div className="space-y-1.5">
            {STARTUP_STEPS.map(([n, title, detail]) => (
              <div key={n} className="flex gap-3 text-xs">
                <span className="text-blue-400 font-black text-sm w-4 shrink-0">{n}.</span>
                <div>
                  <span className="font-bold text-white">{title} — </span>
                  <span className="text-gray-300">{detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KEYBOARD SHORTCUTS */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3 mb-0">
          <div className="section-head bg-blue-800 text-white text-xs font-bold px-3 py-1 rounded mb-3 uppercase tracking-wide -mx-2">Keyboard Shortcuts</div>
          <div className="grid grid-cols-4 gap-x-5">
            {SHORTCUTS.map(group => (
              <div key={group.group}>
                <div className={`text-xs font-bold mb-1.5 ${group.color}`}>{group.group}</div>
                <div className="space-y-1">
                  {group.keys.map(([key, label]) => (
                    <div key={key} className="flex items-start gap-1.5 text-xs">
                      <Kbd k={key} /><span className="text-gray-200 leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="text-xs font-bold mb-1.5 text-yellow-400">Multi-Laser (Lateral/Rear)</div>
              <div className="space-y-1">
                {MULTI_LATERAL.map(([k, l]) => (
                  <div key={k} className="flex items-start gap-1.5 text-xs"><Kbd k={k} /><span className="text-gray-200">{l}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* POI SHORTCUTS */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3 mb-0">
          <div className="section-head bg-blue-800 text-white text-xs font-bold px-3 py-1 rounded mb-3 uppercase tracking-wide -mx-2">POI Type Shortcuts</div>
          <div className="grid grid-cols-6 gap-x-3 gap-y-1">
            {POI_SHORTCUTS.map(([k, l]) => (
              <div key={k} className="flex items-start gap-1.5 text-xs"><Kbd k={k} /><span className="text-gray-200">{l}</span></div>
            ))}
          </div>
          <div className="mt-2 text-gray-500 text-xs border-t border-gray-700 pt-1.5">
            <span className="font-semibold text-gray-400">Key families: </span>
            Alt+letter = basic types · Alt+Shift+letter = extended types · Ctrl+Alt+letter = advanced types
          </div>
        </div>

        {/* VOICE COMMANDS QUICK REFERENCE */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3 mb-0">
          <div className="section-head bg-violet-800 text-white text-xs font-bold px-3 py-1 rounded mb-3 uppercase tracking-wide -mx-2">Voice Commands — Quick Reference</div>
          <div className="grid grid-cols-4 gap-x-5 text-xs">
            <div>
              <div className="text-violet-400 font-bold mb-1">Status Queries</div>
              <div className="space-y-0.5 text-gray-300">
                {['"last measurement"', '"GPS location"', '"laser status"', '"fix quality"', '"speed"'].map(c => <div key={c}>{c}</div>)}
              </div>
            </div>
            <div>
              <div className="text-green-400 font-bold mb-1">Actions & Logging</div>
              <div className="space-y-0.5 text-gray-300">
                {['"capture image"', '"log measurement"', '"record note"', '"start logging"', '"stop logging"', '"clear all alerts"'].map(c => <div key={c}>{c}</div>)}
              </div>
            </div>
            <div>
              <div className="text-blue-400 font-bold mb-1">Modes & Video</div>
              <div className="space-y-0.5 text-gray-300">
                {['"manual mode"', '"all data mode"', '"detection mode"', '"toggle video"', '"start GPS trace"'].map(c => <div key={c}>{c}</div>)}
              </div>
            </div>
            <div>
              <div className="text-yellow-400 font-bold mb-1">Audio & POI</div>
              <div className="space-y-0.5 text-gray-300">
                {['"volume up / down"', '"clear warnings"', '"bridge"  "tunnel"', '"railroad"  "wire"', '"power line"  "sign"'].map(c => <div key={c}>{c}</div>)}
              </div>
              <div className="mt-2 text-gray-500">65+ commands · EN / FR / ES</div>
              <div className="text-gray-600">Full list: /docs/voice-commands</div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="doc-section grid grid-cols-3 gap-0">
          <div className="card bg-gray-800 border border-gray-700 border-t-0 border-r-0 px-4 py-3">
            <div className="section-head-green bg-green-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-1">POI — Auto Height Capture</div>
            <div className="space-y-0.5 text-xs text-gray-300">
              {AUTO_HEIGHT_POIS.map(t => (
                <div key={t} className="flex items-center gap-1.5"><span className="text-green-400">✓</span><span className="font-mono">{t}</span></div>
              ))}
              <div className="mt-1.5 text-gray-500 text-xs">All others: GPS + photo only (no laser)</div>
              <div className="text-gray-500 text-xs mt-0.5">Auto-photo: railroad · intersection · road · bridge · danger · railroadCrossing</div>
              <div className="text-gray-500 text-xs mt-0.5">Modal: information · workRequired · importantNote · lateralObstruction · restricted · clearNote · logNote</div>
            </div>
          </div>

          <div className="card bg-gray-800 border border-gray-700 border-t-0 border-r-0 px-4 py-3">
            <div className="section-head-green bg-green-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-1">Laser — Quick Reference</div>
            <div className="space-y-2 text-xs text-gray-300">
              <div>
                <div className="text-white font-semibold">Vertical Laser</div>
                <div>SolTec / RSA / LDM71 · 115,200 baud 8N1 · ±2 mm</div>
                <div className="text-gray-500 text-xs">LDM71 = ASCII output. RSA = 3-byte binary. Select protocol in Settings → Laser Protocol. Symptom of wrong protocol: all 0.000 m.</div>
              </div>
              <div className="border-t border-gray-700 pt-1.5">
                <div className="text-white font-semibold">Multi-Laser (Lateral / Rear)</div>
                <div>19,200 baud · 7E1 (7 data bits, Even parity, 1 stop)</div>
              </div>
              <div className="border-t border-gray-700 pt-1.5">
                <div className="text-white font-semibold">Measurement Modes</div>
                <div className="text-gray-500">Normal · Fast · Precise · Natural Surface · Continuous</div>
                <div className="text-gray-500 text-xs">Settings → Laser → Measurement Mode</div>
              </div>
              <div className="border-t border-gray-700 pt-1.5">
                <div className="text-white font-semibold">Ground Reference</div>
                <div className="text-gray-400">Tape from laser enclosure/sun shade junction to ground → Settings → Laser → Ground Reference.</div>
              </div>
              <div className="border-t border-gray-700 pt-1.5">
                <div className="text-white font-semibold">Filter Thresholds (from ground)</div>
                <div>ignoreAbove: <span className="text-blue-400">20 m</span></div>
                <div>ignoreBelow: <span className="text-blue-400">0.5 m</span> — increase in rain</div>
              </div>
            </div>
          </div>

          <div className="card bg-gray-800 border border-gray-700 border-t-0 px-4 py-3">
            <div className="section-head-green bg-green-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-1">GPS Priority</div>
            <div className="space-y-1.5 text-xs text-gray-300 mb-3">
              {[['1', 'text-green-400', 'Swift Duro (RTK)', '±1–5 cm · Highest priority'],['2', 'text-blue-400', 'USB / Serial GPS', '2–10 m · Active if Duro silent >5 s'],['3', 'text-yellow-400', 'Bluetooth GPS', '2–10 m · Third source'],['4', 'text-gray-400', 'Browser Geolocation', '3–15 m · Last resort only']].map(([n, c, name, note]) => (
                <div key={n} className="flex gap-1.5">
                  <span className={`font-black w-4 ${c}`}>{n}.</span>
                  <div><div className="font-semibold text-white leading-tight">{name}</div><div className="text-gray-500">{note}</div></div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700 pt-2">
              <div className="text-white font-semibold text-xs mb-1">Support</div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <div>support@soltecinnovation.com</div><div>measure-pro.app/help</div><div>measure-pro.app/docs</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 border-t-0 rounded-b-lg px-5 py-2 flex justify-between text-xs text-gray-500">
          <span>MeasurePRO · SolTec Innovation · © {new Date().getFullYear()}</span>
          <span>measure-pro.app · support@soltecinnovation.com</span>
        </div>
      </div>
    </div>
  );
}
