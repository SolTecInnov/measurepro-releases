import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, CloudRain, Droplets, Snowflake, Thermometer, CheckCircle, AlertTriangle, BookOpen, Map, FileCheck, Mic } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  featured: boolean;
}

const blogPosts: BlogPost[] = [
  {
    id: 'bridge-clearance-survey',
    title: 'How to Survey Bridge Clearances for Oversize Loads with LiDAR and MeasurePRO',
    excerpt: 'A step-by-step workflow for measuring bridge clearances from the cab using the SolTec LiDAR system and RTK-GNSS, and producing permit-ready data for engineering and permitting teams.',
    author: 'MeasurePRO Technical Team',
    date: 'March 2026',
    readTime: '10 min read',
    category: 'Field Guide',
    featured: true
  },
  {
    id: 'field-survey-to-permit',
    title: 'From Field Survey to OS/OW Permit: The MeasurePRO + RoadScope Workflow',
    excerpt: 'How MeasurePRO and RoadScope work together to take you from LiDAR-based field surveys to corridor-wide clearance analysis and permit-ready documentation — without the guesswork.',
    author: 'MeasurePRO Technical Team',
    date: 'March 2026',
    readTime: '11 min read',
    category: 'Workflow Guide',
    featured: false
  },
  {
    id: 'voice-commands-hands-free',
    title: 'Truly Hands-Free Surveys: How Voice Commands Make MeasurePRO Safer for Oversized Convoys',
    excerpt: 'During a road survey, the driver is already managing traffic, weather, and radio. Voice commands in MeasurePRO let you capture measurements, POIs, and notes without touching the screen.',
    author: 'MeasurePRO Technical Team',
    date: 'March 2026',
    readTime: '8 min read',
    category: 'Safety & Operations',
    featured: false
  },
  {
    id: 'weather-lidar-performance',
    title: 'How Weather Really Affects LiDAR Performance: A Complete Guide for Field Professionals',
    excerpt: 'Understanding the impact of rain, fog, snow, and temperature on LiDAR measurements is essential for accurate field surveys. Learn how to optimize your operations in challenging conditions.',
    author: 'MeasurePRO Technical Team',
    date: 'January 2026',
    readTime: '12 min read',
    category: 'Technical Guide',
    featured: false
  }
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
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
                className="text-gray-300 hover:text-white transition-colors"
                data-testid="link-features"
              >
                Features
              </Link>
              <Link
                to="/help"
                className="text-gray-300 hover:text-white transition-colors"
                data-testid="link-help"
              >
                Help
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

      <section className="container mx-auto px-6 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <BookOpen className="w-16 h-16 text-blue-500 mx-auto mb-6" />
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-page-title">
            MeasurePRO Blog
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed" data-testid="text-page-subtitle">
            Technical insights, best practices, and industry knowledge for surveying professionals
          </p>
        </div>
      </section>

      <section className="container mx-auto px-6 py-8 max-w-4xl">
        {blogPosts.map((post) => (
          <article key={post.id} className="mb-12" data-testid={`article-${post.id}`}>
            {post.featured && (
              <span className="inline-block bg-blue-600 text-white text-xs px-3 py-1 rounded-full mb-4">
                Featured Article
              </span>
            )}
            <h2 className="text-3xl font-bold text-white mb-4">{post.title}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {post.author}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {post.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.readTime}
              </span>
            </div>
            <p className="text-gray-300 mb-8">{post.excerpt}</p>
          </article>
        ))}
      </section>

      <article className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="prose prose-invert prose-lg max-w-none">
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700 rounded-xl p-8 mb-12">
            <div className="flex items-center gap-3 mb-4">
              <CloudRain className="w-8 h-8 text-blue-400" />
              <h2 className="text-2xl font-bold text-white m-0">Understanding LiDAR Technology</h2>
            </div>
            <p className="text-gray-300 m-0">
              LiDAR (Light Detection and Ranging) is a remote sensing technology that uses laser pulses to measure 
              distances with remarkable precision. The fundamental principle is straightforward: the system calculates 
              distance based on time-of-flight measurement using the formula <strong className="text-blue-400">Distance = (Speed of Light × Time of Flight) ÷ 2</strong>.
            </p>
            <p className="text-gray-300 mt-4 mb-0">
              Modern LiDAR systems perform this calculation millions of times per second, creating dense "point clouds" 
              that capture intricate environmental details with centimeter-level accuracy. This makes LiDAR invaluable 
              for surveying, infrastructure assessment, and autonomous vehicle navigation.
            </p>
          </div>

          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Droplets className="w-8 h-8 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">How Rain Impacts LiDAR Sensing</h2>
            </div>
            
            <p className="text-gray-300 mb-6">
              Rain affects LiDAR performance through multiple physical mechanisms. Understanding these effects 
              helps field professionals make informed decisions about when to conduct surveys and how to 
              interpret data collected in wet conditions.
            </p>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">The Physics of Rain Interference</h3>
              <p className="text-gray-300 mb-4">
                Airborne raindrops directly block laser beams, causing them to scatter, refract, or reflect 
                prematurely. This prevents straight beams from reaching their intended targets and reduces 
                signal strength through light energy absorption.
              </p>
              <p className="text-gray-300 mb-0">
                Raindrops that accumulate on sensor surfaces create additional challenges. These water droplets 
                act like tiny lenses that dramatically change optical paths and distort the resulting point cloud. 
                Research shows that even small droplets on sensor surfaces can completely block signals in affected areas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-2">Light Rain (10-20mm/h)</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>15-20% range reduction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Moderate point cloud degradation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Operations viable with caution</span>
                  </li>
                </ul>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-400 mb-2">Heavy Rain (25-40mm/h)</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>30% range reduction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>45% point cloud density drop</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Range errors up to 20cm</span>
                  </li>
                </ul>
              </div>
              <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
                <h4 className="font-semibold text-red-400 mb-2">Extreme Rain (40mm/h+)</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Detection may fail completely</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Traffic signs undetectable</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Suspend critical operations</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6">
              <h4 className="font-semibold text-blue-400 mb-2">Signal Processing Challenges</h4>
              <p className="text-gray-300 text-sm">
                Rain creates two main signal processing issues: <strong>false positives</strong> and <strong>false negatives</strong>. 
                Raindrops often trick the system into detecting objects that aren't there at short ranges (up to 50m). 
                This effect becomes less common at medium ranges (50-100m), but the system gets worse at detecting 
                actual objects as rainfall increases.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <CloudRain className="w-8 h-8 text-cyan-400" />
              <h2 className="text-3xl font-bold text-white">LiDAR Performance in Fog</h2>
            </div>

            <div className="bg-cyan-900/20 border border-cyan-800/30 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-cyan-400 mb-4">Surprising Advantage Over Cameras</h3>
              <p className="text-gray-300 mb-4">
                Research shows that LiDAR can actually "see" better and further in fog than cameras or human eyes. 
                This unexpected advantage comes from how light interacts with fog particles.
              </p>
              <p className="text-gray-300 mb-0">
                LiDAR's focused laser energy has approximately <strong className="text-cyan-400">7× more optical power density</strong> than 
                visible light at 100 meters. This allows LiDAR to push through moderate fog more effectively. 
                While camera visibility drops to about 50% of normal range in fog, LiDAR can still detect objects 
                at 50+ meters when cameras fail completely.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-3">Why LiDAR Works Better</h4>
                <p className="text-gray-300 text-sm mb-3">
                  Fog mainly causes <em>diffusion</em>—light scattered by tiny water molecules. This affects 
                  visible light cameras more than focused laser pulses.
                </p>
                <p className="text-gray-300 text-sm mb-0">
                  Rain, by contrast, causes <em>dispersion</em>—a more severe scattering effect that impacts 
                  both cameras and LiDAR significantly.
                </p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-3">Dense Fog Limitations</h4>
                <p className="text-gray-300 text-sm mb-3">
                  While LiDAR handles moderate fog well, dense fog (visibility ≤50m) causes approximately 
                  50% range reduction and may cause localization algorithms to fail.
                </p>
                <p className="text-gray-300 text-sm mb-0">
                  SLAM (Simultaneous Localization and Mapping) can fail in thick outdoor fog due to 
                  insufficient feature points for reliable positioning.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Snowflake className="w-8 h-8 text-blue-300" />
              <h2 className="text-3xl font-bold text-white">Snow: Unique Challenges for Laser Detection</h2>
            </div>

            <p className="text-gray-300 mb-6">
              Snow creates bigger obstacles for LiDAR than fog because snow particles are significantly larger 
              than fog's tiny water droplets. This size difference causes snowflakes to bounce back laser beams 
              more aggressively, creating unique detection challenges.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-3">Detection Complexity</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• Snowflakes create <strong>false returns</strong> at different ranges from actual targets</li>
                  <li>• Beam blockage and reflection cause "weather occlusion"</li>
                  <li>• Standard density-based clustering algorithms show many false detections</li>
                  <li>• Snow creates distinct patterns: high density, low intensity, close range, fast decay</li>
                </ul>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-3">Ice Accumulation Issues</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• Ice on sensor housings changes natural reflective properties</li>
                  <li>• Weakens returned laser signals significantly</li>
                  <li>• Reduces point cloud density and intensity</li>
                  <li>• Different materials degrade at various rates</li>
                  <li>• Requires frequent sensor cleaning during testing</li>
                </ul>
              </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-6">
              <h4 className="font-semibold text-amber-400 mb-2">Field Note</h4>
              <p className="text-gray-300 text-sm mb-0">
                "Rapid ice buildup has often resulted in short segments of data collection followed by manual cleanup" 
                according to field testing reports. Teams operating in cold conditions should plan for regular 
                sensor maintenance intervals.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Thermometer className="w-8 h-8 text-orange-400" />
              <h2 className="text-3xl font-bold text-white">Temperature and Humidity Effects</h2>
            </div>

            <p className="text-gray-300 mb-6">
              Temperature changes and humidity levels create unique challenges for LiDAR systems that need 
              careful engineering solutions. These environmental factors change how sensor components work 
              at the molecular level.
            </p>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
              <h4 className="font-semibold text-white mb-4">Thermal Effects on Performance</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-orange-400 font-medium mb-2">Cold Weather (&lt;-10°C)</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Up to <strong>50% reduction</strong> in sensing range</li>
                    <li>• Laser echo count can drop by half</li>
                    <li>• Pattern recognition becomes unreliable</li>
                    <li>• Semiconductor sensors affected at molecular level</li>
                  </ul>
                </div>
                <div>
                  <h5 className="text-red-400 font-medium mb-2">High Temperatures</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Increased dark current in APD sensors</li>
                    <li>• Electrons have shorter mean free paths</li>
                    <li>• Higher operating voltages needed</li>
                    <li>• Thermal expansion affects optical alignment</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h4 className="font-semibold text-white mb-4">Condensation Challenges</h4>
              <p className="text-gray-300 text-sm mb-4">
                Humidity creates problems through condensation on sensor windows, directly affecting light 
                transmission and detection. Water vapor from sources like vehicle exhaust in cold weather 
                can create false readings and "ghost objects."
              </p>
              <p className="text-gray-300 text-sm mb-0">
                Modern solutions include thermoelectric coolers for temperature stabilization and specialized 
                coatings for sensor windows. These prevent wavelength drift and maintain measurement accuracy.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Current Solutions and Best Practices</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-4">Advanced Signal Processing</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• <strong>Kalman filters</strong> with neighboring point cloud denoising</li>
                  <li>• Statistical and radius filtering to remove noise</li>
                  <li>• Deep neural networks achieve 96.86% weather classification accuracy</li>
                  <li>• Adaptive detection thresholds based on conditions</li>
                </ul>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-4">Hardware Improvements</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• Polycarbonate covers with UV and hard coatings</li>
                  <li>• O-ring seals and NPT cable glands for water protection</li>
                  <li>• Thin-film heaters for cover lenses</li>
                  <li>• High transmittance with minimal scattering</li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-4">MeasurePRO Weather Solutions</h3>
              <p className="text-gray-300 mb-4">
                MeasurePRO includes intelligent noise filtering and signal processing algorithms designed 
                to maintain measurement accuracy in challenging conditions:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ul className="text-gray-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Adaptive Noise Filtering:</strong> Automatically filters rain, snow, and dust particles</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Signal Quality Indicators:</strong> Real-time feedback on measurement confidence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Multi-sample Averaging:</strong> Reduces random errors from atmospheric interference</span>
                  </li>
                </ul>
                <ul className="text-gray-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Height Thresholds:</strong> Configurable ignoreAbove/ignoreBelow settings filter outliers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Weather Logging:</strong> Document conditions for measurement context</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Offline Operation:</strong> Reliable performance in remote field conditions</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Quick Reference: Weather Impact Summary</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-300 border border-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-white">Weather Condition</th>
                    <th className="px-4 py-3 text-left font-semibold text-white">Range Impact</th>
                    <th className="px-4 py-3 text-left font-semibold text-white">Point Cloud</th>
                    <th className="px-4 py-3 text-left font-semibold text-white">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr className="bg-gray-900/50">
                    <td className="px-4 py-3">Light rain (10-20mm/h)</td>
                    <td className="px-4 py-3">15-20% reduction</td>
                    <td className="px-4 py-3">Moderate drop</td>
                    <td className="px-4 py-3 text-green-400">Proceed with caution</td>
                  </tr>
                  <tr className="bg-gray-800/50">
                    <td className="px-4 py-3">Heavy rain (25mm/h)</td>
                    <td className="px-4 py-3">30% reduction</td>
                    <td className="px-4 py-3">45% drop</td>
                    <td className="px-4 py-3 text-yellow-400">Consider postponing</td>
                  </tr>
                  <tr className="bg-gray-900/50">
                    <td className="px-4 py-3">Extreme rain (40mm/h+)</td>
                    <td className="px-4 py-3">Severe</td>
                    <td className="px-4 py-3">Critical</td>
                    <td className="px-4 py-3 text-red-400">Suspend operations</td>
                  </tr>
                  <tr className="bg-gray-800/50">
                    <td className="px-4 py-3">Moderate fog</td>
                    <td className="px-4 py-3">~50% reduction</td>
                    <td className="px-4 py-3">High noise</td>
                    <td className="px-4 py-3 text-yellow-400">LiDAR outperforms cameras</td>
                  </tr>
                  <tr className="bg-gray-900/50">
                    <td className="px-4 py-3">Dense fog (≤50m vis)</td>
                    <td className="px-4 py-3">50%+ reduction</td>
                    <td className="px-4 py-3">Critical</td>
                    <td className="px-4 py-3 text-red-400">SLAM may fail</td>
                  </tr>
                  <tr className="bg-gray-800/50">
                    <td className="px-4 py-3">Heavy snow</td>
                    <td className="px-4 py-3">Variable</td>
                    <td className="px-4 py-3">False returns</td>
                    <td className="px-4 py-3 text-yellow-400">Use specialized filtering</td>
                  </tr>
                  <tr className="bg-gray-900/50">
                    <td className="px-4 py-3">Cold (&lt;-10°C)</td>
                    <td className="px-4 py-3">Up to 50%</td>
                    <td className="px-4 py-3">Component issues</td>
                    <td className="px-4 py-3 text-yellow-400">Allow warm-up time</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Conclusion</h2>
            <p className="text-gray-300 mb-4">
              Understanding how weather affects LiDAR performance is essential for field professionals who 
              rely on accurate measurements. While weather presents real challenges, modern signal processing 
              and hardware solutions—including those built into MeasurePRO—help maintain data quality even 
              in adverse conditions.
            </p>
            <p className="text-gray-300 mb-0">
              The key is to understand the limitations, plan operations accordingly, and leverage the 
              technology's unique advantages. LiDAR's ability to outperform cameras in fog, combined with 
              intelligent noise filtering for rain and snow, makes it an invaluable tool for professional 
              surveying in real-world conditions.
            </p>
          </section>
        </div>

        <div className="border-t border-gray-700 pt-8 mt-8">
          <p className="text-sm text-gray-400 mb-4">
            <strong>Sources:</strong> YellowScan Knowledge Center, SAE Intelligent and Connected Vehicles Symposium (2022), 
            MDPI Sensors Journal, PMC research publications on automotive LiDAR performance.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/features"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              data-testid="button-explore-features"
            >
              Explore MeasurePRO Features
            </Link>
            <Link
              to="/help"
              className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              data-testid="button-help-docs"
            >
              View Help Documentation
            </Link>
          </div>
        </div>
      </article>

      {/* ── Article 2: Bridge Clearance Survey ─────────────────────────────── */}
      <article className="container mx-auto px-6 py-8 max-w-4xl border-t border-gray-800 mt-8" id="bridge-clearance-survey" data-testid="article-bridge-clearance-survey">
        <div className="prose prose-invert prose-lg max-w-none">

          <div className="bg-gradient-to-r from-blue-900/30 to-green-900/30 border border-blue-700 rounded-xl p-8 mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Map className="w-8 h-8 text-blue-400" />
              <h2 className="text-2xl font-bold text-white m-0">How to Survey Bridge Clearances for Oversize Loads with LiDAR and MeasurePRO</h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
              <span className="flex items-center gap-1"><User className="w-4 h-4" />MeasurePRO Technical Team</span>
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />March 2026</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />10 min read</span>
              <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs">Field Guide</span>
            </div>
            <p className="text-gray-300 m-0">
              Moving oversize and overweight loads safely comes down to one question: will the load clear every structure on the route? Traditional "eye test" methods, old drawings, or rough GPS notes are no longer enough when fines, delays, and safety are on the line. MeasurePRO, paired with the SolTec LiDAR 2D laser system and RTK-GNSS, gives you a repeatable workflow for measuring bridge clearances from the cab and producing permit-ready data for engineering and permitting teams.
            </p>
          </div>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">1. Hardware setup on the survey vehicle</h3>
            <p className="text-gray-300 mb-4">Before heading out, the survey vehicle is prepared as a rolling measurement platform:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-4">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>A LiDAR 2D laser rangefinder is mounted on the cab to measure vertical distances to overhead structures.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>A rugged Windows tablet runs MeasurePRO and connects to the LiDAR and professional GPS module.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>The GPS/RTK system provides high-accuracy coordinates for every measurement along the route.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Power and mounting hardware are installed so the equipment survives real-world conditions — vibration, weather, and long shifts.</span></li>
              </ul>
            </div>
            <p className="text-gray-300">Once configured, this setup allows a surveyor or pilot car driver to measure clearances while driving the candidate OS/OW route.</p>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">2. Configuring MeasurePRO for a clearance survey</h3>
            <p className="text-gray-300 mb-4">In MeasurePRO, the surveyor creates a new project specifically for bridge and overhead clearance measurements:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Define the survey name, route description, and vehicle or envelope profile that matches the planned load.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Confirm LiDAR and GPS connections, and verify fix quality and satellite count before leaving the yard.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Set up logging preferences (e.g., continuous logging with voice-triggered POIs) and check that offline mode is ready if the route crosses poor coverage zones.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">3. Driving and measuring bridge clearances</h3>
            <p className="text-gray-300 mb-4">During the run, the surveyor focuses on safe driving while MeasurePRO handles data capture:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-5">
                <h4 className="font-semibold text-blue-300 mb-3">What MeasurePRO captures</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• LiDAR distance to lowest point of the overhead structure</li>
                  <li>• Combined clearance value (laser + vehicle geometry)</li>
                  <li>• RTK-GNSS coordinates tagged to each measurement</li>
                  <li>• Operator notes, photos, and video at each POI</li>
                </ul>
              </div>
              <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-5">
                <h4 className="font-semibold text-green-300 mb-3">Designed for hands-free operation</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• Voice commands mark POIs without touching the tablet</li>
                  <li>• Driver keeps both hands on the wheel throughout</li>
                  <li>• POI types include bridge, overhead utility, signal, wire, and more</li>
                  <li>• Survey-grade data collected at highway speed</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">4. Adding context with photos, video, and notes</h3>
            <p className="text-gray-300 mb-4">For each critical structure, MeasurePRO lets you attach more than just a number:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Photos and short video clips show the approach, lane alignment, and surrounding constraints.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Voice notes record observations like deck condition, signage, lane shifts, or nearby obstructions.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>POI categories make it easy to filter and review specific hazards when engineers review the data days later.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">5. Exporting permit-ready data</h3>
            <p className="text-gray-300 mb-4">Once the survey is complete, MeasurePRO exports the dataset in standard engineering formats:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <p className="font-semibold text-white mb-1">CSV</p>
                <p className="text-gray-400 text-sm">Tabular reports and spreadsheets</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <p className="font-semibold text-white mb-1">GeoJSON / Shapefile</p>
                <p className="text-gray-400 text-sm">GIS workflows and mapping</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <p className="font-semibold text-white mb-1">LandXML / DXF</p>
                <p className="text-gray-400 text-sm">AutoCAD Civil 3D and design tools</p>
              </div>
            </div>
            <p className="text-gray-300">All exports include coordinates, clearance values, POI types, and timestamps, so engineering teams can generate bridge clearance tables, maps, and structural checklists directly from the field data.</p>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">6. Using RoadScope for corridor-wide clearance analysis</h3>
            <p className="text-gray-300 mb-4">After export, many teams load the survey into RoadScope to see the entire corridor at once:</p>
            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700 rounded-xl p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>All measured clearances appear along the candidate route, color-coded for warning and critical thresholds.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Engineers quickly identify low structures, compare them to planned load height, and decide on feasibility or mitigation.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>The same dataset feeds both internal safety reviews and external OS/OW permit applications.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">7. Best practices for reliable clearance surveys</h3>
            <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" /><span>Use RTK-level positioning whenever possible for maximum accuracy.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" /><span>Drive at a consistent speed where conditions allow, and avoid abrupt lane changes under structures.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" /><span>Capture at least one clear photo or video clip of every critical bridge or overhead feature.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" /><span>Repeat surveys on high-risk routes when major construction or seasonal changes occur.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" /><span>Keep hardware calibration and software updates current before each survey season.</span></li>
              </ul>
            </div>
          </section>

          <div className="border-t border-gray-700 pt-8">
            <div className="flex flex-wrap gap-4">
              <Link to="/features" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors" data-testid="button-features-bridge">Explore MeasurePRO Features</Link>
              <Link to="/contact" className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors" data-testid="button-demo-bridge">Book a Demo</Link>
            </div>
          </div>
        </div>
      </article>

      {/* ── Article 3: MeasurePRO + RoadScope Workflow ──────────────────────── */}
      <article className="container mx-auto px-6 py-8 max-w-4xl border-t border-gray-800 mt-8" id="field-survey-to-permit" data-testid="article-field-survey-to-permit">
        <div className="prose prose-invert prose-lg max-w-none">

          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700 rounded-xl p-8 mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileCheck className="w-8 h-8 text-purple-400" />
              <h2 className="text-2xl font-bold text-white m-0">From Field Survey to OS/OW Permit: The MeasurePRO + RoadScope Workflow</h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
              <span className="flex items-center gap-1"><User className="w-4 h-4" />MeasurePRO Technical Team</span>
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />March 2026</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />11 min read</span>
              <span className="bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded text-xs">Workflow Guide</span>
            </div>
            <p className="text-gray-300 m-0">
              Oversize and overweight permits depend on one critical ingredient: trustworthy field data. Without a repeatable process from survey to analysis, you risk unexpected low structures, denied permits, or last-minute reroutes. MeasurePRO and RoadScope form a complete workflow that takes you from LiDAR-based field surveys to corridor-wide clearance analysis and permit-ready documentation.
            </p>
          </div>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">1. Planning the survey route</h3>
            <p className="text-gray-300 mb-4">Everything starts before the truck leaves the yard:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Identify the candidate permitted route and any known high-risk segments — older bridges, urban corridors, complex interchanges.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Define the planned load envelope (height, width, length) so you know what clearances you need to validate.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>In MeasurePRO, create a new survey project with a name that matches the permit application or move ID.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">2. Configuring MeasurePRO and vehicle profiles</h3>
            <p className="text-gray-300 mb-4">Before driving, MeasurePRO is configured around the vehicle and load:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Select or create a vehicle profile that matches the planned OS/OW configuration — tractor, trailer type, axle counts, overall height.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Confirm LiDAR and GPS/RTK connections and check fix quality and satellite count.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Choose logging behavior: continuous logging plus explicit POIs for bridges, signals, power lines, and other overhead features.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Set warning and critical clearance thresholds based on the load's envelope.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">3. Running the field survey</h3>
            <p className="text-gray-300 mb-4">On the road, MeasurePRO turns the survey vehicle into a rolling sensor suite:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-5">
                <h4 className="font-semibold text-blue-300 mb-3">Continuous data capture</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• LiDAR measurements logged at every point</li>
                  <li>• GPS positions tracked in real time</li>
                  <li>• Speed and time recorded throughout</li>
                </ul>
              </div>
              <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-5">
                <h4 className="font-semibold text-purple-300 mb-3">Structure tagging</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Voice commands trigger POIs hands-free</li>
                  <li>• Each structure tagged with type and clearance</li>
                  <li>• Photos and video provide visual confirmation</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">4. Exporting survey data from MeasurePRO</h3>
            <p className="text-gray-300 mb-4">After the run, the project is exported in standard engineering and GIS formats. Each export includes coordinates, POI types, measured clearances, timestamps, and operator notes — forming a complete field data record for that route.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['CSV', 'GeoJSON', 'Shapefile', 'LandXML / DXF'].map((fmt) => (
                <div key={fmt} className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="font-semibold text-white text-sm">{fmt}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">5. Importing the survey into RoadScope</h3>
            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700 rounded-xl p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Import the MeasurePRO export into RoadScope and associate it with the corresponding route or permit request.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>RoadScope maps all measured points, color-coding them by clearance status (safe, warning, critical).</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Overlay other data layers — known restrictions, previous surveys, and customer constraints.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">6. Clearance analysis and route decisions</h3>
            <p className="text-gray-300 mb-4">With the survey in RoadScope, the engineering and permitting team can:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Identify all structures that fall near or below warning and critical thresholds.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Compare alternate alignments or bypasses using historical surveys where available.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /><span>Document why a route is acceptable, requires mitigation, or should be rejected — backed by field data.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">7. Generating permit-ready outputs</h3>
            <p className="text-gray-300 mb-4">Once the route decision is made, MeasurePRO + RoadScope data feeds the permit package directly:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Bridge and overhead clearance tables that reference measured values and coordinates.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Maps showing measured points, risk zones, and required mitigations.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Photos and video clips for particularly tight locations as visual evidence.</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">8. One corridor, multiple moves</h3>
            <p className="text-gray-300 mb-4">One of the biggest benefits of this workflow is reusability:</p>
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>A corridor surveyed once can be reused for multiple similar loads as long as the envelope stays within known limits.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Additional surveys can be layered over time to reflect construction changes or new restrictions.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>RoadScope keeps surveys organized so planners can quickly answer "Have we run this corridor before with a similar load?"</span></li>
              </ul>
            </div>
          </section>

          <div className="bg-gradient-to-r from-purple-900/30 to-green-900/30 border border-purple-700 rounded-xl p-8 mb-8">
            <h3 className="text-xl font-bold text-white mb-3">Why standardizing this workflow matters</h3>
            <p className="text-gray-300 mb-3">By standardizing on MeasurePRO in the field and RoadScope in the office, you:</p>
            <ul className="text-gray-300 space-y-1">
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Reduce the chance of surprises on move day.</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Shorten the time from "we might take this route" to an evidence-backed yes or no.</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Give regulators and customers a clear record of how clearances were verified.</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span>Build an internal database of safe, proven OS/OW corridors instead of treating each move as a blank slate.</span></li>
            </ul>
          </div>

          <div className="border-t border-gray-700 pt-8">
            <div className="flex flex-wrap gap-4">
              <a href="https://roadscope.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors" data-testid="button-roadscope-permit">Explore RoadScope</a>
              <Link to="/contact" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors" data-testid="button-demo-permit">Book a Demo</Link>
            </div>
          </div>
        </div>
      </article>

      {/* ── Article 4: Voice Commands ────────────────────────────────────────── */}
      <article className="container mx-auto px-6 py-8 max-w-4xl border-t border-gray-800 mt-8" id="voice-commands-hands-free" data-testid="article-voice-commands-hands-free">
        <div className="prose prose-invert prose-lg max-w-none">

          <div className="bg-gradient-to-r from-green-900/30 to-teal-900/30 border border-green-700 rounded-xl p-8 mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Mic className="w-8 h-8 text-green-400" />
              <h2 className="text-2xl font-bold text-white m-0">Truly Hands-Free Surveys: How Voice Commands Make MeasurePRO Safer for Oversized Convoys</h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
              <span className="flex items-center gap-1"><User className="w-4 h-4" />MeasurePRO Technical Team</span>
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />March 2026</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />8 min read</span>
              <span className="bg-green-900/50 text-green-300 px-2 py-0.5 rounded text-xs">Safety &amp; Operations</span>
            </div>
            <p className="text-gray-300 m-0">
              During a road survey, the driver is already managing traffic, surrounding vehicles, weather, and radio communications. Adding a keyboard or touchscreen into that mix is a recipe for distraction. MeasurePRO's voice command system lets you control the entire survey — measurements, logging, POIs — without taking your eyes off the road or your hands off the wheel.
            </p>
          </div>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">1. Why keyboard-only isn't enough</h3>
            <p className="text-gray-300 mb-4">In many teams, road surveys are still done with a mix of paper notes, GPS captures, and photos taken on the fly. Even with a tablet, if the driver has to tap, click, or navigate menus, you increase:</p>
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" /><span>Time spent looking at the screen instead of the road.</span></li>
                <li className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" /><span>The risk of missing an immediate hazard.</span></li>
                <li className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" /><span>Missed POIs or measurements captured at the wrong moment.</span></li>
              </ul>
            </div>
            <p className="text-gray-300 mt-4">A hands-free interface reduces this friction and makes the process safer for the driver, escort vehicles, and the public.</p>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">2. How voice commands work in MeasurePRO</h3>
            <p className="text-gray-300 mb-4">MeasurePRO includes a voice command engine built specifically for OS/OW surveys:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h4 className="font-semibold text-green-300 mb-3">Core capabilities</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• Activation by keyword or microphone button</li>
                  <li>• Dozens of structured commands by category</li>
                  <li>• Visual and audio confirmation after each command</li>
                  <li>• Full offline operation — no network required</li>
                </ul>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h4 className="font-semibold text-green-300 mb-3">Command categories</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• Measurements and logging control</li>
                  <li>• Camera capture and video</li>
                  <li>• POI marking and type selection</li>
                  <li>• AI detection, envelope, GPS status</li>
                </ul>
              </div>
            </div>
            <p className="text-gray-300 mt-4">The goal is not to dictate long phrases, but to have a short, reliable vocabulary the driver can use at any moment without hesitation.</p>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">3. Voice commands in a real survey — examples</h3>
            <p className="text-gray-300 mb-4">Here is what a typical road segment looks like with voice commands active:</p>
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-5">
                <h4 className="font-semibold text-blue-300 mb-2">Approaching a bridge</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong className="text-white">"Start logging"</strong> — begins detailed recording for that segment</li>
                  <li>• <strong className="text-white">"Mark bridge POI"</strong> — tags the structure as it passes under the sensor</li>
                </ul>
              </div>
              <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-5">
                <h4 className="font-semibold text-amber-300 mb-2">Spotting a low wire or branch</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong className="text-white">"Capture image"</strong> — saves a photo with GPS context immediately</li>
                  <li>• <strong className="text-white">"Add voice note"</strong> — records a verbal description of what was observed</li>
                </ul>
              </div>
              <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-5">
                <h4 className="font-semibold text-green-300 mb-2">Checking status</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong className="text-white">"Last measurement"</strong> — reads back the most recent height value aloud</li>
                  <li>• <strong className="text-white">"GPS status"</strong> — confirms fix quality without looking away from the road</li>
                </ul>
              </div>
            </div>
            <p className="text-gray-300 mt-4">All of this is done without touching the tablet — both hands stay on the wheel throughout.</p>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">4. Safety benefits for oversized convoys</h3>
            <p className="text-gray-300 mb-4">The benefit is not just comfort — it is a measurable safety improvement:</p>
            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700 rounded-xl p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span><strong className="text-white">Less distraction:</strong> less time searching for a button or icon on screen.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span><strong className="text-white">Faster reaction:</strong> the driver stays focused on traffic, road conditions, and the guided vehicle.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" /><span><strong className="text-white">More complete data:</strong> more POIs and notes are captured because the action is simple and immediate.</span></li>
              </ul>
            </div>
            <p className="text-gray-300 mt-4">For teams working with escorted convoys, law enforcement, or utility crews with aerial lifts, this reduction in cognitive load directly translates to fewer close calls.</p>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">5. Rolling it out across your fleet</h3>
            <p className="text-gray-300 mb-4">To get the most from voice commands:</p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Use a microphone or headset suited to cab noise levels — voice recognition works best with a clear signal.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Standardize a small set of mandatory commands for all drivers — start/stop, mark bridge, mark wire.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Run a short practice session in a parking lot before the first real survey so drivers build muscle memory.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span>Add simple rules to your SOPs — for example, "always mark bridges and critical signals by voice command, even if they seem obvious."</span></li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4">6. Voice + keyboard: the best of both worlds</h3>
            <p className="text-gray-300 mb-4">Voice commands don't replace keyboard shortcuts or the graphical interface — they complement them:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h4 className="font-semibold text-green-300 mb-2">While driving</h4>
                <p className="text-gray-300 text-sm">Voice is the primary mode — hands stay on the wheel, eyes stay on the road.</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h4 className="font-semibold text-blue-300 mb-2">Stopped or in the office</h4>
                <p className="text-gray-300 text-sm">Keyboard and touch allow reviewing data, correcting POIs, and adding detailed comments.</p>
              </div>
            </div>
            <p className="text-gray-300 mt-4">The result is a complete chain: the driver stays focused on the road, the survey stays structured and complete, and the engineering, permitting, and safety teams receive usable data — with no compromise on safety.</p>
          </section>

          <div className="border-t border-gray-700 pt-8">
            <div className="flex flex-wrap gap-4">
              <Link to="/features" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors" data-testid="button-features-voice">Explore MeasurePRO Features</Link>
              <Link to="/contact" className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors" data-testid="button-demo-voice">Book a Demo</Link>
            </div>
          </div>
        </div>
      </article>

      <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-gray-400">
            <p>© 2026 SolTec Innovation. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
