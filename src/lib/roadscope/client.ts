/**
 * RoadScope API Client
 * Handles all communication with the RoadScope API via backend proxy
 * (Direct browser calls are blocked by CORS, so we proxy through our server)
 */

import {
  RoadScopeResponse,
  HealthCheckData,
  AuthValidationData,
  RoadScopePOIType,
  RoadScopeSurvey,
  CreateSurveyRequest,
  CreateSurveyResponse,
  BatchUpsertPOIsRequest,
  BatchUpsertPOIsResponse,
  BatchUpsertRoutesRequest,
  BatchUpsertRoutesResponse,
  UploadURLsRequest,
  UploadURLsResponse,
  RegisterFilesRequest,
  RegisterFilesResponse,
  APIKeyValidation,
  REQUIRED_SCOPES,
  PrepareSurveyRequest,
  PrepareSurveyResponse,
  PairingLookupResponse,
  AddCollaboratorRequest,
  AddCollaboratorResponse
} from './types';

// Base URL for backend proxy (proxies to RoadScope API)
// In Electron, relative /api/ resolves to file:///C:/api/ — must use absolute URL
const DEFAULT_BASE_URL = (() => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.isElectron) {
    return 'https://measure-pro.app/api/roadscope/proxy';
  }
  return '/api/roadscope/proxy';
})();

export class RoadScopeClient {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  setApiKey(apiKey: string | null): void {
    this.apiKey = apiKey;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<RoadScopeResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    // Pass API key via Authorization header for proxy routes
    // RoadScope expects: Authorization: Bearer mpro_xxx
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    console.log(`[RoadScope] Auth header present: ${!!this.apiKey}`);

    try {
      console.log(`[RoadScope] Requesting: ${url}`);
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();
      console.log(`[RoadScope] Response (${response.status}):`, data);

      if (!response.ok) {
        console.error(`[RoadScope] Error response:`, data);
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error) {
      console.error('[RoadScope] Request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // Health Check - No auth required
  async healthCheck(): Promise<RoadScopeResponse<HealthCheckData>> {
    return this.request<HealthCheckData>('/health', { method: 'GET' });
  }

  // Validate API Key
  async validateApiKey(apiKey?: string): Promise<APIKeyValidation> {
    const keyToValidate = apiKey || this.apiKey;
    
    if (!keyToValidate) {
      return { valid: false, error: 'No API key provided' };
    }

    // Validate format: mpro_ (5 chars) + 64 hex characters = 69 total
    if (!keyToValidate.startsWith('mpro_') || keyToValidate.length !== 69) {
      return { valid: false, error: 'Invalid API key format. Key must start with mpro_ followed by 64 characters.' };
    }

    // Call proxy endpoint with API key in body
    try {
      const response = await fetch(`${this.baseUrl}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToValidate })
      });
      
      const data = await response.json();
      console.log('[RoadScope] Validation response:', data);
      
      if (!response.ok || !data.success) {
        return { valid: false, error: data.error || 'Failed to validate API key' };
      }

      // RoadScope API returns success:true with user data when valid
      // The response structure is: { success: true, data: { userId, userEmail, scopes, expiresAt } }
      const responseData = data.data || data;
      const { userId, userEmail, scopes, expiresAt } = responseData;

      // If we got userId, the key is valid (RoadScope doesn't return a separate 'valid' field)
      if (!userId) {
        return { valid: false, error: 'API key is invalid or expired' };
      }

      // Check for required scopes
      const missingScopes = REQUIRED_SCOPES.filter(scope => !scopes?.includes(scope));

      return {
        valid: true,
        userId,
        userEmail,
        scopes,
        missingScopes: missingScopes.length > 0 ? missingScopes : undefined,
        expiresAt
      };
    } catch (error) {
      console.error('[RoadScope] Validation error:', error);
      return { valid: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Get POI Types
  async getPOITypes(): Promise<RoadScopeResponse<{ types: RoadScopePOIType[] }>> {
    return this.request<{ types: RoadScopePOIType[] }>('/poi-types', { method: 'GET' });
  }

  // List User's Surveys
  async listSurveys(): Promise<RoadScopeResponse<{ surveys: RoadScopeSurvey[]; count: number }>> {
    return this.request<{ surveys: RoadScopeSurvey[]; count: number }>('/surveys', { method: 'GET' });
  }

  // Create/Update Survey
  async upsertSurvey(survey: CreateSurveyRequest): Promise<RoadScopeResponse<CreateSurveyResponse>> {
    return this.request<CreateSurveyResponse>('/surveys', {
      method: 'POST',
      body: JSON.stringify(survey)
    });
  }

  // Batch Upsert POIs
  async batchUpsertPOIs(
    surveyId: string,
    request: BatchUpsertPOIsRequest
  ): Promise<RoadScopeResponse<BatchUpsertPOIsResponse>> {
    // VERSION CHECK: If you see this, the new code is loaded
    console.log('[RoadScope v2.2] 🚀 batchUpsertPOIs called - NEW CODE LOADED');
    
    // Deep clean: JSON round-trip removes undefined values (Firestore doesn't accept them)
    const cleanedRequest = JSON.parse(JSON.stringify(request));
    
    // Log first POI sample to verify cleaning worked
    const firstPoi = cleanedRequest.pois?.[0];
    if (firstPoi) {
      console.log('[RoadScope v2.2] First POI measurements:', JSON.stringify(firstPoi.measurements));
      console.log('[RoadScope v2.2] First POI has widthClearance key?', 'widthClearance' in (firstPoi.measurements || {}));
    }
    
    return this.request<BatchUpsertPOIsResponse>(`/surveys/${surveyId}/pois`, {
      method: 'POST',
      body: JSON.stringify(cleanedRequest)
    });
  }

  // Batch Upsert Routes/Traces
  async batchUpsertRoutes(
    surveyId: string,
    request: BatchUpsertRoutesRequest
  ): Promise<RoadScopeResponse<BatchUpsertRoutesResponse>> {
    // Deep clean: JSON round-trip removes undefined values (Firestore doesn't accept them)
    const cleanedRequest = JSON.parse(JSON.stringify(request));
    
    return this.request<BatchUpsertRoutesResponse>(`/surveys/${surveyId}/routes`, {
      method: 'POST',
      body: JSON.stringify(cleanedRequest)
    });
  }

  // Get Signed Upload URLs
  async getUploadUrls(
    surveyId: string,
    request: UploadURLsRequest
  ): Promise<RoadScopeResponse<UploadURLsResponse>> {
    return this.request<UploadURLsResponse>(`/surveys/${surveyId}/upload-urls`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // Upload file to signed URL
  async uploadFile(
    uploadUrl: string,
    file: Blob | ArrayBuffer,
    contentType: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType
        },
        body: file
      });

      if (!response.ok) {
        return { success: false, error: `Upload failed: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  // Register Uploaded Files
  async registerFiles(
    surveyId: string,
    request: RegisterFilesRequest
  ): Promise<RoadScopeResponse<RegisterFilesResponse>> {
    return this.request<RegisterFilesResponse>(`/surveys/${surveyId}/files`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // Get Survey Files (for validating sync state)
  async getSurveyFiles(
    surveyId: string
  ): Promise<RoadScopeResponse<{ files: Array<{ filename: string; poiId?: string }> }>> {
    return this.request<{ files: Array<{ filename: string; poiId?: string }> }>(`/surveys/${surveyId}/files`, {
      method: 'GET'
    });
  }

  // ===== Collaborative pairing (added 2026-04-10) =====

  // Prepare a survey + generate a pairing code (RS-XXXXXX, 7-day expiry)
  async prepareSurvey(
    request: PrepareSurveyRequest
  ): Promise<RoadScopeResponse<PrepareSurveyResponse>> {
    return this.request<PrepareSurveyResponse>('/surveys/prepare', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // Look up a survey by pairing code. Intentionally bypasses the auth header
  // because the pair endpoint is no-auth — the code itself is the auth.
  async pairByCode(
    code: string
  ): Promise<RoadScopeResponse<PairingLookupResponse>> {
    const url = `${this.baseUrl}/surveys/pair/${encodeURIComponent(code)}`;
    try {
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // Add a collaborator (by email + role) to an existing survey
  async addCollaborator(
    surveyId: string,
    request: AddCollaboratorRequest
  ): Promise<RoadScopeResponse<AddCollaboratorResponse>> {
    return this.request<AddCollaboratorResponse>(
      `/surveys/${surveyId}/collaborators`,
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );
  }
}

// Singleton instance
let clientInstance: RoadScopeClient | null = null;

export function getRoadScopeClient(): RoadScopeClient {
  if (!clientInstance) {
    clientInstance = new RoadScopeClient();
  }
  return clientInstance;
}

export function resetRoadScopeClient(): void {
  clientInstance = null;
}
