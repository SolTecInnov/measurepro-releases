import { useState, useEffect } from 'react';
import { Plus, Copy, Eye, EyeOff, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSafeAuth } from '../../lib/firebase';
import {
  getAllActivationCodes,
  getAllLicenseFeatures,
  getAllLicensePackages,
  createActivationCode,
  deactivateActivationCode,
  deleteActivationCode,
  generateActivationCodeString,
  durationToDays,
} from '../../lib/licensing';
import type { ActivationCode, LicenseFeature, LicensePackage, InsertActivationCode } from '../../../shared/schema';

const ActivationCodeManager = () => {
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [features, setFeatures] = useState<LicenseFeature[]>([]);
  const [packages, setPackages] = useState<LicensePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const auth = getSafeAuth();

  const [formData, setFormData] = useState<InsertActivationCode>({
    code: '',
    type: 'feature',
    featureKey: undefined,
    packageId: undefined,
    duration: '12months',
    durationDays: 365,
    maxDevices: 3,
    maxActivations: 1,
    isActive: true,
    generatedBy: auth?.currentUser?.email || 'admin',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Update durationDays when duration changes
    setFormData(prev => ({ ...prev, durationDays: durationToDays(prev.duration) }));
  }, [formData.duration]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [codesData, featuresData, packagesData] = await Promise.all([
        getAllActivationCodes(),
        getAllLicenseFeatures(),
        getAllLicensePackages(),
      ]);
      setCodes(codesData);
      setFeatures(featuresData);
      setPackages(packagesData);
    } catch (error) {
      toast.error('Failed to load activation codes');
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewCode = () => {
    const codeType = formData.type === 'package' ? 'PACK' : 'FEAT';
    const newCode = generateActivationCodeString(codeType);
    setFormData(prev => ({ ...prev, code: newCode }));
  };

  const handleCreate = async () => {
    try {
      // Validation
      if (!formData.code) {
        toast.error('Please generate an activation code');
        return;
      }
      if (formData.type === 'feature' && !formData.featureKey) {
        toast.error('Please select a feature');
        return;
      }
      if (formData.type === 'package' && !formData.packageId) {
        toast.error('Please select a package');
        return;
      }

      await createActivationCode(formData);
      // toast suppressed
      setShowEditor(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Failed to create activation code');
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateActivationCode(id);
      // toast suppressed
      loadData();
    } catch (error) {
      toast.error('Failed to deactivate code');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteActivationCode(id);
      // toast suppressed
      setDeleteConfirmId(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete code');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'feature',
      featureKey: undefined,
      packageId: undefined,
      duration: '12months',
      durationDays: 365,
      maxDevices: 3,
      maxActivations: 1,
      isActive: true,
      generatedBy: auth?.currentUser?.email || 'admin',
      notes: '',
    });
  };

  const handleCancel = () => {
    setShowEditor(false);
    resetForm();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    // toast suppressed
  };

  const toggleCodeVisibility = (id: string) => {
    setVisibleCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return <div className="text-gray-400">Loading activation codes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Activation Codes</h2>
          <p className="text-sm text-gray-400 mt-1">Generate and manage license activation codes</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            generateNewCode();
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          data-testid="button-create-code"
        >
          <Plus className="w-4 h-4" />
          Generate Code
        </button>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Generate New Activation Code</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Activation Code *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.code}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-mono"
                  data-testid="input-code"
                />
                <button
                  onClick={generateNewCode}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  title="Regenerate code"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'feature' | 'package' })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="select-type"
              >
                <option value="feature">Single Feature</option>
                <option value="package">Feature Package</option>
              </select>
            </div>

            {formData.type === 'feature' ? (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Feature *
                </label>
                <select
                  value={formData.featureKey || ''}
                  onChange={(e) => setFormData({ ...formData, featureKey: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  data-testid="select-feature"
                >
                  <option value="">Select a feature</option>
                  {features.map((feature) => (
                    <option key={feature.id} value={feature.featureKey}>
                      {feature.displayName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Package *
                </label>
                <select
                  value={formData.packageId || ''}
                  onChange={(e) => setFormData({ ...formData, packageId: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  data-testid="select-package"
                >
                  <option value="">Select a package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.packageName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Duration *
              </label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="select-duration"
              >
                <option value="1month">1 Month</option>
                <option value="3months">3 Months</option>
                <option value="6months">6 Months</option>
                <option value="12months">12 Months</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Devices
              </label>
              <input
                type="number"
                value={formData.maxDevices}
                onChange={(e) => setFormData({ ...formData, maxDevices: parseInt(e.target.value) || 3 })}
                min="1"
                max="10"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-max-devices"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Activations
              </label>
              <input
                type="number"
                value={formData.maxActivations}
                onChange={(e) => setFormData({ ...formData, maxActivations: parseInt(e.target.value) || 1 })}
                min="1"
                max="1000"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-max-activations"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes about this code..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-notes"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              data-testid="button-save-code"
            >
              Create Activation Code
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              data-testid="button-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Codes List */}
      <div className="space-y-3">
        {codes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No activation codes generated yet. Click "Generate Code" to create one.
          </div>
        ) : (
          codes.map((code) => {
            const feature = features.find(f => f.featureKey === code.featureKey);
            const pkg = packages.find(p => p.id === code.packageId);
            const isVisible = visibleCodes.has(code.id);

            return (
              <div
                key={code.id}
                className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                data-testid={`code-${code.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <code className="px-3 py-1 bg-gray-800 text-green-400 font-mono text-lg rounded">
                        {isVisible ? code.code : '••••-••••-••••-••••'}
                      </code>
                      <button
                        onClick={() => toggleCodeVisibility(code.id)}
                        className="p-1.5 text-gray-400 hover:bg-gray-800 rounded transition-colors"
                        title={isVisible ? 'Hide code' : 'Show code'}
                      >
                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => copyCode(code.code)}
                        className="p-1.5 text-gray-400 hover:bg-gray-800 rounded transition-colors"
                        title="Copy code"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {!code.isActive && (
                        <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-gray-400">
                        {code.type === 'feature' ? (
                          <>Feature: <span className="text-purple-400">{feature?.displayName || code.featureKey}</span></>
                        ) : (
                          <>Package: <span className="text-purple-400">{pkg?.packageName || code.packageId}</span></>
                        )}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">
                        Duration: <span className="text-white">{code.duration.replace('months', ' months').replace('month', ' month')}</span>
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">
                        Activations: <span className="text-white">{code.timesActivated}/{code.maxActivations}</span>
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">
                        Max Devices: <span className="text-white">{code.maxDevices}</span>
                      </span>
                    </div>

                    {/* Email Locking Status */}
                    {code.redeemedByEmail && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs">
                          🔒 Locked to Email
                        </span>
                        <span className="text-blue-400 font-mono">{code.redeemedByEmail}</span>
                        {code.redeemedAt && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-500 text-xs">
                              Redeemed: {new Date(code.redeemedAt).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {!code.redeemedByEmail && (
                      <div className="mt-2 text-sm text-gray-500">
                        <span className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs">
                          ✨ Unredeemed - Available for use
                        </span>
                      </div>
                    )}

                    {code.notes && (
                      <p className="text-sm text-gray-500 italic">{code.notes}</p>
                    )}

                    <p className="text-xs text-gray-500">
                      Created: {new Date(code.createdAt).toLocaleString()} by {code.generatedBy}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {code.isActive && (
                      <button
                        onClick={() => handleDeactivate(code.id)}
                        className="px-3 py-1.5 bg-yellow-900/50 hover:bg-yellow-900/70 text-yellow-300 text-sm rounded transition-colors"
                        data-testid={`button-deactivate-${code.id}`}
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirmId(code.id)}
                      className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      data-testid={`button-delete-${code.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirmId === code.id && (
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded flex items-center justify-between">
                    <p className="text-sm text-red-300">Are you sure you want to delete this activation code?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(code.id)}
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
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivationCodeManager;
