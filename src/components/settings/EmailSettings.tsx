import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { Mail, Plus, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../lib/settings';

interface EmailConfig {
  alertRecipients: string[];
  surveyRecipients: string[];
}

const EmailSettings = () => {
  const [config, setConfig] = useState<EmailConfig>(() => {
    const stored = useSettingsStore.getState().uiSettings.emailConfig;
    if (stored && typeof stored === 'object' && 'alertRecipients' in stored) {
      return stored as EmailConfig;
    }
    const saved = localStorage.getItem('emailConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
      }
    }
    return {
      alertRecipients: [],
      surveyRecipients: []
    };
  });

  const [newAlertEmail, setNewAlertEmail] = useState('');
  const [newSurveyEmail, setNewSurveyEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    useSettingsStore.getState().setUISettings({ emailConfig: config as Record<string, unknown> });
  }, [config]);

  const addAlertRecipient = () => {
    if (newAlertEmail && isValidEmail(newAlertEmail)) {
      if (!config.alertRecipients.includes(newAlertEmail)) {
        setConfig({
          ...config,
          alertRecipients: [...config.alertRecipients, newAlertEmail]
        });
        setNewAlertEmail('');
      }
    }
  };

  const removeAlertRecipient = (email: string) => {
    setConfig({
      ...config,
      alertRecipients: config.alertRecipients.filter(e => e !== email)
    });
  };

  const addSurveyRecipient = () => {
    if (newSurveyEmail && isValidEmail(newSurveyEmail)) {
      if (!config.surveyRecipients.includes(newSurveyEmail)) {
        setConfig({
          ...config,
          surveyRecipients: [...config.surveyRecipients, newSurveyEmail]
        });
        setNewSurveyEmail('');
      }
    }
  };

  const removeSurveyRecipient = (email: string) => {
    setConfig({
      ...config,
      surveyRecipients: config.surveyRecipients.filter(e => e !== email)
    });
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const sendTestEmail = async () => {
    if (!testEmail || !isValidEmail(testEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSendingTest(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: testEmail,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // toast suppressed
        setTestEmail('');
      } else {
        throw new Error(result.error || 'Failed to send test email');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test email. Please check your email configuration.';
      toast.error(message);
    } finally {
      setIsSendingTest(false);
    }
  };

  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold">Email Notifications</h2>
      </div>

      <div className="space-y-6">
        {/* Alert Email Recipients */}
        <div>
          <h3 className="text-lg font-medium mb-2">Alert Notifications</h3>
          <p className="text-sm text-gray-400 mb-4">
            Receive emails when WARNING or CRITICAL height thresholds are exceeded. 
            Alerts include survey details, GPS location, vehicle speed, measurements, and all captured media.
          </p>
          
          <div className="space-y-2 mb-3">
            {config.alertRecipients.map((email) => (
              <div key={email} className="flex items-center gap-2 bg-gray-700 p-2 rounded-lg">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="flex-1 text-sm">{email}</span>
                <button
                  onClick={() => removeAlertRecipient(email)}
                  className="text-red-400 hover:text-red-300"
                  data-testid={`button-remove-alert-${email}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={newAlertEmail}
              onChange={(e) => setNewAlertEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addAlertRecipient()}
              className={commonInputClasses}
              data-testid="input-alert-email"
            />
            <button
              onClick={addAlertRecipient}
              disabled={!newAlertEmail || !isValidEmail(newAlertEmail)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
              data-testid="button-add-alert-email"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Survey Completion Email Recipients */}
        <div>
          <h3 className="text-lg font-medium mb-2">Survey Completion Reports</h3>
          <p className="text-sm text-gray-400 mb-4">
            Automatically send survey reports (CSV, JSON, GeoJSON) when a survey is completed.
            Reports include all measurements, GPS data, and captured media.
          </p>

          <div className="space-y-2 mb-3">
            {config.surveyRecipients.map((email) => (
              <div key={email} className="flex items-center gap-2 bg-gray-700 p-2 rounded-lg">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="flex-1 text-sm">{email}</span>
                <button
                  onClick={() => removeSurveyRecipient(email)}
                  className="text-red-400 hover:text-red-300"
                  data-testid={`button-remove-survey-${email}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={newSurveyEmail}
              onChange={(e) => setNewSurveyEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSurveyRecipient()}
              className={commonInputClasses}
              data-testid="input-survey-email"
            />
            <button
              onClick={addSurveyRecipient}
              disabled={!newSurveyEmail || !isValidEmail(newSurveyEmail)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
              data-testid="button-add-survey-email"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Test Email */}
        <div className="p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
          <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
            <Send className="w-4 h-4" />
            Test Email Service
          </h4>
          <p className="text-sm text-gray-300 mb-4">
            Send a test email to verify that the email service is configured and working correctly.
          </p>
          
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter test recipient email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendTestEmail()}
              className={commonInputClasses}
              data-testid="input-test-email"
            />
            <button
              onClick={sendTestEmail}
              disabled={!testEmail || !isValidEmail(testEmail) || isSendingTest}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 whitespace-nowrap"
              data-testid="button-send-test-email"
            >
              <Send className="w-4 h-4" />
              {isSendingTest ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;
