import React, { useState } from 'react';
import { AlertTriangle, X, Mail } from 'lucide-react';
import { soundManager } from '../lib/sounds';
import { useSerialStore } from '../lib/stores/serialStore';
import { useGPSStore } from '../lib/stores/gpsStore';
import { sendAlertThresholdEmail } from '../lib/utils/emailUtils';
import { getAlertEmailRecipients } from '../lib/utils/emailConfig';
import { useSurveyStore } from '../lib/survey';
import { useSettingsStore } from '../lib/settings';

interface AlertBannerProps {
  alertStatus: 'warning' | 'critical' | null;
  setAlertStatus: (status: 'warning' | 'critical' | null) => void;
  triggerValue: number | null;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ alertStatus, setAlertStatus, triggerValue }) => {
  const { data: gpsData } = useGPSStore();
  const { activeSurvey } = useSurveyStore();
  const { alertSettings } = useSettingsStore();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const warningTimeout = React.useRef<number | null>(null);

  const handleSendEmail = async () => {
    if (!triggerValue || !alertStatus) return;

    setSendingEmail(true);
    const thresholdValue = alertStatus === 'critical' 
      ? alertSettings?.thresholds?.criticalThreshold ?? 4.0
      : alertSettings?.thresholds?.warningThreshold ?? 4.2;

    // Get alert recipients with admin BCC
    const { to, bcc } = getAlertEmailRecipients();
    
    // Add manually entered email if provided
    const recipients = emailAddress.trim() ? [...to, emailAddress.trim()] : to;

    await sendAlertThresholdEmail({
      to: recipients,
      bcc, // Always includes admin@soltec.ca
      alertType: alertStatus.toUpperCase() as 'WARNING' | 'CRITICAL',
      measurementValue: triggerValue,
      thresholdValue,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      altitude: gpsData.altitude,
      heading: gpsData.course,
      speed: gpsData.speed,
      surveyTitle: activeSurvey?.surveyTitle,
      surveyorName: activeSurvey?.surveyor,
      clientName: activeSurvey?.customerName,
      projectNumber: activeSurvey?.description,
    });

    setSendingEmail(false);
    setShowEmailDialog(false);
  };

  React.useEffect(() => {
    if (alertStatus === 'warning') {
      // Auto-clear warning after 15 seconds
      warningTimeout.current = window.setTimeout(() => {
        setAlertStatus(null);
        soundManager.stopSound('warning');
      }, 15000);
    }

    return () => {
      if (warningTimeout.current) {
        clearTimeout(warningTimeout.current);
      }
    };
  }, [alertStatus]);

  if (!alertStatus) return null;

  return (
    <>
      <div className={`col-span-2 p-4 rounded-lg ${
        alertStatus === 'critical' ? 'bg-red-500/20 border-l-4 border-red-500' : 'bg-orange-500/20 border-l-4 border-orange-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-6 h-6 ${alertStatus === 'critical' ? 'text-red-500' : 'text-orange-500'}`} />
            <div>
              <h3 className={`font-bold ${alertStatus === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>
                {alertStatus === 'critical' ? 'Critical Height Warning' : 'Height Warning'}
              </h3>
              <p className="text-gray-300">
                Measurement {triggerValue?.toFixed(3)}m exceeds safe threshold
                <br />
                <span className="text-sm">
                  Location: {gpsData.latitude.toFixed(6)}°N, {gpsData.longitude.toFixed(6)}°E, Alt: {gpsData.altitude.toFixed(1)}m
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEmailDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              data-testid="button-email-alert"
            >
              <Mail className="w-4 h-4" />
              Email Alert
            </button>
            <button
              onClick={() => {
                setAlertStatus(null);
                soundManager.stopSound('warning');
                soundManager.stopSound('critical');
                if (warningTimeout.current) {
                  clearTimeout(warningTimeout.current);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
              data-testid="button-clear-alert"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {showEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEmailDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Email Alert Notification</h3>
            <p className="text-gray-300 mb-4">
              Send this {alertStatus} alert notification via email
            </p>
            {getAlertEmailRecipients().to.length > 0 && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">
                  Configured recipients: {getAlertEmailRecipients().to.join(', ')}
                </p>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Additional Recipient (optional)</label>
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="optional@email.com"
                data-testid="input-alert-email"
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave empty to send only to configured recipients
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
                data-testid="button-send-alert-email"
              >
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
              <button
                onClick={() => setShowEmailDialog(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                data-testid="button-cancel-alert-email"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AlertBanner;