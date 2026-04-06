import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../lib/settings';

const LogoSettings: React.FC = () => {
  const [logoUrl, setLogoUrl] = useState<string>('/soltec.png'); // Default to soltec.png
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved logo from store (which mirrors localStorage) on mount
  useEffect(() => {
    const savedLogo = useSettingsStore.getState().uiSettings.appLogoUrl;
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }
  }, []);

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/png')) {
      toast.error('Please select a PNG image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image file must be smaller than 2MB');
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setLogoUrl(dataUrl);
          useSettingsStore.getState().setUISettings({ appLogoUrl: dataUrl });
          window.dispatchEvent(new Event('logo-updated'));
          toast.success('Logo uploaded successfully');
        }
      };
      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetToDefault = () => {
    setLogoUrl('/soltec.png');
    useSettingsStore.getState().setUISettings({ appLogoUrl: '/soltec.png' });
    window.dispatchEvent(new Event('logo-updated'));
    toast.success('Logo reset to default SolTec logo');
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    useSettingsStore.getState().setUISettings({ appLogoUrl: null });
    window.dispatchEvent(new Event('logo-updated'));
    toast.success('Logo removed');
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <ImageIcon className="w-6 h-6 text-blue-400" />
        Logo Settings
      </h2>

      {/* Current Logo Preview */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-3">Current Logo:</p>
        <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-center h-32">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="App Logo"
              className="max-h-24 max-w-full object-contain"
              onError={() => {
                setLogoUrl('/soltec.png');
                useSettingsStore.getState().setUISettings({ appLogoUrl: '/soltec.png' });
              }}
            />
          ) : (
            <div className="text-gray-500 text-sm">No logo set</div>
          )}
        </div>
      </div>

      {/* Upload Controls */}
      <div className="space-y-3">
        {/* Upload Custom Logo */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-logo-file"
          />
          <button
            onClick={handleFileSelect}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            data-testid="button-upload-logo"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? 'Uploading...' : 'Upload Custom Logo (PNG)'}
          </button>
          <p className="text-xs text-gray-500 mt-1">PNG format only, max 2MB</p>
        </div>

        {/* Reset to Default */}
        <button
          onClick={handleResetToDefault}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          data-testid="button-reset-logo"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Default SolTec Logo
        </button>

        {/* Remove Logo */}
        <button
          onClick={handleRemoveLogo}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-900/50 hover:bg-red-900 border border-red-700 rounded-lg text-sm font-medium transition-colors text-red-300"
          data-testid="button-remove-logo"
        >
          <Trash2 className="w-4 h-4" />
          Remove Logo
        </button>
      </div>

      <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-400">
          The logo appears in the top navigation bar and on captured images when "Show Logo" overlay is enabled in camera settings.
        </p>
      </div>
    </div>
  );
};

export default LogoSettings;
