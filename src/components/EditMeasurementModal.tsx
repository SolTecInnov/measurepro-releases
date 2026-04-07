import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { POI_TYPES, type POIType } from '../lib/poi';
import { updateMeasurement } from '../lib/survey/measurements';
import { soundManager } from '../lib/sounds';
import { toast } from 'sonner';
import { Measurement } from '../lib/survey/types';

interface EditMeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  measurement: Measurement | null;
}

interface EditFormData {
  poi_type: string;
  rel: number;
  widthMeasure: number | null;
  lengthMeasure: number | null;
}

const EditMeasurementModal: React.FC<EditMeasurementModalProps> = ({
  isOpen,
  onClose,
  measurement
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditFormData>();

  // Pre-fill form when measurement changes
  useEffect(() => {
    if (measurement) {
      reset({
        poi_type: measurement.poi_type || '',
        rel: measurement.rel,
        widthMeasure: measurement.widthMeasure || null,
        lengthMeasure: measurement.lengthMeasure || null
      });
    }
  }, [measurement, reset]);

  if (!isOpen || !measurement) return null;

  const onSubmit = async (data: EditFormData) => {
    try {
      // Update measurement
      await updateMeasurement(measurement.id, {
        poi_type: data.poi_type,
        rel: Number(data.rel),
        widthMeasure: data.widthMeasure ? Number(data.widthMeasure) : null,
        lengthMeasure: data.lengthMeasure ? Number(data.lengthMeasure) : null
      });

      // Play interface sound
      soundManager.playInterface();

      // Show success toast
      // toast suppressed

      onClose();
    } catch (error) {
      toast.error('Failed to update measurement', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  // Get POI type configuration for styling
  const poiTypeConfig = POI_TYPES.find(poi => poi.type === measurement.poi_type);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl p-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Edit Measurement</h2>
            <p className="text-gray-400">
              POI ID: {measurement.id.substring(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
            data-testid="button-close-edit-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* POI Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              POI Type
            </label>
            <select
              {...register('poi_type', { required: 'POI type is required' })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="input-poi-type"
            >
              {POI_TYPES.map((poiType) => (
                <option key={poiType.type} value={poiType.type}>
                  {poiType.label}
                </option>
              ))}
            </select>
            {errors.poi_type && (
              <p className="mt-1 text-sm text-red-400">{errors.poi_type.message}</p>
            )}
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Height (meters)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                {...register('rel', { 
                  required: 'Height is required',
                  min: { value: 0, message: 'Height must be positive' }
                })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                data-testid="input-height"
              />
              <span className="text-gray-400">m</span>
              <span className="text-gray-500">
                ({measurement.rel ? (measurement.rel * 3.28084).toFixed(3) : '0.000'} ft)
              </span>
            </div>
            {errors.rel && (
              <p className="mt-1 text-sm text-red-400">{errors.rel.message}</p>
            )}
          </div>

          {/* Width */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Width (meters)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                {...register('widthMeasure', {
                  min: { value: 0, message: 'Width must be positive' }
                })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Optional"
                data-testid="input-width"
              />
              <span className="text-gray-400">m</span>
            </div>
            {errors.widthMeasure && (
              <p className="mt-1 text-sm text-red-400">{errors.widthMeasure.message}</p>
            )}
          </div>

          {/* Length */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Length (meters)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                {...register('lengthMeasure', {
                  min: { value: 0, message: 'Length must be positive' }
                })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Optional"
                data-testid="input-length"
              />
              <span className="text-gray-400">m</span>
            </div>
            {errors.lengthMeasure && (
              <p className="mt-1 text-sm text-red-400">{errors.lengthMeasure.message}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              data-testid="button-cancel-edit"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              data-testid="button-save-edit"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMeasurementModal;
