import { useState, useEffect } from 'react'
import '../styles/camera.css'
import { cameraService } from '../services/cameraService'
import { useCameraControl } from '../hooks/useCameraControl'

interface CameraPreCheckModalProps {
  isOpen: boolean
  onConfirmWithCamera: () => void
  onSkipCamera: () => void
}

export function CameraPreCheckModal({
  isOpen,
  onConfirmWithCamera,
  onSkipCamera
}: CameraPreCheckModalProps) {
  const { status, cameraConnected } = useCameraControl()

  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError,   setPreviewError]   = useState<string | null>(null)

  const [checklist, setChecklist] = useState({
    lensClean:   false,
    mountSecure: false,
    batteryOk:   false,
    storageOk:   false
  })

  useEffect(() => {
    if (status) {
      setChecklist(c => ({
        ...c,
        batteryOk: status.batteryPercent > 20,
        storageOk: status.storageFreeMB  > 2048
      }))
    }
  }, [status])

  useEffect(() => {
    if (!isOpen && previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (!isOpen) {
      setPreviewError(null)
      setPreviewLoading(false)
      setChecklist({ lensClean: false, mountSecure: false, batteryOk: false, storageOk: false })
    }
  }, [isOpen])

  async function loadPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const url = await cameraService.getPreviewSnapshotUrl()
      setPreviewUrl(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPreviewError('Cannot load preview: ' + msg)
    } finally {
      setPreviewLoading(false)
    }
  }

  function toggle(key: keyof typeof checklist) {
    if (key === 'batteryOk' || key === 'storageOk') return
    setChecklist(c => ({ ...c, [key]: !c[key] }))
  }

  const allChecked = Object.values(checklist).every(Boolean)

  if (!isOpen) return null

  return (
    <div className="camera-precheck-overlay" role="dialog" aria-modal="true">
      <div className="camera-precheck-modal">

        <h2 className="camera-precheck-title">
          360° Camera Pre-Check Before Survey
        </h2>

        <div className="camera-precheck-preview">
          {!previewUrl && !previewLoading && !previewError && (
            <button
              className="preview-load-btn"
              onClick={loadPreview}
              disabled={!cameraConnected}
              data-testid="button-preview-load"
            >
              📷 Load preview (lens inspection)
            </button>
          )}

          {previewLoading && (
            <div className="preview-loading">
              <span className="preview-loading-spinner" />
              Capturing... (~10-15 seconds)
            </div>
          )}

          {previewError && (
            <div className="preview-error">
              <span>{previewError}</span>
              <button onClick={loadPreview} className="preview-retry-btn" data-testid="button-preview-refresh">
                Retry
              </button>
            </div>
          )}

          {previewUrl && (
            <div className="preview-image-wrap">
              <img
                src={previewUrl}
                alt="360° camera preview — lens inspection"
                className="camera-precheck-image"
              />
              <div className="preview-image-footer">
                <p>Check that both lenses are clean across their full surface.</p>
                <button onClick={loadPreview} className="preview-refresh-btn" data-testid="button-preview-refresh">
                  ↺ Refresh preview
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="camera-precheck-list">
          <h3>Pre-departure checklist</h3>

          <label className="precheck-item" onClick={() => toggle('lensClean')}>
            <input
              type="checkbox"
              checked={checklist.lensClean}
              onChange={() => toggle('lensClean')}
              data-testid="check-lens-clean"
            />
            <span>Lenses clean and unobstructed (water, mud, fingerprints)</span>
          </label>

          <label className="precheck-item" onClick={() => toggle('mountSecure')}>
            <input
              type="checkbox"
              checked={checklist.mountSecure}
              onChange={() => toggle('mountSecure')}
              data-testid="check-mount-secure"
            />
            <span>Roof mount securely attached, USB-C cable properly connected</span>
          </label>

          <label className={`precheck-item ${!checklist.batteryOk ? 'precheck-item--auto-warn' : 'precheck-item--auto-ok'}`}>
            <input
              type="checkbox"
              checked={checklist.batteryOk}
              readOnly
              disabled
              data-testid="check-battery-ok"
            />
            <span>
              {checklist.batteryOk
                ? `Battery sufficient (${status?.batteryPercent ?? '?'}%)`
                : `Low battery (${status?.batteryPercent ?? '?'}%) — charge before starting`
              }
            </span>
          </label>

          <label className={`precheck-item ${!checklist.storageOk ? 'precheck-item--auto-warn' : 'precheck-item--auto-ok'}`}>
            <input
              type="checkbox"
              checked={checklist.storageOk}
              readOnly
              disabled
              data-testid="check-storage-ok"
            />
            <span>
              {checklist.storageOk
                ? `Storage sufficient (${((status?.storageFreeMB ?? 0) / 1024).toFixed(1)} GB free)`
                : `Insufficient storage (${((status?.storageFreeMB ?? 0) / 1024).toFixed(1)} GB) — free up space`
              }
            </span>
          </label>
        </div>

        <div className="camera-precheck-actions">
          <button
            className="precheck-btn precheck-btn--confirm"
            onClick={onConfirmWithCamera}
            disabled={!allChecked}
            data-testid="button-precheck-confirm"
          >
            ✓ Camera ready — Start survey
          </button>
          <button
            className="precheck-btn precheck-btn--skip"
            onClick={onSkipCamera}
            data-testid="button-precheck-skip"
          >
            Start without 360° camera
          </button>
        </div>

      </div>
    </div>
  )
}
