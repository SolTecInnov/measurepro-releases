/**
 * Survey Export Dialog
 * Unified export modal for professional road profile exports
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  FileSpreadsheet,
  Map,
  Layers,
  FileCode,
  Package,
  Globe,
  Navigation,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Palette,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import {
  type ExportFormat,
  type ExportOptions,
  type CRSCode,
  SUPPORTED_CRS,
  DEFAULT_EXPORT_OPTIONS,
  exportLinkedSet,
  downloadExportResult,
} from '@/lib/export/roadProfile';

interface SurveyExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alignment: Alignment;
  profile: LinkedProfile;
}

const FORMAT_INFO: Record<ExportFormat, { label: string; icon: React.ReactNode; description: string }> = {
  csv: {
    label: 'CSV',
    icon: <FileSpreadsheet className="h-4 w-4" />,
    description: 'Profile data for spreadsheets and analysis',
  },
  geojson: {
    label: 'GeoJSON',
    icon: <Map className="h-4 w-4" />,
    description: 'GIS-compatible alignment and profile',
  },
  shapefile: {
    label: 'Shapefile',
    icon: <Layers className="h-4 w-4" />,
    description: 'Zipped shapefile for ArcGIS/QGIS',
  },
  dxf: {
    label: 'DXF',
    icon: <FileCode className="h-4 w-4" />,
    description: 'CAD drawing with profile layers',
  },
  landxml: {
    label: 'LandXML',
    icon: <FileCode className="h-4 w-4" />,
    description: 'Civil 3D compatible alignment + profile',
  },
  kml: {
    label: 'KML',
    icon: <Globe className="h-4 w-4" />,
    description: 'Google Earth, QGIS, ArcGIS Pro',
  },
  kmz: {
    label: 'KMZ',
    icon: <Globe className="h-4 w-4" />,
    description: 'Zipped KML — smaller file size',
  },
  gpx: {
    label: 'GPX',
    icon: <Navigation className="h-4 w-4" />,
    description: 'Garmin devices, BaseCamp, OsmAnd',
  },
  zip: {
    label: 'ZIP Bundle',
    icon: <Package className="h-4 w-4" />,
    description: 'All formats with metadata (re-importable)',
  },
};

export function SurveyExportDialog({
  open,
  onOpenChange,
  alignment,
  profile,
}: SurveyExportDialogProps) {
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(new Set(['csv', 'geojson']));
  const [crs, setCRS] = useState<CRSCode>('EPSG:4326');
  const [altitudeMode, setAltitudeMode] = useState<'raw' | 'selected' | 'corrected' | 'all'>('corrected');
  const [samplingMode, setSamplingMode] = useState<'full' | 'resample'>('full');
  const [resampleInterval, setResampleInterval] = useState(5);
  const [includeGradeColor, setIncludeGradeColor] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const sampleCount = profile.samples.length;
  const estimatedRecords = samplingMode === 'resample'
    ? Math.ceil((alignment.cumDistM[alignment.cumDistM.length - 1] || 0) / resampleInterval)
    : sampleCount;

  const toggleFormat = (format: ExportFormat) => {
    const newFormats = new Set(selectedFormats);
    if (newFormats.has(format)) {
      newFormats.delete(format);
    } else {
      newFormats.add(format);
    }
    setSelectedFormats(newFormats);
  };

  const handleExport = async () => {
    if (selectedFormats.size === 0) {
      toast.error('Please select at least one export format');
      return;
    }

    setIsExporting(true);
    setExportComplete(false);

    try {
      const options: ExportOptions = {
        formats: Array.from(selectedFormats),
        crs,
        altitudeMode,
        samplingMode,
        resampleInterval_m: samplingMode === 'resample' ? resampleInterval : undefined,
        includeRollPitchYaw: true,
        includePOIs: false,
        includeDiagnostics: false,
        includeGradeColor,
      };

      const results = await exportLinkedSet(alignment, profile, options);

      for (const result of results) {
        downloadExportResult(result);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setExportComplete(true);
      /* toast removed */
    } catch (error) {
      console.error('[SurveyExportDialog] Export failed:', error);
      toast.error('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setExportComplete(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700" data-testid="dialog-survey-export">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Download className="h-5 w-5 text-blue-400" />
            Export Survey Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Profile Summary</Label>
            <div className="flex gap-4 text-sm">
              <Badge variant="outline">{alignment.name}</Badge>
              <Badge variant="outline">{sampleCount.toLocaleString()} samples</Badge>
              <Badge variant="outline">
                {((alignment.cumDistM[alignment.cumDistM.length - 1] || 0) / 1000).toFixed(2)} km
              </Badge>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Export Formats</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FORMAT_INFO) as ExportFormat[]).map(format => (
                <button
                  key={format}
                  onClick={() => toggleFormat(format)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedFormats.has(format)
                      ? 'bg-blue-900/50 border-blue-500 text-white'
                      : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                  data-testid={`button-format-${format}`}
                >
                  {FORMAT_INFO[format].icon}
                  <div className="flex-1">
                    <div className="font-medium">{FORMAT_INFO[format].label}</div>
                    <div className="text-xs text-gray-400">{FORMAT_INFO[format].description}</div>
                  </div>
                  {selectedFormats.has(format) && (
                    <CheckCircle className="h-4 w-4 text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Coordinate System</Label>
              <Select value={crs} onValueChange={(v) => setCRS(v as CRSCode)}>
                <SelectTrigger className="bg-gray-800 border-gray-700" data-testid="select-crs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CRS.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Altitude Mode</Label>
              <Select value={altitudeMode} onValueChange={(v) => setAltitudeMode(v as typeof altitudeMode)}>
                <SelectTrigger className="bg-gray-800 border-gray-700" data-testid="select-altitude">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrected">Corrected (MSL)</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                  <SelectItem value="raw">Raw</SelectItem>
                  <SelectItem value="all">All Fields</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-amber-400" />
                <Label className="text-sm font-medium">Grade Colour</Label>
              </div>
              <Switch
                checked={includeGradeColor}
                onCheckedChange={setIncludeGradeColor}
                data-testid="switch-grade-color"
              />
            </div>
            <div className="text-xs text-gray-400">
              {includeGradeColor
                ? 'Colour-coded by grade % — turn off for clean Civil 3D import'
                : 'Clean export without colour attributes'}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Resample Data</Label>
              <Switch
                checked={samplingMode === 'resample'}
                onCheckedChange={(checked) => setSamplingMode(checked ? 'resample' : 'full')}
                data-testid="switch-resample"
              />
            </div>

            {samplingMode === 'resample' && (
              <div className="flex items-center gap-3">
                <Label className="text-sm text-gray-400">Interval (m):</Label>
                <Input
                  type="number"
                  value={resampleInterval}
                  onChange={(e) => setResampleInterval(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-24 bg-gray-800 border-gray-700"
                  data-testid="input-resample-interval"
                />
                <span className="text-xs text-gray-400">
                  Est. {estimatedRecords.toLocaleString()} records
                </span>
              </div>
            )}

            {samplingMode === 'full' && (
              <div className="text-xs text-gray-400">
                Exporting all {sampleCount.toLocaleString()} samples
              </div>
            )}
          </div>

          {selectedFormats.has('landxml') && (
            <div className="p-3 bg-amber-900/30 border border-amber-700 rounded text-sm text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>LandXML Note:</strong> For best Civil 3D import results, use a projected CRS
                (e.g., MGA zone) instead of WGS84.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFormats.size === 0}
            data-testid="button-export"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : exportComplete ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Exported!
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {selectedFormats.size} Format{selectedFormats.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
