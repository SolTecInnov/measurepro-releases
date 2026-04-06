import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Zap, Navigation, Camera, FileText, Settings, AlertTriangle, Monitor, Usb, MapPin, Ruler, Target, Brain, Sparkles, Truck, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../lib/settings';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to MeasurePRO',
      icon: <Zap className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Zap className="w-16 h-16 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Welcome to MeasurePRO</h2>
            <p className="text-gray-300 text-lg">
              Professional measurement and survey application for field teams
            </p>
          </div>
          
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-4">What you'll learn:</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span>How to connect and configure your laser distance meter</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span>How to set up GPS tracking for accurate positioning</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span>How to find COM ports in Windows Device Manager</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span>Proper GPS antenna positioning on your vehicle</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span>Understanding ground reference measurements</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span>Creating surveys and logging measurements</span>
              </li>
            </ul>
          </div>
          
          {/* Documentation Resources Callout */}
          <div className="bg-gray-800/40 border border-gray-600 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-gray-300 text-sm">
                  📚 <strong>Comprehensive Documentation Available:</strong> Quick Start Guide, FAQ (70+ questions), Troubleshooting Flowcharts, and complete User Manual available in /docs folder or via Settings → Help
                </p>
              </div>
            </div>
          </div>
          
          {/* MeasurePRO+ AI Premium Feature Callout */}
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-2 border-purple-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Brain className="w-8 h-8 text-purple-400 shrink-0 mt-1" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-purple-300">MeasurePRO+ AI Features Available</h3>
                  <div className="inline-flex items-center gap-1 bg-purple-900/50 border border-purple-600 rounded-full px-2 py-0.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span className="text-purple-400 text-xs font-semibold">Premium</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm mb-3">
                  Enhance your workflow with AI-powered object detection, clearance alerts, and automated logging. 
                  Available as a premium add-on for $100 USD/month.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-300">26 object classes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-300">Auto-logging</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-300">Clearance alerts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-300">Training mode</span>
                  </div>
                </div>
                <p className="text-purple-400 text-xs mt-3">
                  Learn more in Settings → AI or Help → MeasurePRO+ AI Detection (Premium)
                </p>
              </div>
            </div>
          </div>

          {/* Envelope Clearance Premium Feature Callout */}
          <div className="bg-gradient-to-r from-orange-900/40 to-red-900/40 border-2 border-orange-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Truck className="w-8 h-8 text-orange-400 shrink-0 mt-1" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-orange-300">Envelope Clearance Monitoring</h3>
                  <div className="inline-flex items-center gap-1 bg-orange-900/50 border border-orange-600 rounded-full px-2 py-0.5">
                    <Sparkles className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400 text-xs font-semibold">Premium • BETA</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm mb-3">
                  Real-time vehicle clearance monitoring with visual and audio alerts for overhead obstacles. 
                  Perfect for utility and telecom vehicles. Available for $250 USD/month.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-orange-400" />
                    <span className="text-gray-300">Vehicle profiles</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-orange-400" />
                    <span className="text-gray-300">Visual overlays</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-orange-400" />
                    <span className="text-gray-300">Audio alerts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-orange-400" />
                    <span className="text-gray-300">Violation logging</span>
                  </div>
                </div>
                <p className="text-orange-400 text-xs mt-3">
                  Learn more in Settings → Envelope or Help → Envelope Clearance
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center text-gray-400">
            <p>This wizard will take about 5-10 minutes to complete</p>
          </div>
        </div>
      )
    },
    {
      id: 'device-manager',
      title: 'Finding COM Ports',
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Monitor className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Finding Your COM Ports</h2>
            <p className="text-gray-300">
              Before connecting devices, you need to identify which COM ports they use
            </p>
          </div>
          
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold text-yellow-400">Important Note</h3>
            </div>
            <p className="text-gray-300">
              Web browsers cannot directly access COM ports by name (COM3, COM8, etc.). 
              However, knowing your COM port numbers helps you identify the correct device when the browser asks for permission.
            </p>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400">Step-by-Step Instructions:</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                  <h4 className="font-medium">Open Device Manager</h4>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• Press <kbd className="bg-gray-800 px-2 py-1 rounded">Windows + X</kbd></li>
                  <li>• Select "Device Manager" from the menu</li>
                  <li>• Or search "Device Manager" in the Start menu</li>
                </ul>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                  <h4 className="font-medium">Locate COM Ports</h4>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• Expand "Ports (COM & LPT)" section</li>
                  <li>• Look for your devices (e.g., "USB Serial Port (COM3)")</li>
                  <li>• Note the COM port numbers for your laser and GPS devices</li>
                </ul>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                  <h4 className="font-medium">Identify Your Devices</h4>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• <strong>SolTec-30m:</strong> Usually appears as "USB Serial Port" or "FTDI USB Serial Port"</li>
                  <li>• <strong>GPS Module:</strong> Often shows as "Prolific USB-to-Serial" or "CH340 USB Serial"</li>
                  <li>• Right-click on a device → Properties → Details → Hardware IDs to see VID/PID</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
            <h4 className="font-medium text-blue-400 mb-2">Common Device Identifiers:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-gray-200">SolTec-30m:</h5>
                <ul className="text-gray-400 space-y-1">
                  <li>• VID: 0403 (FTDI)</li>
                  <li>• Usually COM3 or higher</li>
                  <li>• 115200 baud rate</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-200">GPS Modules:</h5>
                <ul className="text-gray-400 space-y-1">
                  <li>• VID: 067B (Prolific)</li>
                  <li>• VID: 1A86 (CH340)</li>
                  <li>• 4800 baud rate (NMEA)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'laser-setup',
      title: 'Laser Device Setup',
      icon: <Zap className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Zap className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Laser Device Configuration</h2>
            <p className="text-gray-300">
              Learn how to connect and configure your laser distance meter
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-4">Supported Laser Devices:</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-400 mb-2">✅ SolTec-30m (Recommended)</h4>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>Baud Rate:</strong> 115200</li>
                    <li>• <strong>Data Format:</strong> 8 data bits, no parity, 1 stop bit</li>
                    <li>• <strong>Commands:</strong> DM (single), DT (continuous), ESC (stop)</li>
                    <li>• <strong>Output Format:</strong> "D 0001.759" (meters)</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-400 mb-2">⚠️ SolTec-10m</h4>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>Baud Rate:</strong> 19200</li>
                    <li>• <strong>Data Format:</strong> 7 data bits, even parity, 1 stop bit</li>
                    <li>• <strong>Commands:</strong> s0g (single), s0h (continuous), s0c (stop)</li>
                    <li>• <strong>Output Format:</strong> "1234.567" (millimeters)</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-red-400">Ground Reference (GRND REF)</h3>
              </div>
              <div className="space-y-3">
                <p className="text-gray-300">
                  The <strong>Ground Reference Height</strong> is the distance from the ground to the white "GRND REF" line on your laser device.
                </p>
                <div className="bg-gray-800 p-3 rounded">
                  <h4 className="font-medium text-gray-200 mb-2">How to measure:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                    <li>Place the laser device on the ground</li>
                    <li>Measure from the ground to the white "GRND REF" line on the device</li>
                    <li>Enter this value in the "Ground Reference Height" field</li>
                    <li>This value will be automatically added to all measurements</li>
                  </ol>
                </div>
                <div className="bg-blue-800/20 p-3 rounded">
                  <p className="text-blue-300 text-sm">
                    <strong>Example:</strong> If the GRND REF line is 0.150m above ground, enter 0.150 in the Ground Reference Height field.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'gps-setup',
      title: 'GPS Setup & Positioning',
      icon: <Navigation className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Navigation className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">GPS Configuration & Positioning</h2>
            <p className="text-gray-300">
              Proper GPS setup is crucial for accurate positioning and measurements
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-4">GPS Device Configuration:</h3>
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-green-400 mb-2">Standard NMEA GPS Settings:</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong>Baud Rate:</strong> 4800 (most common) or 9600</li>
                  <li>• <strong>Data Format:</strong> 8 data bits, no parity, 1 stop bit</li>
                  <li>• <strong>Protocol:</strong> NMEA 0183</li>
                  <li>• <strong>Sentences:</strong> GPGGA, GPRMC, GPGSV</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-green-400">GPS Antenna Positioning on Vehicle</h3>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-800 p-4 rounded">
                  <h4 className="font-medium text-gray-200 mb-3">Optimal Placement:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-green-400 mb-2">✅ Best Locations:</h5>
                      <ul className="text-gray-300 text-sm space-y-1">
                        <li>• Center of vehicle roof</li>
                        <li>• Highest point possible</li>
                        <li>• Clear view of sky (360°)</li>
                        <li>• Away from metal obstructions</li>
                        <li>• Secure mounting</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-red-400 mb-2">❌ Avoid These Areas:</h5>
                      <ul className="text-gray-300 text-sm space-y-1">
                        <li>• Near radio antennas</li>
                        <li>• Under roof racks</li>
                        <li>• Close to metal edges</li>
                        <li>• Inside the vehicle</li>
                        <li>• Temporary mounting</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-800/20 p-3 rounded">
                  <h4 className="font-medium text-blue-300 mb-2">Cable Routing Tips:</h4>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Use weatherproof cable entry points</li>
                    <li>• Secure cables to prevent damage</li>
                    <li>• Keep GPS cable away from power cables</li>
                    <li>• Use ferrite cores if interference occurs</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">GPS Failsafe Feature:</h3>
              <p className="text-gray-300 mb-3">
                MeasurePRO includes an automatic GPS failsafe that uses your browser's location when serial GPS is unavailable.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Automatically switches to browser GPS if serial GPS fails</li>
                  <li>• Switches back to serial GPS when it becomes available</li>
                  <li>• Can be enabled/disabled in GPS settings</li>
                  <li>• Provides continuous positioning even with hardware issues</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'web-serial',
      title: 'Web Serial API Setup',
      icon: <Usb className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Usb className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Connecting Devices via Web Serial</h2>
            <p className="text-gray-300">
              Understanding how web browsers connect to your hardware
            </p>
          </div>
          
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold text-yellow-400">Important: Web Serial vs COM Ports</h3>
            </div>
            <p className="text-gray-300 mb-3">
              Web browsers <strong>cannot</strong> directly access Windows COM ports by name. Instead, they use the Web Serial API which:
            </p>
            <ul className="text-gray-300 text-sm space-y-1 ml-4">
              <li>• Shows devices by USB identifiers (VID/PID), not COM port names</li>
              <li>• Requires explicit user permission for each device</li>
              <li>• Only works in Chrome and Edge browsers</li>
              <li>• Needs HTTPS or localhost to function</li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400">Connection Process:</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                  <h4 className="font-medium">Physical Connection</h4>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• Connect your laser device via USB</li>
                  <li>• Connect your GPS module via USB</li>
                  <li>• Ensure drivers are installed (check Device Manager)</li>
                  <li>• Close any other applications using these devices</li>
                </ul>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                  <h4 className="font-medium">Browser Permission</h4>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• Click "Add Port" button in MeasurePRO</li>
                  <li>• Browser will show a device selection dialog</li>
                  <li>• Select your device from the list (by VID/PID, not COM name)</li>
                  <li>• Grant permission when prompted</li>
                </ul>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                  <h4 className="font-medium">Device Assignment</h4>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• Click "Set as Laser" for your laser device</li>
                  <li>• Click "Set as GPS" for your GPS module</li>
                  <li>• Green status indicators show successful connections</li>
                  <li>• Test with "Single Measure" or "Temperature" commands</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
            <h4 className="font-medium text-red-400 mb-2">Troubleshooting:</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• If devices don't appear: Check drivers and USB connections</li>
              <li>• If permission denied: Check browser settings and try incognito mode</li>
              <li>• If connection fails: Use the "Reset" button and try again</li>
              <li>• If data not received: Verify baud rate and device type settings</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'ground-reference',
      title: 'Ground Reference Setup',
      icon: <Ruler className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Ruler className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Understanding Ground Reference</h2>
            <p className="text-gray-300">
              Critical for accurate height measurements
            </p>
          </div>
          
          <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-6 h-6 text-red-400" />
              <h3 className="text-xl font-semibold text-red-400">Ground Reference Measurement</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-300 mb-4 font-medium">
                The Ground Reference Height is the distance from the ground to the white "GRND REF" line on your laser device <strong>positioned on the vehicle</strong>.
              </p>
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-200 mb-3">Step-by-Step Measurement:</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-300">
                  <li>Position the laser device on your vehicle (roof, hood, etc.)</li>
                  <li>Measure from the ground to the white "GRND REF" line on the laser device</li>
                  <li>Enter this measurement (in meters) in the "Ground Reference Height" field</li>
                  <li>This value will be automatically added to all laser measurements</li>
                </ol>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-800/20 p-3 rounded">
                  <h5 className="font-medium text-green-400 mb-2">✅ Correct Setup:</h5>
                  <ul className="text-gray-300 text-xs space-y-1">
                    <li>• Measure to white GRND REF line</li>
                    <li>• Use metric units (meters)</li>
                    <li>• Measure from actual ground level</li>
                    <li>• Account for device mounting height</li>
                  </ul>
                </div>
                <div className="bg-red-800/20 p-3 rounded">
                  <h5 className="font-medium text-red-400 mb-2">❌ Common Mistakes:</h5>
                  <ul className="text-gray-300 text-xs space-y-1">
                    <li>• Measuring to wrong reference point</li>
                    <li>• Using imperial units (feet/inches)</li>
                    <li>• Not accounting for mounting height</li>
                    <li>• Forgetting to set the value</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-800/20 p-4 rounded">
                <h4 className="font-medium text-blue-300 mb-2">Why This Matters:</h4>
                <p className="text-gray-300 text-sm">
                  The laser measures distance to objects, but for clearance calculations, you need height above ground. 
                  <strong>Example:</strong> If the laser device is mounted on your vehicle and the GRND REF line is 1.850m above ground, enter 1.850 in the Ground Reference Height field.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">GPS Failsafe Configuration:</h3>
            <p className="text-gray-300 mb-3">
              Enable browser GPS as backup when serial GPS is unavailable:
            </p>
            <div className="bg-gray-800 p-3 rounded">
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Go to GPS Data card → Settings (gear icon)</li>
                <li>• Check "Enable Browser GPS Failsafe"</li>
                <li>• System automatically switches between serial and browser GPS</li>
                <li>• Provides continuous positioning even with hardware issues</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'survey-creation',
      title: 'Creating Your First Survey',
      icon: <FileText className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <FileText className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Survey Management</h2>
            <p className="text-gray-300">
              Organize your measurements with surveys
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Creating a New Survey:</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Click the "New Survey" button (blue, pulsing button)</li>
                <li>Fill in the required information:
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Survey Title (required)</li>
                    <li>• Surveyor Name (required)</li>
                    <li>• Client Name (required)</li>
                    <li>• Origin Address (required)</li>
                    <li>• Destination Address (required)</li>
                  </ul>
                </li>
                <li>Add optional information (Project Number, Description, Notes)</li>
                <li>Click "Create Survey" to start</li>
              </ol>
            </div>
            
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h4 className="font-medium text-green-400 mb-2">Survey Features:</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• <strong>Vehicle Trace:</strong> Records your vehicle's path automatically</li>
                <li>• <strong>Alert Log:</strong> Logs all warning and critical height alerts</li>
                <li>• <strong>Auto-Export:</strong> Automatically saves data at regular intervals</li>
                <li>• <strong>Multiple Formats:</strong> Export as CSV, JSON, or GeoJSON</li>
                <li>• <strong>Media Integration:</strong> Links images and videos to measurements</li>
              </ul>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-medium text-blue-400 mb-2">Working Without a Survey:</h4>
              <p className="text-gray-300 text-sm mb-2">
                You can also log independent measurements without creating a survey:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Use Manual logging mode</li>
                <li>• Measurements are saved locally</li>
                <li>• Can be exported anytime</li>
                <li>• Useful for quick measurements or testing</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'logging-modes',
      title: 'Logging Modes',
      icon: <Settings className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Settings className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Understanding Logging Modes</h2>
            <p className="text-gray-300">
              Choose the right mode for your measurement needs
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-emerald-400 mb-3">Manual Mode (Recommended for Beginners)</h3>
              <p className="text-gray-300 mb-3">
                You control when measurements are recorded. Best for precise, controlled surveys.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-gray-200 mb-2">How it works:</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Click "Log Measurement" button to record current reading</li>
                  <li>• Automatically captures photo with measurement</li>
                  <li>• Select POI type before logging</li>
                  <li>• Add notes for each measurement</li>
                  <li>• Works without active survey (independent mode)</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">All Data Mode</h3>
              <p className="text-gray-300 mb-3">
                Records all valid measurements continuously. Requires active survey and connected devices.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-gray-200 mb-2">Best for:</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Comprehensive data collection</li>
                  <li>• Highway surveys with continuous obstacles</li>
                  <li>• Creating detailed clearance profiles</li>
                  <li>• Post-processing analysis</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-400 mb-3">Detection Mode (Advanced)</h3>
              <p className="text-gray-300 mb-3">
                Automatically detects objects and logs the minimum height. Requires connected laser and GPS.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-gray-200 mb-2">How it works:</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Monitors laser readings continuously</li>
                  <li>• Detects when an object appears (valid reading after invalid)</li>
                  <li>• Records minimum height during object detection</li>
                  <li>• Automatically captures image and video (if enabled)</li>
                  <li>• Creates detailed detection logs for analysis</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">Slave App Mode</h3>
              <p className="text-gray-300 mb-3">
                Import measurements from the mobile Slave App for team collaboration.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-gray-200 mb-2">Use cases:</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Team members using smartphones/tablets</li>
                  <li>• Manual measurements at specific locations</li>
                  <li>• Backup measurement method</li>
                  <li>• Multi-device data collection</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'camera-setup',
      title: 'Camera & Media Setup',
      icon: <Camera className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Camera className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Camera Configuration</h2>
            <p className="text-gray-300">
              Set up image and video capture for documentation
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Camera Setup:</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Go to Settings → Camera tab</li>
                <li>Click "Request Access" to allow camera permission</li>
                <li>Select your preferred camera from the dropdown</li>
                <li>Choose image resolution (720p recommended for balance of quality/size)</li>
                <li>Configure overlay options to show relevant information</li>
              </ol>
            </div>
            
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h4 className="font-medium text-green-400 mb-3">Overlay Information:</h4>
              <p className="text-gray-300 mb-3">
                Overlays add important information directly on your images:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Available Overlays:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• POI Number (R001-00123)</li>
                    <li>• GPS Coordinates</li>
                    <li>• Height Measurement</li>
                    <li>• Date & Time (UTC)</li>
                    <li>• GPS Heading</li>
                    <li>• Company Logo</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Benefits:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Permanent documentation</li>
                    <li>• No need for separate notes</li>
                    <li>• Professional appearance</li>
                    <li>• Audit trail compliance</li>
                    <li>• Easy identification</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-medium text-blue-400 mb-3">Video Mode (Optional):</h4>
              <p className="text-gray-300 mb-3">
                Enable video recording for object detection mode:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Records video buffer before object detection</li>
                <li>• Useful for reviewing detection events</li>
                <li>• Configurable buffer duration (1-10 seconds)</li>
                <li>• Automatically saved with detected objects</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'first-measurement',
      title: 'Taking Your First Measurement',
      icon: <Target className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <Target className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Your First Measurement</h2>
            <p className="text-gray-300">
              Step-by-step guide to logging your first POI
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Pre-Measurement Checklist:</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-600" />
                  <span className="text-gray-300">Laser device connected and responding</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-600" />
                  <span className="text-gray-300">GPS showing valid coordinates (not 0.000000)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-600" />
                  <span className="text-gray-300">Ground reference height configured</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-600" />
                  <span className="text-gray-300">Camera permission granted</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-600" />
                  <span className="text-gray-300">Survey created (or using independent mode)</span>
                </label>
              </div>
            </div>
            
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-400 mb-3">Taking a Measurement:</h3>
              <ol className="list-decimal list-inside space-y-3 text-gray-300">
                <li>
                  <strong>Position your vehicle:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Stop under or near the object to measure</li>
                    <li>• Ensure laser has clear line of sight to object</li>
                    <li>• Wait for GPS to stabilize (3+ satellites)</li>
                  </ul>
                </li>
                <li>
                  <strong>Aim the laser:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Point laser at the lowest part of the object</li>
                    <li>• Use red dot (if available) for precise aiming</li>
                    <li>• Wait for stable reading in "Current Measure" card</li>
                  </ul>
                </li>
                <li>
                  <strong>Select POI type:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Choose appropriate type (Bridge, Tree, Wire, etc.)</li>
                    <li>• This helps categorize your measurements</li>
                  </ul>
                </li>
                <li>
                  <strong>Log the measurement:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Click "Log Measurement" button</li>
                    <li>• Photo is automatically captured</li>
                    <li>• Measurement is saved with GPS coordinates</li>
                    <li>• Confirmation sound plays</li>
                  </ul>
                </li>
              </ol>
            </div>
            
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
              <h4 className="font-medium text-yellow-400 mb-2">Tips for Accurate Measurements:</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Measure the lowest point of overhead obstacles</li>
                <li>• Ensure laser beam is perpendicular to the object</li>
                <li>• Take multiple readings if the object is irregular</li>
                <li>• Use the "Minimum Distance" card to track the lowest reading</li>
                <li>• Add detailed notes for complex situations</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'alerts-thresholds',
      title: 'Alerts & Safety Thresholds',
      icon: <AlertTriangle className="w-8 h-8 text-red-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Safety Alerts & Thresholds</h2>
            <p className="text-gray-300">
              Configure alerts to ensure safe clearances
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-400 mb-3">Critical Safety Information:</h3>
              <p className="text-gray-300 mb-3">
                Proper threshold configuration is essential for safe operations:
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• <strong>Critical Threshold:</strong> Immediate danger level (e.g., 4.0m for a 3.8m load)</li>
                  <li>• <strong>Warning Threshold:</strong> Caution level (e.g., 4.2m for early warning)</li>
                  <li>• <strong>Min/Max Height:</strong> Filter out irrelevant readings</li>
                  <li>• <strong>Always add safety margin:</strong> Account for vehicle bounce, load shift, etc.</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Configuring Thresholds:</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Go to Settings → Alerts tab</li>
                <li>Set your vehicle/load height requirements</li>
                <li>Configure warning threshold (recommended: load height + 0.2m)</li>
                <li>Configure critical threshold (recommended: load height + 0.1m)</li>
                <li>Test alert sounds to ensure they're audible</li>
                <li>Set min/max height filters to reduce noise</li>
              </ol>
            </div>
            
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
              <h4 className="font-medium text-yellow-400 mb-3">Alert Behavior:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-orange-400 mb-2">Warning Alerts:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Orange visual indicator</li>
                    <li>• Warning sound (configurable)</li>
                    <li>• Auto-clears after 15 seconds</li>
                    <li>• Can be manually cleared</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-red-400 mb-2">Critical Alerts:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Red visual indicator</li>
                    <li>• Loud alarm sound (loops)</li>
                    <li>• Must be manually cleared</li>
                    <li>• Logged for safety records</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'data-export',
      title: 'Data Export & Backup',
      icon: <FileText className="w-8 h-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <FileText className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Data Export & Backup</h2>
            <p className="text-gray-300">
              Ensure your data is safely exported and backed up
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-400 mb-3">Export Options:</h3>
              <div className="space-y-3">
                <div className="bg-gray-800 p-3 rounded">
                  <h4 className="font-medium text-gray-200 mb-2">📊 CSV Export:</h4>
                  <p className="text-gray-300 text-sm">
                    Spreadsheet-compatible format with all measurement data, GPS coordinates, and image filenames.
                  </p>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h4 className="font-medium text-gray-200 mb-2">🗺️ GeoJSON Export:</h4>
                  <p className="text-gray-300 text-sm">
                    Geographic format for GIS software, mapping applications, and spatial analysis.
                  </p>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h4 className="font-medium text-gray-200 mb-2">📦 Complete Package:</h4>
                  <p className="text-gray-300 text-sm">
                    ZIP file with all data, images, videos, and documentation. Perfect for client delivery.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Auto-Save Configuration:</h3>
              <p className="text-gray-300 mb-3">
                Protect your work with automatic backups:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                <li>Go to Settings → Logging tab</li>
                <li>Enable "Enable automatic saving"</li>
                <li>Set interval (5 minutes recommended)</li>
                <li>Choose to include images for complete backup</li>
                <li>Set custom filename for easy identification</li>
              </ol>
            </div>
            
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <h4 className="font-medium text-purple-400 mb-3">Cloud Synchronization:</h4>
              <p className="text-gray-300 mb-3">
                Sync your data to the cloud for team access and backup:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Go to Settings → Sync tab</li>
                <li>• Sign in with your account</li>
                <li>• Data automatically syncs when online</li>
                <li>• Access from multiple devices</li>
                <li>• Use Live Monitor for real-time team collaboration</li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-r from-cyan-900/40 to-blue-900/40 border-2 border-cyan-500 rounded-lg p-5" data-testid="callout-offline-export">
              <div className="flex items-start gap-3 mb-4">
                <Database className="w-8 h-8 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-xl font-bold text-cyan-300 mb-1">Data Export & Offline Mode</h3>
                  <p className="text-gray-300 text-sm">Essential features for reliable field operations</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-gray-800/60 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-200 mb-2">📤 Export Formats Available:</h4>
                      <p className="text-gray-300 text-sm mb-2">
                        Export your data from Data Manager in multiple formats for different use cases:
                      </p>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li>• <strong className="text-gray-300">CSV</strong> - Excel/Sheets compatible spreadsheets</li>
                        <li>• <strong className="text-gray-300">JSON</strong> - Developer-friendly structured data</li>
                        <li>• <strong className="text-gray-300">GeoJSON</strong> - GIS software (QGIS, ArcGIS)</li>
                        <li>• <strong className="text-gray-300">KML</strong> - Google Earth visualization</li>
                        <li>• <strong className="text-gray-300">ZIP</strong> - Complete package with images</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/60 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Monitor className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-200 mb-2">📡 Offline Mode Support:</h4>
                      <p className="text-gray-300 text-sm mb-2">
                        All features work completely offline with local storage. Data syncs automatically when you're back online.
                      </p>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li>• <strong className="text-gray-300">No internet required</strong> for measurements, GPS tracking, and logging</li>
                        <li>• <strong className="text-gray-300">Data stored locally</strong> in your browser's database</li>
                        <li>• <strong className="text-gray-300">Auto-sync</strong> when connection restored</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-cyan-900/30 border border-cyan-600/40 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-cyan-300 mb-2">✅ Best Practice:</h4>
                      <p className="text-gray-300 text-sm">
                        <strong>Export your data regularly for backup.</strong> While data is safely stored locally, 
                        exporting provides an additional safety layer and makes sharing with clients or team members easier.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const markStepComplete = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
  };

  const handleComplete = () => {
    const now = new Date().toISOString();
    useSettingsStore.getState().setUISettings({ onboardingCompleted: true, onboardingCompletedDate: now });
    onComplete();
    onClose();
    toast.success('Onboarding completed! You\'re ready to start measuring.');
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {currentStepData.icon}
            <div>
              <h1 className="text-xl font-semibold">{currentStepData.title}</h1>
              <p className="text-gray-400 text-sm">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Progress</span>
            <span className="text-sm text-gray-400">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800">
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={prevStep}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={markStepComplete}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                completedSteps.has(currentStep)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <Check className="w-4 h-4" />
              {completedSteps.has(currentStep) ? 'Completed' : 'Mark Complete'}
            </button>
            
            {isLastStep ? (
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                Finish Setup
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;