import { create } from 'zustand'
import {
  cameraService,
  CameraStatus,
  CameraSettings,
  CameraError,
} from '../services/cameraService'

const DEFAULT_SETTINGS: CameraSettings = {
  resolution: '5.7K',
  fps: 30,
  autoStartWithSurvey: true,
  autoStopWithSurvey: true,
  autoDownloadAfterSurvey: true,
  capturePhotosAtPOI: false,
  showHUD: true,
  hudPosition: 'top-right'
}

function loadSettingsFromStorage(): CameraSettings {
  try {
    const saved = localStorage.getItem('measurepro_camera_settings')
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
  } catch {}
  return DEFAULT_SETTINGS
}

interface DownloadProgress {
  jobId: string
  status: 'running' | 'done' | 'error'
  totalFiles: number
  downloadedFiles: number
  currentFile?: string
  errorMessage?: string
}

interface CameraStore360State {
  bridgeOnline: boolean
  cameraConnected: boolean
  status: CameraStatus | null
  settings: CameraSettings
  cameraError: CameraError | null
  cameraWarnings: string[]
  isCapturingPhoto: boolean
  lastPhotoResult: string | null
  downloadProgress: DownloadProgress | null
  activeSurveyId: string | null

  _pollInterval: ReturnType<typeof setInterval> | null
  _downloadInterval: ReturnType<typeof setInterval> | null
  _downloadJobId: string | null
  _wasRecording: boolean
}

interface CameraStore360Actions {
  startForSurvey: (surveyId: string) => Promise<void>
  stopForSurvey: (surveyId: string) => Promise<void>
  capturePhotoPOI: (geoData: {
    lat: number
    lng: number
    altitude: number
    heading: number
    surveyId: string
    poiType: string
    poiLabel: string
  }) => Promise<string | null>
  dismissError: () => void
  retryAfterError: () => Promise<void>
  saveSettings: (newSettings: CameraSettings) => Promise<void>
  startPolling: () => void
  stopPolling: () => void
  refreshStatus: () => Promise<void>
  _checkConnections: () => Promise<void>
}

type CameraStore360 = CameraStore360State & CameraStore360Actions

export const useCameraStore360 = create<CameraStore360>((set, get) => ({
  bridgeOnline: false,
  cameraConnected: false,
  status: null,
  settings: loadSettingsFromStorage(),
  cameraError: null,
  cameraWarnings: [],
  isCapturingPhoto: false,
  lastPhotoResult: null,
  downloadProgress: null,
  activeSurveyId: null,

  _pollInterval: null,
  _downloadInterval: null,
  _downloadJobId: null,
  _wasRecording: false,

  _checkConnections: async () => {
    const state = get()

    const bridge = await cameraService.checkBridge()
    set({ bridgeOnline: bridge })

    if (!bridge) {
      if (state.activeSurveyId && state.cameraConnected) {
        set({
          cameraError: {
            code: 'CONNECTION_LOST',
            message: 'Camera service disconnected!',
            detail: 'The camera-bridge service is not responding.',
            recoverable: true,
            action: 'Stop the vehicle. Check the USB-C cable from the camera.'
          }
        })
      }
      set({ cameraConnected: false, status: null })
      return
    }

    const cam = await cameraService.checkCamera()
    set({ cameraConnected: cam })

    if (!cam) {
      if (state.activeSurveyId) {
        set({
          cameraError: {
            code: 'CONNECTION_LOST',
            message: '360° camera disconnected!',
            detail: 'The X5 camera is not responding over USB.',
            recoverable: true,
            action: 'Stop the vehicle. Check the USB-C cable.'
          }
        })
      }
      set({ status: null })
      return
    }

    try {
      const s = await cameraService.getStatus()
      if (!s.success) return

      const newStatus: CameraStatus = s.data
      const wasRecording = get()._wasRecording

      if (
        state.activeSurveyId &&
        wasRecording &&
        !newStatus.isRecording
      ) {
        set({
          cameraError: {
            code: 'RECORDING_STOPPED',
            message: '360° recording interrupted!',
            detail: 'The camera stopped recording during the survey.',
            recoverable: true,
            action: 'Stop the vehicle. Check storage and USB cable.'
          }
        })
      }

      set({ _wasRecording: newStatus.isRecording })

      const warnings: string[] = []
      if (newStatus.batteryPercent < 20 && newStatus.batteryPercent >= 0) {
        warnings.push(`Low battery: ${newStatus.batteryPercent}%`)
      }
      if (newStatus.storageFreeMB < 1024) {
        warnings.push(`Low storage: ${(newStatus.storageFreeMB / 1024).toFixed(1)} GB`)
      }
      if (newStatus.storageFreeMB < 100 && state.activeSurveyId) {
        set({
          cameraError: {
            code: 'STORAGE_FULL',
            message: 'Camera storage almost full!',
            detail: `Only ${newStatus.storageFreeMB} MB remaining.`,
            recoverable: false,
            action: 'Cannot continue. Free up space on the SD card.'
          }
        })
      }

      set({ cameraWarnings: warnings, status: newStatus })
    } catch {
      // Status fetch failed — not critical unless mid-survey
    }
  },

  startPolling: () => {
    const state = get()
    if (state._pollInterval) return

    get()._checkConnections()
    const interval = setInterval(() => {
      get()._checkConnections()
    }, 10000)
    set({ _pollInterval: interval })
  },

  stopPolling: () => {
    const state = get()
    if (state._pollInterval) {
      clearInterval(state._pollInterval)
      set({ _pollInterval: null })
    }
  },

  refreshStatus: async () => {
    await get()._checkConnections()
  },

  startForSurvey: async (surveyId: string) => {
    set({ activeSurveyId: surveyId })
    get().startPolling()
    const state = get()
    if (!state.settings.autoStartWithSurvey || !state.cameraConnected) return

    try {
      const result = await cameraService.startRecording({
        resolution: state.settings.resolution,
        fps: state.settings.fps
      })
      if (!result.success) throw new Error(result.error || 'Unknown error')
      set({ cameraError: null, _wasRecording: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({
        cameraError: {
          code: 'START_FAILED',
          message: '360° camera did not start.',
          detail: msg,
          recoverable: true,
          action: 'Check the USB-C cable and click Retry.'
        }
      })
    }
  },

  stopForSurvey: async (surveyId: string) => {
    set({ activeSurveyId: null, _wasRecording: false, cameraError: null })
    get().stopPolling()
    const state = get()

    if (!state.cameraConnected) return

    if (state.settings.autoStopWithSurvey && state.status?.isRecording) {
      try {
        await cameraService.stopRecording()
      } catch (e) {
        console.warn('Camera stop failed:', e)
      }
    }

    if (state.settings.autoDownloadAfterSurvey) {
      try {
        const result = await cameraService.startPostSurveyDownload(surveyId)
        if (result.jobId) {
          set({ _downloadJobId: result.jobId })
          const downloadInterval = setInterval(async () => {
            const jobId = get()._downloadJobId
            if (!jobId) {
              clearInterval(downloadInterval)
              return
            }
            try {
              const progress = await cameraService.getDownloadProgress(jobId)
              set({ downloadProgress: { ...progress, jobId } })
              if (progress.status === 'done' || progress.status === 'error') {
                clearInterval(downloadInterval)
              }
            } catch {
              clearInterval(downloadInterval)
            }
          }, 2000)
          set({ _downloadInterval: downloadInterval })
        }
      } catch (e) {
        console.warn('Auto-download failed:', e)
      }
    }
  },

  capturePhotoPOI: async (geoData) => {
    const state = get()
    if (!state.cameraConnected || state.isCapturingPhoto) return null

    set({ isCapturingPhoto: true })
    try {
      const result = await cameraService.capturePhotoPOI(geoData)
      if (result.success) {
        set({ lastPhotoResult: result.filename })
        setTimeout(() => set({ lastPhotoResult: null }), 3000)
        return result.filename
      }
      throw new Error(result.error || 'Photo failed')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({
        cameraError: {
          code: 'WRITE_ERROR',
          message: '360° photo failed.',
          detail: msg,
          recoverable: true,
          action: 'Retry. Check camera storage.'
        }
      })
      return null
    } finally {
      set({ isCapturingPhoto: false })
    }
  },

  dismissError: () => {
    set({ cameraError: null })
  },

  retryAfterError: async () => {
    const state = get()
    if (!state.cameraError) return
    const errorCode = state.cameraError.code
    set({ cameraError: null })

    if (errorCode === 'START_FAILED' || errorCode === 'RECORDING_STOPPED') {
      if (state.activeSurveyId) {
        await get().startForSurvey(state.activeSurveyId)
      }
    } else {
      await get()._checkConnections()
    }
  },

  saveSettings: async (newSettings: CameraSettings) => {
    set({ settings: newSettings })
    localStorage.setItem('measurepro_camera_settings', JSON.stringify(newSettings))
    try { await cameraService.saveSettings(newSettings) } catch {}
  }
}))
