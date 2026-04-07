import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Ban, Loader2, Download, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import type { Tester, TestSession, TestResult } from '@shared/schema';

const TEST_CATEGORIES = [
  {
    id: 1,
    name: "Hardware Integration Tests",
    subcategories: [
      {
        id: "1.1",
        name: "Laser Distance Meter",
        tests: [
          { id: "1.1.1", name: "Connect laser via Web Serial API", expected: "Port picker appears, connection successful" },
          { id: "1.1.2", name: "Reconnect after disconnect", expected: "Automatic reconnection works" },
          { id: "1.1.3", name: "Multiple connection attempts", expected: "No memory leaks or port locks" },
          { id: "1.1.4", name: "30 kHz sampling rate", expected: "Measurements update 30x/second" },
          { id: "1.1.5", name: "Ground reference subtraction", expected: "Measurements correctly subtract pole height" },
          { id: "1.1.6", name: "Measurement range (0.2m - 250m)", expected: "Works across full range" },
          { id: "1.1.7", name: "±2mm accuracy verification", expected: "Compare with known heights" },
          { id: "1.1.8", name: "Continuous vs single-shot mode", expected: "Both modes work correctly" },
          { id: "1.1.9", name: "USB cable hot-swap", expected: "Graceful disconnect/reconnect" },
          { id: "1.1.10", name: "Error handling for bad data", expected: "Filters out invalid measurements" },
        ]
      },
      {
        id: "1.2",
        name: "GPS Device",
        tests: [
          { id: "1.2.1", name: "Connect hardware GPS via serial", expected: "NMEA parsing works, fix acquired" },
          { id: "1.2.2", name: "GPS fix quality (No Fix → 3D Fix)", expected: "All fix types display correctly" },
          { id: "1.2.3", name: "Satellite count accuracy", expected: "Matches hardware display" },
          { id: "1.2.4", name: "HDOP value updates", expected: "Accuracy metric shows correctly" },
          { id: "1.2.5", name: "Browser GPS failsafe activation", expected: "Auto-switches if hardware disconnects" },
          { id: "1.2.6", name: "Cold start time (~60 seconds)", expected: "App handles slow initial fix" },
          { id: "1.2.7", name: "GPS data in measurements", expected: "Coordinates logged correctly" },
          { id: "1.2.8", name: "Map position accuracy", expected: "Marker matches real position" },
          { id: "1.2.9", name: "Speed calculation", expected: "Matches vehicle speed" },
          { id: "1.2.10", name: "Course/heading accuracy", expected: "Direction indicator correct" },
        ]
      },
      {
        id: "1.3",
        name: "Camera (Standard & ZED 2i)",
        tests: [
          { id: "1.3.1", name: "Standard camera initialization", expected: "MediaStream API works, feed appears" },
          { id: "1.3.2", name: "ZED 2i camera detection", expected: "Auto-detects ZED when connected" },
          { id: "1.3.3", name: "Resolution switching (720p → 4K)", expected: "All resolutions work" },
          { id: "1.3.4", name: "FPS settings (15, 30, 60)", expected: "Frame rates apply correctly" },
          { id: "1.3.5", name: "Camera permissions", expected: "Prompts and handles permissions" },
          { id: "1.3.6", name: "Photo capture", expected: "JPEG saved with metadata" },
          { id: "1.3.7", name: "Measurement overlay on video", expected: "Live values display on feed" },
          { id: "1.3.8", name: "ZED depth sensing", expected: "Depth map generation works" },
          { id: "1.3.9", name: "Camera failover", expected: "Falls back to standard if ZED fails" },
          { id: "1.3.10", name: "Multiple camera switching", expected: "Can switch between devices" },
        ]
      }
    ]
  },
  {
    id: 2,
    name: "Offline Functionality Tests",
    subcategories: [
      {
        id: "2.1",
        name: "Progressive Web App (PWA)",
        tests: [
          { id: "2.1.1", name: "Install PWA on mobile", expected: "Add to home screen works" },
          { id: "2.1.2", name: "Install PWA on desktop", expected: "Desktop install prompt works" },
          { id: "2.1.3", name: "Offline app launch", expected: "App loads from cache" },
          { id: "2.1.4", name: "Service worker registration", expected: "SW installs correctly" },
          { id: "2.1.5", name: "Asset precaching", expected: "All critical assets cached" },
          { id: "2.1.6", name: "SW update mechanism", expected: "Updates apply on reload" },
          { id: "2.1.7", name: "Offline indicator", expected: "Shows offline status clearly" },
          { id: "2.1.8", name: "Online recovery", expected: "Auto-syncs when back online" },
        ]
      },
      {
        id: "2.2",
        name: "IndexedDB Data Persistence",
        tests: [
          { id: "2.2.1", name: "Measurements stored offline", expected: "All logs saved to IndexedDB" },
          { id: "2.2.2", name: "Photos stored offline", expected: "Images persist in IndexedDB" },
          { id: "2.2.3", name: "Video recordings offline", expected: "Videos saved locally" },
          { id: "2.2.4", name: "Settings persistence", expected: "All settings saved" },
          { id: "2.2.5", name: "Survey data integrity", expected: "No data loss offline" },
          { id: "2.2.6", name: "IndexedDB quota management", expected: "Handles storage limits" },
          { id: "2.2.7", name: "10-day grace period", expected: "Can work offline for 10 days" },
          { id: "2.2.8", name: "Sync queue", expected: "Pending changes tracked" },
          { id: "2.2.9", name: "Export while offline", expected: "Can export without internet" },
          { id: "2.2.10", name: "Browser storage eviction", expected: "Data protected from eviction" },
        ]
      },
      {
        id: "2.3",
        name: "Cloud Sync (Firebase)",
        tests: [
          { id: "2.3.1", name: "Auto-sync when online", expected: "Data uploads automatically" },
          { id: "2.3.2", name: "Conflict resolution", expected: "Handles simultaneous edits" },
          { id: "2.3.3", name: "Large dataset sync", expected: "Syncs 1000+ measurements" },
          { id: "2.3.4", name: "Sync retry on failure", expected: "Retries failed uploads" },
          { id: "2.3.5", name: "Background sync", expected: "Works while app in background" },
          { id: "2.3.6", name: "Firebase connection loss", expected: "Graceful degradation" },
          { id: "2.3.7", name: "Multi-device sync", expected: "Same data on all devices" },
          { id: "2.3.8", name: "Sync progress indicator", expected: "Shows upload status" },
        ]
      }
    ]
  },
  {
    id: 3,
    name: "Mobile vs Desktop Tests",
    subcategories: [
      {
        id: "3.1",
        name: "Mobile-Specific Tests",
        tests: [
          { id: "3.1.1", name: "Touch gestures", expected: "Tap, swipe, pinch work correctly" },
          { id: "3.1.2", name: "App selector screen", expected: "Master/Slave/Monitor options clear" },
          { id: "3.1.3", name: "Permission prompts", expected: "GPS, Camera, Notifications sequential" },
          { id: "3.1.4", name: "Responsive layout", expected: "UI adapts to phone size" },
          { id: "3.1.5", name: "Portrait/landscape modes", expected: "Works in both orientations" },
          { id: "3.1.6", name: "Keyboard input", expected: "Virtual keyboard doesn't obscure fields" },
          { id: "3.1.7", name: "Battery usage", expected: "Reasonable battery drain" },
          { id: "3.1.8", name: "Background mode", expected: "App survives background/foreground" },
          { id: "3.1.9", name: "GPS in background", expected: "Location updates continue" },
          { id: "3.1.10", name: "Mobile data limits", expected: "Works on cellular (data usage)" },
          { id: "3.1.11", name: "iOS Safari quirks", expected: "Voice, camera, PWA work" },
          { id: "3.1.12", name: "Android Chrome specifics", expected: "Web Serial, permissions work" },
        ]
      },
      {
        id: "3.2",
        name: "Desktop-Specific Tests",
        tests: [
          { id: "3.2.1", name: "Keyboard shortcuts", expected: "All 49 shortcuts work" },
          { id: "3.2.2", name: "Mouse interactions", expected: "Hover, click, drag work" },
          { id: "3.2.3", name: "Multi-monitor support", expected: "App works on secondary displays" },
          { id: "3.2.4", name: "Window resize", expected: "Responsive down to 1024px" },
          { id: "3.2.5", name: "Full-screen mode", expected: "F11 / maximize works" },
          { id: "3.2.6", name: "Serial port access", expected: "Web Serial works (Chrome, Edge)" },
          { id: "3.2.7", name: "Copy/paste", expected: "Ctrl+C/V work in inputs" },
          { id: "3.2.8", name: "Tab navigation", expected: "Keyboard tab through forms" },
          { id: "3.2.9", name: "Desktop PWA install", expected: "Standalone window mode" },
          { id: "3.2.10", name: "Printer-friendly export", expected: "Print/PDF exports work" },
        ]
      }
    ]
  },
  {
    id: 4,
    name: "Network Conditions Tests",
    subcategories: [
      {
        id: "4.1",
        name: "Connection Quality",
        tests: [
          { id: "4.1.1", name: "Offline (0 kbps)", expected: "App fully functional, data queued" },
          { id: "4.1.2", name: "Slow 2G (50 kbps)", expected: "Usable, sync deferred" },
          { id: "4.1.3", name: "3G (750 kbps)", expected: "Normal operation, slower sync" },
          { id: "4.1.4", name: "4G/LTE (10 Mbps)", expected: "Optimal performance" },
          { id: "4.1.5", name: "WiFi (50+ Mbps)", expected: "Fast sync and video streaming" },
          { id: "4.1.6", name: "High latency (500ms+)", expected: "App remains responsive" },
          { id: "4.1.7", name: "Intermittent connection", expected: "Handles drops gracefully" },
          { id: "4.1.8", name: "Airplane mode", expected: "Offline mode activates" },
          { id: "4.1.9", name: "WiFi → Cellular transition", expected: "Seamless connection handoff" },
          { id: "4.1.10", name: "VPN / Proxy", expected: "Works through VPN" },
        ]
      }
    ]
  },
  {
    id: 5,
    name: "Browser Compatibility Tests",
    subcategories: [
      {
        id: "5.1",
        name: "Desktop Browsers",
        tests: [
          { id: "5.1.1", name: "Chrome 120+ - Core Features", expected: "All features work" },
          { id: "5.1.2", name: "Chrome 120+ - Web Serial", expected: "Web Serial API works" },
          { id: "5.1.3", name: "Chrome 120+ - Voice & PWA", expected: "Voice and PWA work" },
          { id: "5.1.4", name: "Edge 120+ - Core Features", expected: "All features work" },
          { id: "5.1.5", name: "Edge 120+ - Web Serial", expected: "Web Serial API works" },
          { id: "5.1.6", name: "Edge 120+ - Voice & PWA", expected: "Voice and PWA work" },
          { id: "5.1.7", name: "Firefox 120+ - Core Features", expected: "All features work" },
          { id: "5.1.8", name: "Firefox 120+ - No Web Serial", expected: "Graceful degradation without Web Serial" },
          { id: "5.1.9", name: "Firefox 120+ - Voice & PWA", expected: "Voice and PWA work" },
          { id: "5.1.10", name: "Safari 17+ - Core Features", expected: "All features work" },
          { id: "5.1.11", name: "Safari 17+ - No Web Serial", expected: "Graceful degradation without Web Serial" },
          { id: "5.1.12", name: "Safari 17+ - Voice & PWA", expected: "Voice and PWA work" },
          { id: "5.1.13", name: "Opera 105+ - Core Features", expected: "All features work" },
          { id: "5.1.14", name: "Opera 105+ - Web Serial", expected: "Web Serial API works" },
          { id: "5.1.15", name: "Opera 105+ - Voice & PWA", expected: "Voice and PWA work" },
        ]
      },
      {
        id: "5.2",
        name: "Mobile Browsers",
        tests: [
          { id: "5.2.1", name: "Safari iOS 15+ - Core Features", expected: "All features work" },
          { id: "5.2.2", name: "Safari iOS 15+ - GPS & Camera", expected: "GPS and Camera work" },
          { id: "5.2.3", name: "Safari iOS 15+ - Voice (Limited)", expected: "Voice recognition with limitations" },
          { id: "5.2.4", name: "Safari iOS 15+ - PWA", expected: "PWA installation works" },
          { id: "5.2.5", name: "Chrome Android 12+ - All Features", expected: "All features work including Web Serial" },
          { id: "5.2.6", name: "Samsung Internet - Core Features", expected: "All core features work" },
          { id: "5.2.7", name: "Samsung Internet - GPS & Camera", expected: "GPS and Camera work" },
          { id: "5.2.8", name: "Samsung Internet - Voice & PWA", expected: "Voice and PWA work" },
          { id: "5.2.9", name: "Firefox Mobile - Core Features", expected: "All core features work" },
          { id: "5.2.10", name: "Firefox Mobile - GPS & Camera", expected: "GPS and Camera work" },
        ]
      }
    ]
  },
  {
    id: 6,
    name: "Permission Flows Tests",
    subcategories: [
      {
        id: "6.1",
        name: "GPS Permission",
        tests: [
          { id: "6.1.1", name: "First-time permission prompt", expected: "Clear explanation before prompt" },
          { id: "6.1.2", name: "Permission granted", expected: "GPS activates immediately" },
          { id: "6.1.3", name: "Permission denied", expected: "Shows error, suggests fix" },
          { id: "6.1.4", name: "Permission revoked mid-session", expected: "Graceful degradation, re-prompt" },
          { id: "6.1.5", name: "Browser GPS failsafe", expected: "Falls back automatically" },
          { id: "6.1.6", name: "Desktop vs mobile prompts", expected: "Both work correctly" },
        ]
      },
      {
        id: "6.2",
        name: "Camera Permission",
        tests: [
          { id: "6.2.1", name: "First camera access", expected: "Permission prompt appears" },
          { id: "6.2.2", name: "Multiple cameras", expected: "Can select from list" },
          { id: "6.2.3", name: "Permission denied", expected: "Shows error, how to fix" },
          { id: "6.2.4", name: "Permission revoked", expected: "Feed stops, re-prompt option" },
          { id: "6.2.5", name: "Camera disconnect", expected: "Handles unplugging gracefully" },
        ]
      },
      {
        id: "6.3",
        name: "Microphone Permission (Voice Commands)",
        tests: [
          { id: "6.3.1", name: "Voice assistant first enable", expected: "Microphone prompt appears" },
          { id: "6.3.2", name: "Permission granted", expected: "Voice recognition starts" },
          { id: "6.3.3", name: "Permission denied", expected: "Clear error, cannot use voice" },
          { id: "6.3.4", name: "Permission revoked", expected: "Recognition stops, error shown" },
          { id: "6.3.5", name: "Multiple microphones", expected: "Can select input device" },
        ]
      },
      {
        id: "6.4",
        name: "Notification Permission",
        tests: [
          { id: "6.4.1", name: "Optional notification prompt", expected: "Clearly marked as optional" },
          { id: "6.4.2", name: "Permission granted", expected: "Notifications work" },
          { id: "6.4.3", name: "Permission denied", expected: "App still works normally" },
          { id: "6.4.4", name: "Background notifications", expected: "Alerts show when app backgrounded" },
        ]
      }
    ]
  },
  {
    id: 7,
    name: "Data Integrity Tests",
    subcategories: [
      {
        id: "7.1",
        name: "Measurement Accuracy",
        tests: [
          { id: "7.1.1", name: "Known height verification", expected: "Measure 5.0m object, result = 5.0m ±2mm" },
          { id: "7.1.2", name: "Ground reference accuracy", expected: "Subtract pole height correctly" },
          { id: "7.1.3", name: "GPS coordinates", expected: "Match actual location (±5m)" },
          { id: "7.1.4", name: "Timestamp precision", expected: "Millisecond-accurate timestamps" },
          { id: "7.1.5", name: "Alert threshold accuracy", expected: "Triggers at exact thresholds" },
          { id: "7.1.6", name: "Speed calculation", expected: "GPS speed matches speedometer" },
        ]
      },
      {
        id: "7.2",
        name: "Data Logging Integrity",
        tests: [
          { id: "7.2.1", name: "No duplicate measurements", expected: "Each log unique" },
          { id: "7.2.2", name: "No missing measurements", expected: "All logs captured" },
          { id: "7.2.3", name: "POI type persistence", expected: "Correct type logged" },
          { id: "7.2.4", name: "Metadata completeness", expected: "All fields populated" },
          { id: "7.2.5", name: "Large dataset (1000+ logs)", expected: "No data loss" },
          { id: "7.2.6", name: "Logging mode switches", expected: "Mode changes reflected" },
          { id: "7.2.7", name: "Manual + auto logging", expected: "Both work simultaneously" },
        ]
      },
      {
        id: "7.3",
        name: "Export Data Accuracy",
        tests: [
          { id: "7.3.1", name: "CSV export completeness", expected: "All data in spreadsheet" },
          { id: "7.3.2", name: "GeoJSON coordinate format", expected: "Valid GeoJSON, loads in QGIS" },
          { id: "7.3.3", name: "KML visualization", expected: "Correct in Google Earth" },
          { id: "7.3.4", name: "JSON structure", expected: "Valid JSON, all metadata" },
          { id: "7.3.5", name: "ZIP archive creation", expected: "All files included" },
          { id: "7.3.6", name: "YOLO format (AI)", expected: "Correct annotation format" },
          { id: "7.3.7", name: "Large export (10,000+ rows)", expected: "No truncation" },
          { id: "7.3.8", name: "Special characters in data", expected: "No encoding issues" },
        ]
      }
    ]
  },
  {
    id: 8,
    name: "Performance Tests",
    subcategories: [
      {
        id: "8.1",
        name: "App Responsiveness",
        tests: [
          { id: "8.1.1", name: "Initial load time", expected: "< 3 seconds" },
          { id: "8.1.2", name: "Button click response", expected: "< 100ms" },
          { id: "8.1.3", name: "Page navigation", expected: "< 500ms" },
          { id: "8.1.4", name: "Measurement update rate", expected: "30 Hz" },
          { id: "8.1.5", name: "Camera frame rate", expected: "30 FPS" },
          { id: "8.1.6", name: "GPS update rate", expected: "1 Hz" },
          { id: "8.1.7", name: "Map render time", expected: "< 1 second" },
          { id: "8.1.8", name: "Voice command latency", expected: "< 500ms" },
        ]
      },
      {
        id: "8.2",
        name: "Memory & Resources",
        tests: [
          { id: "8.2.1", name: "Memory usage (idle)", expected: "< 200 MB" },
          { id: "8.2.2", name: "Memory after 1 hour", expected: "< 500 MB" },
          { id: "8.2.3", name: "Memory leaks", expected: "No increase" },
          { id: "8.2.4", name: "CPU usage (idle)", expected: "< 5%" },
          { id: "8.2.5", name: "CPU during logging", expected: "< 20%" },
          { id: "8.2.6", name: "IndexedDB size (1000 logs)", expected: "< 10 MB" },
          { id: "8.2.7", name: "Service worker cache", expected: "< 50 MB" },
        ]
      },
      {
        id: "8.3",
        name: "Battery Life (Mobile)",
        tests: [
          { id: "8.3.1", name: "1-hour survey battery drain", expected: "< 20% on full charge" },
          { id: "8.3.2", name: "GPS continuous tracking", expected: "Reasonable drain" },
          { id: "8.3.3", name: "Camera active", expected: "Higher drain expected" },
          { id: "8.3.4", name: "Background mode", expected: "Minimal drain" },
          { id: "8.3.5", name: "Airplane mode survey", expected: "Minimal drain (no sync)" },
        ]
      }
    ]
  },
  {
    id: 9,
    name: "Premium Features Tests",
    subcategories: [
      {
        id: "9.1",
        name: "AI Detection (MeasurePRO+)",
        tests: [
          { id: "9.1.1", name: "TensorFlow.js model loading", expected: "Loads without errors" },
          { id: "9.1.2", name: "Real-time detection (30 FPS)", expected: "Smooth, no lag" },
          { id: "9.1.3", name: "80+ object classes", expected: "Detects various objects" },
          { id: "9.1.4", name: "Confidence scores accurate", expected: "Scores make sense" },
          { id: "9.1.5", name: "Accept/Reject/Correct workflow", expected: "All actions work" },
          { id: "9.1.6", name: "Detection logging", expected: "Logged with metadata" },
          { id: "9.1.7", name: "ROI detection zone", expected: "Only detects in zone" },
          { id: "9.1.8", name: "Class filtering", expected: "Filters enabled/disabled classes" },
          { id: "9.1.9", name: "Mock vs Production mode", expected: "Both modes work" },
          { id: "9.1.10", name: "Training data export (YOLO)", expected: "Correct format" },
        ]
      },
      {
        id: "9.2",
        name: "Envelope Clearance",
        tests: [
          { id: "9.2.1", name: "ZED 2i depth sensing", expected: "Accurate depth map" },
          { id: "9.2.2", name: "Vehicle profile selection", expected: "Loads correctly" },
          { id: "9.2.3", name: "Custom profile creation", expected: "Saves and applies" },
          { id: "9.2.4", name: "Clearance calculation accuracy", expected: "Matches manual measurement" },
          { id: "9.2.5", name: "Real-time alerts (10 Hz)", expected: "Updates smoothly" },
          { id: "9.2.6", name: "Color-coded status (G/Y/R)", expected: "Colors accurate" },
          { id: "9.2.7", name: "Violation logging", expected: "All violations recorded" },
          { id: "9.2.8", name: "Cycle vehicle profiles", expected: "Switches correctly" },
        ]
      },
      {
        id: "9.3",
        name: "Convoy Guardian",
        tests: [
          { id: "9.3.1", name: "Create convoy (master)", expected: "Convoy code generated" },
          { id: "9.3.2", name: "Join convoy (QR code)", expected: "Slave connects successfully" },
          { id: "9.3.3", name: "Join convoy (manual code)", expected: "Slave connects" },
          { id: "9.3.4", name: "WebSocket communication", expected: "Real-time data sync" },
          { id: "9.3.5", name: "Multi-vehicle monitoring", expected: "All vehicles visible" },
          { id: "9.3.6", name: "Black box logging", expected: "All events logged" },
          { id: "9.3.7", name: "Emergency alert", expected: "Broadcast to all vehicles" },
          { id: "9.3.8", name: "Live Monitor connection", expected: "Remote monitoring works" },
          { id: "9.3.9", name: "Convoy disconnection", expected: "Handles dropout gracefully" },
        ]
      },
      {
        id: "9.4",
        name: "Permitted Route Enforcement",
        tests: [
          { id: "9.4.1", name: "GPX route upload", expected: "Parses and displays" },
          { id: "9.4.2", name: "Buffer zone visualization", expected: "Shows correctly on map" },
          { id: "9.4.3", name: "On-route status (green)", expected: "Accurate detection" },
          { id: "9.4.4", name: "Near-edge warning (yellow)", expected: "Triggers correctly" },
          { id: "9.4.5", name: "Off-route violation (red)", expected: "Immediate alert" },
          { id: "9.4.6", name: "STOP modal non-dismissable", expected: "Cannot close until back on route" },
          { id: "9.4.7", name: "Violation logging", expected: "All violations recorded" },
          { id: "9.4.8", name: "Return to route", expected: "Modal auto-dismisses" },
        ]
      },
      {
        id: "9.5",
        name: "Swept Path Analysis",
        tests: [
          { id: "9.5.1", name: "Vehicle geometry configuration", expected: "Saves correctly" },
          { id: "9.5.2", name: "Road boundary detection", expected: "AI detects edges" },
          { id: "9.5.3", name: "Turn simulation activation", expected: "Triggers on course change" },
          { id: "9.5.4", name: "Swept path overlay", expected: "Visual accurate" },
          { id: "9.5.5", name: "Off-tracking calculation", expected: "Matches expected values" },
          { id: "9.5.6", name: "Collision detection", expected: "Predicts correctly" },
          { id: "9.5.7", name: "Safe turn (no collision)", expected: "Green indicator" },
          { id: "9.5.8", name: "Collision warning (red)", expected: "Alerts correctly" },
          { id: "9.5.9", name: "Turn data logging", expected: "All turns recorded" },
        ]
      }
    ]
  },
  {
    id: 10,
    name: "Edge Cases & Stress Tests",
    subcategories: [
      {
        id: "10.1",
        name: "Edge Cases",
        tests: [
          { id: "10.1.1", name: "Empty data: Start with no measurements", expected: "App works normally" },
          { id: "10.1.2", name: "Very long survey: 10,000+ measurements", expected: "No performance degradation" },
          { id: "10.1.3", name: "Rapid mode switching: Change modes 20x", expected: "No errors" },
          { id: "10.1.4", name: "Rapid POI switching: Change POI 50x", expected: "No errors" },
          { id: "10.1.5", name: "Simultaneous alerts: Multiple warnings", expected: "All display correctly" },
          { id: "10.1.6", name: "GPS loss mid-survey: Disconnect GPS", expected: "Graceful fallback" },
          { id: "10.1.7", name: "Camera loss mid-recording: Unplug camera", expected: "Error message, recording stops" },
          { id: "10.1.8", name: "Laser loss mid-logging: Disconnect laser", expected: "Stops logging, shows error" },
          { id: "10.1.9", name: "Battery critical: < 5% battery", expected: "Warning shown, data protected" },
          { id: "10.1.10", name: "Storage full: Fill IndexedDB quota", expected: "Error message, cannot log more" },
          { id: "10.1.11", name: "Network timeout: 30-second timeout", expected: "Retry logic kicks in" },
          { id: "10.1.12", name: "Clock time change: Adjust system clock", expected: "Timestamps still valid" },
          { id: "10.1.13", name: "Timezone change: Cross timezones", expected: "UTC timestamps correct" },
          { id: "10.1.14", name: "Browser crash: Force crash", expected: "Data recovers on restart" },
          { id: "10.1.15", name: "Tab backgrounded: Switch tabs for 1 hour", expected: "App resumes correctly" },
        ]
      },
      {
        id: "10.2",
        name: "Stress Tests",
        tests: [
          { id: "10.2.1", name: "Continuous logging: 8-hour session", expected: "No crashes, no memory leaks" },
          { id: "10.2.2", name: "Rapid photo capture: 100 photos/minute", expected: "No lag, all saved" },
          { id: "10.2.3", name: "Large export: 50,000 measurements to CSV", expected: "Completes successfully" },
          { id: "10.2.4", name: "Video recording: 2-hour continuous video", expected: "Saves correctly" },
          { id: "10.2.5", name: "Multiple devices sync: 10 devices simultaneous", expected: "All sync correctly" },
          { id: "10.2.6", name: "Rapid connection cycling: Connect/disconnect 50x", expected: "No port locks" },
          { id: "10.2.7", name: "Voice commands spam: 100 commands/minute", expected: "Handles correctly" },
          { id: "10.2.8", name: "Map with 1000s of markers: Load huge dataset", expected: "Renders without freeze" },
        ]
      },
      {
        id: "10.3",
        name: "Security Edge Cases",
        tests: [
          { id: "10.3.1", name: "SQL injection in inputs: Try malicious input", expected: "Sanitized correctly" },
          { id: "10.3.2", name: "XSS in POI names: Script tags in names", expected: "Escaped correctly" },
          { id: "10.3.3", name: "Malicious GPX file: Invalid/huge GPX", expected: "Error handling works" },
          { id: "10.3.4", name: "Token expiry: Expire Firebase token", expected: "Re-auth prompt appears" },
          { id: "10.3.5", name: "Password brute force: Multiple failed logins", expected: "Rate limiting works" },
        ]
      }
    ]
  },
  {
    id: 11,
    name: "Security & Compliance",
    subcategories: [
      {
        id: "11.1",
        name: "Authentication & Authorization",
        tests: [
          { id: "11.1.1", name: "Password strength validation", expected: "Enforces min 8 characters" },
          { id: "11.1.2", name: "Password hashing", expected: "bcrypt used (never plaintext)" },
          { id: "11.1.3", name: "Email verification required", expected: "Cannot login without verify" },
          { id: "11.1.4", name: "Admin approval required", expected: "Cannot login until approved" },
          { id: "11.1.5", name: "Session timeout", expected: "Expires after inactivity" },
          { id: "11.1.6", name: "JWT token validation", expected: "Invalid tokens rejected" },
          { id: "11.1.7", name: "User enumeration prevention", expected: "Same error for invalid user/password" },
          { id: "11.1.8", name: "Rate limiting", expected: "Blocks brute force attempts" },
        ]
      },
      {
        id: "11.2",
        name: "Data Privacy",
        tests: [
          { id: "11.2.1", name: "No secrets in client code", expected: "API keys server-side only" },
          { id: "11.2.2", name: "HTTPS enforcement", expected: "All traffic encrypted" },
          { id: "11.2.3", name: "Secure cookies", expected: "HttpOnly, Secure flags set" },
          { id: "11.2.4", name: "GPS data privacy", expected: "User consent required" },
          { id: "11.2.5", name: "Camera access privacy", expected: "Permission-based" },
          { id: "11.2.6", name: "Export data encryption", expected: "Option for encrypted export" },
        ]
      },
      {
        id: "11.3",
        name: "License Compliance",
        tests: [
          { id: "11.3.1", name: "Subscription enforcement", expected: "Free users blocked from Plus features" },
          { id: "11.3.2", name: "License activation", expected: "Codes work correctly" },
          { id: "11.3.3", name: "Device limit enforcement", expected: "Blocks > max devices" },
          { id: "11.3.4", name: "License expiration", expected: "Revokes access on expiry" },
          { id: "11.3.5", name: "Feature gating", expected: "Only enabled features accessible" },
        ]
      }
    ]
  },
  {
    id: 12,
    name: "Pre-Deployment Checklist",
    subcategories: [
      {
        id: "12.1",
        name: "Final Verification",
        tests: [
          { id: "12.1.1", name: "All critical bugs fixed", expected: "No known critical issues" },
          { id: "12.1.2", name: "All tests passed (or documented exceptions)", expected: "Test completion verified" },
          { id: "12.1.3", name: "Performance benchmarks met", expected: "Meets performance targets" },
          { id: "12.1.4", name: "Browser compatibility verified", expected: "Works on all target browsers" },
          { id: "12.1.5", name: "Mobile responsiveness tested", expected: "UI works on mobile devices" },
          { id: "12.1.6", name: "Offline mode works flawlessly", expected: "Offline functionality verified" },
          { id: "12.1.7", name: "Data export/import tested", expected: "Export formats work correctly" },
          { id: "12.1.8", name: "Security audit completed", expected: "Security review passed" },
          { id: "12.1.9", name: "Privacy policy updated", expected: "Policy current and accurate" },
          { id: "12.1.10", name: "Terms of service reviewed", expected: "ToS up to date" },
          { id: "12.1.11", name: "SSL certificate valid", expected: "Certificate installed and working" },
          { id: "12.1.12", name: "Backup systems tested", expected: "Backups working" },
          { id: "12.1.13", name: "Rollback plan documented", expected: "Rollback procedure ready" },
          { id: "12.1.14", name: "Support documentation complete", expected: "Training materials ready" },
        ]
      },
      {
        id: "12.2",
        name: "Deployment Configuration",
        tests: [
          { id: "12.2.1", name: "Environment variables set", expected: "All env vars configured" },
          { id: "12.2.2", name: "Database migrations tested", expected: "Migrations work correctly" },
          { id: "12.2.3", name: "Firebase rules configured", expected: "Security rules in place" },
          { id: "12.2.4", name: "CDN configured (if used)", expected: "CDN properly set up" },
          { id: "12.2.5", name: "Monitoring alerts set up", expected: "Alerts configured" },
          { id: "12.2.6", name: "Error tracking enabled (Sentry, etc.)", expected: "Error tracking active" },
          { id: "12.2.7", name: "Analytics configured", expected: "Analytics working" },
          { id: "12.2.8", name: "Domain DNS configured", expected: "DNS properly set" },
          { id: "12.2.9", name: "Email SMTP configured", expected: "Email sending works" },
          { id: "12.2.10", name: "Rate limiting enabled", expected: "Rate limits in place" },
        ]
      }
    ]
  }
];

function TesterRegistrationForm({ onSuccess }: { onSuccess: (tester: Tester, session: TestSession) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [installationDesc, setInstallationDesc] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [groundRef, setGroundRef] = useState('100');
  const [weather, setWeather] = useState('Sunny');
  const [temperature, setTemperature] = useState('20');
  const [location, setLocation] = useState('');
  const queryClient = useQueryClient();

  const createTesterMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/testers', { method: 'POST', body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/testers'] })
  });

  const createSessionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/test-sessions', { method: 'POST', body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/test-sessions'] })
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      let tester: Tester;
      const existingResponse = await fetch(`/api/testers/${encodeURIComponent(email)}`);
      
      if (existingResponse.ok) {
        tester = await existingResponse.json();
        /* toast removed */
      } else {
        tester = await createTesterMutation.mutateAsync({
          name,
          email,
          installationDescription: installationDesc || null,
          photoUrl: photoPreview || null,
          groundReference: parseInt(groundRef, 10),
          weatherConditions: weather,
          temperature: parseInt(temperature, 10),
          location: location || null,
        });
        /* toast removed */
      }

      const session = await createSessionMutation.mutateAsync({
        testerId: tester.id,
        sessionName: `Test Session - ${new Date().toLocaleDateString()}`,
        groundReference: parseInt(groundRef, 10),
        weather,
        temperature: parseInt(temperature, 10),
        location: location || null,
      });

      onSuccess(tester, session);
    } catch (error: any) {
      toast.error(error.message || 'Failed to register');
    }
  };

  return (
    <Card className="p-6 bg-white dark:bg-gray-800">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Register as Tester</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-gray-900 dark:text-gray-100">Name *</Label>
          <Input
            id="name"
            data-testid="input-tester-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <Label htmlFor="email" className="text-gray-900 dark:text-gray-100">Email *</Label>
          <Input
            id="email"
            type="email"
            data-testid="input-tester-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <Label htmlFor="installation" className="text-gray-900 dark:text-gray-100">Installation Description</Label>
          <Textarea
            id="installation"
            value={installationDesc}
            onChange={(e) => setInstallationDesc(e.target.value)}
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Describe your MeasurePRO installation setup..."
          />
        </div>
        <div>
          <Label htmlFor="photo" className="text-gray-900 dark:text-gray-100">Installation Photo (Optional)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              data-testid="input-installation-photo"
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            {photoFile && <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />}
          </div>
          {photoPreview && (
            <div className="mt-2">
              <img 
                src={photoPreview} 
                alt="Installation preview" 
                className="max-w-xs max-h-48 rounded border-2 border-gray-300 dark:border-gray-600"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="groundRef" className="text-gray-900 dark:text-gray-100">Ground Reference (m) *</Label>
            <Input
              id="groundRef"
              type="number"
              value={groundRef}
              onChange={(e) => setGroundRef(e.target.value)}
              required
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="temperature" className="text-gray-900 dark:text-gray-100">Temperature (°C) *</Label>
            <Input
              id="temperature"
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              required
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="weather" className="text-gray-900 dark:text-gray-100">Weather *</Label>
            <select
              id="weather"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="Sunny">Sunny</option>
              <option value="Cloudy">Cloudy</option>
              <option value="Rainy">Rainy</option>
              <option value="Snowy">Snowy</option>
              <option value="Windy">Windy</option>
              <option value="Foggy">Foggy</option>
            </select>
          </div>
          <div>
            <Label htmlFor="location" className="text-gray-900 dark:text-gray-100">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <Button
          type="submit"
          data-testid="button-register-tester"
          disabled={createTesterMutation.isPending || createSessionMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {(createTesterMutation.isPending || createSessionMutation.isPending) ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registering...</>
          ) : (
            'Start Testing Session'
          )}
        </Button>
      </form>
    </Card>
  );
}

function TestSessionComponent({ tester, session }: { tester: Tester; session: TestSession }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set([1]));
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());
  const queryClient = useQueryClient();

  const { data: existingResults } = useQuery({
    queryKey: ['/api/test-results/session', session.id],
    queryFn: () => fetch(`/api/test-results/session/${session.id}`).then(r => r.json())
  });

  useEffect(() => {
    if (existingResults) {
      const resultsMap = new Map<string, TestResult>(existingResults.map((r: TestResult) => [r.testId, r]));
      setTestResults(resultsMap);
    }
  }, [existingResults]);

  const createResultMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/test-results', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-results/session', session.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/test-sessions', session.id] });
    }
  });

  const updateResultMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/test-results/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-results/session', session.id] });
    }
  });

  const updateSessionMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/test-sessions/${session.id}`, { method: 'PATCH', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-sessions', session.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/test-sessions'] });
    }
  });

  const handleTestStatus = async (testId: string, testName: string, category: string, status: 'pass' | 'fail' | 'blocked') => {
    const existingResult = testResults.get(testId);

    try {
      if (existingResult) {
        const updated = await updateResultMutation.mutateAsync({
          id: existingResult.id,
          data: { status, testedAt: new Date().toISOString() }
        });
        setTestResults(new Map(testResults.set(testId, updated)));
      } else {
        const created = await createResultMutation.mutateAsync({
          sessionId: session.id,
          category,
          testId,
          testName,
          status,
          testedAt: new Date().toISOString(),
        });
        setTestResults(new Map(testResults.set(testId, created)));
      }

      updateStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save result');
    }
  };

  const updateStats = async () => {
    const allTests = TEST_CATEGORIES.flatMap(cat =>
      cat.subcategories.flatMap(sub => sub.tests)
    );
    const total = allTests.length;
    
    const results = Array.from(testResults.values());
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const blocked = results.filter(r => r.status === 'blocked').length;
    const completion = total > 0 ? ((passed + failed + blocked) / total) * 100 : 0;

    await updateSessionMutation.mutateAsync({
      totalTests: total,
      passedTests: passed,
      failedTests: failed,
      blockedTests: blocked,
      completionPercentage: Math.round(completion * 10) / 10,
    });
  };

  const toggleCategory = (catId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(catId)) {
      newExpanded.delete(catId);
    } else {
      newExpanded.add(catId);
    }
    setExpandedCategories(newExpanded);
  };

  const totalTests = TEST_CATEGORIES.flatMap(cat => cat.subcategories.flatMap(sub => sub.tests)).length;
  const results = Array.from(testResults.values());
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const blocked = results.filter(r => r.status === 'blocked').length;
  const pending = totalTests - passed - failed - blocked;
  const completion = totalTests > 0 ? ((passed + failed + blocked) / totalTests) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white dark:bg-gray-800">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Test Session: {session.sessionName}</h2>
        <div className="grid grid-cols-2 gap-4 mb-4 text-gray-900 dark:text-gray-100">
          <div><strong>Tester:</strong> {tester.name}</div>
          <div><strong>Email:</strong> {tester.email}</div>
          <div><strong>Weather:</strong> {session.weather}</div>
          <div><strong>Temperature:</strong> {session.temperature}°C</div>
          <div className="col-span-2"><strong>Total Tests:</strong> {totalTests}</div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between mb-2 text-gray-900 dark:text-gray-100">
            <span className="font-semibold">Progress</span>
            <span data-testid="text-completion-percentage" className="font-semibold">{completion.toFixed(1)}%</span>
          </div>
          <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{passed}</div>
            <div className="text-sm text-green-600 dark:text-green-400">✓ Passed</div>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900 rounded">
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{failed}</div>
            <div className="text-sm text-red-600 dark:text-red-400">✗ Failed</div>
          </div>
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{blocked}</div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400">⊘ Blocked</div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{pending}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">⏸ Pending</div>
          </div>
        </div>
      </Card>

      {TEST_CATEGORIES.map(category => (
        <Card key={category.id} className="bg-white dark:bg-gray-800">
          <button
            onClick={() => toggleCategory(category.id)}
            className="w-full p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{category.name}</h3>
            {expandedCategories.has(category.id) ? (
              <ChevronUp className="w-5 h-5 text-gray-900 dark:text-gray-100" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-900 dark:text-gray-100" />
            )}
          </button>
          
          {expandedCategories.has(category.id) && (
            <div className="p-4 space-y-4">
              {category.subcategories.map(sub => (
                <div key={sub.id} className="border-l-2 border-gray-300 dark:border-gray-600 pl-4">
                  <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">{sub.name}</h4>
                  <div className="space-y-2">
                    {sub.tests.map(test => {
                      const result = testResults.get(test.id);
                      const status = result?.status || 'pending';
                      
                      return (
                        <div key={test.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{test.id}</span>
                              <div className="text-gray-900 dark:text-gray-100 font-medium">{test.name}</div>
                              {test.expected && (
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Expected: {test.expected}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                data-testid={`button-test-pass-${test.id}`}
                                onClick={() => handleTestStatus(test.id, test.name, category.name, 'pass')}
                                className={`${status === 'pass' ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} hover:bg-green-700 dark:hover:bg-green-600 text-white`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                data-testid={`button-test-fail-${test.id}`}
                                onClick={() => handleTestStatus(test.id, test.name, category.name, 'fail')}
                                className={`${status === 'fail' ? 'bg-red-600 dark:bg-red-500' : 'bg-gray-300 dark:bg-gray-600'} hover:bg-red-700 dark:hover:bg-red-600 text-white`}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                data-testid={`button-test-block-${test.id}`}
                                onClick={() => handleTestStatus(test.id, test.name, category.name, 'blocked')}
                                className={`${status === 'blocked' ? 'bg-yellow-600 dark:bg-yellow-500' : 'bg-gray-300 dark:bg-gray-600'} hover:bg-yellow-700 dark:hover:bg-yellow-600 text-white`}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {result?.testedAt && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Tested: {new Date(result.testedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Button
        onClick={() => updateSessionMutation.mutate({ completedAt: new Date().toISOString() })}
        className="w-full bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600"
      >
        Complete Session
      </Button>
    </div>
  );
}

function ComparisonDashboard() {
  const { data: comparison, isLoading } = useQuery({
    queryKey: ['/api/test-stats/compare'],
    queryFn: () => fetch('/api/test-stats/compare').then(r => r.json())
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/test-stats'],
    queryFn: () => fetch('/api/test-stats').then(r => r.json())
  });

  const exportCSV = () => {
    if (!comparison) return;
    
    const headers = ['Tester', 'Session', 'Date', 'Completion %', 'Passed', 'Failed', 'Blocked', 'Weather', 'Temperature'];
    const rows = comparison.map((s: any) => [
      s.testerName,
      s.sessionName,
      new Date(s.startedAt).toLocaleDateString(),
      s.completionPercentage,
      s.passedTests,
      s.failedTests,
      s.blockedTests,
      s.weather,
      s.temperature
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-sessions-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className="p-6 bg-white dark:bg-gray-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white dark:bg-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Testing Statistics</h2>
          <Button onClick={exportCSV} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalSessions}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Sessions</div>
            </div>
            <div className="p-4 bg-green-100 dark:bg-green-900 rounded">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.avgPassRate?.toFixed(1)}%</div>
              <div className="text-sm text-green-600 dark:text-green-400">Avg Pass Rate</div>
            </div>
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.avgCompletion?.toFixed(1)}%</div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">Avg Completion</div>
            </div>
            <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.totalTesters}</div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Total Testers</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="p-2 text-left">Tester</th>
                <th className="p-2 text-left">Session</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-right">Completion</th>
                <th className="p-2 text-right">Passed</th>
                <th className="p-2 text-right">Failed</th>
                <th className="p-2 text-right">Blocked</th>
                <th className="p-2 text-left">Weather</th>
              </tr>
            </thead>
            <tbody>
              {comparison?.map((session: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="p-2">{session.testerName}</td>
                  <td className="p-2">{session.sessionName}</td>
                  <td className="p-2">{new Date(session.startedAt).toLocaleDateString()}</td>
                  <td className="p-2 text-right font-semibold">{session.completionPercentage?.toFixed(1)}%</td>
                  <td className="p-2 text-right text-green-600 dark:text-green-400">{session.passedTests}</td>
                  <td className="p-2 text-right text-red-600 dark:text-red-400">{session.failedTests}</td>
                  <td className="p-2 text-right text-yellow-600 dark:text-yellow-400">{session.blockedTests}</td>
                  <td className="p-2">{session.weather}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function TestingPage() {
  const [currentSession, setCurrentSession] = useState<{ tester: Tester; session: TestSession } | null>(null);

  if (currentSession) {
    return (
      <div className="container mx-auto p-6">
        <Button
          onClick={() => setCurrentSession(null)}
          className="mb-4 bg-gray-600 hover:bg-gray-700 text-white dark:bg-gray-500 dark:hover:bg-gray-600"
        >
          ← Back to Registration
        </Button>
        <TestSessionComponent tester={currentSession.tester} session={currentSession.session} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">MeasurePRO Testing Portal</h1>
      <TesterRegistrationForm onSuccess={(tester, session) => setCurrentSession({ tester, session })} />
      <ComparisonDashboard />
    </div>
  );
}
