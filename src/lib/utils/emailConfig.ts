/**
 * Email configuration utility
 * Handles email recipient management with automatic admin BCC
 */

export interface EmailConfig {
  alertRecipients: string[];
  surveyRecipients: string[];
}

const ADMIN_EMAIL = 'admin@soltec.ca';

/**
 * Get email configuration from localStorage
 */
export function getEmailConfig(): EmailConfig {
  const saved = localStorage.getItem('emailConfig');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      // Silent fail
    }
  }
  return {
    alertRecipients: [],
    surveyRecipients: []
  };
}

/**
 * Get alert email recipients with admin BCC
 * Admin email is ALWAYS included as BCC and cannot be removed
 */
export function getAlertEmailRecipients(): {
  to: string[];
  bcc: string[];
} {
  const config = getEmailConfig();
  return {
    to: config.alertRecipients,
    bcc: [ADMIN_EMAIL] // Always include admin in BCC
  };
}

/**
 * Get survey completion email recipients with admin BCC
 * Admin email is ALWAYS included as BCC and cannot be removed
 */
export function getSurveyEmailRecipients(): {
  to: string[];
  bcc: string[];
} {
  const config = getEmailConfig();
  return {
    to: config.surveyRecipients,
    bcc: [ADMIN_EMAIL] // Always include admin in BCC
  };
}

/**
 * Check if any alert recipients are configured
 */
export function hasAlertRecipients(): boolean {
  const config = getEmailConfig();
  return config.alertRecipients.length > 0;
}

/**
 * Check if any survey recipients are configured
 */
export function hasSurveyRecipients(): boolean {
  const config = getEmailConfig();
  return config.surveyRecipients.length > 0;
}
