import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: black !important; font-size: 10.5pt; font-family: Arial, sans-serif; }
  .print-page { background: white !important; }
  .doc-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8pt; }
  .card { border: 1px solid #ccc !important; background: white !important; break-inside: avoid; page-break-inside: avoid; }
  h3, h4 { break-after: avoid; page-break-after: avoid; }
  .step-row { break-inside: avoid; page-break-inside: avoid; }
  .text-orange-600, .text-orange-500, .text-orange-400, .text-orange-300, .text-orange-200 { color: #c2410c !important; }
  .text-blue-600, .text-blue-500, .text-blue-400, .text-blue-300, .text-blue-200 { color: #1d4ed8 !important; }
  .text-green-600, .text-green-500, .text-green-400, .text-green-300, .text-green-200 { color: #15803d !important; }
  .text-amber-600, .text-amber-500, .text-amber-400, .text-amber-300, .text-amber-200 { color: #92400e !important; }
  .text-red-600, .text-red-500, .text-red-400, .text-red-300, .text-red-200 { color: #991b1b !important; }
  .text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  .text-white { color: #111827 !important; }
  .bg-gray-800, .bg-gray-700, .bg-gray-900 { background: #f9fafb !important; }
  .border-gray-700 { border-color: #d1d5db !important; }
  .header-bar { border-bottom: 2pt solid #ea580c !important; }
  .step-num { background: #ea580c !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .info-box { background: #eff6ff !important; border: 1px solid #3b82f6 !important; }
  .faq-box { background: #f9fafb !important; border: 1px solid #d1d5db !important; }
}
@page { size: letter portrait; margin: 1.25cm 1.5cm; }
`;

const TRANSITION_STEPS = [
  { n: 1, icon: '🔔', title: 'Audible alert + notification', desc: 'A confirmation sound plays. Toast: "Part X complete — saving and continuing in Part Y."' },
  { n: 2, icon: '💾', title: 'Local save (mandatory)', desc: 'A ZIP file (data + photos + metadata.json) is generated and downloaded to the device automatically. Works even offline.' },
  { n: 3, icon: '☁', title: 'Cloud upload (if online)', desc: 'The ZIP is uploaded to Firebase Storage. If offline: skipped — the file is already safely on disk.' },
  { n: 4, icon: '📧', title: 'Email notification (if configured)', desc: 'Email sent to survey owner: "Part X auto-saved at N POIs. Continuing in Part Y."' },
  { n: 5, icon: '🌐', title: 'RoadScope sync (if configured)', desc: 'POIs pushed to the RoadScope platform via API key. POIs only, no media files (for speed).' },
  { n: 6, icon: '🗑', title: 'Clear memory cache', desc: 'Part X data evicted from RAM. IndexedDB retains all data — nothing is deleted.' },
  { n: 7, icon: '🚀', title: 'New part created, survey resumes', desc: 'New survey record (Part Y) created with the same project details. Laser and GPS continue WITHOUT interruption.' },
];

const FAQS = [
  { q: 'An auto-save triggered — where is my data?', a: 'Data is never deleted. Open Survey Manager — all parts appear in the list (Part 1, Part 2…). Each part can be exported individually, or all together using "Export all parts".' },
  { q: 'The ZIP download dialog appeared while driving and was dismissed. Is data lost?', a: 'No. All data remains in IndexedDB. The automatic download is a convenience copy. Go to Survey Manager → select the corresponding part → Export to regenerate the ZIP at any time.' },
  { q: 'How do I merge all parts into a single export?', a: 'In Survey Manager, select Part 1 (the root survey). The interface offers "Export all parts" which merges all POIs from all parts into a single CSV / GeoJSON / ZIP.' },
  { q: 'How do I change the 200 POI threshold?', a: 'Settings → Survey → Auto-Part Manager → POI Threshold slider. Valid range: 100–1000 POIs. Setting is saved immediately. For short surveys (<150 expected POIs): leave it enabled — the threshold simply won\'t be reached.' },
  { q: 'Can we force a manual part transition?', a: 'Yes. Settings → Survey → Auto-Part Manager → Force transition now. Triggers the exact same 7-step process regardless of current POI count. Useful before leaving a hard-to-access area.' },
];

export default function AutoPartGuidePage() {
  useEffect(() => { document.title = 'Auto-Part System Guide — MeasurePRO'; }, []);

  return (
    <div className="print-page min-h-screen bg-gray-900 text-gray-100">
      <style>{PRINT_STYLES}</style>

      <div className="no-print sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <Link to="/docs" className="text-gray-300 hover:text-white flex items-center gap-2 text-sm" data-testid="link-back-autopart">
          <ArrowLeft className="w-4 h-4" /> Documents
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          data-testid="button-print-autopart">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="doc-container max-w-3xl mx-auto px-8 py-8">

        {/* HEADER */}
        <div className="doc-section header-bar border-b-2 border-orange-500 pb-4 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-orange-400 font-semibold tracking-widest uppercase mb-1">SolTec Innovation · measure-pro.app</div>
              <h1 className="text-2xl font-black text-white">Auto-Part System Guide</h1>
              <h2 className="text-lg font-bold text-orange-400">Automatic data buffer management</h2>
            </div>
            <div className="text-right text-xs text-gray-500"><div>Version 1.0</div></div>
          </div>
        </div>

        {/* WHY */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-white mb-2 text-sm">Why this system exists</h3>
          <p className="text-sm text-gray-300">A very long survey (500+ km, 5000+ POIs) stored in a single part fills browser RAM and makes exports slow or unstable. The Auto-Part system solves this by automatically splitting the survey into numbered parts — without stopping the laser, the GPS, or requiring any action from the operator. The survey continues seamlessly; only the internal data bucket is swapped.</p>
        </div>

        {/* CONFIG */}
        <div className="doc-section grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Default threshold', val: '200 POIs', color: 'text-orange-400', note: 'Recommended for standard surveys' },
            { label: 'Configurable range', val: '100–1000', color: 'text-white', note: 'Settings → Survey → Auto-Part Manager' },
            { label: 'Warning triggered at', val: 'Threshold − 50', color: 'text-amber-400', note: 'On-screen notification shown' },
          ].map(item => (
            <div key={item.label} className="card bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <div className={`text-xl font-black mb-1 ${item.color}`}>{item.val}</div>
              <div className="text-xs text-white font-semibold leading-tight">{item.label}</div>
              <div className="text-xs text-gray-500 mt-1">{item.note}</div>
            </div>
          ))}
        </div>

        {/* TRANSITION STEPS */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Transition Sequence — What Happens Automatically</h3>
          <div className="relative">
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-orange-600/40" />
            <div className="space-y-2">
              {TRANSITION_STEPS.map(step => (
                <div key={step.n} className="step-row flex gap-3 relative">
                  <div className="step-num w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-xs shrink-0 z-10">{step.n}</div>
                  <div className="flex-1 bg-gray-900/30 rounded-lg px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div><span className="mr-1.5">{step.icon}</span><strong className="text-white text-xs">{step.title}</strong></div>
                      <span className="text-xs shrink-0 bg-green-900/40 text-green-400 border border-green-700/50 rounded px-1.5 py-0.5">Laser & GPS ✓</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CONTINUES / HANDLED */}
        <div className="doc-section grid grid-cols-2 gap-4 mb-4">
          <div className="card bg-gray-800 border border-green-700/40 rounded-lg p-3">
            <h4 className="text-green-400 font-bold mb-2 text-xs">✓ Continues uninterrupted</h4>
            <ul className="space-y-0.5 text-xs text-gray-300">
              {['Laser (continuous streaming)', 'GPS / GNSS (all sources)', 'Bluetooth connections', 'Video recording (saved and restarted)', 'AI detection', 'Lateral / rear monitoring'].map(i => (
                <li key={i} className="flex items-center gap-1.5"><span className="text-green-400">✓</span>{i}</li>
              ))}
            </ul>
          </div>
          <div className="card bg-gray-800 border border-amber-700/40 rounded-lg p-3">
            <h4 className="text-amber-400 font-bold mb-2 text-xs">→ Handled automatically</h4>
            <ul className="space-y-0.5 text-xs text-gray-300">
              {['Timelapse: saved and restarted in new part', 'POI memory cache: cleared (data remains in IndexedDB)', 'Cloud upload: runs in background if online', 'Email notification: sent if configured', 'RoadScope sync: if configured and online'].map(i => (
                <li key={i} className="flex items-center gap-1.5"><span className="text-amber-400">→</span>{i}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* FAQS */}
        <div className="doc-section card bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-white mb-3 text-sm border-b border-gray-700 pb-2">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {FAQS.map(faq => (
              <div key={faq.q} className="faq-box bg-gray-900/30 border border-gray-700 rounded-lg p-2.5">
                <p className="text-amber-300 font-semibold text-xs mb-0.5">Q: {faq.q}</p>
                <p className="text-gray-300 text-xs">A: {faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 text-xs text-gray-500 flex justify-between">
          <span>SolTec Innovation · support@soltec.ca · measure-pro.app</span>
          <span>Auto-Part System Guide</span>
        </div>
      </div>
    </div>
  );
}
