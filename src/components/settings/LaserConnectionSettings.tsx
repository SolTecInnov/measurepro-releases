/**
 * LaserConnectionSettings — Windows-style laser configuration
 * COM port, baud rate, format selection, live test output
 */
import React, { useState, useEffect, useRef } from 'react';
import { Zap, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const LASER_FORMATS = [
  { id: 'ldm71',      label: 'Jenoptik / Soltec LDM71',   desc: 'D xxxx.xxx ampl\\r\\n' },
  { id: 'acuity',     label: 'Acuity AR700/1000',           desc: '±xxxxxx\\r\\n (µm)' },
  { id: 'dimetix',    label: 'Dimetix FLS / DLS',           desc: 'g0±xxxxxxxxxx\\r\\n (µm)' },
  { id: 'astech',     label: 'Astech (legacy)',              desc: '[LASER] D -> x.xxx m' },
  { id: 'generic_m',  label: 'Generic — float meters',      desc: 'x.xxx\\r\\n' },
  { id: 'generic_mm', label: 'Generic — integer mm',        desc: 'xxxx\\r\\n' },
];

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

export default function LaserConnectionSettings() {
  const [ports, setPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState(() => localStorage.getItem('laser_com_port') || '');
  const [selectedBaud, setSelectedBaud] = useState(() => parseInt(localStorage.getItem('laser_baud') || '115200'));
  const [selectedFormat, setSelectedFormat] = useState(() => localStorage.getItem('laser_format') || 'ldm71');
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const isElectron = !!(window as any).electronAPI?.isElectron;

  useEffect(() => {
    // Load available COM ports via Electron IPC (no dialog needed)
    const api = (window as any).electronAPI?.laser;
    if (api?.listPorts) {
      api.listPorts().then((portList: any[]) => {
        if (portList.length > 0) {
          setPorts(portList.map(p => p.path));
          // Auto-select first port if none saved
          if (!selectedPort && portList.length > 0) {
            setSelectedPort(portList[0].path);
          }
        }
      }).catch(() => {});
    }
  }, []);

  const save = () => {
    localStorage.setItem('laser_com_port', selectedPort);
    localStorage.setItem('laser_baud', String(selectedBaud));
    localStorage.setItem('laser_format', selectedFormat);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestOutput(['Connecting...']);
    save();

    // Try to open the serial port
    if (!('serial' in navigator)) {
      setTestOutput(['Web Serial API not available. Connect laser via the main interface.']);
      setIsTesting(false);
      return;
    }

    try {
      const port = await (navigator.serial as any).requestPort();
      await port.open({ baudRate: selectedBaud });
      setIsConnected(true);
      setTestOutput(['Connected! Waiting for data...']);

      const reader = port.readable.getReader();
      const lines: string[] = [];
      let buffer = '';

      const timeout = setTimeout(() => {
        reader.cancel();
        if (lines.length === 0) {
          setTestOutput(['No data received in 5 seconds. Check cable and laser power.']);
        }
        setIsTesting(false);
        setIsConnected(false);
        port.close().catch(() => {});
      }, 5000);

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          buffer += text;
          const parts = buffer.split(/\r?\n/);
          buffer = parts.pop() || '';
          for (const line of parts) {
            if (line.trim()) {
              lines.push(line.trim());
              setTestOutput([...lines.slice(-10)]);
              if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
            }
          }
          if (lines.length >= 10) {
            clearTimeout(timeout);
            reader.cancel();
            setIsTesting(false);
            setIsConnected(false);
            port.close().catch(() => {});
            break;
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setTestOutput([...lines, `Error: ${e.message}`]);
        }
        setIsTesting(false);
        setIsConnected(false);
      }
    } catch (e: any) {
      setTestOutput([`Connection failed: ${e.message}`]);
      setIsTesting(false);
      setIsConnected(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 4
  };
  const selectStyle: React.CSSProperties = {
    width: '100%', background: '#1E293B', border: '1px solid #334155',
    color: '#E2E8F0', borderRadius: 6, padding: '8px 10px', fontSize: 13,
  };

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Zap size={18} color="#FF6B2B" />
        <h3 style={{ color: '#E2E8F0', fontSize: 16, fontWeight: 700, margin: 0 }}>Laser Connection</h3>
        {isConnected && <span style={{ background: '#14532D', color: '#4ADE80', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> Connected</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>COM Port</label>
          <select value={selectedPort} onChange={e => setSelectedPort(e.target.value)} style={selectStyle}>
            <option value="">— Select port —</option>
            {BAUD_RATES.map((_, i) => <option key={i} value={`COM${i+1}`}>COM{i+1}</option>)}
            {['COM3','COM4','COM5','COM6','COM7','COM8','COM9','COM10'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Or use "Test" to select from system</div>
        </div>

        <div>
          <label style={labelStyle}>Baud Rate</label>
          <select value={selectedBaud} onChange={e => setSelectedBaud(parseInt(e.target.value))} style={selectStyle}>
            {BAUD_RATES.map(b => <option key={b} value={b}>{b.toLocaleString()}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Laser Format</label>
        <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)} style={selectStyle}>
          {LASER_FORMATS.map(f => (
            <option key={f.id} value={f.id}>{f.label} — {f.desc}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => { save(); }}
          style={{ flex: 1, background: '#1E3A5F', border: '1px solid #2563EB', color: '#93C5FD', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Save Settings
        </button>
        <button
          onClick={testConnection}
          disabled={isTesting}
          style={{ flex: 1, background: isTesting ? '#1F2937' : '#1A1F2E', border: `1px solid ${isTesting ? '#374151' : '#FF6B2B'}`, color: isTesting ? '#6B7280' : '#FF6B2B', borderRadius: 8, padding: '8px 0', cursor: isTesting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {isTesting ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Testing...</> : '⚡ Test Connection'}
        </button>
      </div>

      {/* Raw output */}
      <div>
        <label style={labelStyle}>Raw Laser Output (last 10 lines)</label>
        <div
          ref={outputRef}
          style={{
            background: '#0D1117', border: '1px solid #1E293B', borderRadius: 6,
            padding: '10px 12px', height: 160, overflowY: 'auto',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#4ADE80',
          }}>
          {testOutput.length === 0
            ? <span style={{ color: '#374151' }}>Click "Test Connection" to see live laser output...</span>
            : testOutput.map((line, i) => <div key={i}>{line}</div>)
          }
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '8px 12px', background: '#0F172A', borderRadius: 6, border: '1px solid #1E293B' }}>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
          <strong style={{ color: '#94A3B8' }}>Format guide:</strong><br/>
          LDM71: <code style={{ color: '#4ADE80' }}>D 0005.230 021.9</code> — distance + amplitude<br/>
          Acuity: <code style={{ color: '#4ADE80' }}>+005230</code> — signed integer in µm (÷1000 = m)<br/>
          Dimetix: <code style={{ color: '#4ADE80' }}>g0+00005230</code> — signed, 10 digits, µm (÷1000 = m)<br/>
          Generic: <code style={{ color: '#4ADE80' }}>5.230</code> — float in meters
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
