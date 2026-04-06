/**
 * Dry Run Detection Settings Component
 * Configuration UI for detection zones
 */

import { useState } from 'react';
import { useDryRunStore } from '@/lib/dryRun';
import type { DetectionZone, DetectionSide } from '@/lib/dryRun/types';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Plus, Trash2, Box, AlertCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import DetectionZoneVisual from './DetectionZoneVisual';

const DryRunSettings = () => {
  const config = useDryRunStore(state => state.config);
  const setEnabled = useDryRunStore(state => state.setEnabled);
  const toggleZone = useDryRunStore(state => state.toggleZone);
  const updateZone = useDryRunStore(state => state.updateZone);
  const addZone = useDryRunStore(state => state.addZone);
  const removeZone = useDryRunStore(state => state.removeZone);
  const setAutoCreatePOI = useDryRunStore(state => state.setAutoCreatePOI);
  const setCaptureSnapshot = useDryRunStore(state => state.setCaptureSnapshot);
  const resetToDefaults = useDryRunStore(state => state.resetToDefaults);
  
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  const handleAddZone = () => {
    const newZone: DetectionZone = {
      id: `zone-${Date.now()}`,
      name: 'New Zone',
      side: 'rear',
      enabled: true,
      box: {
        xMin: -50,
        xMax: -10,
        yMin: -1,
        yMax: 1,
        zMin: 1,
        zMax: 3,
      },
      alertThreshold: 10,
      cooldownMs: 2000,
    };
    addZone(newZone);
    setExpandedZone(newZone.id);
    toast.success('Detection zone added');
  };

  const handleRemoveZone = (zoneId: string) => {
    removeZone(zoneId);
    toast.success('Detection zone removed');
  };

  const getSideLabel = (side: DetectionSide): string => {
    switch (side) {
      case 'left': return 'Left Side';
      case 'right': return 'Right Side';
      case 'rear': return 'Rear';
    }
  };

  const getSideColor = (side: DetectionSide): string => {
    switch (side) {
      case 'left': return 'text-yellow-400';
      case 'right': return 'text-blue-400';
      case 'rear': return 'text-red-400';
    }
  };

  const toggleExpanded = (zoneId: string) => {
    setExpandedZone(expandedZone === zoneId ? null : zoneId);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              Dry Run Detection
            </CardTitle>
            <Switch
              checked={config.enabled}
              onCheckedChange={setEnabled}
              data-testid="dry-run-toggle"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400">
            Monitor defined zones around the vehicle for obstacles during dry runs. 
            Automatically logs POIs when obstacles are detected.
          </p>
          
          <DetectionZoneVisual width={350} height={250} scale={1} />
          
          <div className="flex items-center justify-between py-2 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Auto-create POI</Label>
            </div>
            <Switch
              checked={config.autoCreatePOI}
              onCheckedChange={setAutoCreatePOI}
              disabled={!config.enabled}
              data-testid="auto-poi-toggle"
            />
          </div>
          
          <div className="flex items-center justify-between py-2 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Capture snapshot</Label>
            </div>
            <Switch
              checked={config.captureSnapshot}
              onCheckedChange={setCaptureSnapshot}
              disabled={!config.enabled}
              data-testid="capture-snapshot-toggle"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Box className="w-5 h-5" />
              Detection Zones
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddZone}
              disabled={!config.enabled}
              data-testid="add-zone-button"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Zone
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.zones.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No detection zones configured
            </p>
          ) : (
            config.zones.map(zone => (
              <div key={zone.id} className="border border-gray-700 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleExpanded(zone.id)}
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={zone.enabled}
                      onCheckedChange={(checked) => toggleZone(zone.id, checked)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`zone-toggle-${zone.id}`}
                    />
                    <div>
                      <span className="font-medium">{zone.name}</span>
                      <span className={`ml-2 text-xs ${getSideColor(zone.side)}`}>
                        ({getSideLabel(zone.side)})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveZone(zone.id);
                      }}
                      className="text-red-400 hover:text-red-300"
                      data-testid={`remove-zone-${zone.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedZone === zone.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                
                {expandedZone === zone.id && (
                  <div className="p-3 space-y-3 bg-gray-900/50">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-400">Name</Label>
                        <Input
                          value={zone.name}
                          onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                          className="h-8 text-sm"
                          data-testid={`zone-name-${zone.id}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Side</Label>
                        <Select
                          value={zone.side}
                          onValueChange={(value) => updateZone(zone.id, { side: value as DetectionSide })}
                        >
                          <SelectTrigger className="h-8" data-testid={`zone-side-${zone.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                            <SelectItem value="rear">Rear</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-3">
                      <Label className="text-xs text-gray-400 block mb-2">
                        Bounding Box (meters)
                      </Label>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <Label className="text-gray-500">X Min (back)</Label>
                          <Input
                            type="number"
                            value={zone.box.xMin}
                            onChange={(e) => updateZone(zone.id, { 
                              box: { ...zone.box, xMin: parseFloat(e.target.value) || 0 }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">X Max (front)</Label>
                          <Input
                            type="number"
                            value={zone.box.xMax}
                            onChange={(e) => updateZone(zone.id, { 
                              box: { ...zone.box, xMax: parseFloat(e.target.value) || 0 }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">Alert Threshold</Label>
                          <Input
                            type="number"
                            value={zone.alertThreshold}
                            onChange={(e) => updateZone(zone.id, { 
                              alertThreshold: parseInt(e.target.value) || 1
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">Y Min (left)</Label>
                          <Input
                            type="number"
                            value={zone.box.yMin}
                            onChange={(e) => updateZone(zone.id, { 
                              box: { ...zone.box, yMin: parseFloat(e.target.value) || 0 }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">Y Max (right)</Label>
                          <Input
                            type="number"
                            value={zone.box.yMax}
                            onChange={(e) => updateZone(zone.id, { 
                              box: { ...zone.box, yMax: parseFloat(e.target.value) || 0 }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">Cooldown (ms)</Label>
                          <Input
                            type="number"
                            value={zone.cooldownMs}
                            onChange={(e) => updateZone(zone.id, { 
                              cooldownMs: parseInt(e.target.value) || 1000
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">Z Min (height)</Label>
                          <Input
                            type="number"
                            value={zone.box.zMin}
                            onChange={(e) => updateZone(zone.id, { 
                              box: { ...zone.box, zMin: parseFloat(e.target.value) || 0 }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">Z Max (height)</Label>
                          <Input
                            type="number"
                            value={zone.box.zMax}
                            onChange={(e) => updateZone(zone.id, { 
                              box: { ...zone.box, zMax: parseFloat(e.target.value) || 0 }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-500">Ignore Above</Label>
                          <Input
                            type="number"
                            value={zone.ignoreAboveHeight ?? ''}
                            placeholder="None"
                            onChange={(e) => updateZone(zone.id, { 
                              ignoreAboveHeight: e.target.value ? parseFloat(e.target.value) : undefined
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetToDefaults();
            toast.success('Reset to defaults');
          }}
          data-testid="reset-defaults-button"
        >
          <Settings className="w-4 h-4 mr-1" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};

export default DryRunSettings;
