import { useEffect } from 'react'
import { useCameraStore360 } from '../stores/cameraStore360'
import { useSurveyStore } from '../lib/survey'
import type { CameraSettings, CameraPhotoPOIData } from '../services/cameraService'

export function useCameraControl() {
  const store = useCameraStore360()
  const { activeSurvey } = useSurveyStore()

  useEffect(() => {
    store.refreshStatus()
  }, [])

  useEffect(() => {
    const surveyId = activeSurvey?.id ?? null
    const storedSurveyId = useCameraStore360.getState().activeSurveyId
    if (surveyId !== storedSurveyId) {
      useCameraStore360.setState({ activeSurveyId: surveyId })
      if (surveyId && !storedSurveyId) {
        store.startPolling()
      } else if (!surveyId && storedSurveyId) {
        store.stopPolling()
      }
    }
  }, [activeSurvey?.id])

  return {
    bridgeOnline: store.bridgeOnline,
    cameraConnected: store.cameraConnected,
    status: store.status,
    settings: store.settings,
    cameraError: store.cameraError,
    cameraWarnings: store.cameraWarnings,
    isCapturingPhoto: store.isCapturingPhoto,
    lastPhotoResult: store.lastPhotoResult,
    downloadProgress: store.downloadProgress,
    activeSurveyId: store.activeSurveyId,
    startForSurvey: store.startForSurvey,
    stopForSurvey: store.stopForSurvey,
    capturePhotoPOI: store.capturePhotoPOI,
    retryAfterError: store.retryAfterError,
    dismissError: store.dismissError,
    saveSettings: store.saveSettings,
    refreshStatus: store.refreshStatus,
  }
}

export type { CameraSettings, CameraPhotoPOIData }
