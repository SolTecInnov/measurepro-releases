import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Ruler,
  MapPin,
  Camera,
  Database,
  Wifi,
  Smartphone,
  FileText,
  Users,
  CheckCircle,
  ArrowRight,
  HelpCircle,
  Mail,
  Shield,
  FileCheck,
  ExternalLink,
  Lock,
  Zap,
  Target,
  Eye,
  Brain,
  Sparkles,
  Truck,
  AlertTriangle,
  Navigation,
  Route,
  UserPlus,
  Mic,
  Globe,
  Keyboard,
  MessageSquare,
  Volume2,
  Languages,
  Calendar,
  Building2,
  Video
} from 'lucide-react';
import { toast } from 'sonner';

export default function WelcomePage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');

  // Redirect users who already have app access to the protected dashboard at /app
  useEffect(() => {
    const hasAccess = localStorage.getItem('app_access') === 'true';
    if (hasAccess) {
      navigate('/app', { replace: true });
    }
  }, [navigate]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === (import.meta.env.VITE_APP_ACCESS_PASSWORD || '')) {
      localStorage.setItem('app_access', 'true');
      /* toast removed */
      navigate('/app', { replace: true });
    } else {
      toast.error('Incorrect password');
      setPassword('');
    }
  };
  const features = [
    {
      icon: <Ruler className="w-8 h-8" />,
      title: "Precision Measurement",
      description: "Advanced laser measurement technology for accurate height and distance measurements in the field."
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "GPS Integration",
      description: "Real-time GPS tracking and location tagging for comprehensive survey data collection."
    },
    {
      icon: <Camera className="w-8 h-8" />,
      title: "Live Camera Feed",
      description: "Integrated camera system with measurement overlays for visual documentation and analysis."
    },
    {
      icon: <Database className="w-8 h-8" />,
      title: "Data Logging",
      description: "Automated and manual logging capabilities with multiple export formats for seamless reporting."
    },
    {
      icon: <Wifi className="w-8 h-8" />,
      title: "Offline Support",
      description: "Work seamlessly offline with automatic sync when connection is restored."
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "Mobile Ready",
      description: "Optimized for desktop and mobile devices for field work flexibility."
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Survey Management",
      description: "Organize projects with comprehensive survey creation and management tools."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Team Collaboration",
      description: "Share surveys and measurements across your team for efficient collaboration."
    },
    {
      icon: <Ruler className="w-8 h-8" />,
      title: "Camera Calibration Measurement",
      description: "OpenCV.js camera calibration converts AI detections to accurate real-world measurements for bridge clearance and infrastructure surveys."
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Specialized Measurement Modes",
      description: "Bridge surveys, lane width calculations, traffic signal spacing, and railroad overhead clearance with Quebec/Ontario compliance checking."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Navigation */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold text-white">MeasurePRO</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/features"
                className="text-gray-300 hover:text-white transition-colors hidden sm:inline"
                data-testid="link-features"
              >
                Features
              </Link>
              <a
                href="#use-cases"
                className="text-gray-300 hover:text-white transition-colors hidden md:inline"
                data-testid="link-use-cases"
              >
                Use Cases
              </a>
              <Link
                to="/pricing"
                className="text-gray-300 hover:text-white transition-colors hidden sm:inline"
                data-testid="link-pricing"
              >
                Pricing
              </Link>
              <Link
                to="/blog"
                className="text-gray-300 hover:text-white transition-colors hidden md:inline"
                data-testid="link-blog-nav"
              >
                Blog
              </Link>
              <Link
                to="/contact"
                className="text-gray-300 hover:text-white transition-colors hidden lg:inline"
                data-testid="link-contact-nav"
              >
                Contact
              </Link>
              <Link
                to="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                data-testid="button-signin-nav"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* H1 — clear product statement for SEO and first-time visitors */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent" data-testid="text-hero-title">
            LiDAR Road Survey App for Oversize &amp; Overweight Transport
          </h1>
          <p className="text-xl text-gray-300 mb-10 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-description">
            MeasurePRO lets heavy haul and OS/OW teams capture bridge clearances, lane widths, road profiling (grade, K-factor, altitude), and banking/cross-slope data
            from the cab with LiDAR + RTK-GNSS. Convoy Guardian coordinates multi-vehicle moves. Export permit-ready survey data in standard engineering formats.
          </p>

          {/* Primary CTAs — outcome-first for cold traffic */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              data-testid="button-book-demo-hero"
            >
              <Calendar className="w-6 h-6" />
              Book a Demo
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 bg-gray-800/50 border border-gray-600 hover:border-blue-500 text-gray-300 hover:text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all"
              data-testid="button-explore-demo"
            >
              <Eye className="w-5 h-5" />
              Explore Demo
            </Link>
          </div>

          {/* Returning users — de-emphasised for cold traffic */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <Link
              to="/signup"
              className="hover:text-gray-300 transition-colors flex items-center gap-1"
              data-testid="button-signup"
            >
              <UserPlus className="w-4 h-4" />
              Create Account
            </Link>
            <span>·</span>
            <Link
              to="/login"
              className="hover:text-gray-300 transition-colors flex items-center gap-1"
              data-testid="button-signin"
            >
              <Lock className="w-4 h-4" />
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* App Screenshots */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all group" data-testid="screenshot-1">
            <img 
              src="/screenshot-1.png" 
              alt="MeasurePRO - Main Dashboard with Live Camera and Map"
              loading="eager"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all group" data-testid="screenshot-2">
            <img 
              src="/screenshot-2.png" 
              alt="MeasurePRO - Route Planning and Management" 
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all group" data-testid="screenshot-3">
            <img 
              src="/screenshot-3.png" 
              alt="MeasurePRO - GPS Route Tracking" 
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all group" data-testid="screenshot-4">
            <img 
              src="/screenshot-4.png" 
              alt="MeasurePRO - Live Map Navigation" 
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
      </section>

      {/* Hardware System Section */}
      <section id="hardware" className="container mx-auto px-6 py-20 bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold mb-4" data-testid="text-hardware-title">
            The Complete Professional Solution
          </h3>
          <p className="text-gray-300 text-lg max-w-3xl mx-auto mb-6" data-testid="text-hardware-subtitle">
            MeasurePRO is the professional software that powers the SolTec LiDAR 2D Laser Measurement System — 
            a complete surveying solution designed for field professionals.
          </p>
          {/* 5-bullet scannable summary */}
          <ul className="inline-flex flex-col items-start gap-2 text-left text-gray-300 text-base mx-auto mb-2" data-testid="list-hardware-bullets">
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>±2 mm accuracy laser with 0.2–250 m range, IP67-rated for field conditions</span></li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>RTK-GNSS (Swift Duro) geo-tags every measurement to centimetre-level accuracy</span></li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Runs fully offline — no connectivity required during surveys</span></li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Exports to CSV, GeoJSON, Shapefile, LandXML, and DXF for AutoCAD Civil 3D</span></li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Complete bundle — hardware, tablet, mounting kit, training, and 1-year support</span></li>
          </ul>
        </div>

        {/* Hardware Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 max-w-6xl mx-auto">
          {/* LiDAR System */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8" data-testid="card-lidar-system">
            <div className="bg-gray-900 border border-gray-600 rounded-lg aspect-video overflow-hidden mb-6">
              <img 
                src="/lidar-device.png" 
                alt="SolTec LiDAR 2D Laser System mounted on vehicle" 
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <h4 className="text-2xl font-bold mb-3 text-white">SolTec LiDAR 2D Laser System</h4>
            <p className="text-gray-400 mb-4">
              High-precision laser rangefinder with vehicle integration for professional surveying operations.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Range</p>
                <p className="text-white font-semibold">0.2m - 250m</p>
              </div>
              <div>
                <p className="text-gray-500">Accuracy</p>
                <p className="text-white font-semibold">±2mm</p>
              </div>
              <div>
                <p className="text-gray-500">Frequency</p>
                <p className="text-white font-semibold">30 kHz</p>
              </div>
              <div>
                <p className="text-gray-500">Protection</p>
                <p className="text-white font-semibold">IP67</p>
              </div>
            </div>
          </div>

          {/* Rugged Tablet */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8" data-testid="card-tablet">
            <div className="bg-gray-900 border border-gray-600 rounded-lg aspect-video overflow-hidden mb-6">
              <img 
                src="/tablet-device.png" 
                alt="Rugged Windows Tablet with MeasurePRO installed in vehicle" 
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <h4 className="text-2xl font-bold mb-3 text-white">Rugged Windows Tablet (IP67)</h4>
            <p className="text-gray-400 mb-4">
              Military-grade rugged tablet with MeasurePRO pre-installed for harsh environments and field operations.
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span>IP67 dust and water resistant</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span>MeasurePRO Professional pre-installed</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span>All-weather field operation</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Key Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 max-w-4xl mx-auto">
          <div className="text-center" data-testid="spec-speed">
            <Zap className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">30 kHz</p>
            <p className="text-gray-400 text-sm">Ultra-Fast Measurement</p>
          </div>
          <div className="text-center" data-testid="spec-accuracy">
            <Target className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">±2mm</p>
            <p className="text-gray-400 text-sm">High Accuracy</p>
          </div>
          <div className="text-center" data-testid="spec-safety">
            <Eye className="w-10 h-10 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">Class 1</p>
            <p className="text-gray-400 text-sm">Eyesafe Laser</p>
          </div>
          <div className="text-center" data-testid="spec-protection">
            <Shield className="w-10 h-10 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">IP67</p>
            <p className="text-gray-400 text-sm">Weather Resistant</p>
          </div>
        </div>

        {/* Hardware Bundle CTA */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-2 border-blue-500 rounded-lg p-8 max-w-4xl mx-auto text-center" data-testid="card-hardware-bundle">
          <h4 className="text-3xl font-bold mb-4 text-white">
            Complete Survey System Bundle
          </h4>
          <p className="text-xl text-gray-300 mb-6">
            Everything you need to run professional OS/OW road surveys — delivered and ready to mount
          </p>
          <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
            <p className="text-gray-300 text-sm mb-3"><strong>Complete System Includes:</strong></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>SolTec LiDAR 2D Laser System</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Professional GPS Module</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Rugged Windows Tablet (IP67)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>MeasurePRO Professional (6 months)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Vehicle Mounting Kit</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Remote Training (4 hours)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Lowepro Pro Backpack</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>1-Year Support & Warranty</span>
              </div>
            </div>
          </div>
          <a
            href="https://soltecinnovation.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
            data-testid="link-hardware-bundle"
          >
            Contact SolTec Innovation for Pricing
            <ExternalLink className="w-5 h-5" />
          </a>
          <p className="text-gray-400 text-sm mt-4">
            Speak directly with the SolTec team about availability and current pricing
          </p>
        </div>
      </section>

      {/* ── Use Cases Section ─────────────────────────────────────────────── */}
      <section id="use-cases" className="container mx-auto px-6 py-20 border-t border-gray-800">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold mb-4 text-white" data-testid="text-use-cases-title">
            Who Uses MeasurePRO?
          </h3>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto" data-testid="text-use-cases-subtitle">
            Purpose-built for OS/OW heavy haul logistics — not a consumer measuring app
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-10" data-testid="grid-use-cases">

          {/* Pilot car / heavy haul drivers */}
          <div className="bg-gray-800 border border-blue-800/50 rounded-xl p-6" data-testid="card-use-case-pilot">
            <div className="flex items-start gap-4">
              <div className="bg-blue-900/50 rounded-lg p-3 shrink-0">
                <Truck className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Pilot Car Operators & Heavy Haul Drivers</h4>
                <p className="text-gray-400 text-sm mb-3">Measure bridge clearances, overhead wires, and lane widths from the cab while driving the route. Voice commands keep both hands on the wheel.</p>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />Survey candidate routes before move day</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />Flag low bridges, wires, and tight corners as POIs</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />Works offline on any route, no signal needed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* OS/OW permit engineers */}
          <div className="bg-gray-800 border border-purple-800/50 rounded-xl p-6" data-testid="card-use-case-permit">
            <div className="flex items-start gap-4">
              <div className="bg-purple-900/50 rounded-lg p-3 shrink-0">
                <FileText className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">OS/OW Permit Planners & Engineers</h4>
                <p className="text-gray-400 text-sm mb-3">Get field-measured clearance data in engineering formats ready for permit applications, AutoCAD Civil 3D, and RoadScope corridor analysis.</p>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />Export CSV, GeoJSON, Shapefile, LandXML, DXF</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />RTK-GNSS coordinates on every measurement</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />Direct upload to RoadScope for corridor analysis</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bridge inspection teams */}
          <div className="bg-gray-800 border border-green-800/50 rounded-xl p-6" data-testid="card-use-case-bridge">
            <div className="flex items-start gap-4">
              <div className="bg-green-900/50 rounded-lg p-3 shrink-0">
                <Navigation className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Bridge & Infrastructure Inspection Teams</h4>
                <p className="text-gray-400 text-sm mb-3">Document vertical clearances, deck conditions, and structural constraints with geo-tagged photos, video, and laser measurements at each structure.</p>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400 shrink-0" />±2 mm laser accuracy, 0.2–250 m range</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400 shrink-0" />Photos and video with POI timestamp sync</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400 shrink-0" />Auditable record for regulators and customers</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Transport logistics companies */}
          <div className="bg-gray-800 border border-amber-800/50 rounded-xl p-6" data-testid="card-use-case-logistics">
            <div className="flex items-start gap-4">
              <div className="bg-amber-900/50 rounded-lg p-3 shrink-0">
                <Route className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Transport Logistics & Safety Officers</h4>
                <p className="text-gray-400 text-sm mb-3">Build a trusted database of surveyed OS/OW corridors. Share live measurements with escorts, dispatchers, and police via Convoy Guardian's multi-stakeholder system.</p>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />Reuse surveyed corridors for future similar loads</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />Live convoy coordination with QR code access</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />Forensic black box logging for every move</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Read more CTA */}
        <div className="text-center">
          <Link
            to="/features"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            data-testid="button-use-cases-features"
          >
            Explore All Features
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* What's New — v2.1.0 highlight callout */}
      <section className="container mx-auto px-6 py-16 border-t border-gray-800" data-testid="section-whats-new">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-4 py-1 text-sm font-semibold mb-4" data-testid="badge-new-version">
              New in v2.1.0 — April 2026
            </span>
            <h3 className="text-3xl font-bold text-white mb-3" data-testid="text-whats-new-title">
              What's New in MeasurePRO
            </h3>
            <p className="text-gray-400 max-w-2xl mx-auto" data-testid="text-whats-new-subtitle">
              The latest release brings 360° camera support, GPS-enforced route locking, and a full enterprise management tier.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 border border-pink-600/40 rounded-xl p-6" data-testid="card-new-insta360">
              <div className="flex items-center gap-3 mb-3">
                <Video className="w-8 h-8 text-pink-400" />
                <span className="bg-purple-900/50 border border-purple-500 text-purple-300 px-3 py-1 rounded-full text-xs font-semibold">Premium Add-On</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Insta360 360° Camera Integration</h4>
              <p className="text-gray-300 text-sm mb-4">
                Capture fully geo-referenced 360° video alongside your standard survey footage. Equirectangular preview, GPS timestamp sync, and full export in the survey ZIP package — giving stakeholders an immersive view of every clearance point.
              </p>
              <Link to="/features" className="text-pink-400 hover:text-pink-300 text-sm font-medium inline-flex items-center gap-1" data-testid="link-insta360-features">
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-600/40 rounded-xl p-6" data-testid="card-new-enterprise">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-8 h-8 text-blue-400" />
                <span className="bg-blue-900/50 border border-blue-500 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold">Enterprise</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Enterprise Admin Panel</h4>
              <p className="text-gray-300 text-sm mb-4">
                Manage your entire fleet from a single dashboard. Assign team members to companies, control which premium add-ons each user can access, and track licence seats — all without contacting support.
              </p>
              <Link to="/features" className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center gap-1" data-testid="link-enterprise-features">
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link
              to="/changelog"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
              data-testid="link-full-changelog"
            >
              View full v2.1.0 changelog
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold mb-4" data-testid="text-features-title">Powerful Features for Professional Surveying</h3>
          <p className="text-gray-400 text-lg" data-testid="text-features-subtitle">
            Everything you need for comprehensive field measurements and data collection
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/20"
              data-testid={`card-feature-${index}`}
            >
              <div className="text-blue-500 mb-4">{feature.icon}</div>
              <h4 className="text-xl font-semibold mb-2 text-white" data-testid={`text-feature-title-${index}`}>
                {feature.title}
              </h4>
              <p className="text-gray-400" data-testid={`text-feature-description-${index}`}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Voice Commands Section */}
      <section id="voice-commands" className="container mx-auto px-6 py-20 bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Mic className="w-12 h-12 text-blue-400" />
              <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent" data-testid="text-voice-commands-title">
                Voice Commands & Hands-Free Control
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-500 rounded-full px-4 py-2 mb-4">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-semibold">INCLUDED IN ALL PLANS</span>
            </div>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto" data-testid="text-voice-commands-subtitle">
              Control every aspect of MeasurePRO hands-free with comprehensive voice commands in English, French, and Spanish. 
              Perfect for field professionals who need to keep their eyes on the road and hands on the wheel.
            </p>
          </div>

          {/* Key Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-600 rounded-lg p-6 text-center" data-testid="card-voice-commands-count">
              <div className="flex justify-center mb-3">
                <MessageSquare className="w-10 h-10 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1">49+</div>
              <p className="text-gray-300 text-sm">Voice Commands</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-600 rounded-lg p-6 text-center" data-testid="card-voice-languages">
              <div className="flex justify-center mb-3">
                <Languages className="w-10 h-10 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1">3</div>
              <p className="text-gray-300 text-sm">Languages Supported</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-600 rounded-lg p-6 text-center" data-testid="card-voice-handsfree">
              <div className="flex justify-center mb-3">
                <Zap className="w-10 h-10 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1">100%</div>
              <p className="text-gray-300 text-sm">Hands-Free Operation</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-600 rounded-lg p-6 text-center" data-testid="card-voice-poi">
              <div className="flex justify-center mb-3">
                <MapPin className="w-10 h-10 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1">40+</div>
              <p className="text-gray-300 text-sm">POI Types</p>
            </div>
          </div>

          {/* Main Features Card */}
          <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-2 border-blue-500 rounded-xl p-8 mb-12" data-testid="card-voice-features">
            <div className="mb-6">
              <h4 className="text-2xl font-bold text-white mb-2">Complete Voice Control</h4>
              <p className="text-blue-300 mb-4">Every keyboard shortcut, now available by voice command</p>
            </div>
            
            {/* Multilingual Support */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-6 h-6 text-blue-400" />
                <h5 className="text-xl font-semibold text-white">Multilingual Support</h5>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🇺🇸</span>
                    <span className="font-semibold text-white">English</span>
                  </div>
                  <p className="text-gray-300 text-sm">en-US</p>
                </div>
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🇫🇷</span>
                    <span className="font-semibold text-white">Français</span>
                  </div>
                  <p className="text-gray-300 text-sm">fr-FR</p>
                </div>
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🇪🇸</span>
                    <span className="font-semibold text-white">Español</span>
                  </div>
                  <p className="text-gray-300 text-sm">es-ES</p>
                </div>
              </div>
            </div>

            {/* Command Categories */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-blue-300 mb-4 text-lg">📋 Command Categories</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <HelpCircle className="w-5 h-5 text-blue-400" />
                    <h6 className="font-semibold text-white">Information Queries (7)</h6>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Get real-time information without taking your eyes off the road
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Last measurement</li>
                    <li>• GPS location & status</li>
                    <li>• Laser connection status</li>
                    <li>• Fix quality & satellite count</li>
                    <li>• Current speed</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Camera className="w-5 h-5 text-blue-400" />
                    <h6 className="font-semibold text-white">Camera & Logging (13)</h6>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Control image capture, logging modes, and data collection
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Capture images</li>
                    <li>• Start/stop/pause logging</li>
                    <li>• Switch logging modes</li>
                    <li>• Record voice notes</li>
                    <li>• Clear captured images</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Brain className="w-5 h-5 text-blue-400" />
                    <h6 className="font-semibold text-white">AI Detection (4)</h6>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Accept, reject, or correct AI-detected objects
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Accept detection</li>
                    <li>• Reject detection</li>
                    <li>• Correct detection</li>
                    <li>• Test detection mode</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Truck className="w-5 h-5 text-blue-400" />
                    <h6 className="font-semibold text-white">Envelope Clearance (2)</h6>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Monitor vehicle clearance and switch profiles
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Toggle envelope monitoring</li>
                    <li>• Cycle vehicle profiles</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <MapPin className="w-5 h-5 text-blue-400" />
                    <h6 className="font-semibold text-white">POI Selection (16)</h6>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Select Point of Interest types by voice
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Bridge, Trees, Wire, Power Line</li>
                    <li>• Traffic Light, Walkways, Road</li>
                    <li>• Railroad, Intersection</li>
                    <li>• Information, Danger, Restricted</li>
                    <li>• And 6 more POI types...</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Volume2 className="w-5 h-5 text-blue-400" />
                    <h6 className="font-semibold text-white">Audio & Video (7)</h6>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Control alerts, volume, and video recording
                  </p>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Clear warnings/critical alerts</li>
                    <li>• Volume up/down</li>
                    <li>• Toggle video recording</li>
                    <li>• Manual log entries</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Keyboard Integration */}
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Keyboard className="w-6 h-6 text-blue-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-blue-300 mb-2">Works Alongside Keyboard Shortcuts</h5>
                  <p className="text-gray-300 text-sm mb-3">
                    Voice commands complement the full suite of keyboard shortcuts. Use voice when hands-free operation is needed, 
                    and switch to keyboard shortcuts when more convenient. Both methods provide complete control over all MeasurePRO functions.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-900/50 rounded px-3 py-2">
                      <span className="text-blue-400 font-mono">Voice:</span> <span className="text-gray-300">"Capture image"</span>
                    </div>
                    <div className="bg-gray-900/50 rounded px-3 py-2">
                      <span className="text-blue-400 font-mono">Keyboard:</span> <span className="text-gray-300">Ctrl+I</span>
                    </div>
                    <div className="bg-gray-900/50 rounded px-3 py-2">
                      <span className="text-blue-400 font-mono">Voice:</span> <span className="text-gray-300">"Start logging"</span>
                    </div>
                    <div className="bg-gray-900/50 rounded px-3 py-2">
                      <span className="text-blue-400 font-mono">Keyboard:</span> <span className="text-gray-300">Ctrl+L</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Use Case */}
          <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border border-blue-600 rounded-lg p-8 text-center" data-testid="card-voice-professional">
            <h4 className="text-2xl font-bold text-white mb-3">
              Built for Professional Surveyors
            </h4>
            <p className="text-gray-300 mb-4 max-w-2xl mx-auto">
              Voice commands enable truly hands-free operation during active surveys. Keep both hands on the wheel, 
              eyes on the road, and still maintain complete control over measurements, logging, camera capture, 
              and all app functions. Essential for safe and efficient field operations.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <div className="bg-blue-800/30 border border-blue-600 rounded-full px-4 py-2 text-sm text-blue-200">
                ✓ Safety First
              </div>
              <div className="bg-blue-800/30 border border-blue-600 rounded-full px-4 py-2 text-sm text-blue-200">
                ✓ Enhanced Productivity
              </div>
              <div className="bg-blue-800/30 border border-blue-600 rounded-full px-4 py-2 text-sm text-blue-200">
                ✓ Reduced Distractions
              </div>
              <div className="bg-blue-800/30 border border-blue-600 rounded-full px-4 py-2 text-sm text-blue-200">
                ✓ Complete Control
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MeasurePRO+ AI Features Section */}
      <section id="ai-features" className="container mx-auto px-6 py-20 bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Brain className="w-12 h-12 text-purple-400" />
              <h3 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent" data-testid="text-ai-features-title">
                MeasurePRO+ AI Features
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 bg-amber-900/40 border border-amber-500 rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-semibold">BETA FEATURE - Premium AI Add-On</span>
            </div>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto mb-6" data-testid="text-ai-features-subtitle">
              Enhance your surveying workflow with cutting-edge AI-powered object detection, 
              clearance analysis, and automated data collection.
            </p>
            {/* 5-bullet scannable summary */}
            <ul className="inline-flex flex-col items-start gap-2 text-left text-gray-300 text-base mx-auto" data-testid="list-ai-bullets">
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Real-time AI object detection via ZED 2i stereo camera and TensorFlow.js</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Automatic clearance alerts when detected objects approach vehicle height thresholds</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Swept path analysis — simulates turning arcs to predict collision risk before the move</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Permitted route enforcement — GPS compares actual path against approved permit corridor</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Detection logs exported in YOLO format for compliance records and post-move review</span></li>
            </ul>
          </div>

          {/* Pricing Card */}
          <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-2 border-purple-500 rounded-xl p-8 mb-12" data-testid="card-ai-pricing">
            <div className="mb-6">
              <h4 className="text-2xl font-bold text-white mb-2">AI Detection Suite</h4>
              <p className="text-purple-300 mb-4">Advanced computer vision for automated field analysis</p>
              
              {/* Two-Tier Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-purple-800/30 to-purple-900/30 border-2 border-purple-400 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-semibold text-purple-300">RECOMMENDED</span>
                  </div>
                  <div className="text-3xl font-bold text-purple-400 mb-1" data-testid="text-ai-price-lidar">
                    $255 <span className="text-lg text-gray-400">USD/mo</span>
                  </div>
                  <p className="text-sm font-medium text-white mb-2">LiDAR from SolTecInnovation</p>
                  <p className="text-xs text-gray-300">
                    For customers who purchased LiDAR hardware from SolTecInnovation - includes full support and warranty coverage
                  </p>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase mb-2">Alternative Option</div>
                  <div className="text-3xl font-bold text-gray-300 mb-1" data-testid="text-ai-price-byod">
                    $355 <span className="text-lg text-gray-400">USD/mo</span>
                  </div>
                  <p className="text-sm font-medium text-white mb-2">BYOD (Bring Your Own Device)</p>
                  <p className="text-xs text-gray-400">
                    Use your own LiDAR hardware (customer responsibility)
                  </p>
                </div>
              </div>
            </div>
            
            {/* Key Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Camera className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">Real-Time Object Detection</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Automatically identify and classify objects in your camera feed with 26 pre-trained object classes
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">Clearance Alerts</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Automatic warnings when overhead objects are detected below safety thresholds
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">Auto-Logging</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Detected objects automatically logged to your measurements with classification and confidence scores
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">Training Data Collection</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Capture and label training images to improve detection accuracy for your specific use cases
                </p>
              </div>
            </div>

            {/* Object Classes */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-purple-300 mb-3">26 Object Detection Classes</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="font-medium text-gray-400 mb-1">Overhead Infrastructure:</p>
                  <ul className="text-gray-300 space-y-0.5">
                    <li>• Traffic signals</li>
                    <li>• Traffic signs</li>
                    <li>• Street lights</li>
                    <li>• Power lines</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-400 mb-1">Vegetation:</p>
                  <ul className="text-gray-300 space-y-0.5">
                    <li>• Trees</li>
                    <li>• Branches</li>
                    <li>• Shrubs</li>
                    <li>• Foliage</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-400 mb-1">Electrical & More:</p>
                  <ul className="text-gray-300 space-y-0.5">
                    <li>• Utility poles</li>
                    <li>• Transformers</li>
                    <li>• Bridges</li>
                    <li>• And 15 more...</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Beta Notice */}
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-purple-300 mb-1">Join the Beta Program</h5>
                  <p className="text-gray-300 text-sm mb-2">
                    MeasurePRO+ AI is currently in beta testing. Get early access and help shape the future of AI-powered surveying.
                  </p>
                  <a 
                    href="mailto:sales@soltecinnovation.com?subject=MeasurePRO%2B%20AI%20Beta%20Access" 
                    className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-2"
                    data-testid="link-ai-beta-contact"
                  >
                    <Mail className="w-4 h-4" />
                    Contact us: sales@soltecinnovation.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Envelope Clearance Section */}
      <section id="envelope-features" className="container mx-auto px-6 py-20 bg-gradient-to-b from-gray-900 via-orange-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Truck className="w-12 h-12 text-orange-400" />
              <h3 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent" data-testid="text-envelope-features-title">
                Envelope Clearance Monitoring
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 bg-orange-900/40 border border-orange-500 rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-orange-300 font-semibold">Premium Add-On • BETA</span>
            </div>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto" data-testid="text-envelope-features-subtitle">
              Real-time vehicle envelope clearance monitoring with visual and audio alerts for overhead obstacles. 
              Perfect for utility trucks, telecom vehicles, and bucket trucks.
            </p>
          </div>

          {/* Pricing Card */}
          <div className="bg-gradient-to-br from-orange-900/40 to-red-900/40 border-2 border-orange-500 rounded-xl p-8 mb-12" data-testid="card-envelope-pricing">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h4 className="text-2xl font-bold text-white mb-2">Envelope Clearance System</h4>
                <p className="text-orange-300 mb-3">Vehicle clearance monitoring with real-time alerts</p>
                <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-3">
                  <p className="text-sm font-semibold text-orange-200 mb-1">⚡ Powered by ZED 2i Stereo Camera</p>
                  <p className="text-xs text-gray-300">
                    Advanced stereo camera with wide-angle depth sensing, AI-powered spatial perception, dual high-resolution RGB sensors (110° FOV), 
                    integrated IMU/barometer/magnetometer, neural depth engine for precise obstacle detection and 3D mapping - 
                    significantly improved accuracy compared to previous single camera setup
                  </p>
                </div>
              </div>
              <div className="text-right ml-6">
                <div className="text-4xl font-bold text-orange-400" data-testid="text-envelope-price">$125 <span className="text-xl text-gray-400">USD</span></div>
                <div className="text-gray-400">per month</div>
              </div>
            </div>
            
            {/* Key Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Truck className="w-5 h-5 text-orange-400" />
                  <h5 className="font-semibold text-white">25 OS/OW Vehicle Profiles</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Industry-standard OS/OW profiles including flatbed, lowboy/RGN (2-12 axles), perimeter/beam (7-13 axles), schnabel (13-19 axles), and modular configurations (19-22 axles) with complete specifications
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <h5 className="font-semibold text-white">Real-Time Clearance Alerts</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Visual and audio warnings when measurements fall below configurable warning and critical thresholds
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="w-5 h-5 text-orange-400" />
                  <h5 className="font-semibold text-white">Visual Overlay</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Color-coded clearance zones on camera feed - green (safe), yellow (warning), red (critical) with measurement display
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-orange-400" />
                  <h5 className="font-semibold text-white">Dual Violation Logging</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Automatic logging to both envelope store and main measurement database with GPS coordinates, timestamp, and detected object information for unified export
                </p>
              </div>
            </div>

            {/* Hardware Options & Accuracy */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-orange-300 mb-4 text-lg">📷 Hardware Options & Accuracy Comparison</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ZED 2i - RECOMMENDED */}
                <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-2 border-green-500 rounded-lg p-4 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      ✓ RECOMMENDED
                    </div>
                  </div>
                  <div className="mt-2">
                    <h6 className="font-bold text-green-300 mb-2 text-center">ZED 2i Stereo Camera</h6>
                    <div className="text-center mb-3">
                      <div className="text-2xl font-bold text-white">$1,500 USD</div>
                      <div className="text-xs text-gray-400">one-time hardware fee</div>
                    </div>
                    <div className="bg-green-900/30 border border-green-700 rounded p-3 mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">Accuracy:</span>
                        <span className="text-sm font-bold text-green-400">5-6% variance</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{width: '94%'}}></div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 text-center">Best Precision</div>
                    </div>
                    <ul className="text-xs text-gray-300 space-y-1">
                      <li>• Wide-angle depth sensing</li>
                      <li>• AI-powered spatial perception</li>
                      <li>• Dual RGB sensors (110° FOV)</li>
                      <li>• Neural depth engine</li>
                      <li>• IMU/barometer/magnetometer</li>
                    </ul>
                  </div>
                </div>

                {/* Included Camera */}
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                  <h6 className="font-bold text-gray-300 mb-2 text-center">Included Camera with LiDAR</h6>
                  <div className="text-center mb-3">
                    <div className="text-2xl font-bold text-white">$0 USD</div>
                    <div className="text-xs text-gray-400">no additional fee</div>
                  </div>
                  <div className="bg-gray-700/50 border border-gray-600 rounded p-3 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">Accuracy:</span>
                      <span className="text-sm font-bold text-yellow-400">15-20% variance</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{width: '82.5%'}}></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-center">Standard Precision</div>
                  </div>
                  <ul className="text-xs text-gray-300 space-y-1">
                    <li>• Standard camera included</li>
                    <li>• Works with existing LiDAR</li>
                    <li>• Lower precision option</li>
                    <li>• Budget-friendly choice</li>
                    <li>• Basic clearance monitoring</li>
                  </ul>
                </div>

                {/* 3 Directions LiDAR */}
                <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border-2 border-purple-500 rounded-lg p-4">
                  <h6 className="font-bold text-purple-300 mb-2 text-center">3 Directions LiDAR</h6>
                  <div className="text-center mb-3">
                    <div className="text-lg font-bold text-white">Contact Sales</div>
                    <div className="text-xs text-gray-400">custom quote</div>
                  </div>
                  <div className="bg-purple-900/30 border border-purple-700 rounded p-3 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">Accuracy:</span>
                      <span className="text-sm font-bold text-purple-400">1/4" precision</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{width: '99%'}}></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-center">Ultra-Precision</div>
                  </div>
                  <ul className="text-xs text-gray-300 space-y-1">
                    <li>• Professional-grade accuracy</li>
                    <li>• Three-directional LiDAR</li>
                    <li>• Maximum precision (1/4")</li>
                    <li>• Enterprise solution</li>
                    <li className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      <a href="mailto:sales@soltecinnovation.com" className="text-purple-400 hover:text-purple-300 underline">
                        Get quote
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Vehicle Profiles */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-orange-300 mb-3">25 Industry-Standard OS/OW Vehicle Profiles</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
                <div>
                  <p className="font-medium text-gray-200 mb-1">Standard Trailers</p>
                  <ul className="text-gray-400 space-y-0.5">
                    <li>• 5-axle flatbed</li>
                    <li>• Step deck configurations</li>
                    <li>• Length, overhangs, cargo specs</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-200 mb-1">Lowboy/RGN</p>
                  <ul className="text-gray-400 space-y-0.5">
                    <li>• 2-12 axle configurations</li>
                    <li>• Heavy equipment transport</li>
                    <li>• Weight capacity tracking</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-200 mb-1">Specialized</p>
                  <ul className="text-gray-400 space-y-0.5">
                    <li>• Perimeter/beam (7-13 axles)</li>
                    <li>• Schnabel (13-19 axles)</li>
                    <li>• Modular (19-22 axles)</li>
                  </ul>
                </div>
              </div>
              <div className="bg-orange-900/20 border border-orange-800/30 rounded p-3">
                <p className="text-orange-300 text-sm">
                  <strong>📋 Complete Specifications:</strong> Each profile includes length, front/rear overhangs, cargo dimensions, weight capacity, and axle configuration
                </p>
              </div>
            </div>

            {/* Beta Notice */}
            <div className="bg-orange-900/20 border border-orange-800/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-orange-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-orange-300 mb-1">Beta Feature - Early Access</h5>
                  <p className="text-gray-300 text-sm mb-2">
                    Envelope Clearance Monitoring is currently in beta. We're actively collecting feedback to improve the system.
                  </p>
                  <a 
                    href="mailto:sales@soltecinnovation.com?subject=Envelope%20Clearance%20Beta%20Access" 
                    className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-2"
                    data-testid="link-envelope-beta-contact"
                  >
                    <Mail className="w-4 h-4" />
                    Contact us: sales@soltecinnovation.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Swept Path Analysis Section */}
      <section id="swept-path-features" className="container mx-auto px-6 py-20 bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Route className="w-12 h-12 text-yellow-400" />
              <h3 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent" data-testid="text-swept-path-features-title">
                Swept Path Analysis & Turn Prediction
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 bg-purple-900/40 border border-purple-500 rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 font-semibold">Premium Add-On • $450 USD/month</span>
            </div>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto" data-testid="text-swept-path-features-subtitle">
              AI-powered swept path simulation for oversized vehicles. Analyze turns before attempting them, predict vehicle envelope tracking, 
              and receive real-time collision warnings for safe navigation of complex routes.
            </p>
          </div>

          {/* Pricing Card */}
          <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-2 border-purple-500 rounded-xl p-8 mb-12" data-testid="card-swept-path-pricing">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h4 className="text-2xl font-bold text-white mb-2">Swept Path Analysis System</h4>
                <p className="text-purple-300 mb-3">Turn simulation and collision prediction for oversized vehicles</p>
                <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3">
                  <p className="text-sm font-semibold text-purple-200 mb-1">🚛 Requires Envelope Clearance Add-On</p>
                  <p className="text-xs text-gray-300">
                    Uses the same 25 OS/OW vehicle profiles from Envelope Clearance to model complex multi-segment vehicles with trailers, 
                    steerable dollies, and articulation physics for accurate swept path prediction
                  </p>
                </div>
              </div>
              <div className="text-right ml-6">
                <div className="text-4xl font-bold text-purple-400" data-testid="text-swept-path-price">$450 <span className="text-xl text-gray-400">USD</span></div>
                <div className="text-gray-400">per month</div>
              </div>
            </div>

            {/* Key Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">AI Road Detection</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  OpenCV.js edge detection automatically identifies road boundaries from camera feed for accurate turn simulation
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Truck className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">Multi-Segment Vehicle Modeling</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Accurately models tractors, jeeps, trailers, and steerable dollies with articulation points and off-tracking calculation
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Route className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">Real-Time Simulation</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Animated swept path visualization with color-coded clearance levels (Safe/Caution/Warning/Critical/Collision)
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-purple-400" />
                  <h5 className="font-semibold text-white">Collision Detection</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Instant verdict (Feasible/Tight/Impossible) with collision markers showing exact contact points if detected
                </p>
              </div>
            </div>

            {/* Analysis History */}
            <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
              <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                Analysis History & Playback
              </h5>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span>Save and review all turn analyses with thumbnails</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span>Animation playback controls with keyboard shortcuts (Space, ←/→, Home/End)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span>Filter by verdict to find challenging turns</span>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-purple-300 mb-1">Get Started</h5>
                  <p className="text-gray-300 text-sm mb-2">
                    Contact our sales team to add Swept Path Analysis to your MeasurePRO subscription.
                  </p>
                  <a 
                    href="mailto:sales@soltecinnovation.com?subject=Swept%20Path%20Analysis%20Add-On" 
                    className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-2"
                    data-testid="link-swept-path-contact"
                  >
                    <Mail className="w-4 h-4" />
                    Contact us: sales@soltecinnovation.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Convoy Guardian Section */}
      <section id="convoy-features" className="container mx-auto px-6 py-20 bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="w-12 h-12 text-blue-400" />
              <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent" data-testid="text-convoy-features-title">
                Convoy Guardian
              </h3>
            </div>
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-2 bg-amber-900/40 border border-amber-500 rounded-full px-4 py-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-semibold">BETA FEATURE - Premium Add-On • $650 USD/month</span>
              </div>
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border-2 border-amber-400 rounded-lg px-6 py-3 shadow-lg shadow-amber-500/20">
                <Shield className="w-6 h-6 text-amber-300" />
                <span className="text-amber-100 font-bold text-lg">🌟 World's First Black Box for Oversized Convoy Operations</span>
              </div>
            </div>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto mb-6" data-testid="text-convoy-features-subtitle">
              Forensic-grade multi-vehicle coordination system with comprehensive black box logging. Lead vehicle shares live measurements, 
              alerts, and GPS data with all convoy participants. Real-time monitoring accessible to police escorts, utility crews, pilot cars, 
              dispatchers, safety officers, and customers from any location.
            </p>
            {/* 5-bullet scannable summary */}
            <ul className="inline-flex flex-col items-start gap-2 text-left text-gray-300 text-base mx-auto" data-testid="list-convoy-bullets">
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Lead vehicle streams live LiDAR measurements and GPS position to all convoy vehicles</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Police escorts, pilot cars, and dispatchers join via QR code — no app install required</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Forensic black box records all alerts, positions, and measurements with timestamps</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Automated incident log exports for liability, safety audits, and permit compliance</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Supplements (does not replace) physical high pole — adds real-time data layer to every move</span></li>
            </ul>
          </div>

          {/* Pricing Card */}
          <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-2 border-blue-500 rounded-xl p-8 mb-12" data-testid="card-convoy-pricing">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="text-2xl font-bold text-white mb-2">Convoy Guardian System</h4>
                <p className="text-blue-300">Real-time convoy coordination with black box logging</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-blue-400" data-testid="text-convoy-price">$650 <span className="text-xl text-gray-400">USD</span></div>
                <div className="text-gray-400">per month</div>
              </div>
            </div>
            
            {/* Key Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <h5 className="font-semibold text-white">Multi-Stakeholder Coordination</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Share live data with police escorts, utility bucket trucks, pilot cars, dispatchers, and customers via QR code access
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-blue-400" />
                  <h5 className="font-semibold text-white">Emergency Alerts</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Full-screen STOP CONVOY alerts when leader signal is lost (5-minute timeout) with continuous audio warnings
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  <h5 className="font-semibold text-white">Forensic Black Box Logging</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Industry-first complete audit trail with GPS coordinates, speed, altitude, and timestamps for legal compliance
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  <h5 className="font-semibold text-white">Video Evidence</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Automatic video capture on alerts with before/after footage linked to incident reports
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="w-5 h-5 text-blue-400" />
                  <h5 className="font-semibold text-white">Multi-Stakeholder Monitoring</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Police, utility crews, pilot cars, dispatchers, and customers all access live convoy status and black box data
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FileCheck className="w-5 h-5 text-blue-400" />
                  <h5 className="font-semibold text-white">Legal Compliance</h5>
                </div>
                <p className="text-gray-300 text-sm">
                  Export complete forensic reports with GPS evidence, timestamps, and video for incident investigation
                </p>
              </div>
            </div>

            {/* Vehicle Roles */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-blue-300 mb-3">Supported Vehicle Roles</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="text-gray-300">🚗 Pilot Car</div>
                <div className="text-gray-300">🚔 Police Escort</div>
                <div className="text-gray-300">🏗️ Bucket Truck</div>
                <div className="text-gray-300">📦 Oversized Load</div>
                <div className="text-gray-300">🚙 Chase Vehicle</div>
                <div className="text-gray-300">🛠️ Support Vehicle</div>
              </div>
            </div>

            {/* Features List */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-blue-300 mb-3">Core Features</h5>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <span>Leader shares live clearance measurements with all team members</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <span>QR code joining with member identification (name, role, vehicle ID)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <span>Emergency alerts on leader signal loss with action checklists</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <span>Black box logging of all convoy events with GPS, speed, altitude</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <span>Automatic video capture on alerts (before/after footage)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <span>Complete incident report export (PDF, CSV, JSON, ZIP package)</span>
                </li>
              </ul>
            </div>

            {/* Pricing Details */}
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <h5 className="font-semibold text-blue-300 mb-3">Pricing Details</h5>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• $650 USD/month - Up to 3 simultaneous convoys</li>
                <li>• $55 USD/month - Each additional concurrent convoy</li>
                <li>• Includes unlimited team members per convoy</li>
                <li>• Real-time monitoring for police, utility crews, pilot cars, dispatchers, and customers</li>
                <li>• Complete forensic-grade black box logging with GPS evidence</li>
                <li>• Automatic video documentation on all alerts</li>
                <li>• Emergency alerting and safety protocols</li>
                <li>• Export and legal compliance reporting capabilities</li>
              </ul>
            </div>

            {/* Beta Notice */}
            <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-amber-300 mb-1">Beta Feature - Early Access Available</h5>
                  <p className="text-gray-300 text-sm mb-2">
                    Convoy Guardian is currently in beta testing. Join the beta program to get early access to the world's first 
                    black box system for oversized convoy operations and help shape this groundbreaking safety technology.
                  </p>
                  <a 
                    href="mailto:sales@soltecinnovation.com?subject=Convoy%20Guardian%20Beta%20Access" 
                    className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center gap-2"
                    data-testid="link-convoy-beta-contact"
                  >
                    <Mail className="w-4 h-4" />
                    Contact us: sales@soltecinnovation.com
                  </a>
                </div>
              </div>
            </div>

            {/* Safety Notice */}
            <div className="bg-yellow-900/30 border border-yellow-500 rounded p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-300 mb-1">IMPORTANT SAFETY NOTICE</p>
                  <p className="text-yellow-200 text-sm">
                    Convoy Guardian is an ADDITIONAL layer of safety and does NOT replace physical high pole 
                    procedures. Always follow standard safety protocols for convoy operations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Permitted Route Enforcement Section */}
      <section id="route-enforcement" className="container mx-auto px-6 py-20 bg-gradient-to-b from-gray-900 via-green-900/20 to-gray-900">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-green-600 rounded-xl">
                <Navigation className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-4xl font-bold flex items-center gap-3" data-testid="text-route-enforcement-title">
                Permitted Route Enforcement
                <span className="inline-flex items-center gap-1 bg-purple-900/40 border border-purple-500 rounded-full px-3 py-1 text-sm">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-300 font-semibold">BETA</span>
                </span>
              </h3>
            </div>
            <p className="text-xl text-gray-300" data-testid="text-route-enforcement-subtitle">
              GPS-Enforced Route Compliance for Oversized and Permitted Loads
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-gray-800/50 backdrop-blur border border-green-800/50 rounded-2xl p-8">
            {/* Introduction */}
            <div className="mb-8">
              <h4 className="text-2xl font-bold text-white mb-4">Ensure Permitted Route Compliance</h4>
              <p className="text-gray-300 mb-4">
                Permitted Route Enforcement leverages precision GPS tracking to ensure oversized and heavy loads stay on 
                their approved routes. Real-time monitoring, automated alerts, and dispatch-controlled STOP protocols 
                protect against costly violations and legal penalties.
              </p>
            </div>

            {/* Key Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <MapPin className="w-6 h-6 text-green-400 mt-1" />
                  <div>
                    <h5 className="font-semibold text-white mb-2">GPX Route Tracking</h5>
                    <p className="text-gray-300 text-sm">
                      Upload permitted route GPX files with customizable buffer zones for rural (30m) and urban (15m) environments.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <Eye className="w-6 h-6 text-blue-400 mt-1" />
                  <div>
                    <h5 className="font-semibold text-white mb-2">Buffer Zone Visualization</h5>
                    <p className="text-gray-300 text-sm">
                      Real-time map display shows permitted route corridor with color-coded status indicators and distance-from-route tracking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
                  <div>
                    <h5 className="font-semibold text-white mb-2">Off-Route Alerts</h5>
                    <p className="text-gray-300 text-sm">
                      Automatic detection when drivers deviate from permitted routes. Full-screen STOP modal prevents further travel until dispatch clears.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <Users className="w-6 h-6 text-purple-400 mt-1" />
                  <div>
                    <h5 className="font-semibold text-white mb-2">Dispatch Console</h5>
                    <p className="text-gray-300 text-sm">
                      Live monitoring dashboard with incident management, QR code convoy setup, and dispatch clearance controls.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-gradient-to-r from-green-900/30 to-purple-900/30 border border-green-800/50 rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="text-2xl font-bold text-white mb-2">Subscription Pricing</h5>
                  <div className="space-y-3 text-gray-300">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-green-400">$350 USD</span>
                      <span className="text-gray-400">/month</span>
                      <span className="text-sm text-gray-500">• Includes 3 active convoys</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-blue-400">$55 USD</span>
                      <span className="text-gray-400">/month per additional convoy</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-6">
                  <CheckCircle className="w-16 h-16 text-green-400" />
                </div>
              </div>
            </div>

            {/* Hardware Requirements */}
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-blue-300 mb-2">Hardware Requirements</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• GPS-enabled device (built-in GPS or external GPS module)</li>
                    <li>• Internet connection for real-time monitoring (offline detection available)</li>
                    <li>• MeasurePRO compatible tablet or smartphone</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Beta Notice */}
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-purple-300 mb-1">Beta Feature - Early Access Available</h5>
                  <p className="text-gray-300 text-sm mb-2">
                    Permitted Route Enforcement is currently in beta testing. Join the beta program to help shape this 
                    innovative compliance technology and get discounted early access pricing.
                  </p>
                  <a 
                    href="mailto:sales@soltecinnovation.com?subject=Route%20Enforcement%20Beta%20Access" 
                    className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-2"
                    data-testid="link-route-enforcement-beta-contact"
                  >
                    <Mail className="w-4 h-4" />
                    Contact us: sales@soltecinnovation.com
                  </a>
                </div>
              </div>
            </div>

            {/* Legal Notice */}
            <div className="bg-yellow-900/30 border border-yellow-500 rounded p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-300 mb-1">IMPORTANT COMPLIANCE NOTICE</p>
                  <p className="text-yellow-200 text-sm">
                    Route Enforcement is a compliance monitoring tool and does NOT replace legal permits or required 
                    route approvals. Always obtain proper permits and follow all local regulations for oversized loads.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About / What is MeasurePRO ────────────────────────────────────── */}
      {/* LLM-friendly prose section: end-to-end description for AI search indexing */}
      <section id="about" className="container mx-auto px-6 py-20 border-t border-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-6 text-white" data-testid="text-about-title">
            What is MeasurePRO?
          </h2>
          <div className="space-y-4 text-gray-300 text-lg leading-relaxed mb-10" data-testid="text-about-body">
            <p>
              MeasurePRO is a professional desktop application developed by{' '}
              <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                SolTec Innovation
              </a>{' '}
              for field engineers and logistics coordinators working with oversize and overweight (OS/OW) loads
              in Canada and the United States. It runs on rugged Windows tablets, laptops, or any modern browser
              and works fully offline — critical for remote or low-connectivity survey routes.
            </p>
            <p>
              In practice, a surveyor drives the permitted route with a SolTec LiDAR laser mounted on the cab.
              MeasurePRO records every measurement tagged with RTK-GNSS coordinates, captures photos and video,
              and flags bridge clearances, lane widths, overhead obstructions, and road geometry issues in real time.
              At the end of the survey, the data is exported in engineering formats (CSV, GeoJSON, Shapefile, LandXML,
              DXF) ready for AutoCAD Civil 3D, permit applications, and upload to{' '}
              <a href="https://roadscope.app" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                RoadScope
              </a>
              {' '}for route-level clearance analysis. Surveys flow directly into RoadScope for corridor-wide bridge
              and obstacle clearance reports used in OS/OW permit planning.
            </p>
            <p>
              MeasurePRO is <strong className="text-white">not</strong> a consumer AR measuring app or a photo
              measuring tool. It is purpose-built for heavy haul pilot car operators, OS/OW permit planners,
              bridge inspection teams, and civil engineers who require survey-grade accuracy and reliable
              offline operation in the field.
            </p>
          </div>

          {/* SolTec brand cross-links */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6 mb-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-center" data-testid="card-brand-links">
            <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer"
               className="hover:bg-gray-700/50 rounded-lg p-3 transition-colors group">
              <p className="text-white font-semibold group-hover:text-blue-300">SolTec Innovation</p>
              <p className="text-gray-400 text-sm mt-1">Hardware bundles, company, and full pricing</p>
              <p className="text-blue-400 text-xs mt-1">soltecinnovation.com →</p>
            </a>
            <a href="https://roadscope.app" target="_blank" rel="noopener noreferrer"
               className="hover:bg-gray-700/50 rounded-lg p-3 transition-colors group">
              <p className="text-white font-semibold group-hover:text-green-300">RoadScope</p>
              <p className="text-gray-400 text-sm mt-1">Route-level clearance analysis platform</p>
              <p className="text-green-400 text-xs mt-1">roadscope.app →</p>
            </a>
            <a href="https://soltec.ca" target="_blank" rel="noopener noreferrer"
               className="hover:bg-gray-700/50 rounded-lg p-3 transition-colors group">
              <p className="text-white font-semibold group-hover:text-purple-300">SolTec</p>
              <p className="text-gray-400 text-sm mt-1">Heavy transport consulting and engineering</p>
              <p className="text-purple-400 text-xs mt-1">soltec.ca →</p>
            </a>
          </div>

          {/* FAQ — structured for AI/LLM discovery and SEO */}
          <h2 className="text-3xl font-bold mb-6 text-white" data-testid="text-faq-title">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6" data-testid="section-faq">

            <details className="bg-gray-800 border border-gray-700 rounded-lg p-5 open:border-blue-500 transition-all" open>
              <summary className="font-semibold text-white cursor-pointer text-lg">
                Is this the same as the consumer "Measure Pro" or "Measure Map Pro" apps?
              </summary>
              <p className="mt-3 text-gray-300 leading-relaxed">
                No. MeasurePRO (measure-pro.app) is a completely separate, professional product made by SolTec Innovation
                in Canada. It has no connection to Apple's Measure app, Measure Map Pro, My Measures, or any other
                consumer photo/AR measuring tools. MeasurePRO is used exclusively with LiDAR laser hardware and
                RTK-GNSS receivers for OS/OW road survey operations.
              </p>
            </details>

            <details className="bg-gray-800 border border-gray-700 rounded-lg p-5 open:border-blue-500 transition-all">
              <summary className="font-semibold text-white cursor-pointer text-lg">
                Who uses MeasurePRO?
              </summary>
              <p className="mt-3 text-gray-300 leading-relaxed">
                MeasurePRO is used by heavy haul logistics companies, pilot car operators, OS/OW permit planners,
                civil engineers, and provincial/state road authorities — primarily in Canada and the United States.
                Common users include transport companies that move wind turbine blades, modular homes, industrial
                equipment, and other oversized loads that require certified route surveys before a move.
              </p>
            </details>

            <details className="bg-gray-800 border border-gray-700 rounded-lg p-5 open:border-blue-500 transition-all">
              <summary className="font-semibold text-white cursor-pointer text-lg">
                What hardware does MeasurePRO support?
              </summary>
              <p className="mt-3 text-gray-300 leading-relaxed">
                MeasurePRO connects to LiDAR laser distance meters (SolTec laser systems), Swift Navigation Duro RTK-GNSS receivers, Hesai Pandar40P 3D LiDAR, and ZED 2i stereo
                cameras via USB Serial, Bluetooth, or WebSocket. Hardware bundles including a rugged IP67 Windows tablet
                and vehicle mounting kit are available at{' '}
                <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                  soltecinnovation.com
                </a>.
              </p>
            </details>

            <details className="bg-gray-800 border border-gray-700 rounded-lg p-5 open:border-blue-500 transition-all">
              <summary className="font-semibold text-white cursor-pointer text-lg">
                How does MeasurePRO integrate with RoadScope?
              </summary>
              <p className="mt-3 text-gray-300 leading-relaxed">
                RoadScope (roadscope.app) is SolTec Innovation's route-level clearance analysis platform. MeasurePRO
                exports survey data in standard formats that upload directly to RoadScope for corridor-wide bridge and
                obstacle clearance reports. A RoadScope Integration add-on is available to automate the sync.
              </p>
            </details>

            <details className="bg-gray-800 border border-gray-700 rounded-lg p-5 open:border-blue-500 transition-all">
              <summary className="font-semibold text-white cursor-pointer text-lg">
                How is MeasurePRO licensed and supported?
              </summary>
              <p className="mt-3 text-gray-300 leading-relaxed">
                MeasurePRO is available as a monthly subscription ($300 USD/month) or annual plan ($3,000/year).
                A one-time Lite license ($850 USD) is also available for basic measurement use without cloud sync.
                All subscriptions include software updates. Full hardware bundle pricing is managed by SolTec Innovation
                at{' '}
                <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                  soltecinnovation.com
                </a>.
                Support is provided via the in-app contact form and by email.
              </p>
            </details>

            <details className="bg-gray-800 border border-gray-700 rounded-lg p-5 open:border-blue-500 transition-all">
              <summary className="font-semibold text-white cursor-pointer text-lg">
                Does MeasurePRO work offline?
              </summary>
              <p className="mt-3 text-gray-300 leading-relaxed">
                Yes. MeasurePRO is an offline-first PWA. All measurement data, GPS tracks, photos, and survey records
                are saved locally to IndexedDB on the device. A 10-day offline grace period is included for all
                subscriptions. Data syncs automatically to the cloud when an internet connection is available.
              </p>
            </details>

          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold mb-4" data-testid="text-pricing-title">Choose Your Plan</h3>
          <p className="text-gray-400 text-lg" data-testid="text-pricing-subtitle">
            Flexible pricing options to match your team's needs
          </p>
        </div>

        {/* Base Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {/* MeasurePRO Lite - Lifetime */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8" data-testid="card-pricing-lite">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-6 h-6 text-gray-400" />
              <span className="bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">LIFETIME</span>
            </div>
            <h4 className="text-2xl font-bold mb-2 text-white" data-testid="text-plan-lite-title">MeasurePRO Lite</h4>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white" data-testid="text-price-lite">$850 USD</span>
              <span className="text-gray-400 text-lg"> one-time</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">Core measurement features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">GPS tracking & mapping</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">Offline mode (10-day grace)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-gray-500 mt-0.5" />
                <span className="text-gray-500">No photo/video recording</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-gray-500 mt-0.5" />
                <span className="text-gray-500">No cloud sync or add-ons</span>
              </li>
            </ul>
            <Link
              to="/signup"
              className="block w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold text-center transition-colors"
              data-testid="button-plan-lite"
            >
              Get Started
            </Link>
          </div>

          {/* MeasurePRO Subscription - Most Popular */}
          <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-2 border-blue-500 rounded-lg p-8 relative" data-testid="card-pricing-subscription">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              Most Popular
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="text-2xl font-bold mb-2 text-white" data-testid="text-plan-subscription-title">MeasurePRO</h4>
            <div className="mb-2">
              <span className="text-4xl font-bold text-white" data-testid="text-price-subscription">$300 USD</span>
              <span className="text-gray-300 text-lg">/month</span>
            </div>
            <div className="bg-green-900/40 border border-green-600 rounded-lg p-2 mb-6">
              <p className="text-green-400 text-sm font-semibold">Annual: $3,000/year</p>
              <p className="text-green-300 text-xs">Pay for 10 months, get 12! Save $600</p>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">All Lite features included</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">Cloud sync & backup</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">Multi-device support</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">Priority support</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">Add-on modules available</span>
              </li>
            </ul>
            <Link
              to="/signup"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-center transition-colors"
              data-testid="button-subscribe"
            >
              Get Started
            </Link>
          </div>

          {/* Beta Tester - Free */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8" data-testid="card-pricing-beta">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              <span className="bg-yellow-600 text-white text-xs font-bold px-2 py-1 rounded">REQUIRES APPROVAL</span>
            </div>
            <h4 className="text-2xl font-bold mb-2 text-white" data-testid="text-plan-beta-title">Beta Tester</h4>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white" data-testid="text-price-beta">Free</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">All MeasurePRO features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span className="text-gray-300">Early access to new features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <span className="text-gray-300">Feedback required</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <span className="text-gray-300">Limited availability</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <span className="text-gray-300">Subject to admin approval</span>
              </li>
            </ul>
            <Link
              to="/signup"
              className="block w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-semibold text-center transition-colors"
              data-testid="button-apply-beta"
            >
              Apply Now
            </Link>
          </div>
        </div>

        {/* MeasurePRO+ Add-ons */}
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h4 className="text-2xl font-bold text-white">MeasurePRO+ Add-ons</h4>
            </div>
            <p className="text-gray-400">Enhance your MeasurePRO subscription with specialized modules</p>
            <p className="text-purple-400 text-sm mt-1">Requires MeasurePRO Monthly or Annual subscription</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition-all">
              <Brain className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">AI Detection</p>
              <p className="text-purple-400 font-bold">$250/mo</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition-all">
              <Truck className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">Envelope</p>
              <p className="text-purple-400 font-bold">$125/mo</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition-all">
              <Navigation className="w-8 h-8 text-orange-400 mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">Convoy</p>
              <p className="text-purple-400 font-bold">$650/mo</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition-all">
              <Route className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">Route</p>
              <p className="text-purple-400 font-bold">$350/mo</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition-all">
              <Target className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">Swept Path</p>
              <p className="text-purple-400 font-bold">$450/mo</p>
            </div>
          </div>

          {/* RoadScope Integration */}
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-600 rounded-lg p-6 text-center">
            <Database className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <h5 className="text-xl font-bold text-white mb-2">RoadScope Integration</h5>
            <p className="text-gray-300 text-sm mb-3">Sync surveys to RoadScope platform</p>
            <div className="flex items-center justify-center gap-4">
              <div>
                <span className="text-green-400 font-bold">$350/mo</span>
                <span className="text-gray-400 text-sm"> or </span>
                <span className="text-green-400 font-bold">$3,500/yr</span>
                <span className="text-green-300 text-xs ml-1">(2 months free!)</span>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
              data-testid="link-view-full-pricing"
            >
              View Full Pricing Details
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Help & Support Section */}
      <section id="help" className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold mb-4" data-testid="text-help-title">Help & Support</h3>
          <p className="text-gray-400 text-lg" data-testid="text-help-subtitle">
            We're here to help you get the most out of MeasurePRO
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link
            to="/documentation"
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-all text-center"
            data-testid="link-documentation"
          >
            <HelpCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold mb-2 text-white">Documentation</h4>
            <p className="text-gray-400">Complete guides and tutorials</p>
          </Link>
          <Link
            to="/contact"
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-all text-center"
            data-testid="link-contact"
          >
            <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold mb-2 text-white">Contact Us</h4>
            <p className="text-gray-400">Get in touch with our team</p>
          </Link>
          <Link
            to="/help"
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-all text-center"
            data-testid="link-help-center"
          >
            <FileText className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold mb-2 text-white">Help Center</h4>
            <p className="text-gray-400">FAQs and support articles</p>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-8 h-8 text-blue-500" />
                <span className="text-2xl font-bold text-white">MeasurePRO</span>
              </div>
              <p className="text-gray-400 mb-4" data-testid="text-footer-description">
                Professional LiDAR road survey software for OS/OW heavy haul and oversize transport logistics.
                Built by SolTec Innovation — the Canadian engineering firm behind the SolTec LiDAR 2D measurement system.
              </p>
              <a
                href="https://soltecinnovation.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-2 mb-4"
                data-testid="link-company"
              >
                Built by SolTec Innovation
                <ExternalLink className="w-4 h-4" />
              </a>
              <div className="border-t border-gray-700 pt-4">
                <p className="text-gray-400 text-sm mb-2">
                  MeasurePRO is tested and used daily by{' '}
                  <a
                    href="https://soltec.ca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors underline"
                    data-testid="link-soltec-ca"
                  >
                    SolTec
                  </a>
                  {' '}— a heavy transportation consultant specialized in oversize load route surveys and LiDAR field measurements across Canada.
                </p>
                <a
                  href="https://soltec.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                  data-testid="link-soltec-ca-footer"
                >
                  Visit soltec.ca
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h5 className="font-semibold text-white mb-4">Product</h5>
              <ul className="space-y-2">
                <li>
                  <Link to="/features" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-features">
                    Features
                  </Link>
                </li>
                <li>
                  <a href="#use-cases" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-use-cases">
                    Use Cases
                  </a>
                </li>
                <li>
                  <Link to="/pricing" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-pricing">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-blog">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link to="/changelog" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-changelog">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support & Legal */}
            <div>
              <h5 className="font-semibold text-white mb-4">Support</h5>
              <ul className="space-y-2">
                <li>
                  <Link to="/help" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-help">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link to="/documentation" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-docs">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-contact">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors" data-testid="link-privacy">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-gray-400 hover:text-white transition-colors" data-testid="link-terms">
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link to="/policies" className="text-gray-400 hover:text-white transition-colors" data-testid="link-policies">
                    Policies
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-700 pt-8 text-center">
            <p className="text-gray-400" data-testid="text-copyright">
              © {new Date().getFullYear()} MeasurePRO by SolTec Innovation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
