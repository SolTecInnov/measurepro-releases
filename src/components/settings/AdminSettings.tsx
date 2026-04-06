import React, { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Shield, Lock, Users, CreditCard, AlertTriangle, Volume2,
  Database, Key, ExternalLink, Eye, BarChart3, Tag, Bug,
  Cpu, FileKey, LayoutGrid, Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomerManager from './admin/CustomerManager';
import SubscriptionManager from './admin/SubscriptionManager';
import ViolationsViewer from './admin/ViolationsViewer';
import SoundTestPanel from './admin/SoundTestPanel';
import TrainingDataManager from './admin/TrainingDataManager';
import { getAdminViewOverride, setAdminViewOverride, isMasterAdmin, type AdminViewOverride } from '../../lib/auth/masterAdmin';
import { useAuth } from '../../lib/auth/AuthContext';

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

const AdminSettings = () => {
  const navigate = useNavigate();
  const { user, isMasterAdmin: cachedIsMasterAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('pages');
  const [viewOverride, setViewOverride] = useState<AdminViewOverride>(() => getAdminViewOverride());

  const isAdmin = cachedIsMasterAdmin || isMasterAdmin(user?.email);

  const handleViewOverrideChange = (view: AdminViewOverride) => {
    setViewOverride(view);
    setAdminViewOverride(view);
  };

  // Block access — not master admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="bg-gray-800 border border-red-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="p-3 bg-red-600/20 rounded-full w-fit mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm">
            Admin panel requires master administrator privileges.<br />
            Contact <span className="text-blue-400">support@soltecinnovation.com</span> if you need access.
          </p>
        </div>
      </div>
    );
  }
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-100">Admin Panel</h2>
            <p className="text-sm text-gray-400">System management and configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-gray-900 rounded-lg">
            <Eye className="w-4 h-4 text-gray-400 ml-2" />
            <button
              onClick={() => handleViewOverrideChange(viewOverride === 'beta' ? null : 'beta')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewOverride === 'pro'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
              data-testid="button-view-pro"
            >
              MeasurePRO+ View
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/20 border border-green-800/30 rounded-lg">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Master Admin</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex flex-wrap gap-2 border-b border-gray-700 pb-4">
          <Tabs.Trigger
            value="pages"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-colors"
            data-testid="tab-pages"
          >
            <LayoutGrid className="w-4 h-4" />
            All Admin Pages
          </Tabs.Trigger>
          <Tabs.Trigger
            value="customers"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-colors"
            data-testid="tab-customers"
          >
            <Users className="w-4 h-4" />
            Customers
          </Tabs.Trigger>
          <Tabs.Trigger
            value="subscriptions"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-colors"
            data-testid="tab-subscriptions"
          >
            <CreditCard className="w-4 h-4" />
            Subscriptions
          </Tabs.Trigger>
          <Tabs.Trigger
            value="violations"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-colors"
            data-testid="tab-violations"
          >
            <AlertTriangle className="w-4 h-4" />
            Violations
          </Tabs.Trigger>
          <Tabs.Trigger
            value="sounds"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-colors"
            data-testid="tab-sounds"
          >
            <Volume2 className="w-4 h-4" />
            Sound Test
          </Tabs.Trigger>
          <Tabs.Trigger
            value="training"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-colors"
            data-testid="tab-training"
          >
            <Database className="w-4 h-4" />
            Training Data
          </Tabs.Trigger>
        </Tabs.List>

        <div className="pt-6">
          {/* All Admin Pages navigation hub */}
          <Tabs.Content value="pages">
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                All administration pages are listed below. Click any card to open that page.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {NAV_PAGES.map((page) => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.path}
                      onClick={() => navigate(page.path)}
                      className="flex items-start gap-4 p-4 bg-gray-900 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl text-left transition-all group"
                      data-testid={page.testId}
                    >
                      <div className={`p-2 ${page.color} rounded-lg shrink-0 mt-0.5`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-100 group-hover:text-white">
                            {page.label}
                          </span>
                          <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300 shrink-0" />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                          {page.description}
                        </p>
                        <span className="text-xs text-gray-600 font-mono mt-1 block">{page.path}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="customers">
            <CustomerManager />
          </Tabs.Content>

          <Tabs.Content value="subscriptions">
            <SubscriptionManager />
          </Tabs.Content>

          <Tabs.Content value="violations">
            <ViolationsViewer />
          </Tabs.Content>

          <Tabs.Content value="sounds">
            <SoundTestPanel />
          </Tabs.Content>

          <Tabs.Content value="training">
            <TrainingDataManager />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
};

export default AdminSettings;
