import '../styles/camera.css'
import { useCameraControl } from '../hooks/useCameraControl'
import type { CameraSettings } from '../services/cameraService'

export function CameraSettingsPanel() {
  const {
    bridgeOnline,
    cameraConnected,
    status,
    settings,
    saveSettings,
    refreshStatus
  } = useCameraControl()

  function update<K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) {
    saveSettings({ ...settings, [key]: value })
  }

  return (
    <div className="camera-settings-section" data-testid="panel-camera-settings">
      <h3>360° Camera — Insta360 X5 <span style={{fontSize:11,color:"#4ade80",fontWeight:400}}>(Direct USB-C)</span></h3>

      {/* Bridge service row hidden — Insta360 X5 uses direct WiFi/USB-C (no bridge needed) */}

      <div className="settings-status-row">
        <span>USB camera</span>
        <span className={cameraConnected ? 'status-ok' : 'status-warn'} data-testid="status-camera-connected">
          {cameraConnected ? '● Connected' : '● Not detected'}
        </span>
      </div>

      {status && cameraConnected && (
        <>
          <div className="settings-status-row">
            <span>Battery</span>
            <span className={status.batteryPercent < 20 ? 'status-warn' : ''} data-testid="status-battery">
              {status.batteryPercent}%
            </span>
          </div>
          <div className="settings-status-row">
            <span>Free storage</span>
            <span className={status.storageFreeMB < 1024 ? 'status-warn' : ''} data-testid="status-storage">
              {(status.storageFreeMB / 1024).toFixed(1)} GB
            </span>
          </div>
          <div className="settings-status-row">
            <span>Firmware</span>
            <span data-testid="status-firmware">{status.firmwareVersion}</span>
          </div>
        </>
      )}

      <button onClick={refreshStatus} className="settings-refresh-btn" data-testid="button-camera-refresh">
        ↺ Refresh status
      </button>

      <hr className="camera-settings-hr" />

      <h4>Recording</h4>

      <label className="settings-row">
        <span>Video resolution</span>
        <select
          value={settings.resolution}
          onChange={e => update('resolution', e.target.value as CameraSettings['resolution'])}
          data-testid="select-camera-resolution"
        >
          <option value="5.7K">5.7K (recommended)</option>
          <option value="8K">8K — Maximum quality</option>
          <option value="4K">4K — Reduced storage</option>
        </select>
      </label>

      <label className="settings-row">
        <span>Frame rate (FPS)</span>
        <select
          value={settings.fps}
          onChange={e => update('fps', parseInt(e.target.value, 10) as CameraSettings['fps'])}
          data-testid="select-camera-fps"
        >
          <option value={24}>24 fps — Film look</option>
          <option value={30}>30 fps — Standard (recommended)</option>
          <option value={60}>60 fps — Smooth motion</option>
        </select>
      </label>

      <hr className="camera-settings-hr" />

      <h4>Automation</h4>

      <label className="settings-toggle-row">
        <span>
          Auto-start with survey
          <small>Camera starts when you click "Create Survey"</small>
        </span>
        <input
          type="checkbox"
          checked={settings.autoStartWithSurvey}
          onChange={e => update('autoStartWithSurvey', e.target.checked)}
          data-testid="toggle-auto-start"
        />
      </label>

      <label className="settings-toggle-row">
        <span>
          Auto-stop with survey
          <small>Camera stops when you click "Close Survey"</small>
        </span>
        <input
          type="checkbox"
          checked={settings.autoStopWithSurvey}
          onChange={e => update('autoStopWithSurvey', e.target.checked)}
          data-testid="toggle-auto-stop"
        />
      </label>

      <label className="settings-toggle-row">
        <span>
          Auto-download after survey
          <small>.insv files are copied to C:\SolTec\Surveys\ in the background after the survey</small>
        </span>
        <input
          type="checkbox"
          checked={settings.autoDownloadAfterSurvey}
          onChange={e => update('autoDownloadAfterSurvey', e.target.checked)}
          data-testid="toggle-auto-download"
        />
      </label>

      <label className="settings-toggle-row">
        <span>
          Auto 360° photo at each POI
          <small>
            ⚠️ Takes a photo at EVERY POI created automatically.
            Disabled by default — use the manual button in the HUD.
          </small>
        </span>
        <input
          type="checkbox"
          checked={settings.capturePhotosAtPOI}
          onChange={e => update('capturePhotosAtPOI', e.target.checked)}
          data-testid="toggle-capture-at-poi"
        />
      </label>

      <hr className="camera-settings-hr" />

      <h4>HUD Display</h4>

      <label className="settings-toggle-row">
        <span>
          Show camera HUD
          <small>Compact status indicator overlaid on the map</small>
        </span>
        <input
          type="checkbox"
          checked={settings.showHUD}
          onChange={e => update('showHUD', e.target.checked)}
          data-testid="toggle-show-hud"
        />
      </label>

      <label className="settings-row">
        <span>HUD position</span>
        <select
          value={settings.hudPosition}
          onChange={e => update('hudPosition', e.target.value as CameraSettings['hudPosition'])}
          data-testid="select-hud-position"
        >
          <option value="top-right">Top right (default)</option>
          <option value="top-left">Top left</option>
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
        </select>
      </label>

      <hr className="camera-settings-hr" />

      <h4>Diagnostics</h4>
      <p className="settings-note">
        The bridge service starts automatically with Windows.
        If the camera is not detected, check the USB-C cable
        and ensure the X5 firmware is up to date.<br />
        Logs: <code>C:\SolTec\camera-bridge\logs\</code>
      </p>

      {!bridgeOnline && (
        <div className="settings-bridge-warning" data-testid="warning-bridge-offline">
          ⚠️ The camera-bridge service is not running.
          Run <code>node dist/server.js</code> in the camera-bridge folder,
          or restart Windows for automatic startup.
        </div>
      )}
    </div>
  )
}
