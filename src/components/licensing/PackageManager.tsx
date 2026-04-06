import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllLicensePackages,
  getAllLicenseFeatures,
  createLicensePackage,
  updateLicensePackage,
  deleteLicensePackage,
} from '../../lib/licensing';
import type { LicensePackage, InsertLicensePackage, LicenseFeature } from '../../../shared/schema';

const PackageManager = () => {
  const [packages, setPackages] = useState<LicensePackage[]>([]);
  const [features, setFeatures] = useState<LicenseFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPackage, setEditingPackage] = useState<LicensePackage | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState<InsertLicensePackage>({
    packageName: '',
    description: '',
    featureKeys: [],
    tier: 'standard',
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [packagesData, featuresData] = await Promise.all([
        getAllLicensePackages(),
        getAllLicenseFeatures(),
      ]);
      setPackages(packagesData);
      setFeatures(featuresData);
    } catch (error) {
      toast.error('Failed to load packages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createLicensePackage(formData);
      toast.success('Package created successfully');
      setShowEditor(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Failed to create package');
    }
  };

  const handleUpdate = async () => {
    if (!editingPackage) return;
    try {
      await updateLicensePackage(editingPackage.id, formData);
      toast.success('Package updated successfully');
      setShowEditor(false);
      setEditingPackage(null);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Failed to update package');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLicensePackage(id);
      toast.success('Package deleted successfully');
      setDeleteConfirmId(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete package');
    }
  };

  const startEdit = (pkg: LicensePackage) => {
    setEditingPackage(pkg);
    setFormData({
      packageName: pkg.packageName,
      description: pkg.description,
      featureKeys: pkg.featureKeys,
      tier: pkg.tier,
      isActive: pkg.isActive,
    });
    setShowEditor(true);
  };

  const resetForm = () => {
    setFormData({
      packageName: '',
      description: '',
      featureKeys: [],
      tier: 'standard',
      isActive: true,
    });
    setEditingPackage(null);
  };

  const handleCancel = () => {
    setShowEditor(false);
    resetForm();
  };

  const toggleFeature = (featureKey: string) => {
    setFormData(prev => ({
      ...prev,
      featureKeys: prev.featureKeys.includes(featureKey)
        ? prev.featureKeys.filter(k => k !== featureKey)
        : [...prev.featureKeys, featureKey]
    }));
  };

  if (isLoading) {
    return <div className="text-gray-400">Loading packages...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">License Packages</h2>
          <p className="text-sm text-gray-400 mt-1">Bundle multiple features into packages</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          data-testid="button-create-package"
        >
          <Plus className="w-4 h-4" />
          Create Package
        </button>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {editingPackage ? 'Edit Package' : 'Create New Package'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Package Name *
              </label>
              <input
                type="text"
                value={formData.packageName}
                onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                placeholder="e.g., Professional Bundle, Enterprise Suite"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-package-name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tier *
              </label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="select-tier"
              >
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Package description..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-description"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Included Features *
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-gray-800 border border-gray-600 rounded">
                {features.length === 0 ? (
                  <p className="text-sm text-gray-500">No features available. Create features first.</p>
                ) : (
                  features.map((feature) => (
                    <label key={feature.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.featureKeys.includes(feature.featureKey)}
                        onChange={() => toggleFeature(feature.featureKey)}
                        className="w-4 h-4"
                        data-testid={`checkbox-feature-${feature.featureKey}`}
                      />
                      <span className="text-sm text-white">{feature.displayName}</span>
                      <code className="px-1.5 py-0.5 bg-gray-900 text-purple-400 text-xs rounded ml-auto">
                        {feature.featureKey}
                      </code>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{formData.featureKeys.length} features selected</p>
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
              onClick={editingPackage ? handleUpdate : handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              data-testid="button-save-package"
            >
              <Save className="w-4 h-4" />
              {editingPackage ? 'Update' : 'Create'}
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

      {/* Packages List */}
      <div className="space-y-3">
        {packages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No packages created yet. Click "Create Package" to add one.
          </div>
        ) : (
          packages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-gray-900 border border-gray-700 rounded-lg p-4"
              data-testid={`package-${pkg.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{pkg.packageName}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      pkg.tier === 'enterprise' ? 'bg-yellow-900 text-yellow-200' :
                      pkg.tier === 'professional' ? 'bg-blue-900 text-blue-200' :
                      pkg.tier === 'premium' ? 'bg-purple-900 text-purple-200' :
                      pkg.tier === 'standard' ? 'bg-green-900 text-green-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {pkg.tier}
                    </span>
                    {!pkg.isActive && (
                      <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-sm text-gray-400 mb-2">{pkg.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {pkg.featureKeys.map((key) => {
                      const feature = features.find(f => f.featureKey === key);
                      return (
                        <span
                          key={key}
                          className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded"
                          title={feature?.displayName || key}
                        >
                          {feature?.displayName || key}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Created: {new Date(pkg.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(pkg)}
                    className="p-2 text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                    data-testid={`button-edit-${pkg.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(pkg.id)}
                    className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                    data-testid={`button-delete-${pkg.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirmId === pkg.id && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded flex items-center justify-between">
                  <p className="text-sm text-red-300">Are you sure you want to delete this package?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(pkg.id)}
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

export default PackageManager;
