export class DemoDataInjector {
  private laserInterval: ReturnType<typeof setInterval> | null = null;
  private gpsInterval: ReturnType<typeof setInterval> | null = null;
  private baseHeight = 5.2;
  private gpsIndex = 0;
  private measurementCallback: ((data: LaserData) => void) | null = null;
  private gpsCallback: ((data: GPSData) => void) | null = null;

  private gpsPath = [
    { lat: -27.4698, lng: 153.0251 },
    { lat: -27.4695, lng: 153.0255 },
    { lat: -27.4690, lng: 153.0260 },
    { lat: -27.4685, lng: 153.0258 },
    { lat: -27.4680, lng: 153.0252 },
    { lat: -27.4678, lng: 153.0245 },
    { lat: -27.4682, lng: 153.0240 },
    { lat: -27.4688, lng: 153.0238 },
    { lat: -27.4695, lng: 153.0242 },
    { lat: -27.4698, lng: 153.0248 },
  ];

  start(
    onMeasurement: (data: LaserData) => void,
    onGPS: (data: GPSData) => void
  ) {
    this.measurementCallback = onMeasurement;
    this.gpsCallback = onGPS;

    this.laserInterval = setInterval(() => {
      const variation = (Math.random() - 0.5) * 0.4;
      const height = this.baseHeight + variation;
      
      if (this.measurementCallback) {
        this.measurementCallback({
          height: parseFloat(height.toFixed(3)),
          timestamp: Date.now(),
          unit: 'm',
        });
      }
    }, 200);

    this.gpsInterval = setInterval(() => {
      const point = this.gpsPath[this.gpsIndex % this.gpsPath.length];
      const jitter = {
        lat: point.lat + (Math.random() - 0.5) * 0.0001,
        lng: point.lng + (Math.random() - 0.5) * 0.0001,
      };
      
      if (this.gpsCallback) {
        this.gpsCallback({
          latitude: jitter.lat,
          longitude: jitter.lng,
          accuracy: 2 + Math.random() * 3,
          speed: 5 + Math.random() * 10,
          heading: (this.gpsIndex * 36) % 360,
          timestamp: Date.now(),
        });
      }
      
      this.gpsIndex++;
    }, 1000);
  }

  stop() {
    if (this.laserInterval) {
      clearInterval(this.laserInterval);
      this.laserInterval = null;
    }
    if (this.gpsInterval) {
      clearInterval(this.gpsInterval);
      this.gpsInterval = null;
    }
    this.gpsIndex = 0;
    this.measurementCallback = null;
    this.gpsCallback = null;
  }

  generatePOI(index: number) {
    const point = this.gpsPath[index % this.gpsPath.length];
    return {
      id: `demo-poi-${index}`,
      height: this.baseHeight + (Math.random() - 0.5) * 0.5,
      latitude: point.lat,
      longitude: point.lng,
      timestamp: Date.now(),
      type: index % 3 === 0 ? 'critical' : 'normal',
    };
  }
}

export interface LaserData {
  height: number;
  timestamp: number;
  unit: string;
}

export interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp: number;
}

export const demoDataInjector = new DemoDataInjector();
