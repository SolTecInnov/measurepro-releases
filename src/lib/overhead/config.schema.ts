import { z } from 'zod';

export const EventCfg = z.object({
  dStart: z.number().min(0.05).max(1.5),
  dEnd: z.number().min(0.05).max(1.5),
  tEndMs: z.number().min(100).max(1500),
  winEventMaxM: z.number().min(5).max(200),
  winCouloirM: z.number().min(3).max(100).optional(),
  minSepWireM: z.number().min(0.1).max(2.0).optional(),
  minDropForLocal: z.number().min(0.05).max(1.0).optional(),
  maxWiresHV: z.number().min(1).max(3).optional(),
});

export const WatchdogCfg = z.object({
  laserMinHz: z.number().min(1).max(30).default(8),
  laserTimeoutMs: z.number().min(500).max(5000).default(2000),
  gpsTimeoutMs: z.number().min(1000).max(10000).default(3000),
  abortOnTimeout: z.boolean().default(true)
});

export const GlobalCfg = z.object({
  maxRangeM: z.number().min(5).max(200).default(30),
  skyDistanceM: z.number().min(30).max(200).default(50),
  skyNearMaxFrac: z.number().min(0.95).max(0.995).default(0.98),
  skyMinBeforeStartMs: z.number().min(50).max(500).default(80),
  solidMinToStartMs: z.number().min(50).max(500).default(80),
  baselineAlphaSky: z.number().min(0.01).max(0.2).default(0.08),
  baselineAlphaObject: z.number().min(0.01).max(0.1).default(0.03),
  fusionHz: z.number().min(5).max(30).default(15),
  lowSpeedKph: z.number().min(0).max(40).default(15),
  highwayKph: z.number().min(30).max(130).default(60),
  cityMode: z.boolean().default(false),
  winCouloirM_city: z.number().min(5).max(100).default(20),
  minDropForLocal_city: z.number().min(0.05).max(1.0).default(0.20),
  maxUtilLogsPer100m: z.number().min(0).max(10).default(1),
  minPOIDistM_city: z.number().min(0).max(200).default(40),
  hvIgnoreIfAboveM: z.number().min(0).max(30).default(9.0),
  dMinEpsilon: z.number().min(0.02).max(0.10).default(0.04),
  counterThreshold: z.number().min(5).max(20).default(10),
  bufferUseDistance: z.boolean().default(false),
  bufferDistanceM: z.number().min(5).max(500).default(50),
  bufferTimeSeconds: z.number().min(1).max(30).default(5),
  detectionPOIType: z.string().default('overhead'),
  watchdog: WatchdogCfg.default({
    laserMinHz: 8,
    laserTimeoutMs: 2000,
    gpsTimeoutMs: 3000,
    abortOnTimeout: true
  }),
  hotkeys: z.record(
    z.enum(['bridge','gantry','tree_canopy','wires_util','wires_hv','overhead']),
    z.string()
  ).optional()
});

export const AppCfg = z.object({
  version: z.string(),
  profileName: z.string(),
  events: z.object({
    bridge: EventCfg,
    gantry: EventCfg,
    tree_canopy: EventCfg,
    wires_util: EventCfg,
    wires_hv: EventCfg,
    overhead: EventCfg
  }),
  global: GlobalCfg
});

export type TEventCfg = z.infer<typeof EventCfg>;
export type TGlobalCfg = z.infer<typeof GlobalCfg>;
export type TWatchdogCfg = z.infer<typeof WatchdogCfg>;
export type TAppCfg = z.infer<typeof AppCfg>;

export const DefaultConfig: TAppCfg = {
  version: '1.0.0',
  profileName: 'Fair Weather',
  events: {
    bridge: { dStart: 0.30, dEnd: 0.20, tEndMs: 300, winEventMaxM: 100 },
    gantry: { dStart: 0.30, dEnd: 0.20, tEndMs: 300, winEventMaxM: 100 },
    tree_canopy: { dStart: 0.35, dEnd: 0.22, tEndMs: 350, winEventMaxM: 100 },
    wires_util: {
      dStart: 0.30, dEnd: 0.20, tEndMs: 300, winEventMaxM: 100,
      winCouloirM: 10, minSepWireM: 0.25, minDropForLocal: 0.12, maxWiresHV: 1
    },
    wires_hv: {
      dStart: 0.30, dEnd: 0.20, tEndMs: 300, winEventMaxM: 100,
      winCouloirM: 10, minSepWireM: 0.25, minDropForLocal: 0.12, maxWiresHV: 3
    },
    overhead: { dStart: 0.30, dEnd: 0.20, tEndMs: 300, winEventMaxM: 100 }
  },
  global: {
    maxRangeM: 30,
    skyDistanceM: 50,
    skyNearMaxFrac: 0.98,
    skyMinBeforeStartMs: 80,
    solidMinToStartMs: 80,
    baselineAlphaSky: 0.08,
    baselineAlphaObject: 0.03,
    fusionHz: 15,
    lowSpeedKph: 15,
    highwayKph: 60,
    cityMode: false,
    winCouloirM_city: 20,
    minDropForLocal_city: 0.20,
    maxUtilLogsPer100m: 1,
    minPOIDistM_city: 40,
    hvIgnoreIfAboveM: 9.0,
    dMinEpsilon: 0.04,
    counterThreshold: 10,
    bufferUseDistance: false,
    bufferDistanceM: 50,
    bufferTimeSeconds: 5,
    detectionPOIType: 'overhead',
    watchdog: {
      laserMinHz: 8,
      laserTimeoutMs: 2000,
      gpsTimeoutMs: 3000,
      abortOnTimeout: true
    }
  }
};
