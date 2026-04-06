import React from 'react';
import { Survey } from '../../lib/survey/types';

interface SurveyDetailsProps {
  activeSurvey: Survey;
}

const SurveyDetails: React.FC<SurveyDetailsProps> = ({ activeSurvey }) => {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      <div>
        <label className="text-sm text-gray-400">Survey Title</label>
        <div className="font-medium">{activeSurvey.surveyTitle || activeSurvey.name}</div>
      </div>
      <div>
        <label className="text-sm text-gray-400">Project Number</label>
        <div className="font-medium">{activeSurvey.projectNumber}</div>
      </div>
      <div>
        <label className="text-sm text-gray-400">Surveyor</label>
        <div className="font-medium">{activeSurvey.surveyorName || activeSurvey.surveyor}</div>
      </div>
      <div>
        <label className="text-sm text-gray-400">Client</label>
        <div className="font-medium">{activeSurvey.clientName || activeSurvey.customerName}</div>
      </div>
      <div className="col-span-2">
        <label className="text-sm text-gray-400">Description</label>
        <div className="font-medium">{activeSurvey.description}</div>
      </div>
      <div>
        <label className="text-sm text-gray-400">Origin</label>
        <div className="font-medium">{activeSurvey.originAddress}</div>
      </div>
      <div>
        <label className="text-sm text-gray-400">Destination</label>
        <div className="font-medium">{activeSurvey.destinationAddress}</div>
      </div>
      <div className="col-span-2">
        <label className="text-sm text-gray-400">Output Files</label>
        <div className="font-medium">
          {activeSurvey.outputFiles && activeSurvey.outputFiles.length > 0 
            ? activeSurvey.outputFiles.join(', ') 
            : 'CSV, JSON, GeoJSON'}
        </div>
      </div>
    </div>
  );
};

export default SurveyDetails;