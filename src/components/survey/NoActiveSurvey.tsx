import React from 'react';
import { AlertTriangle } from 'lucide-react';

const NoActiveSurvey: React.FC = () => {
  return (
    <div className="bg-blue-500/20 border-l-4 border-blue-500 p-6 rounded">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-blue-500" />
        <div>
          <h3 className="font-bold text-blue-500">No Active Survey</h3>
          <p className="text-gray-300">Create a new survey for organized data collection, or use manual logging for independent measurements</p>
          <p className="text-gray-400 text-sm mt-1">Independent measurements are saved locally and can be exported anytime</p>
        </div>
      </div>
    </div>
  );
};

export default NoActiveSurvey;