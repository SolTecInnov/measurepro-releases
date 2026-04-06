/**
 * UpdateNotification — listens for update-status events from Electron
 * and shows a non-intrusive banner at the bottom of the screen.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, Download, RefreshCw } from 'lucide-react';

interface UpdateState {
  status: 'idle' | 'downloading' | 'progress' | 'ready';
  version?: string;
  percent?: number;
  speed?: number;
}

export default function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' });

  useEffect(() => {
    if (!window.electronAPI?.updater) return;

    window.electronAPI.updater.onStatus((data) => {
      if (data.status === 'downloading') {
        setUpdate({ status: 'downloading', version: data.version });
      } else if (data.status === 'progress') {
        setUpdate(prev => ({ ...prev, status: 'progress', percent: data.percent, speed: data.speed }));
      } else if (data.status === 'ready') {
        setUpdate({ status: 'ready', version: data.version });
      }
    });
  }, []);

  if (update.status === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-blue-500 rounded-lg shadow-xl p-4 max-w-sm">
      {update.status === 'downloading' && (
        <div className="flex items-center gap-3">
          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
          <div>
            <p className="text-white text-sm font-medium">Téléchargement de la mise à jour</p>
            <p className="text-gray-400 text-xs">MeasurePRO {update.version}</p>
          </div>
        </div>
      )}

      {update.status === 'progress' && (
        <div>
          <div className="flex justify-between mb-1">
            <p className="text-white text-sm font-medium">Téléchargement en cours...</p>
            <span className="text-blue-400 text-sm">{update.percent}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${update.percent}%` }}
            />
          </div>
          {update.speed && (
            <p className="text-gray-400 text-xs mt-1">{update.speed} KB/s</p>
          )}
        </div>
      )}

      {update.status === 'ready' && (
        <div>
          <p className="text-white text-sm font-medium mb-1">
            <CheckCircle className="w-4 h-4 text-green-400 inline mr-1" /> Mise à jour prête — MeasurePRO {update.version}
          </p>
          <p className="text-gray-400 text-xs mb-3">
            Sera installée à la fermeture de l'app.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => window.electronAPI?.updater?.install()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 px-3 rounded transition-colors"
            >
              Redémarrer maintenant
            </button>
            <button
              onClick={() => setUpdate({ status: 'idle' })}
              className="text-gray-400 hover:text-white text-xs py-1.5 px-3 rounded transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
