import React from 'react';
import { Measurement } from '../types';

interface MeasurementGridProps {
  currentMeasure: string;
  minDistance: string;
  measurements: Measurement[];
  alertSettings: {
    thresholds: {
      minHeight: number;
      maxHeight: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
  };
}

const MeasurementGrid: React.FC<MeasurementGridProps> = ({
  currentMeasure,
  minDistance,
  measurements,
  alertSettings,
}) => {
  return (
    <div className="col-span-2 grid grid-cols-4 gap-6">
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Current Measure</h3>
        <div className="text-4xl font-bold text-white font-mono">
          {currentMeasure ? `${currentMeasure}m` : '--'}
        </div>
      </div>
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Last Measure</h3>
        <div className="text-4xl font-bold text-white">
          {measurements.length > 0 ? `${measurements[measurements.length - 1].rel.toFixed(2)}m` : '--'}
        </div>
        <div className="text-lg text-gray-400">
          {measurements.length > 0 ? (measurements[measurements.length - 1].rel * 3.28084).toFixed(2) : '--'}ft
        </div>
      </div>
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Minimum Distance</h3>
        <div className="text-4xl font-bold text-white">{minDistance}m</div>
        <div className="text-lg text-gray-400">
          {minDistance !== '--' ? (parseFloat(minDistance) * 3.28084).toFixed(2) : '--'}ft
        </div>
      </div>
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Configured Thresholds</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Min Height:</span>
            <span className="text-white font-medium">{alertSettings?.thresholds?.minHeight ?? 4}m</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Max Height:</span>
            <span className="text-white font-medium">{alertSettings?.thresholds?.maxHeight ?? 25}m</span>
          </div>
          <div className="flex justify-between items-center text-orange-400">
            <span>Warning at:</span>
            <span className="font-medium">{alertSettings?.thresholds?.warningThreshold ?? 0}m</span>
          </div>
          <div className="flex justify-between items-center text-red-400">
            <span>Critical at:</span>
            <span className="font-medium">{alertSettings?.thresholds?.criticalThreshold ?? 0}m</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasurementGrid;