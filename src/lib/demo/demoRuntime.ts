import { useGPSStore } from '../stores/gpsStore';
import { useLoggingStore } from '../stores/loggingStore';
import { useSerialStore } from '../stores/serialStore';
import { useAlertsStore } from '../stores/alertsStore';
import { useSurveyStore } from '../survey/store';
import { getMeasurementFeed } from '../survey/MeasurementFeed';
import { soundManager } from '../sounds';
import type { Measurement } from '../survey/types';

const DEMO_GPS_PATH = [
  { lat: -27.4698, lng: 153.0251, speed: 25 },
  { lat: -27.4695, lng: 153.0255, speed: 28 },
  { lat: -27.4690, lng: 153.0260, speed: 22 },
  { lat: -27.4685, lng: 153.0258, speed: 30 },
  { lat: -27.4680, lng: 153.0252, speed: 26 },
  { lat: -27.4678, lng: 153.0245, speed: 24 },
  { lat: -27.4682, lng: 153.0240, speed: 27 },
  { lat: -27.4688, lng: 153.0238, speed: 29 },
  { lat: -27.4695, lng: 153.0242, speed: 31 },
  { lat: -27.4698, lng: 153.0248, speed: 25 },
];

const DEMO_POI_SCENARIOS = [
  { height: 4.85, poiType: 'bridge', label: 'Bridge Underpass', alert: 'warning' },
  { height: 6.20, poiType: 'powerlines', label: 'Power Lines', alert: null },
  { height: 4.15, poiType: 'bridge', label: 'Low Clearance Bridge', alert: 'critical' },
  { height: 5.45, poiType: 'overpass', label: 'Highway Overpass', alert: null },
  { height: 4.50, poiType: 'sign', label: 'Low Clearance Sign', alert: 'warning' },
  { height: 5.80, poiType: 'bridge', label: 'Railway Bridge', alert: null },
];

class DemoRuntime {
  private isRunning = false;
  private measurementInterval: ReturnType<typeof setInterval> | null = null;
  private gpsInterval: ReturnType<typeof setInterval> | null = null;
  private poiInterval: ReturnType<typeof setInterval> | null = null;
  private gpsIndex = 0;
  private measurementCount = 0;
  private poiCount = 0;
  private demoSurveyId: string | null = null;
  private baseHeight = 5.2;
  private subscribers: Set<() => void> = new Set();

  get isActive(): boolean {
    return this.isRunning;
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach(cb => cb());
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[DemoRuntime] Starting demo simulation with full app integration');
    this.isRunning = true;
    this.gpsIndex = 0;
    this.measurementCount = 0;
    this.poiCount = 0;
    this.baseHeight = 5.2;

    try {
      await this.createDemoSurvey();
      this.startGPSSimulation();
      this.startMeasurementSimulation();
      this.startPOISimulation();
      useLoggingStore.getState().startLogging();
      this.notify();
    } catch (error) {
      console.error('[DemoRuntime] Failed to start:', error);
      this.isRunning = false;
    }
  }

  private async createDemoSurvey(): Promise<void> {
    const surveyStore = useSurveyStore.getState();
    
    try {
      await surveyStore.createSurvey({
        surveyTitle: 'Demo Survey - Bridge Clearance Route',
        name: 'Demo Survey - Bridge Clearance Route',
        surveyorName: 'Demo User',
        surveyor: 'Demo User',
        clientName: 'MeasurePRO Demo',
        customerName: 'MeasurePRO Demo',
        projectNumber: 'DEMO-001',
        description: 'Interactive demonstration of MeasurePRO capabilities',
        originAddress: 'Brisbane CBD',
        destinationAddress: 'Industrial Zone',
        notes: 'This is a demonstration survey showing real-time measurement and POI capture',
      });

      const activeSurvey = useSurveyStore.getState().activeSurvey;
      if (activeSurvey) {
        this.demoSurveyId = activeSurvey.id;
        console.log('[DemoRuntime] Created demo survey:', this.demoSurveyId);
        
        const feed = getMeasurementFeed();
        await feed.init(this.demoSurveyId);
        console.log('[DemoRuntime] MeasurementFeed initialized for demo survey');
      }
    } catch (error) {
      console.error('[DemoRuntime] Failed to create demo survey:', error);
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('[DemoRuntime] Stopping demo simulation');
    this.isRunning = false;

    if (this.measurementInterval) {
      clearInterval(this.measurementInterval);
      this.measurementInterval = null;
    }
    if (this.gpsInterval) {
      clearInterval(this.gpsInterval);
      this.gpsInterval = null;
    }
    if (this.poiInterval) {
      clearInterval(this.poiInterval);
      this.poiInterval = null;
    }

    useAlertsStore.getState().clearAlert();
    soundManager.stopSound('warning');
    soundManager.stopSound('critical');

    useGPSStore.setState({
      connected: false,
      data: {
        time: '--:--:--',
        latitude: 0,
        longitude: 0,
        altitude: 0,
        speed: 0,
        course: 0,
        satellites: 0,
        fixQuality: 'No Fix',
        hdop: 0,
        lastUpdate: 0,
        rawNMEA: [],
        source: 'none'
      }
    });

    useSerialStore.setState({
      lastMeasurement: '--',
      currentMeasurement: '--'
    });

    const feed = getMeasurementFeed();
    feed.resetCache();

    localStorage.removeItem('demo_mode');
    this.demoSurveyId = null;
    this.notify();
  }

  private startGPSSimulation(): void {
    const updateGPS = () => {
      const point = DEMO_GPS_PATH[this.gpsIndex % DEMO_GPS_PATH.length];
      const jitter = {
        lat: point.lat + (Math.random() - 0.5) * 0.0001,
        lng: point.lng + (Math.random() - 0.5) * 0.0001,
      };

      useGPSStore.getState().updateData({
        latitude: jitter.lat,
        longitude: jitter.lng,
        altitude: 15 + Math.random() * 5,
        speed: point.speed + (Math.random() - 0.5) * 5,
        course: (this.gpsIndex * 36) % 360,
        satellites: 10 + Math.floor(Math.random() * 4),
        fixQuality: 'DGPS Fix',
        hdop: 0.8 + Math.random() * 0.4,
        time: new Date().toTimeString().split(' ')[0],
        source: 'serial'
      });

      this.gpsIndex++;
    };

    updateGPS();
    this.gpsInterval = setInterval(updateGPS, 1000);
  }

  private startMeasurementSimulation(): void {
    const addMeasurement = () => {
      const variation = (Math.random() - 0.5) * 0.3;
      const height = this.baseHeight + variation;
      
      const serialStore = useSerialStore.getState();
      useSerialStore.setState({
        lastMeasurement: height.toFixed(2),
        currentMeasurement: height.toFixed(2),
        measurementSampleId: serialStore.measurementSampleId + 1
      });

      this.measurementCount++;
      this.notify();
    };

    this.measurementInterval = setInterval(addMeasurement, 500);
  }

  private startPOISimulation(): void {
    const capturePOI = async () => {
      if (!this.demoSurveyId) return;

      const scenario = DEMO_POI_SCENARIOS[this.poiCount % DEMO_POI_SCENARIOS.length];
      const gpsPoint = DEMO_GPS_PATH[this.gpsIndex % DEMO_GPS_PATH.length];
      
      const now = new Date();
      const measurementId = `demo-poi-${Date.now()}-${this.poiCount}`;
      
      const measurement: Measurement = {
        id: measurementId,
        rel: scenario.height,
        altGPS: 15 + Math.random() * 5,
        latitude: gpsPoint.lat + (Math.random() - 0.5) * 0.0002,
        longitude: gpsPoint.lng + (Math.random() - 0.5) * 0.0002,
        utcDate: now.toISOString().split('T')[0],
        utcTime: now.toTimeString().split(' ')[0],
        speed: gpsPoint.speed,
        heading: (this.gpsIndex * 36) % 360,
        roadNumber: null,
        poiNumber: this.poiCount + 1,
        note: `Demo POI: ${scenario.label}`,
        createdAt: now.toISOString(),
        user_id: this.demoSurveyId,
        source: 'manual',
        poi_type: scenario.poiType,
        imageUrl: null,
        images: [],
        measurementFree: false,
      };

      const feed = getMeasurementFeed();
      feed.addMeasurement(measurement);
      
      console.log(`[DemoRuntime] Added POI ${this.poiCount + 1}: ${scenario.label} (${scenario.height}m)`);

      try {
        await soundManager.playLogEntry();
      } catch (e) {
      }

      if (scenario.alert === 'critical') {
        useAlertsStore.getState().setAlertStatus('critical');
        useAlertsStore.getState().setTriggerValue(scenario.height);
        try {
          await soundManager.playCritical();
        } catch (e) {
        }
        
        setTimeout(() => {
          useAlertsStore.getState().clearAlert();
          soundManager.stopSound('critical');
        }, 3000);
      } else if (scenario.alert === 'warning') {
        useAlertsStore.getState().setAlertStatus('warning');
        useAlertsStore.getState().setTriggerValue(scenario.height);
        try {
          await soundManager.playWarning();
        } catch (e) {
        }
        
        setTimeout(() => {
          useAlertsStore.getState().clearAlert();
          soundManager.stopSound('warning');
        }, 2000);
      }

      this.poiCount++;
      
      const surveyStore = useSurveyStore.getState();
      if (surveyStore.activeSurvey) {
        surveyStore.setActiveSurvey({
          ...surveyStore.activeSurvey,
          poiCount: this.poiCount
        });
      }
      
      this.notify();
    };

    setTimeout(() => {
      capturePOI();
      this.poiInterval = setInterval(capturePOI, 6000);
    }, 2000);
  }
}

export const demoRuntime = new DemoRuntime();

export function useDemoRuntime() {
  const { useState, useEffect } = require('react');
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = demoRuntime.subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);

  return {
    isActive: demoRuntime.isActive,
    start: () => demoRuntime.start(),
    stop: () => demoRuntime.stop(),
  };
}
