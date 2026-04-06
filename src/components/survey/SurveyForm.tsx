import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSurveyStore } from '../../lib/survey';
import { toast } from 'sonner';
import { auditLog } from '../../lib/auditLog';
import { useAuth } from '../../lib/auth/AuthContext';
import { useCameraControl } from '../../hooks/useCameraControl';
import { CameraPreCheckModal } from '../CameraPreCheckModal';

interface SurveyFormProps {
  isOpen: boolean;
  onClose: () => void;
  editMode?: boolean;
}

const SurveyForm: React.FC<SurveyFormProps> = ({ isOpen, onClose, editMode = false }) => {
  const { activeSurvey, createSurvey, updateSurvey } = useSurveyStore();
  const { user, cachedUserData } = useAuth();
  const { bridgeOnline, cameraConnected, settings, startForSurvey } = useCameraControl();
  type SurveyFormData = {
    surveyTitle: string;
    surveyorName: string;
    clientName: string;
    projectNumber: string;
    originAddress: string;
    destinationAddress: string;
    description: string;
    notes: string;
    ownerEmail: string;
    enableVehicleTrace: boolean;
    enableAlertLog: boolean;
  };

  const [showCameraPreCheck, setShowCameraPreCheck] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<SurveyFormData | null>(null);
  const [formData, setFormData] = React.useState<SurveyFormData>({
    surveyTitle: '',
    surveyorName: '',
    clientName: '',
    projectNumber: '',
    originAddress: '',
    destinationAddress: '',
    description: '',
    notes: '',
    ownerEmail: '',
    enableVehicleTrace: true,
    enableAlertLog: true
  });

  // Load active survey data when in edit mode
  useEffect(() => {
    if (isOpen && editMode && activeSurvey) {
      setFormData({
        surveyTitle: activeSurvey.surveyTitle || activeSurvey.name || '',
        surveyorName: activeSurvey.surveyorName || activeSurvey.surveyor || '',
        clientName: activeSurvey.clientName || activeSurvey.customerName || '',
        projectNumber: activeSurvey.projectNumber || '',
        originAddress: activeSurvey.originAddress || '',
        destinationAddress: activeSurvey.destinationAddress || '',
        description: activeSurvey.description || '',
        notes: activeSurvey.notes || '',
        ownerEmail: activeSurvey.ownerEmail || '',
        enableVehicleTrace: activeSurvey.enableVehicleTrace !== undefined ? activeSurvey.enableVehicleTrace : true,
        enableAlertLog: activeSurvey.enableAlertLog !== undefined ? activeSurvey.enableAlertLog : true
      });
    } else if (isOpen && !editMode) {
      // Reset form when opening in create mode
      setFormData({
        surveyTitle: '',
        surveyorName: '',
        clientName: '',
        projectNumber: '',
        originAddress: '',
        destinationAddress: '',
        description: '',
        notes: '',
        ownerEmail: '',
        enableVehicleTrace: true,
        enableAlertLog: true
      });
    }
  }, [isOpen, editMode, activeSurvey]);

  const doCreateSurvey = async (data: SurveyFormData, withCamera: boolean) => {
    try {
      if (editMode && activeSurvey) {
        await updateSurvey({
          ...activeSurvey,
          surveyTitle: data.surveyTitle,
          name: data.surveyTitle,
          surveyorName: data.surveyorName,
          surveyor: data.surveyorName,
          clientName: data.clientName,
          customerName: data.clientName,
          projectNumber: data.projectNumber,
          originAddress: data.originAddress,
          destinationAddress: data.destinationAddress,
          description: data.description,
          notes: data.notes,
          ownerEmail: data.ownerEmail,
          enableVehicleTrace: data.enableVehicleTrace,
          enableAlertLog: data.enableAlertLog
        });
      } else {
        await createSurvey({
          surveyTitle: data.surveyTitle,
          name: data.surveyTitle,
          surveyorName: data.surveyorName,
          surveyor: data.surveyorName,
          clientName: data.clientName,
          customerName: data.clientName,
          projectNumber: data.projectNumber,
          originAddress: data.originAddress,
          destinationAddress: data.destinationAddress,
          description: data.description,
          notes: data.notes,
          ownerEmail: data.ownerEmail,
          enableVehicleTrace: data.enableVehicleTrace,
          enableAlertLog: data.enableAlertLog
        });
        const uid = user?.uid || localStorage.getItem('current_user_id') || '';
        const email = user?.email || cachedUserData?.email || '';
        const createdSurvey = useSurveyStore.getState().activeSurvey;
        if (uid && email) {
          auditLog.surveyCreate(uid, email, createdSurvey?.id || '', data.surveyTitle);
        }

        if (withCamera && createdSurvey) {
          void startForSurvey(createdSurvey.id);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('Storage is full') || errorMessage.includes('quota')) {
        toast.error('Storage Full', {
          description: 'Your device storage is full. Please export and delete old surveys to free up space, then try again.',
          duration: 10000
        });
      } else if (errorMessage.includes('backing store') || errorMessage.includes('corrupted')) {
        toast.error('Database Error', {
          description: 'Your survey data has been saved as backup. Please refresh the page to recover.',
          duration: 8000
        });
      } else {
        toast.error('Failed to Save Survey', {
          description: errorMessage,
          duration: 6000
        });
      }
      return;
    }
    setPendingFormData(null);
    setShowCameraPreCheck(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.surveyTitle.trim()) {
      toast.error('Survey title is required');
      return;
    }
    
    if (!formData.surveyorName.trim()) {
      toast.error('Surveyor name is required');
      return;
    }
    
    if (!formData.clientName.trim()) {
      toast.error('Client name is required');
      return;
    }
    
    if (!formData.ownerEmail.trim()) {
      toast.error('Your email is required for survey completion reports');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.ownerEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!editMode && bridgeOnline && settings.autoStartWithSurvey) {
      setPendingFormData({ ...formData });
      setShowCameraPreCheck(true);
      return;
    }
    
    await doCreateSurvey(formData, false);
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl p-6 mx-4 my-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">{editMode ? 'Edit Survey' : 'Create New Survey'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Survey Title
              </label>
              <input
                type="text"
                value={formData.surveyTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, surveyTitle: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Project Number
              </label>
              <input
                type="text"
                value={formData.projectNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, projectNumber: e.target.value }))}
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
                value={formData.surveyorName}
                onChange={(e) => setFormData(prev => ({ ...prev, surveyorName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Your Email * <span className="text-xs text-gray-400">(for completion reports)</span>
              </label>
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@company.com"
                required
                data-testid="input-owner-email"
              />
              <p className="text-xs text-gray-400 mt-1">
                Survey completion package will be automatically sent to this email when the survey is closed.
              </p>
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

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enableVehicleTrace}
                  onChange={(e) => setFormData(prev => ({ ...prev, enableVehicleTrace: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600"
                />
                <span className="text-sm text-gray-300">Enable Vehicle Trace</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enableAlertLog}
                  onChange={(e) => setFormData(prev => ({ ...prev, enableAlertLog: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600"
                />
                <span className="text-sm text-gray-300">Enable Alert Log</span>
              </label>
            </div>
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

    <CameraPreCheckModal
      isOpen={showCameraPreCheck}
      onConfirmWithCamera={() => {
        if (pendingFormData) doCreateSurvey(pendingFormData, true);
      }}
      onSkipCamera={() => {
        if (pendingFormData) doCreateSurvey(pendingFormData, false);
      }}
    />
    </>
  );
};

export default SurveyForm;