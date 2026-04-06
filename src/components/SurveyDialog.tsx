import React from 'react';
import { X } from 'lucide-react';
import { useSurveyStore, Survey } from '../lib/survey';

interface SurveyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editMode?: boolean;
}

const SurveyDialog: React.FC<SurveyDialogProps> = ({ isOpen, onClose, editMode = false }) => {
  const { activeSurvey, createSurvey, updateSurvey } = useSurveyStore();
  const [formData, setFormData] = React.useState<{
    id?: string;
    name: string;
    customerName: string;
    surveyor: string;
    originAddress: string;
    destinationAddress: string;
    description: string;
    outputFiles?: string[];
  }>({
    name: '',
    customerName: '',
    surveyor: '',
    originAddress: '',
    destinationAddress: '',
    description: '',
    outputFiles: []
  });

  // Load active survey data when in edit mode
  React.useEffect(() => {
    if (isOpen && editMode && activeSurvey) {
      setFormData({
        id: activeSurvey.id,
        name: activeSurvey.name || activeSurvey.surveyTitle || '',
        customerName: activeSurvey.customerName || activeSurvey.clientName || '',
        surveyor: activeSurvey.surveyor || activeSurvey.surveyorName || '',
        originAddress: activeSurvey.originAddress || '',
        destinationAddress: activeSurvey.destinationAddress || '',
        description: activeSurvey.description || '',
        outputFiles: activeSurvey.outputFiles || ['CSV', 'JSON', 'GeoJSON']
      });
    } else if (isOpen && !editMode) {
      // Reset form when opening in create mode
      setFormData({
        name: '',
        customerName: '',
        surveyor: '',
        originAddress: '',
        destinationAddress: '',
        description: '',
        outputFiles: ['CSV', 'JSON', 'GeoJSON']
      });
    }
  }, [isOpen, editMode, activeSurvey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editMode && activeSurvey) {
      // Update existing survey
      await updateSurvey({
        ...activeSurvey,
        name: formData.name,
        customerName: formData.customerName,
        surveyor: formData.surveyor,
        originAddress: formData.originAddress,
        destinationAddress: formData.destinationAddress,
        description: formData.description,
        outputFiles: formData.outputFiles
      });
    } else {
      // Create new survey
      await createSurvey({
        name: formData.name,
        customerName: formData.customerName,
        surveyor: formData.surveyor,
        originAddress: formData.originAddress,
        destinationAddress: formData.destinationAddress,
        description: formData.description,
        outputFiles: formData.outputFiles || []
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg p-6 mx-4 my-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{editMode ? 'Edit Survey' : 'Create New Survey'}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Survey Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Surveyor Name
            </label>
            <input
              type="text"
              value={formData.surveyor}
              onChange={(e) => setFormData(prev => ({ ...prev, surveyor: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Origin Address
            </label>
            <input
              type="text"
              value={formData.originAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, originAddress: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Destination Address
            </label>
            <input
              type="text"
              value={formData.destinationAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, destinationAddress: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
            />
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              {editMode ? 'Update Survey' : 'Create Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SurveyDialog;