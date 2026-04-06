const BRIDGE = 'http://localhost:3001'
const FETCH_TIMEOUT = 6000

async function bridgeFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(`${BRIDGE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options?.headers }
    })
    return await res.json() as T
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    if (err.name === 'AbortError') throw new Error('Camera bridge timeout')
    if (
      err.message.includes('fetch') ||
      err.message.includes('Failed to fetch') ||
      err.message.includes('NetworkError')
    ) {
      throw new Error('Camera bridge offline')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

interface BridgeHealthResponse {
  status: string
}

interface CameraConnectedResponse {
  connected: boolean
}

interface CameraStatusResponse {
  success: boolean
  data: CameraStatus
}

interface RecordingResponse {
  success: boolean
  error?: string
}

interface PhotoResponse {
  success: boolean
  filename?: string
  error?: string
}

interface DownloadStartResponse {
  jobId?: string
  error?: string
}

interface DownloadProgressResponse {
  status: 'running' | 'done' | 'error'
  totalFiles: number
  downloadedFiles: number
  currentFile?: string
  errorMessage?: string
}

interface SettingsResponse {
  success: boolean
  settings?: CameraSettings
}

export const cameraService = {
  async checkBridge(): Promise<boolean> {
    try {
      const res = await bridgeFetch<BridgeHealthResponse>('/health')
      return res.status === 'ok'
    } catch { return false }
  },

  async checkCamera(): Promise<boolean> {
    try {
      const res = await bridgeFetch<CameraConnectedResponse>('/camera/ping')
      return res.connected === true
    } catch { return false }
  },

  async getStatus(): Promise<CameraStatusResponse> {
    return bridgeFetch<CameraStatusResponse>('/camera/status')
  },

  async getCameraStatus(): Promise<CameraStatusResponse> {
    return bridgeFetch<CameraStatusResponse>('/camera/status')
  },

  async startRecording(options: CameraRecordingOptions = {}): Promise<RecordingResponse> {
    return bridgeFetch<RecordingResponse>('/camera/start-recording', {
      method: 'POST',
      body: JSON.stringify(options)
    })
  },

  async stopRecording(): Promise<RecordingResponse> {
    return bridgeFetch<RecordingResponse>('/camera/stop-recording', { method: 'POST' })
  },

  async capturePhotoPOI(geoData: CameraPhotoPOIData): Promise<PhotoResponse> {
    return bridgeFetch<PhotoResponse>('/camera/capture-photo', {
      method: 'POST',
      body: JSON.stringify(geoData)
    })
  },

  async getPreviewSnapshotUrl(): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(`${BRIDGE}/camera/preview-snapshot`, {
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`Preview failed: ${res.status}`)
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (err.name === 'AbortError') throw new Error('Preview snapshot timed out')
      throw err
    } finally {
      clearTimeout(timeout)
    }
  },

  async startPostSurveyDownload(surveyId: string): Promise<DownloadStartResponse> {
    return bridgeFetch<DownloadStartResponse>('/camera/download-survey', {
      method: 'POST',
      body: JSON.stringify({
        surveyId,
        outputDir: `C:\\SolTec\\Surveys\\${surveyId}`
      })
    })
  },

  async getDownloadProgress(jobId: string): Promise<DownloadProgressResponse> {
    return bridgeFetch<DownloadProgressResponse>(`/camera/download-status/${jobId}`)
  },

  async getSettings(): Promise<SettingsResponse> {
    return bridgeFetch<SettingsResponse>('/camera/settings')
  },

  async saveSettings(settings: CameraSettings): Promise<SettingsResponse> {
    return bridgeFetch<SettingsResponse>('/camera/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    })
  }
}

export interface CameraRecordingOptions {
  resolution?: '5.7K' | '8K' | '4K'
  fps?: 24 | 30 | 60
  mode?: 'standard' | 'timelapse_road'
}

export interface CameraPhotoPOIData {
  lat: number
  lng: number
  altitude: number
  heading: number
  surveyId: string
  poiType: string
  poiLabel: string
}

export interface CameraSettings {
  resolution: '5.7K' | '8K' | '4K'
  fps: 24 | 30 | 60
  autoStartWithSurvey: boolean
  autoStopWithSurvey: boolean
  autoDownloadAfterSurvey: boolean
  capturePhotosAtPOI: boolean
  showHUD: boolean
  hudPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export interface CameraStatus {
  batteryPercent: number
  storageFreeMB: number
  isRecording: boolean
  recordingDuration: number
  firmwareVersion: string
}

export interface CameraError {
  code: 'START_FAILED' | 'RECORDING_STOPPED' | 'CONNECTION_LOST'
      | 'STORAGE_FULL' | 'WRITE_ERROR' | 'OVERHEAT'
  message: string
  detail: string
  recoverable: boolean
  action: string
}
