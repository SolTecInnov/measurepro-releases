import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: black !important; font-size: 10.5pt; font-family: Arial, sans-serif; }
  .print-page { background: white !important; color: black !important; }
  .doc-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10pt; }
  .card { border: 1px solid #ccc !important; background: white !important; break-inside: avoid; page-break-inside: avoid; }
  h3, h4 { break-after: avoid; page-break-after: avoid; }
  .step-row { break-inside: avoid; page-break-inside: avoid; }
  .text-blue-600, .text-blue-500, .text-blue-400, .text-blue-300, .text-blue-200 { color: #1d4ed8 !important; }
  .text-green-600, .text-green-500, .text-green-400, .text-green-300, .text-green-200 { color: #15803d !important; }
  .text-amber-600, .text-amber-500, .text-amber-400, .text-amber-300, .text-amber-200 { color: #92400e !important; }
  .text-red-600, .text-red-500, .text-red-400, .text-red-300, .text-red-200 { color: #991b1b !important; }
  .text-purple-400, .text-purple-300, .text-purple-200 { color: #6d28d9 !important; }
  .text-yellow-400, .text-yellow-300, .text-yellow-200 { color: #92400e !important; }
  .text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  .text-white { color: #111827 !important; }
  .bg-gray-800, .bg-gray-700, .bg-gray-900 { background: #f9fafb !important; }
  .border-gray-700, .border-gray-600 { border-color: #d1d5db !important; }
  .header-bar { border-bottom: 2pt solid #1d4ed8 !important; margin-bottom: 12pt !important; padding-bottom: 6pt !important; }
  .step-num { border: 2px solid #1d4ed8 !important; color: #1d4ed8 !important; }
  .kbd { border: 1px solid #374151 !important; background: #f3f4f6 !important; color: #111 !important; }
  .warning-box { background: #fffbeb !important; border: 1px solid #d97706 !important; }
  .info-box { background: #eff6ff !important; border: 1px solid #1d4ed8 !important; }
  .success-box { background: #f0fdf4 !important; border: 1px solid #15803d !important; }
}
@page { size: letter portrait; margin: 1.25cm 1.5cm; }
`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="step-row flex gap-4 mb-4">
      <div className="step-num w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-400 font-black text-sm shrink-0 mt-0.5">{n}</div>
      <div className="flex-1">
        <div className="font-bold text-white text-sm leading-tight mb-1">{title}</div>
        <div className="text-gray-300 text-xs space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Kbd({ k }: { k: string }) {
  return <kbd className="kbd bg-gray-700 border border-gray-600 px-1.5 py-0.5 rounded text-xs font-mono text-gray-200 whitespace-nowrap">{k}</kbd>;
}

function Box({ type = 'info', children }: { type?: 'info' | 'warn' | 'ok'; children: React.ReactNode }) {
  const cls = {
    info: 'info-box bg-blue-900/30 border border-blue-700/50 text-blue-200',
    warn: 'warning-box bg-amber-900/30 border border-amber-700/50 text-amber-200',
    ok: 'success-box bg-green-900/30 border border-green-700/50 text-green-200',
  }[type];
  return <div className={`rounded p-2 text-xs mt-1 ${cls}`}>{children}</div>;
}

const SHORTCUTS_GENERAL = [
  ['Alt+1', 'Capture image'],
  ['Alt+2', 'Clear alert'],
  ['Alt+G', 'Log measurement'],
  ['Ctrl+Backspace', 'Delete last entry'],
  ['Alt+Shift+M', 'Manual log entry modal'],
];
const SHORTCUTS_LOGGING = [
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
];
const SHORTCUTS_POI = [
  // Basic types (Alt+letter)
  ['Alt+B', 'Bridge'], ['Alt+T', 'Trees'], ['Alt+W', 'Wire'], ['Alt+P', 'Power Line'],
  ['Alt+L', 'Traffic Light'], ['Alt+K', 'Overpass'], ['Alt+O', 'Lateral Obstruction'],
  ['Alt+R', 'Road'], ['Alt+I', 'Intersection'], ['Alt+U', 'Signalization'],
  ['Alt+Q', 'Railroad'], ['Alt+N', 'Information'], ['Alt+H', 'Danger'],
  ['Alt+J', 'Important Note'], ['Alt+F', 'Work Required'], ['Alt+X', 'Restricted'],
  ['Alt+E', 'Dead End'], ['Alt+C', 'Culvert'], ['Alt+Y', 'Roundabout'],
  // Extended types (Alt+Shift+letter)
  ['Alt+Shift+B', 'Bridge & Wires'], ['Alt+Shift+O', 'Overhead Structure'],
  ['Alt+Shift+F', 'Optical Fiber'], ['Alt+Shift+U', 'Grade Up (12%+)'],
  ['Alt+Shift+D', 'Grade Down (12%+)'], ['Alt+Shift+A', 'Autoturn Required'],
  ['Alt+Shift+N', 'Voice Note'], ['Alt+Shift+L', 'Passing Lane'],
  ['Alt+Shift+K', 'Parking'], ['Alt+Shift+G', 'Gravel Road'],
  ['Alt+Shift+R', 'Emergency Parking'],
  ['Alt+Shift+H', 'Power No Slack'], ['Alt+Shift+V', 'Power Slack'], ['Alt+Shift+Q', 'High Voltage'],
  ['Alt+Shift+I', 'Left Turn'], ['Alt+Shift+J', 'Right Turn'], ['Alt+Shift+T', 'U-Turn'],
  ['Alt+Shift+W', 'Highway Entrance'], ['Alt+Shift+X', 'Highway Exit'], ['Alt+Shift+Z', 'Clear Note'],
  // Advanced types (Ctrl+Alt+letter/number)
  ['Ctrl+Alt+C', 'Communication Cable'], ['Ctrl+Alt+D', 'Communication Cluster'],
  ['Ctrl+Alt+P', 'Pedestrian Bridge'], ['Ctrl+Alt+M', 'Motorcycle Bridge'],
  ['Ctrl+Alt+T', 'Tunnel'], ['Ctrl+Alt+F', 'Flyover'],
  ['Ctrl+Alt+W', 'Traffic Wire'], ['Ctrl+Alt+X', 'Traffic Mast'], ['Ctrl+Alt+S', 'Traffic Signal Truss'],
  ['Ctrl+Alt+L', 'Toll Truss'], ['Ctrl+Alt+O', 'Toll Plaza'], ['Ctrl+Alt+R', 'Pipe Rack'], ['Ctrl+Alt+I', 'Light Pole'],
  ['Ctrl+Alt+J', 'Railroad Mast'], ['Ctrl+Alt+K', 'Railroad Truss'], ['Ctrl+Alt+Q', 'Railroad Crossing'],
  ['Ctrl+Alt+G', 'Sign Mast'], ['Ctrl+Alt+H', 'Sign Truss'], ['Ctrl+Alt+V', 'VMS Truss'], ['Ctrl+Alt+B', 'VMS Mast'],
  ['Ctrl+Alt+N', 'Log Note'], ['Ctrl+Alt+E', 'Construction'], ['Ctrl+Alt+U', 'Gate'],
  ['Ctrl+Alt+Y', 'Pitch'], ['Ctrl+Alt+Z', 'Roll'], ['Ctrl+Alt+2', 'Unpaved Road'],
];

export default function LaserQuickStartPage() {
  useEffect(() => { document.title = 'Laser Quick Start Guide — MeasurePRO'; }, []);

  return (
    <div className="print-page min-h-screen bg-gray-900 text-gray-100">
      <style>{PRINT_STYLES}</style>

      <div className="no-print sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <Link to="/docs" className="text-gray-300 hover:text-white flex items-center gap-2 text-sm" data-testid="link-back-laser">
          <ArrowLeft className="w-4 h-4" /> Documents
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          data-testid="button-print-laser">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="doc-container max-w-3xl mx-auto px-8 py-8">

        {/* HEADER */}
        <div className="doc-section header-bar border-b-2 border-blue-600 pb-4 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-blue-400 font-semibold tracking-widest uppercase mb-1">SolTec Innovation · measure-pro.app</div>
              <h1 className="text-2xl font-black text-white">Quick Start Guide</h1>
              <h2 className="text-xl font-bold text-blue-400">MeasurePRO LiDAR Kit</h2>
            </div>
            <div className="text-right text-xs text-gray-500"><div>Version 1.0</div></div>
          </div>
        </div>

        {/* KIT CONTENTS */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-white mb-3 text-sm">📦 Kit Contents</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-300">
            {['SolTec vertical laser distance meter', 'USB-to-serial cable (RS-232)', '120V-to-12V converter', 'Mounting bracket and sun shade', 'This guide', 'Field reference card'].map(item => (
              <div key={item} className="flex items-center gap-2 py-0.5">
                <span className="text-blue-400 font-bold">✓</span><span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SUPPORTED DEVICES */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-white mb-2 text-sm">Supported Laser Devices</h3>
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
            {[['SolTec-10m', 'SolTec protocol · 115,200 baud'], ['SolTec-30m', 'SolTec protocol · 115,200 baud'], ['SolTec-70m', 'SolTec protocol · 115,200 baud'], ['SolTec-2700', 'SolTec protocol · 115,200 baud'], ['RSA High Pole Laser', 'RSA protocol · 115,200 baud'], ['LDM71', 'ASCII output · 115,200 baud · ±1 mm'], ['Mock mode', 'Simulated — demos & testing']].map(([name, detail]) => (
              <div key={name} className="bg-gray-900/40 rounded p-2">
                <div className="font-semibold text-white text-xs">{name}</div>
                <div className="text-gray-500 text-xs">{detail}</div>
              </div>
            ))}
          </div>
          <Box type="info">LDM71 outputs ASCII distance strings. Select "LDM71" in Settings → Hardware → Laser → Protocol. Baud: 115,200 · Framing: 8N1. If readings show exactly 0.000 m, verify you have selected the correct protocol — RSA uses 3-byte binary; LDM71 uses ASCII.</Box>
        </div>

        {/* MEASUREMENT MODES */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-white mb-3 text-sm">Measurement Modes</h3>
          <div className="space-y-2 text-xs text-gray-300">
            {[
              ['Normal', 'Default balanced mode. Good for most survey conditions. Updates every ~100 ms.'],
              ['Fast', 'Higher update rate (~50 ms). Lower averaging — slightly noisier. Use at higher speeds (>40 km/h) to maintain spatial density.'],
              ['Precise', 'Longer integration time — maximum accuracy. Use at slow speeds (<10 km/h) near critical structures.'],
              ['Natural Surface', 'Optimised for irregular or vegetated targets (gravel, grass, leaves). Accepts weaker returns.'],
              ['Continuous', 'Streams readings as fast as the hardware allows (hardware-dependent). Use for stationary scans or slow passes.'],
            ].map(([mode, desc]) => (
              <div key={mode} className="bg-gray-900/40 rounded p-2">
                <div className="font-semibold text-white text-xs mb-0.5">{mode}</div>
                <div className="text-gray-400">{desc}</div>
              </div>
            ))}
          </div>
          <Box type="info">Change mode in Settings → Laser → Measurement Mode. Mode is saved per device profile.</Box>
        </div>

        {/* GETTING STARTED */}
        <div className="doc-section mb-4">
          <h3 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Getting Started</h3>

          <Step n={1} title="Power the laser">
            <p>Connect the 12V power cable from the laser to the vehicle supply using the <strong className="text-white">cigarette lighter adapter</strong> or the <strong className="text-white">120V-to-12V converter</strong> included in your kit. The laser powers on and begins streaming automatically — no initialization command required.</p>
            <Box type="ok">✓ Power LED on = laser active and streaming</Box>
          </Step>

          <Step n={2} title="Connect the USB-to-serial cable">
            <p>Plug the USB-to-serial cable between the laser and the tablet or laptop. Windows installs the driver automatically (CH340, CP2102, or FTDI depending on the cable).</p>
            <Box type="info">If the COM port does not appear, check <strong>Device Manager → Ports (COM &amp; LPT)</strong>.</Box>
          </Step>

          <Step n={3} title="Install MeasurePRO">
            <p>In Chrome or Edge, navigate to <strong className="text-white">measure-pro.app</strong>. Sign in with your provided credentials. To install: click the <strong className="text-white">three-dot menu (...)</strong> → <strong className="text-white">More tools</strong> → <strong className="text-white">Apps</strong> → <strong className="text-white">Install this app</strong>.</p>
            <Box type="warn">⚠ Web Serial API requires Chrome or Edge. Safari and Firefox are not supported.</Box>
          </Step>

          <Step n={4} title="Connect the laser in the app">
            <p>Open <strong className="text-white">Settings → Hardware → Laser</strong>. Click <strong className="text-white">Select Port</strong>. Choose the port labelled "USB Serial Port" (usually COM3–COM8 on Windows). Select the protocol matching your laser and set baud rate to <strong className="text-white">115,200</strong>.</p>
            <Box type="info">MeasurePRO only reads the serial stream — it never sends commands to the laser. The laser must be powered before connecting.</Box>
          </Step>

          <Step n={5} title="Set the ground reference">
            <p>The ground reference is a <strong className="text-white">physical tape measurement</strong> — not a software calibration:</p>
            <ol className="list-decimal list-inside space-y-0.5 mt-1 ml-1">
              <li>Mount the laser pointing <strong className="text-white">straight up, 90° from the ground</strong></li>
              <li>Using a measuring tape, measure from the <strong className="text-white">junction of the laser enclosure and the sun shade</strong> (lens protector) down to the ground</li>
              <li>Enter this measurement in <strong className="text-white">Settings → Laser → Ground Reference</strong></li>
            </ol>
            <Box type="ok">✓ Re-measure and update any time the laser is repositioned or moved to a different vehicle</Box>
          </Step>

          <Step n={6} title="Start your survey">
            <p>Open <strong className="text-white">Survey Manager → New Survey</strong>. Fill in surveyor name, client, and project number. Press <Kbd k="Alt+3" /> to start logging. Press <Kbd k="Alt+1" /> to capture an image, <Kbd k="Alt+G" /> to log a measurement.</p>
          </Step>
        </div>

        {/* AMPLITUDE FILTER */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Amplitude Filter (Signal Quality)</h4>
          <div className="space-y-2 text-xs text-gray-300">
            <p>The amplitude filter discards returns whose reflected signal strength falls below a threshold (dBm). Prevents weak/noisy reads from polluting the survey.</p>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-amber-400 font-semibold mb-1">Increase threshold when:</div>
                <ul className="space-y-0.5">
                  <li>• Rain or dusty conditions</li>
                  <li>• False returns from foliage</li>
                  <li>• Random noisy spikes at short range</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-blue-400 font-semibold mb-1">Decrease threshold when:</div>
                <ul className="space-y-0.5">
                  <li>• Dark asphalt surfaces</li>
                  <li>• Targets at maximum range</li>
                  <li>• Valid readings being rejected</li>
                  <li>• Direct sunlight (LDM71)</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-green-400 font-semibold mb-1">Configure at:</div>
                <p>Settings → Laser → Amplitude Filter</p>
                <p className="text-gray-500 mt-1">Enable auto-mode to let the system self-adjust based on signal history.</p>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER THRESHOLDS + MULTI-LASER */}
        <div className="doc-section grid grid-cols-2 gap-4 mb-4">
          <div className="card bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Filter Thresholds</h4>
            <div className="space-y-2 text-xs text-gray-300">
              <p className="text-gray-400 text-xs italic">Values are from ground level — the ground reference is already applied.</p>
              <div>
                <div className="font-semibold text-amber-400">ignoreAbove (default: 20 m)</div>
                <p>Rejects readings above this height from ground. Increase if structures exceed 20 m.</p>
              </div>
              <div>
                <div className="font-semibold text-amber-400">ignoreBelow (default: 0.5 m)</div>
                <p>Rejects readings below this height from ground. Increase to 2–3 m in rainy conditions.</p>
              </div>
              <Box type="info">Settings → Laser → Filter Thresholds</Box>
            </div>
          </div>

          <div className="card bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Multi-Laser — Wiring & Port Setup</h4>
            <div className="space-y-2 text-xs text-gray-300">
              <p>Each lateral/rear laser connects via its own USB-to-serial adapter directly to the tablet. <strong className="text-white">Label each USB port</strong> (L / R / REAR) to avoid port confusion.</p>
              <div className="space-y-1 mt-1">
                <div className="flex items-center gap-2"><span className="text-yellow-400 font-bold w-10">L/R</span><span>Bumper or side-rail mount, beam pointing horizontally outward</span></div>
                <div className="flex items-center gap-2"><span className="text-blue-400 font-bold w-10">REAR</span><span>Rear of vehicle, beam pointing straight rearward (wind blade tip monitoring, max 80 m)</span></div>
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {[['Alt+[', 'Left lateral POI'], ['Alt+]', 'Right lateral POI'], ['Alt+\\', 'Total width POI'], ["Alt+'", 'Rear overhang POI']].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <Kbd k={key} /><span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>
              <Box type="info">Protocol: SolTec-10m · <strong>19,200 baud · 7-E-1</strong> (7 data bits, Even parity, 1 stop)<br />Assign ports: Settings → Multi-Laser → assign Left / Right / Rear to each COM port<br />Vehicle offset: Settings → Lateral Laser → enter vehicle half-width</Box>
            </div>
          </div>
        </div>

        {/* KEYBOARD SHORTCUTS */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Keyboard Shortcuts</h4>
          <div className="grid grid-cols-3 gap-x-5 gap-y-0">
            <div>
              <div className="text-xs font-bold text-blue-400 mb-2">General</div>
              <div className="space-y-1">
                {SHORTCUTS_GENERAL.map(([k, l]) => (
                  <div key={k} className="flex items-start gap-1.5 text-xs"><Kbd k={k} /><span className="text-gray-300">{l}</span></div>
                ))}
              </div>
              <div className="text-xs font-bold text-green-400 mb-2 mt-3">Logging</div>
              <div className="space-y-1">
                {SHORTCUTS_LOGGING.map(([k, l]) => (
                  <div key={k} className="flex items-start gap-1.5 text-xs"><Kbd k={k} /><span className="text-gray-300">{l}</span></div>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs font-bold text-purple-400 mb-2">POI Types</div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                {SHORTCUTS_POI.map(([k, l]) => (
                  <div key={k} className="flex items-start gap-1.5 text-xs"><Kbd k={k} /><span className="text-gray-300">{l}</span></div>
                ))}
              </div>
              <div className="mt-1.5 text-gray-500 text-xs">Alt+letter = basic · Alt+Shift+letter = extended · Ctrl+Alt+letter = advanced</div>
            </div>
          </div>
        </div>

        {/* POI TYPES */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">POI Types — Auto Height Capture</h4>
          <div className="grid grid-cols-3 gap-x-6 text-xs text-gray-300 mb-2">
            <div className="space-y-1">{['overheadStructure','opticalFiber','railroad','signalization','overpass','trafficLight','powerLine','bridgeAndWires','wire','tree','powerNoSlack'].map(t=><div key={t} className="flex items-center gap-2"><span className="text-green-400">✓</span>{t}</div>)}</div>
            <div className="space-y-1">{['powerSlack','highVoltage','communicationCable','communicationCluster','pedestrianBridge','motorcycleBridge','tunnel','flyover','trafficWire','trafficMast','trafficSignalizationTruss'].map(t=><div key={t} className="flex items-center gap-2"><span className="text-green-400">✓</span>{t}</div>)}</div>
            <div className="space-y-1">{['tollTruss','pipeRack','lightPole','railroadMast','railroadTruss','signMast','signTruss','vmsTruss','vmsMast'].map(t=><div key={t} className="flex items-center gap-2"><span className="text-green-400">✓</span>{t}</div>)}</div>
          </div>
          <Box type="info">All other POI types capture GPS + photo only — no automatic laser reading.<br /><strong>Auto-photo trigger:</strong> railroad · intersection · road · bridge · danger · railroadCrossing<br /><strong>Modal dialog:</strong> information · workRequired · importantNote · lateralObstruction · restricted · clearNote · logNote</Box>
        </div>

        {/* TROUBLESHOOTING */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Quick Troubleshooting</h4>
          <div className="space-y-2 text-xs text-gray-300">
            {[
              ['No reading', 'Check 12V power · Reseat USB cable · Verify correct COM port is selected'],
              ['COM port not appearing', 'Install USB-serial driver (CH340 / CP2102 / FTDI) — check Device Manager'],
              ['Unstable readings', 'Rain: increase ignoreBelow · Dark surface: apply retroreflective sticker'],
              ['Readings too high or too low', 'Re-measure ground reference (tape from enclosure/sun shade junction to ground) and re-enter value'],
              ['Wrong baud rate error', 'Set baud rate to 115,200 for all SolTec and RSA vertical lasers'],
            ].map(([prob, sol]) => (
              <div key={prob} className="bg-gray-900/40 rounded p-2">
                <div className="font-semibold text-amber-300 mb-0.5">{prob}</div>
                <div className="text-gray-400">{sol}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 text-xs text-gray-500 flex justify-between">
          <span>SolTec Innovation · support@soltec.ca · measure-pro.app</span>
          <span>LiDAR Kit — Quick Start Guide</span>
        </div>
      </div>
    </div>
  );
}
