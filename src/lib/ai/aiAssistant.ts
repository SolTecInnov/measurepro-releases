// @ts-nocheck — legacy OpenAI assistant kept as fallback only since v16.1.25.
// The active assistant is `src/lib/ai/claudeAssistant.ts` (Anthropic-based).
// This file is no longer wired into the chat UI but remains in the tree as a
// safety net. Type errors here surfaced when the openai SDK was bumped and
// are intentionally suppressed — do not fix them, just delete this file the
// next time we're certain we don't need a rollback path.
/**
 * AI Data Assistant Service (LEGACY — superseded by claudeAssistant.ts)
 *
 * Provides natural language interface for POI data operations using OpenAI's
 * function calling API. Supports querying, updating, deleting, and analyzing POIs.
 */

import OpenAI from 'openai';
import { API_BASE_URL } from '@/lib/config/environment';
import { useSettingsStore } from '../settings';
import { openSurveyDB } from '../survey/db';
import { updateMeasurement, deleteMeasurement } from '../survey/measurements';
import { getMeasurementFeed } from '../survey/MeasurementFeed';
import { getAsset } from '../storage/poiAssetStorage';
import { sendSurveyCompletionEmail, sendDataExportEmail } from '../utils/emailUtils';
import type { Measurement } from '../survey/types';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  message: string;
  data?: any;
  previewChanges?: PreviewChange[];
  error?: string;
}

export interface PreviewChange {
  id: string;
  action: 'update' | 'delete';
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

const FUNCTION_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_pois',
      description: 'Search and filter POIs (Points of Interest) by various criteria. Returns matching POIs from the current survey.',
      parameters: {
        type: 'object',
        properties: {
          poi_type: {
            type: 'string',
            description: 'Filter by POI type (e.g., "bridge", "power_line", "tree_branch")'
          },
          road_number: {
            type: 'number',
            description: 'Filter by road/route number'
          },
          has_image: {
            type: 'boolean',
            description: 'Filter POIs that have/don\'t have attached images'
          },
          has_note: {
            type: 'boolean',
            description: 'Filter POIs that have/don\'t have notes'
          },
          height_min: {
            type: 'number',
            description: 'Minimum height measurement in meters'
          },
          height_max: {
            type: 'number',
            description: 'Maximum height measurement in meters'
          },
          note_contains: {
            type: 'string',
            description: 'Filter POIs whose notes contain this text (case-insensitive)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 50)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_poi',
      description: 'Update a single POI by its ID or POI number. Can update type, note, and other fields.',
      parameters: {
        type: 'object',
        properties: {
          poi_id: {
            type: 'string',
            description: 'The unique ID of the POI to update'
          },
          poi_number: {
            type: 'number',
            description: 'Alternative: The POI number within the survey'
          },
          updates: {
            type: 'object',
            description: 'Fields to update',
            properties: {
              poi_type: { type: 'string' },
              note: { type: 'string' },
              road_number: { type: 'number' }
            }
          },
          preview_only: {
            type: 'boolean',
            description: 'If true, return preview of changes without applying'
          }
        },
        required: ['updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bulk_update_pois',
      description: 'Update multiple POIs matching filter criteria. Use for bulk reclassification or editing.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: 'Criteria to select POIs for update',
            properties: {
              poi_type: { type: 'string' },
              road_number: { type: 'number' },
              has_image: { type: 'boolean' },
              note_contains: { type: 'string' }
            }
          },
          updates: {
            type: 'object',
            description: 'Fields to update on matching POIs',
            properties: {
              poi_type: { type: 'string' },
              note: { type: 'string' }
            }
          },
          preview_only: {
            type: 'boolean',
            description: 'If true, return preview of changes without applying (recommended for bulk operations)'
          }
        },
        required: ['filter', 'updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_pois',
      description: 'Delete POIs matching filter criteria. Use with caution - always preview first.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: 'Criteria to select POIs for deletion',
            properties: {
              poi_type: { type: 'string' },
              road_number: { type: 'number' },
              has_image: { type: 'boolean' },
              note_contains: { type: 'string' },
              poi_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific POI IDs to delete'
              }
            }
          },
          preview_only: {
            type: 'boolean',
            description: 'If true, return preview of deletions without applying (strongly recommended)'
          }
        },
        required: ['filter']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_poi_image',
      description: 'Analyze a POI\'s attached image using GPT-4 Vision. Can identify objects, estimate clearances, or describe the scene.',
      parameters: {
        type: 'object',
        properties: {
          poi_id: {
            type: 'string',
            description: 'The unique ID of the POI whose image to analyze'
          },
          poi_number: {
            type: 'number',
            description: 'Alternative: The POI number within the survey'
          },
          analysis_prompt: {
            type: 'string',
            description: 'What to analyze or look for in the image (e.g., "identify the type of overhead obstruction", "estimate clearance height")'
          }
        },
        required: ['analysis_prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_survey_stats',
      description: 'Get summary statistics about the current survey - total POIs, breakdown by type, etc.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clear_memory_cache',
      description: 'Clear the in-memory measurement cache to free up memory. Use when the user mentions memory issues or wants to free up resources.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_surveys',
      description: 'List all surveys stored in IndexedDB. Returns survey titles, creation dates, POI counts, and status.',
      parameters: {
        type: 'object',
        properties: {
          include_closed: {
            type: 'boolean',
            description: 'Include closed/inactive surveys (default: true)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of surveys to return (default: 20)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_survey_details',
      description: 'Get detailed information about a specific survey by ID or title.',
      parameters: {
        type: 'object',
        properties: {
          survey_id: {
            type: 'string',
            description: 'The unique ID of the survey'
          },
          survey_title: {
            type: 'string',
            description: 'Alternative: Search by survey title (partial match)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_survey',
      description: 'Update survey metadata like title, notes, client name, etc.',
      parameters: {
        type: 'object',
        properties: {
          survey_id: {
            type: 'string',
            description: 'The unique ID of the survey to update'
          },
          updates: {
            type: 'object',
            description: 'Fields to update',
            properties: {
              surveyTitle: { type: 'string' },
              clientName: { type: 'string' },
              surveyorName: { type: 'string' },
              projectNumber: { type: 'string' },
              notes: { type: 'string' },
              description: { type: 'string' }
            }
          },
          preview_only: {
            type: 'boolean',
            description: 'If true, return preview of changes without applying'
          }
        },
        required: ['survey_id', 'updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_poi',
      description: 'Create a new POI (Point of Interest) in the current survey. Requires at least latitude and longitude.',
      parameters: {
        type: 'object',
        properties: {
          latitude: {
            type: 'number',
            description: 'GPS latitude coordinate'
          },
          longitude: {
            type: 'number',
            description: 'GPS longitude coordinate'
          },
          height: {
            type: 'number',
            description: 'Height/clearance measurement in meters'
          },
          poi_type: {
            type: 'string',
            description: 'Type of POI (e.g., bridge, power_line, tree_branch)'
          },
          note: {
            type: 'string',
            description: 'Optional note for the POI'
          }
        },
        required: ['latitude', 'longitude']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_database_info',
      description: 'Get an overview of the IndexedDB database including storage usage, number of surveys, total POIs, and database health.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'export_survey_data',
      description: 'Export survey data in a specified format. Returns the data as text.',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'csv', 'summary'],
            description: 'Export format: json (full data), csv (tabular), or summary (human-readable)'
          },
          survey_id: {
            type: 'string',
            description: 'Specific survey to export. Uses current survey if not specified.'
          }
        },
        required: ['format']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_survey_report_email',
      description: 'Send a survey completion report via email. Includes survey summary with POI count, surveyor info, and optional notes.',
      parameters: {
        type: 'object',
        properties: {
          recipient_emails: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of email addresses to send the report to'
          },
          include_summary: {
            type: 'boolean',
            description: 'Include survey statistics summary (default: true)'
          },
          custom_message: {
            type: 'string',
            description: 'Optional custom message to include in the email'
          }
        },
        required: ['recipient_emails']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_data_export_email',
      description: 'Email an export of the current survey data in a specified format.',
      parameters: {
        type: 'object',
        properties: {
          recipient_email: {
            type: 'string',
            description: 'Email address to send the export to'
          },
          format: {
            type: 'string',
            enum: ['csv', 'json', 'geojson'],
            description: 'Export format for the attached file'
          },
          notes: {
            type: 'string',
            description: 'Optional notes to include in the email'
          }
        },
        required: ['recipient_email', 'format']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_help_articles',
      description: 'Search the MeasurePRO knowledge base / help center for articles that answer user questions about how the app works, troubleshooting, hardware setup, features, etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — e.g. "how to connect laser", "export survey", "GNSS setup"'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_support_ticket',
      description: 'Create a Zendesk support ticket on behalf of the user when they have an issue that cannot be resolved through help articles or AI assistance.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'Short, descriptive subject line for the support ticket'
          },
          description: {
            type: 'string',
            description: 'Full description of the issue, including steps to reproduce, what the user expected, and what happened instead'
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            description: 'Ticket priority — use "urgent" only for complete app failures, "high" for blocking issues'
          }
        },
        required: ['subject', 'description']
      }
    }
  }
];

const SYSTEM_PROMPT = `You are an AI Support Assistant for MeasurePRO, a professional road surveying application built by SolTec Innovation. You help field teams understand and use the app, manage their own survey data, and get support when needed.

## Your Role
You are a knowledgeable, friendly co-pilot. You can:
- Answer ANY question about how MeasurePRO works (features, settings, hardware, workflows)
- Help users manage their own surveys and POI data (query, update, export, email)
- Search the help center for relevant articles
- Create a support ticket when an issue needs human support

You CANNOT and MUST NOT:
- Modify hardware settings, laser configuration, GPS settings, or any app-level system configuration
- Change subscription or licensing settings
- Access another user's data
- Make any destructive change without explicit user confirmation

---

## MeasurePRO — Complete Application Knowledge

### Application Overview
MeasurePRO is an offline-first desktop application for field teams performing road surveys for OS/OW (oversize/overweight) heavy haulage transport. It runs on Chrome/Edge on Windows tablets and laptops. Core capabilities:
- Real-time measurement via laser distance meters (vertical, lateral, rear)
- GPS/GNSS positioning with sub-cm accuracy via RTK (Swift Navigation Duro)
- Photo, video, and voice documentation per POI
- Comprehensive offline-first data storage (IndexedDB) with Firebase cloud sync

### Main Screen Layout
- **Left panel**: Camera feed (live or static preview), measurement display, GPS coordinates
- **Main area**: Leaflet map with real-time vehicle position and POI markers
- **Right panel**: Measurement Log (list of all captured POIs)
- **Top bar**: Survey controls (New/Open/Close survey), Logging mode buttons, Tools menu
- **Settings gear icon**: Opens a tabbed settings panel on the right
- **Header**: App title, feature tabs, connection status indicators

### Surveys
A survey is a collection of POIs (Points of Interest) captured along a road route. To use the app:
1. Open Settings → Survey tab to create a new survey or open an existing one
2. Connect hardware (laser + GPS) in Settings → Laser/GPS tab
3. Select a logging mode (Manual, Auto, Detection, Buffer Detection)
4. Walk/drive the route and capture measurements

**Survey lifecycle**: Created → Active → Closed. When closing:
- **Save to Computer** (mandatory): Downloads a ZIP package with all data, photos, and GPS traces
- **Upload to Cloud** (optional): Syncs to Firebase Storage
- **Email notification** (optional): Sends completion report
- **Sync to RoadScope** (optional): Pushes POIs to RoadScope platform

**Survey sync**: Surveys auto-sync to Firebase on close and export. Offline syncs queue in IndexedDB with exponential backoff retry.

### POIs (Points of Interest)
POIs are individual measurement records capturing obstacles or features along the route.

**POI identification**: Each POI has a unique UUID. Display shows first 8 characters (e.g., "POI abc12345"). The old "POI #X (Road Y)" format is deprecated.

**POI fields**:
- \`id\`: UUID
- \`type\`: POI category (bridge, overpass, power_line, tree_branch, wire, railroad, etc.)
- \`rel\`: Height/clearance measurement in meters (relative — after ground reference subtraction)
- \`raw\`: Raw laser reading in meters
- \`lat/lng\`: GPS coordinates
- \`note\`: Free text note
- \`imagePath\`: Reference to attached photo (stored as 'asset:<uuid>')
- \`videoPath\`: Reference to attached video
- \`audioPath\`: Reference to voice note
- \`timestamp\`: Capture time

**POI types that auto-record height from laser** (HEIGHT_CLEARANCE types):
overheadStructure, opticalFiber, railroad, signalization, overpass, trafficLight, powerLine, bridgeAndWires, wire, tree

**POI types with NO auto height** (MEASUREMENT_FREE types):
bridge, lateralObstruction, road, intersection, information, danger, importantNote, workRequired, restricted, grades, autoturnRequired, voiceNote, passingLane, parking, gravelRoad, deadEnd, culvert, emergencyParking, roundabout

### Logging Modes
- **Manual**: Press spacebar or foot pedal to capture a measurement at current GPS location
- **Auto**: Automatically captures when laser reading changes by a configured threshold
- **Detection** (AI+ add-on): AI camera detects overhead objects and auto-logs them
- **Buffer Detection** (AI+ add-on): Buffers measurements over distance/time to find the lowest clearance point

### Settings Tabs
- **Laser/GPS**: Connect/configure laser hardware and GPS sources
- **Camera**: Select camera, configure video/photo settings, set up multi-camera positions
- **Survey**: Create, open, manage, and close surveys; set client/surveyor/project info
- **Display**: Units (metric/imperial), map style, UI preferences
- **Alerts**: Configure warning/critical thresholds for measurements
- **Logging**: Auto-log thresholds, measurement debounce, POI action settings
- **Map**: Map tile source, POI display options
- **Voice**: Voice command settings (Web Speech API)
- **Keyboard**: View and customize keyboard shortcuts
- **Email**: Configure email recipients for survey reports
- **AI+**: AI detection settings (requires AI+ add-on)
- **AI Assistant**: Configure OpenAI API key and Zendesk support integration (this panel)
- **GNSS**: GNSS road profiling settings (requires GNSS add-on)
- **Sync**: Firebase sync status and settings
- **Admin** (admin only): User management, licensing, company settings

### Hardware
**Laser distance meters** (vertical height measurement):
- Connect via USB-Serial (Web Serial API) or Bluetooth (Web Bluetooth API)
- Supported protocols: SolTec 3-byte binary (soltec-new, 921600 baud), LDM71 ASCII, Soltec-old (19200 baud 7E1), Mock
- Settings → Laser/GPS tab → "Connect Laser" button

**Multi-laser system** (lateral width + rear overhang):
- Up to 4 laser ports: vertical (primary), left lateral, right lateral, rear
- Left lateral keyboard shortcut: [ | Right lateral: ] | Total width: \\ | Rear overhang: '
- Configure in Settings → Lateral/Rear Laser tab

**GPS sources** (priority order — highest first):
1. **Duro/GNSS** (RTK, highest accuracy — Swift Navigation Duro, connects via IP 192.168.0.222:55555)
2. **USB GPS** (NMEA via serial port)
3. **Bluetooth GPS**
4. **Browser Geolocation** (fallback)

When Duro is active, USB GPS is automatically ignored. If Duro stops for 5+ seconds, USB GPS takes over.

**ZED 2i Camera** (Envelope Clearance add-on): Stereo camera for vehicle clearance envelope monitoring via WebSocket.

**LiDAR — Hesai Pandar40P** (3D scanning add-on): Requires Windows companion service (MeasurePRO LiDAR Service, C# .NET 8) running on the same machine. Connects via WebSocket on port 17777.

### Export Formats
**Survey POI data**: CSV, JSON, GeoJSON, full ZIP (includes photos, videos, voice notes, GPS traces as GeoJSON + KML)
**Road profile / GNSS engineering**: CSV, GeoJSON, Shapefile (.shp/.shx/.dbf/.prj), DXF (AutoCAD), LandXML (Civil 3D), ZIP bundle (re-importable)
**Point cloud scans**: PLY (colour), LAS (industry standard)
**AI training data** (admin): YOLO v5/v8 format

### Premium Add-ons
- **AI+ (ai_detection)**: AI camera object detection using TensorFlow.js COCO-SSD model + GPT-4 Vision analysis. Enables Detection and Buffer Detection logging modes, City Mode toggle, AI Settings tab, AI training data export.
- **Envelope Clearance (envelope_clearance)**: Real-time vehicle clearance envelope monitoring using ZED 2i stereo camera.
- **Convoy Guardian (convoy_guardian)**: Multi-vehicle coordination for oversized convoy operations.
- **Permitted Route Enforcement (route_enforcement)**: GPS-based compliance monitoring against pre-approved routes.
- **Swept Path Analysis (swept_path_analysis)**: Real-time road boundary detection and multi-segment vehicle modeling.
- **Point Cloud Scanning (point_cloud_scanning)**: 3D LiDAR integration via Hesai Pandar40P + Windows companion service.
- **Calibration (calibration)**: Advanced laser calibration tools.

### Keyboard Shortcuts (key reference)
- **Space** / foot pedal: Capture measurement
- **F**: Take photo
- **V**: Start/stop video
- **M**: Toggle map
- **N**: New survey
- **[**: Left lateral measurement
- **]**: Right lateral measurement
- **\\**: Total lateral width
- **'**: Rear overhang measurement
- **Alt+Shift+Y**: Toggle City Mode (AI+)
- Full list available in Settings → Keyboard tab

### Offline & Sync Behaviour
- All data stored locally in IndexedDB first
- Firebase sync queued offline, retried with exponential backoff (max 5 attempts)
- Service worker (Workbox) caches app shell for offline operation
- GNSS profile buffer flushes to IndexedDB every 30 seconds for crash recovery
- Auth works offline via cached credentials

### Troubleshooting Quick Reference
- **Laser not reading**: Check baud rate and protocol match the hardware. SolTec-new = 921600 baud. Soltec-old = 19200 7E1.
- **GPS not locking**: For Duro, ensure device IP is 192.168.0.222 and port 55555. Allow 20–60 seconds for RTK fix.
- **App offline / no sync**: Check Firebase connectivity. Pending syncs will auto-retry when online.
- **Survey won't close**: Make sure there's at least one POI, then use Survey → Close Survey.
- **Photos not saving**: Check browser storage quota (Settings → Sync → Storage info).
- **AI detection not working**: Requires AI+ add-on AND a configured OpenAI API key for GPT-4 Vision.

---

## Your Capabilities

### Help & Knowledge
- Answer questions about any MeasurePRO feature, workflow, or setting
- Explain how hardware connects and is configured
- Guide users through step-by-step workflows
- Search help articles for more detailed guidance

### User Data (own surveys/POIs only)
1. **Query POIs**: Search and filter by type, road number, height, images, notes
2. **Update POIs**: Modify POI type, note (single or bulk — always preview first)
3. **Delete POIs**: Remove matching POIs (always preview first, always confirm)
4. **Create POIs**: Add new POIs with coordinates, height, type, notes
5. **Analyze Images**: Use GPT-4 Vision to analyze photos attached to POIs
6. **Survey Stats**: Summary statistics for the active survey
7. **List/Browse Surveys**: View all locally stored surveys
8. **Survey Details**: Full metadata for a specific survey
9. **Update Survey Metadata**: Change title, client, surveyor, project number, notes
10. **Database Info**: Storage usage, health, survey count
11. **Export**: Generate JSON/CSV/summary of survey data
12. **Email Reports**: Send survey completion reports or data exports via email

### Support
13. **Search Help Articles**: Search the Zendesk knowledge base for how-to guides and troubleshooting
14. **Create Support Ticket**: Open a Zendesk ticket if the issue needs human assistance

---

## Behaviour Guidelines
- Always use \`preview_only=true\` for bulk updates and deletes — show what will change before doing it
- Never make destructive changes (delete, bulk update) without explicit user confirmation
- When users ask about "clearance" or "height", that's the \`rel\` field in meters
- If a question is about how the app works, answer from your knowledge first; use search_help_articles if you need more detail
- If a user has a technical issue you cannot resolve, offer to create a support ticket
- Be concise, professional, and field-team friendly — these are busy field operators
- Format numbers to 2 decimal places; summarize large datasets rather than listing everything
- Reference POIs by their ID (first 8 characters)`;

function isZendeskConfigured(): boolean {
  const s = useSettingsStore.getState().aiAssistantSettings;
  return !!(s?.zendeskSubdomain?.trim() && s?.zendeskEmail?.trim() && s?.zendeskApiToken?.trim());
}

function getActiveFunctionDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  if (isZendeskConfigured()) return FUNCTION_DEFINITIONS;
  return FUNCTION_DEFINITIONS.filter(
    f => f.function.name !== 'search_help_articles' && f.function.name !== 'create_support_ticket'
  );
}

function getActiveSystemPrompt(): string {
  if (isZendeskConfigured()) {
    return SYSTEM_PROMPT + '\n\n## Support Integration\nZendesk is configured. You can use search_help_articles and create_support_ticket when appropriate.';
  }
  return SYSTEM_PROMPT + '\n\n## Support Integration\nZendesk is NOT configured. Do NOT attempt to call search_help_articles or create_support_ticket. If the user asks to create a ticket or search help articles, tell them they need to configure the Zendesk integration first in Settings → AI Assistant → Support Integration (Zendesk).';
}

class AIAssistant {
  private openai: OpenAI | null = null;
  private conversationHistory: AIMessage[] = [];
  private currentSurveyId: string | null = null;
  private operationHistory: OperationHistoryEntry[] = [];

  private _currentKey: string | null = null;

  private getClient(): OpenAI {
    const userKey = useSettingsStore.getState().aiAssistantSettings?.openaiApiKey?.trim();
    const apiKey = userKey || _trialApiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please add your API key in Settings → AI Assistant, or contact your administrator.');
    }
    // Re-create client whenever the active key changes
    if (this._currentKey !== apiKey) {
      this._currentKey = apiKey;
      this.openai = null;
    }
    if (!this.openai) {
      this.openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    }
    return this.openai;
  }

  setSurveyId(surveyId: string) {
    this.currentSurveyId = surveyId;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  async chat(userMessage: string): Promise<AIResponse> {
    try {
      const client = this.getClient();
      
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: getActiveSystemPrompt() },
        ...this.conversationHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      ];

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: getActiveFunctionDefinitions(),
        tool_choice: 'auto'
      });

      const assistantMessage = response.choices[0].message;

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolResults: string[] = [];
        let allPreviewChanges: PreviewChange[] = [];

        for (const toolCall of assistantMessage.tool_calls) {
          const tc = toolCall as { id: string; type: 'function'; function: { name: string; arguments: string } };
          const functionName = tc.function.name;
          const args = JSON.parse(tc.function.arguments);
          
          const result = await this.executeFunction(functionName, args);
          toolResults.push(JSON.stringify(result));
          
          if (result.previewChanges) {
            allPreviewChanges = [...allPreviewChanges, ...result.previewChanges];
          }
        }

        const followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          ...messages,
          assistantMessage as OpenAI.Chat.Completions.ChatCompletionMessageParam,
          ...assistantMessage.tool_calls.map((tc, i) => ({
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: toolResults[i]
          }))
        ];

        const followUpResponse = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: followUpMessages
        });

        const finalMessage = followUpResponse.choices[0].message.content || '';
        
        this.conversationHistory.push({
          role: 'assistant',
          content: finalMessage
        });

        return {
          message: finalMessage,
          previewChanges: allPreviewChanges.length > 0 ? allPreviewChanges : undefined
        };
      }

      const responseContent = assistantMessage.content || '';
      this.conversationHistory.push({
        role: 'assistant',
        content: responseContent
      });

      return { message: responseContent };
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred while processing your request';
      return { 
        message: 'Sorry, I encountered an error.',
        error: errorMessage 
      };
    }
  }

  private async executeFunction(name: string, args: any): Promise<OperationResult> {
    switch (name) {
      case 'query_pois':
        return this.queryPOIs(args);
      case 'update_poi':
        return this.updatePOI(args);
      case 'bulk_update_pois':
        return this.bulkUpdatePOIs(args);
      case 'delete_pois':
        return this.deletePOIs(args);
      case 'analyze_poi_image':
        return this.analyzeImage(args);
      case 'get_survey_stats':
        return this.getSurveyStats();
      case 'clear_memory_cache':
        return this.clearMemoryCache();
      case 'list_surveys':
        return this.listSurveys(args);
      case 'get_survey_details':
        return this.getSurveyDetails(args);
      case 'update_survey':
        return this.updateSurvey(args);
      case 'create_poi':
        return this.createPOI(args);
      case 'get_database_info':
        return this.getDatabaseInfo();
      case 'export_survey_data':
        return this.exportSurveyData(args);
      case 'send_survey_report_email':
        return this.sendSurveyReportEmail(args);
      case 'send_data_export_email':
        return this.sendDataExportEmail(args);
      case 'search_help_articles':
        return this.searchHelpArticles(args);
      case 'create_support_ticket':
        return this.createSupportTicket(args);
      default:
        return { success: false, affectedCount: 0, details: [`Unknown function: ${name}`] };
    }
  }

  private async getMeasurements(): Promise<Measurement[]> {
    if (!this.currentSurveyId) {
      throw new Error('No survey selected');
    }

    const db = await openSurveyDB();
    const measurements = await db.getAllFromIndex('measurements', 'by-survey', this.currentSurveyId);
    return measurements as Measurement[];
  }

  private filterMeasurements(measurements: Measurement[], filter: any): Measurement[] {
    return measurements.filter(m => {
      if (filter.poi_type && m.poi_type !== filter.poi_type) return false;
      if (filter.road_number !== undefined && m.roadNumber !== filter.road_number) return false;
      if (filter.has_image !== undefined) {
        const hasImage = !!(m.imageUrl || m.images?.length);
        if (filter.has_image !== hasImage) return false;
      }
      if (filter.has_note !== undefined) {
        const hasNote = !!(m.note && m.note.trim());
        if (filter.has_note !== hasNote) return false;
      }
      if (filter.height_min !== undefined && (m.rel === null || m.rel < filter.height_min)) return false;
      if (filter.height_max !== undefined && (m.rel === null || m.rel > filter.height_max)) return false;
      if (filter.note_contains) {
        const noteLC = (m.note || '').toLowerCase();
        if (!noteLC.includes(filter.note_contains.toLowerCase())) return false;
      }
      if (filter.poi_ids && !filter.poi_ids.includes(m.id)) return false;
      return true;
    });
  }

  private async queryPOIs(args: any): Promise<OperationResult> {
    try {
      const measurements = await this.getMeasurements();
      let filtered = this.filterMeasurements(measurements, args);
      
      const limit = args.limit || 50;
      if (filtered.length > limit) {
        filtered = filtered.slice(0, limit);
      }

      const details = filtered.map(m => 
        `POI ${m.id.substring(0, 8)}: ${m.poi_type || 'untyped'}, Height: ${m.rel?.toFixed(2) || 'N/A'}m${m.note ? `, Note: "${m.note.substring(0, 50)}..."` : ''}`
      );

      return {
        success: true,
        affectedCount: filtered.length,
        details: [
          `Found ${filtered.length} POIs matching criteria${filtered.length >= limit ? ` (showing first ${limit})` : ''}`,
          ...details
        ]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async updatePOI(args: any): Promise<OperationResult> {
    try {
      const measurements = await this.getMeasurements();
      let target: Measurement | undefined;

      if (args.poi_id) {
        target = measurements.find(m => m.id === args.poi_id);
      } else if (args.poi_number !== undefined) {
        target = measurements.find(m => m.poiNumber === args.poi_number);
      }

      if (!target) {
        return { success: false, affectedCount: 0, details: ['POI not found'] };
      }

      const updates: Partial<Measurement> = {};
      if (args.updates.poi_type) updates.poi_type = args.updates.poi_type;
      if (args.updates.note !== undefined) updates.note = args.updates.note;
      if (args.updates.road_number !== undefined) updates.roadNumber = args.updates.road_number;

      const previewChange: PreviewChange = {
        id: target.id,
        action: 'update',
        poiNumber: target.poiNumber,
        roadNumber: target.roadNumber,
        before: { poi_type: target.poi_type, note: target.note },
        after: updates,
        description: `Update POI ${target.id.substring(0, 8)}: ${Object.entries(updates).map(([k, v]) => `${k} → "${v}"`).join(', ')}`
      };

      if (args.preview_only) {
        return {
          success: true,
          affectedCount: 1,
          details: ['Preview mode - changes not applied'],
          previewChanges: [previewChange]
        };
      }

      await updateMeasurement(target.id, updates);

      return {
        success: true,
        affectedCount: 1,
        details: [`Updated POI ${target.id.substring(0, 8)}`],
        previewChanges: [previewChange]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async bulkUpdatePOIs(args: any): Promise<OperationResult> {
    try {
      const measurements = await this.getMeasurements();
      const filtered = this.filterMeasurements(measurements, args.filter);

      if (filtered.length === 0) {
        return { success: true, affectedCount: 0, details: ['No POIs matched the filter criteria'] };
      }

      const updates: Partial<Measurement> = {};
      if (args.updates.poi_type) updates.poi_type = args.updates.poi_type;
      if (args.updates.note !== undefined) updates.note = args.updates.note;

      const previewChanges: PreviewChange[] = filtered.map(m => ({
        id: m.id,
        action: 'update' as const,
        poiNumber: m.poiNumber,
        roadNumber: m.roadNumber,
        before: { poi_type: m.poi_type, note: m.note },
        after: updates,
        description: `POI ${m.id.substring(0, 8)}: ${m.poi_type || 'untyped'} → ${updates.poi_type || m.poi_type}`
      }));

      if (args.preview_only) {
        return {
          success: true,
          affectedCount: filtered.length,
          details: [`Preview: ${filtered.length} POIs would be updated`],
          previewChanges
        };
      }

      for (const m of filtered) {
        await updateMeasurement(m.id, updates);
      }

      return {
        success: true,
        affectedCount: filtered.length,
        details: [`Updated ${filtered.length} POIs`],
        previewChanges
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async deletePOIs(args: any): Promise<OperationResult> {
    try {
      const measurements = await this.getMeasurements();
      const filtered = this.filterMeasurements(measurements, args.filter);

      if (filtered.length === 0) {
        return { success: true, affectedCount: 0, details: ['No POIs matched the filter criteria'] };
      }

      const previewChanges: PreviewChange[] = filtered.map(m => ({
        id: m.id,
        action: 'delete' as const,
        poiNumber: m.poiNumber,
        roadNumber: m.roadNumber,
        before: { poi_type: m.poi_type, note: m.note },
        description: `Delete POI ${m.id.substring(0, 8)} (${m.poi_type || 'untyped'})`
      }));

      if (args.preview_only !== false) {
        return {
          success: true,
          affectedCount: filtered.length,
          details: [`Preview: ${filtered.length} POIs would be deleted. Say "apply" or "confirm" to proceed.`],
          previewChanges
        };
      }

      for (const m of filtered) {
        await deleteMeasurement(m.id);
      }

      return {
        success: true,
        affectedCount: filtered.length,
        details: [`Deleted ${filtered.length} POIs`],
        previewChanges
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async analyzeImage(args: any): Promise<OperationResult> {
    try {
      const measurements = await this.getMeasurements();
      let target: Measurement | undefined;

      if (args.poi_id) {
        target = measurements.find(m => m.id === args.poi_id);
      } else if (args.poi_number !== undefined) {
        target = measurements.find(m => m.poiNumber === args.poi_number);
      }

      if (!target) {
        return { success: false, affectedCount: 0, details: ['POI not found'] };
      }

      let imageUrl = target.imageUrl;
      
      if (imageUrl?.startsWith('asset:')) {
        const assetId = imageUrl.replace('asset:', '');
        const asset = await getAsset(assetId);
        if (asset?.blob) {
          const base64 = await this.blobToBase64(asset.blob);
          imageUrl = base64;
        }
      }

      if (!imageUrl) {
        return { success: false, affectedCount: 0, details: ['POI has no attached image'] };
      }

      const client = this.getClient();
      const visionResponse = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: args.analysis_prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 500
      });

      const analysis = visionResponse.choices[0].message.content || 'No analysis available';

      return {
        success: true,
        affectedCount: 1,
        details: [
          `Image analysis for POI ${target.id.substring(0, 8)}:`,
          analysis
        ]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [`Image analysis failed: ${error.message}`] };
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async getSurveyStats(): Promise<OperationResult> {
    try {
      const measurements = await this.getMeasurements();
      
      const typeCount: Record<string, number> = {};
      let withImages = 0;
      let withNotes = 0;
      let totalHeight = 0;
      let heightCount = 0;

      for (const m of measurements) {
        const type = m.poi_type || 'untyped';
        typeCount[type] = (typeCount[type] || 0) + 1;
        
        if (m.imageUrl || m.images?.length) withImages++;
        if (m.note?.trim()) withNotes++;
        if (m.rel !== null && m.rel !== undefined) {
          totalHeight += m.rel;
          heightCount++;
        }
      }

      const details = [
        `Total POIs: ${measurements.length}`,
        `POIs with images: ${withImages}`,
        `POIs with notes: ${withNotes}`,
        heightCount > 0 ? `Average height: ${(totalHeight / heightCount).toFixed(2)}m` : '',
        '',
        'Breakdown by type:',
        ...Object.entries(typeCount)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => `  ${type}: ${count}`)
      ].filter(Boolean);

      return { success: true, affectedCount: measurements.length, details };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private clearMemoryCache(): OperationResult {
    try {
      const feed = getMeasurementFeed();
      feed.resetCache();
      return {
        success: true,
        affectedCount: 0,
        details: ['Memory cache cleared successfully. Data will be reloaded from storage as needed.']
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async listSurveys(args: any): Promise<OperationResult> {
    try {
      const db = await openSurveyDB();
      const allSurveys = await db.getAll('surveys');
      
      let surveys = args.include_closed === false 
        ? allSurveys.filter((s: any) => s.active)
        : allSurveys;
      
      surveys.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      const limit = args.limit || 20;
      if (surveys.length > limit) {
        surveys = surveys.slice(0, limit);
      }

      const allMeasurements = await db.getAll('measurements');
      
      const details = surveys.map((s: any) => {
        const poiCount = allMeasurements.filter((m: any) => m.user_id === s.id).length;
        const status = s.active ? '🟢 Active' : '⚫ Closed';
        const date = new Date(s.createdAt).toLocaleDateString();
        return `${s.surveyTitle || 'Untitled'} (${s.id.substring(0, 8)}) - ${poiCount} POIs - ${status} - ${date}`;
      });

      return {
        success: true,
        affectedCount: surveys.length,
        details: [
          `Found ${allSurveys.length} total surveys${surveys.length < allSurveys.length ? ` (showing ${surveys.length})` : ''}`,
          '',
          ...details
        ]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async getSurveyDetails(args: any): Promise<OperationResult> {
    try {
      const db = await openSurveyDB();
      const allSurveys = await db.getAll('surveys');
      
      let survey: any;
      if (args.survey_id) {
        survey = allSurveys.find((s: any) => s.id === args.survey_id);
      } else if (args.survey_title) {
        const titleLower = args.survey_title.toLowerCase();
        survey = allSurveys.find((s: any) => 
          (s.surveyTitle || '').toLowerCase().includes(titleLower)
        );
      }

      if (!survey) {
        return { success: false, affectedCount: 0, details: ['Survey not found'] };
      }

      const measurements = await db.getAllFromIndex('measurements', 'by-survey', survey.id);
      
      const details = [
        `Survey: ${survey.surveyTitle || 'Untitled'}`,
        `ID: ${survey.id}`,
        `Status: ${survey.active ? 'Active' : 'Closed'}`,
        `Created: ${new Date(survey.createdAt).toLocaleString()}`,
        survey.closedAt ? `Closed: ${new Date(survey.closedAt).toLocaleString()}` : '',
        '',
        `Client: ${survey.clientName || 'N/A'}`,
        `Surveyor: ${survey.surveyorName || 'N/A'}`,
        `Project #: ${survey.projectNumber || 'N/A'}`,
        `Origin: ${survey.originAddress || 'N/A'}`,
        `Destination: ${survey.destinationAddress || 'N/A'}`,
        '',
        `Total POIs: ${measurements.length}`,
        `Notes: ${survey.notes || 'None'}`,
        `Description: ${survey.description || 'None'}`
      ].filter(Boolean);

      return { success: true, affectedCount: 1, details };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async updateSurvey(args: any): Promise<OperationResult> {
    try {
      const db = await openSurveyDB();
      const survey = await db.get('surveys', args.survey_id);
      
      if (!survey) {
        return { success: false, affectedCount: 0, details: ['Survey not found'] };
      }

      const updates: any = {};
      if (args.updates.surveyTitle !== undefined) updates.surveyTitle = args.updates.surveyTitle;
      if (args.updates.clientName !== undefined) updates.clientName = args.updates.clientName;
      if (args.updates.surveyorName !== undefined) updates.surveyorName = args.updates.surveyorName;
      if (args.updates.projectNumber !== undefined) updates.projectNumber = args.updates.projectNumber;
      if (args.updates.notes !== undefined) updates.notes = args.updates.notes;
      if (args.updates.description !== undefined) updates.description = args.updates.description;

      const changeDesc = Object.entries(updates)
        .map(([k, v]) => `${k}: "${(survey as any)[k] || ''}" → "${v}"`)
        .join(', ');

      if (args.preview_only) {
        return {
          success: true,
          affectedCount: 1,
          details: [`Preview: Would update survey ${args.survey_id.substring(0, 8)}`, changeDesc]
        };
      }

      const updatedSurvey = { ...survey, ...updates };
      await db.put('surveys', updatedSurvey);

      return {
        success: true,
        affectedCount: 1,
        details: [`Updated survey ${args.survey_id.substring(0, 8)}`, changeDesc]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async createPOI(args: any): Promise<OperationResult> {
    try {
      if (!this.currentSurveyId) {
        return { success: false, affectedCount: 0, details: ['No survey selected. Please select a survey first.'] };
      }

      const db = await openSurveyDB();
      const existingMeasurements = await db.getAllFromIndex('measurements', 'by-survey', this.currentSurveyId);
      
      const now = new Date();
      const newPOI: Measurement = {
        id: crypto.randomUUID(),
        rel: args.height !== undefined ? args.height : null,
        altGPS: null,
        latitude: args.latitude,
        longitude: args.longitude,
        utcDate: now.toISOString().split('T')[0],
        utcTime: now.toISOString().split('T')[1].split('.')[0],
        speed: null,
        heading: null,
        roadNumber: null,
        poiNumber: existingMeasurements.length + 1,
        note: args.note || null,
        createdAt: now.toISOString(),
        user_id: this.currentSurveyId,
        source: 'manual',
        poi_type: args.poi_type || undefined
      };

      await db.put('measurements', newPOI);

      return {
        success: true,
        affectedCount: 1,
        details: [
          `Created new POI ${newPOI.id.substring(0, 8)}`,
          `Location: ${args.latitude.toFixed(6)}, ${args.longitude.toFixed(6)}`,
          args.height !== undefined ? `Height: ${args.height}m` : '',
          args.poi_type ? `Type: ${args.poi_type}` : '',
          args.note ? `Note: ${args.note}` : ''
        ].filter(Boolean)
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async getDatabaseInfo(): Promise<OperationResult> {
    try {
      const db = await openSurveyDB();
      
      const surveys = await db.getAll('surveys');
      const measurements = await db.getAll('measurements');
      
      const activeSurveys = surveys.filter((s: any) => s.active);
      const closedSurveys = surveys.filter((s: any) => !s.active);
      
      let storageInfo = 'Storage info not available';
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
        const quotaMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(0);
        storageInfo = `${usedMB} MB used of ${quotaMB} MB available`;
      }

      const details = [
        '=== IndexedDB Database Overview ===',
        '',
        `Storage: ${storageInfo}`,
        '',
        `Total Surveys: ${surveys.length}`,
        `  Active: ${activeSurveys.length}`,
        `  Closed: ${closedSurveys.length}`,
        '',
        `Total POIs: ${measurements.length}`,
        '',
        'Recent Surveys:',
        ...surveys
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .map((s: any) => {
            const poiCount = measurements.filter((m: any) => m.user_id === s.id).length;
            return `  - ${s.surveyTitle || 'Untitled'} (${poiCount} POIs)`;
          })
      ];

      return { success: true, affectedCount: surveys.length, details };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async exportSurveyData(args: any): Promise<OperationResult> {
    try {
      const surveyId = args.survey_id || this.currentSurveyId;
      if (!surveyId) {
        return { success: false, affectedCount: 0, details: ['No survey specified or selected'] };
      }

      const db = await openSurveyDB();
      const survey = await db.get('surveys', surveyId);
      const measurements = await db.getAllFromIndex('measurements', 'by-survey', surveyId);

      if (!survey) {
        return { success: false, affectedCount: 0, details: ['Survey not found'] };
      }

      let output = '';
      
      if (args.format === 'json') {
        output = JSON.stringify({
          survey: {
            id: survey.id,
            title: survey.surveyTitle,
            client: survey.clientName,
            surveyor: survey.surveyorName,
            created: survey.createdAt,
            status: survey.active ? 'active' : 'closed'
          },
          pois: measurements.map((m: any) => ({
            id: m.id,
            lat: m.latitude,
            lng: m.longitude,
            height: m.rel,
            type: m.poi_type,
            note: m.note,
            created: m.createdAt
          }))
        }, null, 2);
      } else if (args.format === 'csv') {
        const headers = 'id,latitude,longitude,height,type,note,created';
        const rows = measurements.map((m: any) => 
          `${m.id},${m.latitude},${m.longitude},${m.rel || ''},${m.poi_type || ''},"${(m.note || '').replace(/"/g, '""')}",${m.createdAt}`
        );
        output = [headers, ...rows].join('\n');
      } else {
        output = [
          `Survey: ${survey.surveyTitle || 'Untitled'}`,
          `Client: ${survey.clientName || 'N/A'}`,
          `Surveyor: ${survey.surveyorName || 'N/A'}`,
          `Created: ${new Date(survey.createdAt).toLocaleString()}`,
          `Status: ${survey.active ? 'Active' : 'Closed'}`,
          `Total POIs: ${measurements.length}`,
          '',
          'POI Summary:',
          ...measurements.slice(0, 20).map((m: any) => 
            `  ${m.id.substring(0, 8)}: ${m.poi_type || 'untyped'} at (${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)})${m.rel ? ` - ${m.rel}m` : ''}`
          ),
          measurements.length > 20 ? `  ... and ${measurements.length - 20} more POIs` : ''
        ].filter(Boolean).join('\n');
      }

      return {
        success: true,
        affectedCount: measurements.length,
        details: [
          `Export format: ${args.format}`,
          `Survey: ${survey.surveyTitle || 'Untitled'}`,
          `POIs exported: ${measurements.length}`,
          '',
          '--- Data ---',
          output.length > 3000 ? output.substring(0, 3000) + '\n... (truncated)' : output
        ]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  async applyPreviewedChanges(changes: PreviewChange[]): Promise<OperationResult> {
    try {
      let updatedCount = 0;
      let deletedCount = 0;
      const details: string[] = [];
      const operationId = crypto.randomUUID();

      // Capture full original measurements BEFORE making any changes
      const measurements = await this.getMeasurements();
      const originalMeasurements = new Map<string, Measurement>();
      
      for (const change of changes) {
        const original = measurements.find(m => m.id === change.id);
        if (original) {
          originalMeasurements.set(change.id, { ...original });
        }
      }

      // Apply the changes
      for (const change of changes) {
        if (change.action === 'update' && change.after) {
          await updateMeasurement(change.id, change.after);
          updatedCount++;
          details.push(`Updated POI ${change.id.substring(0, 8)}`);
        } else if (change.action === 'delete') {
          await deleteMeasurement(change.id);
          deletedCount++;
          details.push(`Deleted POI ${change.id.substring(0, 8)}`);
        }
      }

      // Record in history for undo with full original data
      const historyEntry: OperationHistoryEntry = {
        id: operationId,
        timestamp: new Date(),
        description: `${updatedCount > 0 ? `Updated ${updatedCount}` : ''}${updatedCount > 0 && deletedCount > 0 ? ', ' : ''}${deletedCount > 0 ? `Deleted ${deletedCount}` : ''} POIs`,
        changes,
        originalMeasurements,
        undone: false
      };
      this.operationHistory.push(historyEntry);

      return {
        success: true,
        affectedCount: updatedCount + deletedCount,
        details: [
          `Applied ${changes.length} changes:`,
          updatedCount > 0 ? `  Updated: ${updatedCount}` : '',
          deletedCount > 0 ? `  Deleted: ${deletedCount}` : '',
          ...details
        ].filter(Boolean),
        operationId
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  getOperationHistory(): OperationHistoryEntry[] {
    return [...this.operationHistory].reverse();
  }

  async undoOperation(operationId: string): Promise<OperationResult> {
    const entryIndex = this.operationHistory.findIndex(e => e.id === operationId);
    if (entryIndex === -1) {
      return { success: false, affectedCount: 0, details: ['Operation not found in history'] };
    }

    const entry = this.operationHistory[entryIndex];
    if (entry.undone) {
      return { success: false, affectedCount: 0, details: ['Operation already undone'] };
    }

    try {
      let restoredCount = 0;
      let revertedCount = 0;
      const details: string[] = [];
      const db = await openSurveyDB();

      for (const change of entry.changes) {
        const originalMeasurement = entry.originalMeasurements.get(change.id);
        
        if (!originalMeasurement) {
          details.push(`Skipped POI ${change.id.substring(0, 8)} - no original data`);
          continue;
        }

        if (change.action === 'update') {
          // Restore full original measurement data
          await db.put('measurements', originalMeasurement);
          revertedCount++;
          details.push(`Reverted POI ${change.id.substring(0, 8)}`);
        } else if (change.action === 'delete') {
          // Restore deleted measurement with full original data
          await db.put('measurements', originalMeasurement);
          restoredCount++;
          details.push(`Restored POI ${change.id.substring(0, 8)}`);
        }
      }

      // Mark as undone
      this.operationHistory[entryIndex].undone = true;

      // Refresh the measurement feed cache
      const feed = getMeasurementFeed();
      feed.resetCache();

      return {
        success: true,
        affectedCount: restoredCount + revertedCount,
        details: [
          `Undone operation:`,
          restoredCount > 0 ? `  Restored: ${restoredCount}` : '',
          revertedCount > 0 ? `  Reverted: ${revertedCount}` : '',
          ...details
        ].filter(Boolean)
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  clearOperationHistory() {
    this.operationHistory = [];
  }

  private async sendSurveyReportEmail(args: any): Promise<OperationResult> {
    try {
      if (!this.currentSurveyId) {
        return { success: false, affectedCount: 0, details: ['No survey selected'] };
      }

      const recipientEmails = args.recipient_emails;
      if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
        return { success: false, affectedCount: 0, details: ['No recipient email addresses provided'] };
      }

      const db = await openSurveyDB();
      const survey = await db.get('surveys', this.currentSurveyId);
      if (!survey) {
        return { success: false, affectedCount: 0, details: ['Survey not found'] };
      }

      const measurements = await this.getMeasurements();
      const surveyTitle = survey.surveyTitle || survey.name || 'Untitled Survey';
      const surveyorName = survey.surveyorName || survey.surveyor || 'Unknown';
      const clientName = survey.clientName || survey.customerName || 'Unknown';

      const success = await sendSurveyCompletionEmail({
        to: recipientEmails,
        bcc: [],
        surveyTitle,
        surveyorName,
        clientName,
        projectNumber: survey.projectNumber || undefined,
        measurementCount: measurements.length,
        notes: args.custom_message || survey.notes || undefined
      });

      if (success) {
        return {
          success: true,
          affectedCount: 1,
          details: [
            `Survey report emailed successfully`,
            `Recipients: ${recipientEmails.join(', ')}`,
            `Survey: ${surveyTitle}`,
            `POI Count: ${measurements.length}`
          ]
        };
      } else {
        return { success: false, affectedCount: 0, details: ['Failed to send email - check network connection'] };
      }
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [`Email error: ${error.message || 'Unknown error'}`] };
    }
  }

  private async sendDataExportEmail(args: any): Promise<OperationResult> {
    try {
      if (!this.currentSurveyId) {
        return { success: false, affectedCount: 0, details: ['No survey selected'] };
      }

      const recipientEmail = args.recipient_email;
      if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
        return { success: false, affectedCount: 0, details: ['Invalid or missing recipient email address'] };
      }

      const db = await openSurveyDB();
      const survey = await db.get('surveys', this.currentSurveyId);
      if (!survey) {
        return { success: false, affectedCount: 0, details: ['Survey not found'] };
      }

      const measurements = await this.getMeasurements();
      if (measurements.length === 0) {
        return { success: false, affectedCount: 0, details: ['No POIs to export in current survey'] };
      }

      const format = args.format || 'csv';
      let fileContent = '';
      let fileName = '';

      const safeTitle = (survey.surveyTitle || 'survey').toLowerCase().replace(/[^a-z0-9]/g, '-');

      if (format === 'csv') {
        const headers = ['ID', 'POI Type', 'Height (m)', 'Latitude', 'Longitude', 'Note', 'Created At'];
        const rows = measurements.map(m => [
          m.id.substring(0, 8),
          m.poi_type || '',
          m.rel?.toFixed(2) || '',
          m.latitude?.toFixed(6) || '',
          m.longitude?.toFixed(6) || '',
          (m.note || '').replace(/"/g, '""'),
          m.createdAt
        ]);
        fileContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        fileName = `${safeTitle}.csv`;
      } else if (format === 'json') {
        fileContent = JSON.stringify(measurements, null, 2);
        fileName = `${safeTitle}.json`;
      } else if (format === 'geojson') {
        const geojson = {
          type: 'FeatureCollection',
          features: measurements.filter(m => m.latitude && m.longitude).map(m => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [m.longitude, m.latitude]
            },
            properties: {
              id: m.id,
              poi_type: m.poi_type,
              height: m.rel,
              note: m.note,
              createdAt: m.createdAt
            }
          }))
        };
        fileContent = JSON.stringify(geojson, null, 2);
        fileName = `${safeTitle}.geojson`;
      }

      const success = await sendDataExportEmail(
        args.recipient_email,
        {
          exportType: format === 'geojson' ? 'geojson' : format,
          measurementCount: measurements.length,
          dateRange: {
            from: measurements[0]?.createdAt || new Date().toISOString(),
            to: measurements[measurements.length - 1]?.createdAt || new Date().toISOString()
          },
          fileContent,
          fileName,
          additionalNotes: args.notes
        }
      );

      if (success) {
        return {
          success: true,
          affectedCount: 1,
          details: [
            `Data export emailed successfully`,
            `Recipient: ${args.recipient_email}`,
            `Format: ${format.toUpperCase()}`,
            `POI Count: ${measurements.length}`
          ]
        };
      } else {
        return { success: false, affectedCount: 0, details: ['Failed to send email'] };
      }
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [error.message] };
    }
  }

  private async searchHelpArticles(args: { query: string }): Promise<OperationResult> {
    try {
      const settings = useSettingsStore.getState().aiAssistantSettings;
      const subdomain = settings?.zendeskSubdomain?.trim();
      const email = settings?.zendeskEmail?.trim();
      const token = settings?.zendeskApiToken?.trim();

      if (!subdomain || !email || !token) {
        return {
          success: false,
          affectedCount: 0,
          details: [
            'Zendesk is not configured. Please add your Zendesk subdomain, email, and API token in Settings → AI Assistant → Support Integration.',
            'Once configured, I can search help articles to answer your question.'
          ]
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/zendesk/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, email, token, query: args.query }),
      });
      const data = await response.json() as { success: boolean; results?: any[]; error?: string };

      if (!data.success) {
        return { success: false, affectedCount: 0, details: [data.error ?? 'Zendesk search failed'] };
      }

      const articles: Array<{ id: number; title: string; html_url: string; body: string; section_id: number }> = data.results || [];

      if (articles.length === 0) {
        return {
          success: true,
          affectedCount: 0,
          details: [`No help articles found for "${args.query}". Try different search terms or create a support ticket if you need help.`]
        };
      }

      const summaries = articles.map((a, i) => {
        const plainText = a.body
          ? a.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
          : '';
        return `${i + 1}. **${a.title}**\n   ${plainText}${plainText.length === 300 ? '...' : ''}\n   Link: ${a.html_url}`;
      });

      return {
        success: true,
        affectedCount: articles.length,
        details: [`Found ${articles.length} help article(s) for "${args.query}":`, ...summaries]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [`Help search error: ${error.message}`] };
    }
  }

  private async createSupportTicket(args: { subject: string; description: string; priority?: string }): Promise<OperationResult> {
    try {
      const settings = useSettingsStore.getState().aiAssistantSettings;
      const subdomain = settings?.zendeskSubdomain?.trim();
      const email = settings?.zendeskEmail?.trim();
      const token = settings?.zendeskApiToken?.trim();

      if (!subdomain || !email || !token) {
        return {
          success: false,
          affectedCount: 0,
          details: [
            'Zendesk is not configured. Please add your Zendesk subdomain, email, and API token in Settings → AI Assistant → Support Integration.',
            'Alternatively, contact support directly.'
          ]
        };
      }

      const priority = args.priority || 'normal';

      const response = await fetch(`${API_BASE_URL}/api/zendesk/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, email, token, subject: args.subject, description: args.description, priority }),
      });
      const data = await response.json() as { success: boolean; ticket?: { id: number; url: string }; error?: string };

      if (!data.success) {
        return { success: false, affectedCount: 0, details: [data.error ?? 'Failed to create ticket'] };
      }

      const ticket = data.ticket;

      return {
        success: true,
        affectedCount: 1,
        details: [
          `Support ticket created successfully!`,
          `Ticket #${ticket.id}: ${ticket.subject}`,
          `Status: ${ticket.status} | Priority: ${ticket.priority}`,
          `Our support team will follow up via email.`
        ]
      };
    } catch (error: any) {
      return { success: false, affectedCount: 0, details: [`Ticket creation error: ${error.message}`] };
    }
  }
}

let instance: AIAssistant | null = null;

export function getAIAssistant(): AIAssistant {
  if (!instance) {
    instance = new AIAssistant();
  }
  return instance;
}

// ─── Trial Key (set at runtime from /api/ai/trial-status) ───────────────────
let _trialApiKey: string | null = null;
let _trialDaysRemaining: number = 0;
let _trialInTrial: boolean = false;

export function setTrialState(key: string | null, daysRemaining: number, inTrial: boolean) {
  _trialApiKey = key;
  _trialDaysRemaining = daysRemaining;
  _trialInTrial = inTrial;
  // Reset the singleton so next getClient() re-creates with updated key
  if (instance) instance['openai'] = null;
}

export function getTrialState() {
  return { trialKey: _trialApiKey, daysRemaining: _trialDaysRemaining, inTrial: _trialInTrial };
}

export function isAIAssistantConfigured(): boolean {
  const userKey = useSettingsStore.getState().aiAssistantSettings?.openaiApiKey;
  return !!(userKey?.trim()) || !!_trialApiKey;
}
