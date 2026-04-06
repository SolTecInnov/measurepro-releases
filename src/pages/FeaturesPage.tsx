import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import {
  ArrowLeft,
  Ruler,
  MapPin,
  Camera,
  Database,
  WifiOff,
  Download,
  Monitor,
  Smartphone,
  Zap,
  Eye,
  Brain,
  Sparkles,
  Route,
  Video,
  FileImage,
  Shield,
  Users,
  TrendingUp,
  FileText,
  Gauge,
  CircuitBoard,
  Target,
  CheckCircle,
  ArrowRight,
  Mic,
  Globe,
  Volume2,
  Lightbulb,
  Code,
  Info,
  PlayCircle,
  MapPinned,
  Settings,
  CloudRain,
  Building2,
  Lock,
  Package
} from 'lucide-react';

export default function FeaturesPage() {
  // Per-page SEO: unique title + meta description for this route
  useEffect(() => {
    document.title = 'Features — MeasurePRO LiDAR Road Survey App | measure-pro.app';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Explore all MeasurePRO features: LiDAR laser measurement, RTK-GNSS tracking, bridge clearance alerts, swept path analysis, AI object detection, and multi-format export for OS/OW heavy haul surveys.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/features');
    return () => {
      document.title = 'MeasurePRO — LiDAR Road Survey App for Oversize & Overweight Transport | measure-pro.app';
      if (meta) meta.setAttribute('content', 'MeasurePRO by SolTec Innovation: professional LiDAR & GPS field app for OS/OW heavy haul surveys. Measure bridge clearances, lane widths, road geometry and export permit-ready data.');
      if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/');
    };
  }, []);

  const coreFeatures = [
    {
      icon: <Ruler className="w-10 h-10" />,
      title: "Real-Time Laser Measurement",
      description: "Professional-grade laser distance meter integration with 30 kHz sampling rate and ±2mm accuracy. Measure vertical clearances, bridge heights, and infrastructure dimensions with precision.",
      highlights: ["±2mm accuracy", "0.2m - 250m range", "30 kHz sampling", "Ground reference subtraction"]
    },
    {
      icon: <MapPin className="w-10 h-10" />,
      title: "GPS Tracking & Mapping",
      description: "Dual GPS system with hardware GPS primary and browser geolocation failsafe. Real-time position tracking, route visualization, and geo-referenced data collection.",
      highlights: ["Dual GPS system", "Real-time tracking", "Route visualization", "Location tagging"]
    },
    {
      icon: <Camera className="w-10 h-10" />,
      title: "Live Camera Integration",
      description: "Dual camera support with standard webcams and ZED 2i stereo camera. Real-time video feed with measurement overlays, depth sensing, and visual documentation.",
      highlights: ["Dual camera support", "Measurement overlays", "Depth sensing (ZED 2i)", "Visual documentation"]
    },
    {
      icon: <Database className="w-10 h-10" />,
      title: "Comprehensive Data Logging",
      description: "Automated and manual logging with offline-first IndexedDB storage. Cloud sync with Firebase when online. Never lose data even without connectivity.",
      highlights: ["Offline-first storage", "Cloud synchronization", "Auto-logging", "Manual entry support"]
    }
  ];

  const advancedFeatures = [
    {
      icon: <Brain className="w-10 h-10 text-purple-400" />,
      title: "AI-Powered Object Detection",
      badge: "MeasurePRO+",
      badgeColor: "bg-purple-600 border-purple-400 text-white",
      description: "Real-time AI detection using TensorFlow.js COCO-SSD model. Automatic identification of obstacles, vehicles, pedestrians, and infrastructure elements. $250/mo add-on.",
      highlights: ["Real-time detection", "80+ object classes", "Confidence scoring", "Detection logging"]
    },
    {
      icon: <Eye className="w-10 h-10 text-blue-400" />,
      title: "Envelope Clearance Monitoring",
      badge: "MeasurePRO+",
      badgeColor: "bg-blue-600 border-blue-400 text-white",
      description: "Real-time clearance monitoring with ZED 2i stereo camera. Configurable vehicle profiles, warning/critical thresholds, and automatic violation alerts. $125/mo add-on.",
      highlights: ["Real-time monitoring", "25 vehicle profiles", "Color-coded alerts", "Violation logging"]
    },
    {
      icon: <Users className="w-10 h-10 text-orange-400" />,
      title: "Convoy Guardian",
      badge: "MeasurePRO+",
      badgeColor: "bg-orange-600 border-orange-400 text-white",
      description: "Multi-vehicle convoy coordination with black box logging, QR code join, emergency alerts, and comprehensive event tracking for complex heavy haul moves. $650/mo add-on.",
      highlights: ["Multi-vehicle coordination", "Black box logging", "Emergency alerts", "QR code join"]
    },
    {
      icon: <Route className="w-10 h-10 text-green-400" />,
      title: "Route Enforcement",
      badge: "MeasurePRO+",
      badgeColor: "bg-green-600 border-green-400 text-white",
      description: "GPS-based route compliance system for permitted loads and oversized vehicles. GPX route upload, buffer zones, and non-dismissable STOP modal for violations. $350/mo add-on.",
      highlights: ["GPX route upload", "Buffer zone visualization", "Off-route detection", "STOP modal alerts"]
    },
    {
      icon: <TrendingUp className="w-10 h-10 text-amber-400" />,
      title: "Swept Path Analysis",
      badge: "MeasurePRO+",
      badgeColor: "bg-amber-600 border-amber-400 text-white",
      description: "Real-time turn prediction and swept path simulation. Multi-segment vehicle modeling with off-tracking calculation and collision detection. $450/mo add-on.",
      highlights: ["Turn detection", "Off-tracking calculation", "Collision detection", "Canvas visualization"]
    },
    {
      icon: <Lock className="w-10 h-10 text-red-400" />,
      title: "Survey Route Lock",
      badge: "Premium",
      badgeColor: "bg-red-900/50 border-red-500 text-red-300",
      description: "GPS-enforced locked navigation mode for operator-approved permitted routes. Once activated, any deviation from the approved path triggers a non-dismissable STOP alert — keeping crews on the right road.",
      highlights: ["Locked GPS navigation", "Non-dismissable STOP alert", "Operator-approved routes", "Audit trail logging"]
    },
    {
      icon: <Video className="w-10 h-10 text-pink-400" />,
      title: "Insta360 360° Camera Add-On",
      badge: "Premium Add-On",
      badgeColor: "bg-pink-900/50 border-pink-500 text-pink-300",
      description: "Real-time 360° video capture with GPS synchronisation and equirectangular preview. Geo-referenced immersive footage is stored alongside standard survey data and exported in the full survey ZIP package.",
      highlights: ["360° equirectangular video", "GPS timestamp sync", "Integrated survey export", "Pairs with standard cameras"]
    },
    {
      icon: <Sparkles className="w-10 h-10 text-cyan-400" />,
      title: "3D Point Cloud Scanning",
      badge: "Premium Add-On",
      badgeColor: "bg-cyan-900/50 border-cyan-500 text-cyan-300",
      description: "Professional infrastructure scanning with ZED 2i stereo camera and Hesai Pandar40P real UDP decoder. Real-time point cloud generation with GPS georeferencing, Three.js 3D visualization, and multi-format export (PLY, LAS).",
      highlights: ["ZED 2i depth sensing", "Pandar40P real UDP decoder", "PLY/LAS export", "Three.js viewer"]
    }
  ];

  const operationalFeatures = [
    {
      icon: <MapPinned className="w-10 h-10" />,
      title: "Expanded POI System — 40+ Types",
      description: "A comprehensive library of over 40 structured POI types for every clearance scenario: bridges, overhead wires, traffic signals, rail crossings, tight corners, curves, road features, and more. Each type has dedicated auto-capture settings, voice trigger phrases, and colour-coded map pins.",
      highlights: ["40+ structured POI types", "Voice-activated capture", "Auto-capture per type", "Colour-coded map pins"]
    },
    {
      icon: <Package className="w-10 h-10" />,
      title: "Auto-Part Manager",
      description: "Automatically splits surveys into sequential parts after 200 POIs are reached. Each new part is named with a sequential suffix and continues seamlessly. Prevents oversized surveys and keeps data organized for long-haul routes.",
      highlights: ["Auto-split at 200 POIs", "Sequential part naming", "Seamless continuation", "No data loss on split"]
    },
    {
      icon: <CloudRain className="w-10 h-10" />,
      title: "Weather-Resilient Measurements",
      description: "Advanced noise filtering algorithms maintain measurement accuracy in challenging weather. Intelligent signal processing filters rain, snow, and atmospheric interference for reliable data in adverse conditions.",
      highlights: ["Rain/snow filtering", "Adaptive noise reduction", "Signal quality indicators", "Weather condition logging"]
    },
    {
      icon: <WifiOff className="w-10 h-10" />,
      title: "Offline-First Functionality",
      description: "Full PWA with comprehensive offline support. Work anywhere with 10-day grace period for cloud sync. Automatic sync when connection restored.",
      highlights: ["10-day grace period", "PWA support", "Auto-sync", "Offline authentication"]
    },
    {
      icon: <Mic className="w-10 h-10" />,
      title: "Multilingual Voice Commands",
      description: "Hands-free operation with voice commands in English, French, and Spanish. Query measurements, GPS data, and control settings using natural language. Includes voice notes for documentation.",
      highlights: ["49+ voice commands", "3 languages (EN/FR/ES)", "Voice notes (offline)", "⚠️ Internet required for commands"]
    },
    {
      icon: <Video className="w-10 h-10" />,
      title: "Geo-Referenced Video Recording",
      description: "Record video with GPS timestamp synchronization. POI markers, playback with location navigation, and IndexedDB storage for offline access.",
      highlights: ["GPS synchronization", "POI markers", "Offline playback", "VP9 compression"]
    },
    {
      icon: <FileImage className="w-10 h-10" />,
      title: "Photo & Video Documentation",
      description: "Capture photos with EXIF GPS data. Timelapse recording, media compression (75% JPEG quality), and comprehensive visual documentation.",
      highlights: ["EXIF GPS data", "Timelapse mode", "Media compression", "Visual documentation"]
    },
    {
      icon: <Download className="w-10 h-10" />,
      title: "Multi-Format Data Export",
      description: "Survey POI data exports as CSV, JSON, and GeoJSON. Full survey ZIP packages include photos, videos, voice notes, geo-referenced video, and GPS traces. Road profile engineering exports as CSV, GeoJSON, Shapefile (.shp), DXF, LandXML, KML/KMZ, or GPX with grade colour-coding. Point cloud scans export as PLY or LAS.",
      highlights: ["CSV / JSON / GeoJSON survey data", "Road profile: KML/KMZ + GPX with grade colour", "Road profile: Shapefile, DXF, LandXML", "Point cloud: PLY / LAS"]
    }
  ];

  const multiDeviceFeatures = [
    {
      icon: <Monitor className="w-10 h-10" />,
      title: "Live Monitoring",
      description: "Real-time monitoring dashboard for supervisors. View live measurements, GPS position, and camera feed from remote devices via WebSocket.",
      highlights: ["Real-time dashboard", "WebSocket sync", "Remote viewing", "QR code join"]
    },
    {
      icon: <Smartphone className="w-10 h-10" />,
      title: "Multi-Device Support",
      description: "Slave app mode for synchronized data capture. Multiple devices can log to same survey with automatic cloud sync.",
      highlights: ["Slave app mode", "Synchronized logging", "Cloud sync", "Team collaboration"]
    },
    {
      icon: <Users className="w-10 h-10" />,
      title: "Convoy Guardian System",
      description: "Multi-vehicle convoy coordination with black box logging. QR code join, emergency alerts, and comprehensive event tracking.",
      highlights: ["Multi-vehicle", "Black box logging", "Emergency alerts", "Event tracking"]
    },
    {
      icon: <Building2 className="w-10 h-10" />,
      title: "Enterprise Admin Panel",
      badge: "Enterprise",
      description: "Company-level management dashboard for fleet operators and enterprise accounts. Assign users to companies, control per-member add-on access, and manage licence seats from a central admin interface.",
      highlights: ["Company management", "User assignment", "Per-member add-on control", "Licence seat tracking"]
    },
    {
      icon: <Shield className="w-10 h-10" />,
      title: "Secure Authentication",
      description: "Firebase Authentication with email verification, OTP-based password reset, admin approval workflow, and role-based access control.",
      highlights: ["Email verification", "OTP password reset", "Admin approval", "Role-based access"]
    }
  ];

  const technicalFeatures = [
    {
      icon: <CircuitBoard className="w-10 h-10" />,
      title: "Hardware Integration",
      description: "Web Serial API for direct laser and GPS communication. MediaStream API for camera access. Comprehensive hardware abstraction layer.",
      highlights: ["Web Serial API", "MediaStream API", "Hardware abstraction", "Auto-detection"]
    },
    {
      icon: <Target className="w-10 h-10" />,
      title: "Specialized Measurement Modes",
      description: "Bridge surveys, lane width calculations, traffic signal spacing, railroad overhead clearance with Quebec/Ontario compliance checking.",
      highlights: ["Bridge surveys", "Lane measurements", "Signal spacing", "Compliance checking"]
    },
    {
      icon: <Gauge className="w-10 h-10" />,
      title: "Camera Calibration",
      description: "OpenCV.js camera calibration for accurate real-world measurements. Convert AI detections to precise distance measurements.",
      highlights: ["OpenCV.js calibration", "Real-world accuracy", "AI measurement", "Calibration storage"]
    },
    {
      icon: <FileText className="w-10 h-10" />,
      title: "Survey Management",
      description: "Create and manage surveys with client details, project numbers, and POI organization. Comprehensive survey statistics and reporting.",
      highlights: ["Survey organization", "POI management", "Statistics tracking", "Report generation"]
    }
  ];

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
                to="/pricing"
                className="text-gray-300 hover:text-white transition-colors hidden sm:inline"
                data-testid="link-pricing"
              >
                Pricing
              </Link>
              <Link
                to="/blog"
                className="text-gray-300 hover:text-white transition-colors hidden sm:inline"
                data-testid="link-blog"
              >
                Blog
              </Link>
              <Link
                to="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                data-testid="button-signup"
              >
                Get Started
              </Link>
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
              MeasurePRO Features
            </h1>
          </div>
          <p className="text-xl text-gray-300 leading-relaxed" data-testid="text-page-subtitle">
            Professional LiDAR and GPS road survey tools built for oversize/overweight (OS/OW) heavy haul logistics.
            Capture bridge clearances, lane widths, and road geometry from the cab — then export permit-ready data
            in engineering formats. From real-time laser measurement to AI obstacle detection and swept path analysis,
            MeasurePRO covers the full OS/OW field survey workflow.
          </p>
        </div>
      </section>

      {/* Core Features */}
      <section className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3 text-center" data-testid="text-core-features-title">
            Core Features
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto">
            Essential tools for professional surveying and measurement
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {coreFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-all"
              data-testid={`card-core-feature-${index}`}
            >
              <div className="text-blue-500 mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2" data-testid={`text-core-feature-title-${index}`}>
                {feature.title}
              </h3>
              <p className="text-gray-400 mb-4" data-testid={`text-core-feature-description-${index}`}>
                {feature.description}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {feature.highlights.map((highlight, hIndex) => (
                  <div key={hIndex} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-300">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Advanced Features */}
      <section className="container mx-auto px-6 py-12 bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
        <div className="mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <h2 className="text-3xl font-bold text-white text-center" data-testid="text-advanced-features-title">
              Advanced & Premium Features
            </h2>
          </div>
          <p className="text-gray-400 text-center max-w-2xl mx-auto">
            AI-powered and premium capabilities for advanced surveying needs
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {advancedFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-purple-700/50 rounded-lg p-6 hover:border-purple-500 transition-all"
              data-testid={`card-advanced-feature-${index}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>{feature.icon}</div>
                {feature.badge && (
                  <span className={`border px-3 py-1 rounded-full text-xs font-bold ${feature.badgeColor || 'bg-purple-900/50 border-purple-500 text-purple-300'}`}>
                    {feature.badge}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2" data-testid={`text-advanced-feature-title-${index}`}>
                {feature.title}
              </h3>
              <p className="text-gray-400 mb-4" data-testid={`text-advanced-feature-description-${index}`}>
                {feature.description}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {feature.highlights.map((highlight, hIndex) => (
                  <div key={hIndex} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    <span className="text-gray-300">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Operational Features */}
      <section className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3 text-center" data-testid="text-operational-features-title">
            Operational Features
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto">
            Field-ready capabilities for real-world surveying operations
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {operationalFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-green-500 transition-all"
              data-testid={`card-operational-feature-${index}`}
            >
              <div className="text-green-500 mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2" data-testid={`text-operational-feature-title-${index}`}>
                {feature.title}
              </h3>
              <p className="text-gray-400 mb-4 text-sm" data-testid={`text-operational-feature-description-${index}`}>
                {feature.description}
              </p>
              <div className="space-y-1">
                {feature.highlights.map((highlight, hIndex) => (
                  <div key={hIndex} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-gray-300">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Voice Command System */}
      <section className="container mx-auto px-6 py-16 bg-gradient-to-b from-gray-900 via-emerald-900/20 to-gray-900">
        <div className="mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Mic className="w-10 h-10 text-emerald-400" />
            <h2 className="text-4xl font-bold text-white text-center" data-testid="text-voice-command-title">
              Voice Command System
            </h2>
          </div>
          <p className="text-xl text-gray-300 text-center max-w-3xl mx-auto mb-8" data-testid="text-voice-command-subtitle">
            Hands-free control of all application functions with natural language voice commands. Work safer and faster with multilingual voice assistance.
          </p>
        </div>

        {/* Language Support */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-gray-800 border border-emerald-700/50 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-8 h-8 text-emerald-400" />
              <h3 className="text-2xl font-bold text-white" data-testid="text-voice-languages-title">
                Multilingual Support
              </h3>
            </div>
            <p className="text-gray-400 mb-6">
              Voice commands work in multiple languages for international field teams. Simply select your preferred language in settings.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center hover:border-emerald-500 transition-colors" data-testid="card-language-english">
                <div className="text-4xl mb-2">🇬🇧</div>
                <h4 className="text-lg font-semibold text-white mb-1">English</h4>
                <p className="text-sm text-gray-400">Full command support</p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center hover:border-emerald-500 transition-colors" data-testid="card-language-french">
                <div className="text-4xl mb-2">🇫🇷</div>
                <h4 className="text-lg font-semibold text-white mb-1">Français</h4>
                <p className="text-sm text-gray-400">Support complet des commandes</p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center hover:border-emerald-500 transition-colors" data-testid="card-language-spanish">
                <div className="text-4xl mb-2">🇪🇸</div>
                <h4 className="text-lg font-semibold text-white mb-1">Español</h4>
                <p className="text-sm text-gray-400">Soporte completo de comandos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Command Categories */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-white mb-6 text-center" data-testid="text-command-categories-title">
            Voice Command Categories
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {/* Information Queries */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-info">
              <div className="flex items-center gap-3 mb-4">
                <Info className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">Information Queries</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Get real-time system information and status updates</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"last measurement"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"GPS location"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"laser status"</div>
              </div>
            </div>

            {/* Camera Operations */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-camera">
              <div className="flex items-center gap-3 mb-4">
                <Camera className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">Camera Operations</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Control camera capture and image management</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"capture image"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"clear images"</div>
              </div>
            </div>

            {/* Logging Control */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-logging">
              <div className="flex items-center gap-3 mb-4">
                <PlayCircle className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">Logging Control</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Start, stop, and pause data logging</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"start logging"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"stop logging"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"pause logging"</div>
              </div>
            </div>

            {/* Mode Switching */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-modes">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">Mode Switching</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Switch between measurement modes</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"manual mode"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"detection mode"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"all data mode"</div>
              </div>
            </div>

            {/* Video Recording */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-video">
              <div className="flex items-center gap-3 mb-4">
                <Video className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">Video Recording</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Control video recording with voice</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"toggle video"</div>
              </div>
            </div>

            {/* AI Detection */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-ai">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">AI Detection</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Interact with AI object detection</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"accept detection"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"reject detection"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"test detection"</div>
              </div>
            </div>

            {/* Envelope Clearance */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-envelope">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">Envelope Clearance</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Control clearance monitoring features</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"toggle envelope"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"cycle vehicle profile"</div>
              </div>
            </div>

            {/* POI Selection */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-poi">
              <div className="flex items-center gap-3 mb-4">
                <MapPinned className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">POI Selection</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Select points of interest by voice</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"bridge"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"trees"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"wire"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"power line"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"traffic light"</div>
              </div>
            </div>

            {/* Audio Control */}
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-6 hover:border-emerald-500 transition-all" data-testid="card-command-category-audio">
              <div className="flex items-center gap-3 mb-4">
                <Volume2 className="w-6 h-6 text-emerald-400" />
                <h4 className="text-lg font-semibold text-white">Audio Control</h4>
              </div>
              <p className="text-gray-400 text-sm mb-4">Adjust volume and record voice notes</p>
              <div className="space-y-2">
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"volume up"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"volume down"</div>
                <div className="bg-gray-900 rounded px-3 py-2 text-sm text-emerald-300 font-mono">"record note"</div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Benefits */}
        <div className="mb-12 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <Lightbulb className="w-8 h-8 text-emerald-400" />
            <h3 className="text-2xl font-bold text-white" data-testid="text-voice-benefits-title">
              Key Benefits
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-5 flex items-start gap-4" data-testid="card-benefit-handsfree">
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-semibold mb-1">Complete Hands-Free Operation</h4>
                <p className="text-gray-400 text-sm">Keep your hands on equipment and controls while accessing all application functions through voice commands.</p>
              </div>
            </div>
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-5 flex items-start gap-4" data-testid="card-benefit-safety">
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-semibold mb-1">Safer Field Operations</h4>
                <p className="text-gray-400 text-sm">Reduce distraction and maintain focus on surroundings while operating equipment in challenging environments.</p>
              </div>
            </div>
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-5 flex items-start gap-4" data-testid="card-benefit-workflow">
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-semibold mb-1">Faster Workflow</h4>
                <p className="text-gray-400 text-sm">Execute commands instantly with natural language instead of navigating menus and buttons.</p>
              </div>
            </div>
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-5 flex items-start gap-4" data-testid="card-benefit-multilingual">
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-semibold mb-1">International Team Support</h4>
                <p className="text-gray-400 text-sm">Multilingual support enables teams working in different regions to use voice commands in their native language.</p>
              </div>
            </div>
            <div className="bg-gray-800 border border-emerald-700/50 rounded-lg p-5 flex items-start gap-4" data-testid="card-benefit-shortcuts">
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-semibold mb-1">Works Alongside Shortcuts</h4>
                <p className="text-gray-400 text-sm">Voice commands complement keyboard shortcuts, giving you multiple ways to control the application efficiently.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-gray-800 border-2 border-emerald-700/50 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Code className="w-8 h-8 text-emerald-400" />
              <h3 className="text-2xl font-bold text-white" data-testid="text-voice-technical-title">
                Technical Details
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Web Speech API Integration</h4>
                    <p className="text-gray-400 text-sm">Built on modern browser APIs for reliable speech recognition and synthesis across devices.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Fuzzy Matching Algorithm</h4>
                    <p className="text-gray-400 text-sm">Natural language processing understands commands even with variations, accents, or partial matches.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Voice Synthesis Responses</h4>
                    <p className="text-gray-400 text-sm">Audible confirmation and feedback for commands with customizable voice settings.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Voice Notes (Offline-Capable)</h4>
                    <p className="text-gray-400 text-sm">Record voice notes offline for field documentation. Voice commands require internet connection for recognition.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-amber-300 font-semibold mb-1">Internet Connection Required</h4>
                  <p className="text-amber-200/80 text-sm">Voice command recognition requires an active internet connection as it uses browser-based speech recognition services. Voice notes can be recorded offline.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Device & Collaboration */}
      <section className="container mx-auto px-6 py-12 bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3 text-center" data-testid="text-multidevice-features-title">
            Multi-Device & Collaboration
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto">
            Team collaboration and remote monitoring capabilities
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {multiDeviceFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-all"
              data-testid={`card-multidevice-feature-${index}`}
            >
              <div className="text-blue-500 mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2" data-testid={`text-multidevice-feature-title-${index}`}>
                {feature.title}
              </h3>
              <p className="text-gray-400 mb-4 text-sm" data-testid={`text-multidevice-feature-description-${index}`}>
                {feature.description}
              </p>
              <div className="space-y-1">
                {feature.highlights.map((highlight, hIndex) => (
                  <div key={hIndex} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-blue-500" />
                    <span className="text-gray-300">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technical Features */}
      <section className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3 text-center" data-testid="text-technical-features-title">
            Technical Capabilities
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto">
            Advanced technical features for specialized surveying needs
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {technicalFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-amber-500 transition-all"
              data-testid={`card-technical-feature-${index}`}
            >
              <div className="text-amber-500 mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2" data-testid={`text-technical-feature-title-${index}`}>
                {feature.title}
              </h3>
              <p className="text-gray-400 mb-4 text-sm" data-testid={`text-technical-feature-description-${index}`}>
                {feature.description}
              </p>
              <div className="space-y-1">
                {feature.highlights.map((highlight, hIndex) => (
                  <div key={hIndex} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-amber-500" />
                    <span className="text-gray-300">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Field Hardware & Sensors Section */}
      <section className="container mx-auto px-6 py-12 bg-gradient-to-b from-gray-900 via-cyan-900/10 to-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3" data-testid="text-hardware-sensors-title">
              Field Hardware & Sensors
            </h2>
            <p className="text-gray-400">Multi-laser, RTK-GNSS, and multi-camera support built for real field conditions</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 border border-cyan-800/40 rounded-xl p-6" data-testid="card-hardware-multilaser">
              <Ruler className="w-9 h-9 text-cyan-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Multi-Laser System</h3>
              <p className="text-gray-400 text-sm mb-3">Up to 4 independent laser ports simultaneously — vertical clearance, left lateral, right lateral, and rear overhang. Rear overhang monitoring up to 80 m for wind blade and long-load transport.</p>
              <div className="space-y-1">
                {['[ Left lateral · ] Right lateral', '\\ Total lane width · \' Rear overhang', 'Vehicle offset subtracted automatically', 'Warning + critical threshold alerts', 'Each laser linked to its position camera'].map(h => (
                  <div key={h} className="flex items-center gap-2 text-xs text-gray-300">
                    <CheckCircle className="w-3 h-3 text-cyan-400 shrink-0" />{h}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 border border-green-800/40 rounded-xl p-6" data-testid="card-hardware-gnss">
              <MapPin className="w-9 h-9 text-green-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">RTK-GNSS Priority System</h3>
              <p className="text-gray-400 text-sm mb-3">Intelligent GPS source selection. Swift Navigation Duro provides centimetre-level RTK-GNSS accuracy with full IMU (roll, pitch, yaw). Falls back to USB GPS automatically if Duro signal is lost.</p>
              <div className="space-y-1">
                {['Duro RTK-GNSS → USB GPS → Bluetooth → Browser', 'IMU roll = real-time cross-slope (banking)', 'Centimetre-level positioning accuracy', 'Auto-failover within 5 seconds', 'Full NMEA 0183 parsing pipeline'].map(h => (
                  <div key={h} className="flex items-center gap-2 text-xs text-gray-300">
                    <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />{h}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 border border-purple-800/40 rounded-xl p-6" data-testid="card-hardware-camera">
              <Camera className="w-9 h-9 text-purple-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Multi-Camera Positions</h3>
              <p className="text-gray-400 text-sm mb-3">Assign independent cameras to front, left, right, and rear positions. Lateral and rear POI captures automatically use the matching position camera, with intelligent fallback logic.</p>
              <div className="space-y-1">
                {['Front / left / right / rear position cameras', 'Lateral POI → position camera auto-select', 'ZED 2i stereo (depth + AI + point cloud)', '10-second rolling buffer for auto-capture', 'EXIF GPS metadata on every photo'].map(h => (
                  <div key={h} className="flex items-center gap-2 text-xs text-gray-300">
                    <CheckCircle className="w-3 h-3 text-purple-400 shrink-0" />{h}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Road Profile & Heavy Haul Safety Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3" data-testid="text-road-profile-title">
              Road Profile & Heavy Haul Safety
            </h2>
            <p className="text-gray-400">GNSS-based road profiling with real-time safety analytics for OS/OW routes</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 border border-amber-800/40 rounded-xl p-6" data-testid="card-road-profile">
              <TrendingUp className="w-9 h-9 text-amber-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">GNSS Road Profiling</h3>
              <p className="text-gray-400 text-sm mb-3">Record a continuous GPS-based road profile while driving. Calculates chainage, altitude, longitudinal grade (%), and K-factor (rate of grade change) at every point. Persists through page navigation via background service.</p>
              <div className="grid grid-cols-2 gap-1">
                {['Chainage (cumulative distance)', 'Longitudinal grade (%)', 'K-factor (crest & sag)', 'Altitude raw / corrected', '30s IndexedDB auto-flush', 'Alert segment detection'].map(h => (
                  <div key={h} className="flex items-center gap-2 text-xs text-gray-300">
                    <CheckCircle className="w-3 h-3 text-amber-400 shrink-0" />{h}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 border border-orange-800/40 rounded-xl p-6" data-testid="card-banking">
              <Gauge className="w-9 h-9 text-orange-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Banking & Cross-Slope Detection</h3>
              <p className="text-gray-400 text-sm mb-3">Real-time road banking angle from Swift Duro IMU roll data. Three filtering modes: raw signal, low-pass filtered (smooth), and stopped-only. Alerts graded from Normal to Unacceptable with configurable thresholds.</p>
              <div className="grid grid-cols-2 gap-1">
                {['0–3° Normal · 3–5° Caution', '5–7° Warning · 7–10° Critical', '>10° Unacceptable alert', 'Raw / filtered / stopped modes', 'Curve radius (3-point circumradius)', 'Exported with survey data'].map(h => (
                  <div key={h} className="flex items-center gap-2 text-xs text-gray-300">
                    <CheckCircle className="w-3 h-3 text-orange-400 shrink-0" />{h}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RoadScope Integration callout */}
          <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-blue-600/50 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6" data-testid="card-roadscope">
            <div className="shrink-0">
              <Globe className="w-14 h-14 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">RoadScope Integration</h3>
              <p className="text-gray-300 text-sm mb-3">MeasurePRO survey data exports directly to <a href="https://roadscope.app" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">RoadScope</a> — SolTec Innovation's OS/OW corridor analysis platform. Import surveyed POIs, road profile, and clearance data for full route planning, permit documentation, and GIS corridor mapping.</p>
              <div className="flex flex-wrap gap-2">
                {['Direct export to RoadScope', 'GIS corridor mapping', 'OS/OW permit documentation', 'Shared clearance database'].map(t => (
                  <span key={t} className="bg-blue-900/50 text-blue-300 text-xs px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-2 border-blue-500 rounded-xl p-12 text-center max-w-4xl mx-auto" data-testid="section-cta">
          <h2 className="text-4xl font-bold text-white mb-4" data-testid="text-cta-title">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-300 mb-8" data-testid="text-cta-subtitle">
            Join professional survey teams using MeasurePRO for accurate, reliable field measurements
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
              data-testid="button-cta-signup"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
              data-testid="button-cta-pricing"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-product">Product</h3>
              <div className="space-y-2">
                <Link to="/features" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-features">
                  Features
                </Link>
                <Link to="/pricing" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-pricing">
                  Pricing
                </Link>
                <Link to="/help" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-help">
                  Documentation
                </Link>
                <Link to="/changelog" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-changelog">
                  Changelog
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-company">Company</h3>
              <div className="space-y-2">
                <a href="https://soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-company">
                  SolTec Innovation
                </a>
                <a href="https://soltec.ca" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-soltec">
                  soltec.ca
                </a>
                <Link to="/contact" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-contact">
                  Contact Us
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-legal">Legal</h3>
              <div className="space-y-2">
                <Link to="/terms" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-terms">
                  Terms & Conditions
                </Link>
                <Link to="/privacy" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-privacy">
                  Privacy Policy
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4" data-testid="text-footer-support">Support</h3>
              <div className="space-y-2">
                <Link to="/help" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-documentation">
                  Documentation
                </Link>
                <a href="mailto:info@soltecinnovation.com" className="block text-gray-400 hover:text-white transition-colors" data-testid="link-footer-email">
                  Email Support
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p data-testid="text-footer-copyright">
              © {new Date().getFullYear()} MeasurePRO by SolTec Innovation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
