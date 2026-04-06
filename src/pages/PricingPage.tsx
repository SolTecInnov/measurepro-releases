import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  X,
  Zap,
  Star,
  Sparkles,
  Shield,
  ArrowRight,
  Loader2,
  Clock,
  Gift,
  Brain,
  Truck,
  Route,
  Navigation,
  Compass,
  Database,
  Package,
  Wrench,
  Headphones,
  ShieldCheck,
  Phone,
  Mail,
  ExternalLink
} from 'lucide-react';

interface PricingItem {
  id: string;
  itemType: 'subscription_tier' | 'addon';
  itemKey: string;
  displayName: string;
  description: string | null;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | null;
  isActive: boolean;
  metadata?: Record<string, any> | string;
}

export default function PricingPage() {
  // Per-page SEO: unique title + meta description for this route
  useEffect(() => {
    document.title = 'Pricing — MeasurePRO Software Plans for OS/OW Road Survey | measure-pro.app';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'MeasurePRO software pricing: monthly, annual, and lifetime plans for OS/OW heavy haul survey teams. Full hardware bundle pricing at SolTec Innovation. Canada & USA.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/pricing');
    return () => {
      document.title = 'MeasurePRO — LiDAR Road Survey App for Oversize & Overweight Transport | measure-pro.app';
      if (meta) meta.setAttribute('content', 'MeasurePRO by SolTec Innovation: professional LiDAR & GPS field app for OS/OW heavy haul surveys. Measure bridge clearances, lane widths, road geometry and export permit-ready data.');
      if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/');
    };
  }, []);

  // Fetch pricing data from API — retry: 0 so failures fall back to defaults immediately
  const { data: pricingResponse, isLoading } = useQuery<{ success: boolean; pricing: PricingItem[] }>({
    queryKey: ['/api/pricing/public'],
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });

  const pricingData = pricingResponse?.pricing || [];

  // Helper to get pricing item with defaults
  const getItem = (key: string) => pricingData.find(p => p.itemKey === key);

  // Default prices (in cents) - used when API data is missing
  const defaultPrices: Record<string, { price: number; displayName: string; description: string }> = {
    measurepro_lite: { price: 85000, displayName: 'MeasurePRO Lite', description: 'Essential surveying tools - one-time purchase' },
    measurepro_monthly: { price: 30000, displayName: 'MeasurePRO', description: 'Full-featured professional surveying' },
    measurepro_annual: { price: 300000, displayName: 'MeasurePRO Annual', description: 'Full-featured with 2 bonus months' },
    beta_tester: { price: 0, displayName: 'Beta Tester', description: 'Help shape the future of MeasurePRO' },
    ai_detection: { price: 25000, displayName: 'AI Detection', description: 'Intelligent object detection and clearance alerts' },
    envelope_clearance: { price: 12500, displayName: 'Envelope Clearance', description: 'Vehicle clearance monitoring with ZED 2i' },
    convoy_guardian: { price: 65000, displayName: 'Convoy Guardian', description: 'Multi-vehicle convoy coordination' },
    route_enforcement: { price: 35000, displayName: 'Route Enforcement', description: 'GPS-based permitted route compliance' },
    swept_path: { price: 45000, displayName: 'Swept Path', description: 'Real-time swept path analysis' },
    roadscope_monthly: { price: 35000, displayName: 'RoadScope Monthly', description: 'Sync surveys to RoadScope platform' },
    roadscope_annual: { price: 350000, displayName: 'RoadScope Annual', description: 'Sync surveys with 2 bonus months' },
  };

  const getItemWithDefault = (key: string) => {
    const item = getItem(key);
    const defaultItem = defaultPrices[key];
    if (item) return item;
    if (defaultItem) return { ...defaultItem, itemKey: key, id: key, currency: 'USD', billingPeriod: null, isActive: true, itemType: 'subscription_tier' as const };
    return null;
  };

  // Base plans
  const lite = getItemWithDefault('measurepro_lite');
  const monthly = getItemWithDefault('measurepro_monthly');
  const annual = getItemWithDefault('measurepro_annual');
  const betaTester = getItemWithDefault('beta_tester');

  // Add-ons
  const addons = [
    { key: 'ai_detection', icon: Brain, color: 'text-purple-400' },
    { key: 'envelope_clearance', icon: Truck, color: 'text-blue-400' },
    { key: 'convoy_guardian', icon: Navigation, color: 'text-orange-400' },
    { key: 'route_enforcement', icon: Route, color: 'text-green-400' },
    { key: 'swept_path', icon: Compass, color: 'text-cyan-400' },
  ];

  // RoadScope integration
  const roadscopeMonthly = getItemWithDefault('roadscope_monthly');
  const roadscopeAnnual = getItemWithDefault('roadscope_annual');

  // Feature comparison
  const features = [
    { name: 'Real-time laser measurements', lite: true, pro: true },
    { name: 'GPS tracking & mapping', lite: true, pro: true },
    { name: 'Offline-first (10-day grace)', lite: true, pro: true },
    { name: 'Data export (CSV, JSON)', lite: true, pro: true },
    { name: 'Survey management', lite: true, pro: true },
    { name: 'Voice commands (3 languages)', lite: true, pro: true },
    { name: 'Photo/video recording', lite: false, pro: true },
    { name: 'Live camera integration', lite: false, pro: true },
    { name: 'Cloud sync & backup', lite: false, pro: true },
    { name: 'Multi-device support', lite: false, pro: true },
    { name: 'Live monitoring dashboard', lite: false, pro: true },
    { name: 'Add-on modules (MeasurePRO+)', lite: false, pro: true },
    { name: 'Priority support', lite: false, pro: true },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400" data-testid="text-loading">Loading pricing information...</p>
        </div>
      </div>
    );
  }

  // On API error, continue rendering with default prices (do not block the page)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Navigation */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
                data-testid="link-back"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/features"
                className="text-gray-300 hover:text-white transition-colors hidden sm:inline"
                data-testid="link-features"
              >
                Features
              </Link>
              <Link
                to="/blog"
                className="text-gray-300 hover:text-white transition-colors hidden sm:inline"
                data-testid="link-blog"
              >
                Blog
              </Link>
              <a
                href="https://soltecinnovation.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                data-testid="button-signup"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Zap className="w-12 h-12 text-blue-500" />
            <h1 className="text-5xl md:text-6xl font-bold text-white" data-testid="text-page-title">
              MeasurePRO Pricing
            </h1>
          </div>
          <p className="text-xl text-gray-300 leading-relaxed mb-4" data-testid="text-page-subtitle">
            Software plans for OS/OW heavy haul road survey professionals
          </p>
          <p className="text-gray-400 mb-6">
            Choose a software plan below, then add specialized modules for your workflow.
          </p>
          {/* Cross-link to SolTec for hardware bundle pricing */}
          <div className="inline-flex items-center gap-3 bg-blue-900/40 border border-blue-600 rounded-lg px-5 py-3 text-sm mb-4" data-testid="banner-soltec-pricing">
            <Package className="w-5 h-5 text-blue-400 shrink-0" />
            <span className="text-gray-300">
              <strong className="text-white">Hardware bundle pricing</strong> (LiDAR system, rugged tablet, GPS, mounting kit) is managed by SolTec Innovation.{' '}
              <a href="https://soltecinnovation.com/pricing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                See full hardware &amp; bundle pricing at soltecinnovation.com →
              </a>
            </span>
          </div>
          <div className="flex items-center gap-3 bg-green-900/40 border border-green-600 rounded-lg px-5 py-3 text-sm" data-testid="banner-purchase-note">
            <ExternalLink className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-gray-300">
              <strong className="text-white">To purchase, visit </strong>
              <a href="https://soltecinnovation.com/pricing" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline font-semibold">
                SolTecInnovation.com
              </a>
              {' '}— all plans and add-ons are purchased directly through SolTec Innovation.
            </span>
          </div>
        </div>
      </section>

      {/* Base Plans Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2" data-testid="text-base-plans-title">Base Plans</h2>
          <p className="text-gray-400">Select one plan to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* MeasurePRO Lite - Lifetime */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8" data-testid="card-plan-lite">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-8 h-8 text-gray-400" />
                <span className="bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">LIFETIME</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2" data-testid="text-plan-lite-name">
                {lite?.displayName || 'MeasurePRO Lite'}
              </h3>
              <p className="text-gray-400 text-sm" data-testid="text-plan-lite-description">
                {lite?.description || 'Essential surveying tools - one-time purchase'}
              </p>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white" data-testid="text-plan-lite-price">
                  ${lite ? (lite.price / 100).toLocaleString() : '850'}
                </span>
                <span className="text-gray-400">one-time</span>
              </div>
              <p className="text-green-400 text-sm mt-1">No recurring fees</p>
            </div>
            <a
              href="https://soltecinnovation.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gray-700 hover:bg-gray-600 text-white text-center py-3 rounded-lg font-semibold transition-colors mb-6"
              data-testid="button-plan-lite"
            >
              Buy at SolTec Innovation →
            </a>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-300">Real-time measurements</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-300">GPS tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-300">Offline mode (10 days)</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-gray-600" />
                <span className="text-gray-500">No photo/video recording</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-gray-600" />
                <span className="text-gray-500">No cloud sync</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-gray-600" />
                <span className="text-gray-500">No add-on modules</span>
              </div>
            </div>
          </div>

          {/* MeasurePRO - Subscription (Most Popular) */}
          <div className="bg-gradient-to-b from-blue-900/50 to-purple-900/50 border-2 border-blue-500 rounded-xl p-8 relative" data-testid="card-plan-pro">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </span>
            </div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2" data-testid="text-plan-pro-name">
                MeasurePRO
              </h3>
              <p className="text-gray-300 text-sm" data-testid="text-plan-pro-description">
                Full-featured professional surveying
              </p>
            </div>
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white" data-testid="text-plan-pro-price">
                  ${monthly ? (monthly.price / 100).toLocaleString() : '300'}
                </span>
                <span className="text-gray-300">/month</span>
              </div>
            </div>
            {annual && (
              <div className="bg-green-900/40 border border-green-600 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-semibold text-sm">Annual: ${(annual.price / 100).toLocaleString()}/year</span>
                </div>
                <p className="text-green-300 text-xs">Pay for 10 months, get 12! Save $600</p>
              </div>
            )}
            <a
              href="https://soltecinnovation.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-semibold transition-colors mb-6"
              data-testid="button-plan-pro"
            >
              Buy at SolTec Innovation →
            </a>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-200">Everything in Lite</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-200">Cloud sync & backup</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-200">Multi-device support</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-200">Live monitoring</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-200">Priority support</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-200">Add-on modules available</span>
              </div>
            </div>
          </div>

          {/* Beta Tester - Free */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8" data-testid="card-plan-beta">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-8 h-8 text-yellow-400" />
                <span className="bg-yellow-600 text-white text-xs font-bold px-2 py-1 rounded">REQUIRES APPROVAL</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2" data-testid="text-plan-beta-name">
                {betaTester?.displayName || 'Beta Tester'}
              </h3>
              <p className="text-gray-400 text-sm" data-testid="text-plan-beta-description">
                {betaTester?.description || 'Help shape the future of MeasurePRO'}
              </p>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white" data-testid="text-plan-beta-price">
                  Free
                </span>
              </div>
              <p className="text-yellow-400 text-sm mt-1">Subject to admin approval</p>
            </div>
            <a
              href="https://soltecinnovation.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-yellow-600 hover:bg-yellow-700 text-white text-center py-3 rounded-lg font-semibold transition-colors mb-6"
              data-testid="button-plan-beta"
            >
              Apply at SolTec Innovation →
            </a>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-300">All MeasurePRO features</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-gray-300">Early access to new features</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-300">Limited availability</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-300">Feedback required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hardware Bundle Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-orange-900/30 to-gray-800 border-2 border-orange-600/50 rounded-2xl p-8" data-testid="card-hardware-bundle-tier">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="w-8 h-8 text-orange-400" />
                  <h2 className="text-2xl font-bold text-white" data-testid="text-hardware-bundle-title">Hardware Bundle</h2>
                  <span className="px-2 py-1 bg-orange-600 text-white text-xs font-bold rounded" data-testid="badge-hardware-bundle">INCLUDED WITH HARDWARE</span>
                </div>
                <p className="text-gray-300 mb-4" data-testid="text-hardware-bundle-description">
                  Get 6 months of MeasurePRO included at no extra cost with your SolTec hardware purchase. Your hardware ships with a voucher code to activate during signup — no credit card needed.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-gray-200">Full MeasurePRO access for 6 months</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-gray-200">No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-gray-200">Activates with SOLT-XXXX-XXXX voucher</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-gray-200">Renew at standard rate after trial</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-4 md:min-w-[200px]">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-400 mb-1" data-testid="text-hardware-bundle-price">6 months free</p>
                  <p className="text-gray-400 text-sm">with hardware purchase</p>
                </div>
                <a
                  href="https://soltecinnovation.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white text-center py-3 px-6 rounded-lg font-semibold transition-colors"
                  data-testid="button-hardware-bundle-signup"
                >
                  Get Hardware Bundle →
                </a>
                <a
                  href="https://soltecinnovation.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-400 hover:text-orange-300 underline"
                  data-testid="link-soltec-hardware"
                >
                  Browse hardware at SolTec →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MeasurePRO+ Add-ons Section */}
      <section className="container mx-auto px-6 py-12 bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <h2 className="text-3xl font-bold text-white" data-testid="text-addons-title">
                MeasurePRO+ Add-ons
              </h2>
            </div>
            <p className="text-gray-400">
              Enhance your MeasurePRO subscription with specialized modules
            </p>
            <p className="text-sm text-purple-400 mt-2">
              Requires MeasurePRO Monthly or Annual subscription
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {addons.map(({ key, icon: Icon, color }) => {
              const addon = getItemWithDefault(key);
              if (!addon) return null;
              return (
                <div
                  key={key}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-purple-500 transition-all"
                  data-testid={`addon-card-${key}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-gray-900 ${color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1" data-testid={`text-addon-name-${key}`}>
                        {addon.displayName}
                      </h3>
                      <p className="text-sm text-gray-400 mb-3" data-testid={`text-addon-description-${key}`}>
                        {addon.description}
                      </p>
                      <p className="text-xl font-bold text-purple-400" data-testid={`text-addon-price-${key}`}>
                        ${(addon.price / 100).toLocaleString()}<span className="text-sm text-gray-400">/month</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* RoadScope Integration Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Database className="w-8 h-8 text-green-400" />
              <h2 className="text-3xl font-bold text-white" data-testid="text-roadscope-title">
                RoadScope Integration
              </h2>
            </div>
            <p className="text-gray-400">
              Sync your survey data with RoadScope platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RoadScope Monthly */}
            {roadscopeMonthly && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-roadscope-monthly">
                <h3 className="text-xl font-bold text-white mb-2">Monthly</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-green-400">
                    ${(roadscopeMonthly.price / 100).toLocaleString()}
                  </span>
                  <span className="text-gray-400">/month</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Real-time POI sync</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Photo upload to cloud</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Survey collaboration</span>
                  </li>
                </ul>
              </div>
            )}

            {/* RoadScope Annual */}
            {roadscopeAnnual && (
              <div className="bg-gradient-to-br from-green-900/40 to-green-800/40 border-2 border-green-500 rounded-xl p-6 relative" data-testid="card-roadscope-annual">
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    2 MONTHS FREE!
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Annual</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-green-400">
                    ${(roadscopeAnnual.price / 100).toLocaleString()}
                  </span>
                  <span className="text-gray-400">/year</span>
                </div>
                <div className="bg-green-900/40 rounded-lg p-2 mb-4">
                  <p className="text-green-300 text-sm">
                    Pay 12 months, get 14 months!
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Everything in monthly</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-green-400" />
                    <span>2 bonus months included</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Hardware Package Section */}
      <section className="container mx-auto px-6 py-16 bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900" id="hardware">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Package className="w-10 h-10 text-blue-400" />
              <h2 className="text-4xl font-bold text-white" data-testid="text-hardware-title">
                Complete Survey Solution
              </h2>
            </div>
            <p className="text-xl text-gray-300 mb-2">
              LiDAR Hardware Package
            </p>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Professional survey equipment with SolTec LiDAR 2D laser system, GPS, rugged tablet, and included software licenses. Everything you need for professional field surveying operations.
            </p>
          </div>

          {/* Main Hardware Package Card */}
          <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-2 border-blue-500 rounded-2xl p-8 mb-12" data-testid="card-hardware-package">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: What's Included */}
              <div>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Check className="w-6 h-6 text-green-400" />
                  What's Included
                </h3>
                
                {/* Hardware */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-blue-400 mb-3">Hardware</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>SolTec LiDAR 2D Laser System (with 2 sets of wires)</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>Professional GPS Module (non-RTK)</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>Rugged Windows Tablet (IP67) with MeasureLITE*</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>Vehicle Mounting Kit</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>Lowepro Pro Trekker BP 450 AW II Backpack</span>
                    </li>
                  </ul>
                </div>

                {/* Software & Licenses */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-purple-400 mb-3">Software & Licenses</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>MeasurePRO Professional (6 months)</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>RoadScope Professional (6 months)</span>
                    </li>
                  </ul>
                </div>

                {/* Support & Training */}
                <div>
                  <h4 className="text-lg font-semibold text-green-400 mb-3">Support & Training</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>Remote Training (4 hours)</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>Priority Next Day Support (1 year)</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>1-Year Hardware Warranty</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>30-Day Return Policy</span>
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  *MeasureLITE: Measure & positions in .XLS format. No images, no cloud, no online functionality.
                </p>
              </div>

              {/* Right: Pricing & CTA */}
              <div className="flex flex-col justify-center">
                <div className="bg-gray-900/60 rounded-xl p-6 mb-6">
                  <div className="text-center mb-6">
                    <div className="text-5xl font-bold text-white mb-2" data-testid="text-hardware-price">
                      $19,000
                    </div>
                    <p className="text-gray-400">Complete Package</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <Package className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                      <p className="text-gray-300">Complete Kit</p>
                      <p className="text-xs text-gray-500">LiDAR, GPS, Tablet</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <Zap className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                      <p className="text-gray-300">Software Included</p>
                      <p className="text-xs text-gray-500">MeasurePRO + RoadScope</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <Headphones className="w-5 h-5 text-green-400 mx-auto mb-1" />
                      <p className="text-gray-300">Training & Support</p>
                      <p className="text-xs text-gray-500">4 hrs + 1 yr priority</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <ShieldCheck className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                      <p className="text-gray-300">Warranty</p>
                      <p className="text-xs text-gray-500">1-year + 30-day return</p>
                    </div>
                  </div>

                  <a
                    href="#hardware-quote"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-4 rounded-lg font-semibold transition-colors text-lg"
                    data-testid="button-hardware-quote"
                  >
                    Request Quote
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Installation & Training Options */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-orange-400" />
              Installation & Training Options
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Standard Shipping */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-shipping-standard">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-green-400">Included</div>
                  <h4 className="text-lg font-semibold text-white mt-2">Standard Shipping</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Professional packaging</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Insured shipping</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Tracking provided</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Installation guides included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Remote setup support</span>
                  </li>
                </ul>
              </div>

              {/* On-Premise Training */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-training-onpremise">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-white">$3,000 <span className="text-sm text-gray-400 font-normal">USD</span></div>
                  <h4 className="text-lg font-semibold text-white mt-2">On-Premise Training</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Professional on-site installation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>8 hours installation/training</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>System calibration and testing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Team certification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>30-day follow-up support</span>
                  </li>
                </ul>
              </div>

              {/* Enterprise Installation */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-training-enterprise">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-white">$6,000 <span className="text-sm text-gray-400 font-normal">USD</span></div>
                  <h4 className="text-lg font-semibold text-white mt-2">Enterprise Installation</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Multi-vehicle installation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>16 hours enterprise training</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Custom workflow setup</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Administrator certification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>90-day ongoing support</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Same-Day Support Add-on */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Headphones className="w-6 h-6 text-green-400" />
              Same-Day Support Add-on
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-support-monthly">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-white">$65<span className="text-sm text-gray-400 font-normal">/month</span></div>
                  <h4 className="text-lg font-semibold text-white mt-2">Monthly Plan</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Same day response guarantee</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Priority ticket queue</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Direct phone support</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-support-peruse">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-white">$300<span className="text-sm text-gray-400 font-normal">/incident</span></div>
                  <h4 className="text-lg font-semibold text-white mt-2">Per-Use</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Same-day response guarantee</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Pay only when you need it</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>No monthly commitment</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Warranty & Protection Options */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
              Warranty & Protection Options
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Standard Warranty */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-warranty-standard">
                <div className="text-center mb-4">
                  <div className="text-xl font-bold text-green-400">Included</div>
                  <h4 className="text-lg font-semibold text-white mt-2">Standard Warranty</h4>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-green-400 font-semibold mb-2">Included:</p>
                  <ul className="space-y-1 text-xs text-gray-300">
                    <li>1-year manufacturer warranty</li>
                    <li>Manufacturing defects covered</li>
                    <li>Parts replacement</li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-red-400 font-semibold mb-2">Not Covered:</p>
                  <ul className="space-y-1 text-xs text-gray-500">
                    <li>Accidental damage</li>
                    <li>Normal wear and tear</li>
                    <li>Misuse or abuse</li>
                  </ul>
                </div>
              </div>

              {/* Extended Warranty */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-warranty-extended">
                <div className="text-center mb-4">
                  <div className="text-xl font-bold text-white">$1,000 <span className="text-xs text-gray-400">USD</span></div>
                  <h4 className="text-lg font-semibold text-white mt-2">Extended Warranty</h4>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-green-400 font-semibold mb-2">Included:</p>
                  <ul className="space-y-1 text-xs text-gray-300">
                    <li>All standard warranty coverage</li>
                    <li>+1 year extended (2 years total)</li>
                    <li>Fabrication defects protection</li>
                    <li>Priority warranty service</li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-red-400 font-semibold mb-2">Not Covered:</p>
                  <ul className="space-y-1 text-xs text-gray-500">
                    <li>Accidental damage</li>
                    <li>Normal wear and tear</li>
                  </ul>
                </div>
              </div>

              {/* Damage Protection */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6" data-testid="card-warranty-damage">
                <div className="text-center mb-4">
                  <div className="text-xl font-bold text-white">$2,500 <span className="text-xs text-gray-400">USD</span></div>
                  <h4 className="text-lg font-semibold text-white mt-2">Damage Protection</h4>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-green-400 font-semibold mb-2">Included:</p>
                  <ul className="space-y-1 text-xs text-gray-300">
                    <li>All standard warranty coverage</li>
                    <li>Accidental damage protection</li>
                    <li>1 free additional wire set</li>
                    <li>Drop and impact coverage</li>
                    <li>Environmental damage protection</li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-red-400 font-semibold mb-2">Not Covered:</p>
                  <ul className="space-y-1 text-xs text-gray-500">
                    <li>Intentional damage</li>
                    <li>Theft or loss</li>
                  </ul>
                </div>
              </div>

              {/* Complete Protection - Best Value */}
              <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-2 border-amber-500 rounded-xl p-6 relative" data-testid="card-warranty-complete">
                <div className="absolute -top-3 right-4">
                  <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    BEST VALUE
                  </span>
                </div>
                <div className="text-center mb-4">
                  <div className="text-xl font-bold text-white">$3,500 <span className="text-xs text-gray-400">USD</span></div>
                  <h4 className="text-lg font-semibold text-white mt-2">Complete Protection</h4>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-green-400 font-semibold mb-2">Included:</p>
                  <ul className="space-y-1 text-xs text-gray-300">
                    <li>All standard warranty coverage</li>
                    <li>Extended warranty (2 years total)</li>
                    <li>1 free additional wire set</li>
                    <li>Accidental damage protection</li>
                    <li>Priority warranty service</li>
                    <li>Drop and impact coverage</li>
                    <li>Environmental damage protection</li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-red-400 font-semibold mb-2">Not Covered:</p>
                  <ul className="space-y-1 text-xs text-gray-500">
                    <li>Intentional damage</li>
                    <li>Theft or loss</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Contact / Request Quote Section */}
          <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/50 rounded-2xl p-8" id="hardware-quote" data-testid="section-hardware-quote">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">Ready to Equip Your Team?</h3>
              <p className="text-gray-400">
                Get professional survey equipment with comprehensive support and training. Contact our hardware specialists for expert consultation and custom quotes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <a 
                href="tel:+14385335344" 
                className="flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-xl p-4 transition-colors"
                data-testid="link-phone"
              >
                <Phone className="w-5 h-5 text-blue-400" />
                <span className="text-white">+1.438.533.5344</span>
              </a>
              <a 
                href="mailto:admin@soltecinnovation.com" 
                className="flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-xl p-4 transition-colors"
                data-testid="link-email"
              >
                <Mail className="w-5 h-5 text-green-400" />
                <span className="text-white">admin@soltecinnovation.com</span>
              </a>
              <Link 
                to="/contact"
                className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 rounded-xl p-4 transition-colors"
                data-testid="link-request-quote"
              >
                <ExternalLink className="w-5 h-5 text-white" />
                <span className="text-white font-semibold">Request Quote</span>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span>1-Year Warranty</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-blue-400" />
                <span>30-Day Returns</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-400" />
                <span>Free Shipping</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center" data-testid="text-comparison-title">
            Feature Comparison
          </h2>
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-4 text-gray-300 font-semibold">Feature</th>
                    <th className="text-center p-4 text-gray-300 font-semibold">Lite</th>
                    <th className="text-center p-4 text-blue-400 font-semibold">MeasurePRO</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, index) => (
                    <tr key={index} className="border-b border-gray-700 last:border-0" data-testid={`row-feature-${index}`}>
                      <td className="p-4 text-gray-300">{feature.name}</td>
                      <td className="p-4 text-center">
                        {feature.lite ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-600 mx-auto" />
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {feature.pro ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-4">
            Purchase your plan directly through SolTec Innovation
          </p>
          <p className="text-sm text-gray-500 mb-8">
            All MeasurePRO plans and add-ons are purchased at{' '}
            <a href="https://soltecinnovation.com/pricing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
              soltecinnovation.com
            </a>
          </p>
          <a
            href="https://soltecinnovation.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
            data-testid="button-signup-cta"
          >
            Choose a Plan at SolTec Innovation
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 py-8">
        <div className="container mx-auto px-6 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} MeasurePRO. All prices in USD. Taxes may apply.</p>
        </div>
      </footer>
    </div>
  );
}
