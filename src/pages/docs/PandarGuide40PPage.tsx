import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { SectionCard, TipBox, WarningBox } from './components';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: black !important; font-size: 10.5pt; font-family: Arial, sans-serif; }
  .print-page { background: white !important; color: black !important; }
  .doc-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10pt; }
  .manual-card { border: 1px solid #ccc !important; background: white !important; break-inside: avoid; page-break-inside: avoid; }
  h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  .step-row { break-inside: avoid; page-break-inside: avoid; }
  .text-blue-400, .text-blue-300 { color: #1d4ed8 !important; }
  .text-green-400, .text-green-300 { color: #15803d !important; }
  .text-amber-400, .text-amber-300 { color: #92400e !important; }
  .text-red-400, .text-red-300 { color: #991b1b !important; }
  .text-purple-400, .text-purple-300 { color: #6d28d9 !important; }
  .text-cyan-400, .text-cyan-300 { color: #0e7490 !important; }
  .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  .text-white { color: #111827 !important; }
  .bg-gray-800\/50, .bg-gray-800, .bg-gray-700, .bg-gray-900 { background: #f9fafb !important; }
  .border-gray-700, .border-gray-600 { border-color: #d1d5db !important; }
  .header-bar { border-bottom: 2pt solid #7c3aed !important; margin-bottom: 12pt !important; padding-bottom: 6pt !important; }
  .step-num { border: 2px solid #7c3aed !important; color: #7c3aed !important; }
  .bg-amber-900\/20 { background: #fffbeb !important; }
  .border-amber-700 { border-color: #d97706 !important; }
  .bg-blue-900\/20 { background: #eff6ff !important; }
  .border-blue-700 { border-color: #1d4ed8 !important; }
  .mono-block { background: #f3f4f6 !important; border: 1px solid #d1d5db !important; color: #111 !important; }
  .screenshot-img { max-width: 5in !important; width: auto !important; height: auto !important; max-height: 3.5in !important; display: block !important; margin: 0 auto !important; border: 1px solid #d1d5db !important; }
}
@page { size: letter portrait; margin: 1.25cm 1.5cm; }
`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="step-row flex gap-4 mb-4">
      <div className="step-num w-8 h-8 rounded-full border-2 border-purple-500 flex items-center justify-center text-purple-400 font-black text-sm shrink-0 mt-0.5">{n}</div>
      <div className="flex-1">
        <div className="font-bold text-white text-sm leading-tight mb-1">{title}</div>
        <div className="text-gray-300 text-sm space-y-1">{children}</div>
      </div>
    </div>
  );
}

function MonoBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mono-block bg-gray-900/60 border border-gray-600 rounded p-3 text-xs font-mono text-cyan-300 my-2 whitespace-pre-wrap">{children}</pre>
  );
}

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

export default function PandarGuide40PPage() {
  useEffect(() => { document.title = 'Pandar40P Guide — MeasurePRO'; }, []);

  return (
    <div className="print-page min-h-screen bg-gray-950 text-gray-100">
      <style>{PRINT_STYLES}</style>

      <div className="no-print sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <Link to="/docs" className="text-gray-300 hover:text-white flex items-center gap-2 text-sm" data-testid="link-back-pandar">
          <ArrowLeft className="w-4 h-4" /> Documents
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          data-testid="button-print-pandar">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="doc-container max-w-4xl mx-auto px-6 py-8">

        {/* HEADER */}
        <div className="doc-section header-bar border-b-2 border-purple-600 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-purple-400 font-semibold tracking-widest uppercase mb-1">SolTec Innovation · measure-pro.app</div>
              <h1 className="text-3xl font-black text-white">User Guide</h1>
              <h2 className="text-xl font-bold text-purple-400">Hesai Pandar40P — 3D LiDAR Scanner</h2>
            </div>
            <div className="text-right text-xs text-gray-500 mt-1"><div>Version 1.0</div></div>
          </div>
          <p className="text-sm text-gray-400 mt-3">This guide covers physical connection, network configuration, Windows service installation, and the three capture modes in MeasurePRO.</p>
        </div>

        {/* PART 1: REQUIRED HARDWARE */}
        <div className="doc-section mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Part 1 — Required Hardware</h2>
          <SectionCard>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-300">
              {[
                'Hesai Pandar40P sensor (with Lemo power cable)',
                '12 V power box (included in kit)',
                'Cat 5e or Cat 6 Ethernet cable (min. 1 m)',
                'Windows 10/11 laptop or tablet',
                'USB-C Ethernet adapter if needed',
                'Windows administrator access on the machine',
                '.NET 8 Runtime (free download)',
                'Chrome or Edge (latest version) for MeasurePRO',
              ].map(item => (
                <div key={item} className="flex items-start gap-2 py-0.5">
                  <span className="text-purple-400 font-bold shrink-0 mt-0.5">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <WarningBox>
              MeasurePRO <strong>Plus</strong> subscription or higher required for 3D LiDAR scanner access.
            </WarningBox>
          </SectionCard>
        </div>

        {/* PART 2: PHYSICAL CONNECTION & NETWORK */}
        <div className="doc-section mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Part 2 — Physical Connection and Network Configuration</h2>

          <SectionCard>
            <h3 className="text-lg font-semibold text-white mb-3">Wiring Diagram</h3>
            <MonoBlock>{`  [Pandar40P]
       │
       │  Lemo → Lemo cable (power + data)
       ▼
  [12 V Power Box]
       │
       │  Ethernet cable (RJ45)
       ▼
  [PC Ethernet Adapter]
       │
       ▼
  [Windows Computer]
  └── MeasurePRO LiDAR Service (port 17777)
       │ WebSocket
       ▼
  [MeasurePRO PWA – Chrome/Edge]`}</MonoBlock>
            <p className="text-gray-400 text-sm mt-2">The Pandar40P communicates only via Ethernet — there is no USB connection.</p>
          </SectionCard>

          <SectionCard>
            <h3 className="text-lg font-semibold text-white mb-4">Connection Steps</h3>

            <Step n={1} title="Connect the Lemo cable to the Pandar40P">
              <p>Plug the <strong className="text-white">Lemo-to-Lemo cable</strong> between the sensor and the 12 V power box included in the kit. This cable carries both power and data.</p>
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 my-2 text-green-300 text-sm">
                ✓ The Pandar40P fan starts and runs continuously when powered.
              </div>
            </Step>

            <Step n={2} title="Connect the Ethernet cable between the power box and the PC">
              <p>Plug a <strong className="text-white">Cat 5e or Cat 6</strong> Ethernet cable from the RJ45 port on the power box to your computer's Ethernet port (or a USB-Ethernet adapter).</p>
              <WarningBox>
                The Pandar40P must be connected <strong>directly</strong> to the PC's Ethernet card — not via a switch or home router.
              </WarningBox>
            </Step>

            <Step n={3} title="Set a static IP address on the PC">
              <p>The Pandar40P's default IP address is <strong className="text-white">192.168.1.201</strong>. Configure the PC's Ethernet adapter on the same subnet:</p>
              <MonoBlock>{`Control Panel → Network and Internet
  → Network Connections → right-click Ethernet
  → Properties → Internet Protocol Version 4 (TCP/IPv4)
  → Use the following IP address:

  IP Address     : 192.168.1.100
  Subnet Mask    : 255.255.255.0
  Default Gateway: (leave blank)`}</MonoBlock>
              <TipBox>
                Avoid addresses <strong>.201</strong> (Pandar40P) and <strong>.1</strong> (often reserved). Any address from .100 to .200 works, except .201.
              </TipBox>
            </Step>

            <Step n={4} title="Verify network connectivity (ipconfig + ping)">
              <p>Open a command prompt (<strong className="text-white">Win + R → cmd</strong>) and first verify the configured IP address:</p>
              <MonoBlock>{`ipconfig`}</MonoBlock>
              <p className="mt-1">Find the <strong className="text-white">Ethernet</strong> entry — it should display <code className="text-cyan-400 bg-gray-800 px-1 rounded">IPv4 Address: 192.168.1.100</code>. Then test the connection to the Pandar40P:</p>
              <MonoBlock>{`ping 192.168.1.201`}</MonoBlock>
              <p>You should receive replies with a time under 5 ms. If the ping fails:</p>
              <ul className="list-disc list-inside space-y-1 mt-2 ml-2 text-gray-400">
                <li>Verify the Ethernet cable is securely plugged in on both ends</li>
                <li>Confirm the static IP is correctly configured</li>
                <li>Make sure the 12 V power box is on (indicator light lit)</li>
              </ul>
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 my-2 text-green-300 text-sm">
                ✓ Successful ping = PC and Pandar40P are communicating correctly.
              </div>
            </Step>

            <Step n={5} title="Allow the UDP port in Windows Firewall">
              <p>The Pandar40P sends UDP packets on port <strong className="text-white">2368</strong>. Windows Firewall may block them:</p>
              <MonoBlock>{`Windows Security → Firewall & network protection
  → Advanced settings → Inbound Rules
  → New Rule → Port → UDP → 2368
  → Allow the connection → Private`}</MonoBlock>
              <WarningBox>
                Without this exception, the Windows service will receive no data from the LiDAR even if ping works.
              </WarningBox>
            </Step>
          </SectionCard>
        </div>

        {/* PART 3: WINDOWS SERVICE */}
        <div className="doc-section mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Part 3 — Windows Service Installation and Startup</h2>

          <SectionCard>
            <p className="text-gray-300 mb-4">The browser cannot receive UDP packets from the Pandar40P directly. An intermediate Windows service ("MeasurePRO LiDAR Service") receives the data, processes it, and forwards it to MeasurePRO via WebSocket on port <strong className="text-white">17777</strong>.</p>

            <Step n={1} title="Prerequisite — Install .NET 8 Runtime">
              <p>The service requires the <strong className="text-white">.NET 8 Runtime</strong> for Windows. Download it from:</p>
              <MonoBlock>{`https://dotnet.microsoft.com/en-us/download/dotnet/8.0
  → Choose: Runtime (not the SDK)
  → Windows x64`}</MonoBlock>
              <WarningBox>
                Without .NET 8, the service will not start and will show an error such as "VCRUNTIME.dll is missing".
              </WarningBox>
            </Step>

            <Step n={2} title="Install the MeasurePRO LiDAR Service">
              <p>The installer is provided by SolTec with your MeasurePRO+ kit. Check in <strong className="text-white">Windows Settings → Apps</strong> that "MeasurePRO LiDAR Service" is listed. If not, contact SolTec support to obtain the installer.</p>
            </Step>

            <Step n={3} title="Launch the service as administrator">
              <p>Find the MeasurePRO LiDAR service icon on the desktop or in the Start menu. <strong className="text-white">Right-click → Run as administrator</strong>.</p>
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 my-2 text-green-300 text-sm">
                ✓ An icon appears in the system tray (Windows notification area). The service listens on port 17777.
              </div>
              <TipBox>
                If port 17777 is already in use by another application, the service automatically switches to 17778, 17779… up to 17787. Check the system tray icon to see the active port.
              </TipBox>
            </Step>

            <Step n={4} title="Verify the connection in the application">
              <p>In MeasurePRO, go to the <strong className="text-white">3D LiDAR Scanner</strong> page. The "Port" field shows <strong className="text-white">17777</strong> by default. Click <strong className="text-white">Connect</strong>.</p>
              <ul className="list-disc list-inside space-y-1 mt-2 ml-2 text-gray-400">
                <li>The badge at the top changes from <strong>Disconnected</strong> to <strong>Connected</strong></li>
                <li>The "Packets/sec" metric shows a number greater than 0</li>
              </ul>
              <WarningBox>
                If the connection is refused, enable the Chrome flag: <strong>chrome://flags/#allow-insecure-localhost</strong> → Enabled. This is required because MeasurePRO is served over HTTPS while the local service uses ws:// (unencrypted).
              </WarningBox>
            </Step>
          </SectionCard>
        </div>

        {/* PART 4: THE 3 MODES */}
        <div className="doc-section mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Part 4 — Using the 3 Capture Modes</h2>

          {/* SURVEY MODE */}
          <SectionCard>
            <h3 className="text-lg font-semibold text-purple-300 mb-3">Mode 1 — Continuous Survey (driving)</h3>
            <p className="text-gray-300 mb-3">Survey mode collects data continuously while the vehicle drives. It calculates road width and clearances in real time and displays them in the LiDAR dashboard.</p>
            <h4 className="font-semibold text-white mb-2 text-sm">Procedure:</h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm mb-4">
              <li>Verify the "Connected" badge is green in MeasurePRO</li>
              <li>Drive at normal speed (max. 80 km/h recommended)</li>
              <li>Monitor the real-time metrics in the dashboard</li>
              <li>Click <strong className="text-white">Segment</strong> to record a timestamped section</li>
              <li>Click <strong className="text-white">Stop Capture</strong> to finalize the section</li>
            </ol>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {[
                { label: 'Current road width', metric: 'Road Width', color: 'text-green-400' },
                { label: 'Min width (last 100 m)', metric: 'Min (100m)', color: 'text-gray-300' },
                { label: 'Clearance at various heights', metric: 'Clearance at Heights', color: 'text-gray-300' },
                { label: 'Scan confidence index', metric: 'Confidence', color: 'text-gray-300' },
              ].map(({ label, metric, color }) => (
                <div key={metric} className="bg-gray-900/40 rounded p-2">
                  <div className={`font-mono text-xs font-semibold ${color}`}>{metric}</div>
                  <div className="text-gray-500 text-xs">{label}</div>
                </div>
              ))}
            </div>
            <Screenshot src="./screenshots/lidar.jpg" alt="lidar-dashboard" caption="LiDAR Dashboard — real-time metrics in Survey mode" />
            <TipBox>
              In Survey mode, no LAS file is saved — only real-time metrics are calculated. Use the "Segment" button to record a timestamped excerpt.
            </TipBox>
          </SectionCard>

          {/* STATIC SCAN MODE */}
          <SectionCard>
            <h3 className="text-lg font-semibold text-purple-300 mb-3">Mode 2 — Static Scan (structure)</h3>
            <p className="text-gray-300 mb-3">Static scan captures a fixed scene at high density — ideal for a bridge, tunnel, or level crossing. The vehicle must be completely stationary.</p>
            <h4 className="font-semibold text-white mb-2 text-sm">Procedure:</h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm mb-4">
              <li>Stop the vehicle in front of the structure to scan</li>
              <li>In the "Dashboard" tab, set the <strong className="text-white">static scan duration</strong> (5 to 60 seconds — 15 s recommended)</li>
              <li>Click <strong className="text-white">Scan</strong> — a countdown is displayed</li>
              <li>Stay still for the entire duration</li>
              <li>The scan stops automatically and the file is saved</li>
              <li>In the "Captures" tab, locate the capture and click the export icon</li>
            </ol>
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 my-2 text-green-300 text-sm">
              ✓ The exported file is saved to <strong>C:\MeasurePRO\Captures\</strong> in <strong>.laz</strong> format (compressed LAS). It can be opened with CloudCompare, Civil 3D, or ArcGIS Pro. To get an uncompressed .las, use the free LASzip tool (laszip.org).
            </div>
            <WarningBox>
              If the vehicle moves during the scan, point clouds will be blurry ("ghosting"). Turn off the engine if possible to minimize vibrations.
            </WarningBox>
          </SectionCard>

          {/* AUTOMATIC POI MODE */}
          <SectionCard>
            <h3 className="text-lg font-semibold text-purple-300 mb-3">Mode 3 — Automatic POIs (trigger thresholds)</h3>
            <p className="text-gray-300 mb-3">MeasurePRO continuously monitors LiDAR metrics and can automatically trigger a POI when a clearance threshold is exceeded while driving.</p>
            <h4 className="font-semibold text-white mb-2 text-sm">Trigger thresholds:</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { threshold: 'Road width < 6 m', color: 'text-yellow-400', label: 'Narrow width alert' },
                { threshold: 'Clearance < 4.5 m', color: 'text-red-400', label: 'Critical height alert' },
              ].map(({ threshold, color, label }) => (
                <div key={threshold} className="bg-gray-900/40 rounded p-3">
                  <div className={`font-semibold text-sm ${color}`}>{threshold}</div>
                  <div className="text-gray-500 text-xs mt-1">{label}</div>
                </div>
              ))}
            </div>
            <h4 className="font-semibold text-white mb-2 text-sm">Where to view detected POIs:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm mb-4">
              <li>Main map → colored icons on the road</li>
              <li>Survey Manager → "POI" tab → filter by type "LiDAR"</li>
              <li>CSV/GeoJSON export → field <code className="text-cyan-400 bg-gray-800 px-1 rounded">poi_type: lidar_alert</code></li>
            </ul>
            <TipBox>
              Automatic LiDAR POIs include the GPS coordinates at the time of detection, the metric that triggered the alert, and a link to the nearest capture if one exists.
            </TipBox>
          </SectionCard>
        </div>

        {/* PART 5: QUICK TROUBLESHOOTING */}
        <div className="doc-section mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Part 5 — Quick Troubleshooting</h2>
          <SectionCard>
            <div className="space-y-3">
              {[
                {
                  sym: 'Service not detected — "Disconnected" badge stays red',
                  cause: 'Service not started, wrong port, or firewall blocking the WebSocket',
                  sol: '1. Check the service icon in the system tray. 2. Enable chrome://flags/#allow-insecure-localhost. 3. Confirm the port (default 17777) in MeasurePRO → Port field.',
                },
                {
                  sym: 'Connected but no points — "Packets/sec" shows 0',
                  cause: 'Pandar40P not powered or UDP port 2368 blocked by firewall',
                  sol: '1. Verify the Pandar40P fan is spinning. 2. Add an inbound UDP rule for port 2368 in Windows Firewall. 3. Retry ping 192.168.1.201.',
                },
                {
                  sym: 'Empty export or corrupted .laz file',
                  cause: 'Capture stopped before finalization, or disk write issue',
                  sol: '1. Check available disk space on C:\\. 2. Review logs in C:\\MeasurePRO\\Logs\\. 3. Try opening the file in CloudCompare — some data may be recoverable.',
                },
                {
                  sym: 'Metrics at zero (width = 0 m, clearance = 0 m)',
                  cause: 'Mock mode enabled in the service, or insufficient point cloud',
                  sol: '1. Open appsettings.json in the service folder and verify "MockMode": false. 2. Restart the service. 3. Make sure you are driving at least 5 km/h for Survey mode.',
                },
                {
                  sym: '"Port already in use" error on service startup',
                  cause: 'Another instance of the service or another application is using port 17777',
                  sol: '1. In cmd: netstat -ano | findstr :17777 — note the PID. 2. End that process in Task Manager. 3. Or let the service choose a free port (17778–17787) and update the Port field in MeasurePRO.',
                },
              ].map(({ sym, cause, sol }) => (
                <div key={sym} className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                  <div className="font-semibold text-amber-300 mb-1 text-sm">{sym}</div>
                  <div className="text-gray-500 text-xs mb-1"><span className="text-gray-400 font-medium">Probable cause:</span> {cause}</div>
                  <div className="text-gray-400 text-xs"><span className="font-medium text-gray-300">Solution:</span> {sol}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-700 pt-4 text-xs text-gray-500 flex justify-between">
          <span>SolTec Innovation · support@soltec.ca · measure-pro.app</span>
          <span>Pandar40P Guide — MeasurePRO</span>
        </div>
      </div>
    </div>
  );
}
