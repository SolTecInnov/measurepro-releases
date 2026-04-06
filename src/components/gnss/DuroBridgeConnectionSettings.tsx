/**
 * Duro Bridge Connection Settings
 * Simple component to configure the local bridge URL for GNSS data
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { duroGpsService } from '@/lib/gnss/duroGpsService';

const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';

interface DuroBridgeConnectionSettingsProps {
  onConnectionChange?: () => void;
}

export function DuroBridgeConnectionSettings({ onConnectionChange }: DuroBridgeConnectionSettingsProps) {
  const [backendUrl, setBackendUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(BACKEND_URL_KEY) || '';
    setBackendUrl(stored);
    if (stored) {
      testConnection(stored);
    }
  }, []);

  const testConnection = async (url: string) => {
    if (!url) {
      setConnectionStatus('disconnected');
      setLastTestResult('No URL configured');
      return;
    }

    setIsTesting(true);
    try {
      const testUrl = `${url.replace(/\/$/, '')}/api/gnss/live`;
      const response = await fetch(testUrl, { 
        signal: AbortSignal.timeout(3000) 
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.connection?.connected) {
          setConnectionStatus('connected');
          setLastTestResult(`Connected - ${data.connection.totalSamples} samples received`);
        } else {
          setConnectionStatus('disconnected');
          setLastTestResult('Bridge running but Duro not connected');
        }
      } else {
        setConnectionStatus('disconnected');
        setLastTestResult(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      setConnectionStatus('disconnected');
      if (error.name === 'TimeoutError') {
        setLastTestResult('Connection timeout - is the bridge running?');
      } else {
        setLastTestResult(error.message || 'Connection failed');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem(BACKEND_URL_KEY, backendUrl);
    toast.success('Backend URL saved');
    
    if (backendUrl) {
      testConnection(backendUrl);
      if (!duroGpsService.isActive()) {
        duroGpsService.start();
      }
    } else {
      duroGpsService.stop();
      setConnectionStatus('disconnected');
    }
    
    onConnectionChange?.();
  };

  const handleTest = () => {
    testConnection(backendUrl);
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Wifi className="w-5 h-5 text-green-500" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-500" />
          )}
          Duro Bridge Connection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Backend URL</label>
          <div className="flex gap-2">
            <Input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:8765"
              className="flex-1 bg-gray-800 border-gray-700"
              data-testid="input-backend-url"
            />
            <Button 
              onClick={handleTest}
              variant="outline"
              disabled={isTesting || !backendUrl}
              className="border-gray-700"
              data-testid="button-test-connection"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                'Test'
              )}
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-save-url"
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Run <code className="bg-gray-800 px-1 rounded">node tools/duro-local-bridge.js</code> on your laptop to connect
          </p>
        </div>

        {lastTestResult && (
          <div className={`flex items-center gap-2 text-sm ${
            connectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {connectionStatus === 'connected' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {lastTestResult}
          </div>
        )}

        {connectionStatus === 'connected' && (
          <div className="text-xs text-gray-500">
            GPS data will appear in both the main app and this profiling page.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
