import { useState } from 'react';
import { AdminLicensingGuard } from '../components/licensing/AdminLicensingGuard';
import { Key, Package, Code, Users, Smartphone, Ticket, PlusCircle } from 'lucide-react';
import FeatureManager from '../components/licensing/FeatureManager';
import PackageManager from '../components/licensing/PackageManager';
import ActivationCodeManager from '../components/licensing/ActivationCodeManager';
import UserLicenseViewer from '../components/licensing/UserLicenseViewer';
import DeviceManager from '../components/licensing/DeviceManager';
import HardwareVoucherManager from '../components/licensing/HardwareVoucherManager';
import AdminCreateLicense from '../components/settings/admin/AdminCreateLicense';

type Tab = 'create' | 'features' | 'packages' | 'codes' | 'users' | 'devices' | 'vouchers';

const AdminLicensingPanel = () => {
  const [activeTab, setActiveTab] = useState<Tab>('create');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'create',   label: '✨ Create Licence', icon: PlusCircle },
    { id: 'users',    label: 'User Licenses',     icon: Users },
    { id: 'features', label: 'Features',          icon: Key },
    { id: 'packages', label: 'Packages',          icon: Package },
    { id: 'codes',    label: 'Activation Codes',  icon: Code },
    { id: 'devices',  label: 'Devices',           icon: Smartphone },
    { id: 'vouchers', label: 'Hardware Vouchers', icon: Ticket },
  ];

  return (
    <AdminLicensingGuard>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Licensing Panel</h1>
            <p className="text-gray-400">Manage features, packages, activation codes, and user licenses</p>
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
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            {activeTab === 'create' && (
              <div className="max-w-xl">
                <div className="mb-4">
                  <h2 className="text-white text-lg font-semibold">Create Licence for User</h2>
                  <p className="text-gray-400 text-sm mt-1">Issue a paid licence after a user's 7-day trial expires. Choose monthly, annual, or a custom date range.</p>
                </div>
                <AdminCreateLicense onSuccess={() => setActiveTab('users')} />
              </div>
            )}
            {activeTab === 'features' && <FeatureManager />}
            {activeTab === 'packages' && <PackageManager />}
            {activeTab === 'codes' && <ActivationCodeManager />}
            {activeTab === 'users' && <UserLicenseViewer />}
            {activeTab === 'devices' && <DeviceManager />}
            {activeTab === 'vouchers' && <HardwareVoucherManager />}
          </div>
        </div>
      </div>
    </AdminLicensingGuard>
  );
};

export default AdminLicensingPanel;
