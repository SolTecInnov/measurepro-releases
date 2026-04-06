import React from 'react';
import { Wifi, Database, RefreshCw, Trash2, UploadCloud as CloudUpload, Signal, Globe, Clock, Smartphone, Upload, AlertTriangle, CheckCircle } from 'lucide-react';

interface StatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WifiStatusDialog: React.FC<StatusDialogProps> = ({ isOpen, onClose }) => {
  const [networkInfo, setNetworkInfo] = React.useState({
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false
  });
  const [speedTestResult, setSpeedTestResult] = React.useState<{
    download: number;
    upload: number;
    ping: number;
    running: boolean;
  }>({
    download: 0,
    upload: 0,
    ping: 0,
    running: false
  });
  const [connectionHistory, setConnectionHistory] = React.useState<Array<{
    event: string;
    time: string;
  }>>([]);

  // Get real network information
  React.useEffect(() => {
    const updateNetworkInfo = () => {
      // Get network connection info if available
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      if (connection) {
        setNetworkInfo({
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 50,
          saveData: connection.saveData || false
        });
      }
      
      // Load connection history from localStorage
      const history = JSON.parse(localStorage.getItem('connection_history') || '[]');
      setConnectionHistory(history);
    };

    updateNetworkInfo();

    // Listen for network changes
    const handleOnline = () => {
      const newEvent = {
        event: 'Connected to network',
        time: new Date().toLocaleTimeString()
      };
      const history = JSON.parse(localStorage.getItem('connection_history') || '[]');
      const updatedHistory = [newEvent, ...history.slice(0, 9)];
      localStorage.setItem('connection_history', JSON.stringify(updatedHistory));
      setConnectionHistory(updatedHistory);
    };

    const handleOffline = () => {
      const newEvent = {
        event: 'Network disconnected',
        time: new Date().toLocaleTimeString()
      };
      const history = JSON.parse(localStorage.getItem('connection_history') || '[]');
      const updatedHistory = [newEvent, ...history.slice(0, 9)];
      localStorage.setItem('connection_history', JSON.stringify(updatedHistory));
      setConnectionHistory(updatedHistory);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const runSpeedTest = async () => {
    setSpeedTestResult(prev => ({ ...prev, running: true }));
    
    try {
      // Simple speed test using fetch to measure latency and download speed
      const startTime = performance.now();
      
      // Test ping with a small request
      const pingStart = performance.now();
      await fetch('https://www.google.com/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const ping = performance.now() - pingStart;
      
      // Test download speed with a larger file
      const downloadStart = performance.now();
      const response = await fetch('https://httpbin.org/bytes/1000000', {
        cache: 'no-cache'
      });
      const downloadEnd = performance.now();
      const downloadTime = (downloadEnd - downloadStart) / 1000; // Convert to seconds
      const downloadSpeed = (1000000 * 8) / (downloadTime * 1000000); // Mbps
      
      setSpeedTestResult({
        download: downloadSpeed,
        upload: downloadSpeed * 0.8, // Estimate upload as 80% of download
        ping: ping,
        running: false
      });
      
    } catch (error) {
      setSpeedTestResult(prev => ({ ...prev, running: false }));
    }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="w-6 h-6 text-blue-400" />
            Network Status
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">×</button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Signal className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium">Signal Strength</h3>
              </div>
              <div className="text-2xl font-bold">
                {networkInfo.rtt < 100 ? 'Excellent' : 
                 networkInfo.rtt < 200 ? 'Good' : 
                 networkInfo.rtt < 500 ? 'Fair' : 'Poor'}
              </div>
              <div className="text-sm text-gray-400">RTT: {networkInfo.rtt}ms</div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium">Connection Type</h3>
              </div>
              <div className="text-2xl font-bold capitalize">{networkInfo.effectiveType}</div>
              <div className="text-sm text-gray-400">
                {networkInfo.downlink.toFixed(1)} Mbps downlink
              </div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium">Last Check</h3>
              </div>
              <div className="text-xl font-bold">Just now</div>
              <div className="text-sm text-gray-400">
                Status: {navigator.onLine ? 'Online' : 'Offline'}
              </div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium">Network Test</h3>
              </div>
              <button 
                onClick={runSpeedTest}
                disabled={speedTestResult.running}
                className="w-full mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded-lg text-sm"
              >
                {speedTestResult.running ? 'Testing...' : 'Run Speed Test'}
              </button>
              {(speedTestResult.download > 0 || speedTestResult.running) && (
                <div className="mt-2 text-xs space-y-1">
                  <div>Download: {speedTestResult.download.toFixed(1)} Mbps</div>
                  <div>Upload: {speedTestResult.upload.toFixed(1)} Mbps</div>
                  <div>Ping: {speedTestResult.ping.toFixed(0)}ms</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="font-medium mb-4">Connection History</h3>
            {connectionHistory.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No connection events recorded yet
              </div>
            ) : (
              <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
                {connectionHistory.map((event, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{event.event}</span>
                    <span className="text-gray-400">{event.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DatabaseStatusDialog: React.FC<StatusDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Get slave app measurements from localStorage
  const [slaveAppMeasurements, setSlaveAppMeasurements] = React.useState<any[]>([]);
  
  React.useEffect(() => {
    const checkSlaveAppMeasurements = () => {
      const measurementsJson = localStorage.getItem('slaveApp_measurements');
      if (measurementsJson) {
        try {
          const measurements = JSON.parse(measurementsJson);
          setSlaveAppMeasurements(measurements);
        } catch (error) {
          setSlaveAppMeasurements([]);
        }
      } else {
        setSlaveAppMeasurements([]);
      }
    };
    
    // Check on mount and when dialog opens
    checkSlaveAppMeasurements();
    
    // Listen for sync events from slave app
    const handleSlaveAppSync = () => {
      checkSlaveAppMeasurements();
    };
    
    window.addEventListener('slaveApp_sync_complete', handleSlaveAppSync);
    
    return () => {
      window.removeEventListener('slaveApp_sync_complete', handleSlaveAppSync);
    };
  }, [isOpen]);

  // Function to import measurements from slave app
  const importSlaveAppMeasurements = () => {
    // Dispatch event to trigger import in LoggingControls component
    window.dispatchEvent(new CustomEvent('import_slave_app_measurements'));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-400" />
            Offline Storage
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">×</button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Stored Items</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Measurements</span>
                  <span className="font-mono">8</span>
                </div>
                <div className="flex justify-between">
                  <span>Slave App Measurements</span>
                  <span className="font-mono">{slaveAppMeasurements.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Images</span>
                  <span className="font-mono">3</span>
                </div>
                <div className="flex justify-between">
                  <span>POI Notes</span>
                  <span className="font-mono">1</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Storage Usage</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Size</span>
                  <span className="font-mono">24.3 MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Available</span>
                  <span className="font-mono">~5 GB</span>
                </div>
              </div>
            </div>
          </div>

          {slaveAppMeasurements.length > 0 && (
            <div className="bg-purple-500/20 p-4 rounded-lg mt-4 border border-purple-500/30">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-purple-400" />
                Slave App Data
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Pending Measurements</span>
                  <span className="font-mono">{slaveAppMeasurements.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated</span>
                  <span className="text-gray-400">{slaveAppMeasurements.length > 0 ? new Date(slaveAppMeasurements[0].createdAt).toLocaleTimeString() : 'N/A'}</span>
                </div>
                <button
                  onClick={importSlaveAppMeasurements}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Import {slaveAppMeasurements.length} Measurements
                </button>
              </div>
            </div>
          )}

          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="font-medium mb-4">Sync Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Last Sync</span>
                <span className="text-gray-400">2 minutes ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Next Auto-Sync</span>
                <span className="text-gray-400">in 13 minutes</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg">
              <CloudUpload className="w-4 h-4" />
              Force Sync Now
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg">
              <Trash2 className="w-4 h-4" />
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};