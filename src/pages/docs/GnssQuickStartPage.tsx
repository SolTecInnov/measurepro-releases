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
  .text-green-600, .text-green-500, .text-green-400, .text-green-300, .text-green-200 { color: #15803d !important; }
  .text-blue-600, .text-blue-500, .text-blue-400, .text-blue-300, .text-blue-200 { color: #1d4ed8 !important; }
  .text-amber-600, .text-amber-500, .text-amber-400, .text-amber-300, .text-amber-200 { color: #92400e !important; }
  .text-red-600, .text-red-500, .text-red-400, .text-red-300, .text-red-200 { color: #991b1b !important; }
  .text-yellow-400, .text-yellow-300, .text-yellow-200 { color: #92400e !important; }
  .text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  .text-white { color: #111827 !important; }
  .bg-gray-800, .bg-gray-700, .bg-gray-900 { background: #f9fafb !important; }
  .border-gray-700 { border-color: #d1d5db !important; }
  .header-bar { border-bottom: 2pt solid #15803d !important; }
  .step-num { border: 2px solid #15803d !important; color: #15803d !important; }
  .warning-box { background: #fffbeb !important; border: 1px solid #d97706 !important; }
  .info-box { background: #eff6ff !important; border: 1px solid #1d4ed8 !important; }
  .success-box { background: #f0fdf4 !important; border: 1px solid #15803d !important; }
}
@page { size: letter portrait; margin: 1.25cm 1.5cm; }
`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="step-row flex gap-4 mb-4">
      <div className="step-num w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center text-green-400 font-black text-sm shrink-0 mt-0.5">{n}</div>
      <div className="flex-1">
        <div className="font-bold text-white text-sm leading-tight mb-1">{title}</div>
        <div className="text-gray-300 text-xs space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Box({ type = 'info', children }: { type?: 'info' | 'warn' | 'ok'; children: React.ReactNode }) {
  const cls = {
    info: 'info-box bg-blue-900/30 border border-blue-700/50 text-blue-200',
    warn: 'warning-box bg-amber-900/30 border border-amber-700/50 text-amber-200',
    ok: 'success-box bg-green-900/30 border border-green-700/50 text-green-200',
  }[type];
  return <div className={`rounded p-2 text-xs mt-1 ${cls}`}>{children}</div>;
}

export default function GnssQuickStartPage() {
  useEffect(() => { document.title = 'GNSS Quick Start Guide — MeasurePRO'; }, []);

  return (
    <div className="print-page min-h-screen bg-gray-900 text-gray-100">
      <style>{PRINT_STYLES}</style>

      <div className="no-print sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <Link to="/docs" className="text-gray-300 hover:text-white flex items-center gap-2 text-sm" data-testid="link-back-gnss">
          <ArrowLeft className="w-4 h-4" /> Documents
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          data-testid="button-print-gnss">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="doc-container max-w-3xl mx-auto px-8 py-8">

        {/* HEADER */}
        <div className="doc-section header-bar border-b-2 border-green-600 pb-4 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-green-400 font-semibold tracking-widest uppercase mb-1">SolTec Innovation · measure-pro.app</div>
              <h1 className="text-2xl font-black text-white">Quick Start Guide</h1>
              <h2 className="text-xl font-bold text-green-400">MeasurePRO GNSS Kit (Swift Duro)</h2>
            </div>
            <div className="text-right text-xs text-gray-500"><div>Version 1.0</div></div>
          </div>
        </div>

        {/* KIT CONTENTS */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-white mb-2 text-sm">📦 Kit Contents</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-300">
            {['Swift Navigation Duro receiver', 'GNSS antenna (patch or survey)', '12–30V power cable', 'USB-A or Ethernet cable', 'This guide', 'Field reference card'].map(item => (
              <div key={item} className="flex items-center gap-2 py-0.5">
                <span className="text-green-400 font-bold">✓</span><span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GETTING STARTED */}
        <div className="doc-section mb-4">
          <h3 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Getting Started</h3>

          <Step n={1} title="Install the antenna">
            <p>Mount the antenna on the vehicle roof or on a mast with a <strong className="text-white">clear, unobstructed 360° view of the sky</strong>. Keep it away from power cables and metal structures.</p>
            <Box type="warn">⚠ Recommended elevation mask: 10°. Poor antenna placement is the #1 cause of bad RTK accuracy.</Box>
          </Step>

          <Step n={2} title="Power the Duro">
            <p>Connect the 12–30V DC power cable to the Duro. The LEDs sequence on startup. Wait for the GPS LED to blink (acquiring satellites).</p>
            <Box type="ok">✓ GPS LED solid = fix acquired</Box>
          </Step>

          <Step n={3} title="Connect to the tablet">
            <p><strong className="text-white">Via USB:</strong> Plug the USB cable between the Duro and tablet. Windows detects a virtual COM port automatically.</p>
            <p><strong className="text-white">Via Ethernet:</strong> Connect the Ethernet cable. Set a static IP on the tablet in the same subnet as the Duro (default Duro IP: <strong className="text-white">192.168.0.222</strong>).</p>
          </Step>

          <Step n={4} title="Connect in the app">
            <p>Open <strong className="text-white">Settings → GNSS → Duro</strong>. USB: select the COM port. Ethernet: enter the Duro's IP address. Click <strong className="text-white">Connect</strong>. The GNSS panel shows fix type in real time.</p>
          </Step>

          <Step n={5} title="Wait for RTK fix">
            <p>Without corrections: Single Point or SBAS (1–10 m). With NTRIP corrections: <strong className="text-white">RTK Float then RTK Fixed</strong> (centimetre-level). Allow 1–5 minutes for convergence after corrections start arriving.</p>
            <Box type="ok">✓ RTK Fixed (green) = ±1–5 cm — optimal for all OS/OW surveys</Box>
          </Step>
        </div>

        {/* FIX TYPES */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">GNSS Fix Types</h4>
          <div className="space-y-2">
            {[
              { bg: 'bg-red-900/40 border border-red-700/50', icon: '🔴', fix: 'Single Point', prec: '3–10 m', desc: 'Standard GPS, no corrections. Use for navigation only.' },
              { bg: 'bg-amber-900/40 border border-amber-700/50', icon: '🟡', fix: 'SBAS / DGPS', prec: '1–3 m', desc: 'Satellite corrections (WAAS/EGNOS). Acceptable for general mapping.' },
              { bg: 'bg-blue-900/40 border border-blue-700/50', icon: '🔵', fix: 'RTK Float', prec: '0.1–0.5 m', desc: 'RTK corrections received, phase unresolved. Good for surveys.' },
              { bg: 'bg-green-900/40 border border-green-700/50', icon: '🟢', fix: 'RTK Fixed', prec: '±1–5 cm', desc: 'Centimetre-level. Optimal — recommended for all OS/OW surveys.' },
            ].map(f => (
              <div key={f.fix} className={`rounded p-2.5 text-xs flex items-start gap-3 ${f.bg}`}>
                <span className="text-base shrink-0">{f.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">{f.fix}</span>
                    <span className="font-mono text-sm text-white">{f.prec}</span>
                  </div>
                  <div className="text-gray-300 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NTRIP + GPS PRIORITY */}
        <div className="doc-section grid grid-cols-2 gap-4 mb-4">
          <div className="card bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-bold text-white mb-2 text-sm border-b border-gray-700 pb-2">NTRIP Configuration</h4>
            <div className="space-y-2 text-xs text-gray-300">
              <p>RTK corrections are delivered via an NTRIP provider (reference station network). Internet connection required in the field.</p>
              <ol className="list-decimal list-inside space-y-0.5 mt-1">
                <li>Settings → GNSS → NTRIP</li>
                <li>Enter: host, port, mountpoint, credentials</li>
                <li>Click Connect — Duro begins receiving corrections</li>
                <li>Wait for RTK Float, then RTK Fixed (~30–60 s)</li>
              </ol>
              <Box type="warn">⚠ Correction age &gt;30 s = stale corrections. Check network connection.</Box>
            </div>
          </div>

          <div className="card bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-bold text-white mb-2 text-sm border-b border-gray-700 pb-2">GPS Source Priority</h4>
            <div className="space-y-2 text-xs text-gray-300">
              {[
                { rank: '1', color: 'text-green-400', name: 'Swift Duro (RTK)', note: 'Highest priority · ±1–5 cm' },
                { rank: '2', color: 'text-blue-400', name: 'USB / serial GPS', note: 'Active if Duro silent >5 s · 2–10 m' },
                { rank: '3', color: 'text-yellow-400', name: 'Bluetooth GPS', note: 'Third source · 2–10 m' },
                { rank: '4', color: 'text-gray-400', name: 'Device geolocation', note: 'Last resort fallback · 3–15 m' },
              ].map(s => (
                <div key={s.rank} className="flex items-start gap-2">
                  <span className={`font-black w-5 shrink-0 ${s.color}`}>{s.rank}.</span>
                  <div>
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="text-gray-500">{s.note}</div>
                  </div>
                </div>
              ))}
              <Box type="info">If Duro goes silent for 5 s, the app auto-switches to USB GPS — no operator action required.</Box>
            </div>
          </div>
        </div>

        {/* IMU */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-2 text-sm border-b border-gray-700 pb-2">Duro IMU Data — Road Profile & Cross-Slope</h4>
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-300">
            <div className="space-y-2">
              <p>The Duro provides full IMU output (roll, pitch, heading/yaw) in addition to GPS position. MeasurePRO uses these IMU axes as follows:</p>
              <ul className="space-y-1 ml-2">
                <li><strong className="text-white">Roll</strong> — lateral tilt of the vehicle. Represents the road's cross-slope / banking angle. Used for OS/OW stability analysis.</li>
                <li><strong className="text-white">Pitch</strong> — longitudinal tilt. Used to compute road grade for the Road Profile module.</li>
                <li><strong className="text-white">Yaw (heading)</strong> — direction of travel. Combined with GPS for trajectory calculation and chainage computation.</li>
              </ul>
              <p className="text-gray-500">IMU data is only available with the Swift Duro — not with USB GPS, Bluetooth, or device geolocation.</p>
            </div>
            <div>
              <div className="text-white font-semibold text-xs mb-2">Cross-Slope / Banking Thresholds</div>
              <div className="space-y-1">
                {[['Normal', '0–3°', 'text-green-400'], ['Caution', '3–5°', 'text-yellow-400'], ['Warning', '5–7°', 'text-amber-400'], ['Critical', '7–10°', 'text-red-400'], ['Unacceptable', '>10°', 'text-red-600']].map(([label, val, cls]) => (
                  <div key={label} className="flex justify-between">
                    <span>{label}</span><span className={`font-mono font-bold ${cls}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ROAD PROFILE ACTIVATION */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Activating Road Profile Module</h4>
          <div className="space-y-2 text-xs text-gray-300">
            <p>The Road Profile module records chainage (cumulative distance), grade (%), and K-factor (rate of grade change) continuously while you drive. It requires the Duro for centimetre-level elevation data.</p>
            <ol className="list-decimal list-inside space-y-1 mt-1 ml-1">
              <li>Confirm <strong className="text-white">RTK Fixed</strong> fix (green indicator)</li>
              <li>Open <strong className="text-white">Settings → Road Profile</strong></li>
              <li>Toggle <strong className="text-white">"Enable Road Profile Recording"</strong> to ON</li>
              <li>Create or open a survey, then press <kbd className="bg-gray-700 border border-gray-600 px-1 rounded text-xs font-mono">Alt+3</kbd> to start logging</li>
              <li>The profile records automatically — the Road Profile panel updates in real time</li>
            </ol>
            <Box type="ok">✓ Export formats: CSV · GeoJSON · Shapefile · DXF (AutoCAD) · LandXML (Civil 3D) · ZIP bundle</Box>
            <Box type="warn">⚠ Road Profile is unavailable with USB GPS, Bluetooth GPS, or device geolocation — Duro only.</Box>
          </div>
        </div>

        {/* TROUBLESHOOTING */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-white mb-2 text-sm border-b border-gray-700 pb-2">GNSS Troubleshooting</h4>
          <div className="space-y-2 text-xs text-gray-300">
            {[
              ['No fix', 'Antenna in open sky? · Antenna cable connected? · Wait 60 s for cold start.'],
              ['Single fix only', 'NTRIP not configured or no network. Configure NTRIP or wait for SBAS.'],
              ['RTK Float, never Fixed', 'Stale corrections (>30 s) · Multipath (buildings nearby) · Poor antenna quality.'],
              ['Position jumping', 'Urban multipath — expected. Use filtered mode in Road Profile settings.'],
              ['Duro connected, app shows USB GPS', 'Duro has no fix yet — auto-switches as soon as a fix is acquired.'],
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
          <span>GNSS Kit — Quick Start Guide</span>
        </div>
      </div>
    </div>
  );
}
