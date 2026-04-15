/**
 * Import ZIP & Re-sync to RoadScope
 *
 * Reads a survey ZIP from disk, extracts POI data + photos,
 * and re-syncs everything to RoadScope with correct photo-POI associations.
 *
 * Use this for surveys that were already exported/purged from IndexedDB
 * but need their photos re-synced to RoadScope.
 */

import React, { useState, useRef } from 'react';
import { Upload, X, RefreshCw, FileArchive, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ImportZipResyncProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ZipSurveyData {
  filename: string;
  metadata: any;
  measurements: any[];
  images: Map<string, string>; // poiId → dataUrl
  imageCount: number;
}

const ImportZipResync: React.FC<ImportZipResyncProps> = ({ isOpen, onClose }) => {
  const [zipFiles, setZipFiles] = useState<File[]>([]);
  const [parsedData, setParsedData] = useState<ZipSurveyData[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncResults, setSyncResults] = useState<Map<string, 'success' | 'error'>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const zips = files.filter(f => f.name.endsWith('.zip'));
    if (zips.length === 0) {
      toast.error('Please select .zip survey files');
      return;
    }
    setZipFiles(zips);

    // Parse each ZIP
    const parsed: ZipSurveyData[] = [];
    const JSZip = (await import('jszip')).default;

    for (const file of zips) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Read metadata
        let metadata: any = {};
        const metaFile = zip.file('documents/survey_metadata.json');
        if (metaFile) {
          metadata = JSON.parse(await metaFile.async('string'));
        }

        // Read measurements
        let measurements: any[] = [];
        const jsonFile = zip.file('documents/survey_data.json');
        if (jsonFile) {
          measurements = JSON.parse(await jsonFile.async('string'));
        }

        // Read images and match to POIs
        const images = new Map<string, string>();
        const imageFolder = zip.folder('images');
        if (imageFolder) {
          const imageFiles = Object.keys(zip.files).filter(p => p.startsWith('images/') && !p.endsWith('/'));
          for (const imgPath of imageFiles) {
            const imgFile = zip.file(imgPath);
            if (!imgFile) continue;
            const blob = await imgFile.async('blob');
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });

            // Try to match image to POI by filename pattern
            // Filename format: {surveyId}_{part}_{poiId}_{type}_{timestamp}.jpg
            const imgName = imgPath.split('/').pop() || '';
            // Find measurement whose ID appears in the filename
            const matchedMeasurement = measurements.find(m => imgName.includes(m.id));
            if (matchedMeasurement) {
              images.set(matchedMeasurement.id, dataUrl);
            }
          }
        }

        parsed.push({
          filename: file.name,
          metadata,
          measurements,
          images,
          imageCount: images.size,
        });
      } catch (err) {
        console.error(`Failed to parse ${file.name}:`, err);
        toast.error(`Failed to parse ${file.name}`);
      }
    }

    setParsedData(parsed);
  };

  const handleSyncOne = async (data: ZipSurveyData) => {
    setSyncing(true);
    setSyncProgress(`Syncing ${data.metadata.surveyTitle || data.filename}...`);

    try {
      // Build measurements with images attached
      const measurementsWithImages = data.measurements.map(m => ({
        ...m,
        imageUrl: data.images.get(m.id) || m.imageUrl || null,
        images: data.images.has(m.id) ? [data.images.get(m.id)!] : (m.images || []),
      }));

      // Build a survey object from metadata
      const survey = {
        id: data.metadata.id,
        surveyTitle: data.metadata.surveyTitle || data.metadata.name,
        name: data.metadata.name || data.metadata.surveyTitle,
        surveyorName: data.metadata.surveyorName || data.metadata.surveyor,
        surveyor: data.metadata.surveyor || data.metadata.surveyorName,
        clientName: data.metadata.clientName || data.metadata.customerName,
        customerName: data.metadata.customerName || data.metadata.clientName,
        projectNumber: data.metadata.projectNumber,
        originAddress: data.metadata.originAddress,
        destinationAddress: data.metadata.destinationAddress,
        description: data.metadata.description,
        notes: data.metadata.notes,
        ownerEmail: data.metadata.ownerEmail,
        createdAt: data.metadata.createdAt,
        closedAt: data.metadata.closedAt || new Date().toISOString(),
        active: false,
      };

      // Temporarily write measurements to IndexedDB for the sync to read
      const { openSurveyDB } = await import('../../lib/survey/db');
      const db = await openSurveyDB();

      // Write survey
      await db.put('surveys', survey);

      // Write measurements
      for (const m of measurementsWithImages) {
        await db.put('measurements', { ...m, user_id: survey.id });
      }

      setSyncProgress(`Uploading ${data.imageCount} photos to RoadScope...`);

      // Clear any previous sync state to force full re-upload
      const { clearSyncState, syncSurveyToRoadScope } = await import('../../lib/roadscope/syncService');
      await clearSyncState(survey.id);

      // Sync to RoadScope
      const result = await syncSurveyToRoadScope(survey as any, {
        includeFiles: true,
      });

      if (result.success) {
        toast.success(`Synced: ${data.metadata.surveyTitle || data.filename}`, {
          description: `${result.filesSynced} photos uploaded correctly`,
        });
        setSyncResults(prev => new Map(prev).set(data.filename, 'success'));
      } else {
        toast.error(`Sync failed: ${data.metadata.surveyTitle || data.filename}`, {
          description: result.errors.slice(0, 2).join(', '),
        });
        setSyncResults(prev => new Map(prev).set(data.filename, 'error'));
      }
    } catch (err) {
      console.error('Import sync failed:', err);
      toast.error('Sync failed');
      setSyncResults(prev => new Map(prev).set(data.filename, 'error'));
    }

    setSyncing(false);
    setSyncProgress('');
  };

  const handleSyncAll = async () => {
    for (const data of parsedData) {
      if (syncResults.get(data.filename) === 'success') continue;
      await handleSyncOne(data);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full m-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileArchive className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Import ZIP & Sync to RoadScope</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-md">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Select survey ZIP files from your hard drive. Photos will be extracted and re-synced to RoadScope with correct POI associations.
        </p>

        {/* File picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {parsedData.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-600 rounded-xl hover:border-blue-500 hover:bg-gray-800/50 transition-colors cursor-pointer"
          >
            <Upload className="w-6 h-6 text-gray-400" />
            <span className="text-gray-300">Select survey ZIP files</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-400 hover:text-blue-300 mb-3"
            >
              + Add more ZIP files
            </button>

            <div className="flex-1 overflow-y-auto mb-4 space-y-2 min-h-0">
              {parsedData.map(data => (
                <div
                  key={data.filename}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    syncResults.get(data.filename) === 'success'
                      ? 'bg-green-900/20 border-green-500/30'
                      : syncResults.get(data.filename) === 'error'
                        ? 'bg-red-900/20 border-red-500/30'
                        : 'bg-gray-800/50 border-gray-700/50'
                  }`}
                >
                  <FileArchive className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{data.metadata.surveyTitle || data.filename}</div>
                    <div className="text-xs text-gray-500">
                      {data.measurements.length} POIs — {data.imageCount} photos matched
                    </div>
                  </div>
                  {syncResults.get(data.filename) === 'success' ? (
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                  ) : (
                    <button
                      onClick={() => handleSyncOne(data)}
                      disabled={syncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                  )}
                </div>
              ))}
            </div>

            {syncProgress && (
              <div className="text-sm text-blue-300 mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {syncProgress}
              </div>
            )}

            {parsedData.some(d => d.imageCount === 0) && (
              <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-200">
                  Some ZIPs have 0 matched photos. Images may have been saved without POI IDs in the filename.
                </p>
              </div>
            )}

            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync All to RoadScope
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportZipResync;
