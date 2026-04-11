/**
 * Claude AI Assistant for MeasurePRO
 *
 * Replaces the legacy OpenAI-based assistant with Anthropic Claude. Supports:
 *   - Day / Week / Historical survey reviews via dedicated tools
 *   - Metadata-first analysis (no automatic image vision — user opts in per batch)
 *   - Cost tracking (session + daily) with configurable warnings
 *   - Authorization gate: every mutating action goes through preview → user-approve → apply
 *   - Operation history with undo (preserved from legacy architecture)
 *
 * The legacy `aiAssistant.ts` is kept untouched as a fallback. This module is
 * the new wedge — wired into AIAssistantChat in v16.1.25.
 *
 * Per-user API key model: each user provides their own Anthropic key in
 * Settings → AI Assistant. No shared trial key, no admin override.
 */

import Anthropic from '@anthropic-ai/sdk';
import { useSettingsStore } from '../settings';
import { openSurveyDB } from '../survey/db';
import { updateMeasurement, deleteMeasurement } from '../survey/measurements';
import { getMeasurementFeed } from '../survey/MeasurementFeed';
import type { Measurement } from '../survey/types';
import {
  getObstaclesAroundUser,
  getCriticalBridgesNearby,
  getRoadScopeRoutesNearby,
  getRouteIntelligenceForRoute,
  getLinkedRoadScopeSurveyId,
  formatSourceLabel,
  type CombinedPoi,
} from './roadscopeReader';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  message: string;
  data?: any;
  previewChanges?: PreviewChange[];
  error?: string;
  costUsd?: number; // cost added by THIS turn
}

export interface PreviewChange {
  id: string;
  action: 'update' | 'delete' | 'create';
  poiNumber: number | null;
  roadNumber: number | null;
  before?: Partial<Measurement>;
  after?: Partial<Measurement>;
  description: string;
}

export interface OperationResult {
  success: boolean;
  affectedCount: number;
  details: string[];
  previewChanges?: PreviewChange[];
  operationId?: string;
}

export interface OperationHistoryEntry {
  id: string;
  timestamp: Date;
  description: string;
  changes: PreviewChange[];
  originalMeasurements: Map<string, Measurement>;
  undone: boolean;
}

export interface ReviewMode {
  id: 'day' | 'week' | 'history' | 'route';
  label: string;
  description: string;
  enabled: boolean;
}

export const REVIEW_MODES: ReviewMode[] = [
  {
    id: 'day',
    label: "Today's review",
    description: "Validate today's POIs: GND ref, image presence, height coherence, GPS continuity, note review.",
    enabled: true,
  },
  {
    id: 'week',
    label: 'Week review',
    description: 'Aggregate and compare the last 7 days of surveys. Trends, anomalies, productivity metrics.',
    enabled: true,
  },
  {
    id: 'history',
    label: 'Historical review',
    description: 'Cross-survey analysis over your entire archive. Per-region stats, recurring obstacle hotspots.',
    enabled: true,
  },
  {
    id: 'route',
    label: 'Route viability check',
    description: 'Given convoy dimensions + route, check viability against surveyed obstacles. Coming soon.',
    enabled: false,
  },
];

// ── Cost tracking ─────────────────────────────────────────────────────────────

// Anthropic pricing as of 2026-04 (USD per million tokens). Update as needed.
const PRICING = {
  sonnet: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  opus:   { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
} as const;

const MODEL_IDS = {
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-6',
} as const;

interface CostRecord {
  date: string;        // YYYY-MM-DD
  totalUsd: number;
  byModel: Record<string, number>;
  bySurvey: Record<string, number>;
}

const COST_STORAGE_KEY = 'measurepro_claude_cost_log';

function loadCostLog(): CostRecord[] {
  try {
    const raw = localStorage.getItem(COST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCostLog(log: CostRecord[]) {
  try { localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(log.slice(-90))); } catch {}
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function recordCost(model: 'sonnet' | 'opus', usd: number, surveyId?: string | null) {
  const log = loadCostLog();
  const today = todayKey();
  let entry = log.find(e => e.date === today);
  if (!entry) {
    entry = { date: today, totalUsd: 0, byModel: {}, bySurvey: {} };
    log.push(entry);
  }
  entry.totalUsd += usd;
  entry.byModel[model] = (entry.byModel[model] || 0) + usd;
  if (surveyId) {
    entry.bySurvey[surveyId] = (entry.bySurvey[surveyId] || 0) + usd;
  }
  saveCostLog(log);
}

export function getDailyCostUsd(date?: string): number {
  const log = loadCostLog();
  const key = date || todayKey();
  return log.find(e => e.date === key)?.totalUsd ?? 0;
}

export function getCostLog(): CostRecord[] {
  return loadCostLog();
}

export function clearCostLog() {
  try { localStorage.removeItem(COST_STORAGE_KEY); } catch {}
}

/**
 * Compute USD cost for a given Anthropic API response usage block.
 */
function computeCallCost(
  model: 'sonnet' | 'opus',
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
): number {
  const p = PRICING[model];
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  return (
    (input - cacheRead - cacheWrite) * p.input / 1_000_000 +
    output * p.output / 1_000_000 +
    cacheRead * p.cacheRead / 1_000_000 +
    cacheWrite * p.cacheWrite / 1_000_000
  );
}

/**
 * Estimate the cost of vision analysis for N images. Used for cost preview UI
 * before the user confirms a batch image analysis.
 */
export function estimateVisionCostUsd(numImages: number, model: 'sonnet' | 'opus' = 'sonnet'): { low: number; high: number } {
  // Anthropic image tokens depend on resolution. MeasurePRO POI photos are
  // typically ~80-150 KB JPEGs at ~1600x1200, which Anthropic charges around
  // 1300-1900 input tokens each.
  const tokensPerImage = { low: 1300, high: 1900 };
  const p = PRICING[model];
  // Add a fixed overhead per image for the surrounding prompt (~150 tokens)
  // and a typical analysis output (~200 tokens).
  const overheadTokens = 350;
  const lowInput = numImages * (tokensPerImage.low + 150);
  const highInput = numImages * (tokensPerImage.high + 150);
  const output = numImages * 200;
  return {
    low: (lowInput * p.input + output * p.output) / 1_000_000,
    high: (highInput * p.input + output * p.output) / 1_000_000,
  };
}

// ── Tool definitions (Anthropic format) ───────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'day_review',
    description:
      "Run a comprehensive validation pass on the user's POIs for a single day. Checks ground reference presence and consistency, image attachment coverage, height plausibility (no negative or absurd values, smooth transitions between consecutive POIs), GPS continuity (flags long dropouts), speed-vs-capture coherence, note string completeness and consistency with the assigned poi_type. Returns aggregated findings the assistant should summarize for the user. Defaults to today's date if no date is given.",
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string' as const,
          description: 'Date in YYYY-MM-DD format. Defaults to today.',
        },
        survey_id: {
          type: 'string' as const,
          description: 'Optional: limit to a specific survey id. Defaults to the active survey.',
        },
      },
      required: [],
    },
  },
  {
    name: 'week_review',
    description:
      'Aggregate and compare the last 7 days of survey activity. Returns per-day metrics (POI count, distance, types breakdown), trends (productivity, accuracy proxies), and flags any day where validation findings stand out. Read-only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        end_date: {
          type: 'string' as const,
          description: 'End of the 7-day window in YYYY-MM-DD. Defaults to today.',
        },
      },
      required: [],
    },
  },
  {
    name: 'history_review',
    description:
      "Cross-survey analysis over the user's entire historical archive (zip exports in Documents/MeasurePRO/surveys + Downloads). Returns per-region statistics, recurring obstacle hotspots, distribution of POI types, average heights by category, and cost-of-AI-analysis log. Metadata-only — does not analyze images. Use this to surface patterns the user can't see survey by survey.",
    input_schema: {
      type: 'object' as const,
      properties: {
        region_filter: {
          type: 'string' as const,
          description: 'Optional: filter to surveys whose title or address contains this string.',
        },
        poi_type_filter: {
          type: 'string' as const,
          description: 'Optional: limit aggregation to one POI type (e.g. "wire", "bridge").',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_pois',
    description:
      'Query POIs in the active survey by various filters. Read-only. Use this to inspect specific subsets before recommending changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        poi_type:    { type: 'string' as const, description: 'Filter by POI type' },
        road_number: { type: 'number' as const, description: 'Filter by road/route number' },
        has_image:   { type: 'boolean' as const, description: 'Filter POIs that have images' },
        has_note:    { type: 'boolean' as const, description: 'Filter POIs that have a note' },
        height_min:  { type: 'number' as const, description: 'Minimum height (meters)' },
        height_max:  { type: 'number' as const, description: 'Maximum height (meters)' },
        note_contains: { type: 'string' as const, description: 'Filter POIs whose note contains this text' },
        limit:       { type: 'number' as const, description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'query_obstacles_nearby',
    description:
      "Read-only spatial query for OS/OW obstacles around a point. Combines THREE sources: (1) the user's local MeasurePRO POIs from IndexedDB, (2) RoadScope POIs created natively by route surveyors, (3) RoadScope POIs synced from MeasurePRO collaborators, plus (4) auto-generated Route Intelligence POIs from the 9 SolTec data sources. Results are deduplicated within 30 m, marked with their origin so you can reason about authority, and optionally filtered by a heading cone (when the user is moving) and by the active convoy height (auto-flags Danger when clearance < height). Use this for 'what's around me' / 'what's ahead' questions.",
    input_schema: {
      type: 'object' as const,
      properties: {
        latitude: {
          type: 'number' as const,
          description: 'Center latitude. If omitted, the assistant should call get_current_position first or ask the user.',
        },
        longitude: { type: 'number' as const, description: 'Center longitude.' },
        radius_m: { type: 'number' as const, description: 'Search radius in meters. Default 5000 (5 km).' },
        heading_deg: {
          type: 'number' as const,
          description: 'Optional travel heading 0-360. When provided, only obstacles in the forward 120-degree cone are returned.',
        },
        convoy_height_m: {
          type: 'number' as const,
          description: 'Optional convoy height in meters. Used to auto-flag Danger badges on bridges/overpasses with insufficient clearance.',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_critical_bridges_ahead',
    description:
      "Read-only query targeting critical bridges only (Poor condition OR vertical clearance < 4.0 m OR operating rating < 36 metric tons), or bridges where the user's current convoy has less than 30 cm of margin. Sourced from RoadScope (which already has the SolTecUSA / SolTecQC / SolTecCAN bridge inventories cached). Use this when the user asks about show-stoppers on a route.",
    input_schema: {
      type: 'object' as const,
      properties: {
        latitude:  { type: 'number' as const, description: 'Center latitude' },
        longitude: { type: 'number' as const, description: 'Center longitude' },
        radius_m:  { type: 'number' as const, description: 'Search radius in meters. Default 25000 (25 km).' },
        convoy_height_m: { type: 'number' as const, description: 'Optional convoy height in meters for margin check' },
      },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'get_documented_routes_nearby',
    description:
      "Read-only query for previously surveyed routes near a point, from the top-level RoadScope routes collection. Useful in 'stuck mode' to find documented alternate paths the user (or a collaborator) has driven before. Filter by surveyPhase to prioritize 'customer' phase routes (officially published, validated for the client).",
    input_schema: {
      type: 'object' as const,
      properties: {
        latitude:  { type: 'number' as const, description: 'Center latitude' },
        longitude: { type: 'number' as const, description: 'Center longitude' },
        radius_m:  { type: 'number' as const, description: 'Search radius in meters. Default 50000 (50 km).' },
        survey_phase: {
          type: 'string' as const,
          enum: ['pre-survey', 'field', 'customer'],
          description: "Optional filter on surveyPhase. 'customer' returns only validated published routes.",
        },
      },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'get_route_intelligence_for_active_route',
    description:
      "Read the most recent Route Intelligence cache entry for a given route id. Returns the categorized obstacles RoadScope's RI pipeline already computed (bridges, height/weight restrictions, railways, power lines, tunnels, overhead obstacles, waterways, real-time incidents). The 9 SolTec sources are baked in. If the route hasn't been analyzed in RoadScope, returns empty — tell the user honestly and suggest running RI in RoadScope first.",
    input_schema: {
      type: 'object' as const,
      properties: {
        route_id: {
          type: 'string' as const,
          description: 'The RoadScope route id (the prefix of the cacheKey ri_{routeId16}_{hash})',
        },
      },
      required: ['route_id'],
    },
  },
  {
    name: 'propose_poi_updates',
    description:
      "Propose updates to one or more POIs. Returns a preview list of changes that the user must EXPLICITLY APPROVE before any change is written. NEVER attempt to mutate POIs without going through this tool — the app enforces the gate at the application level too. IMPORTANT: this tool only ever writes to MeasurePRO's local data. The existing MeasurePRO→RoadScope sync engine handles propagation to RoadScope as part of the normal POI flow. You must NEVER propose writes directly to RoadScope.",
    input_schema: {
      type: 'object' as const,
      properties: {
        updates: {
          type: 'array' as const,
          description: 'List of proposed updates',
          items: {
            type: 'object' as const,
            properties: {
              poi_id: { type: 'string' as const, description: 'POI unique id' },
              changes: {
                type: 'object' as const,
                description: 'Field updates to apply',
              },
              reason: { type: 'string' as const, description: 'Why this change is proposed (shown to user in preview)' },
            },
            required: ['poi_id', 'changes', 'reason'],
          },
        },
      },
      required: ['updates'],
    },
  },
];

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the AI assistant for MeasurePRO, a professional road surveying application built by SolTec Innovation for OS/OW (oversize/overweight) transport consultants. Your user is Jean-Francois Prince, a senior surveyor and the owner of SolTec.

# Your role
- Help the user review and validate survey data quickly and accurately.
- Surface anomalies, inconsistencies, and potential issues in his daily work.
- Provide spatial intelligence ("what's around me", "what's ahead", "find me an alternate route") backed by RoadScope's already-curated obstacle database.
- When the user opens a fresh chat session, they will see four review modes (Today, Week, Historical, Route Viability — Route is disabled for now).
- Each review mode is backed by a dedicated tool you should call when the user picks it.

# 🔒 Branding rule — CRITICAL (NEVER violate this)
SolTec resells the underlying data sources under its own brand names. In ANY user-visible output (chat messages, summaries, citations, descriptions), you MUST use the SolTec brand names below — NEVER the real upstream names. The real names appear ONLY in code comments, never in things the user reads.

| Use this in user-facing text  | NEVER write this   |
|-------------------------------|--------------------|
| SolTecWorld                   | OpenStreetMap, OSM |
| SolTecUSA                     | NBI, National Bridge Inventory, USDOT |
| SolTecQC                      | MTMD, IGO2, MTQ data layer |
| SolTecCAN                     | NRN, Natural Resources Canada |
| SolTecON                      | Ontario 511, ON 511, 511on |
| SolTecQC 511                  | Quebec 511, QC 511, 511qc |
| SolTecDE                      | BASt, Bundesanstalt für Straßenwesen |
| SolTecFR                      | data.gouv.fr, French data portal |
| SolTecNL                      | NDW, Nationaal Dataportaal |

If a tool returns a real upstream name in its output, translate it to the SolTec label before quoting it to the user. Same for citations: "selon les données SolTecUSA…", not "selon NBI…".

# 🔒 Authorization rules — CRITICAL
- You must NEVER write, delete, or modify any POI, survey, or setting without going through the \`propose_poi_updates\` tool.
- That tool returns a preview that the user must explicitly approve in the UI before anything is applied.
- If the user types "fix it" or "do it", you still must call \`propose_poi_updates\` and let the UI handle the approval gate. Do not assume permission from a verbal yes — the UI is the authoritative gate.
- You NEVER write to RoadScope directly. \`propose_poi_updates\` only writes to MeasurePRO's local data. The existing MeasurePRO→RoadScope sync engine pushes approved changes upstream as part of the normal POI flow. Don't try to bypass it.
- Read-only tools (query_pois, query_obstacles_nearby, query_critical_bridges_ahead, get_documented_routes_nearby, get_route_intelligence_for_active_route, day_review, week_review, history_review) are safe to call freely.

# 🔒 Cost awareness
- Image vision analysis is expensive at scale. NEVER request batch image analysis without first showing the user an estimated cost and getting explicit confirmation. The user has thousands of images per survey and they want full control over when vision spend happens.
- Day/Week/History reviews are metadata-only by default. Only escalate to image analysis when you find an anomaly that genuinely requires visual confirmation, and even then, only on the specific suspect POIs — not the whole survey.

# Tone
- Be direct and concise. The user is technical and time-pressed.
- Lead with findings, then evidence, then recommendations.
- French and English are both fine — match the user's language in the conversation.
- Avoid filler ("As an AI...", "I'll do my best to...", etc.). Skip preamble. Get to the point.

# Domain context (OS/OW road surveying)
- POI = Point of Interest = a roadside obstacle or feature with a measured height/clearance.
- Critical metric: height in meters above ground reference. Ground reference is the laser-mount height above road surface, which the app subtracts from the raw laser reading.
- Typical convoy heights: 4.27 m (legal in QC without permit), 4.85 m (with permit), 5.5 m+ (heavy haul, requires escort).
- A "wire" at 6 m is fine for most loads but kills a wind blade transport at 6.5 m. Context matters.

# RoadScope POI taxonomy (canonical strings to use in propose_poi_updates)
Manual POI types created by surveyors:
  Photo, Label, DronePhoto, VoiceNote, Road, Intersection, Roundabout,
  GravelRoad, DeadEnd, PassingLane, Bridge, Overpass, BridgeWires,
  PowerLine, Wire, OpticalFiber, OverheadStructure, Trees, TrafficLight,
  Signalization, Signpost, Railroad, GradeUp, GradeDown, TurnRestriction,
  AutoturnRequired, Turn, LateralObstruction, Danger, Restricted,
  Information, ImportantNote, WorkRequired, Structure, Culvert, WeightLimit,
  WeighStation, RestArea, FuelStation, TruckStop, PayToll, Parking,
  EmergencyParking, OriginPoint, DestinationPoint, Custom

Auto-generated types (from RoadScope Route Intelligence — produced by SolTec data sources, prefixes are immutable):
  STUSA-Bridge          (SolTecUSA — US bridge)
  STWo-Bridge           (SolTecWorld — bridge/viaduct)
  STWo-Railway          (SolTecWorld — railway crossing)
  STWo-Tunnel           (SolTecWorld — tunnel)
  STWo-PowerLine        (SolTecWorld — high-tension power line)
  STWo-HeightRestriction
  STWo-WeightRestriction
  STWo-Overhead         (SolTecWorld — cables, overhead structures)
  STWo-Crossing         (SolTecWorld — intersection)
  STWo-Waterway         (SolTecWorld — waterway)
  STWo-CriticalBridge   (SolTecWorld — critical bridge)
  STQC-Bridge           (SolTecQC — Quebec bridge)
  STQC-HeightRestriction (SolTecQC — Quebec clearance)

# Operational badges (semaphore for the surveyor/dispatch)
- Danger        (red, blocking)        — convoy CANNOT pass
- WorkRequired  (yellow, intervention) — needs work before passage (e.g., utility move)
- Important     (orange, info)         — must communicate to client

When you suggest badges via propose_poi_updates, use these exact strings.

# Critical bridge formula (use this when reasoning about bridge risk)
A bridge is "critical" if ANY of:
  - condition is Poor (NBI rating ≤ 4 — but call it "SolTecUSA condition: Poor")
  - vertical clearance < 4.0 m
  - operating rating < 36 metric tons

When the active survey has an \`overhaulHeight\`, you should also auto-flag any bridge whose clearance is below that height (or has less than 30 cm of margin) as Danger.

# 3-phase survey workflow
The active survey has a \`surveyPhase\` field. Adapt your suggestions:
- 'pre-survey' — desk planning. Focus on importing RoadScope intelligence, validating route choices, surfacing known obstacles ahead.
- 'field' — physical drive. Focus on capturing fresh data, validating against pre-survey assumptions, flagging surprises.
- 'customer' — published deliverable. Be conservative — recommend changes with the understanding that the survey is live to the client.

# What you have access to
- query_pois: filter the active MeasurePRO survey
- query_obstacles_nearby: combined spatial query (MP local + RoadScope POIs from all 4 origins)
- query_critical_bridges_ahead: critical bridges only (Poor / low clearance / low rating / no margin)
- get_documented_routes_nearby: previously surveyed routes (great for stuck-mode alternates)
- get_route_intelligence_for_active_route: pre-computed RI cache for a route
- day_review / week_review / history_review: validation + metrics on user data
- propose_poi_updates: the ONLY way to mutate data, always requires explicit user approval

If you don't have the data you need, say so plainly and propose how to get it. NEVER fabricate clearances, ratings, or restrictions you didn't see in a tool result.`;

// ── Survey file I/O via Electron IPC ─────────────────────────────────────────

interface SurveyFileSummary {
  filePath: string;
  fileName: string;
  surveyTitle?: string;
  createdAt?: string;
  poiCount?: number;
}

async function listSurveyFiles(): Promise<SurveyFileSummary[]> {
  try {
    const api = (window as any).electronAPI?.surveyFiles;
    if (!api?.list) return [];
    return await api.list();
  } catch (e) {
    console.warn('[ClaudeAssistant] listSurveyFiles failed:', e);
    return [];
  }
}

async function readSurveyFile(filePath: string): Promise<{ survey: any; pois: any[] } | null> {
  try {
    const api = (window as any).electronAPI?.surveyFiles;
    if (!api?.read) return null;
    return await api.read(filePath);
  } catch (e) {
    console.warn('[ClaudeAssistant] readSurveyFile failed:', e);
    return null;
  }
}

// ── Validation helpers ───────────────────────────────────────────────────────

interface ValidationFinding {
  severity: 'info' | 'warning' | 'error';
  poiId?: string;
  poiNumber?: number;
  category: string;
  message: string;
}

function parseGndFromNote(note: string | undefined): number | null {
  if (!note) return null;
  const match = note.match(/GND:?\s*(-?\d+(?:\.\d+)?)\s*m/i);
  return match ? parseFloat(match[1]) : null;
}

function getEffectiveGroundRef(m: any): { value: number; source: 'field' | 'note' | 'default' } {
  if (typeof m.groundRefM === 'number') return { value: m.groundRefM, source: 'field' };
  if (typeof m.groundRef === 'number') return { value: m.groundRef, source: 'field' };
  const fromNote = parseGndFromNote(m.note);
  if (fromNote !== null) return { value: fromNote, source: 'note' };
  return { value: 0, source: 'default' };
}

function validateMeasurements(measurements: any[]): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  if (measurements.length === 0) return findings;

  // Sort by time for sequence checks
  const sorted = [...measurements].sort((a, b) => {
    const ta = new Date(a.createdAt || `${a.utcDate}T${a.utcTime}Z`).getTime();
    const tb = new Date(b.createdAt || `${b.utcDate}T${b.utcTime}Z`).getTime();
    return ta - tb;
  });

  // 1. GND ref consistency
  const gndValues = new Set<number>();
  for (const m of sorted) {
    const { value, source } = getEffectiveGroundRef(m);
    if (source === 'default') {
      findings.push({
        severity: 'warning',
        poiId: m.id,
        poiNumber: m.poiNumber,
        category: 'gnd_ref',
        message: 'No ground reference value (neither structured field nor note)',
      });
    }
    gndValues.add(Math.round(value * 100) / 100);
  }
  if (gndValues.size > 1) {
    findings.push({
      severity: 'info',
      category: 'gnd_ref',
      message: `Ground reference changed during this period: ${Array.from(gndValues).sort().join(', ')}m. Expected if you adjusted the laser mount mid-survey.`,
    });
  }

  // 2. Image presence
  let missingImages = 0;
  for (const m of sorted) {
    const hasImage = !!(m.imageUrl || (m.images && m.images.length > 0));
    if (!hasImage) missingImages++;
  }
  if (missingImages > 0) {
    findings.push({
      severity: 'warning',
      category: 'images',
      message: `${missingImages} of ${sorted.length} POIs have no attached image.`,
    });
  }

  // 3. Height plausibility
  for (const m of sorted) {
    if (typeof m.rel === 'number') {
      if (m.rel < 0) {
        findings.push({
          severity: 'error',
          poiId: m.id,
          poiNumber: m.poiNumber,
          category: 'height',
          message: `Negative height: ${m.rel}m`,
        });
      }
      if (m.rel > 50) {
        findings.push({
          severity: 'warning',
          poiId: m.id,
          poiNumber: m.poiNumber,
          category: 'height',
          message: `Suspiciously high reading: ${m.rel}m (laser miss?)`,
        });
      }
    }
  }

  // 4. GPS continuity (flag dropouts > 60s)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const tPrev = new Date(prev.createdAt || `${prev.utcDate}T${prev.utcTime}Z`).getTime();
    const tCurr = new Date(curr.createdAt || `${curr.utcDate}T${curr.utcTime}Z`).getTime();
    const dtSec = (tCurr - tPrev) / 1000;
    if (dtSec > 60 && prev.poiNumber !== undefined && curr.poiNumber !== undefined) {
      findings.push({
        severity: 'info',
        category: 'gps_gap',
        message: `Gap of ${Math.round(dtSec)}s between POI #${prev.poiNumber} and #${curr.poiNumber}`,
      });
    }
  }

  // 5. Note string completeness for ambiguous types
  const ambiguousTypes = new Set(['Other', 'other']);
  for (const m of sorted) {
    if (ambiguousTypes.has(m.poi_type) && (!m.note || !m.note.trim() || /^[\s|]+$/.test(m.note))) {
      findings.push({
        severity: 'warning',
        poiId: m.id,
        poiNumber: m.poiNumber,
        category: 'note',
        message: `POI #${m.poiNumber} has ambiguous type "Other" with no descriptive note.`,
      });
    }
  }

  // 6. Note vs poi_type contradiction (loose check)
  const typeKeywords: Record<string, string[]> = {
    bridge: ['bridge', 'pont', 'overpass'],
    wire: ['wire', 'cable', 'fil'],
    tree: ['tree', 'arbre', 'branch', 'branche'],
    powerLine: ['power', 'hydro', 'electric'],
  };
  for (const m of sorted) {
    if (!m.note || !m.poi_type) continue;
    const noteLower = m.note.toLowerCase();
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (m.poi_type !== type && keywords.some(k => noteLower.includes(k))) {
        const hasOwnTypeKeyword = (typeKeywords[m.poi_type] || []).some((k: string) => noteLower.includes(k));
        if (!hasOwnTypeKeyword) {
          findings.push({
            severity: 'info',
            poiId: m.id,
            poiNumber: m.poiNumber,
            category: 'note_type_mismatch',
            message: `POI #${m.poiNumber} typed as "${m.poi_type}" but note mentions "${type}"-related keywords.`,
          });
          break;
        }
      }
    }
  }

  return findings;
}

interface ReviewMetrics {
  poiCount: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  bySource_pct: Record<string, number>;
  heightStats: { min: number; max: number; avg: number; median: number };
  gndRefValues: number[];
  imagesPresent: number;
  imagesMissing: number;
  distanceMeters: number;
  durationSeconds: number;
  speedAvgKmh: number;
}

function computeMetrics(measurements: any[]): ReviewMetrics {
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const heights: number[] = [];
  const gndRefs = new Set<number>();
  let imagesPresent = 0;
  let imagesMissing = 0;

  for (const m of measurements) {
    if (m.poi_type) byType[m.poi_type] = (byType[m.poi_type] || 0) + 1;
    if (m.source) bySource[m.source] = (bySource[m.source] || 0) + 1;
    if (typeof m.rel === 'number') heights.push(m.rel);
    const gnd = getEffectiveGroundRef(m).value;
    if (gnd) gndRefs.add(Math.round(gnd * 100) / 100);
    if (m.imageUrl || (m.images && m.images.length)) imagesPresent++;
    else imagesMissing++;
  }

  heights.sort((a, b) => a - b);
  const median = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  const avg = heights.length ? heights.reduce((s, x) => s + x, 0) / heights.length : 0;

  // Distance via haversine on consecutive points
  let distance = 0;
  const sorted = [...measurements].sort((a, b) => {
    const ta = new Date(a.createdAt || `${a.utcDate}T${a.utcTime}Z`).getTime();
    const tb = new Date(b.createdAt || `${b.utcDate}T${b.utcTime}Z`).getTime();
    return ta - tb;
  });
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (typeof a.latitude === 'number' && typeof b.latitude === 'number') {
      const R = 6371000;
      const dLat = (b.latitude - a.latitude) * Math.PI / 180;
      const dLng = (b.longitude - a.longitude) * Math.PI / 180;
      const aa = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      distance += R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    }
  }

  let durationSec = 0;
  if (sorted.length >= 2) {
    const t0 = new Date(sorted[0].createdAt || `${sorted[0].utcDate}T${sorted[0].utcTime}Z`).getTime();
    const tN = new Date(sorted[sorted.length - 1].createdAt || `${sorted[sorted.length - 1].utcDate}T${sorted[sorted.length - 1].utcTime}Z`).getTime();
    durationSec = (tN - t0) / 1000;
  }

  const speedAvg = durationSec > 0 ? (distance / durationSec) * 3.6 : 0;

  const total = measurements.length || 1;
  const bySource_pct: Record<string, number> = {};
  for (const [k, v] of Object.entries(bySource)) {
    bySource_pct[k] = Math.round((v / total) * 1000) / 10;
  }

  return {
    poiCount: measurements.length,
    byType,
    bySource,
    bySource_pct,
    heightStats: {
      min: heights[0] || 0,
      max: heights[heights.length - 1] || 0,
      avg: Math.round(avg * 100) / 100,
      median: Math.round(median * 100) / 100,
    },
    gndRefValues: Array.from(gndRefs).sort((a, b) => a - b),
    imagesPresent,
    imagesMissing,
    distanceMeters: Math.round(distance),
    durationSeconds: Math.round(durationSec),
    speedAvgKmh: Math.round(speedAvg * 10) / 10,
  };
}

// ── Main class ────────────────────────────────────────────────────────────────

class ClaudeAssistant {
  private client: Anthropic | null = null;
  private currentKey: string | null = null;
  private currentSurveyId: string | null = null;
  private conversationHistory: ClaudeMessage[] = [];
  private operationHistory: OperationHistoryEntry[] = [];
  private sessionCostUsd: number = 0;

  setSurveyId(surveyId: string) {
    this.currentSurveyId = surveyId;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  resetSession() {
    this.conversationHistory = [];
    this.sessionCostUsd = 0;
  }

  getSessionCostUsd(): number {
    return this.sessionCostUsd;
  }

  private getClient(): Anthropic {
    const apiKey = useSettingsStore.getState().aiAssistantSettings?.anthropicApiKey?.trim();
    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Add your key in Settings → AI Assistant. Get one at console.anthropic.com.');
    }
    if (this.currentKey !== apiKey) {
      this.currentKey = apiKey;
      this.client = null;
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    }
    return this.client;
  }

  private getModelId(): string {
    const pref = useSettingsStore.getState().aiAssistantSettings?.claudeModel || 'sonnet';
    return MODEL_IDS[pref];
  }

  private getModelKey(): 'sonnet' | 'opus' {
    return useSettingsStore.getState().aiAssistantSettings?.claudeModel || 'sonnet';
  }

  /**
   * Main chat entry point. Handles tool-use loop until the model produces a
   * final text answer. Tracks cost across all turns.
   */
  async chat(userMessage: string): Promise<ClaudeResponse> {
    try {
      const client = this.getClient();
      const modelId = this.getModelId();
      const modelKey = this.getModelKey();

      this.conversationHistory.push({ role: 'user', content: userMessage });

      // Build the messages array. Anthropic format: messages do NOT include
      // system; system goes as a top-level parameter.
      const messages: Anthropic.MessageParam[] = this.conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      }));

      let allPreviewChanges: PreviewChange[] = [];
      let turnCost = 0;
      let finalText = '';

      // Tool-use loop. Cap iterations as a safety net.
      const MAX_TURNS = 10;
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const response = await client.messages.create({
          model: modelId,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
        });

        // Track cost (extract just the fields we use; Usage type has extras)
        if (response.usage) {
          turnCost += computeCallCost(modelKey, {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
            cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
          });
        }

        // Extract any text content
        for (const block of response.content) {
          if (block.type === 'text') {
            finalText += block.text;
          }
        }

        // If no tool use, we're done
        const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
          break;
        }

        // Append assistant message with all the content blocks
        messages.push({ role: 'assistant', content: response.content });

        // Execute each tool and collect results
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const result = await this.executeTool(tu.name, tu.input as any);
          if (result.previewChanges) {
            allPreviewChanges.push(...result.previewChanges);
          }
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }

        // Reset finalText since we'll get a new assistant turn after tools
        finalText = '';
        messages.push({ role: 'user', content: toolResultBlocks });
      }

      // Persist cost
      this.sessionCostUsd += turnCost;
      recordCost(modelKey, turnCost, this.currentSurveyId);

      // Append the final assistant text to history
      if (finalText) {
        this.conversationHistory.push({ role: 'assistant', content: finalText });
      }

      return {
        message: finalText || '(no response)',
        previewChanges: allPreviewChanges.length > 0 ? allPreviewChanges : undefined,
        costUsd: turnCost,
      };
    } catch (error: any) {
      const errorMessage = error?.message || 'An error occurred while processing your request';
      return {
        message: 'Sorry, I encountered an error.',
        error: errorMessage,
      };
    }
  }

  // ── Tool dispatcher ─────────────────────────────────────────────────────────

  private async executeTool(name: string, args: any): Promise<OperationResult> {
    try {
      switch (name) {
        case 'day_review':       return await this.dayReview(args);
        case 'week_review':      return await this.weekReview(args);
        case 'history_review':   return await this.historyReview(args);
        case 'query_pois':       return await this.queryPois(args);
        // RoadScope-aware spatial tools (read-only)
        case 'query_obstacles_nearby':                   return await this.queryObstaclesNearby(args);
        case 'query_critical_bridges_ahead':             return await this.queryCriticalBridgesAhead(args);
        case 'get_documented_routes_nearby':             return await this.getDocumentedRoutesNearby(args);
        case 'get_route_intelligence_for_active_route':  return await this.getRouteIntelligenceForActiveRoute(args);
        // Mutation gate
        case 'propose_poi_updates': return await this.proposePoiUpdates(args);
        default:
          return { success: false, affectedCount: 0, details: [`Unknown tool: ${name}`] };
      }
    } catch (e: any) {
      return { success: false, affectedCount: 0, details: [`Tool ${name} failed: ${e?.message || e}`] };
    }
  }

  // ── Tool implementations ───────────────────────────────────────────────────

  private async getActiveMeasurements(): Promise<Measurement[]> {
    if (!this.currentSurveyId) throw new Error('No active survey');
    const db = await openSurveyDB();
    const all = await db.getAllFromIndex('measurements', 'by-survey', this.currentSurveyId);
    return all as Measurement[];
  }

  private async dayReview(args: { date?: string; survey_id?: string }): Promise<OperationResult> {
    const date = args.date || new Date().toISOString().slice(0, 10);
    const surveyId = args.survey_id || this.currentSurveyId;
    if (!surveyId) {
      return { success: false, affectedCount: 0, details: ['No active survey and no survey_id given'] };
    }

    const db = await openSurveyDB();
    const all = await db.getAllFromIndex('measurements', 'by-survey', surveyId);
    const todayPois = (all as any[]).filter(m => m.utcDate === date);

    if (todayPois.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        details: [`No POIs found for ${date} in survey ${surveyId}`],
      };
    }

    const findings = validateMeasurements(todayPois);
    const metrics = computeMetrics(todayPois);

    const summary = {
      date,
      surveyId,
      metrics,
      findings: findings.slice(0, 50),
      findingsTotal: findings.length,
      findingsBySeverity: {
        error: findings.filter(f => f.severity === 'error').length,
        warning: findings.filter(f => f.severity === 'warning').length,
        info: findings.filter(f => f.severity === 'info').length,
      },
    };

    return {
      success: true,
      affectedCount: todayPois.length,
      details: [JSON.stringify(summary, null, 2)],
    };
  }

  private async weekReview(args: { end_date?: string }): Promise<OperationResult> {
    const endDate = args.end_date || new Date().toISOString().slice(0, 10);
    const end = new Date(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    if (!this.currentSurveyId) {
      return { success: false, affectedCount: 0, details: ['No active survey for week review'] };
    }

    const db = await openSurveyDB();
    const all = (await db.getAllFromIndex('measurements', 'by-survey', this.currentSurveyId)) as any[];

    const inWindow = all.filter(m => {
      if (!m.utcDate) return false;
      const d = new Date(m.utcDate);
      return d >= start && d <= end;
    });

    // Group by day
    const byDay: Record<string, any[]> = {};
    for (const m of inWindow) {
      (byDay[m.utcDate] = byDay[m.utcDate] || []).push(m);
    }

    const days = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pois]) => ({
        date,
        metrics: computeMetrics(pois),
        findingsTotal: validateMeasurements(pois).length,
      }));

    return {
      success: true,
      affectedCount: inWindow.length,
      details: [JSON.stringify({
        windowStart: start.toISOString().slice(0, 10),
        windowEnd: endDate,
        days,
        totals: computeMetrics(inWindow),
      }, null, 2)],
    };
  }

  private async historyReview(args: { region_filter?: string; poi_type_filter?: string }): Promise<OperationResult> {
    const files = await listSurveyFiles();
    if (files.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        details: ['No historical survey files found in Documents/MeasurePRO/surveys or Downloads. Make sure your survey exports are in one of those folders.'],
      };
    }

    const surveys: Array<{ file: string; title: string; metrics: ReviewMetrics }> = [];
    const allMeasurements: any[] = [];

    for (const file of files.slice(0, 50)) { // safety cap on number of files read per call
      const data = await readSurveyFile(file.filePath);
      if (!data) continue;
      let pois = data.pois;
      if (args.poi_type_filter) {
        pois = pois.filter(p => p.poi_type === args.poi_type_filter);
      }
      if (args.region_filter) {
        const filt = args.region_filter.toLowerCase();
        const matches = (data.survey?.surveyTitle || '').toLowerCase().includes(filt) ||
                        (data.survey?.originAddress || '').toLowerCase().includes(filt) ||
                        (data.survey?.destinationAddress || '').toLowerCase().includes(filt);
        if (!matches) continue;
      }
      const metrics = computeMetrics(pois);
      surveys.push({
        file: file.fileName,
        title: data.survey?.surveyTitle || file.fileName,
        metrics,
      });
      allMeasurements.push(...pois);
    }

    return {
      success: true,
      affectedCount: surveys.length,
      details: [JSON.stringify({
        surveysAnalyzed: surveys.length,
        totalPois: allMeasurements.length,
        perSurvey: surveys,
        aggregateMetrics: computeMetrics(allMeasurements),
      }, null, 2)],
    };
  }

  private async queryPois(args: any): Promise<OperationResult> {
    const measurements = await this.getActiveMeasurements();
    let filtered = measurements;
    if (args.poi_type) filtered = filtered.filter(m => (m as any).poi_type === args.poi_type);
    if (typeof args.road_number === 'number') filtered = filtered.filter(m => (m as any).roadNumber === args.road_number);
    if (typeof args.has_image === 'boolean') {
      filtered = filtered.filter(m => {
        const has = !!((m as any).imageUrl || (m as any).images?.length);
        return has === args.has_image;
      });
    }
    if (typeof args.has_note === 'boolean') {
      filtered = filtered.filter(m => {
        const has = !!((m as any).note && (m as any).note.trim());
        return has === args.has_note;
      });
    }
    if (typeof args.height_min === 'number') filtered = filtered.filter(m => (m as any).rel >= args.height_min);
    if (typeof args.height_max === 'number') filtered = filtered.filter(m => (m as any).rel <= args.height_max);
    if (args.note_contains) {
      const q = args.note_contains.toLowerCase();
      filtered = filtered.filter(m => ((m as any).note || '').toLowerCase().includes(q));
    }
    const limit = args.limit || 50;
    const slim = filtered.slice(0, limit).map(m => ({
      id: (m as any).id,
      poiNumber: (m as any).poiNumber,
      poi_type: (m as any).poi_type,
      rel: (m as any).rel,
      latitude: (m as any).latitude,
      longitude: (m as any).longitude,
      note: (m as any).note,
      hasImage: !!((m as any).imageUrl || (m as any).images?.length),
    }));
    return {
      success: true,
      affectedCount: filtered.length,
      details: [JSON.stringify({ matched: filtered.length, returned: slim.length, pois: slim }, null, 2)],
    };
  }

  // ── RoadScope-aware spatial tools (read-only) ──────────────────────────────

  /**
   * Pull the convoy height from the active survey settings (overhaulHeight in
   * RoadScope's schema, or the laser groundReference + custom logic on the MP
   * side). For now, prefer the explicit arg, fall back to the active survey's
   * stored profile, fall back to undefined (no margin check).
   */
  private async getActiveConvoyHeightM(): Promise<number | undefined> {
    if (!this.currentSurveyId) return undefined;
    try {
      const db = await openSurveyDB();
      const survey: any = await db.get('surveys', this.currentSurveyId);
      if (!survey) return undefined;
      const v = survey.overhaulHeight ?? survey.heightM ?? survey.profileHeight;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        return isNaN(n) ? undefined : n;
      }
    } catch {}
    return undefined;
  }

  private summarizePoi(p: CombinedPoi): any {
    return {
      id: p.id,
      origin: p.origin,
      type: p.type,
      name: p.name,
      lat: p.latitude,
      lng: p.longitude,
      distance_m: p.distanceM != null ? Math.round(p.distanceM) : undefined,
      vertical_clearance_m: p.verticalClearanceM,
      load_rating_tons: p.loadRatingMetricTons,
      condition_rating: p.conditionRating,
      is_critical: p.isCritical,
      badges: p.badges,
      source_label: p.sourceLabel,
      notes: p.notes,
    };
  }

  private async queryObstaclesNearby(args: {
    latitude?: number;
    longitude?: number;
    radius_m?: number;
    heading_deg?: number;
    convoy_height_m?: number;
  }): Promise<OperationResult> {
    if (typeof args.latitude !== 'number' || typeof args.longitude !== 'number') {
      return {
        success: false,
        affectedCount: 0,
        details: ['No latitude/longitude provided. Ask the user for their current GPS or capture it from the live GPS store before calling this tool.'],
      };
    }
    const radius = args.radius_m ?? 5000;
    const convoyH = args.convoy_height_m ?? (await this.getActiveConvoyHeightM());
    const obstacles = await getObstaclesAroundUser({
      latitude: args.latitude,
      longitude: args.longitude,
      radiusMeters: radius,
      headingDeg: args.heading_deg,
      convoyHeightM: convoyH,
    });
    const summary = obstacles.slice(0, 100).map(p => this.summarizePoi(p));
    const flagged = obstacles.filter(p => (p.badges || []).includes('Danger'));
    return {
      success: true,
      affectedCount: obstacles.length,
      details: [JSON.stringify({
        center: { lat: args.latitude, lng: args.longitude },
        radius_m: radius,
        heading_deg: args.heading_deg,
        convoy_height_m: convoyH,
        total_found: obstacles.length,
        danger_flagged: flagged.length,
        obstacles: summary,
      }, null, 2)],
    };
  }

  private async queryCriticalBridgesAhead(args: {
    latitude: number;
    longitude: number;
    radius_m?: number;
    convoy_height_m?: number;
  }): Promise<OperationResult> {
    const radius = args.radius_m ?? 25000;
    const convoyH = args.convoy_height_m ?? (await this.getActiveConvoyHeightM());
    const bridges = await getCriticalBridgesNearby({
      latitude: args.latitude,
      longitude: args.longitude,
      radiusMeters: radius,
      convoyHeightM: convoyH,
    });
    return {
      success: true,
      affectedCount: bridges.length,
      details: [JSON.stringify({
        center: { lat: args.latitude, lng: args.longitude },
        radius_m: radius,
        convoy_height_m: convoyH,
        critical_count: bridges.length,
        bridges: bridges.map(p => this.summarizePoi(p)),
      }, null, 2)],
    };
  }

  private async getDocumentedRoutesNearby(args: {
    latitude: number;
    longitude: number;
    radius_m?: number;
    survey_phase?: 'pre-survey' | 'field' | 'customer';
  }): Promise<OperationResult> {
    const routes = await getRoadScopeRoutesNearby({
      latitude: args.latitude,
      longitude: args.longitude,
      radiusMeters: args.radius_m ?? 50000,
      surveyPhase: args.survey_phase,
    });
    return {
      success: true,
      affectedCount: routes.length,
      details: [JSON.stringify({
        center: { lat: args.latitude, lng: args.longitude },
        radius_m: args.radius_m ?? 50000,
        phase_filter: args.survey_phase,
        route_count: routes.length,
        routes,
      }, null, 2)],
    };
  }

  private async getRouteIntelligenceForActiveRoute(args: { route_id: string }): Promise<OperationResult> {
    if (!args.route_id) {
      return { success: false, affectedCount: 0, details: ['route_id is required'] };
    }
    const items = await getRouteIntelligenceForRoute(args.route_id);
    if (items.length === 0) {
      // Try to suggest the linked RoadScope survey id from the active MP survey
      const linkedRsId = this.currentSurveyId
        ? await getLinkedRoadScopeSurveyId(this.currentSurveyId)
        : null;
      return {
        success: true,
        affectedCount: 0,
        details: [JSON.stringify({
          route_id: args.route_id,
          linked_roadscope_survey_id: linkedRsId,
          message: 'No Route Intelligence cache found for this route. The route may not have been analyzed yet — RI is triggered from the RoadScope UI, not from MeasurePRO. Tell the user to run RI in RoadScope first if they need full obstacle coverage.',
        }, null, 2)],
      };
    }
    // Translate upstream source names to SolTec brand labels for the model
    const branded = items.map(item => ({
      ...item,
      source_label: formatSourceLabel(item.source),
    }));
    return {
      success: true,
      affectedCount: items.length,
      details: [JSON.stringify({
        route_id: args.route_id,
        item_count: items.length,
        items: branded,
      }, null, 2)],
    };
  }

  private async proposePoiUpdates(args: { updates: Array<{ poi_id: string; changes: any; reason: string }> }): Promise<OperationResult> {
    const measurements = await this.getActiveMeasurements();
    const previewChanges: PreviewChange[] = [];
    for (const update of args.updates) {
      const target = measurements.find(m => (m as any).id === update.poi_id);
      if (!target) continue;
      previewChanges.push({
        id: update.poi_id,
        action: 'update',
        poiNumber: (target as any).poiNumber ?? null,
        roadNumber: (target as any).roadNumber ?? null,
        before: target as Partial<Measurement>,
        after: { ...(target as any), ...update.changes } as Partial<Measurement>,
        description: update.reason,
      });
    }
    return {
      success: true,
      affectedCount: previewChanges.length,
      details: [`Prepared ${previewChanges.length} updates for user approval. NO changes are applied yet — the user must explicitly approve each one in the chat UI.`],
      previewChanges,
    };
  }

  // ── Apply / undo (preserve legacy auth-gate architecture) ──────────────────

  async applyPreviewedChanges(changes: PreviewChange[]): Promise<OperationResult> {
    if (changes.length === 0) {
      return { success: false, affectedCount: 0, details: ['No changes to apply'] };
    }
    const originalMeasurements = new Map<string, Measurement>();
    let appliedCount = 0;
    const errors: string[] = [];

    for (const change of changes) {
      try {
        if (change.before) {
          originalMeasurements.set(change.id, change.before as Measurement);
        }
        if (change.action === 'update' && change.after) {
          const { id: _id, ...updates } = change.after as any;
          await updateMeasurement(change.id, updates);
          appliedCount++;
        } else if (change.action === 'delete') {
          await deleteMeasurement(change.id);
          appliedCount++;
        }
      } catch (e: any) {
        errors.push(`POI ${change.id}: ${e?.message || e}`);
      }
    }

    // Refresh in-memory cache
    try {
      const feed = getMeasurementFeed();
      if (this.currentSurveyId) {
        await feed.init(this.currentSurveyId);
      }
    } catch {}

    const operationId = crypto.randomUUID();
    const entry: OperationHistoryEntry = {
      id: operationId,
      timestamp: new Date(),
      description: `Applied ${appliedCount} change${appliedCount === 1 ? '' : 's'}`,
      changes,
      originalMeasurements,
      undone: false,
    };
    this.operationHistory.push(entry);
    // Keep only last 50 operations
    if (this.operationHistory.length > 50) {
      this.operationHistory.shift();
    }

    return {
      success: errors.length === 0,
      affectedCount: appliedCount,
      details: errors.length ? errors : [`Applied ${appliedCount} changes`],
      operationId,
    };
  }

  async undoOperation(operationId: string): Promise<OperationResult> {
    const entry = this.operationHistory.find(e => e.id === operationId);
    if (!entry) {
      return { success: false, affectedCount: 0, details: ['Operation not found in history'] };
    }
    if (entry.undone) {
      return { success: false, affectedCount: 0, details: ['Operation already undone'] };
    }

    let restoredCount = 0;
    const errors: string[] = [];
    for (const [id, original] of entry.originalMeasurements) {
      try {
        await updateMeasurement(id, original as any);
        restoredCount++;
      } catch (e: any) {
        errors.push(`POI ${id}: ${e?.message || e}`);
      }
    }
    entry.undone = true;

    try {
      const feed = getMeasurementFeed();
      if (this.currentSurveyId) await feed.init(this.currentSurveyId);
    } catch {}

    return {
      success: errors.length === 0,
      affectedCount: restoredCount,
      details: errors.length ? errors : [`Restored ${restoredCount} POIs to their previous state`],
    };
  }

  getOperationHistory(): OperationHistoryEntry[] {
    return [...this.operationHistory];
  }

  clearOperationHistory() {
    this.operationHistory = [];
  }

  // ── Review mode entry points (called from menu UI) ─────────────────────────

  /**
   * Seed a chat with a structured prompt for one of the review modes. The
   * caller (UI) sends this through chat() like a normal user message — the
   * model will pick up on the instruction and call the right tool.
   */
  buildReviewPrompt(mode: 'day' | 'week' | 'history'): string {
    switch (mode) {
      case 'day':
        return "Run today's review: validate all POIs logged today in the active survey, then summarize findings. Use the day_review tool. Lead with the most critical issues. End with a 'next sortie' checklist of things to fix on my side.";
      case 'week':
        return "Run a week review covering the last 7 days. Use the week_review tool. Show day-over-day trends, flag any day with unusual activity, and tell me which POI types I'm picking up most of and how that compares to my historical baseline.";
      case 'history':
        return "Run a historical review across my entire survey archive. Use the history_review tool. Identify recurring obstacle hotspots by region, average heights per POI type, and any data quality issues that recur across surveys. This is metadata-only — do not request image analysis.";
    }
  }
}

// ── Singleton + helpers ───────────────────────────────────────────────────────

let instance: ClaudeAssistant | null = null;

export function getClaudeAssistant(): ClaudeAssistant {
  if (!instance) instance = new ClaudeAssistant();
  return instance;
}

export function isClaudeAssistantConfigured(): boolean {
  const key = useSettingsStore.getState().aiAssistantSettings?.anthropicApiKey?.trim();
  return !!key;
}
