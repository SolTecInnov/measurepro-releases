/**
 * GNSS Diagnostics & Calibration Panel
 * Collapsible panel for all diagnostics and calibration tools
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, Wrench, Mountain, RotateCcw, Eye, 
  ChevronDown, ChevronUp, CheckCircle
} from 'lucide-react';
import { LiveTelemetryDashboard } from './LiveTelemetryDashboard';
import { RawPayloadInspector } from './RawPayloadInspector';
import { AltitudeCalibrationPanel } from './AltitudeCalibrationPanel';
import { AxisOrientationWizard } from './AxisOrientationWizard';
import { LiveValidationChecks } from './LiveValidationChecks';

type TabId = 'telemetry' | 'validation' | 'raw' | 'altitude' | 'orientation';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: Tab[] = [
  { 
    id: 'telemetry', 
    label: 'Live Telemetry', 
    icon: <Activity className="w-4 h-4" />,
    description: 'Real-time GNSS and IMU data display'
  },
  { 
    id: 'validation', 
    label: 'Validation', 
    icon: <CheckCircle className="w-4 h-4" />,
    description: 'System health checks and data quality'
  },
  { 
    id: 'raw', 
    label: 'Raw Packets', 
    icon: <Eye className="w-4 h-4" />,
    description: 'Inspect raw GNSS packets and altitude references'
  },
  { 
    id: 'altitude', 
    label: 'Altitude Cal', 
    icon: <Mountain className="w-4 h-4" />,
    description: 'Calibrate altitude offset with known reference'
  },
  { 
    id: 'orientation', 
    label: 'Axis Wizard', 
    icon: <RotateCcw className="w-4 h-4" />,
    description: 'Map Duro axes to vehicle frame'
  },
];

export function GnssDiagnosticsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('telemetry');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'telemetry':
        return <LiveTelemetryDashboard />;
      case 'validation':
        return <LiveValidationChecks />;
      case 'raw':
        return <RawPayloadInspector />;
      case 'altitude':
        return <AltitudeCalibrationPanel />;
      case 'orientation':
        return <AxisOrientationWizard />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div 
        className="flex items-center justify-between cursor-pointer p-4 bg-gray-900 rounded-lg hover:bg-gray-800/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid="button-expand-diagnostics"
      >
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-lg font-semibold">Diagnostics & Calibration Suite</h3>
            <p className="text-sm text-gray-400">
              Live telemetry, validation, altitude & orientation calibration
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {isExpanded && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2"
                  data-testid={`button-tab-${tab.id}`}
                >
                  {tab.icon}
                  {tab.label}
                </Button>
              ))}
            </div>

            <div className="text-sm text-gray-400 bg-gray-900/50 rounded px-3 py-2">
              {TABS.find(t => t.id === activeTab)?.description}
            </div>

            <div className="pt-2">
              {renderTabContent()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
