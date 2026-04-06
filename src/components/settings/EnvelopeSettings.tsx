import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  MapPin,
  Gauge,
  Sparkles,
  Zap,
  X
} from 'lucide-react';
import { useEnvelopeStore } from '../../stores/envelopeStore';
import type { VehicleProfile } from '../../../shared/schema';
import { toast } from 'sonner';

const EnvelopeSettings = () => {
  const {
    profiles,
    settings,
    violations,
    addProfile,
    updateProfile,
    deleteProfile,
    switchProfile,
    updateSettings,
    toggleEnabled,
    toggleAudio,
    toggleVisual,
    clearViolations,
    deleteViolation
  } = useEnvelopeStore();

  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VehicleProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    width: 2.4,
    height: 4.2,
    length: 16.2,
    widthUnit: 'meters' as 'meters' | 'feet',
    heightUnit: 'meters' as 'meters' | 'feet',
    lengthUnit: 'meters' as 'meters' | 'feet',
    frontOverhang: undefined as number | undefined,
    frontOverhangUnit: 'meters' as 'meters' | 'feet',
    rearOverhang: undefined as number | undefined,
    rearOverhangUnit: 'meters' as 'meters' | 'feet',
    cargoLength: undefined as number | undefined,
    cargoWidth: undefined as number | undefined,
    cargoHeight: undefined as number | undefined,
    cargoLengthUnit: 'meters' as 'meters' | 'feet',
    cargoWidthUnit: 'meters' as 'meters' | 'feet',
    cargoHeightUnit: 'meters' as 'meters' | 'feet',
    weightCapacity: undefined as number | undefined,
    weightUnit: 'kg' as 'kg' | 'lbs',
    axleConfiguration: '',
    description: ''
  });

  const activeProfile = profiles.find(p => p.id === settings.activeProfileId);

  const handleToggleEnabled = (enabled: boolean) => {
    // Password validation disabled - directly enable/disable
    toggleEnabled();
    
    if (enabled && !settings.enabled) {
      toast.success('Envelope Clearance enabled successfully');
    }
  };

  const handleAddProfile = () => {
    setEditingProfile(null);
    setProfileForm({
      name: '',
      width: 2.4,
      height: 4.2,
      length: 16.2,
      widthUnit: 'meters',
      heightUnit: 'meters',
      lengthUnit: 'meters',
      frontOverhang: undefined,
      frontOverhangUnit: 'meters',
      rearOverhang: undefined,
      rearOverhangUnit: 'meters',
      cargoLength: undefined,
      cargoWidth: undefined,
      cargoHeight: undefined,
      cargoLengthUnit: 'meters',
      cargoWidthUnit: 'meters',
      cargoHeightUnit: 'meters',
      weightCapacity: undefined,
      weightUnit: 'kg',
      axleConfiguration: '',
      description: ''
    });
    setShowProfileEditor(true);
  };

  const handleEditProfile = (profile: VehicleProfile) => {
    setEditingProfile(profile);
    setProfileForm({
      name: profile.name,
      width: profile.width,
      height: profile.height,
      length: profile.length || 16.2,
      widthUnit: profile.widthUnit,
      heightUnit: profile.heightUnit,
      lengthUnit: profile.lengthUnit || 'meters',
      frontOverhang: profile.frontOverhang,
      frontOverhangUnit: profile.frontOverhangUnit || 'meters',
      rearOverhang: profile.rearOverhang,
      rearOverhangUnit: profile.rearOverhangUnit || 'meters',
      cargoLength: profile.cargoLength,
      cargoWidth: profile.cargoWidth,
      cargoHeight: profile.cargoHeight,
      cargoLengthUnit: profile.cargoLengthUnit || 'meters',
      cargoWidthUnit: profile.cargoWidthUnit || 'meters',
      cargoHeightUnit: profile.cargoHeightUnit || 'meters',
      weightCapacity: profile.weightCapacity,
      weightUnit: profile.weightUnit || 'kg',
      axleConfiguration: profile.axleConfiguration || '',
      description: profile.description || ''
    });
    setShowProfileEditor(true);
  };

  const handleSaveProfile = () => {
    if (!profileForm.name || profileForm.width <= 0 || profileForm.height <= 0) {
      return;
    }

    if (editingProfile) {
      updateProfile(editingProfile.id, profileForm);
    } else {
      addProfile({
        ...profileForm,
        isDefault: false
      });
    }

    setShowProfileEditor(false);
    setEditingProfile(null);
  };

  const convertValue = (value: number, fromUnit: 'meters' | 'feet', toUnit: 'meters' | 'feet') => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'meters' && toUnit === 'feet') return value * 3.28084;
    return value * 0.3048;
  };

  const handleUnitChange = (
    field: 'width' | 'height' | 'length' | 'frontOverhang' | 'rearOverhang' | 'cargoLength' | 'cargoWidth' | 'cargoHeight',
    newUnit: 'meters' | 'feet'
  ) => {
    const unitField = `${field}Unit` as keyof typeof profileForm;
    const currentUnit = profileForm[unitField] as 'meters' | 'feet';
    const currentValue = profileForm[field] as number | undefined;
    
    if (currentValue === undefined) {
      setProfileForm(prev => ({
        ...prev,
        [unitField]: newUnit
      }));
      return;
    }
    
    const convertedValue = convertValue(currentValue, currentUnit, newUnit);
    
    setProfileForm(prev => ({
      ...prev,
      [field]: parseFloat(convertedValue.toFixed(3)),
      [unitField]: newUnit
    }));
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-600 rounded-lg">
          <Truck className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">Envelope Clearance System</h3>
            <div className="inline-flex items-center gap-1 bg-orange-900/40 border border-orange-500 rounded-full px-2 py-0.5">
              <Sparkles className="w-3 h-3 text-orange-400" />
              <span className="text-orange-300 text-xs font-semibold">BETA</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">Real-time vehicle clearance monitoring and alerts</p>
        </div>
      </div>

      {/* Profile Editor Dialog */}
      {showProfileEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                {editingProfile ? 'Edit Vehicle Profile' : 'Add Vehicle Profile'}
              </h3>
              <button onClick={() => setShowProfileEditor(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Profile Name *</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="e.g., Service Truck, Bucket Truck"
                  data-testid="input-profile-name"
                />
              </div>

              {/* Basic Dimensions Section */}
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-3">Basic Dimensions</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Width *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.width}
                        onChange={(e) => setProfileForm({ ...profileForm, width: parseFloat(e.target.value) || 0 })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="input-profile-width"
                      />
                      <select
                        value={profileForm.widthUnit}
                        onChange={(e) => handleUnitChange('width', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-width-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Height *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.height}
                        onChange={(e) => setProfileForm({ ...profileForm, height: parseFloat(e.target.value) || 0 })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="input-profile-height"
                      />
                      <select
                        value={profileForm.heightUnit}
                        onChange={(e) => handleUnitChange('height', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-height-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Length *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.length}
                        onChange={(e) => setProfileForm({ ...profileForm, length: parseFloat(e.target.value) || 0 })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="input-profile-length"
                      />
                      <select
                        value={profileForm.lengthUnit}
                        onChange={(e) => handleUnitChange('length', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-length-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overhang Section */}
              <div>
                <h4 className="text-sm font-semibold text-purple-400 mb-3">Overhangs (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Front Overhang</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.frontOverhang || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, frontOverhang: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Optional"
                        data-testid="input-profile-front-overhang"
                      />
                      <select
                        value={profileForm.frontOverhangUnit}
                        onChange={(e) => handleUnitChange('frontOverhang', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-front-overhang-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Rear Overhang</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.rearOverhang || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, rearOverhang: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Optional"
                        data-testid="input-profile-rear-overhang"
                      />
                      <select
                        value={profileForm.rearOverhangUnit}
                        onChange={(e) => handleUnitChange('rearOverhang', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-rear-overhang-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cargo Dimensions Section */}
              <div>
                <h4 className="text-sm font-semibold text-green-400 mb-3">Cargo Dimensions (Optional)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Cargo Length</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.cargoLength || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, cargoLength: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Optional"
                        data-testid="input-cargo-length"
                      />
                      <select
                        value={profileForm.cargoLengthUnit}
                        onChange={(e) => handleUnitChange('cargoLength', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-cargo-length-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Cargo Width</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.cargoWidth || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, cargoWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Optional"
                        data-testid="input-cargo-width"
                      />
                      <select
                        value={profileForm.cargoWidthUnit}
                        onChange={(e) => handleUnitChange('cargoWidth', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-cargo-width-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Cargo Height</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.cargoHeight || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, cargoHeight: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Optional"
                        data-testid="input-cargo-height"
                      />
                      <select
                        value={profileForm.cargoHeightUnit}
                        onChange={(e) => handleUnitChange('cargoHeight', e.target.value as 'meters' | 'feet')}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-cargo-height-unit"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weight & Configuration Section */}
              <div>
                <h4 className="text-sm font-semibold text-orange-400 mb-3">Weight & Configuration (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Weight Capacity</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={profileForm.weightCapacity || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, weightCapacity: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Optional"
                        data-testid="input-weight-capacity"
                      />
                      <select
                        value={profileForm.weightUnit}
                        onChange={(e) => setProfileForm({ ...profileForm, weightUnit: e.target.value as 'kg' | 'lbs' })}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        data-testid="select-weight-unit"
                      >
                        <option value="kg">kg</option>
                        <option value="lbs">lbs</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Axle Configuration</label>
                    <input
                      type="text"
                      value={profileForm.axleConfiguration}
                      onChange={(e) => setProfileForm({ ...profileForm, axleConfiguration: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="e.g., 5-Axle, Tandem"
                      data-testid="input-axle-configuration"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  rows={3}
                  placeholder="Optional notes about this vehicle profile"
                  data-testid="input-profile-description"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  data-testid="button-cancel-profile"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  data-testid="button-save-profile"
                >
                  {editingProfile ? 'Update Profile' : 'Add Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Master Enable/Disable */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-orange-400" />
            <div>
              <h4 className="font-semibold">Enable Envelope Clearance</h4>
              <p className="text-sm text-gray-400">Activate real-time clearance monitoring</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              className="sr-only peer"
              data-testid="toggle-envelope-enabled"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
          </label>
        </div>

        {/* Pricing info when disabled */}
        {!settings.enabled && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className="font-semibold text-orange-300">Envelope Clearance Premium Features</h5>
                    <div className="inline-flex items-center gap-1 bg-amber-900/40 border border-amber-500 rounded-full px-2 py-0.5">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-300 text-xs font-semibold">BETA</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white mb-3">
                    $125<span className="text-lg text-gray-400">/month USD</span>
                  </div>
                  <ul className="text-sm text-gray-300 space-y-1 mb-4">
                    <li>• Real-time vehicle clearance monitoring</li>
                    <li>• Multiple vehicle profiles (Telecom Truck, Utility Van, Bucket Truck)</li>
                    <li>• Visual alerts (green/yellow/red zones)</li>
                    <li>• Audio alerts with continuous critical warnings</li>
                    <li>• Automatic violation logging with GPS & AI data</li>
                    <li>• Multi-laser support (overhead + lateral)</li>
                    <li>• Keyboard shortcuts (Alt+Shift+E, Alt+Shift+P)</li>
                  </ul>
                  
                  {/* Hardware Options */}
                  <div className="mb-4">
                    <h6 className="font-semibold text-orange-200 mb-3">Hardware Options & Accuracy:</h6>
                    <div className="space-y-2">
                      {/* ZED 2i - RECOMMENDED */}
                      <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="bg-green-500 text-white px-2 py-0.5 rounded text-xs font-bold">RECOMMENDED</div>
                            <span className="font-semibold text-green-300">ZED 2i Stereo Camera</span>
                          </div>
                          <span className="font-bold text-white">$1,500</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                          <span>Accuracy:</span>
                          <span className="font-semibold text-green-400">5-6% variance</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">Best precision for clearance monitoring</span>
                        </div>
                        <p className="text-xs text-gray-400">One-time hardware and configuration fee. Advanced stereo camera with AI-powered depth sensing.</p>
                      </div>

                      {/* Included Camera */}
                      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-semibold text-gray-300">Included Camera with LiDAR</span>
                          <span className="font-bold text-white">$0</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                          <span>Accuracy:</span>
                          <span className="font-semibold text-yellow-400">15-20% variance</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">Standard precision option</span>
                        </div>
                        <p className="text-xs text-gray-400">No additional fee. Uses standard camera included with the system.</p>
                      </div>

                      {/* 3 Directions LiDAR */}
                      <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-semibold text-purple-300">3 Directions LiDAR (Ultra-Precision)</span>
                          <span className="font-bold text-white">Custom Quote</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                          <span>Accuracy:</span>
                          <span className="font-semibold text-purple-400">1/4" precision</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">Professional-grade accuracy</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Enterprise solution with maximum precision. Contact <a href="mailto:sales@soltecinnovation.com" className="text-purple-400 hover:text-purple-300 underline">sales@soltecinnovation.com</a> for pricing.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-900/30 border border-amber-700 rounded p-3">
                    <p className="text-sm font-medium text-amber-300 mb-1">Beta Feature - Early Access Available</p>
                    <p className="text-xs text-gray-400">
                      Contact us at <a href="mailto:sales@soltecinnovation.com" className="text-amber-400 hover:text-amber-300 underline">sales@soltecinnovation.com</a> to participate in beta testing and provide feedback.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {settings.enabled && (
          <div className="bg-blue-900/20 border border-blue-800/30 rounded p-3">
            <p className="text-blue-300 text-sm">
              <strong>✓ Active:</strong> Vehicle clearance is being monitored in real-time
            </p>
          </div>
        )}
      </div>

      {settings.enabled && (
        <>
          {/* Vehicle Profile Selection */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                Vehicle Profile
              </h4>
              <button
                onClick={handleAddProfile}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                data-testid="button-add-profile"
              >
                <Plus className="w-4 h-4" />
                Add Profile
              </button>
            </div>

            <select
              value={settings.activeProfileId || ''}
              onChange={(e) => switchProfile(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-3"
              data-testid="select-active-profile"
            >
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ({profile.width}{profile.widthUnit === 'meters' ? 'm' : 'ft'} × {profile.height}{profile.heightUnit === 'meters' ? 'm' : 'ft'})
                </option>
              ))}
            </select>

            {activeProfile && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700 p-3 rounded">
                  <p className="text-xs text-gray-400 mb-1">Vehicle Width</p>
                  <p className="text-lg font-semibold">{activeProfile.width} {activeProfile.widthUnit === 'meters' ? 'm' : 'ft'}</p>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <p className="text-xs text-gray-400 mb-1">Vehicle Height</p>
                  <p className="text-lg font-semibold">{activeProfile.height} {activeProfile.heightUnit === 'meters' ? 'm' : 'ft'}</p>
                </div>
                {activeProfile.length && (
                  <div className="bg-gray-700 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">Vehicle Length</p>
                    <p className="text-lg font-semibold">{activeProfile.length} {activeProfile.lengthUnit === 'meters' ? 'm' : 'ft'}</p>
                  </div>
                )}
                {activeProfile.weightCapacity && (
                  <div className="bg-gray-700 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">Weight Capacity</p>
                    <p className="text-lg font-semibold">{activeProfile.weightCapacity} {activeProfile.weightUnit}</p>
                  </div>
                )}
                {activeProfile.axleConfiguration && (
                  <div className="col-span-2 bg-gray-700 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">Axle Configuration</p>
                    <p className="text-sm font-medium">{activeProfile.axleConfiguration}</p>
                  </div>
                )}
                {activeProfile.description && (
                  <div className="col-span-2 bg-gray-700 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">Description</p>
                    <p className="text-sm">{activeProfile.description}</p>
                  </div>
                )}
                <div className="col-span-2 flex gap-2">
                  <button
                    onClick={() => handleEditProfile(activeProfile)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
                    data-testid="button-edit-profile"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  {!activeProfile.isDefault && (
                    <button
                      onClick={() => deleteProfile(activeProfile.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                      data-testid="button-delete-profile"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Threshold Controls */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-yellow-400" />
              Clearance Thresholds
            </h4>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Warning Threshold</label>
                  <span className="text-sm text-yellow-400 font-semibold">{settings.warningThreshold.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={settings.warningThreshold}
                  onChange={(e) => updateSettings({ warningThreshold: parseFloat(e.target.value) })}
                  className="w-full"
                  data-testid="slider-warning-threshold"
                />
                <p className="text-xs text-gray-400 mt-1">Trigger warning when clearance is less than this value above vehicle height</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Critical Threshold</label>
                  <span className="text-sm text-red-400 font-semibold">{settings.criticalThreshold.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={settings.criticalThreshold}
                  onChange={(e) => updateSettings({ criticalThreshold: parseFloat(e.target.value) })}
                  className="w-full"
                  data-testid="slider-critical-threshold"
                />
                <p className="text-xs text-gray-400 mt-1">Trigger critical alert when clearance is less than this value above vehicle height</p>
              </div>
            </div>
          </div>

          {/* Alert Settings */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Alert Options</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settings.audioEnabled ? <Volume2 className="w-5 h-5 text-green-400" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                  <span className="text-sm">Audio Alerts</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.audioEnabled}
                    onChange={() => toggleAudio()}
                    className="sr-only peer"
                    data-testid="toggle-audio-alerts"
                  />
                  <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settings.visualEnabled ? <Eye className="w-5 h-5 text-blue-400" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
                  <span className="text-sm">Visual Overlay</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.visualEnabled}
                    onChange={() => toggleVisual()}
                    className="sr-only peer"
                    data-testid="toggle-visual-overlay"
                  />
                  <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Violation Log */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Violation Log ({violations.length})
              </h4>
              {violations.length > 0 && (
                <button
                  onClick={() => clearViolations()}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                  data-testid="button-clear-violations"
                >
                  Clear All
                </button>
              )}
            </div>

            {violations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                <p>No clearance violations recorded</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {violations.slice(0, 20).map((violation) => (
                  <div
                    key={violation.id}
                    className="bg-gray-700 p-3 rounded border-l-4"
                    style={{ borderLeftColor: violation.severity === 'critical' ? '#ef4444' : '#f59e0b' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          violation.severity === 'critical' 
                            ? 'bg-red-900/50 text-red-300' 
                            : 'bg-yellow-900/50 text-yellow-300'
                        }`}>
                          {violation.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(violation.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteViolation(violation.id)}
                        className="text-gray-400 hover:text-red-400"
                        data-testid={`button-delete-violation-${violation.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Profile:</span>
                        <span className="ml-2 font-medium">{violation.profileName}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Deficit:</span>
                        <span className="ml-2 font-medium text-red-400">{violation.deficit.toFixed(3)}m</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Measurement:</span>
                        <span className="ml-2">{violation.measurement.toFixed(3)}m</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Envelope:</span>
                        <span className="ml-2">{violation.envelope.toFixed(3)}m</span>
                      </div>
                      {violation.objectType && (
                        <div className="col-span-2">
                          <span className="text-gray-400">Object:</span>
                          <span className="ml-2">{violation.objectType}</span>
                          {violation.confidence && (
                            <span className="ml-1 text-xs text-gray-500">({(violation.confidence * 100).toFixed(0)}%)</span>
                          )}
                        </div>
                      )}
                      <div className="col-span-2 flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>{violation.latitude.toFixed(6)}, {violation.longitude.toFixed(6)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EnvelopeSettings;
