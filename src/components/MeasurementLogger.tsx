import React, { useState, useEffect } from 'react';
import { FileDown, FileJson, FileSpreadsheet, Trash2 } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  measurement: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
}

interface MeasurementLoggerProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const MeasurementLogger: React.FC<MeasurementLoggerProps> = ({ enabled, onToggle }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Add a new log entry
  const addLogEntry = (measurement: string, gpsData: any) => {
    const now = new Date();
    // Convert UTC to GMT-5
    now.setHours(now.getHours() - 5);
    
    const entry: LogEntry = {
      timestamp: now.toISOString().replace('Z', '-05:00'),
      measurement,
      latitude: gpsData.latitude || 0,
      longitude: gpsData.longitude || 0,
      altitude: gpsData.altitude || 0,
      speed: gpsData.speed || 0,
      course: gpsData.course || 0
    };

    setLogs(prevLogs => [entry, ...prevLogs].slice(0, 10));
  };

  // Export logs as CSV
  const exportCSV = () => {
    const headers = ['Timestamp (GMT-5)', 'Measurement', 'Latitude', 'Longitude', 'Altitude', 'Speed', 'Course'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        log.timestamp,
        log.measurement,
        log.latitude.toFixed(6),
        log.longitude.toFixed(6),
        log.altitude.toFixed(2),
        log.speed.toFixed(2),
        log.course.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `measurements_${new Date().toISOString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export logs as JSON
  const exportJSON = () => {
    const jsonContent = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `measurements_${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600"
            />
            <span className="text-sm font-medium">Log Measurements</span>
          </label>
          <div className="text-xs text-gray-400">
            All times in GMT-5
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportJSON}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
          >
            <FileJson className="w-4 h-4" />
            JSON
          </button>
          <button
            onClick={() => setLogs([])}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-2 text-left text-gray-400">Time (GMT-5)</th>
              <th className="px-4 py-2 text-left text-gray-400">Measurement</th>
              <th className="px-4 py-2 text-left text-gray-400">Latitude</th>
              <th className="px-4 py-2 text-left text-gray-400">Longitude</th>
              <th className="px-4 py-2 text-left text-gray-400">Altitude</th>
              <th className="px-4 py-2 text-left text-gray-400">Speed</th>
              <th className="px-4 py-2 text-left text-gray-400">Course</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No measurements logged yet
                </td>
              </tr>
            ) : (
              logs.map((log, i) => (
                <tr key={i} className="border-t border-gray-700">
                  <td className="px-4 py-2 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="px-4 py-2 font-mono">{log.measurement}m</td>
                  <td className="px-4 py-2 font-mono">{log.latitude.toFixed(6)}°</td>
                  <td className="px-4 py-2 font-mono">{log.longitude.toFixed(6)}°</td>
                  <td className="px-4 py-2 font-mono">{log.altitude.toFixed(2)}m</td>
                  <td className="px-4 py-2 font-mono">{log.speed.toFixed(2)}km/h</td>
                  <td className="px-4 py-2 font-mono">{log.course.toFixed(2)}°</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MeasurementLogger;