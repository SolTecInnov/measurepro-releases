import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Download, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useSurveyStore } from '../lib/survey';
import { openSurveyDB } from '../lib/survey/db';
import { getCurrentUser } from '../lib/firebase';
import { auditLog } from '../lib/auditLog';
import { openDB } from 'idb';
import type { PoiEventRecord } from '../../shared/worker-types';

interface ExportOptions {
  includeJSON: boolean;
  includeImages: boolean;
  includeVideos: boolean;
  includeTimelapse: boolean;
  includeGeoFormats: boolean; // GPX/KML
  deleteSurveyAfter: boolean;
}

export default function ExportSurvey() {
  const { activeSurvey } = useSurveyStore();

  useEffect(() => {
    try {
      const u = getCurrentUser();
      if (u) auditLog.featureAccess(u.uid, u.email || '', 'Survey Export');
    } catch (_e) {}
  }, []);

  const [options, setOptions] = useState<ExportOptions>({
    includeJSON: true,
    includeImages: true,
    includeVideos: true,
    includeTimelapse: true,
    includeGeoFormats: true,
    deleteSurveyAfter: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [stats, setStats] = useState<{
    recordCount: number;
    imageCount: number;
    videoCount: number;
    estimatedSize: string;
  } | null>(null);

  const calculateEstimatedSize = async () => {
    if (!activeSurvey) return;

    setCurrentStep('Calculating size...');
    
    try {
      // Count records from new database
      const v2db = await openDB('measurepro-v2', 1);
      const tx = v2db.transaction('poiEvents', 'readonly');
      const index = tx.objectStore('poiEvents').index('by-survey');
      
      let recordCount = 0;
      let imageCount = 0;
      let videoCount = 0;
      
      let cursor = await index.openCursor(activeSurvey.id);
      while (cursor) {
        recordCount++;
        const record = cursor.value as PoiEventRecord;
        if (record.imageBase64) imageCount++;
        if (record.videoRef) videoCount++;
        cursor = await cursor.continue();
      }
      
      // Estimate size (rough)
      const jsonSize = recordCount * 1; // 1KB per record
      const imageSize = imageCount * 100; // 100KB per image (compressed)
      const videoSize = videoCount * 5000; // 5MB per video segment
      const totalKB = jsonSize + imageSize + videoSize;
      
      const estimatedSize = totalKB > 1024 
        ? `${(totalKB / 1024).toFixed(1)} MB`
        : `${totalKB.toFixed(0)} KB`;
      
      setStats({
        recordCount,
        imageCount,
        videoCount,
        estimatedSize
      });
    } catch (error) {
      console.error('Failed to calculate size:', error);
      toast.error('Failed to calculate export size');
    } finally {
      setCurrentStep('');
    }
  };

  const handleExport = async () => {
    if (!activeSurvey) {
      toast.error('No active survey to export');
      return;
    }

    setIsExporting(true);
    setProgress(0);
    
    try {
      const zip = new JSZip();
      
      // Step 1: Export POI records as JSON
      if (options.includeJSON) {
        setCurrentStep('Exporting POI records...');
        setProgress(10);
        
        const v2db = await openDB('measurepro-v2', 1);
        const tx = v2db.transaction('poiEvents', 'readonly');
        const index = tx.objectStore('poiEvents').index('by-survey');
        
        const records: PoiEventRecord[] = [];
        let cursor = await index.openCursor(activeSurvey.id);
        while (cursor) {
          records.push(cursor.value as PoiEventRecord);
          cursor = await cursor.continue();
        }
        
        zip.file('poi_records.json', JSON.stringify(records, null, 2));
        setProgress(20);
      }
      
      // Step 2: Export survey metadata
      setCurrentStep('Exporting survey metadata...');
      const metadata = {
        survey: activeSurvey,
        exportDate: new Date().toISOString(),
        recordCount: stats?.recordCount || 0,
        version: 'measurepro-v2'
      };
      zip.file('survey_metadata.json', JSON.stringify(metadata, null, 2));
      setProgress(30);
      
      // Step 3: Export images
      if (options.includeImages && stats && stats.imageCount > 0) {
        setCurrentStep(`Exporting ${stats.imageCount} images...`);
        setProgress(40);
        
        const v2db = await openDB('measurepro-v2', 1);
        const tx = v2db.transaction('poiEvents', 'readonly');
        const index = tx.objectStore('poiEvents').index('by-survey');
        
        const imagesFolder = zip.folder('images');
        let imageIndex = 0;
        
        let cursor = await index.openCursor(activeSurvey.id);
        while (cursor) {
          const record = cursor.value as PoiEventRecord;
          if (record.imageBase64 && imagesFolder) {
            const base64Data = record.imageBase64.split(',')[1] || record.imageBase64;
            imagesFolder.file(`poi_${record.timestamp}_${imageIndex}.jpg`, base64Data, { base64: true });
            imageIndex++;
          }
          cursor = await cursor.continue();
        }
        
        setProgress(60);
      }
      
      // Step 4: Export geo formats (GPX/KML)
      if (options.includeGeoFormats) {
        setCurrentStep('Generating geo formats...');
        setProgress(70);
        
        const v2db = await openDB('measurepro-v2', 1);
        const tx = v2db.transaction('poiEvents', 'readonly');
        const index = tx.objectStore('poiEvents').index('by-survey');
        
        const geoPoints: Array<{ lat: number; lng: number; name: string; timestamp: number }> = [];
        let cursor = await index.openCursor(activeSurvey.id);
        while (cursor) {
          const record = cursor.value as PoiEventRecord;
          if (record.gpsLatitude && record.gpsLongitude) {
            geoPoints.push({
              lat: record.gpsLatitude,
              lng: record.gpsLongitude,
              name: record.poiType,
              timestamp: record.timestamp
            });
          }
          cursor = await cursor.continue();
        }
        
        // Generate GPX
        const gpx = generateGPX(activeSurvey.surveyTitle, geoPoints);
        zip.file('route.gpx', gpx);
        
        // Generate KML
        const kml = generateKML(activeSurvey.surveyTitle, geoPoints);
        zip.file('route.kml', kml);
        
        setProgress(85);
      }
      
      // Step 5: Generate ZIP
      setCurrentStep('Creating ZIP archive...');
      setProgress(90);
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const filename = `${activeSurvey.surveyTitle}_${new Date().toISOString().split('T')[0]}.zip`;
      saveAs(blob, filename);
      
      setProgress(100);
      toast.success(`Export complete: ${filename}`);
      
      // Step 6: Delete survey if requested
      if (options.deleteSurveyAfter) {
        setCurrentStep('Deleting survey data...');
        
        // Delete from v2 database
        const v2db = await openDB('measurepro-v2', 1);
        const tx = v2db.transaction('poiEvents', 'readwrite');
        const index = tx.objectStore('poiEvents').index('by-survey');
        
        let cursor = await index.openCursor(activeSurvey.id);
        while (cursor) {
          await cursor.delete();
          cursor = await cursor.continue();
        }
        
        // Delete from legacy database
        const legacyDb = await openSurveyDB();
        await legacyDb.delete('surveys', activeSurvey.id);
        
        toast.success('Survey data deleted');
      }
      
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setCurrentStep('');
      setProgress(0);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Survey
          </CardTitle>
          <CardDescription>
            {activeSurvey 
              ? `Export data for: ${activeSurvey.surveyTitle}`
              : 'No active survey selected'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {!activeSurvey ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <p>Please select a survey to export</p>
            </div>
          ) : (
            <>
              {/* Statistics */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-2xl font-bold">{stats.recordCount}</div>
                    <div className="text-sm text-muted-foreground">POI Records</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stats.imageCount}</div>
                    <div className="text-sm text-muted-foreground">Images</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stats.videoCount}</div>
                    <div className="text-sm text-muted-foreground">Videos</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stats.estimatedSize}</div>
                    <div className="text-sm text-muted-foreground">Est. Size</div>
                  </div>
                </div>
              )}
              
              {!stats && (
                <Button 
                  onClick={calculateEstimatedSize} 
                  variant="outline"
                  disabled={isExporting}
                  data-testid="button-calculate-size"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Calculate Export Size
                </Button>
              )}
              
              {/* Export Options */}
              <div className="space-y-4">
                <h3 className="font-medium">Export Options</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      id="json"
                      checked={options.includeJSON}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeJSON: e.target.checked }))}
                      data-testid="checkbox-json"
                      className="h-4 w-4"
                    />
                    <span>Include JSON data</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      id="images"
                      checked={options.includeImages}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeImages: e.target.checked }))}
                      data-testid="checkbox-images"
                      className="h-4 w-4"
                    />
                    <span>Include images ({stats?.imageCount || 0})</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      id="videos"
                      checked={options.includeVideos}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeVideos: e.target.checked }))}
                      data-testid="checkbox-videos"
                      className="h-4 w-4"
                    />
                    <span>Include videos ({stats?.videoCount || 0})</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      id="geo"
                      checked={options.includeGeoFormats}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeGeoFormats: e.target.checked }))}
                      data-testid="checkbox-geo"
                      className="h-4 w-4"
                    />
                    <span>Include GPX/KML formats</span>
                  </label>
                  
                  <label className="flex items-center gap-2 pt-2 border-t cursor-pointer">
                    <input 
                      type="checkbox"
                      id="delete"
                      checked={options.deleteSurveyAfter}
                      onChange={(e) => setOptions(prev => ({ ...prev, deleteSurveyAfter: e.target.checked }))}
                      data-testid="checkbox-delete"
                      className="h-4 w-4"
                    />
                    <span className="text-destructive font-medium">Delete survey after export</span>
                  </label>
                </div>
              </div>
              
              {/* Progress */}
              {isExporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{currentStep}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleExport}
                  disabled={isExporting || !stats}
                  className="flex-1"
                  data-testid="button-export"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export Survey'}
                </Button>
                
                {options.deleteSurveyAfter && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <Trash2 className="h-4 w-4" />
                    <span>Will delete after export</span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function generateGPX(name: string, points: Array<{ lat: number; lng: number; name: string; timestamp: number }>): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MeasurePRO" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>`;
    
  const trackpoints = points.map(p => 
    `      <trkpt lat="${p.lat}" lon="${p.lng}">
        <time>${new Date(p.timestamp).toISOString()}</time>
        <name>${p.name}</name>
      </trkpt>`
  ).join('\n');
  
  const footer = `
    </trkseg>
  </trk>
</gpx>`;
  
  return header + '\n' + trackpoints + footer;
}

function generateKML(name: string, points: Array<{ lat: number; lng: number; name: string; timestamp: number }>): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>`;
    
  const placemarks = points.map(p => 
    `    <Placemark>
      <name>${p.name}</name>
      <description>${new Date(p.timestamp).toISOString()}</description>
      <Point>
        <coordinates>${p.lng},${p.lat},0</coordinates>
      </Point>
    </Placemark>`
  ).join('\n');
  
  const footer = `
  </Document>
</kml>`;
  
  return header + '\n' + placemarks + footer;
}
