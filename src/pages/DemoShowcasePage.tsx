import { useNavigate } from 'react-router-dom';
import { useDemoStore } from '@/lib/demo/demoStore';
import { DEMO_CHAPTERS } from '@/lib/demo/demoChapters';
import { demoRuntime } from '@/lib/demo/demoRuntime';
import { Play, MousePointer, Home, Zap, Gauge, MapPin, Camera, FileText, Download, Rocket } from 'lucide-react';

const CHAPTER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Gauge,
  MapPin,
  Camera,
  FileText,
  Download,
  Rocket
};

export default function DemoShowcasePage() {
  const navigate = useNavigate();
  const { setChapters, startDemo } = useDemoStore();

  const launchAutoTour = () => {
    localStorage.setItem('app_access', 'true');
    localStorage.setItem('demo_mode', 'true');
    setChapters(DEMO_CHAPTERS);
    demoRuntime.start();
    startDemo();
    navigate('/');
  };

  const launchInteractive = () => {
    localStorage.setItem('app_access', 'true');
    localStorage.setItem('demo_mode', 'true');
    demoRuntime.start();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          data-testid="button-back-home"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mb-6">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            MeasurePRO Demo
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Experience the power of professional surveying
          </p>
          <p className="text-gray-400">
            Interactive 3-minute tour of all features with live simulated data
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
          <button
            onClick={launchAutoTour}
            className="group p-8 bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 hover:border-purple-400 rounded-2xl transition-all hover:scale-[1.02]"
            data-testid="button-auto-tour"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                <Play className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Guided Tour</h3>
              <p className="text-gray-400">
                Sit back and watch the automated demo with explanations
              </p>
            </div>
          </button>

          <button
            onClick={launchInteractive}
            className="group p-8 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 hover:border-blue-400 rounded-2xl transition-all hover:scale-[1.02]"
            data-testid="button-interactive"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                <MousePointer className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Interactive Mode</h3>
              <p className="text-gray-400">
                Explore the application at your own pace with live data
              </p>
            </div>
          </button>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-center">What you'll discover:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {DEMO_CHAPTERS.map((chapter) => {
                const Icon = CHAPTER_ICONS[chapter.icon] || Zap;
                return (
                  <div key={chapter.id} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                    <Icon className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{chapter.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            Estimated duration: ~3 minutes • No signup required
          </p>
        </div>
      </div>
    </div>
  );
}
