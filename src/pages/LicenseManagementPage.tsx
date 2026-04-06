import { useState } from 'react';
import { Key, Package, Smartphone, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LicenseActivation from '../components/licensing/LicenseActivation';
import MyLicenses from '../components/licensing/MyLicenses';
import MyDevices from '../components/licensing/MyDevices';

type Tab = 'activate' | 'licenses' | 'devices';

const LicenseManagementPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('licenses');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  const handleActivationSuccess = () => {
    // Refresh licenses view
    setRefreshTrigger(prev => prev + 1);
    // Switch to licenses tab
    setActiveTab('licenses');
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'activate', label: 'Activate License', icon: Key },
    { id: 'licenses', label: 'My Licenses', icon: Package },
    { id: 'devices', label: 'My Devices', icon: Smartphone },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">License Management</h1>
          <p className="text-gray-400">Manage your licenses and devices</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div>
          {activeTab === 'activate' && (
            <LicenseActivation onActivationSuccess={handleActivationSuccess} />
          )}
          {activeTab === 'licenses' && (
            <MyLicenses key={refreshTrigger} />
          )}
          {activeTab === 'devices' && (
            <MyDevices />
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseManagementPage;
