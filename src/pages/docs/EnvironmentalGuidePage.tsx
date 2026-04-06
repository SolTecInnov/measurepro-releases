import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: black !important; font-size: 10pt; font-family: Arial, sans-serif; }
  .print-page { background: white !important; }
  .doc-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8pt; }
  .card { border: 1px solid #ccc !important; background: white !important; break-inside: avoid; page-break-inside: avoid; }
  h3, h4 { break-after: avoid; page-break-after: avoid; }
  .text-sky-600, .text-sky-500, .text-sky-400, .text-sky-300, .text-sky-200 { color: #0369a1 !important; }
  .text-blue-600, .text-blue-500, .text-blue-400, .text-blue-300, .text-blue-200 { color: #0369a1 !important; }
  .text-green-600, .text-green-500, .text-green-400, .text-green-300, .text-green-200 { color: #15803d !important; }
  .text-amber-600, .text-amber-500, .text-amber-400, .text-amber-300, .text-amber-200 { color: #92400e !important; }
  .text-red-600, .text-red-500, .text-red-400, .text-red-300, .text-red-200 { color: #991b1b !important; }
  .text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  .text-white { color: #111827 !important; }
  .bg-gray-800, .bg-gray-700, .bg-gray-900 { background: #f9fafb !important; }
  .border-gray-700 { border-color: #d1d5db !important; }
  .header-bar { border-bottom: 2pt solid #0369a1 !important; }
  .cond-ok { background: #d1fae5 !important; border-color: #6ee7b7 !important; }
  .cond-warn { background: #fef3c7 !important; border-color: #fcd34d !important; }
  .cond-bad { background: #fee2e2 !important; border-color: #fca5a5 !important; }
  .cond-info { background: #dbeafe !important; border-color: #93c5fd !important; }
  .sol-box { background: #f0fdf4 !important; border: 1px solid #86efac !important; }
}
@page { size: letter portrait; margin: 1.25cm 1.5cm; }
`;

const CONDITIONS = [
  {
    icon: '🌧', title: 'Rain', severity: 'warn',
    effects: [
      { system: 'Laser', impact: 'warn', text: 'Droplets scatter the beam → spurious short readings. Heavy rain causes signal loss.' },
      { system: 'Camera', impact: 'warn', text: 'Drops on the lens cause blur and degrade AI detection.' },
      { system: 'GPS / GNSS', impact: 'ok', text: 'No significant effect.' },
    ],
    solutions: ['Increase ignoreBelow to 2–3 m', 'Manually verify any suspect readings', 'Add a rain shield over the camera lens', 'Note "weather: rain" in survey notes'],
  },
  {
    icon: '🌫', title: 'Fog & Mist', severity: 'bad',
    effects: [
      { system: 'Laser', impact: 'bad', text: 'Uniform scattering along the entire beam → laser reports distance to the fog layer (10–40 m) instead of the actual structure. All readings cluster at the same value.' },
      { system: 'Camera', impact: 'bad', text: 'Reduced visibility → photos unusable, ZED 2i depth heavily degraded.' },
      { system: 'GPS / GNSS', impact: 'ok', text: 'No effect.' },
    ],
    solutions: ['Diagnostic: all readings stable in the same short range → fog confirmed', 'Wait for fog to clear if possible', 'Manually enter known clearances', 'Log conditions clearly in survey notes'],
    warning: 'Fog is the hardest condition to filter — false readings can look plausible. Always verify visually.',
  },
  {
    icon: '☀', title: 'Bright Sunlight (Blinding)', severity: 'warn',
    effects: [
      { system: 'Laser', impact: 'bad', text: 'Intense solar radiation saturates the photodetector → cannot distinguish laser return from solar noise. Symptoms: "No reading" or random maximum-range values.' },
      { system: 'Camera', impact: 'warn', text: 'Overexposure, halos, reduced ZED 2i depth quality.' },
    ],
    solutions: ['Tilt the laser slightly to avoid direct solar alignment', 'Add a sun hood over the sensor aperture', 'Survey at a different time (early morning or evening)', 'Check if the sensor has a built-in optical bandpass filter'],
    note: 'Typical situations: low sun (morning/evening) on east/west roads · Reflection off metallic surfaces or wet white concrete.',
  },
  {
    icon: '⬛', title: 'Dark & Low-Reflectivity Surfaces', severity: 'warn',
    effects: [
      { system: 'Laser', impact: 'warn', text: 'Dark-painted metal, dark timber, carbon fibre, or heavily weathered concrete absorbs laser energy → weak return signal → intermittent readings.' },
    ],
    solutions: ['Apply retroreflective sticker or survey tape to the surface', 'Take multiple readings and use the median value', 'Slightly increase sensor sensitivity if the laser supports it'],
    note: 'Retroreflective safety tape works very well. Avoid standard masking tape (same effect as a dark surface).',
  },
  {
    icon: '🌡', title: 'Extreme Temperatures', severity: 'info',
    effects: [
      { system: 'Cold (<−10°C)', impact: 'warn', text: 'Laser: 5–10 min warm-up before stable readings. Tablet: battery life reduced by 30–50%. Condensation on lenses during warm-up phase.' },
      { system: 'Heat (>40°C direct sun)', impact: 'warn', text: 'Tablet: thermal throttling → app slowdown. ZED 2i: reduced depth accuracy.' },
    ],
    solutions: ['Cold: allow the laser 10 min warm-up before starting the survey', 'Cold: keep the tablet in the heated vehicle cab between sessions', 'Heat: use a sun shade for the tablet', 'Heat: use quality shielded cables to avoid resistance issues'],
  },
  {
    icon: '📡', title: 'GPS / GNSS Interference', severity: 'info',
    effects: [
      { system: 'Urban canyons', impact: 'warn', text: 'Multipath: signal bounces off buildings → 5–50 m position error. RTK-GNSS reduces but cannot fully eliminate this.' },
      { system: 'Tunnels & dense canopy', impact: 'bad', text: 'GPS completely unavailable in tunnels. The app continues with the last valid position and auto-recovers on exit.' },
    ],
    solutions: ['Always use the Duro RTK-GNSS with a correctly positioned external antenna', 'Tunnels: manually note entry/exit in survey notes', 'Urban areas: accept reduced accuracy or re-verify RTK Fixed in an open area'],
  },
];

const SEVERITY_COLORS = {
  ok: 'cond-ok bg-green-900/20 border border-green-700/40',
  warn: 'cond-warn bg-amber-900/20 border border-amber-700/40',
  bad: 'cond-bad bg-red-900/20 border border-red-700/40',
  info: 'cond-info bg-blue-900/20 border border-blue-700/40',
};

export default function EnvironmentalGuidePage() {
  useEffect(() => { document.title = 'Environmental Conditions Guide — MeasurePRO'; }, []);

  return (
    <div className="print-page min-h-screen bg-gray-900 text-gray-100">
      <style>{PRINT_STYLES}</style>

      <div className="no-print sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <Link to="/docs" className="text-gray-300 hover:text-white flex items-center gap-2 text-sm" data-testid="link-back-env">
          <ArrowLeft className="w-4 h-4" /> Documents
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          data-testid="button-print-env">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="doc-container max-w-4xl mx-auto px-8 py-8">

        <div className="doc-section header-bar border-b-2 border-sky-600 pb-4 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-sky-400 font-semibold tracking-widest uppercase mb-1">SolTec Innovation · measure-pro.app</div>
              <h1 className="text-2xl font-black text-white">Environmental Conditions Guide</h1>
              <h2 className="text-lg font-bold text-sky-400">Effects on laser, camera, and GPS</h2>
            </div>
            <div className="text-right text-xs text-gray-500 mt-2 space-y-1">
              <div className="flex items-center gap-2 justify-end"><span className="w-3 h-3 rounded-sm bg-green-700 inline-block" /> No effect</div>
              <div className="flex items-center gap-2 justify-end"><span className="w-3 h-3 rounded-sm bg-amber-700 inline-block" /> Moderate impact</div>
              <div className="flex items-center gap-2 justify-end"><span className="w-3 h-3 rounded-sm bg-red-700 inline-block" /> High impact</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {CONDITIONS.map(cond => (
            <div key={cond.title} className="doc-section card bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700">
                <span className="text-2xl shrink-0">{cond.icon}</span>
                <h3 className="text-sm font-bold text-white">{cond.title}</h3>
              </div>
              <div className="p-4 grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Effects</p>
                  <div className="space-y-1.5">
                    {cond.effects.map(e => (
                      <div key={e.system} className={`rounded p-2 text-xs ${SEVERITY_COLORS[e.impact as keyof typeof SEVERITY_COLORS]}`}>
                        <div className="font-semibold text-white mb-0.5">{e.system}</div>
                        <div className="text-gray-300">{e.text}</div>
                      </div>
                    ))}
                    {cond.warning && <div className="bg-red-900/30 border border-red-700/50 rounded p-2 text-xs text-red-300">⚠ {cond.warning}</div>}
                    {cond.note && <div className="bg-gray-900/40 border border-gray-600 rounded p-2 text-xs text-gray-400 italic">{cond.note}</div>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recommended Actions</p>
                  <div className="sol-box bg-green-900/20 border border-green-700/40 rounded p-3 space-y-1.5">
                    {cond.solutions.map(s => (
                      <div key={s} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-green-400 shrink-0 font-bold">→</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="doc-section mt-4 bg-gray-800 border border-gray-700 rounded-lg p-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-300 mb-2">Summary</p>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-green-400 font-semibold mb-1">✓ Ideal conditions</p><ul className="space-y-0.5 list-disc list-inside ml-2"><li>Overcast sky — diffuse light</li><li>Temperature 5–35°C</li><li>Light or retroreflective surfaces</li><li>Open sky for GPS</li></ul></div>
            <div><p className="text-amber-400 font-semibold mb-1">⚠ Acceptable</p><ul className="space-y-0.5 list-disc list-inside ml-2"><li>Light rain (adjust ignoreBelow)</li><li>Hazy sun</li><li>Cold down to −15°C (after warm-up)</li><li>Urban area (reduced GPS accuracy)</li></ul></div>
            <div><p className="text-red-400 font-semibold mb-1">✗ Avoid if possible</p><ul className="space-y-0.5 list-disc list-inside ml-2"><li>Dense fog</li><li>Heavy rain</li><li>Direct sun in laser axis</li><li>Extreme temps (&lt;−20°C or &gt;50°C)</li></ul></div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 mt-4 text-xs text-gray-500 flex justify-between">
          <span>SolTec Innovation · support@soltec.ca · measure-pro.app</span>
          <span>Environmental Conditions Guide</span>
        </div>
      </div>
    </div>
  );
}
