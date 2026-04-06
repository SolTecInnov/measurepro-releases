import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useRemoteStore, type RemoteButton, type RemoteMapping } from '../../lib/remote';

const RemoteSettings = () => {
  const { mapping, updateButton, connected, connect, disconnect } = useRemoteStore();
  const [error, setError] = React.useState<string | null>(null);

  // Check if Web HID API is available
  const isHIDSupported = 'hid' in navigator;

  const handleConnect = async () => {
    try {
      setError(null);
      await connect();
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      if (error.name === 'SecurityError') {
        setError('Permission denied. Please ensure you are using Chrome or Edge and the site has permission to access USB devices.');
      } else if (error.name === 'NotFoundError') {
        setError('No device selected. Please make sure your remote is connected and try again.');
      } else {
        setError(error.message || 'Unknown error');
      }
    }
  };

  const handleButtonAssign = (action: keyof RemoteMapping, button: RemoteButton) => {
    updateButton(action, button);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Remote Control Settings</h2>
      
      {!isHIDSupported && (
        <div className="bg-red-500/20 border-l-4 border-red-500 p-4 rounded mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="font-bold text-red-500">Web HID API Not Supported</h3>
              <p className="text-gray-300">Your browser does not support USB HID devices. Please use Chrome or Edge.</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Button Mapping</h3>
            <div className="space-y-4">
              {Object.entries(mapping || {}).map(([action, button]) => (
                <div key={action} className="flex items-center justify-between">
                  <span>{button.description}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={button.id}
                      onChange={(e) => handleButtonAssign(action as keyof RemoteMapping, {
                        id: Number(e.target.value),
                        name: `Button ${e.target.value}`,
                        description: button.description,
                        vendorId: button.vendorId,
                        productId: button.productId,
                        buttonCode: button.buttonCode
                      })}
                      className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>Button {num}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-4">Remote Status</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{connected ? 'Connected' : 'Not Connected'}</span>
              </div>
              <button
                onClick={connected ? disconnect : handleConnect}
                disabled={!isHIDSupported}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  connected
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {connected ? 'Disconnect' : 'Connect Remote'}
              </button>

              <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Remote Information</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>Model:</span>
                    <span>Mirabox MBox N1</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buttons:</span>
                    <span>8 programmable</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection:</span>
                    <span>USB-C</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Signal:</span>
                    <span>{connected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-500/20 border-l-4 border-red-500 rounded">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoteSettings;