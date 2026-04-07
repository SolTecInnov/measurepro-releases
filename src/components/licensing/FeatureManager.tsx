import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllLicenseFeatures,
  createLicenseFeature,
  updateLicenseFeature,
  deleteLicenseFeature,
} from '../../lib/licensing';
import type { LicenseFeature, InsertLicenseFeature } from '../../../shared/schema';

const FeatureManager = () => {
  const [features, setFeatures] = useState<LicenseFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingFeature, setEditingFeature] = useState<LicenseFeature | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState<InsertLicenseFeature>({
    featureKey: '',
    displayName: '',
    description: '',
    category: 'premium',
    isActive: true,
  });

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      setIsLoading(true);
      const data = await getAllLicenseFeatures();
      setFeatures(data);
    } catch (error) {
      toast.error('Failed to load features');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createLicenseFeature(formData);
      // toast suppressed
      setShowEditor(false);
      resetForm();
      loadFeatures();
    } catch (error) {
      toast.error('Failed to create feature');
    }
  };

  const handleUpdate = async () => {
    if (!editingFeature) return;
    try {
      await updateLicenseFeature(editingFeature.id, formData);
      // toast suppressed
      setShowEditor(false);
      setEditingFeature(null);
      resetForm();
      loadFeatures();
    } catch (error) {
      toast.error('Failed to update feature');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLicenseFeature(id);
      // toast suppressed
      setDeleteConfirmId(null);
      loadFeatures();
    } catch (error) {
      toast.error('Failed to delete feature');
    }
  };

  const startEdit = (feature: LicenseFeature) => {
    setEditingFeature(feature);
    setFormData({
      featureKey: feature.featureKey,
      displayName: feature.displayName,
      description: feature.description,
      category: feature.category,
      isActive: feature.isActive,
    });
    setShowEditor(true);
  };

  const resetForm = () => {
    setFormData({
      featureKey: '',
      displayName: '',
      description: '',
      category: 'premium',
      isActive: true,
    });
    setEditingFeature(null);
  };

  const handleCancel = () => {
    setShowEditor(false);
    resetForm();
  };

  if (isLoading) {
    return <div className="text-gray-400">Loading features...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">License Features</h2>
          <p className="text-sm text-gray-400 mt-1">Define features that can be licensed to users</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          data-testid="button-create-feature"
        >
          <Plus className="w-4 h-4" />
          Create Feature
        </button>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {editingFeature ? 'Edit Feature' : 'Create New Feature'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Feature Key *
              </label>
              <input
                type="text"
                value={formData.featureKey}
                onChange={(e) => setFormData({ ...formData, featureKey: e.target.value })}
                placeholder="e.g., ai_detection, zed2i_support"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-feature-key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Display Name *
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g., AI Detection, ZED 2i Support"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-display-name"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Feature description..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="select-category"
              >
                <option value="core">Core</option>
                <option value="premium">Premium</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                  data-testid="checkbox-active"
                />
                <span className="text-sm text-gray-300">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={editingFeature ? handleUpdate : handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              data-testid="button-save-feature"
            >
              <Save className="w-4 h-4" />
              {editingFeature ? 'Update' : 'Create'}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              data-testid="button-cancel"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Features List */}
      <div className="space-y-3">
        {features.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No features created yet. Click "Create Feature" to add one.
          </div>
        ) : (
          features.map((feature) => (
            <div
              key={feature.id}
              className="bg-gray-900 border border-gray-700 rounded-lg p-4"
              data-testid={`feature-${feature.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{feature.displayName}</h3>
                    <code className="px-2 py-1 bg-gray-800 text-purple-400 text-sm rounded">
                      {feature.featureKey}
                    </code>
                    <span className={`px-2 py-1 text-xs rounded ${
                      feature.category === 'enterprise' ? 'bg-yellow-900 text-yellow-200' :
                      feature.category === 'professional' ? 'bg-blue-900 text-blue-200' :
                      feature.category === 'premium' ? 'bg-purple-900 text-purple-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {feature.category}
                    </span>
                    {!feature.isActive && (
                      <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  {feature.description && (
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Created: {new Date(feature.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(feature)}
                    className="p-2 text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                    data-testid={`button-edit-${feature.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(feature.id)}
                    className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                    data-testid={`button-delete-${feature.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirmId === feature.id && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded flex items-center justify-between">
                  <p className="text-sm text-red-300">Are you sure you want to delete this feature?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(feature.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      data-testid="button-confirm-delete"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeatureManager;
