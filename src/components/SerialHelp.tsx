import React from 'react';
import { HelpCircle, Info, RefreshCw } from 'lucide-react';

const SerialHelp: React.FC = () => {
  return (
    <div className="bg-gray-800 rounded-xl p-6 my-4">
      <div className="flex items-center gap-3 mb-4">
        <HelpCircle className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold">Serial Port Help</h2>
      </div>

      <div className="space-y-4 text-gray-300">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-yellow-400 mt-0.5" />
          <p>
            <strong>Web browsers cannot directly access COM ports from Windows Device Manager.</strong> This application uses the Web Serial API which needs explicit user permission.
          </p>
        </div>

        <h3 className="font-medium text-lg mt-4">How to connect your devices:</h3>
        
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Make sure your USB device is physically connected to your computer</li>
          <li>Click the "Add Port" button when prompted</li>
          <li>In the browser dialog, select your device from the list (it will NOT show as COM3/COM8)</li>
          <li>If your device doesn't appear, check that drivers are installed correctly</li>
        </ol>

        <div className="bg-gray-700 p-4 rounded-md mt-4">
          <h4 className="font-medium mb-2">Common issues:</h4>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Some USB devices require special drivers to work with Web Serial</li>
            <li>For SolTec-30m, use baudRate 115200</li>
            <li>Permission to access serial ports must be explicitly granted in the browser</li>
            <li>Only Chrome and Edge browsers fully support the Web Serial API</li>
            <li>The application must be running on HTTPS or localhost</li>
            <li>Some USB-to-Serial adapters may not be compatible with Web Serial</li>
            <li>If permission dialogs are blocked, check your browser toolbar for a blocked permissions icon</li>
          </ul>
        </div>

        <div className="bg-blue-600/20 border-l-4 border-blue-600 p-4 rounded-md mt-4">
          <h4 className="font-medium mb-2">Permission troubleshooting:</h4>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Click the "Reset" button next to the connection status to reset the Web Serial connection</li>
            <li>Use the "Run Diagnostic" button in the Serial Tester to diagnose connection issues</li>
            <li>Look for a permission dialog in your browser (sometimes it appears in the address bar or as a popup)</li>
            <li>Try opening the site in a new tab or window</li>
            <li>Ensure your browser is up to date</li>
            <li>Try using Chrome or Edge if you're on a different browser</li>
          </ol>
        </div>

        <div className="bg-yellow-600/20 border-l-4 border-yellow-600 p-4 rounded-md mt-4">
          <h4 className="font-medium mb-2">Important COM port differences:</h4>
          <p className="mb-2">Web browsers <strong>cannot</strong> directly access Windows COM ports by name (COM3, COM8, etc.).</p>
          <p>Instead, they use the Web Serial API which:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Shows devices by their USB identifiers (VID/PID), not COM port names</li>
            <li>Requires explicit user permission for each connection attempt</li>
            <li>Only works in Chrome and Edge browsers</li>
            <li>Cannot automatically reconnect to devices without user interaction</li>
            <li>May conflict with other applications using the same device</li>
          </ul>
          <p className="mt-2 text-sm">To connect your COM3/COM8 devices, you need to select them in the browser's device picker dialog when prompted.</p>
        </div>

        <p className="mt-4 text-sm italic">
          Tip: Try closing other applications that might be using your serial devices, and use the Serial Tester tool to diagnose connection issues.
        </p>
          
          <div className="mt-4 bg-yellow-600/20 p-3 rounded-lg">
            <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-yellow-400" />
              When to use the Reset button
            </h5>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>When the device is connected but not sending data</li>
              <li>After disconnecting and reconnecting a USB device</li>
              <li>When you see "Permission denied" errors</li>
              <li>When the browser seems to have lost connection to the device</li>
              <li>As a first troubleshooting step before reloading the page</li>
            </ul>
          </div>
      </div>
    </div>
  );
};

export default SerialHelp;