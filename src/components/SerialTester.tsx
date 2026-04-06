import React, { useState, useEffect } from 'react';
import { Zap, RefreshCw, X, Check, Shield, Gauge, FileDown } from 'lucide-react';

const SerialTester: React.FC = () => {
  const [output, setOutput] = useState<string>("Serial Port Diagnostic Tool\n");
  const [availablePorts, setAvailablePorts] = useState<SerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState<SerialPort | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [baudRate, setBaudRate] = useState<number>(4800);

  useEffect(() => {
    refreshPorts();
  }, []);

  const refreshPorts = async () => {
    try {
      const ports = await navigator.serial.getPorts();
      setAvailablePorts(ports);
      setOutput(prev => `${prev}\nFound ${ports.length} authorized ports\n`);
    } catch (error) {
      setOutput(prev => `${prev}\nError listing ports: ${error.message}\n`);
    }
  };

  const requestPort = async () => {
    try {
      setOutput(prev => `${prev}\nRequesting user to select a port...\n`);
      const port = await navigator.serial.requestPort();
      const info = port.getInfo();
      setSelectedPort(port);
      setOutput(prev => `${prev}Selected port: VID=0x${info.usbVendorId?.toString(16)}, PID=0x${info.usbProductId?.toString(16)}\n`);

      // Add to available ports if not already there
      if (!availablePorts.includes(port)) {
        setAvailablePorts(prev => [...prev, port]);
      }
    } catch (error) {
      if (error.name === 'NotFoundError') {
        setOutput(prev => `${prev}Port selection cancelled by user\n`);
      } else if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        setOutput(prev => `${prev}❌ Permission denied: ${error.message}\n`);
        setOutput(prev => `${prev}Please ensure you are using Chrome/Edge and allow serial port access\n`);
      } else {
        setOutput(prev => `${prev}❌ Error requesting port: ${error.message}\n`);
      }
    }
  };

  const connect = async () => {
    if (!selectedPort) {
      setOutput(prev => `${prev}\nNo port selected. Please select a port first.\n`);
      return;
    }

    try {
      setOutput(prev => `${prev}\nAttempting to open port at ${baudRate} baud...\n`);
      // Only specify baudRate, let the browser handle the rest
      await selectedPort.open({ baudRate });
      setIsConnected(true);
      setOutput(prev => `${prev}✅ Successfully connected!\n`);

      // Set up reader
      const textDecoder = new TextDecoder();
      const reader = selectedPort.readable?.getReader();

      if (reader) {
        setOutput(prev => `${prev}Reading data (will display for 10 seconds)...\n`);

        // Read for a limited time (10 seconds)
        setTimeout(() => {
          reader.cancel();
          setOutput(prev => `${prev}Stopped reading after timeout.\n`);
        }, 10000);

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const text = textDecoder.decode(value);
            if (text.trim()) {
              setOutput(prev => `${prev}Received: ${text}\n`);
            }
          }
        } catch (error) {
          setOutput(prev => `${prev}Error reading: ${error.message}\n`);
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      setOutput(prev => `${prev}❌ Connection failed: ${error.message}\n`);
    }
  };

  const disconnect = async () => {
    if (!selectedPort) return;

    try {
      setOutput(prev => `${prev}\nClosing connection...\n`);
      await selectedPort.close();
      setIsConnected(false);
      setOutput(prev => `${prev}✅ Port closed successfully\n`);
    } catch (error) {
      setOutput(prev => `${prev}Error closing port: ${error.message}\n`);
    }
  };

  const runDiagnostic = async () => {
    setOutput("Running Web Serial API diagnostic...\n");

    try {
      // Check if Web Serial API is available
      if ('serial' in navigator) {
        setOutput(prev => prev + "✅ Web Serial API is available\n");
      } else {
        setOutput(prev => prev + "❌ Web Serial API is NOT available in this browser\n");
        return;
      }

      // Check if we're in a secure context
      if (window.isSecureContext) {
        setOutput(prev => prev + "✅ Running in a secure context\n");
      } else {
        setOutput(prev => prev + "❌ Not running in a secure context (HTTPS required)\n");
      }

      // Check for previously authorized ports
      const ports = await navigator.serial.getPorts();
      setOutput(prev => prev + `✅ Found ${ports.length} previously authorized ports\n`);

      ports.forEach((port, index) => {
        const info = port.getInfo();
        setOutput(prev => prev + `   Port ${index + 1}: VID=0x${info.usbVendorId?.toString(16)}, PID=0x${info.usbProductId?.toString(16)}\n`);
      });

      // Test creating a port without filters
      setOutput(prev => prev + "\nAttempting to request any serial device without filters...\n");
      try {
        const port = await navigator.serial.requestPort();
        const info = port.getInfo();
        setOutput(prev => prev + `✅ Successfully requested port: VID=0x${info.usbVendorId?.toString(16)}, PID=0x${info.usbProductId?.toString(16)}\n`);

        // Try to open the port with basic settings
        try {
          await port.open({ baudRate: 9600 });
          setOutput(prev => prev + "✅ Successfully opened port at 9600 baud\n");
          await port.close();
        } catch (err) {
          setOutput(prev => prev + `❌ Failed to open port: ${err.message}\n`);
        }
      } catch (err) {
        setOutput(prev => prev + `❌ Failed to request port: ${err.message}\n`);
      }

      // Test browser storage for ports
      setOutput(prev => prev + "\nVerifying browser storage for serial ports...\n");
      const portsAfter = await navigator.serial.getPorts();
      if (portsAfter.length > ports.length) {
        setOutput(prev => prev + "✅ Browser successfully stored the new port\n");
      } else {
        setOutput(prev => prev + "⚠️ Browser may not be storing ports correctly\n");
      }

    } catch (err) {
      setOutput(prev => prev + `❌ Error during diagnostic: ${err.message}\n`);
    }
  };

  const buttonClasses = "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors";
  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-gray-800 text-gray-200 rounded-xl p-4 shadow-lg">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <Zap className="w-5 h-5 mr-2 text-yellow-400" />
        Serial Diagnostic Tool
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="mb-4">
            <button
              onClick={runDiagnostic}
              className={`${buttonClasses} bg-purple-600 hover:bg-purple-700 w-full`}
            >
              <Gauge className="w-4 h-4" />
              Run Full Web Serial Diagnostic
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={refreshPorts}
              className={`${buttonClasses} bg-blue-600 hover:bg-blue-700 flex-1`}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Ports
            </button>

            <button
              onClick={requestPort}
              className={`${buttonClasses} bg-green-600 hover:bg-green-700 flex-1`}
            >
              <Shield className="w-4 h-4" />
              Request Port
            </button>
          </div>

          <div className="mb-4">
            <label className="block mb-1 text-sm">Select Port:</label>
            <select 
              className={commonInputClasses}
              onChange={(e) => {
                const portIndex = parseInt(e.target.value);
                if (!isNaN(portIndex) && portIndex >= 0) {
                  setSelectedPort(availablePorts[portIndex]);
                  const info = availablePorts[portIndex].getInfo();
                  setOutput(prev => `${prev}\nSelected port: VID=0x${info.usbVendorId?.toString(16)}, PID=0x${info.usbProductId?.toString(16)}\n`);
                } else {
                  setSelectedPort(null);
                }
              }}
              disabled={isConnected}
            >
              <option value={-1}>Select a port</option>
              {availablePorts.map((port, index) => {
                const info = port.getInfo();
                return (
                  <option key={index} value={index}>
                    Port {index + 1}: VID=0x{info.usbVendorId?.toString(16)}, PID=0x{info.usbProductId?.toString(16)}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="mb-4">
            <label className="block mb-1 text-sm">Baud Rate:</label>
            <select 
              className={commonInputClasses}
              value={baudRate}
              onChange={(e) => setBaudRate(parseInt(e.target.value))}
              disabled={isConnected}
            >
              <option value={1200}>1200</option>
              <option value={2400}>2400</option>
              <option value={4800}>4800</option>
              <option value={9600}>9600</option>
              <option value={19200}>19200</option>
              <option value={38400}>38400</option>
              <option value={57600}>57600</option>
              <option value={115200}>115200</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={connect}
              disabled={!selectedPort || isConnected}
              className={`${buttonClasses} ${!selectedPort || isConnected ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'} flex-1`}
            >
              <Check className="w-4 h-4" />
              Connect
            </button>

            <button
              onClick={disconnect}
              disabled={!isConnected}
              className={`${buttonClasses} ${!isConnected ? 'bg-gray-500' : 'bg-red-600 hover:bg-red-700'} flex-1`}
            >
              <X className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm">Console Output:</label>
            <button
              onClick={() => setOutput("Serial Port Diagnostic Tool\n")}
              className="text-sm text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-3 rounded-lg h-[400px] overflow-y-auto text-xs font-mono whitespace-pre-wrap">
            {output}
          </pre>
          <button
            onClick={() => {
              // Export diagnostic log to a file
              const blob = new Blob([output], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'serial-diagnostic.log';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className={`${buttonClasses} bg-gray-600 hover:bg-gray-700 mt-2 w-full`}
          >
            <FileDown className="w-4 h-4" />
            Save Diagnostic Log
          </button>
        </div>
      </div>

      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 mt-4">
        <h3 className="font-medium mb-2">Troubleshooting Tips:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>For SolTec-30m, try baudRate 921600</li>
          <li>For GPS devices, try baudRate 4800</li>
          <li>Make sure you are using a supported browser (Chrome or Edge)</li>
          <li>Ensure your device has the correct drivers installed</li>
          <li>Some USB devices may require specific connection sequences</li>
          <li>Try unplugging and reconnecting your device</li>
          <li>Check your USB-to-Serial adapter compatibility</li>
          <li>Remember that you must explicitly grant permission for each device</li>
        </ul>
      </div>
    </div>
  );
};

export default SerialTester;