import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Lock, Users, CreditCard, AlertTriangle, Volume2,
  Database, Key, ExternalLink, Eye, BarChart3, Tag, Bug,
  Cpu, FileKey, LayoutGrid, ChevronLeft, ArrowLeft, Building2, Package
} from 'lucide-react';
import CustomerManager from '../components/settings/admin/CustomerManager';
import SubscriptionManager from '../components/settings/admin/SubscriptionManager';
import ViolationsViewer from '../components/settings/admin/ViolationsViewer';
import SoundTestPanel from '../components/settings/admin/SoundTestPanel';
import TrainingDataManager from '../components/settings/admin/TrainingDataManager';
import CompanyManager from '../components/settings/admin/CompanyManager';
import UserAddonOverrides from '../components/settings/admin/UserAddonOverrides';
import { getAdminViewOverride, setAdminViewOverride, type AdminViewOverride } from '../lib/auth/masterAdmin';

const ADMIN_PASSWORD = 'AdminPRO2025';

const NAV_PAGES = [
  {
    label: 'Companies',
    description: 'Create and manage companies, assign members and add-ons',
    path: '/admin/companies',
    icon: Building2,
    color: 'bg-emerald-600',
    testId: 'button-nav-companies',
  },
  {
    label: 'Company Admin Portal',
    description: 'View the company admin experience — manage members, profile and add-ons',
    path: '/company-admin',
    icon: Building2,
    color: 'bg-teal-600',
    testId: 'button-nav-company-admin',
  },
  {
    label: 'User Accounts',
    description: 'Manage registered users, approve or reject registrations',
    path: '/admin/accounts',
    icon: Users,
    color: 'bg-blue-600',
    testId: 'button-nav-accounts',
  },
  {
    label: 'License Admin',
    description: 'Manage feature licenses, issue keys, revoke access',
    path: '/admin-licensing',
    icon: FileKey,
    color: 'bg-purple-600',
    testId: 'button-nav-licensing',
  },
  {
    label: 'Analytics',
    description: 'Usage metrics, active sessions, survey statistics',
    path: '/admin/analytics',
    icon: BarChart3,
    color: 'bg-green-600',
    testId: 'button-nav-analytics',
  },
  {
    label: 'Pricing Management',
    description: 'Edit subscription tiers, prices and descriptions',
    path: '/admin/pricing',
    icon: Tag,
    color: 'bg-yellow-600',
    testId: 'button-nav-pricing',
  },
  {
    label: 'Terms Management',
    description: 'Edit and publish terms of service and policies',
    path: '/admin/terms',
    icon: FileKey,
    color: 'bg-orange-600',
    testId: 'button-nav-terms',
  },
  {
    label: 'Debug — IndexedDB',
    description: 'Inspect and repair local IndexedDB data stores',
    path: '/admin/debug/indexeddb',
    icon: Database,
    color: 'bg-gray-600',
    testId: 'button-nav-debug-indexeddb',
  },
  {
    label: 'Debug — Stress Test',
    description: 'Run write-speed and concurrency stress tests',
    path: '/admin/debug/stress',
    icon: Cpu,
    color: 'bg-red-700',
    testId: 'button-nav-debug-stress',
  },
];

type AdminSection = 'pages' | 'customers' | 'subscriptions' | 'violations' | 'sounds' | 'training' | 'companies' | 'addon-overrides';

const SIDEBAR_ITEMS: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: 'pages',            label: 'All Admin Pages',  icon: LayoutGrid },
  { id: 'companies',        label: 'Companies',         icon: Building2 },
  { id: 'addon-overrides',  label: 'Add-on Overrides',  icon: Package },
  { id: 'customers',        label: 'Customers',         icon: Users },
  { id: 'subscriptions',    label: 'Subscriptions',     icon: CreditCard },
  { id: 'violations',       label: 'Violations',        icon: AlertTriangle },
  { id: 'sounds',           label: 'Sound Test',        icon: Volume2 },
  { id: 'training',         label: 'Training Data',     icon: Database },
];

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>('pages');
  const [viewOverride, setViewOverride] = useState<AdminViewOverride>(() => getAdminViewOverride());

  useEffect(() => {
    const unlocked = sessionStorage.getItem('admin_unlocked') === 'true';
    setIsUnlocked(unlocked);
  }, []);

  const handleViewOverrideChange = (view: AdminViewOverride) => {
    setViewOverride(view);
    setAdminViewOverride(view);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const envPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    const passwordToCheck = envPassword || ADMIN_PASSWORD;
    if (passwordInput === passwordToCheck) {
      setIsUnlocked(true);
      sessionStorage.setItem('admin_unlocked', 'true');
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('admin_unlocked');
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Back to App */}
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            data-testid="button-back-to-app-login"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-600 rounded-full">
                <Shield className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-100">Admin Panel</h1>
                <p className="text-sm text-gray-400">Password required to continue</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Administrator Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder="Enter admin password"
                  autoFocus
                  data-testid="input-admin-password"
                />
                {passwordError && (
                  <p className="text-red-400 text-sm mt-2">Incorrect password. Please try again.</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                data-testid="button-submit-admin-password"
              >
                Unlock Admin Panel
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ── Top Header ── */}
      <header className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            data-testid="button-back-to-app"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-lg font-semibold text-gray-100">Admin Panel</span>
            <span className="text-xs text-gray-500 hidden sm:inline">MeasurePRO</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View override switcher */}
          <div className="flex items-center gap-1 p-1 bg-gray-900 rounded-lg">
            <Eye className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
            <button
              onClick={() => handleViewOverrideChange(viewOverride === 'beta' ? null : 'beta')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewOverride === 'beta'
                  ? 'bg-yellow-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
              data-testid="button-view-beta"
            >
              Beta View
            </button>
            <button
              onClick={() => handleViewOverrideChange(viewOverride === 'pro' ? null : 'pro')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewOverride === 'pro'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
              data-testid="button-view-pro"
            >
              PRO+ View
            </button>
          </div>

          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            data-testid="button-lock-admin"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock
          </button>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-52 flex-shrink-0 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="py-2">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  data-testid={`admin-nav-${item.id}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === 'pages' && (
            <div className="space-y-4 max-w-4xl">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">All Admin Pages</h2>
                <p className="text-sm text-gray-400 mt-1">Click any card to open that admin section.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {NAV_PAGES.map((page) => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.path}
                      onClick={() => navigate(page.path)}
                      className="flex items-start gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl text-left transition-all group"
                      data-testid={page.testId}
                    >
                      <div className={`p-2.5 ${page.color} rounded-lg shrink-0 mt-0.5`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-100 group-hover:text-white">
                            {page.label}
                          </span>
                          <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300 shrink-0" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1 leading-snug">
                          {page.description}
                        </p>
                        <span className="text-xs text-gray-600 font-mono mt-1.5 block">{page.path}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === 'companies' && <CompanyManager />}
          {activeSection === 'addon-overrides' && <UserAddonOverrides />}
          {activeSection === 'customers' && <CustomerManager />}
          {activeSection === 'subscriptions' && <SubscriptionManager />}
          {activeSection === 'violations' && <ViolationsViewer />}
          {activeSection === 'sounds' && <SoundTestPanel />}
          {activeSection === 'training' && <TrainingDataManager />}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
