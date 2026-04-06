import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer, Mic } from 'lucide-react';

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: black !important; font-size: 8pt; font-family: Arial, sans-serif; }
  .print-page { background: white !important; }
  .doc-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; }
  .card { border: 1px solid #999 !important; background: white !important; break-inside: avoid; page-break-inside: avoid; }
  h3, h4 { break-after: avoid; page-break-after: avoid; }
  .text-blue-400 { color: #1d4ed8 !important; }
  .text-green-400 { color: #15803d !important; }
  .text-yellow-400 { color: #92400e !important; }
  .text-purple-400 { color: #6d28d9 !important; }
  .text-violet-400 { color: #7c3aed !important; }
  .text-amber-400 { color: #92400e !important; }
  .text-red-400 { color: #991b1b !important; }
  .text-cyan-400 { color: #0e7490 !important; }
  .text-orange-400 { color: #c2410c !important; }
  .text-pink-400 { color: #be185d !important; }
  .text-gray-300, .text-gray-400, .text-gray-500 { color: #374151 !important; }
  .text-white { color: #111827 !important; }
  .bg-gray-800, .bg-gray-700, .bg-gray-900 { background: white !important; }
  .border-gray-700, .border-gray-600 { border-color: #d1d5db !important; }
  .phrase { border: 1px solid #374151 !important; background: #f3f4f6 !important; color: #065f46 !important; padding: 0px 4px !important; border-radius: 2px; }
  .header-band { background: #7c3aed !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-violet { background: #5b21b6 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-blue { background: #1e40af !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-green { background: #166534 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-pink { background: #9d174d !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-indigo { background: #3730a3 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-orange { background: #9a3412 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-head-cyan { background: #155e75 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@page { size: letter portrait; margin: 0.9cm 1.1cm; }
`;

function Phrase({ p }: { p: string }) {
  return (
    <span className="phrase inline-block bg-gray-700 border border-gray-600 px-1.5 py-0.5 rounded text-xs font-mono text-green-300 whitespace-nowrap">
      &ldquo;{p}&rdquo;
    </span>
  );
}

function CmdBlock({ phrases, desc }: { phrases: string[]; desc: string }) {
  return (
    <div className="py-0.5 border-b border-gray-700/40 last:border-0">
      <div className="flex flex-wrap gap-1 mb-0.5">
        {phrases.map(p => <Phrase key={p} p={p} />)}
      </div>
      <div className="text-xs text-gray-400">{desc}</div>
    </div>
  );
}

const STATUS_QUERIES = [
  { phrases: ['last measurement', 'last measure', 'last reading', 'previous measurement', 'what was the last measurement'], desc: 'Most recent laser reading' },
  { phrases: ['GPS location', 'GPS position', 'location', 'position', 'where am I', 'coordinates'], desc: 'Current GPS coordinates' },
  { phrases: ['laser status', 'laser state', 'is laser connected', 'laser connection'], desc: 'Laser connection state' },
  { phrases: ['GPS status', 'GPS state', 'is GPS connected', 'GPS connection'], desc: 'GPS connection & fix type' },
  { phrases: ['fix quality', 'signal quality', 'satellite fix', 'fix'], desc: 'Satellite count & accuracy' },
  { phrases: ['speed', 'current speed', 'how fast', 'velocity'], desc: 'Current vehicle speed' },
  { phrases: ["what time is it", 'time', 'current time', 'tell me the time', "what's the time"], desc: 'Current local time' },
  { phrases: ['who are you', 'what is your name', "what's your name", 'who am I talking to', 'identify yourself', 'who is this'], desc: 'Identify the voice assistant' },
];

const GENERAL_ACTIONS = [
  { phrases: ['capture image', 'take photo', 'snap picture', 'capture'], desc: 'Take a photo' },
  { phrases: ['clear alert', 'dismiss alert', 'remove alert'], desc: 'Dismiss current alert' },
  { phrases: ['clear images', 'delete all images', 'remove all photos', 'clear captured images'], desc: 'Delete all captured images' },
  { phrases: ['log measurement', 'save measurement', 'log data', 'record measurement'], desc: 'Save current measurement' },
  { phrases: ['manual log', 'log now', 'create log', 'log entry', 'save measurement'], desc: 'Trigger manual log entry' },
  { phrases: ['record note', 'voice note', 'add note', 'take note'], desc: 'Record a voice note' },
];

const LOGGING_MODES = [
  { phrases: ['start logging', 'begin logging', 'start recording data'], desc: 'Begin data logging' },
  { phrases: ['stop logging', 'end logging', 'stop recording'], desc: 'End data logging' },
  { phrases: ['pause logging', 'pause recording'], desc: 'Pause data logging' },
  { phrases: ['manual mode', 'switch to manual', 'manual logging'], desc: 'Manual logging mode' },
  { phrases: ['all data mode', 'log all data', 'switch to all data'], desc: 'Log all data continuously' },
  { phrases: ['detection mode', 'AI mode', 'switch to detection'], desc: 'AI-triggered logging' },
  { phrases: ['manual detection mode', 'manual detection'], desc: 'Manual AI logging' },
  { phrases: ['counter detection', 'counter detection mode', 'switch to counter detection'], desc: 'Counter detection mode' },
  { phrases: ['clear all alerts', 'dismiss all alerts', 'remove all warnings'], desc: 'Clear all active alerts' },
  { phrases: ['start GPS trace', 'begin GPS tracking', 'start trace'], desc: 'Start GPS trace recording' },
  { phrases: ['toggle video', 'start video', 'stop video', 'record video'], desc: 'Start / stop video recording' },
];

const AI_DETECTION = [
  { phrases: ['accept detection', 'accept', 'confirm detection'], desc: 'Accept AI detection' },
  { phrases: ['reject detection', 'reject', 'deny detection'], desc: 'Reject AI detection' },
  { phrases: ['correct detection', 'fix detection', 'correct'], desc: 'Correct AI detection' },
  { phrases: ['test detection', 'test', 'test AI'], desc: 'Test detection system' },
  { phrases: ['toggle envelope', 'envelope monitoring', 'toggle clearance'], desc: 'Enable/disable envelope monitoring' },
  { phrases: ['cycle profile', 'next vehicle', 'change vehicle', 'switch vehicle'], desc: 'Switch vehicle profile' },
];

const AUDIO_SYSTEM = [
  { phrases: ['volume up', 'increase volume', 'louder', 'turn up'], desc: 'Increase voice response volume' },
  { phrases: ['volume down', 'decrease volume', 'quieter', 'turn down'], desc: 'Decrease voice response volume' },
  { phrases: ['clear warnings', 'clear warning', 'dismiss warnings', 'remove warnings'], desc: 'Clear warning-level alerts' },
  { phrases: ['clear critical', 'clear critical alerts', 'dismiss critical', 'remove critical'], desc: 'Clear critical-level alerts' },
];

const POI_BASIC = [
  { phrases: ['bridge', 'select bridge', 'set bridge'], desc: 'Bridge  ·  Alt+B' },
  { phrases: ['trees', 'tree', 'select trees'], desc: 'Trees  ·  Alt+T' },
  { phrases: ['wire', 'select wire', 'set wire'], desc: 'Wire  ·  Alt+W' },
  { phrases: ['power line', 'powerline', 'select power line'], desc: 'Power Line  ·  Alt+P' },
  { phrases: ['traffic light', 'traffic signal', 'select traffic light'], desc: 'Traffic Light  ·  Alt+L' },
  { phrases: ['walkway', 'walkways', 'pedestrian', 'select walkway'], desc: 'Walkways  ·  Alt+K' },
  { phrases: ['lateral obstruction', 'obstruction', 'select obstruction'], desc: 'Lateral Obstruction  ·  Alt+O' },
  { phrases: ['road', 'select road', 'set road'], desc: 'Road  ·  Alt+R' },
  { phrases: ['intersection', 'select intersection', 'crossroads'], desc: 'Intersection  ·  Alt+I' },
  { phrases: ['signalization', 'sign', 'signage', 'select sign'], desc: 'Signalization  ·  Alt+U' },
  { phrases: ['railroad', 'railway', 'train', 'train track', 'select railroad'], desc: 'Railroad  ·  Alt+Q' },
  { phrases: ['information', 'info', 'select information'], desc: 'Information  ·  Alt+N' },
  { phrases: ['danger', 'hazard', 'warning sign', 'select danger'], desc: 'Danger  ·  Alt+H' },
  { phrases: ['important note', 'note', 'important', 'select note'], desc: 'Important Note  ·  Alt+J' },
  { phrases: ['work required', 'maintenance', 'repair', 'select work required'], desc: 'Work Required  ·  Alt+F' },
  { phrases: ['restricted', 'no access', 'select restricted'], desc: 'Restricted  ·  Alt+X' },
];

const POI_EXTENDED = [
  { phrases: ['bridge and wires', 'bridge wires', 'select bridge and wires'], desc: 'Bridge & Wires  ·  Alt+Shift+B' },
  { phrases: ['overhead structure', 'overhead', 'structure overhead', 'select overhead structure'], desc: 'Overhead Structure  ·  Alt+Shift+O' },
  { phrases: ['optical fiber', 'fiber optic', 'fibre', 'select optical fiber'], desc: 'Optical Fiber  ·  Alt+Shift+F' },
  { phrases: ['grade up', 'uphill grade', 'steep uphill', 'select grade up'], desc: 'Grade Up  ·  Alt+Shift+U' },
  { phrases: ['grade down', 'downhill grade', 'steep downhill', 'select grade down'], desc: 'Grade Down  ·  Alt+Shift+D' },
  { phrases: ['autoturn required', 'autoturn', 'select autoturn'], desc: 'Autoturn Required  ·  Alt+Shift+A' },
  { phrases: ['voice note poi', 'add voice note', 'select voice note'], desc: 'Voice Note POI  ·  Alt+Shift+N' },
  { phrases: ['passing lane', 'overtaking lane', 'select passing lane'], desc: 'Passing Lane  ·  Alt+Shift+L' },
  { phrases: ['parking', 'parking area', 'select parking'], desc: 'Parking  ·  Alt+Shift+K' },
  { phrases: ['gravel road', 'gravel', 'unpaved gravel', 'select gravel road'], desc: 'Gravel Road  ·  Alt+Shift+G' },
  { phrases: ['dead end', 'no through road', 'cul de sac', 'select dead end'], desc: 'Dead End  ·  Alt+E' },
  { phrases: ['culvert', 'select culvert', 'drainage culvert'], desc: 'Culvert  ·  Alt+C' },
  { phrases: ['emergency parking', 'emergency stop', 'select emergency parking'], desc: 'Emergency Parking  ·  Alt+Shift+R' },
  { phrases: ['roundabout', 'traffic circle', 'rotary', 'select roundabout'], desc: 'Roundabout  ·  Alt+Y' },
];

const POI_ADVANCED_GROUPS = [
  {
    group: 'Power & Cable',
    color: 'text-yellow-400',
    items: [
      { phrases: ['power no slack', 'no slack', 'tight power line', 'select power no slack'], desc: 'Power No Slack  ·  Alt+Shift+H' },
      { phrases: ['power slack', 'slack wire', 'sagging power line', 'select power slack'], desc: 'Power Slack  ·  Alt+Shift+V' },
      { phrases: ['high voltage', 'HV line', 'high tension', 'select high voltage'], desc: 'High Voltage  ·  Alt+Shift+Q' },
      { phrases: ['communication cable', 'comm cable', 'telecom cable', 'select communication cable'], desc: 'Communication Cable  ·  Ctrl+Alt+C' },
      { phrases: ['communication cluster', 'comm cluster', 'cable cluster', 'select communication cluster'], desc: 'Communication Cluster  ·  Ctrl+Alt+D' },
    ],
  },
  {
    group: 'Bridges & Tunnels',
    color: 'text-blue-400',
    items: [
      { phrases: ['pedestrian bridge', 'foot bridge', 'walking bridge', 'select pedestrian bridge'], desc: 'Pedestrian Bridge  ·  Ctrl+Alt+P' },
      { phrases: ['motorcycle bridge', 'bike bridge', 'select motorcycle bridge'], desc: 'Motorcycle Bridge  ·  Ctrl+Alt+M' },
      { phrases: ['tunnel', 'underpass tunnel', 'select tunnel'], desc: 'Tunnel  ·  Ctrl+Alt+T' },
      { phrases: ['flyover', 'fly over', 'overpass flyover', 'select flyover'], desc: 'Flyover  ·  Ctrl+Alt+F' },
    ],
  },
  {
    group: 'Traffic Control',
    color: 'text-red-400',
    items: [
      { phrases: ['traffic wire', 'signal wire', 'select traffic wire'], desc: 'Traffic Wire  ·  Ctrl+Alt+W' },
      { phrases: ['traffic mast', 'signal mast', 'select traffic mast'], desc: 'Traffic Mast  ·  Ctrl+Alt+X' },
      { phrases: ['traffic signalization truss', 'signal truss', 'traffic truss', 'select traffic truss'], desc: 'Traffic Signal Truss  ·  Ctrl+Alt+S' },
    ],
  },
  {
    group: 'Infrastructure',
    color: 'text-orange-400',
    items: [
      { phrases: ['toll truss', 'toll gantry', 'select toll truss'], desc: 'Toll Truss  ·  Ctrl+Alt+L' },
      { phrases: ['toll plaza', 'toll booth', 'tollgate', 'select toll plaza'], desc: 'Toll Plaza  ·  Ctrl+Alt+O' },
      { phrases: ['pipe rack', 'pipeline rack', 'select pipe rack'], desc: 'Pipe Rack  ·  Ctrl+Alt+R' },
      { phrases: ['light pole', 'street light', 'lamp post', 'select light pole'], desc: 'Light Pole  ·  Ctrl+Alt+I' },
    ],
  },
  {
    group: 'Railroad',
    color: 'text-amber-400',
    items: [
      { phrases: ['railroad mast', 'railway mast', 'train mast', 'select railroad mast'], desc: 'Railroad Mast  ·  Ctrl+Alt+J' },
      { phrases: ['railroad truss', 'railway truss', 'train truss', 'select railroad truss'], desc: 'Railroad Truss  ·  Ctrl+Alt+K' },
      { phrases: ['railroad crossing', 'level crossing', 'train crossing', 'select railroad crossing'], desc: 'Railroad Crossing  ·  Ctrl+Alt+Q' },
    ],
  },
  {
    group: 'Signage & VMS',
    color: 'text-cyan-400',
    items: [
      { phrases: ['sign mast', 'road sign mast', 'select sign mast'], desc: 'Sign Mast  ·  Ctrl+Alt+G' },
      { phrases: ['sign truss', 'road sign truss', 'sign gantry', 'select sign truss'], desc: 'Sign Truss  ·  Ctrl+Alt+H' },
      { phrases: ['VMS truss', 'variable message sign truss', 'select VMS truss'], desc: 'VMS Truss  ·  Ctrl+Alt+V' },
      { phrases: ['VMS mast', 'variable message sign mast', 'select VMS mast'], desc: 'VMS Mast  ·  Ctrl+Alt+B' },
    ],
  },
  {
    group: 'Road & Turns',
    color: 'text-green-400',
    items: [
      { phrases: ['left turn', 'turn left', 'select left turn'], desc: 'Left Turn  ·  Alt+Shift+I' },
      { phrases: ['right turn', 'turn right', 'select right turn'], desc: 'Right Turn  ·  Alt+Shift+J' },
      { phrases: ['U-turn', 'U turn', 'uturn', 'turnaround', 'select U-turn'], desc: 'U-Turn  ·  Alt+Shift+T' },
      { phrases: ['highway entrance', 'motorway entrance', 'on ramp', 'select highway entrance'], desc: 'Highway Entrance  ·  Alt+Shift+W' },
      { phrases: ['highway exit', 'motorway exit', 'off ramp', 'select highway exit'], desc: 'Highway Exit  ·  Alt+Shift+X' },
      { phrases: ['unpaved road', 'dirt road', 'unsealed road', 'select unpaved road'], desc: 'Unpaved Road  ·  Ctrl+Alt+2' },
    ],
  },
  {
    group: 'Notes & Misc',
    color: 'text-purple-400',
    items: [
      { phrases: ['clear note', 'erase note', 'remove note', 'select clear note'], desc: 'Clear Note  ·  Alt+Shift+Z' },
      { phrases: ['log note', 'add log note', 'select log note'], desc: 'Log Note  ·  Ctrl+Alt+N' },
      { phrases: ['construction', 'construction zone', 'road works', 'select construction'], desc: 'Construction  ·  Ctrl+Alt+E' },
      { phrases: ['gate', 'access gate', 'barrier gate', 'select gate'], desc: 'Gate  ·  Ctrl+Alt+U' },
      { phrases: ['pitch', 'pitch measurement', 'select pitch'], desc: 'Pitch  ·  Ctrl+Alt+Y' },
      { phrases: ['roll', 'roll measurement', 'side slope', 'select roll'], desc: 'Roll  ·  Ctrl+Alt+Z' },
    ],
  },
];

export default function VoiceCommandsPage() {
  useEffect(() => { document.title = 'Voice Command Reference — MeasurePRO'; }, []);

  return (
    <div className="print-page min-h-screen bg-gray-900 text-gray-100">
      <style>{PRINT_STYLES}</style>

      <div className="no-print sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <Link to="/docs" className="text-gray-300 hover:text-white flex items-center gap-2 text-sm" data-testid="link-back-voice">
          <ArrowLeft className="w-4 h-4" /> Documents
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs hidden sm:block">Print on Letter · Portrait</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            data-testid="button-print-voice"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="doc-container max-w-4xl mx-auto px-6 py-6">

        {/* HEADER BAND */}
        <div className="doc-section header-band bg-violet-700 text-white rounded-t-lg px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mic className="w-7 h-7 opacity-80" />
              <div>
                <div className="text-xs opacity-75 font-semibold tracking-widest uppercase">SolTec Innovation</div>
                <h1 className="text-xl font-black">Voice Command Reference — MeasurePRO</h1>
              </div>
            </div>
            <div className="text-right text-xs opacity-75">
              <div>measure-pro.app</div><div>support@soltec.ca</div>
            </div>
          </div>
        </div>

        {/* INTRO NOTE */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-2">
          <p className="text-xs text-gray-300">
            Enable in <strong className="text-white">Settings → Voice Commands</strong>.
            All phrases listed are exact English spoken phrases recognized by the engine — partial matches and alternate phrasings are also accepted.
            Requires Chrome or Edge (desktop) and an internet connection for speech recognition.
            Say <strong className="text-white">&ldquo;help&rdquo;</strong> at any time to hear a summary of available commands.
          </p>
        </div>

        {/* ROW 1: Status + General + Audio/AI */}
        <div className="doc-section grid grid-cols-3 gap-0">
          <div className="card bg-gray-800 border border-gray-700 border-t-0 border-r-0 px-4 py-3">
            <div className="section-head-blue bg-blue-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-1">Status Queries</div>
            <div className="space-y-1">
              {STATUS_QUERIES.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
            </div>
          </div>

          <div className="card bg-gray-800 border border-gray-700 border-t-0 border-r-0 px-4 py-3">
            <div className="section-head-violet bg-violet-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-1">General Actions</div>
            <div className="space-y-1">
              {GENERAL_ACTIONS.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
            </div>
          </div>

          <div className="card bg-gray-800 border border-gray-700 border-t-0 px-4 py-3">
            <div className="section-head-violet bg-violet-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-1">Audio & System</div>
            <div className="space-y-1 mb-3">
              {AUDIO_SYSTEM.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
            </div>
            <div className="section-head-cyan bg-cyan-900 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-1 mt-2">AI Detection (MeasurePRO+)</div>
            <div className="space-y-1">
              {AI_DETECTION.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
            </div>
          </div>
        </div>

        {/* Logging & Modes — full width */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3">
          <div className="section-head-green bg-green-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-2">Logging &amp; Mode Control</div>
          <div className="grid grid-cols-3 gap-x-5">
            {LOGGING_MODES.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
          </div>
        </div>

        {/* POI Basic — full width */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3">
          <div className="section-head-pink bg-pink-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-2">POI Types — Basic (16 types)</div>
          <div className="grid grid-cols-2 gap-x-5">
            {POI_BASIC.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
          </div>
        </div>

        {/* POI Extended — full width */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3">
          <div className="section-head-indigo bg-indigo-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-2">POI Types — Extended (14 types)</div>
          <div className="grid grid-cols-2 gap-x-5">
            {POI_EXTENDED.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
          </div>
        </div>

        {/* POI Advanced */}
        <div className="doc-section card bg-gray-800 border border-gray-700 border-t-0 px-5 py-3">
          <div className="section-head-orange bg-orange-800 text-white text-xs font-bold px-3 py-1 rounded mb-2 uppercase tracking-wide -mx-2">POI Types — Advanced (35 types)</div>
          <div className="grid grid-cols-2 gap-x-6">
            {POI_ADVANCED_GROUPS.map(group => (
              <div key={group.group} className="mb-2">
                <div className={`text-xs font-bold mb-1 ${group.color}`}>{group.group}</div>
                {group.items.map(r => <CmdBlock key={r.phrases[0]} {...r} />)}
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-gray-800 border border-gray-700 border-t-0 rounded-b-lg px-5 py-2 flex justify-between text-xs text-gray-500">
          <span>MeasurePRO · SolTec Innovation · © {new Date().getFullYear()}</span>
          <span>Chrome/Edge required · Internet required for voice recognition · measure-pro.app</span>
        </div>
      </div>
    </div>
  );
}
