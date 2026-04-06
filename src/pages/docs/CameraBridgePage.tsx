import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import {
  ArrowLeft, Download, CheckCircle, Terminal, Wifi,
  AlertTriangle, Camera, HardDrive, Zap, Monitor
} from 'lucide-react';

const STEPS = [
  {
    num: 1,
    title: 'System requirements',
    icon: <Monitor className="w-5 h-5 text-blue-400" />,
    content: (
      <ul className="space-y-2 text-gray-300 text-sm">
        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> Windows 10 or Windows 11 (64-bit)</li>
        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> <span><strong>Node.js 20 LTS</strong> — download from <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-blue-400 underline">nodejs.org</a></span></li>
        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> Insta360 X5 connected via USB-C to the tablet</li>
        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> Camera appears as a USB network adapter at 192.168.42.1</li>
      </ul>
    )
  },
  {
    num: 2,
    title: 'Download and extract',
    icon: <Download className="w-5 h-5 text-blue-400" />,
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-gray-300">Click the download button above to get the <strong className="text-white">measurepro-camera-bridge.tar.gz</strong> archive.</p>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300">
          <p className="text-gray-500 mb-1"># Extract on Windows — open PowerShell in the download folder:</p>
          <p className="text-green-300">tar -xzf measurepro-camera-bridge.tar.gz -C C:\SolTec\</p>
          <p className="text-gray-500 mt-2"># Or: right-click the file → Extract All (Windows 11)</p>
        </div>
        <p className="text-gray-400 text-xs">The archive extracts to a <code className="text-blue-300">camera-bridge/</code> folder. Place it anywhere — we recommend <code className="text-blue-300">C:\SolTec\camera-bridge\</code>.</p>
      </div>
    )
  },
  {
    num: 3,
    title: 'Install dependencies and build',
    icon: <Terminal className="w-5 h-5 text-blue-400" />,
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-gray-300">Open PowerShell (or Command Prompt) inside the <code className="text-blue-300">camera-bridge</code> folder:</p>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1">
          <p className="text-gray-500"># Navigate to the folder</p>
          <p className="text-green-300">cd C:\SolTec\camera-bridge</p>
          <p className="text-gray-500 mt-2"># Install packages (requires internet)</p>
          <p className="text-green-300">npm install</p>
          <p className="text-gray-500 mt-2"># Compile TypeScript to JavaScript</p>
          <p className="text-green-300">npm run build</p>
          <p className="text-gray-500 mt-2"># Test it manually (Ctrl+C to stop)</p>
          <p className="text-green-300">npm start</p>
        </div>
        <p className="text-gray-400 text-xs">A successful start prints: <code className="text-green-300">Camera bridge running on http://localhost:3001</code></p>
      </div>
    )
  },
  {
    num: 4,
    title: 'Register as a Windows startup service',
    icon: <Zap className="w-5 h-5 text-blue-400" />,
    content: (
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2 bg-amber-900/30 border border-amber-700/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-200 text-xs">This step requires an <strong>Administrator PowerShell</strong> (right-click PowerShell → Run as Administrator).</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1">
          <p className="text-gray-500"># From an admin PowerShell inside camera-bridge:</p>
          <p className="text-green-300">npm run install-service</p>
        </div>
        <p className="text-gray-300">This registers <strong className="text-white">MeasurePRO Camera Bridge</strong> in Windows Task Scheduler. It will:</p>
        <ul className="space-y-1.5 text-gray-400 text-xs ml-3">
          <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> Start automatically every time Windows logs in</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> Run silently in the background (no console window)</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> Restart automatically up to 3 times on failure</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> Continue running even when Chrome is closed</li>
        </ul>
      </div>
    )
  },
  {
    num: 5,
    title: 'Verify the bridge is reachable',
    icon: <Wifi className="w-5 h-5 text-blue-400" />,
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-gray-300">Open Chrome DevTools (F12) on the tablet and run these in the <strong className="text-white">Console</strong> tab:</p>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-3">
          <div>
            <p className="text-gray-500 mb-1">// 1. Check the bridge service</p>
            <p className="text-blue-300">fetch('http://localhost:3001/health').then(r=&gt;r.json()).then(console.log)</p>
            <p className="text-gray-500 mt-1">// Expected: {'{ status: "ok" }'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">// 2. Check camera USB connection</p>
            <p className="text-blue-300">fetch('http://localhost:3001/camera/ping').then(r=&gt;r.json()).then(console.log)</p>
            <p className="text-gray-500 mt-1">// Expected: {'{ connected: true }'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">// 3. Check battery and storage</p>
            <p className="text-blue-300">fetch('http://localhost:3001/camera/status').then(r=&gt;r.json()).then(console.log)</p>
          </div>
        </div>
      </div>
    )
  },
  {
    num: 6,
    title: 'Log files',
    icon: <HardDrive className="w-5 h-5 text-blue-400" />,
    content: (
      <div className="space-y-2 text-sm">
        <p className="text-gray-300">Logs are written automatically to:</p>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1 text-gray-300">
          <p><span className="text-yellow-400">C:\SolTec\camera-bridge\logs\combined.log</span> — all activity</p>
          <p><span className="text-red-400">C:\SolTec\camera-bridge\logs\error.log</span> — errors only</p>
        </div>
        <p className="text-gray-400 text-xs">If the bridge is not reachable, open <code className="text-yellow-300">combined.log</code> in Notepad to see the startup error.</p>
        <p className="text-gray-400 text-xs mt-2">To remove the service from Task Scheduler:</p>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs">
          <p className="text-green-300">schtasks /Delete /TN "MeasurePRO Camera Bridge" /F</p>
        </div>
      </div>
    )
  }
];

const ENDPOINTS = [
  { method: 'GET',  path: '/health',                      desc: 'Bridge health check' },
  { method: 'GET',  path: '/camera/ping',                  desc: 'USB connection check' },
  { method: 'GET',  path: '/camera/status',                desc: 'Battery %, storage, recording state' },
  { method: 'POST', path: '/camera/start-recording',       desc: 'Start video capture' },
  { method: 'POST', path: '/camera/stop-recording',        desc: 'Stop capture, returns filename' },
  { method: 'POST', path: '/camera/capture-photo',         desc: 'Capture geotagged 360° photo + metadata sidecar' },
  { method: 'GET',  path: '/camera/preview-snapshot',      desc: 'Stream a JPEG frame for lens check' },
  { method: 'GET',  path: '/camera/files',                 desc: 'List files on camera SD card' },
  { method: 'POST', path: '/camera/download-survey',       desc: 'Start background file download job' },
  { method: 'GET',  path: '/camera/download-status/:jobId', desc: 'Poll download job progress' },
  { method: 'GET',  path: '/camera/settings',              desc: 'Read camera options' },
  { method: 'POST', path: '/camera/settings',              desc: 'Write camera options' },
];

export default function CameraBridgePage() {
  useEffect(() => {
    document.title = 'Camera Bridge Setup — MeasurePRO | measure-pro.app';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/docs"
            className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
            data-testid="link-back-docs"
          >
            <ArrowLeft className="w-5 h-5" />
            Documents
          </Link>
          <Link to="/" className="text-gray-300 hover:text-white transition-colors text-sm" data-testid="link-home">
            Home
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Camera className="w-10 h-10 text-violet-400" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-page-title">
              Camera Bridge
            </h1>
          </div>
          <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
            A lightweight Windows background service that connects MeasurePRO to the
            <strong className="text-white"> Insta360 X5</strong> camera over USB. Runs silently at startup —
            no open windows, no manual launch required.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href="/downloads/measurepro-camera-bridge.tar.gz"
            download
            className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            data-testid="button-download-bridge"
          >
            <Download className="w-5 h-5" />
            Download Camera Bridge
            <span className="text-violet-300 text-xs font-normal ml-1">(.tar.gz)</span>
          </a>
          <a
            href="/docs/camera-bridge#api"
            className="flex items-center justify-center gap-2 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white px-6 py-3 rounded-xl font-medium transition-colors"
            data-testid="link-api-reference"
          >
            API Reference ↓
          </a>
        </div>

        <div className="bg-gray-800/50 border border-violet-700/30 rounded-xl p-5 mb-10 flex items-start gap-4">
          <div className="bg-violet-900/40 rounded-lg p-2 shrink-0">
            <Camera className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">How it works</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              The bridge runs as a Node.js process at <code className="text-blue-300">localhost:3001</code>.
              MeasurePRO communicates with it over HTTP — the bridge then forwards commands to the camera
              via the <strong className="text-gray-300">Insta360 OSC protocol</strong> over the USB network
              adapter at <code className="text-blue-300">192.168.42.1</code>. Photo metadata is written to
              <code className="text-yellow-300"> C:\SolTec\Surveys\{'{'}surveyId{'}'}\</code> automatically.
            </p>
          </div>
        </div>

        <div className="space-y-6 mb-14">
          {STEPS.map(step => (
            <div
              key={step.num}
              className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
              data-testid={`card-step-${step.num}`}
            >
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-700 bg-gray-800/60">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-bold shrink-0">
                  {step.num}
                </div>
                <div className="flex items-center gap-2">
                  {step.icon}
                  <h2 className="font-semibold text-white">{step.title}</h2>
                </div>
              </div>
              <div className="px-6 py-4">
                {step.content}
              </div>
            </div>
          ))}
        </div>

        <div id="api" className="scroll-mt-20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2" data-testid="text-api-title">
            <Terminal className="w-5 h-5 text-violet-400" />
            API Reference
          </h2>
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 w-16">Method</th>
                  <th className="text-left px-4 py-3">Endpoint</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {ENDPOINTS.map((ep, i) => (
                  <tr key={i} className="hover:bg-gray-700/30 transition-colors" data-testid={`row-endpoint-${i}`}>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        ep.method === 'GET'
                          ? 'bg-blue-900/40 text-blue-300'
                          : 'bg-green-900/40 text-green-300'
                      }`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-200">{ep.path}</td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{ep.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3 ml-1">
            All endpoints on <code className="text-blue-300">http://localhost:3001</code> — accessible from Chrome on the same machine.
          </p>
        </div>
      </div>
    </div>
  );
}
