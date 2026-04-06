import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkerOrchestrator } from '@/hooks/useWorkerOrchestrator';
import { Database, Trash2, RefreshCw, Eye } from 'lucide-react';
import type { PoiEventRecord } from '../../shared/worker-types';

export default function DebugIndexedDB() {
  const { status, isReady } = useWorkerOrchestrator();
  const [totalRecords, setTotalRecords] = useState(0);
  const [records, setRecords] = useState<PoiEventRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PoiEventRecord | null>(null);
  const [loading, setLoading] = useState(false);
  
  const loadRecords = async () => {
    setLoading(true);
    try {
      const { openDB } = await import('idb');
      const db = await openDB('measurepro-v2', 1);
      
      const tx = db.transaction('poiEvents', 'readonly');
      const store = tx.objectStore('poiEvents');
      const all = await store.getAll();
      
      setRecords(all.slice(0, 100));
      setTotalRecords(all.length);
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const deleteRecord = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    
    try {
      const { openDB } = await import('idb');
      const db = await openDB('measurepro-v2', 1);
      
      const tx = db.transaction('poiEvents', 'readwrite');
      await tx.objectStore('poiEvents').delete(id);
      await tx.done;
      
      await loadRecords();
    } catch (error) {
      console.error('Failed to delete record:', error);
    }
  };
  
  const clearAllRecords = async () => {
    if (!confirm('DELETE ALL RECORDS? This cannot be undone!')) return;
    
    try {
      const { openDB } = await import('idb');
      const db = await openDB('measurepro-v2', 1);
      
      const tx = db.transaction('poiEvents', 'readwrite');
      await tx.objectStore('poiEvents').clear();
      await tx.done;
      
      setRecords([]);
      setTotalRecords(0);
      setSelectedRecord(null);
    } catch (error) {
      console.error('Failed to clear records:', error);
    }
  };
  
  useEffect(() => {
    if (isReady) {
      loadRecords();
    }
  }, [isReady]);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-8 h-8" />
              IndexedDB Visualizer
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Database: measurepro-v2 | Store: poiEvents
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={loadRecords} disabled={loading} data-testid="button-refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={clearAllRecords} variant="destructive" data-testid="button-clear-all">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Records</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalRecords}</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Queue Size</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{status.orchestrator.queueSize}</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Backpressure</div>
            <div className={`text-3xl font-bold ${status.orchestrator.backpressure ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {status.orchestrator.backpressure ? 'ACTIVE' : 'NORMAL'}
            </div>
          </Card>
        </div>
        
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Worker Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(status).map(([name, stats]) => (
              <Card key={name} className="p-4 bg-gray-50 dark:bg-gray-800">
                <div className="font-semibold text-gray-900 dark:text-white capitalize">{name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mt-2">
                  <div>Queue: {stats.queueSize ?? 'N/A'}</div>
                  <div>Processed: {stats.totalProcessed ?? 0}</div>
                  <div>Dropped: {stats.droppedEvents ?? 0}</div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Records (showing {records.length} of {totalRecords})
          </h2>
          
          <div className="space-y-2">
            {records.map((record) => (
              <div key={record.id} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="flex-1">
                  <div className="font-mono text-sm text-gray-900 dark:text-white">{record.id}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    POI: {record.poiType} | GPS: {record.gps.latitude.toFixed(6)}, {record.gps.longitude.toFixed(6)}
                  </div>
                </div>
                
                <Button size="sm" variant="outline" onClick={() => setSelectedRecord(record)} data-testid={`button-view-${record.id}`}>
                  <Eye className="w-4 h-4" />
                </Button>
                
                <Button size="sm" variant="destructive" onClick={() => deleteRecord(record.id)} data-testid={`button-delete-${record.id}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
        
        {selectedRecord && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Record Details</h2>
              <Button variant="ghost" onClick={() => setSelectedRecord(null)}>Close</Button>
            </div>
            
            <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(selectedRecord, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}
