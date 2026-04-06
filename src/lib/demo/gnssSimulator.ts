/**
 * GNSS Training Simulator
 * Injects realistic Duro RTK data into gpsStore for classroom training
 * without any physical hardware or antenna.
 *
 * Simulates a full survey run including:
 *  - Fix quality warm-up sequence (No Fix → GPS → DGPS → RTK Float → RTK Fixed)
 *  - Flat approach with low banking
 *  - Right-hand curve with progressive banking (up to ~4°)
 *  - Straight hill climb (+6–7% grade)
 *  - Concave K-factor transition near summit
 *  - Convex K-factor transition on descent
 *  - Left-hand curve on descent with negative banking
 *  - Flat destination approach
 */

import { useGPSStore } from '../stores/gpsStore';

interface RouteWaypoint {
  lat: number;
  lng: number;
  alt: number;   // metres ASL
  roll: number;  // banking angle, degrees (+ve = right side up)
  pitch: number; // grade angle, degrees
  speed: number; // km/h
  heading: number; // degrees true north
}

// A realistic road profile around Brisbane, QLD heading into the hills.
// The route is designed to showcase every GNSS profiling concept in one run.
const TRAINING_ROUTE: RouteWaypoint[] = [
  // Flat urban approach – heading roughly north-east
  { lat: -27.4780, lng: 153.0230, alt: 12, roll:  0.2, pitch:  0.4, speed: 60, heading: 355 },
  { lat: -27.4760, lng: 153.0228, alt: 13, roll:  0.1, pitch:  0.7, speed: 62, heading: 358 },
  { lat: -27.4742, lng: 153.0227, alt: 14, roll:  0.2, pitch:  0.9, speed: 63, heading:   1 },

  // Right-hand curve begins – banking builds
  { lat: -27.4724, lng: 153.0232, alt: 16, roll:  1.8, pitch:  1.2, speed: 58, heading:   8 },
  { lat: -27.4708, lng: 153.0241, alt: 19, roll:  3.1, pitch:  1.6, speed: 54, heading:  18 },
  { lat: -27.4696, lng: 153.0253, alt: 22, roll:  4.0, pitch:  2.0, speed: 50, heading:  28 },

  // Curve apex – max banking, speed lowest
  { lat: -27.4689, lng: 153.0264, alt: 25, roll:  4.3, pitch:  2.2, speed: 47, heading:  36 },

  // Curve exits – banking reduces
  { lat: -27.4682, lng: 153.0274, alt: 28, roll:  3.0, pitch:  2.1, speed: 51, heading:  44 },
  { lat: -27.4675, lng: 153.0282, alt: 31, roll:  1.4, pitch:  2.0, speed: 54, heading:  51 },

  // Straight hill climb – grade increases
  { lat: -27.4664, lng: 153.0287, alt: 38, roll:  0.4, pitch:  5.2, speed: 50, heading:  55 },
  { lat: -27.4651, lng: 153.0292, alt: 47, roll:  0.3, pitch:  6.5, speed: 46, heading:  56 },
  { lat: -27.4638, lng: 153.0297, alt: 56, roll:  0.2, pitch:  7.1, speed: 42, heading:  57 },

  // Concave K-factor transition – grade reduces as we approach the summit
  { lat: -27.4626, lng: 153.0301, alt: 61, roll:  0.3, pitch:  4.5, speed: 46, heading:  58 },
  { lat: -27.4616, lng: 153.0305, alt: 64, roll:  0.5, pitch:  1.8, speed: 50, heading:  59 },

  // Summit / ridge crossing – near-zero grade, highest altitude
  { lat: -27.4608, lng: 153.0309, alt: 65, roll:  0.8, pitch:  0.3, speed: 54, heading:  60 },

  // Convex K-factor transition – grade drops negative quickly
  { lat: -27.4599, lng: 153.0316, alt: 63, roll:  0.6, pitch: -2.8, speed: 57, heading:  62 },
  { lat: -27.4589, lng: 153.0323, alt: 57, roll:  0.4, pitch: -5.5, speed: 60, heading:  63 },
  { lat: -27.4577, lng: 153.0331, alt: 49, roll:  0.3, pitch: -6.8, speed: 63, heading:  64 },

  // Left-hand curve on descent – negative banking
  { lat: -27.4564, lng: 153.0336, alt: 42, roll: -2.2, pitch: -5.2, speed: 61, heading:  58 },
  { lat: -27.4553, lng: 153.0329, alt: 36, roll: -3.6, pitch: -4.5, speed: 59, heading:  50 },
  { lat: -27.4544, lng: 153.0319, alt: 31, roll: -4.0, pitch: -3.8, speed: 57, heading:  41 },
  { lat: -27.4538, lng: 153.0308, alt: 27, roll: -2.8, pitch: -2.8, speed: 59, heading:  33 },

  // Curve exits, flattening
  { lat: -27.4534, lng: 153.0298, alt: 24, roll: -1.1, pitch: -1.5, speed: 62, heading:  26 },
  { lat: -27.4530, lng: 153.0289, alt: 21, roll: -0.3, pitch: -0.8, speed: 65, heading:  20 },

  // Final flat destination approach
  { lat: -27.4527, lng: 153.0281, alt: 19, roll:  0.1, pitch: -0.3, speed: 68, heading:  16 },
  { lat: -27.4524, lng: 153.0274, alt: 18, roll:  0.2, pitch:  0.0, speed: 70, heading:  13 },
];

// Milliseconds between gpsStore updates (same cadence as real duroGpsService)
const UPDATE_INTERVAL_MS = 500;

// How long to dwell at each waypoint (ms) before interpolating to the next
const DWELL_PER_WAYPOINT_MS = 4000;

// Fix-quality warm-up timeline (seconds from start)
const FIX_QUALITY_TIMELINE: Array<{
  afterMs: number;
  quality: 'No Fix' | 'GPS Fix' | 'DGPS Fix' | 'RTK Float' | 'RTK Fixed';
  satellites: number;
  hdop: number;
}> = [
  { afterMs:     0, quality: 'No Fix',    satellites:  0, hdop: 99.9 },
  { afterMs:  3000, quality: 'GPS Fix',   satellites:  7, hdop:  2.1 },
  { afterMs:  8000, quality: 'DGPS Fix',  satellites: 10, hdop:  1.4 },
  { afterMs: 14000, quality: 'RTK Float', satellites: 12, hdop:  0.9 },
  { afterMs: 20000, quality: 'RTK Fixed', satellites: 14, hdop:  0.6 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function noise(amplitude: number): number {
  return (Math.random() - 0.5) * 2 * amplitude;
}

function getFixInfo(elapsedMs: number) {
  let info = FIX_QUALITY_TIMELINE[0];
  for (const step of FIX_QUALITY_TIMELINE) {
    if (elapsedMs >= step.afterMs) info = step;
    else break;
  }
  return info;
}

class GnssSimulator {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private waypointIndex = 0;
  private waypointElapsed = 0;
  private subscribers = new Set<() => void>();

  get isActive(): boolean {
    return this.intervalId !== null;
  }

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify() {
    this.subscribers.forEach(cb => cb());
  }

  start(): void {
    if (this.isActive) return;

    this.startTime = Date.now();
    this.waypointIndex = 0;
    this.waypointElapsed = 0;

    // Immediately push the first frame so the status card lights up
    this.tick();

    this.intervalId = setInterval(() => this.tick(), UPDATE_INTERVAL_MS);
    this.notify();
    console.log('[GnssSimulator] Training simulation started');
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Reset the GPS store so the UI returns to "disconnected"
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
        source: 'none',
        imu: undefined,
        speedKph: 0,
        heading: 0,
        pdop: null,
        vdop: null,
      },
    });

    this.notify();
    console.log('[GnssSimulator] Training simulation stopped');
  }

  private tick(): void {
    const elapsedMs = Date.now() - this.startTime;
    const fixInfo = getFixInfo(elapsedMs);

    // Advance waypoint position
    this.waypointElapsed += UPDATE_INTERVAL_MS;
    if (this.waypointElapsed >= DWELL_PER_WAYPOINT_MS) {
      this.waypointElapsed = 0;
      this.waypointIndex = (this.waypointIndex + 1) % TRAINING_ROUTE.length;
    }

    const t = Math.min(this.waypointElapsed / DWELL_PER_WAYPOINT_MS, 1);
    const from = TRAINING_ROUTE[this.waypointIndex];
    const to   = TRAINING_ROUTE[(this.waypointIndex + 1) % TRAINING_ROUTE.length];

    const lat     = lerp(from.lat,     to.lat,     t) + noise(0.000005);
    const lng     = lerp(from.lng,     to.lng,     t) + noise(0.000005);
    const alt     = lerp(from.alt,     to.alt,     t) + noise(0.08);
    const roll    = lerp(from.roll,    to.roll,    t) + noise(0.15);
    const pitch   = lerp(from.pitch,   to.pitch,   t) + noise(0.1);
    const speed   = lerp(from.speed,   to.speed,   t) + noise(1.5);
    const heading = lerp(from.heading, to.heading, t) + noise(0.5);

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    useGPSStore.getState().updateData({
      source: 'duro',
      time: timeStr,
      latitude: lat,
      longitude: lng,
      altitude: Math.round(alt * 10) / 10,
      speed: Math.max(0, Math.round(speed * 10) / 10),
      speedKph: Math.max(0, Math.round(speed * 10) / 10),
      course: ((heading % 360) + 360) % 360,
      heading: ((heading % 360) + 360) % 360,
      satellites: fixInfo.satellites + (fixInfo.satellites > 0 ? Math.floor(noise(1)) : 0),
      fixQuality: fixInfo.quality,
      hdop: Math.max(0.3, fixInfo.hdop + noise(0.05)),
      pdop: fixInfo.quality !== 'No Fix' ? Math.max(0.5, fixInfo.hdop * 1.3 + noise(0.05)) : null,
      vdop: fixInfo.quality !== 'No Fix' ? Math.max(0.5, fixInfo.hdop * 1.1 + noise(0.05)) : null,
      imu: fixInfo.quality !== 'No Fix' ? {
        roll:    Math.round(roll    * 100) / 100,
        pitch:   Math.round(pitch   * 100) / 100,
        heading: Math.round(((heading % 360) + 360) % 360 * 10) / 10,
        heaveRate: noise(0.02),
        rollAccuracy:    0.05 + Math.random() * 0.05,
        pitchAccuracy:   0.05 + Math.random() * 0.05,
        headingAccuracy: 0.1  + Math.random() * 0.1,
      } : undefined,
      rawNMEA: [],
      lastUpdate: Date.now(),
    });
  }
}

export const gnssSimulator = new GnssSimulator();
