import React, { useState } from 'react';
import { HelpCircle, AlertTriangle, Terminal, Monitor, Navigation, Zap, FileText, Settings, Target, MapPin, Ruler, ChevronDown, ChevronUp, Info, Brain, Sparkles, Eye, Camera, Database, Lock, Keyboard, Check, Mail, X, Truck, Shield, Download, ExternalLink, Route, Key, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DocCenter from './DocCenter';

const HelpSettings = () => {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleViewDocument = async (fileName: string, docName: string) => {
    try {
      const response = await fetch(`/docs/${fileName}`);
      if (!response.ok) throw new Error('Failed to fetch document');
      const content = await response.text();
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Could not download ${docName}. Please check if the file exists in /docs folder.`);
    }
  };

  const Section = ({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => {
    const isExpanded = expandedSections.has(id);
    
    return (
      <div className="bg-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-600 transition-colors"
        >
          <div className="flex items-center gap-3">
            {icon}
            <h3 className="text-lg font-semibold text-left">{title}</h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <div className="p-4 pt-0 border-t border-gray-600">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-6">
      <div className="text-center mb-8">
        <HelpCircle className="w-16 h-16 text-blue-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">MeasurePRO Help Center</h1>
        <p className="text-gray-300 text-lg">
          Complete guide to using MeasurePRO for professional surveying
        </p>
      </div>

      {/* Complete User Manual */}
      <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/30 border border-blue-500/40 rounded-lg p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-lg flex-shrink-0">
            <FileText className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <div className="font-bold text-white text-lg">Complete User Manual</div>
            <div className="text-sm text-gray-300">All 22 parts — laser setup, GPS, POI types, export, AI, admin &amp; more</div>
            <div className="text-xs text-gray-500 mt-1">22 chapters · 6 appendices · printable / PDF · measure-pro.app/manual.html</div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a
            href="/manual.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
            data-testid="link-user-manual"
          >
            <ExternalLink className="w-4 h-4" />
            Open Manual
          </a>
        </div>
      </div>

      {/* Account Management Quick Access */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-600/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          Account Management
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/licenses')}
            className="flex items-center justify-between gap-3 p-4 bg-gray-800/80 hover:bg-gray-700/80 rounded-lg transition-colors group"
            data-testid="button-nav-licenses"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 rounded-lg group-hover:bg-purple-600/30 transition-colors">
                <Key className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">License Management</div>
                <div className="text-sm text-gray-400">Activate codes & manage devices</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </button>
          
          <button
            onClick={() => navigate('/subscription')}
            className="flex items-center justify-between gap-3 p-4 bg-gray-800/80 hover:bg-gray-700/80 rounded-lg transition-colors group"
            data-testid="button-nav-subscription"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg group-hover:bg-blue-600/30 transition-colors">
                <CreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">Subscription</div>
                <div className="text-sm text-gray-400">Manage billing & plan</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      <DocCenter />

      <Section
        id="top-faq"
        title="Top 5 FAQ Quick Reference"
        icon={<HelpCircle className="w-6 h-6 text-yellow-400" />}
      >
        <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5" />
            Most Common Issues & Quick Fixes
          </h4>
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4" data-testid="faq-item-laser-connection">
              <h5 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                1. Why isn't my laser device connecting?
              </h5>
              <p className="text-gray-300 text-sm mb-2">
                Check USB cable connection, try a different USB port, verify the laser is powered on, and ensure drivers are installed.
              </p>
              <button
                onClick={() => handleViewDocument('FAQ.md', 'FAQ')}
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
                data-testid="button-faq-laser-details"
              >
                <ExternalLink className="w-3 h-3" />
                See FAQ for full details
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4" data-testid="faq-item-gps-fix">
              <h5 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-yellow-400" />
                2. GPS shows 'No Fix' or inaccurate position
              </h5>
              <p className="text-gray-300 text-sm mb-2">
                GPS needs a clear view of the sky to lock satellites. Move outdoors or near a window and wait 1-2 minutes for the first lock.
              </p>
              <button
                onClick={() => handleViewDocument('FAQ.md', 'FAQ')}
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
                data-testid="button-faq-gps-details"
              >
                <ExternalLink className="w-3 h-3" />
                See FAQ for full details
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4" data-testid="faq-item-camera-permission">
              <h5 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 text-yellow-400" />
                3. Camera not detected or permission denied
              </h5>
              <p className="text-gray-300 text-sm mb-2">
                Allow camera permission in browser settings and ensure no other app is using the camera. Restart the browser if needed.
              </p>
              <button
                onClick={() => handleViewDocument('FAQ.md', 'FAQ')}
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
                data-testid="button-faq-camera-details"
              >
                <ExternalLink className="w-3 h-3" />
                See FAQ for full details
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4" data-testid="faq-item-data-sync">
              <h5 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                <Database className="w-4 h-4 text-yellow-400" />
                4. Data not syncing to cloud
              </h5>
              <p className="text-gray-300 text-sm mb-2">
                Cloud sync requires internet and Firebase configuration. Check your internet connection and verify Firebase is configured in settings.
              </p>
              <button
                onClick={() => handleViewDocument('FAQ.md', 'FAQ')}
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
                data-testid="button-faq-sync-details"
              >
                <ExternalLink className="w-3 h-3" />
                See FAQ for full details
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4" data-testid="faq-item-stop-modal">
              <h5 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-yellow-400" />
                5. Off-route alert won't dismiss
              </h5>
              <p className="text-gray-300 text-sm mb-2">
                STOP modal clearance requires internet connection. Ensure driver has internet and have dispatch re-clear the incident.
              </p>
              <button
                onClick={() => handleViewDocument('FAQ.md', 'FAQ')}
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
                data-testid="button-faq-stop-details"
              >
                <ExternalLink className="w-3 h-3" />
                See FAQ for full details
              </button>
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-3 mt-4">
            <p className="text-gray-300 text-sm">
              <strong className="text-yellow-400">💡 Tip:</strong> Download the complete FAQ document above for answers to 70+ questions covering all features.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="camera-calibration"
        title="Camera Calibration & Measurements"
        icon={<Camera className="w-6 h-6 text-blue-400" />}
      >
        <div className="space-y-4 text-gray-300">
          <div>
            <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" /> What is Camera Calibration?
            </h4>
            <p>
              Camera calibration converts AI pixel detections into accurate real-world measurements. 
              Using a chessboard pattern, the system calculates camera intrinsics and distortion coefficients 
              to enable bridge clearance surveys, lane width measurements, and infrastructure analysis.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-2">How to Calibrate</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to Settings → Calibration tab</li>
              <li>Print a 9×6 chessboard pattern (25mm squares)</li>
              <li>Capture 10+ images at different angles</li>
              <li>System auto-calculates calibration</li>
              <li>Target: &lt;0.5px error for EXCELLENT rating</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-2">Measurement Modes</h4>
            <ul className="space-y-2">
              <li><strong>Bridge Survey:</strong> Quebec (5.3m) / Ontario (5.1m) compliance</li>
              <li><strong>Lane Width:</strong> Road lane measurements</li>
              <li><strong>Traffic Signals:</strong> Clearances and spacing</li>
              <li><strong>Railroad Overhead:</strong> Structure clearances</li>
            </ul>
            <p className="mt-2 text-sm">
              ⚠️ Requires AI Detection enabled. Find measurement cards in main app layout.
            </p>
          </div>
        </div>
      </Section>

      <div className="space-y-4">
        <Section
          id="getting-started"
          title="Getting Started"
          icon={<Target className="w-6 h-6 text-green-400" />}
        >
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3">Quick Start Checklist:</h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Connect your laser device and GPS module via USB</li>
                <li>Open Device Manager to identify COM port numbers</li>
                <li>In MeasurePRO, click "Add Port" and select your devices</li>
                <li>Configure ground reference height (distance from ground to GRND REF line)</li>
                <li>Create a new survey or use manual mode</li>
                <li>Set up safety thresholds in Alert Settings</li>
                <li>Take your first measurement!</li>
              </ol>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">System Requirements:</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• <strong>Browser:</strong> Chrome or Edge (Web Serial API required)</li>
                <li>• <strong>Connection:</strong> HTTPS or localhost</li>
                <li>• <strong>Devices:</strong> USB-connected laser and GPS with proper drivers</li>
                <li>• <strong>Permissions:</strong> Camera, location, and serial port access</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          id="ai-detection"
          title="MeasurePRO+ AI Detection (Premium)"
          icon={<Brain className="w-6 h-6 text-purple-400" />}
        >
          <div className="space-y-4">
            {/* Premium Badge */}
            <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-2 border-purple-500 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Brain className="w-8 h-8 text-purple-400" />
                  <div>
                    <h4 className="text-xl font-bold text-purple-300">AI-Powered Object Detection</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-400 font-semibold">Premium Add-On Feature</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-400" data-testid="text-ai-help-price">$100 USD</div>
                  <div className="text-sm text-gray-400">per month</div>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                MeasurePRO+ AI enhances your surveying workflow with advanced computer vision capabilities for automated object detection, clearance analysis, and intelligent data collection.
              </p>
              <div className="bg-purple-900/20 border border-purple-800/30 rounded p-3">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-purple-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-purple-300 font-medium">Contact your administrator to activate this premium feature</p>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Enable */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-purple-400 mb-3">How to Enable AI Features:</h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                  <div>
                    <p className="text-gray-300"><strong>Access AI Settings:</strong></p>
                    <p className="text-gray-400 text-sm">Navigate to Settings (⚙️ icon) → AI tab</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                  <div>
                    <p className="text-gray-300"><strong>Contact Administrator:</strong></p>
                    <p className="text-gray-400 text-sm">Your administrator will activate your premium subscription. Features become available automatically when subscription is valid.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                  <div>
                    <p className="text-gray-300"><strong>Enable AI Detection:</strong></p>
                    <p className="text-gray-400 text-sm">Toggle "Enable AI Detection" to activate the feature</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">4</span>
                  <div>
                    <p className="text-gray-300"><strong>Configure Detection Classes:</strong></p>
                    <p className="text-gray-400 text-sm">Select which of the 26 object classes you want to detect</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 26 Object Detection Classes */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-purple-400 mb-3">26 Object Detection Classes:</h4>
              <p className="text-gray-300 text-sm mb-4">
                MeasurePRO+ AI can detect and classify 26 different object types commonly found in surveying work:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-semibold text-red-400 mb-2">🚦 Overhead Infrastructure (9):</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Traffic signals</li>
                    <li>• Traffic signs</li>
                    <li>• Street lights</li>
                    <li>• Bridges</li>
                    <li>• Overpasses</li>
                    <li>• Tunnels</li>
                    <li>• Canopies</li>
                    <li>• Building overhangs</li>
                    <li>• Walkway covers</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-semibold text-green-400 mb-2">🌳 Vegetation (6):</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Trees</li>
                    <li>• Tree branches</li>
                    <li>• Shrubs</li>
                    <li>• Foliage</li>
                    <li>• Overhanging vegetation</li>
                    <li>• Low-hanging limbs</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-semibold text-yellow-400 mb-2">⚡ Electrical & Utilities (11):</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Power lines</li>
                    <li>• Utility poles</li>
                    <li>• Transformers</li>
                    <li>• Cable lines</li>
                    <li>• Communication wires</li>
                    <li>• Power distribution boxes</li>
                    <li>• Utility equipment</li>
                    <li>• Electrical boxes</li>
                    <li>• Wire crossings</li>
                    <li>• Suspended cables</li>
                    <li>• Overhead utilities</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Mock Detection Mode */}
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-5 h-5 text-blue-400" />
                <h4 className="font-semibold text-blue-400">Mock Detection Mode (Testing)</h4>
              </div>
              <p className="text-gray-300 mb-3">
                Test AI features without a trained model using mock detection mode:
              </p>
              <div className="space-y-2">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">What is Mock Detection?</h5>
                  <p className="text-gray-300 text-sm">
                    Mock detection simulates AI object detection by generating random detections at configurable intervals. 
                    This allows you to test the detection workflow, training data collection, and auto-logging features 
                    without needing a trained AI model.
                  </p>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">How to Use:</h5>
                  <ol className="list-decimal list-inside text-gray-300 text-sm space-y-1">
                    <li>Enable "Mock Detection Mode" in Settings → AI</li>
                    <li>Set detection interval (e.g., every 5 seconds)</li>
                    <li>Configure which object classes to randomly generate</li>
                    <li>Start surveying - mock detections will appear automatically</li>
                    <li>Practice using Accept/Reject/Correct workflow</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Training Data Collection */}
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-green-400" />
                <h4 className="font-semibold text-green-400">Training Data Collection Workflow</h4>
              </div>
              <p className="text-gray-300 mb-3">
                Improve detection accuracy by collecting training data specific to your environment:
              </p>
              <div className="space-y-3">
                <div className="bg-gray-800 p-4 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">Step-by-Step Process:</h5>
                  <ol className="list-decimal list-inside text-gray-300 text-sm space-y-2">
                    <li>
                      <strong>Enable Training Mode:</strong>
                      <p className="ml-6 text-gray-400 mt-1">Toggle "Training Mode" in Settings → AI. This activates enhanced data capture.</p>
                    </li>
                    <li>
                      <strong>Set Frame Rate:</strong>
                      <p className="ml-6 text-gray-400 mt-1">Choose how often to capture frames (1-10 per second). Higher rates = more data.</p>
                    </li>
                    <li>
                      <strong>Survey as Normal:</strong>
                      <p className="ml-6 text-gray-400 mt-1">Drive your route and let the system capture camera frames automatically.</p>
                    </li>
                    <li>
                      <strong>Review & Label:</strong>
                      <p className="ml-6 text-gray-400 mt-1">Use detection overlay to Accept, Reject, or Correct object classifications.</p>
                    </li>
                    <li>
                      <strong>Export Training Set:</strong>
                      <p className="ml-6 text-gray-400 mt-1">Export labeled images for use in training your custom detection model.</p>
                    </li>
                  </ol>
                </div>
                <div className="bg-purple-900/20 border border-purple-800/30 rounded p-3">
                  <p className="text-purple-300 text-sm">
                    <strong>💡 Tip:</strong> Collect training data in various lighting conditions, weather, and seasons to improve model robustness.
                  </p>
                </div>
              </div>
            </div>

            {/* Detection Overlay (Accept/Reject/Correct) */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-purple-400" />
                <h4 className="font-semibold text-purple-400">Detection Overlay (Accept/Reject/Correct)</h4>
              </div>
              <p className="text-gray-300 mb-3">
                When AI detects an object, an overlay appears with three action buttons:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-green-900/20 border border-green-800/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-green-400" />
                    <h5 className="font-semibold text-green-400">Accept</h5>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">Confirms detection is correct</p>
                  <ul className="text-gray-400 text-xs space-y-1">
                    <li>• Logs to measurements</li>
                    <li>• Saves labeled training data</li>
                    <li>• Auto-captures image</li>
                  </ul>
                  <div className="mt-2 text-xs">
                    <kbd className="bg-gray-800 px-2 py-1 rounded text-green-400">Alt + 7</kbd>
                  </div>
                </div>
                <div className="bg-red-900/20 border border-red-800/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-5 h-5 text-red-400" />
                    <h5 className="font-semibold text-red-400">Reject</h5>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">Detection is incorrect</p>
                  <ul className="text-gray-400 text-xs space-y-1">
                    <li>• Discards detection</li>
                    <li>• Saves as negative example</li>
                    <li>• No logging occurs</li>
                  </ul>
                  <div className="mt-2 text-xs">
                    <kbd className="bg-gray-800 px-2 py-1 rounded text-red-400">Alt + 8</kbd>
                  </div>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-yellow-400" />
                    <h5 className="font-semibold text-yellow-400">Correct</h5>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">Wrong class detected</p>
                  <ul className="text-gray-400 text-xs space-y-1">
                    <li>• Opens class selector</li>
                    <li>• Re-labels detection</li>
                    <li>• Logs with correct class</li>
                  </ul>
                  <div className="mt-2 text-xs">
                    <kbd className="bg-gray-800 px-2 py-1 rounded text-yellow-400">Alt + 9</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Logging */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-purple-400" />
                <h4 className="font-semibold text-purple-400">Automatic Logging to Measurements</h4>
              </div>
              <p className="text-gray-300 mb-3">
                When AI detection is enabled and auto-logging is turned on, detected objects are automatically added to your measurement log:
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <h5 className="font-medium text-gray-200 mb-2">What Gets Logged:</h5>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong>Object Class:</strong> Detected object type (e.g., "Traffic Signal", "Tree Branch")</li>
                  <li>• <strong>Confidence Score:</strong> AI confidence percentage (0-100%)</li>
                  <li>• <strong>Clearance Height:</strong> Current laser measurement at detection time</li>
                  <li>• <strong>GPS Location:</strong> Precise coordinates where object was detected</li>
                  <li>• <strong>Timestamp:</strong> Exact date and time of detection</li>
                  <li>• <strong>Camera Image:</strong> Captured frame showing the detected object</li>
                  <li>• <strong>Video Clip:</strong> Short video buffer (if video mode enabled)</li>
                  <li>• <strong>Detection Metadata:</strong> Bounding box coordinates, detection ID</li>
                </ul>
              </div>
              <div className="bg-blue-900/20 border border-blue-800/30 rounded p-3 mt-3">
                <p className="text-blue-300 text-sm">
                  <strong>💡 Pro Tip:</strong> Enable auto-logging only for high-confidence detections ({'>'}70%) to reduce false positives in your logs.
                </p>
              </div>
            </div>

            {/* Clearance Alerts */}
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h4 className="font-semibold text-red-400">Clearance Alerts for Overhead Objects</h4>
              </div>
              <p className="text-gray-300 mb-3">
                MeasurePRO+ AI automatically monitors overhead objects and triggers alerts when clearances fall below safety thresholds:
              </p>
              <div className="space-y-3">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">How It Works:</h5>
                  <ol className="list-decimal list-inside text-gray-300 text-sm space-y-1">
                    <li>AI detects overhead object (traffic signal, power line, etc.)</li>
                    <li>System reads current laser measurement for clearance height</li>
                    <li>Compares clearance against your configured thresholds</li>
                    <li>Triggers appropriate alert level (Warning or Critical)</li>
                    <li>Plays alert sound and displays visual notification</li>
                    <li>Auto-logs violation with all relevant data</li>
                  </ol>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-yellow-900/20 border border-yellow-800/30 rounded p-3">
                    <h5 className="font-semibold text-yellow-400 mb-1">⚠️ Warning Alert</h5>
                    <p className="text-gray-300 text-sm">Triggered when overhead object is within warning threshold (e.g., 4.0m - 4.5m)</p>
                  </div>
                  <div className="bg-red-900/20 border border-red-800/30 rounded p-3">
                    <h5 className="font-semibold text-red-400 mb-1">🚨 Critical Alert</h5>
                    <p className="text-gray-300 text-sm">Triggered when overhead object is below critical threshold (e.g., {'<'}4.0m)</p>
                  </div>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">Configure Thresholds:</h5>
                  <p className="text-gray-300 text-sm">
                    Set your clearance thresholds in Settings → Alert Settings. Thresholds can be customized based on your specific requirements (vehicle height, load clearance, safety regulations).
                  </p>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Keyboard className="w-5 h-5 text-purple-400" />
                <h4 className="font-semibold text-purple-400">AI Detection Keyboard Shortcuts</h4>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                Speed up your workflow with these AI-specific keyboard shortcuts:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">Accept Detection</span>
                    <kbd className="bg-purple-900 text-purple-300 px-3 py-1 rounded" data-testid="kbd-accept-detection">Alt + 7</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">Confirms AI detection is correct and logs it</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">Reject Detection</span>
                    <kbd className="bg-purple-900 text-purple-300 px-3 py-1 rounded" data-testid="kbd-reject-detection">Alt + 8</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">Discards incorrect detection</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">Correct Detection</span>
                    <kbd className="bg-purple-900 text-purple-300 px-3 py-1 rounded" data-testid="kbd-correct-detection">Alt + 9</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">Re-classify detection to correct object type</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">Test Detection</span>
                    <kbd className="bg-purple-900 text-purple-300 px-3 py-1 rounded" data-testid="kbd-test-detection">Alt + 0</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">Trigger mock detection for testing</p>
                </div>
              </div>
            </div>

            {/* Beta Testing & Contact */}
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-purple-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-purple-300 mb-2">Join the Beta Program</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    MeasurePRO+ AI is currently in beta testing. Get early access, provide feedback, 
                    and help shape the future of AI-powered surveying technology.
                  </p>
                  <div className="bg-gray-800 rounded p-3 mb-3">
                    <h5 className="font-medium text-gray-200 mb-2">Beta Benefits:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Early access to cutting-edge AI features</li>
                      <li>• Discounted pricing during beta period</li>
                      <li>• Direct input on feature development</li>
                      <li>• Priority support from our AI team</li>
                      <li>• Custom model training assistance</li>
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-purple-400" />
                    <a 
                      href="mailto:sales@soltecinnovation.com?subject=MeasurePRO%2B%20AI%20Beta%20Access%20Request" 
                      className="text-purple-400 hover:text-purple-300 font-medium"
                      data-testid="link-ai-beta-help-contact"
                    >
                      sales@soltecinnovation.com
                    </a>
                  </div>
                  <p className="text-gray-400 text-xs mt-2">
                    Subject: "MeasurePRO+ AI Beta Access Request"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="envelope-clearance"
          title="Envelope Clearance Monitoring (Premium)"
          icon={<Truck className="w-6 h-6 text-orange-400" />}
        >
          <div className="space-y-4">
            {/* Premium Badge */}
            <div className="bg-gradient-to-r from-orange-900/40 to-red-900/40 border-2 border-orange-500 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Truck className="w-8 h-8 text-orange-400" />
                  <div>
                    <h4 className="text-xl font-bold text-orange-300">Vehicle Envelope Clearance System</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Sparkles className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-orange-400 font-semibold">Premium Add-On Feature • BETA</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-orange-400" data-testid="text-envelope-help-price">$250 USD</div>
                  <div className="text-sm text-gray-400">per month</div>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                Real-time vehicle clearance monitoring with visual and audio alerts for overhead obstacles. Designed for utility trucks, telecom vehicles, and bucket trucks operating under low-clearance conditions.
              </p>
              <div className="bg-orange-900/20 border border-orange-800/30 rounded p-3">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-orange-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-orange-300 font-medium">Contact your administrator to activate this premium feature</p>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Enable */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-orange-400 mb-3">How to Enable Envelope Clearance:</h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                  <div>
                    <p className="text-gray-300"><strong>Access Envelope Settings:</strong></p>
                    <p className="text-gray-400 text-sm">Navigate to Settings (⚙️ icon) → Envelope tab</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                  <div>
                    <p className="text-gray-300"><strong>Contact Administrator:</strong></p>
                    <p className="text-gray-400 text-sm">Your administrator will activate your premium subscription. Features become available automatically when subscription is valid.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                  <div>
                    <p className="text-gray-300"><strong>Select Vehicle Profile:</strong></p>
                    <p className="text-gray-400 text-sm">Choose from pre-configured profiles or create a custom one</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">4</span>
                  <div>
                    <p className="text-gray-300"><strong>Enable Monitoring:</strong></p>
                    <p className="text-gray-400 text-sm">Toggle "Enable Envelope Monitoring" to activate real-time clearance tracking</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hardware Options & Accuracy */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-orange-400 mb-3">📷 Hardware Options & Accuracy Comparison:</h4>
              <p className="text-gray-300 text-sm mb-4">
                Choose from three hardware options for Envelope Clearance Monitoring, each offering different levels of accuracy and pricing:
              </p>
              <div className="space-y-3">
                {/* ZED 2i - RECOMMENDED */}
                <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-2 border-green-500 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        ✓ RECOMMENDED
                      </div>
                      <h5 className="font-bold text-green-300 text-lg">ZED 2i Stereo Camera</h5>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">$1,500</div>
                      <div className="text-xs text-gray-400">one-time fee</div>
                    </div>
                  </div>
                  <div className="bg-green-900/30 border border-green-700 rounded p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Accuracy Variance:</span>
                      <span className="text-lg font-bold text-green-400">5-6%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full flex items-center justify-end pr-2" style={{width: '94%'}}>
                        <span className="text-xs text-white font-semibold">Best Precision</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <h6 className="font-semibold text-green-300 mb-1">Key Features:</h6>
                      <ul className="text-gray-300 text-xs space-y-0.5">
                        <li>• Wide-angle depth sensing</li>
                        <li>• AI-powered spatial perception</li>
                        <li>• Dual RGB sensors (110° FOV)</li>
                        <li>• Neural depth engine</li>
                        <li>• Integrated IMU/barometer</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="font-semibold text-green-300 mb-1">Best For:</h6>
                      <ul className="text-gray-300 text-xs space-y-0.5">
                        <li>• Precision clearance monitoring</li>
                        <li>• Professional operations</li>
                        <li>• Compliance requirements</li>
                        <li>• High-accuracy needs</li>
                        <li>• Risk mitigation</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Included Camera */}
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-bold text-gray-300 text-lg">Included Camera with LiDAR</h5>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">$0</div>
                      <div className="text-xs text-gray-400">no additional fee</div>
                    </div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Accuracy Variance:</span>
                      <span className="text-lg font-bold text-yellow-400">15-20%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div className="bg-yellow-500 h-3 rounded-full flex items-center justify-end pr-2" style={{width: '82.5%'}}>
                        <span className="text-xs text-white font-semibold">Standard Precision</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <h6 className="font-semibold text-gray-300 mb-1">Key Features:</h6>
                      <ul className="text-gray-400 text-xs space-y-0.5">
                        <li>• Standard camera included</li>
                        <li>• Works with existing LiDAR</li>
                        <li>• Basic clearance monitoring</li>
                        <li>• No hardware investment</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="font-semibold text-gray-300 mb-1">Best For:</h6>
                      <ul className="text-gray-400 text-xs space-y-0.5">
                        <li>• Budget-conscious operations</li>
                        <li>• Lower-risk routes</li>
                        <li>• Trial/evaluation period</li>
                        <li>• General awareness</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 3 Directions LiDAR */}
                <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border-2 border-purple-500 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-bold text-purple-300 text-lg">3 Directions LiDAR (Ultra-Precision)</h5>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">Contact Sales</div>
                      <div className="text-xs text-gray-400">custom quote</div>
                    </div>
                  </div>
                  <div className="bg-purple-900/30 border border-purple-700 rounded p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Accuracy:</span>
                      <span className="text-lg font-bold text-purple-400">1/4" Precision</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div className="bg-purple-500 h-3 rounded-full flex items-center justify-end pr-2" style={{width: '99%'}}>
                        <span className="text-xs text-white font-semibold">Ultra-Precision</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <h6 className="font-semibold text-purple-300 mb-1">Key Features:</h6>
                      <ul className="text-gray-300 text-xs space-y-0.5">
                        <li>• Professional-grade accuracy</li>
                        <li>• Three-directional LiDAR</li>
                        <li>• Maximum precision (1/4")</li>
                        <li>• Enterprise solution</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="font-semibold text-purple-300 mb-1">Best For:</h6>
                      <ul className="text-gray-300 text-xs space-y-0.5">
                        <li>• Critical infrastructure</li>
                        <li>• High-value operations</li>
                        <li>• Strict compliance needs</li>
                        <li>• Zero-tolerance scenarios</li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-purple-900/20 border border-purple-700 rounded p-3 mt-3">
                    <p className="text-gray-300 text-sm mb-2">
                      <strong className="text-purple-300">Enterprise-Grade Solution:</strong> Contact our sales team for a custom quote based on your specific requirements.
                    </p>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-400" />
                      <a 
                        href="mailto:sales@soltecinnovation.com?subject=3%20Directions%20LiDAR%20Quote%20Request" 
                        className="text-purple-400 hover:text-purple-300 font-medium underline"
                        data-testid="link-3d-lidar-quote"
                      >
                        sales@soltecinnovation.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Profiles */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-orange-400 mb-3">25 Industry-Standard OS/OW Vehicle Profiles:</h4>
              <p className="text-gray-300 text-sm mb-4">
                MeasurePRO includes 25 comprehensive OS/OW (Oversize/Overweight) vehicle profiles with complete specifications. You can also create unlimited custom profiles for your specific fleet:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-semibold text-orange-400 mb-2">Standard Trailers</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• 5-axle flatbed</li>
                    <li>• Step deck configurations</li>
                    <li>• Complete dimensions & specs</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-semibold text-orange-400 mb-2">Lowboy/RGN</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• 2-12 axle configurations</li>
                    <li>• Heavy equipment transport</li>
                    <li>• Weight capacity tracking</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-semibold text-orange-400 mb-2">Specialized Equipment</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Perimeter/beam (7-13 axles)</li>
                    <li>• Schnabel (13-19 axles)</li>
                    <li>• Modular (19-22 axles)</li>
                  </ul>
                </div>
              </div>
              <div className="bg-orange-900/20 border border-orange-800/30 rounded p-3">
                <h5 className="font-medium text-orange-300 mb-2">Enhanced Profile Fields:</h5>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Length, front/rear overhangs</li>
                  <li>• Cargo dimensions (optional)</li>
                  <li>• Weight capacity</li>
                  <li>• Axle configuration (2-22 axles)</li>
                  <li>• Custom vehicle specifications</li>
                </ul>
              </div>
            </div>

            {/* Clearance Thresholds */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-orange-400 mb-3">Configuring Clearance Thresholds:</h4>
              <p className="text-gray-300 mb-3">
                Set warning and critical thresholds to control when alerts are triggered:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <h5 className="font-semibold text-yellow-400">Warning Threshold</h5>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">Default: 0.5m (1.6ft) above vehicle height</p>
                  <p className="text-gray-400 text-xs">
                    Alert triggered when clearance falls between warning and critical thresholds. 
                    Visual yellow overlay + single audio alert.
                  </p>
                </div>
                <div className="bg-red-900/20 border border-red-800/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <h5 className="font-semibold text-red-400">Critical Threshold</h5>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">Default: 0.2m (0.7ft) above vehicle height</p>
                  <p className="text-gray-400 text-xs">
                    Alert triggered when clearance is dangerously low. 
                    Visual red flashing overlay + continuous audio alert until cleared.
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Overlay */}
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-5 h-5 text-green-400" />
                <h4 className="font-semibold text-green-400">Visual Clearance Overlay</h4>
              </div>
              <p className="text-gray-300 mb-3">
                When visual overlay is enabled, the camera feed displays color-coded clearance zones:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gray-800 p-3 rounded border-2 border-green-500">
                  <h5 className="font-semibold text-green-400 mb-1">🟢 SAFE</h5>
                  <p className="text-gray-300 text-sm">Green border when clearance {'>'} warning threshold</p>
                </div>
                <div className="bg-gray-800 p-3 rounded border-2 border-yellow-500">
                  <h5 className="font-semibold text-yellow-400 mb-1">🟡 WARNING</h5>
                  <p className="text-gray-300 text-sm">Yellow border when between critical and warning</p>
                </div>
                <div className="bg-gray-800 p-3 rounded border-2 border-red-500">
                  <h5 className="font-semibold text-red-400 mb-1">🔴 CRITICAL</h5>
                  <p className="text-gray-300 text-sm">Flashing red border when {'<'} critical threshold</p>
                </div>
              </div>
              <div className="bg-gray-800 p-3 rounded mt-3">
                <p className="text-gray-300 text-sm">
                  <strong>Measurement Display:</strong> The overlay shows real-time measurements in format:
                  <code className="bg-gray-700 px-2 py-1 rounded text-green-400 ml-2">15.2 ft (Envelope: 14.0 ft) - SAFE +1.2 ft</code>
                </p>
              </div>
            </div>

            {/* Violation Logging */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-orange-400" />
                <h4 className="font-semibold text-orange-400">Dual Violation Logging</h4>
              </div>
              <p className="text-gray-300 mb-3">
                When clearance violations occur, the system automatically logs detailed information to both the envelope store AND main measurement database for unified export:
              </p>
              <div className="bg-gray-800 p-3 rounded mb-3">
                <h5 className="font-medium text-gray-200 mb-2">What Gets Logged:</h5>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong>Severity Level:</strong> Warning or Critical violation status</li>
                  <li>• <strong>Measurement:</strong> Exact clearance height at time of violation</li>
                  <li>• <strong>Vehicle Profile:</strong> Active vehicle envelope configuration with axle details</li>
                  <li>• <strong>GPS Coordinates:</strong> Precise location where violation occurred</li>
                  <li>• <strong>Timestamp:</strong> Exact date and time of violation</li>
                  <li>• <strong>Object Detection:</strong> If AI+ enabled, detected overhead object type</li>
                  <li>• <strong>Camera Photo:</strong> Captured image showing the violation (if camera active)</li>
                </ul>
              </div>
              <div className="bg-orange-900/20 border border-orange-800/30 rounded p-3">
                <p className="text-orange-300 text-sm">
                  <strong>📊 Unified Export:</strong> Violations are logged to both envelope store and main measurement log, allowing you to export all data together in CSV, GeoJSON, or ZIP formats.
                </p>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Keyboard className="w-5 h-5 text-orange-400" />
                <h4 className="font-semibold text-orange-400">Envelope Clearance Keyboard Shortcuts</h4>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                Quick access to envelope clearance controls:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">Toggle Envelope Monitoring</span>
                    <kbd className="bg-orange-900 text-orange-300 px-3 py-1 rounded" data-testid="kbd-toggle-envelope">Alt + Shift + E</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">Quickly enable/disable clearance monitoring</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">Cycle Vehicle Profiles</span>
                    <kbd className="bg-orange-900 text-orange-300 px-3 py-1 rounded" data-testid="kbd-cycle-profile">Alt + Shift + P</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">Switch between configured vehicle profiles</p>
                </div>
              </div>
            </div>

            {/* Beta Testing & Contact */}
            <div className="bg-orange-900/20 border border-orange-800/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-orange-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-300 mb-2">Beta Feature - Early Access</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    Envelope Clearance Monitoring is currently in beta testing. We're actively collecting feedback 
                    from utility and telecom operators to improve accuracy and usability.
                  </p>
                  <div className="bg-gray-800 rounded p-3 mb-3">
                    <h5 className="font-medium text-gray-200 mb-2">Beta Benefits:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Early access to clearance monitoring technology</li>
                      <li>• Direct feedback channel to engineering team</li>
                      <li>• Custom profile configuration assistance</li>
                      <li>• Priority support for beta testers</li>
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-orange-400" />
                    <a 
                      href="mailto:sales@soltecinnovation.com?subject=Envelope%20Clearance%20Beta%20Access%20Request" 
                      className="text-orange-400 hover:text-orange-300 font-medium"
                      data-testid="link-envelope-beta-help-contact"
                    >
                      sales@soltecinnovation.com
                    </a>
                  </div>
                  <p className="text-gray-400 text-xs mt-2">
                    Subject: "Envelope Clearance Beta Access Request"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="swept-path-analysis"
          title="Swept Path Analysis & Turn Prediction (Premium - $450/month)"
          icon={<Route className="w-6 h-6 text-yellow-400" />}
        >
          <div className="space-y-4">
            {/* Premium Badge */}
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-2 border-purple-500 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Route className="w-8 h-8 text-purple-400" />
                  <div>
                    <h4 className="text-xl font-bold text-purple-300">Swept Path Analysis System</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-400 font-semibold">Premium Add-On Feature • $450/month</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-400" data-testid="text-swept-path-help-price">$450 USD</div>
                  <div className="text-sm text-gray-400">per month</div>
                </div>
              </div>

              <p className="text-gray-300 mb-3">
                AI-powered swept path simulation for oversized vehicles. Analyze turns before attempting them, 
                predict vehicle envelope tracking, and receive real-time collision warnings.
              </p>

              {/* Dependency Notice */}
              <div className="bg-purple-900/30 border border-purple-700 rounded p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Truck className="w-4 h-4 text-purple-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-purple-300 font-medium mb-1">⚠️ Requires Envelope Clearance Add-On</p>
                    <p className="text-gray-300">
                      Swept Path Analysis uses the 25 OS/OW vehicle profiles from Envelope Clearance. 
                      You must activate Envelope Clearance before enabling this feature.
                    </p>
                  </div>
                </div>
              </div>

              {/* Activation */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-purple-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-purple-300 font-medium">Contact your administrator to activate this premium feature</p>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Enable */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-purple-400 mb-3">How to Enable Swept Path Analysis:</h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                  <div>
                    <p className="text-gray-300"><strong>Enable Envelope Clearance First:</strong></p>
                    <p className="text-gray-400 text-sm">Navigate to Envelope tab and activate with password</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                  <div>
                    <p className="text-gray-300"><strong>Access Swept Path Settings:</strong></p>
                    <p className="text-gray-400 text-sm">Navigate to Settings → Swept Path tab</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                  <div>
                    <p className="text-gray-300"><strong>Enter Subscription Password:</strong></p>
                    <p className="text-gray-400 text-sm">Toggle "Enable Swept Path Analysis" and enter password when prompted</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">4</span>
                  <div>
                    <p className="text-gray-300"><strong>Select Vehicle Profile:</strong></p>
                    <p className="text-gray-400 text-sm">Choose from 25 OS/OW vehicle profiles with your vehicle configuration</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">5</span>
                  <div>
                    <p className="text-gray-300"><strong>Analyze Turns:</strong></p>
                    <p className="text-gray-400 text-sm">Click "Analyze Turn" button in camera view to run simulation</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Features */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-purple-400 mb-3">Key Features:</h4>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-purple-400 mt-0.5" />
                  <span><strong>AI Road Detection:</strong> OpenCV.js edge detection identifies road boundaries from camera feed</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-purple-400 mt-0.5" />
                  <span><strong>Multi-Segment Vehicle Modeling:</strong> Accurate tractor, jeep, trailer, and steerable dolly simulation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-purple-400 mt-0.5" />
                  <span><strong>Turn Simulation:</strong> Animated swept path with off-tracking calculation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-purple-400 mt-0.5" />
                  <span><strong>Collision Detection:</strong> Real-time collision markers showing exact contact points</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-purple-400 mt-0.5" />
                  <span><strong>Color-Coded Clearances:</strong> Green (Safe) → Yellow (Caution) → Orange (Warning) → Red (Critical/Collision)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-purple-400 mt-0.5" />
                  <span><strong>Analysis History:</strong> Save and review past turn analyses with thumbnails and verdicts</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-purple-400 mt-0.5" />
                  <span><strong>Animation Playback:</strong> Keyboard shortcuts (Space, ←/→, Home/End) for frame-by-frame review</span>
                </li>
              </ul>
            </div>

            {/* How It Works */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-purple-400 mb-3">How It Works:</h4>
              <ol className="list-decimal ml-5 space-y-2 text-gray-300">
                <li><strong>Capture Frame:</strong> System captures current camera view with road scene</li>
                <li><strong>Detect Boundaries:</strong> AI identifies left and right road edges using edge detection</li>
                <li><strong>Model Vehicle:</strong> Builds multi-segment vehicle from your selected profile</li>
                <li><strong>Simulate Turn:</strong> Calculates swept path with articulation and off-tracking physics</li>
                <li><strong>Check Clearances:</strong> Compares vehicle envelope against road boundaries at each simulation step</li>
                <li><strong>Display Results:</strong> Shows color-coded overlay with verdict (Feasible/Tight/Impossible)</li>
                <li><strong>Save to History:</strong> Stores analysis with thumbnail for future reference</li>
              </ol>
            </div>

            {/* Contact */}
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-purple-300 mb-1">Get Started with Swept Path Analysis</h5>
                  <p className="text-gray-300 text-sm mb-2">
                    Contact our sales team to add Swept Path Analysis to your MeasurePRO subscription.
                  </p>
                  <a 
                    href="mailto:sales@soltecinnovation.com?subject=Swept%20Path%20Analysis%20Add-On%20Request" 
                    className="text-purple-400 hover:text-purple-300 font-medium"
                    data-testid="link-swept-path-help-contact"
                  >
                    sales@soltecinnovation.com
                  </a>
                  <p className="text-gray-400 text-xs mt-2">
                    Subject: "Swept Path Analysis Add-On Request"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="convoy-guardian"
          title="Convoy Guardian (Premium - $650/month)"
          icon={<Shield className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-700/40 border-2 border-blue-500 rounded-xl p-6">
              <h4 className="text-2xl font-bold text-white mb-3">World's First Black Box for Oversized Convoy Operations</h4>
              <p className="text-gray-300 mb-4">
                Convoy Guardian is the world's first black box system specifically designed for oversized load transport. 
                It enables real-time coordination between lead vehicles, police escorts, pilot cars, utility bucket trucks, 
                dispatchers, safety officers, and customers. Complete audit trail with GPS tracking, video evidence, and 
                comprehensive event logging for compliance and incident investigation.
              </p>
              
              <div className="bg-blue-800 rounded p-4 mb-4">
                <div className="text-2xl font-bold text-white mb-2">$650 USD/month</div>
                <div className="text-blue-200">
                  Up to 3 simultaneous convoys + $55/month per additional convoy
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">How It Works</h4>
              <ol className="list-decimal ml-5 space-y-2 text-gray-300">
                <li><strong>Leader Creates Session:</strong> Generate a unique QR code for your convoy</li>
                <li><strong>Team Members Join:</strong> Scan the QR code and identify yourself (name, role, vehicle ID)</li>
                <li><strong>Real-Time Monitoring:</strong> Followers receive live clearance measurements and alerts</li>
                <li><strong>Black Box Logging:</strong> Every event is logged with GPS, speed, altitude, and timestamps</li>
                <li><strong>Video Evidence:</strong> Automatic video capture on alerts with before/after footage</li>
              </ol>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">Multi-Stakeholder Monitoring</h4>
              <p className="text-gray-300 mb-3">
                All team members and stakeholders can follow convoy status in real-time:
              </p>
              <ul className="list-disc ml-5 space-y-1 text-gray-300">
                <li>🚗 Pilot Car - Lead vehicle with laser measurements and clearance monitoring</li>
                <li>🚔 Police Escort - Front or rear escort vehicles for traffic control</li>
                <li>🏗️ Public Utility Bucket Trucks - Support vehicles with equipment for overhead clearance</li>
                <li>📦 Oversized Load - The cargo vehicle being escorted through route</li>
                <li>🚙 Chase Vehicle - Following vehicle for rear monitoring</li>
                <li>📱 Dispatchers - Office staff monitoring convoy progress remotely</li>
                <li>⚠️ Safety Officers - Safety personnel tracking compliance and alerts</li>
                <li>👥 Customers - Clients receiving real-time status updates on their shipment</li>
              </ul>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">Emergency Protocols</h4>
              <div className="bg-red-900/30 border border-red-500 rounded p-4">
                <p className="font-semibold text-red-300 mb-2">Leader Signal Loss (5-minute timeout):</p>
                <ol className="list-decimal ml-5 space-y-1 text-red-200">
                  <li>All followers receive immediate visual + audible alert</li>
                  <li>Full-screen STOP CONVOY emergency message</li>
                  <li>Action checklist displayed (stop, call leader, do not proceed)</li>
                  <li>Event logged with last known position and measurement</li>
                </ol>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">Black Box Logging</h4>
              <p className="text-gray-300 mb-2">Complete audit trail for incident investigation and compliance:</p>
              <ul className="list-disc ml-5 space-y-1 text-gray-300">
                <li>Session start/end with configuration details</li>
                <li>All member joins/disconnects with timestamps</li>
                <li>Every alert with measurement, GPS, speed, altitude</li>
                <li>Leader signal loss events</li>
                <li>Video and image evidence linked to alerts</li>
                <li>Export options: PDF summary, CSV data, JSON, ZIP package</li>
              </ul>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-500 rounded p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-300 mb-2">
                    IMPORTANT SAFETY NOTICE
                  </p>
                  <p className="text-yellow-200">
                    Convoy Guardian is an ADDITIONAL layer of safety and does NOT replace 
                    physical high pole procedures. Always follow standard safety protocols 
                    for convoy operations.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">Pricing Details</h4>
              <ul className="list-disc ml-5 text-gray-300 space-y-1">
                <li>$650 USD/month - Up to 3 simultaneous convoys</li>
                <li>$55 USD/month - Each additional concurrent convoy</li>
                <li>Includes unlimited team members per convoy</li>
                <li>Complete black box logging and video evidence</li>
                <li>Emergency alerting and safety protocols</li>
                <li>Multi-stakeholder real-time monitoring</li>
                <li>Export and reporting capabilities</li>
              </ul>
            </div>

            <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4">
              <h4 className="font-semibold text-purple-300 mb-3">🚀 Coming in 2026: Off-Route Notifications</h4>
              <p className="text-gray-300 mb-2">
                Advanced route compliance monitoring feature launching in 2026:
              </p>
              <ul className="list-disc ml-5 text-gray-300 space-y-1">
                <li>Automated detection when convoy deviates from permitted route</li>
                <li>Instant alerts sent to all convoy team members</li>
                <li>Notifications delivered to dispatch office</li>
                <li>GPS track recording of off-route segments</li>
                <li>Integration with route permits and compliance documentation</li>
                <li>Helps maintain permit compliance and safety protocols</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          id="route-enforcement"
          title="Permitted Route Enforcement (Premium - BETA)"
          icon={<Navigation className="w-6 h-6 text-green-400" />}
        >
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-900/40 to-green-700/40 border-2 border-green-500 rounded-xl p-6">
              <h4 className="text-2xl font-bold text-white mb-3">GPS-Enforced Route Compliance System</h4>
              <p className="text-gray-300 mb-4">
                GPS-enforced route compliance for oversized and permitted loads. Ensures drivers stay on approved routes with real-time monitoring, automated off-route detection, and full-screen STOP warnings requiring dispatch clearance.
              </p>
              
              <div className="bg-green-800 rounded p-4 mb-4">
                <div className="text-2xl font-bold text-white mb-2">$350 USD/month</div>
                <div className="text-green-200">
                  Includes 3 convoys + $55/month per additional convoy
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">🔑 Accessing the System</h4>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-green-400 mb-2">1. Enable Feature (Settings)</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• Click the <strong>"Route"</strong> tab in main Settings (green Navigation icon)</li>
                    <li>• Toggle "Enable Permitted Route Enforcement"</li>
                    <li>• Contact administrator for access</li>
                    <li>• Configure default thresholds and behavior</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-blue-400 mb-2">2. Dispatch Console</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• Navigate to: <code className="bg-gray-900 px-2 py-1 rounded text-xs">/route-enforcement/dispatch</code></li>
                    <li>• Create convoys, upload routes, generate QR codes</li>
                    <li>• Manage all active and completed convoys</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-purple-400 mb-2">3. Dispatch Live View</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• From console, click "Start Monitoring" on any convoy</li>
                    <li>• Or navigate to: <code className="bg-gray-900 px-2 py-1 rounded text-xs">/route-enforcement/live/:convoyId</code></li>
                    <li>• Monitor real-time compliance, manage incidents</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-yellow-400 mb-2">4. Driver Interface</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• Navigate to: <code className="bg-gray-900 px-2 py-1 rounded text-xs">/route-enforcement/driver</code></li>
                    <li>• Scan QR code OR enter token manually to join</li>
                    <li>• View route, buffer zone, and compliance status</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">📋 Complete Workflow</h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-medium text-white">Dispatch: Create Convoy</p>
                    <p className="text-gray-300 text-sm">Upload GPX route, set environment (rural/urban), configure thresholds</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-medium text-white">Dispatch: Generate QR Code</p>
                    <p className="text-gray-300 text-sm">Display QR code or share token with drivers for enrollment</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                  <div>
                    <p className="font-medium text-white">Driver: Join Convoy</p>
                    <p className="text-gray-300 text-sm">Scan QR code, enter details (name, role, vehicle ID, phone), join convoy</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                  <div>
                    <p className="font-medium text-white">Dispatch: Monitor Live View</p>
                    <p className="text-gray-300 text-sm">Watch real-time position, buffer zones, and compliance status</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                  <div>
                    <p className="font-medium text-white">System: Detect Off-Route</p>
                    <p className="text-gray-300 text-sm">After 7 seconds off-route, incident created, STOP modal triggered</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="bg-yellow-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">6</span>
                  <div>
                    <p className="font-medium text-white">Dispatch: Acknowledge & Clear</p>
                    <p className="text-gray-300 text-sm">Acknowledge incident, contact driver, clear when safe to proceed</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">Map Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-gray-300">On Route - Vehicle within permitted corridor</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-300">Warning - Approaching buffer edge (80% threshold)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="text-gray-300">Violation - Outside permitted route</span>
                </div>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-red-300 mb-3">STOP Modal Handling</h4>
              <p className="text-gray-300 mb-2">
                When a driver goes off-route, a full-screen STOP modal is triggered:
              </p>
              <ul className="list-disc ml-5 text-gray-300 space-y-1">
                <li>Cannot be dismissed by driver - only dispatch can clear</li>
                <li>Loud audible warning alerts driver immediately</li>
                <li>Shows distance off-route and incident details</li>
                <li>"Call Dispatch" button for immediate contact</li>
                <li>Driver must wait for dispatch clearance before proceeding</li>
              </ul>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">⚙️ Detection Algorithm & Thresholds</h4>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-blue-400 mb-2">GPS Requirements</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• Max GPS accuracy: <strong>15 meters</strong> (fixes with worse accuracy rejected)</li>
                    <li>• Updates: Every 1-2 seconds for real-time tracking</li>
                    <li>• Browser GPS fallback if hardware GPS unavailable</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-green-400 mb-2">Deviation Thresholds</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• Rural routes: <strong>30 meters</strong> buffer zone</li>
                    <li>• Urban routes: <strong>15 meters</strong> buffer zone</li>
                    <li>• Configurable per convoy based on road conditions</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-yellow-400 mb-2">Persistence Logic</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• Violation must persist for <strong>7 seconds</strong> before triggering</li>
                    <li>• Prevents false alarms from GPS drift or brief detours</li>
                    <li>• Timer resets if driver returns within buffer zone</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded p-3">
                  <p className="font-medium text-purple-400 mb-2">Distance Calculation</p>
                  <ul className="ml-5 text-gray-300 text-sm space-y-1">
                    <li>• Uses perpendicular distance to route polyline</li>
                    <li>• Not simple point-to-point distance</li>
                    <li>• Accounts for route curves and turns accurately</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">📱 Dispatch Console Features</h4>
              <ul className="list-disc ml-5 text-gray-300 space-y-2">
                <li><strong>Create Convoy:</strong> Upload GPX route file (from GPS device, Google Maps, or route planning software)</li>
                <li><strong>Environment Type:</strong> Select Rural (30m buffer) or Urban (15m buffer) based on road type</li>
                <li><strong>QR Code Generation:</strong> Automatically generated secure token for driver enrollment</li>
                <li><strong>Convoy Management:</strong> View all active and completed convoys, member counts, status</li>
                <li><strong>Start Monitoring:</strong> Launch Live View to watch convoy in real-time</li>
              </ul>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">🖥️ Dispatch Live View Features</h4>
              <ul className="list-disc ml-5 text-gray-300 space-y-2">
                <li><strong>Route Visualization:</strong> Blue polyline showing permitted route on map</li>
                <li><strong>Buffer Zone:</strong> Color-coded corridor (green/yellow/red) around route</li>
                <li><strong>Vehicle Tracking:</strong> Real-time position markers for all convoy members</li>
                <li><strong>Member List:</strong> Names, roles, status, distance from route for each driver</li>
                <li><strong>Incident Queue:</strong> All off-route violations requiring attention</li>
                <li><strong>Acknowledge:</strong> Mark incident as acknowledged (notifies driver you're aware)</li>
                <li><strong>Clear:</strong> Dismiss STOP modal after driver corrects violation</li>
                <li><strong>Direct Contact:</strong> Click phone numbers to call drivers immediately</li>
              </ul>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">🚗 Driver Interface Features</h4>
              <ul className="list-disc ml-5 text-gray-300 space-y-2">
                <li><strong>Join via QR:</strong> Scan code with phone camera for instant enrollment</li>
                <li><strong>Manual Join:</strong> Enter token manually if QR scan unavailable</li>
                <li><strong>Route Map:</strong> See entire permitted route with your position</li>
                <li><strong>Buffer Visualization:</strong> Color-coded buffer zone shows compliance status</li>
                <li><strong>Status Indicators:</strong> On-Route (green), Warning (yellow), Off-Route (red)</li>
                <li><strong>Distance Display:</strong> Shows distance from route in real-time</li>
                <li><strong>Turn-by-Turn:</strong> Optional navigation guidance along route</li>
                <li><strong>STOP Modal:</strong> Full-screen warning if off-route for 7+ seconds</li>
              </ul>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-300 mb-3">Offline Behavior</h4>
              <p className="text-gray-300 mb-2">
                Route enforcement continues to work offline with limitations:
              </p>
              <ul className="list-disc ml-5 text-gray-300 space-y-1">
                <li>Off-route detection continues using local GPS</li>
                <li>STOP modal triggers normally for violations</li>
                <li>Incidents queued for sync when connection restored</li>
                <li>Dispatch clearance requires internet connection</li>
                <li>Live View unavailable without connection</li>
              </ul>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">Pricing Details</h4>
              <ul className="list-disc ml-5 text-gray-300 space-y-1">
                <li>$350 USD/month - Includes 3 active convoys</li>
                <li>$55 USD/month - Each additional convoy slot</li>
                <li>GPS tracking with buffer zone visualization</li>
                <li>Automated off-route detection and alerts</li>
                <li>Dispatch console with live monitoring</li>
                <li>Full STOP modal enforcement</li>
                <li>Incident logging and compliance reporting</li>
              </ul>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-500 rounded p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-300 mb-2">IMPORTANT COMPLIANCE NOTICE</p>
                  <p className="text-yellow-200">
                    Route Enforcement is a monitoring tool and does NOT replace legal permits or route approvals. 
                    Always obtain proper permits and follow all local regulations for oversized loads.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="device-manager"
          title="Finding COM Ports in Device Manager"
          icon={<Monitor className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h4 className="font-semibold text-yellow-400">Important Note</h4>
              </div>
              <p className="text-gray-300">
                Web browsers cannot directly access COM ports by name (COM3, COM8, etc.). 
                However, knowing your COM port numbers helps you identify the correct device when the browser asks for permission.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-blue-400">Step-by-Step Instructions:</h4>
              
              <div className="space-y-3">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                    <h5 className="font-medium">Open Device Manager</h5>
                  </div>
                  <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                    <li>• Press <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Windows + X</kbd></li>
                    <li>• Select "Device Manager" from the menu</li>
                    <li>• Or search "Device Manager" in the Start menu</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                    <h5 className="font-medium">Locate COM Ports</h5>
                  </div>
                  <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                    <li>• Expand "Ports (COM & LPT)" section</li>
                    <li>• Look for your devices (e.g., "USB Serial Port (COM3)")</li>
                    <li>• Note the COM port numbers for your laser and GPS devices</li>
                    <li>• Right-click → Properties → Details → Hardware IDs to see VID/PID</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                    <h5 className="font-medium">Identify Your Devices</h5>
                  </div>
                  <div className="ml-8 grid grid-cols-2 gap-4">
                    <div>
                      <h6 className="font-medium text-green-400 mb-1">SolTec-30m:</h6>
                      <ul className="text-gray-300 text-xs space-y-1">
                        <li>• "FTDI USB Serial Port"</li>
                        <li>• VID: 0403, PID: 6001</li>
                        <li>• Usually COM3 or higher</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="font-medium text-blue-400 mb-1">GPS Module:</h6>
                      <ul className="text-gray-300 text-xs space-y-1">
                        <li>• "Prolific USB-to-Serial"</li>
                        <li>• "CH340 USB Serial"</li>
                        <li>• Various VID/PID combinations</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="laser-configuration"
          title="Laser Device Configuration"
          icon={<Zap className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-400 mb-4">Supported Laser Devices:</h4>
              <div className="space-y-4">
                <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
                  <h5 className="font-semibold text-green-400 mb-2">✅ SolTec-30m - Recommended</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h6 className="font-medium text-gray-200 mb-1">Configuration:</h6>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Baud Rate: 115200</li>
                        <li>• Data Bits: 8</li>
                        <li>• Parity: None</li>
                        <li>• Stop Bits: 1</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="font-medium text-gray-200 mb-1">Commands:</h6>
                      <ul className="text-gray-300 space-y-1">
                        <li>• DM - Single measurement</li>
                        <li>• DT - Continuous measurement</li>
                        <li>• ESC - Stop measurement</li>
                        <li>• LE/LD - Laser on/off</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-gray-800 rounded">
                    <p className="text-gray-300 text-sm">
                      <strong>Output Format:</strong> "D 0001.759" (measurement in meters)
                    </p>
                  </div>
                </div>
                
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
                  <h5 className="font-semibold text-yellow-400 mb-2">⚠️ SolTec-10m</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h6 className="font-medium text-gray-200 mb-1">Configuration:</h6>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Baud Rate: 19200</li>
                        <li>• Data Bits: 7</li>
                        <li>• Parity: Even</li>
                        <li>• Stop Bits: 1</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="font-medium text-gray-200 mb-1">Commands:</h6>
                      <ul className="text-gray-300 space-y-1">
                        <li>• s0g - Single measurement</li>
                        <li>• s0h - Continuous measurement</li>
                        <li>• s0c - Stop measurement</li>
                        <li>• s0o/s0p - Laser on/off</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-gray-800 rounded">
                    <p className="text-gray-300 text-sm">
                      <strong>Output Format:</strong> "1234.567" (measurement in millimeters)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-red-400" />
                <h4 className="font-semibold text-red-400">Ground Reference (GRND REF) - CRITICAL</h4>
              </div>
              <div className="space-y-3">
                <p className="text-gray-300">
                  The <strong>Ground Reference Height</strong> is the distance from the ground to the white "GRND REF" line on your laser device.
                </p>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">How to measure correctly:</h5>
                  <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                    <li>Place the laser device on the ground (flat, level surface)</li>
                    <li>Locate the white "GRND REF" line marked on the device housing</li>
                    <li>Using a ruler or tape measure, measure the vertical distance from the ground to this white line</li>
                    <li>Enter this measurement (in meters) in the "Ground Reference Height" field in Settings → Laser & GPS</li>
                    <li>This value will be automatically added to all laser measurements</li>
                  </ol>
                </div>
                <div className="bg-blue-800/20 p-3 rounded">
                  <p className="text-blue-300 text-sm">
                    <strong>Example:</strong> If the GRND REF line is 0.150m (15cm) above ground, enter 0.150 in the Ground Reference Height field.
                  </p>
                </div>
                <div className="bg-red-800/20 p-3 rounded">
                  <p className="text-red-300 text-sm">
                    <strong>Warning:</strong> Incorrect ground reference will result in inaccurate clearance measurements. Always verify this setting before starting surveys.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="gps-setup"
          title="GPS Setup & Vehicle Positioning"
          icon={<Navigation className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-400 mb-3">GPS Device Configuration:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Standard NMEA Settings:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>Baud Rate:</strong> 4800 (most common)</li>
                    <li>• <strong>Data Bits:</strong> 8</li>
                    <li>• <strong>Parity:</strong> None</li>
                    <li>• <strong>Stop Bits:</strong> 1</li>
                    <li>• <strong>Protocol:</strong> NMEA 0183</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Alternative Rates:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• 9600 baud (some modules)</li>
                    <li>• 19200 baud (high-precision)</li>
                    <li>• 38400 baud (rare)</li>
                    <li>• Check your GPS manual</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-green-400" />
                <h4 className="font-semibold text-green-400">GPS Antenna Positioning on Vehicle</h4>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-3 rounded">
                    <h5 className="font-medium text-green-400 mb-2">✅ Optimal Placement:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Center of vehicle roof</li>
                      <li>• Highest point possible</li>
                      <li>• Clear 360° view of sky</li>
                      <li>• Away from metal obstructions</li>
                      <li>• Secure, permanent mounting</li>
                      <li>• Weatherproof connections</li>
                    </ul>
                  </div>
                  <div className="bg-gray-800 p-3 rounded">
                    <h5 className="font-medium text-red-400 mb-2">❌ Avoid These Areas:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Near radio/cellular antennas</li>
                      <li>• Under roof racks or equipment</li>
                      <li>• Close to metal roof edges</li>
                      <li>• Inside the vehicle cabin</li>
                      <li>• Temporary or loose mounting</li>
                      <li>• Areas with limited sky view</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-blue-800/20 p-3 rounded">
                  <h5 className="font-medium text-blue-300 mb-2">Cable Routing Best Practices:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Use weatherproof cable entry points (rubber grommets)</li>
                    <li>• Secure cables with zip ties to prevent damage</li>
                    <li>• Keep GPS cable away from power cables (interference)</li>
                    <li>• Use ferrite cores if you experience interference</li>
                    <li>• Leave service loops for maintenance</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">GPS Failsafe Feature:</h4>
              <p className="text-gray-300 mb-3">
                MeasurePRO includes an intelligent GPS failsafe system:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Automatically uses browser GPS when serial GPS is unavailable</li>
                <li>• Switches back to serial GPS when it becomes available</li>
                <li>• Can be enabled/disabled in GPS Data card settings</li>
                <li>• Provides continuous positioning even with hardware issues</li>
                <li>• Shows GPS source (Serial/Browser) in the interface</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          id="web-serial"
          title="Web Serial API & Browser Compatibility"
          icon={<Terminal className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h4 className="font-semibold text-yellow-400">Web Serial vs Traditional COM Ports</h4>
              </div>
              <p className="text-gray-300 mb-3">
                Web browsers <strong>cannot</strong> directly access Windows COM ports by name. Instead, they use the Web Serial API which:
              </p>
              <ul className="text-gray-300 text-sm space-y-1 ml-4">
                <li>• Shows devices by their USB identifiers (VID/PID), not COM port names</li>
                <li>• Requires explicit user permission for each connection attempt</li>
                <li>• Only works in Chrome and Edge browsers</li>
                <li>• Cannot automatically reconnect to devices without user interaction</li>
                <li>• May conflict with other applications using the same device</li>
                <li>• Requires HTTPS or localhost to function</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-blue-400">Connection Process:</h4>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                  <h5 className="font-medium">Physical Connection</h5>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• Connect your laser device via USB cable</li>
                  <li>• Connect your GPS module via USB cable</li>
                  <li>• Ensure device drivers are properly installed</li>
                  <li>• Close any other applications that might be using these devices</li>
                  <li>• Verify devices appear in Windows Device Manager</li>
                </ul>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                  <h5 className="font-medium">Browser Permission Request</h5>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• In MeasurePRO, click the "Add Port" button</li>
                  <li>• Browser will display a device selection dialog</li>
                  <li>• Select your device from the list (identified by VID/PID, not COM name)</li>
                  <li>• Grant permission when prompted</li>
                  <li>• Look for permission dialogs that might be hidden behind other windows</li>
                </ul>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                  <h5 className="font-medium">Device Assignment</h5>
                </div>
                <ul className="ml-8 space-y-1 text-gray-300 text-sm">
                  <li>• Click "Set as Laser" for your laser distance meter</li>
                  <li>• Click "Set as GPS" for your GPS module</li>
                  <li>• Green status indicators show successful connections</li>
                  <li>• Test connection with "Single Measure" or "Temperature" commands</li>
                  <li>• Check that data appears in the measurement cards</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-red-400 mb-3">Troubleshooting Connection Issues:</h4>
              <div className="space-y-3">
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">If devices don't appear in browser dialog:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Check USB connections are secure</li>
                    <li>• Verify drivers are installed (check Device Manager)</li>
                    <li>• Try different USB ports</li>
                    <li>• Restart the browser</li>
                    <li>• Use Chrome or Edge browser</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">If permission is denied:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Check browser settings for blocked permissions</li>
                    <li>• Try incognito/private browsing mode</li>
                    <li>• Clear browser cache and cookies</li>
                    <li>• Ensure site is running on HTTPS or localhost</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">If connection fails after permission:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Use the "Reset" button to reset Web Serial connection</li>
                    <li>• Check baud rate settings match your device</li>
                    <li>• Verify no other applications are using the device</li>
                    <li>• Try the Serial Diagnostic tool for detailed testing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="measurement-workflow"
          title="Measurement Workflow"
          icon={<Ruler className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3">Complete Measurement Workflow:</h4>
              <ol className="list-decimal list-inside space-y-3 text-gray-300">
                <li>
                  <strong>Pre-Survey Setup:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Connect and test all devices</li>
                    <li>• Configure ground reference height</li>
                    <li>• Set safety thresholds</li>
                    <li>• Create survey with project details</li>
                  </ul>
                </li>
                <li>
                  <strong>Field Positioning:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Position vehicle under/near object</li>
                    <li>• Ensure GPS has clear sky view</li>
                    <li>• Wait for GPS fix (3+ satellites)</li>
                    <li>• Aim laser at lowest point of object</li>
                  </ul>
                </li>
                <li>
                  <strong>Taking Measurement:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Select appropriate POI type</li>
                    <li>• Wait for stable laser reading</li>
                    <li>• Click "Log Measurement" (Manual mode)</li>
                    <li>• Verify photo capture and GPS coordinates</li>
                    <li>• Add notes if necessary</li>
                  </ul>
                </li>
                <li>
                  <strong>Data Management:</strong>
                  <ul className="ml-6 mt-1 space-y-1 text-sm">
                    <li>• Review measurements in Activity Log</li>
                    <li>• Export data regularly (auto-save recommended)</li>
                    <li>• Sync to cloud for backup and team access</li>
                    <li>• Generate reports for clients</li>
                  </ul>
                </li>
              </ol>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Understanding the Measurement Cards:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Current Measure:</h5>
                  <p className="text-gray-300 text-sm">
                    Shows the live reading from your laser device. This updates in real-time as you aim the laser.
                  </p>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Last Measure:</h5>
                  <p className="text-gray-300 text-sm">
                    Displays the previous measurement with history. Useful for comparing readings.
                  </p>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Minimum Distance:</h5>
                  <p className="text-gray-300 text-sm">
                    Tracks the lowest measurement detected. Critical for clearance verification.
                  </p>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Height Settings:</h5>
                  <p className="text-gray-300 text-sm">
                    Shows your configured thresholds and ground reference. Quick access to key settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="poi-types"
          title="POI Types & Classification"
          icon={<MapPin className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <p className="text-gray-300">
              Points of Interest (POI) help categorize and organize your measurements for better analysis and reporting.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-blue-400/20 p-3 rounded-lg">
                  <h5 className="text-blue-400 font-medium mb-1">Bridge</h5>
                  <p className="text-gray-300 text-xs">Overpasses, underpasses, structural bridges</p>
                </div>
                <div className="bg-green-400/20 p-3 rounded-lg">
                  <h5 className="text-green-400 font-medium mb-1">Trees</h5>
                  <p className="text-gray-300 text-xs">Overhanging branches, tree canopies</p>
                </div>
                <div className="bg-yellow-400/20 p-3 rounded-lg">
                  <h5 className="text-yellow-400 font-medium mb-1">Wire</h5>
                  <p className="text-gray-300 text-xs">Utility wires, cables, communication lines</p>
                </div>
                <div className="bg-red-400/20 p-3 rounded-lg">
                  <h5 className="text-red-400 font-medium mb-1">Power Line</h5>
                  <p className="text-gray-300 text-xs">High voltage lines, electrical infrastructure</p>
                </div>
                <div className="bg-purple-400/20 p-3 rounded-lg">
                  <h5 className="text-purple-400 font-medium mb-1">Traffic Light</h5>
                  <p className="text-gray-300 text-xs">Traffic signals, overhead signs</p>
                </div>
                <div className="bg-orange-400/20 p-3 rounded-lg">
                  <h5 className="text-orange-400 font-medium mb-1">Walkway</h5>
                  <p className="text-gray-300 text-xs">Pedestrian bridges, overpasses</p>
                </div>
                <div className="bg-pink-400/20 p-3 rounded-lg">
                  <h5 className="text-pink-400 font-medium mb-1">Lateral Obstruction</h5>
                  <p className="text-gray-300 text-xs">Side obstacles, width restrictions</p>
                </div>
                <div className="bg-gray-400/20 p-3 rounded-lg">
                  <h5 className="text-gray-400 font-medium mb-1">Road</h5>
                  <p className="text-gray-300 text-xs">Road markers, mile markers, intersections</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-indigo-400/20 p-3 rounded-lg">
                  <h5 className="text-indigo-400 font-medium mb-1">Intersection</h5>
                  <p className="text-gray-300 text-xs">Road intersections, junctions</p>
                </div>
                <div className="bg-amber-400/20 p-3 rounded-lg">
                  <h5 className="text-amber-400 font-medium mb-1">Signalization</h5>
                  <p className="text-gray-300 text-xs">Road signs, overhead signage</p>
                </div>
                <div className="bg-slate-400/20 p-3 rounded-lg">
                  <h5 className="text-slate-400 font-medium mb-1">Railroad</h5>
                  <p className="text-gray-300 text-xs">Railway crossings, train infrastructure</p>
                </div>
                <div className="bg-cyan-400/20 p-3 rounded-lg">
                  <h5 className="text-cyan-400 font-medium mb-1">Information</h5>
                  <p className="text-gray-300 text-xs">Reference points, information markers</p>
                </div>
                <div className="bg-rose-400/20 p-3 rounded-lg">
                  <h5 className="text-rose-400 font-medium mb-1">Danger</h5>
                  <p className="text-gray-300 text-xs">Hazardous areas, safety concerns</p>
                </div>
                <div className="bg-emerald-400/20 p-3 rounded-lg">
                  <h5 className="text-emerald-400 font-medium mb-1">Important Note</h5>
                  <p className="text-gray-300 text-xs">Critical observations, special conditions</p>
                </div>
                <div className="bg-amber-400/20 p-3 rounded-lg">
                  <h5 className="text-amber-400 font-medium mb-1">Work Required</h5>
                  <p className="text-gray-300 text-xs">Areas needing maintenance or modification</p>
                </div>
                <div className="bg-red-400/20 p-3 rounded-lg">
                  <h5 className="text-red-400 font-medium mb-1">Restricted</h5>
                  <p className="text-gray-300 text-xs">Access restrictions, clearance limitations</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">POI Numbering System:</h4>
              <p className="text-gray-300 text-sm mb-2">
                MeasurePRO uses a structured numbering system for easy identification:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• <strong>Format:</strong> R001-00123 (Road 001, POI 00123)</li>
                <li>• <strong>Road Numbers:</strong> Sequential (R001, R002, R003...)</li>
                <li>• <strong>POI Numbers:</strong> Sequential within each road</li>
                <li>• <strong>Automatic Assignment:</strong> Numbers assigned automatically</li>
                <li>• <strong>Manual Override:</strong> Can be edited in Manual Log Entry</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          id="alerts-safety"
          title="Safety Alerts & Thresholds"
          icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
        >
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h4 className="font-semibold text-red-400">Critical Safety Configuration</h4>
              </div>
              <p className="text-gray-300 mb-3">
                Proper threshold configuration is essential for safe operations. Always configure these before starting field work.
              </p>
              
              <div className="space-y-3">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">Threshold Guidelines:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>Critical Threshold:</strong> Set to your load height + minimum safety margin (e.g., 4.0m for 3.8m load)</li>
                    <li>• <strong>Warning Threshold:</strong> Set higher than critical for early warning (e.g., 4.2m)</li>
                    <li>• <strong>Safety Margin:</strong> Account for vehicle bounce, load shift, measurement accuracy</li>
                    <li>• <strong>Regulatory Compliance:</strong> Follow local transportation authority requirements</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">Height Filtering:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>Minimum Height:</strong> Ignore readings below this (e.g., 0m to filter ground readings)</li>
                    <li>• <strong>Maximum Height:</strong> Ignore readings above this (e.g., 25m to filter sky readings)</li>
                    <li>• <strong>Purpose:</strong> Reduces noise and focuses on relevant obstacles</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-400 mb-3">Alert Types & Behavior:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-800/20 p-3 rounded">
                  <h5 className="font-medium text-yellow-400 mb-2">⚠️ Warning Alerts:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Orange visual banner</li>
                    <li>• Warning sound (configurable)</li>
                    <li>• Auto-clears after 15 seconds</li>
                    <li>• Can be manually cleared</li>
                    <li>• Indicates caution needed</li>
                  </ul>
                </div>
                <div className="bg-red-800/20 p-3 rounded">
                  <h5 className="font-medium text-red-400 mb-2">🚨 Critical Alerts:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Red visual banner</li>
                    <li>• Loud alarm sound (loops)</li>
                    <li>• Must be manually cleared</li>
                    <li>• Logged for safety records</li>
                    <li>• Indicates immediate danger</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Sound Configuration:</h4>
              <p className="text-gray-300 mb-3">
                Configure alert sounds in Settings → Alerts:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• <strong>Log Entry Sound:</strong> Confirmation when measurement is saved</li>
                <li>• <strong>Warning Sound:</strong> Plays when warning threshold is exceeded</li>
                <li>• <strong>Critical Sound:</strong> Plays when critical threshold is exceeded</li>
                <li>• <strong>Volume Control:</strong> Adjust volume for field conditions</li>
                <li>• <strong>Loop Options:</strong> Configure if sounds repeat until cleared</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          id="data-export"
          title="Data Export & File Management"
          icon={<FileText className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3">Export Formats:</h4>
              <div className="space-y-3">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">📊 CSV Export:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Spreadsheet-compatible format</li>
                    <li>• All measurement data with GPS coordinates</li>
                    <li>• Image and video filename mapping</li>
                    <li>• Perfect for Excel analysis</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">🗺️ GeoJSON Export:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Geographic format for GIS software</li>
                    <li>• Compatible with QGIS, ArcGIS, Google Earth</li>
                    <li>• Includes all measurement properties</li>
                    <li>• Spatial analysis ready</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">📦 Complete Package (ZIP):</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• All data formats included</li>
                    <li>• All images and videos</li>
                    <li>• Image mapping files</li>
                    <li>• Survey metadata and README</li>
                    <li>• Perfect for client delivery</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">File Naming Convention:</h4>
              <p className="text-gray-300 mb-3">
                MeasurePRO uses a structured naming system for easy organization:
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong>Images:</strong> image_R001_POI00123_bridge_abc12345.jpg</li>
                  <li>• <strong>Videos:</strong> video_R001_POI00123_bridge_abc12345.webm</li>
                  <li>• <strong>Drawings:</strong> drawing_R001_POI00123_bridge_abc12345.png</li>
                  <li>• <strong>Format:</strong> [type]_[road]_POI[number]_[poitype]_[id].[ext]</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-purple-400 mb-3">Auto-Save & Backup:</h4>
              <p className="text-gray-300 mb-3">
                Protect your work with automatic saving:
              </p>
              <div className="space-y-2">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-1">Configuration (Settings → Logging):</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Enable automatic saving</li>
                    <li>• Set interval (1-30 minutes)</li>
                    <li>• Choose to include images</li>
                    <li>• Set custom filename</li>
                  </ul>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-1">Benefits:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Protects against browser crashes</li>
                    <li>• Regular backup of work progress</li>
                    <li>• No data loss if device fails</li>
                    <li>• Automatic file organization</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="troubleshooting"
          title="Troubleshooting & Common Issues"
          icon={<Settings className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-red-400 mb-3">Device Connection Issues:</h4>
              <div className="space-y-3">
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Devices not appearing in browser dialog:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Check USB connections are secure</li>
                    <li>• Verify drivers are installed (Device Manager)</li>
                    <li>• Try different USB ports</li>
                    <li>• Restart browser</li>
                    <li>• Use Chrome or Edge browser only</li>
                    <li>• Ensure site is HTTPS or localhost</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Permission denied errors:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Check browser settings for blocked permissions</li>
                    <li>• Try incognito/private browsing mode</li>
                    <li>• Clear browser cache and cookies</li>
                    <li>• Look for permission dialogs that might be hidden</li>
                    <li>• Disable browser extensions that might interfere</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Connected but no data:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Verify baud rate settings match your device</li>
                    <li>• Check device type selection (Jenoptik vs SolTec)</li>
                    <li>• Use Serial Diagnostic tool for testing</li>
                    <li>• Try the "Reset" button to restart connection</li>
                    <li>• Ensure no other applications are using the device</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-400 mb-3">GPS Issues:</h4>
              <div className="space-y-2">
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">No GPS fix (coordinates showing 0.000000):</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Ensure GPS antenna has clear view of sky</li>
                    <li>• Wait for satellite acquisition (can take 1-5 minutes)</li>
                    <li>• Check GPS antenna connections</li>
                    <li>• Enable GPS failsafe to use browser location</li>
                    <li>• Move away from tall buildings or structures</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Poor GPS accuracy:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Wait for more satellites (4+ recommended)</li>
                    <li>• Check HDOP value (lower is better)</li>
                    <li>• Improve antenna positioning</li>
                    <li>• Consider DGPS correction if available</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Camera Problems:</h4>
              <div className="space-y-2">
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Camera access denied:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Click camera icon in browser address bar</li>
                    <li>• Select "Allow" for camera access</li>
                    <li>• Refresh page after granting permission</li>
                    <li>• Check no other applications are using camera</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Camera not working:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Try different camera from dropdown</li>
                    <li>• Lower resolution in Camera Settings</li>
                    <li>• Restart browser</li>
                    <li>• Check camera drivers are updated</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Performance Issues:</h4>
              <div className="space-y-2">
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Slow performance or crashes:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Clear browser cache (Settings → Sync → Clear Local Cache)</li>
                    <li>• Reduce camera resolution</li>
                    <li>• Disable video mode if not needed</li>
                    <li>• Export and clear old survey data</li>
                    <li>• Use latest Chrome or Edge browser</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-1">Database errors:</h5>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• App automatically switches to emergency storage</li>
                    <li>• Data is preserved in localStorage backup</li>
                    <li>• Refresh page to recover data</li>
                    <li>• Export data immediately after recovery</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="keyboard-shortcuts"
          title="Keyboard Shortcuts"
          icon={<Settings className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <p className="text-gray-300">
              Use keyboard shortcuts for faster operation in the field:
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-3">General Actions:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between" data-testid="shortcut-capture-image">
                    <span className="text-gray-300">Capture Image</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 1</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-clear-alert">
                    <span className="text-gray-300">Clear Alert</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 2</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-log-measurement">
                    <span className="text-gray-300">Log Measurement</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + G</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-clear-images">
                    <span className="text-gray-300">Clear Images</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + C</kbd>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-3">Logging Controls:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between" data-testid="shortcut-start-logging">
                    <span className="text-gray-300">Start Logging</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 3</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-stop-logging">
                    <span className="text-gray-300">Stop Logging</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 4</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-manual-mode">
                    <span className="text-gray-300">Manual Mode</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + M</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-all-data-mode">
                    <span className="text-gray-300">All Data Mode</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + A</kbd>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-3">🤖 AI Detection:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between" data-testid="shortcut-accept-detection">
                    <span className="text-gray-300">Accept Detection</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 7</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-reject-detection">
                    <span className="text-gray-300">Reject Detection</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 8</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-correct-detection">
                    <span className="text-gray-300">Correct Detection</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 9</kbd>
                  </div>
                  <div className="flex justify-between" data-testid="shortcut-test-detection">
                    <span className="text-gray-300">Test Detection</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + 0</kbd>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-blue-900/20 border border-blue-800/30 rounded text-xs text-blue-300">
                  <p>✨ AI Detection shortcuts work when mock detection mode is enabled in AI Settings</p>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-purple-400 mb-3">🎥 Video Recording:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between" data-testid="shortcut-toggle-recording">
                    <span className="text-gray-300">Start/Stop Recording</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Alt + V</kbd>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-purple-900/20 border border-purple-800/30 rounded text-xs text-purple-300">
                  <p>📹 Video recording must be enabled in Camera Settings to use this shortcut</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">POI Type Shortcuts:</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Bridge</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + B</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Tree</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + T</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Wire</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + W</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Power Line</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + P</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Traffic Light</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + L</kbd>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Walkway</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + K</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Road</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + R</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Intersection</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + I</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Railroad</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + Q</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Information</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + N</kbd>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Danger</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + D</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Important Note</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + J</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Work Required</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + F</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Restricted</span>
                    <kbd className="bg-gray-700 px-1 py-0.5 rounded text-xs">Alt + X</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="laser-commands"
          title="Laser Commands Reference"
          icon={<Terminal className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3">SolTec-30m Commands:</h4>
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="px-4 py-2 text-left">Command</th>
                      <th className="px-4 py-2 text-left">Description</th>
                      <th className="px-4 py-2 text-left">Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">DM</td>
                      <td className="px-4 py-2">Single measurement</td>
                      <td className="px-4 py-2 font-mono">D 0001.759</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">DT</td>
                      <td className="px-4 py-2">Continuous measurement</td>
                      <td className="px-4 py-2 font-mono">D 0001.759...</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">ESC</td>
                      <td className="px-4 py-2">Stop measurement</td>
                      <td className="px-4 py-2">-</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">LE</td>
                      <td className="px-4 py-2">Laser enable (red dot on)</td>
                      <td className="px-4 py-2">-</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">LD</td>
                      <td className="px-4 py-2">Laser disable (red dot off)</td>
                      <td className="px-4 py-2">-</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">TP</td>
                      <td className="px-4 py-2">Read temperature</td>
                      <td className="px-4 py-2 font-mono">TP 25</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-3 bg-gray-800 rounded">
                <h5 className="font-medium text-gray-200 mb-1">Special Codes:</h5>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <strong>De02 or DE02:</strong> Infinity reading (no target detected)</li>
                  <li>• <strong>E203:</strong> Invalid command syntax</li>
                  <li>• <strong>E210:</strong> Sensor not in tracking mode</li>
                  <li>• <strong>E254:</strong> Signal too weak</li>
                  <li>• <strong>E255:</strong> Signal too strong</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-400 mb-3">SolTec-10m Commands:</h4>
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="px-4 py-2 text-left">Command</th>
                      <th className="px-4 py-2 text-left">Description</th>
                      <th className="px-4 py-2 text-left">Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">s0g</td>
                      <td className="px-4 py-2">Single measurement</td>
                      <td className="px-4 py-2 font-mono">1234.567</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">s0h</td>
                      <td className="px-4 py-2">Continuous measurement</td>
                      <td className="px-4 py-2 font-mono">1234.567...</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">s0c</td>
                      <td className="px-4 py-2">Stop measurement</td>
                      <td className="px-4 py-2">-</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">s0o</td>
                      <td className="px-4 py-2">Laser on</td>
                      <td className="px-4 py-2">-</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">s0p</td>
                      <td className="px-4 py-2">Laser off</td>
                      <td className="px-4 py-2">-</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="px-4 py-2 font-mono">s0t</td>
                      <td className="px-4 py-2">Read temperature</td>
                      <td className="px-4 py-2 font-mono">25.5</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-3 bg-gray-800 rounded">
                <p className="text-gray-300 text-sm">
                  <strong>Note:</strong> SolTec devices output measurements in millimeters. MeasurePRO automatically converts to meters.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="advanced-features"
          title="Advanced Features"
          icon={<Settings className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-purple-400 mb-3">Slave App (Mobile Companion):</h4>
              <p className="text-gray-300 mb-3">
                Use smartphones/tablets for additional measurements:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Access via the "Slave App" button in the header</li>
                <li>• Simplified interface for quick measurements</li>
                <li>• Uses device GPS and camera</li>
                <li>• Measurements sync back to main app</li>
                <li>• Perfect for team collaboration</li>
              </ul>
            </div>
            
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-red-400 mb-3">Live Monitor (Real-time Collaboration):</h4>
              <p className="text-gray-300 mb-3">
                Monitor measurements from multiple devices in real-time:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Access via the "Live Monitor" button in the header</li>
                <li>• See measurements from all connected devices</li>
                <li>• Filter by user, POI type, or search terms</li>
                <li>• Export filtered data sets</li>
                <li>• Perfect for supervisors and quality control</li>
              </ul>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Cloud Synchronization:</h4>
              <p className="text-gray-300 mb-3">
                Sync data across devices and teams:
              </p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Sign in through Settings → Sync tab</li>
                <li>• Automatic sync when online</li>
                <li>• Manual sync available</li>
                <li>• Import surveys from cloud</li>
                <li>• Team data sharing</li>
              </ul>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Object Detection Mode:</h4>
              <p className="text-gray-300 mb-3">
                Advanced automatic measurement logging:
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <h5 className="font-medium text-gray-200 mb-2">How it works:</h5>
                <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                  <li>Monitors laser readings continuously</li>
                  <li>Detects when an object appears (valid reading after invalid)</li>
                  <li>Records all measurements while object is detected</li>
                  <li>When object ends, logs the minimum height found</li>
                  <li>Automatically captures image and video (if enabled)</li>
                  <li>Creates detailed detection log for analysis</li>
                </ol>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="support"
          title="Support & Resources"
          icon={<Info className="w-6 h-6 text-blue-400" />}
        >
          <div className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Getting Help:</h4>
              <div className="space-y-3">
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">Built-in Diagnostic Tools:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>Serial Diagnostic:</strong> Test device connections (Settings → Help)</li>
                    <li>• <strong>Reset Button:</strong> Reset Web Serial connections</li>
                    <li>• <strong>Raw Output:</strong> View device communication (Laser & GPS Settings)</li>
                    <li>• <strong>Connection Status:</strong> Real-time device status indicators</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 p-3 rounded">
                  <h5 className="font-medium text-gray-200 mb-2">Documentation:</h5>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Complete help system (this page)</li>
                    <li>• Onboarding wizard for new users</li>
                    <li>• Tooltips and contextual help throughout the app</li>
                    <li>• Error messages with suggested solutions</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-3">Technical Specifications:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">System Requirements:</h5>
                  <ul className="text-gray-300 space-y-1">
                    <li>• Chrome 89+ or Edge 89+</li>
                    <li>• Windows 10/11 with device drivers</li>
                    <li>• HTTPS connection or localhost</li>
                    <li>• 4GB RAM minimum</li>
                    <li>• 1GB free storage space</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-200 mb-2">Supported Devices:</h5>
                  <ul className="text-gray-300 space-y-1">
                    <li>• SolTec-30m (recommended)</li>
                    <li>• SolTec-10m</li>
                    <li>• SolTec-70m</li>
                    <li>• NMEA 0183 GPS modules</li>
                    <li>• USB cameras (any resolution)</li>
                    <li>• Mirabox MBox N1 remote</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3">Best Practices:</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Always test device connections before field work</li>
                <li>• Configure and verify ground reference height</li>
                <li>• Set appropriate safety thresholds for your load</li>
                <li>• Enable auto-save to protect your work</li>
                <li>• Export data regularly for backup</li>
                <li>• Use cloud sync for team collaboration</li>
                <li>• Keep device drivers updated</li>
                <li>• Maintain clear GPS antenna positioning</li>
              </ul>
            </div>
          </div>
        </Section>
      </div>
      
      <div className="mt-8 text-center text-gray-400">
        <p className="text-sm">
          MeasurePRO v2.8a - Professional Measurement & Survey Application
        </p>
        <p className="text-xs mt-1">
          Powered by SolTec Innovation - For technical support, contact your system administrator
        </p>
      </div>
    </div>
  );
};

export default HelpSettings;