import { Client } from '@microsoft/microsoft-graph-client';
import {
  ContactFormEmail,
  SurveyCompletionEmail,
  AlertThresholdEmail,
  DataExportEmail,
  LiveMonitorQREmail,
  SyncCompletionEmail,
  TestEmail,
  MeasurementLogEmail,
  EmailResponse,
  SubscriptionEmail,
  VerificationCodeEmail,
  AccountApprovalEmail,
  WelcomeEmail,
  OfflineWarningEmail,
  CancellationEmail,
  DeletionWarningEmail,
  TermsChangeNotification,
} from '../../shared/schema.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@soltec.ca';
const SUPPORT_EMAIL = 'Info@SolTecInnovation.com';

/**
 * Ensures admin@soltec.ca is ALWAYS in the BCC list
 * This is enforced server-side and cannot be bypassed by client tampering
 */
function enforceAdminBCC(bccList: string[]): string[] {
  const uniqueBcc = new Set(bccList || []);
  uniqueBcc.add(ADMIN_EMAIL); // ALWAYS add admin - non-negotiable
  return Array.from(uniqueBcc);
}

/**
 * Creates a professional email template wrapper with MeasurePRO branding
 */
function createProfessionalEmailTemplate(title: string, content: string, alertLevel?: 'success' | 'warning' | 'critical' | 'info'): string {
  const accentColors = {
    success: '#10b981',
    warning: '#f59e0b', 
    critical: '#dc2626',
    info: '#3b82f6'
  };
  
  const accentColor = accentColors[alertLevel || 'info'];
  
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 8px 8px 0 0;">
                    <div style="display: inline-block; vertical-align: middle;">
                      <span style="font-size: 32px; color: #fbbf24;">⚡</span>
                      <span style="font-size: 28px; font-weight: 700; color: #ffffff; margin-left: 10px; letter-spacing: -0.5px;">Measure<span style="color: #fbbf24;">PRO</span></span>
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #cbd5e1;">Professional Survey & Measurement System</p>
                  </td>
                </tr>
                
                <!-- Title Bar -->
                <tr>
                  <td style="padding: 0;">
                    <div style="height: 4px; background: ${accentColor};"></div>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h1 style="margin: 0 0 30px 0; font-size: 24px; font-weight: 600; color: #1e293b; border-bottom: 2px solid ${accentColor}; padding-bottom: 15px;">
                      ${title}
                    </h1>
                    ${content}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">
                            Powered by MeasurePRO Professional Survey System
                          </p>
                          <p style="margin: 0 0 10px 0; font-size: 13px;">
                            <a href="https://soltecInnovation.com" style="color: #3b82f6; text-decoration: none; font-weight: 500;">
                              SolTecInnovation.com
                            </a>
                          </p>
                          <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                            © ${new Date().getFullYear()} SolTec Innovation. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

// Outlook integration — token cache (never cache the Client itself, only the settings)
let _outlookConnectionSettings: any;

// Get access token from Replit Outlook connection
async function getAccessToken(): Promise<string> {
  // Return cached token if it hasn't expired yet
  if (
    _outlookConnectionSettings &&
    _outlookConnectionSettings.settings?.expires_at &&
    new Date(_outlookConnectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return _outlookConnectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  _outlookConnectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        Accept: 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data: any) => data.items?.[0]);

  const accessToken =
    _outlookConnectionSettings?.settings?.access_token ||
    _outlookConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!_outlookConnectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }

  return accessToken;
}

// Get Outlook Graph client — WARNING: Never cache this client; tokens expire.
// Always call this function fresh on each request.
async function getOutlookClient(): Promise<Client> {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken,
    },
  });
}

// Email template builders
function buildContactFormEmail(data: ContactFormEmail): any {
  const content = `
    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>From:</strong> ${data.name}</p>
      <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
      <p><strong>Subject:</strong> ${data.subject}</p>
    </div>
    
    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937;">Message:</h3>
      <p style="white-space: pre-wrap; background-color: #f9fafb; padding: 15px; border-left: 4px solid #2563eb; border-radius: 4px;">
        ${data.message}
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('New Contact Form Submission', content, 'info');

  return {
    subject: `⚡ MeasurePRO: Contact Form - ${data.subject}`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: SUPPORT_EMAIL } }],
    bccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    replyTo: [{ emailAddress: { address: data.email } }],
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

function buildSurveyCompletionEmail(data: SurveyCompletionEmail): any {
  // Build download section based on whether we have a cloud download link
  const downloadSection = data.downloadUrl 
    ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937;">📦 Download Complete Package</h3>
        <p>Your survey package${data.packageSize ? ` (${data.packageSize})` : ''} is ready for download:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${data.downloadUrl}" 
             style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            ⬇️ Download Survey Package
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          This link will expire in 72 hours. The package includes CSV, JSON, GeoJSON data, and all media files.
        </p>
      </div>
    `
    : `
      <div style="margin: 20px 0; background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <h3 style="color: #92400e; margin-top: 0;">📁 Package Downloaded Locally</h3>
        <p style="color: #78350f;">The complete survey package was saved to your device during survey closure. 
        If you need to share it, please forward the downloaded ZIP file manually.</p>
      </div>
    `;

  const content = `
    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #047857;">Survey Details</h3>
      <p><strong>Survey Title:</strong> ${data.surveyTitle}</p>
      <p><strong>Surveyor:</strong> ${data.surveyorName}</p>
      <p><strong>Client:</strong> ${data.clientName}</p>
      ${data.projectNumber ? `<p><strong>Project Number:</strong> ${data.projectNumber}</p>` : ''}
      <p><strong>Completion Date:</strong> ${new Date(data.completionDate).toLocaleString()}</p>
      <p><strong>Total Measurements:</strong> ${data.measurementCount}</p>
    </div>
    
    ${downloadSection}
    
    ${data.notes ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937;">Additional Notes:</h3>
        <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px;">
          ${data.notes}
        </p>
      </div>
    ` : ''}
  `;

  const htmlContent = createProfessionalEmailTemplate('📊 Survey Completed Successfully', content, 'success');

  const toRecipients = data.to.map(email => ({ emailAddress: { address: email } }));
  // ENFORCE admin BCC - cannot be removed by client tampering
  const enforcedBcc = enforceAdminBCC(data.bcc);
  const bccRecipients = enforcedBcc.map(email => ({ emailAddress: { address: email } }));

  console.log('Survey email - Enforced BCC includes admin:', enforcedBcc.includes(ADMIN_EMAIL));
  console.log('Survey email - Has download URL:', !!data.downloadUrl);

  return {
    subject: `⚡ MeasurePRO: Survey Report - ${data.surveyTitle}`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients,
    bccRecipients,
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

function buildAlertThresholdEmail(data: AlertThresholdEmail): any {
  const alertColor = data.alertType === 'CRITICAL' ? '#dc2626' : '#f59e0b';
  const alertEmoji = data.alertType === 'CRITICAL' ? '🚨' : '⚠️';
  
  const content = `
    <div style="background-color: ${data.alertType === 'CRITICAL' ? '#fef2f2' : '#fffbeb'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${alertColor};">
      <h3 style="margin-top: 0; color: ${alertColor};">Alert Information</h3>
      <p><strong>Alert Type:</strong> <span style="color: ${alertColor}; font-weight: bold;">${data.alertType}</span></p>
      <p><strong>Measurement Value:</strong> ${data.measurementValue.toFixed(3)}m</p>
      <p><strong>Threshold Value:</strong> ${data.thresholdValue.toFixed(3)}m</p>
      <p><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
    </div>

    ${data.surveyTitle || data.surveyorName || data.clientName ? `
    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937;">Survey Details</h3>
      <div style="background-color: #f0fdf4; padding: 15px; border-radius: 4px;">
        ${data.surveyTitle ? `<p><strong>Survey:</strong> ${data.surveyTitle}</p>` : ''}
        ${data.surveyorName ? `<p><strong>Surveyor:</strong> ${data.surveyorName}</p>` : ''}
        ${data.clientName ? `<p><strong>Client:</strong> ${data.clientName}</p>` : ''}
        ${data.projectNumber ? `<p><strong>Project Number:</strong> ${data.projectNumber}</p>` : ''}
        ${data.roadNumber ? `<p><strong>Road Number:</strong> ${data.roadNumber}</p>` : ''}
        ${data.poiNumber ? `<p><strong>POI Number:</strong> ${data.poiNumber}</p>` : ''}
      </div>
    </div>
    ` : ''}
    
    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937;">GPS Location</h3>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 4px;">
        <p><strong>Latitude:</strong> ${data.latitude.toFixed(6)}°</p>
        <p><strong>Longitude:</strong> ${data.longitude.toFixed(6)}°</p>
        ${data.altitude !== undefined ? `<p><strong>Altitude:</strong> ${data.altitude.toFixed(1)}m</p>` : ''}
        ${data.heading !== undefined ? `<p><strong>Heading:</strong> ${data.heading.toFixed(1)}°</p>` : ''}
        ${data.speed !== undefined ? `<p><strong>Vehicle Speed:</strong> ${data.speed.toFixed(1)} km/h</p>` : ''}
        <p><strong>Google Maps:</strong> <a href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" style="color: #2563eb;">View on Map</a></p>
      </div>
    </div>
    
    ${data.notes ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937;">Notes:</h3>
        <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px;">
          ${data.notes}
        </p>
      </div>
    ` : ''}

    ${data.attachments && data.attachments.length > 0 ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937;">Attachments:</h3>
        <div style="background-color: #dbeafe; padding: 15px; border-radius: 4px;">
          <p>📎 ${data.attachments.length} file(s) attached (photos/videos from the alert location)</p>
        </div>
      </div>
    ` : ''}
    
    <div style="margin-top: 30px; padding: 15px; background-color: ${data.alertType === 'CRITICAL' ? '#fee2e2' : '#fef3c7'}; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold;">
        ${data.alertType === 'CRITICAL' 
          ? '⚠️ CRITICAL: Immediate attention required!' 
          : '⚠️ WARNING: Please review this measurement.'}
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate(
    `${alertEmoji} ${data.alertType} Alert Triggered`,
    content,
    data.alertType === 'CRITICAL' ? 'critical' : 'warning'
  );

  const toRecipients = data.to.map(email => ({ emailAddress: { address: email } }));
  // ENFORCE admin BCC - cannot be removed by client tampering
  const enforcedBcc = enforceAdminBCC(data.bcc);
  const bccRecipients = enforcedBcc.map(email => ({ emailAddress: { address: email } }));

  console.log('Alert email - Enforced BCC includes admin:', enforcedBcc.includes(ADMIN_EMAIL));

  const message: any = {
    subject: `⚡ MeasurePRO: ${data.alertType} Alert - Threshold Exceeded`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients,
    bccRecipients,
    importance: data.alertType === 'CRITICAL' ? 'high' : 'normal',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };

  if (data.attachments && data.attachments.length > 0) {
    message.attachments = data.attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.filename,
      contentType: att.contentType,
      contentBytes: att.content,
    }));
  }

  return message;
}

function buildDataExportEmail(data: DataExportEmail): any {
  const content = `
    <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #1e40af;">Export Details</h3>
      <p><strong>Export Type:</strong> ${data.exportType.toUpperCase()}</p>
      <p><strong>Total Measurements:</strong> ${data.measurementCount}</p>
      <p><strong>Date Range:</strong> ${new Date(data.dateRange.from).toLocaleDateString()} - ${new Date(data.dateRange.to).toLocaleDateString()}</p>
    </div>
    
    ${data.filters ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937;">Applied Filters:</h3>
        <ul style="background-color: #f3f4f6; padding: 15px 15px 15px 35px; border-radius: 4px;">
          ${data.filters.surveyId ? `<li>Survey ID: ${data.filters.surveyId}</li>` : ''}
          ${data.filters.userId ? `<li>User ID: ${data.filters.userId}</li>` : ''}
          ${data.filters.poiType ? `<li>POI Type: ${data.filters.poiType}</li>` : ''}
        </ul>
      </div>
    ` : ''}
    
    <div style="margin: 20px 0; padding: 15px; background-color: #dcfce7; border-radius: 4px; border-left: 4px solid #10b981;">
      <p style="margin: 0;"><strong>📎 Attachment:</strong> ${data.attachment.filename}</p>
    </div>
    
    ${data.additionalNotes ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937;">Additional Notes:</h3>
        <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px;">
          ${data.additionalNotes}
        </p>
      </div>
    ` : ''}
  `;

  const htmlContent = createProfessionalEmailTemplate('📁 Data Export Ready', content, 'info');

  return {
    subject: `⚡ MeasurePRO: Data Export - ${data.exportType.toUpperCase()} (${data.measurementCount} measurements)`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    attachments: [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: data.attachment.filename,
        contentType: data.attachment.contentType,
        contentBytes: data.attachment.content,
      },
    ],
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

function buildLiveMonitorQREmail(data: LiveMonitorQREmail): any {
  const content = `
    <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <h3 style="margin-top: 0; color: #1e40af;">Scan to Access Live Monitor</h3>
      <p><strong>Shared by:</strong> ${data.senderName}</p>
      <div style="margin: 20px 0;">
        <img src="data:image/png;base64,${data.qrCodeBase64}" alt="QR Code" style="max-width: 300px; border: 2px solid #2563eb; padding: 10px; background: white;" />
      </div>
    </div>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 4px;">
      <h3 style="color: #1f2937; margin-top: 0;">Access Instructions:</h3>
      <ol style="margin: 10px 0; padding-left: 20px;">
        <li>Scan the QR code with your mobile device</li>
        <li>Or click this link: <a href="${data.monitorUrl}" style="color: #2563eb; word-break: break-all;">${data.monitorUrl}</a></li>
        <li>View real-time measurement data and analytics</li>
      </ol>
      ${data.accessInstructions ? `
        <div style="margin-top: 15px; padding: 10px; background-color: #e0f2fe; border-radius: 4px;">
          <p style="margin: 0;"><strong>Additional Instructions:</strong></p>
          <p style="margin: 5px 0 0 0;">${data.accessInstructions}</p>
        </div>
      ` : ''}
    </div>
    
    ${data.expiryDate ? `
      <div style="margin: 20px 0; padding: 15px; background-color: #fef3c7; border-radius: 4px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0;"><strong>⏰ Access Expires:</strong> ${new Date(data.expiryDate).toLocaleString()}</p>
      </div>
    ` : ''}
  `;

  const htmlContent = createProfessionalEmailTemplate('📱 Live Monitor Access - QR Code', content, 'info');

  return {
    subject: `⚡ MeasurePRO: Live Monitor Access - ${data.senderName}`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

function buildSyncCompletionEmail(data: SyncCompletionEmail): any {
  const statusColor = data.syncStatus === 'success' ? '#10b981' : data.syncStatus === 'partial' ? '#f59e0b' : '#dc2626';
  const statusEmoji = data.syncStatus === 'success' ? '✅' : data.syncStatus === 'partial' ? '⚠️' : '❌';
  
  const content = `
    <div style="background-color: ${data.syncStatus === 'success' ? '#f0fdf4' : data.syncStatus === 'partial' ? '#fffbeb' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
      <h3 style="margin-top: 0; color: ${statusColor};">Sync Summary</h3>
      <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; text-transform: uppercase;">${data.syncStatus}</span></p>
      <p><strong>Total Items:</strong> ${data.totalItems}</p>
      <p><strong>Successfully Synced:</strong> ${data.syncedItems}</p>
      ${data.failedItems > 0 ? `<p><strong>Failed Items:</strong> <span style="color: #dc2626;">${data.failedItems}</span></p>` : ''}
      <p><strong>Duration:</strong> ${data.syncDuration}</p>
      <p><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
    </div>
    
    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937;">Details:</h3>
      <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px;">
        ${data.summary}
      </p>
    </div>
    
    ${data.errors && data.errors.length > 0 ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #dc2626;">Errors:</h3>
        <ul style="background-color: #fef2f2; padding: 15px 15px 15px 35px; border-radius: 4px; border-left: 4px solid #dc2626;">
          ${data.errors.map(err => `
            <li><strong>${err.item}:</strong> ${err.error}</li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  const title = `${statusEmoji} Sync ${data.syncStatus === 'success' ? 'Completed' : data.syncStatus === 'partial' ? 'Partially Completed' : 'Failed'}`;
  const alertLevel = data.syncStatus === 'success' ? 'success' : data.syncStatus === 'partial' ? 'warning' : 'critical';
  const htmlContent = createProfessionalEmailTemplate(title, content, alertLevel);

  return {
    subject: `⚡ MeasurePRO: Sync ${data.syncStatus === 'success' ? 'Completed' : data.syncStatus === 'partial' ? 'Partially Completed' : 'Failed'} - ${data.syncedItems}/${data.totalItems} items`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    importance: data.syncStatus === 'failed' ? 'high' : 'normal',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

function buildMeasurementLogEmail(data: MeasurementLogEmail): any {
  const content = `
    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #047857;">Survey Details</h3>
      <p><strong>Survey Title:</strong> ${data.surveyTitle}</p>
      <p><strong>Surveyor:</strong> ${data.surveyorName}</p>
      <p><strong>Client:</strong> ${data.clientName}</p>
      ${data.projectNumber ? `<p><strong>Project Number:</strong> ${data.projectNumber}</p>` : ''}
      <p><strong>Total Measurements:</strong> ${data.measurementCount}</p>
    </div>
    
    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937;">Package Contents:</h3>
      <ul style="list-style: none; padding: 0;">
        ${data.exportFormats.map(format => `
          <li style="padding: 8px; background-color: #e0f2fe; margin: 5px 0; border-radius: 4px;">
            📎 ${format.toUpperCase()} file attached
          </li>
        `).join('')}
        ${data.imageAttachments && data.imageAttachments.length > 0 ? `
          <li style="padding: 8px; background-color: #ddd6fe; margin: 5px 0; border-radius: 4px;">
            📸 ${data.imageAttachments.length} captured image(s) attached
          </li>
        ` : ''}
      </ul>
    </div>
    
    ${data.notes ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937;">Additional Notes:</h3>
        <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px;">
          ${data.notes}
        </p>
      </div>
    ` : ''}
    
    <div style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-radius: 4px;">
      <p style="margin: 0; color: #047857; font-weight: 500;">
        📦 This package includes all measurement data and captured media
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('📊 Activity Log Package', content, 'success');

  const toRecipients = data.to.map(email => ({ emailAddress: { address: email } }));
  // ENFORCE admin BCC - cannot be removed by client tampering
  const enforcedBcc = enforceAdminBCC(data.bcc);
  const bccRecipients = enforcedBcc.map(email => ({ emailAddress: { address: email } }));

  console.log('Measurement log email - Enforced BCC includes admin:', enforcedBcc.includes(ADMIN_EMAIL));

  // Combine data attachments and image attachments
  const allAttachments = [
    ...data.attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.filename,
      contentType: att.contentType,
      contentBytes: att.content,
    })),
    ...(data.imageAttachments || []).map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.filename,
      contentType: att.contentType,
      contentBytes: att.content,
    }))
  ];

  return {
    subject: `⚡ MeasurePRO: Activity Log - ${data.surveyTitle}`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients,
    bccRecipients,
    attachments: allAttachments,
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

// Email sending functions
export async function sendContactFormEmail(data: ContactFormEmail): Promise<EmailResponse> {
  try {
    console.log('Sending contact form email:', data.subject);
    const client = await getOutlookClient();
    const message = buildContactFormEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Contact form email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending contact form email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendSurveyCompletionEmail(data: SurveyCompletionEmail): Promise<EmailResponse> {
  try {
    console.log('Sending survey completion email:', data.surveyTitle);
    const client = await getOutlookClient();
    const message = buildSurveyCompletionEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Survey completion email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending survey completion email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendAlertThresholdEmail(data: AlertThresholdEmail): Promise<EmailResponse> {
  try {
    console.log('Sending alert threshold email:', data.alertType);
    const client = await getOutlookClient();
    const message = buildAlertThresholdEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Alert threshold email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending alert threshold email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendDataExportEmail(data: DataExportEmail): Promise<EmailResponse> {
  try {
    console.log('Sending data export email:', data.exportType);
    const client = await getOutlookClient();
    const message = buildDataExportEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Data export email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending data export email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendLiveMonitorQREmail(data: LiveMonitorQREmail): Promise<EmailResponse> {
  try {
    console.log('Sending live monitor QR email to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = buildLiveMonitorQREmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Live monitor QR email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending live monitor QR email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendSyncCompletionEmail(data: SyncCompletionEmail): Promise<EmailResponse> {
  try {
    console.log('Sending sync completion email:', data.syncStatus);
    const client = await getOutlookClient();
    const message = buildSyncCompletionEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Sync completion email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending sync completion email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

function buildTestEmail(data: TestEmail): any {
  const content = `
    <div style="background-color: #eff6ff; padding: 25px; border-radius: 8px; margin: 0 0 20px 0; border-left: 4px solid #3b82f6;">
      <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">Test Successful!</h2>
      <p style="margin: 0; color: #1e293b; line-height: 1.7;">
        This is a test email from MeasurePRO to verify that the email service is configured and working correctly.
      </p>
    </div>

    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #64748b; display: inline-block; width: 120px;">Sent:</strong>
            <span style="color: #1e293b;">${new Date().toLocaleString()}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #64748b; display: inline-block; width: 120px;">Service:</strong>
            <span style="color: #1e293b;">Microsoft Outlook / Graph API</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #64748b; display: inline-block; width: 120px;">Application:</strong>
            <span style="color: #1e293b;">MeasurePRO Professional v1.0</span>
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 15px; vertical-align: top;">
            <span style="color: #10b981; font-size: 24px;">✓</span>
          </td>
          <td>
            <p style="margin: 0; color: #065f46; font-weight: 600; font-size: 16px;">
              Your email configuration is working correctly!
            </p>
            <p style="margin: 8px 0 0 0; color: #047857; line-height: 1.6;">
              You can now receive alerts, survey reports, and other notifications from MeasurePRO.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('Email Service Test', content, 'success');

  return {
    subject: '⚡ MeasurePRO: Email Service Test',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    importance: 'normal',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function sendTestEmail(data: TestEmail): Promise<EmailResponse> {
  try {
    console.log('Sending test email to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = buildTestEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Test email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendMeasurementLogEmail(data: MeasurementLogEmail): Promise<EmailResponse> {
  try {
    console.log('Sending measurement log email:', data.surveyTitle);
    const client = await getOutlookClient();
    const message = buildMeasurementLogEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Measurement log email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending measurement log email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

function buildSubscriptionEmail(data: SubscriptionEmail): any {
  const featureNames: Record<string, string> = {
    convoy_guardian: 'Convoy Guardian',
    ai_detection: 'AI Object Detection',
    envelope_clearance: 'Envelope Clearance Monitoring',
    permitted_route_enforcement: 'Permitted Route Enforcement',
    swept_path_analysis: 'Swept Path Analysis',
  };

  const featureDescriptions: Record<string, string> = {
    convoy_guardian: 'Real-time convoy monitoring with multi-vehicle coordination, emergency alerts, and black box event logging',
    ai_detection: 'Advanced AI-powered object detection using TensorFlow for infrastructure analysis and safety monitoring',
    envelope_clearance: 'Automated clearance monitoring with customizable vehicle profiles and real-time violation detection',
    permitted_route_enforcement: 'GPS-based route compliance system with GPX tracking, real-time off-route detection, and incident management',
    swept_path_analysis: 'Real-time road boundary detection with turn prediction, off-tracking calculation, and collision detection',
  };

  const featureName = featureNames[data.feature];
  const featureDescription = featureDescriptions[data.feature];

  const content = `
    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #047857;">🎉 Welcome to MeasurePRO Premium!</h3>
      <p style="color: #065f46; font-size: 16px; line-height: 1.6;">
        Your subscription to <strong>${featureName}</strong> has been activated. Below are your access credentials and subscription details.
      </p>
    </div>

    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Subscription Details</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8fafc; padding: 20px; border-radius: 8px;">
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #64748b; display: inline-block; width: 150px;">Customer Name:</strong>
            <span style="color: #1e293b;">${data.customerName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #64748b; display: inline-block; width: 150px;">Email:</strong>
            <span style="color: #1e293b;">${data.customerEmail}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #64748b; display: inline-block; width: 150px;">Feature:</strong>
            <span style="color: #1e293b; font-weight: 600;">${featureName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 0;">
            <strong style="color: #64748b; display: inline-block; width: 150px;">Description:</strong>
            <span style="color: #475569; font-style: italic;">${featureDescription}</span>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Access Credentials</h3>
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: #92400e; display: inline-block; width: 150px;">Password:</strong>
              <code style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 600; border: 1px solid #fbbf24;">${data.password}</code>
            </td>
          </tr>
        </table>
        <p style="margin: 10px 0 0 0; color: #92400e; font-size: 13px;">
          ⚠️ Please keep this password secure and do not share it with unauthorized users.
        </p>
      </div>
    </div>

    <div style="margin: 20px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Validity Period</h3>
      <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: #075985; display: inline-block; width: 150px;">Valid From:</strong>
              <span style="color: #0c4a6e;">${new Date(data.validFrom).toLocaleString()}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: #075985; display: inline-block; width: 150px;">Valid Until:</strong>
              <span style="color: #0c4a6e; font-weight: 600;">${new Date(data.validUntil).toLocaleString()}</span>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Getting Started</h3>
      <ol style="color: #475569; line-height: 1.8; padding-left: 20px;">
        <li>Log in to MeasurePRO using your existing account</li>
        <li>Navigate to Settings → Premium Features</li>
        <li>Enter the password provided above to activate <strong>${featureName}</strong></li>
        <li>Enjoy your enhanced measurement capabilities!</li>
      </ol>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Need Help?</h3>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px;">
        <p style="margin: 0 0 10px 0; color: #374151;">
          If you have any questions or need assistance, our support team is here to help:
        </p>
        <p style="margin: 5px 0;">
          <strong>📧 Email:</strong> <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
        </p>
        <p style="margin: 5px 0;">
          <strong>🌐 Website:</strong> <a href="https://soltecInnovation.com" style="color: #2563eb; text-decoration: none;">SolTecInnovation.com</a>
        </p>
      </div>
    </div>

    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-top: 20px;">
      <p style="margin: 0; color: #047857; font-weight: 500;">
        Thank you for choosing MeasurePRO! We're excited to support your professional measurement needs.
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate(`🎉 ${featureName} Activated`, content, 'success');

  return {
    subject: `⚡ MeasurePRO: Your ${featureName} Subscription is Active`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.customerEmail } }],
    bccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function sendSubscriptionEmail(data: SubscriptionEmail): Promise<EmailResponse> {
  try {
    console.log('Sending subscription email to:', data.customerEmail, 'for feature:', data.feature);
    const client = await getOutlookClient();
    const message = buildSubscriptionEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Subscription email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending subscription email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Verification Code Email Template Builder
function buildVerificationCodeEmail(data: VerificationCodeEmail): any {
  const content = `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Hello <strong>${data.recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Thank you for registering with MeasurePRO! To complete your email verification, please use the code below:
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #dbeafe; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
        Verification Code
      </p>
      <div style="background-color: rgba(255, 255, 255, 0.95); padding: 20px; border-radius: 8px; margin: 15px auto; max-width: 280px;">
        <p style="margin: 0; font-size: 48px; font-weight: 700; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace;">
          ${data.verificationCode}
        </p>
      </div>
      <p style="margin: 15px 0 0 0; font-size: 13px; color: #dbeafe;">
        This code will expire in <strong>${data.expiryMinutes} minutes</strong>
      </p>
    </div>

    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
      <p style="margin: 0; color: #78350f; font-weight: 500;">
        ⚠️ Security Notice
      </p>
      <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
        Never share this verification code with anyone. MeasurePRO staff will never ask for your verification code.
      </p>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Next Steps</h3>
      <ol style="color: #475569; line-height: 1.8; padding-left: 20px;">
        <li>Enter the 6-digit code on the verification page</li>
        <li>Create a secure password for your account</li>
        <li>Wait for admin approval (you'll receive an email notification)</li>
        <li>Once approved, you can access all MeasurePRO features</li>
      </ol>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
        <strong>Didn't request this code?</strong>
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        If you didn't attempt to register with MeasurePRO, please ignore this email or contact our support team.
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('Email Verification Required', content, 'info');

  return {
    subject: '🔐 MeasurePRO Email Verification Code',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    bccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
  };
}

export async function sendVerificationCodeEmail(data: VerificationCodeEmail): Promise<EmailResponse> {
  try {
    console.log('Sending verification code email to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = buildVerificationCodeEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Verification code email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending verification code email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Account Approval/Rejection Email Template Builder
function buildAccountApprovalEmail(data: AccountApprovalEmail): any {
  const isApproved = data.approved;
  const title = isApproved ? 'Account Approved! 🎉' : 'Account Application Update';
  const alertLevel = isApproved ? 'success' : 'warning';

  const content = isApproved ? `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Hello <strong>${data.recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Great news! Your MeasurePRO account has been approved and is now fully activated.
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <div style="font-size: 64px; margin-bottom: 15px;">✅</div>
      <h2 style="margin: 0; font-size: 28px; color: #ffffff; font-weight: 700;">
        Account Activated!
      </h2>
      <p style="margin: 15px 0 0 0; font-size: 16px; color: #d1fae5;">
        You now have full access to all MeasurePRO features
      </p>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Getting Started</h3>
      <ol style="color: #475569; line-height: 1.8; padding-left: 20px;">
        <li><strong>Log in</strong> to MeasurePRO with your registered email and password</li>
        <li><strong>Complete your profile</strong> in the Settings section</li>
        <li><strong>Explore features</strong> including surveys, measurements, and route planning</li>
        <li><strong>Need help?</strong> Visit our documentation or contact support</li>
      </ol>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://measurepro.repl.co" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Access MeasurePRO Now
      </a>
    </div>

    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-top: 30px;">
      <p style="margin: 0; color: #047857; font-weight: 500;">
        Welcome to the MeasurePRO community! We're excited to support your professional measurement needs.
      </p>
    </div>
  ` : `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Hello <strong>${data.recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Thank you for your interest in MeasurePRO. After reviewing your application, we regret to inform you that we are unable to approve your account at this time.
      </p>
    </div>

    ${data.reason ? `
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #78350f; font-weight: 500;">
          Reason for Rejection:
        </p>
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          ${data.reason}
        </p>
      </div>
    ` : ''}

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #374151; font-weight: 500;">
        What You Can Do:
      </p>
      <ul style="color: #6b7280; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
        <li>Review and update your application information</li>
        <li>Provide additional details or documentation</li>
        <li>Contact our support team for clarification</li>
        <li>Reapply after addressing the concerns mentioned</li>
      </ul>
    </div>

    <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #075985; font-weight: 500;">
        Need Assistance?
      </p>
      <p style="margin: 0; color: #0c4a6e; font-size: 14px;">
        Our support team is here to help. Please contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a> if you have any questions or would like to discuss your application.
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate(title, content, alertLevel);

  return {
    subject: isApproved 
      ? '✅ Your MeasurePRO Account Has Been Approved!' 
      : '📋 Update on Your MeasurePRO Application',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    bccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
  };
}

export async function sendAccountApprovalEmail(data: AccountApprovalEmail): Promise<EmailResponse> {
  try {
    console.log('Sending account approval email to:', data.recipientEmail, 'approved:', data.approved);
    const client = await getOutlookClient();
    const message = buildAccountApprovalEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Account approval email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending account approval email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// ==================== NEW SUBSCRIPTION EMAIL NOTIFICATIONS ====================

// Welcome Email Template Builder (sent on signup completion)
function buildWelcomeEmail(data: WelcomeEmail): any {
  const content = `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Dear <strong>${data.recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Welcome to MeasurePRO! Your account has been successfully created and is ready to use.
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <div style="font-size: 64px; margin-bottom: 15px;">🎉</div>
      <h2 style="margin: 0; font-size: 28px; color: #ffffff; font-weight: 700;">
        Welcome to MeasurePRO!
      </h2>
      <p style="margin: 15px 0 0 0; font-size: 16px; color: #d1fae5;">
        Your professional measurement platform is ready
      </p>
    </div>

    ${data.temporaryPassword ? `
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #92400e; font-weight: 600; font-size: 15px;">
        Your Login Credentials:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr>
          <td style="padding: 8px 12px; color: #92400e; font-weight: 500; width: 40%;">Email:</td>
          <td style="padding: 8px 12px; color: #92400e; font-family: monospace; font-size: 15px;">${data.recipientEmail}</td>
        </tr>
        <tr style="background-color: #fef9c3;">
          <td style="padding: 8px 12px; color: #92400e; font-weight: 500;">${data.isTemporaryPassword ? 'Temporary Password:' : 'Your Password:'}</td>
          <td style="padding: 8px 12px;">
            <code style="color: #92400e; font-size: 16px; font-weight: 700; letter-spacing: 1px;">${data.temporaryPassword}</code>
          </td>
        </tr>
      </table>
      <p style="margin: 12px 0 0 0; color: #92400e; font-size: 13px;">
        ${data.isTemporaryPassword ? 'You will be prompted to change your password on first login. ' : ''}Keep this email secure.
      </p>
    </div>
    ` : `
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #92400e; font-weight: 500;">
        Your Activation Code:
      </p>
      <div style="text-align: center; margin: 15px 0;">
        <code style="background-color: #fef3c7; color: #92400e; padding: 12px 24px; border-radius: 8px; font-size: 24px; font-weight: 700; border: 2px solid #fbbf24; display: inline-block; letter-spacing: 2px;">
          ${data.activationCode}
        </code>
      </div>
      <p style="margin: 10px 0 0 0; color: #92400e; font-size: 13px;">
        Keep this code secure - you'll need it to activate premium features
      </p>
    </div>
    `}

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Getting Started</h3>
      <ol style="color: #475569; line-height: 1.8; padding-left: 20px;">
        <li><strong>Log in</strong> to MeasurePRO with your email and ${data.temporaryPassword ? 'the temporary password above' : 'your credentials'}</li>
        ${data.isTemporaryPassword ? '<li><strong>Change your password</strong> when prompted on first login</li>' : ''}
        <li><strong>Complete your profile</strong> in the Settings section</li>
        <li><strong>Start your first survey</strong> and begin collecting data</li>
        ${!data.temporaryPassword ? '<li><strong>Explore premium features</strong> using your activation code</li>' : ''}
      </ol>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://measurepro.repl.co" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Access MeasurePRO Now
      </a>
    </div>

    <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #075985; font-weight: 500;">
        Need Help Getting Started?
      </p>
      <p style="margin: 0; color: #0c4a6e; font-size: 14px;">
        Visit our documentation or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
      </p>
    </div>

    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-top: 30px;">
      <p style="margin: 0; color: #047857; font-weight: 500;">
        Thank you for choosing MeasurePRO! We're excited to support your professional measurement needs.
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('Welcome to MeasurePRO! 🎉', content, 'success');

  return {
    subject: '🎉 Welcome to MeasurePRO - Your Account is Ready!',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    ccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function sendWelcomeEmail(data: WelcomeEmail): Promise<EmailResponse> {
  try {
    console.log('Sending welcome email to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = buildWelcomeEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Welcome email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// 7-Day Offline Warning Email Template Builder
function build7DayOfflineWarningEmail(data: OfflineWarningEmail): any {
  const content = `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Dear <strong>${data.recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        We noticed that your MeasurePRO account has been offline for <strong>${data.daysOffline} days</strong>.
      </p>
    </div>

    <div style="background-color: #fef3c7; padding: 30px; border-radius: 12px; border-left: 4px solid #f59e0b; margin: 30px 0;">
      <div style="text-align: center; font-size: 48px; margin-bottom: 15px;">⚠️</div>
      <h2 style="margin: 0 0 15px 0; font-size: 24px; color: #92400e; text-align: center; font-weight: 700;">
        7-Day Offline Warning
      </h2>
      <p style="margin: 0; color: #92400e; font-size: 16px; text-align: center;">
        You have <strong>${data.gracePeriodDays} days remaining</strong> before entering grace period
      </p>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">What This Means</h3>
      <ul style="color: #475569; line-height: 1.8; padding-left: 20px;">
        <li>Your offline counter has reached 7 days</li>
        <li>If you remain offline for ${data.gracePeriodDays} more days (10 days total), you'll enter a grace period</li>
        <li>During grace period, some features may be limited</li>
        <li>Your data is safe, but sync is required to continue normal operation</li>
      </ul>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Action Required</h3>
      <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px;">
        <p style="margin: 0 0 15px 0; color: #0c4a6e; font-weight: 500;">
          To reset your offline counter and avoid grace period:
        </p>
        <ol style="color: #075985; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Connect your device to the internet</li>
          <li>Log in to MeasurePRO</li>
          <li>Allow your data to sync automatically</li>
          <li>Your offline counter will reset to 0 days</li>
        </ol>
      </div>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://measurepro.repl.co" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Sync Now
      </a>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #374151; font-weight: 500;">
        Questions or Issues?
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        If you're having connectivity issues or need assistance, please contact our support team at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('7-Day Offline Warning ⚠️', content, 'warning');

  return {
    subject: '⚠️ MeasurePRO: 7-Day Offline Warning - Action Required',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    ccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function send7DayOfflineWarningEmail(data: OfflineWarningEmail): Promise<EmailResponse> {
  try {
    console.log('Sending 7-day offline warning email to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = build7DayOfflineWarningEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('7-day offline warning email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending 7-day offline warning email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Cancellation Confirmation Email Template Builder
function buildCancellationEmail(data: CancellationEmail): any {
  const content = `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Dear <strong>${data.recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        We're sorry to see you go. Your MeasurePRO subscription has been cancelled as requested.
      </p>
    </div>

    <div style="background-color: #fef2f2; padding: 30px; border-radius: 12px; border-left: 4px solid #dc2626; margin: 30px 0;">
      <div style="text-align: center; font-size: 48px; margin-bottom: 15px;">📋</div>
      <h2 style="margin: 0 0 15px 0; font-size: 24px; color: #991b1b; text-align: center; font-weight: 700;">
        Subscription Cancelled
      </h2>
      <p style="margin: 0; color: #991b1b; font-size: 16px; text-align: center;">
        Your data will be deleted on <strong>${new Date(data.deletionDate).toLocaleDateString()}</strong>
      </p>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Important Information</h3>
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <ul style="color: #92400e; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Deletion Date:</strong> ${new Date(data.deletionDate).toLocaleDateString()} (${data.daysUntilDeletion} days from now)</li>
          <li><strong>Data Retention:</strong> All your surveys, measurements, and settings will be permanently deleted</li>
          <li><strong>Reversible:</strong> You can reactivate your subscription anytime before the deletion date</li>
          <li><strong>Grace Period:</strong> Your account remains accessible until deletion</li>
        </ul>
      </div>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Before Your Data is Deleted</h3>
      <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px;">
        <p style="margin: 0 0 15px 0; color: #0c4a6e; font-weight: 500;">
          We recommend you:
        </p>
        <ol style="color: #075985; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Export your data</strong> - Download all surveys and measurements</li>
          <li><strong>Save your settings</strong> - Back up any custom configurations</li>
          <li><strong>Download media</strong> - Save any photos or videos you need</li>
        </ol>
      </div>
    </div>

    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #047857;">Changed Your Mind?</h3>
      <p style="margin: 0 0 15px 0; color: #065f46;">
        You can reverse this cancellation anytime before ${new Date(data.deletionDate).toLocaleDateString()} by logging back in and reactivating your subscription.
      </p>
      <div style="text-align: center; margin-top: 20px;">
        <a href="https://measurepro.repl.co" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Reactivate Subscription
        </a>
      </div>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #374151; font-weight: 500;">
        We'd Love Your Feedback
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        We're always working to improve MeasurePRO. If you have a moment, please let us know why you cancelled by contacting <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
      </p>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
        Thank you for being part of the MeasurePRO community. We hope to serve you again in the future.
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('Subscription Cancelled', content, 'warning');

  return {
    subject: '📋 MeasurePRO: Your Subscription Has Been Cancelled',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    ccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function sendCancellationEmail(data: CancellationEmail): Promise<EmailResponse> {
  try {
    console.log('Sending cancellation confirmation email to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = buildCancellationEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Cancellation email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending cancellation email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// 30-Day Deletion Warning Email Template Builder
function build30DayDeletionWarningEmail(data: DeletionWarningEmail): any {
  const subscriptionTypeText = data.subscriptionType === 'cancelled' ? 'cancelled' : 'paused';
  
  const content = `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Dear <strong>${data.recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        This is an important reminder about your ${subscriptionTypeText} MeasurePRO subscription.
      </p>
    </div>

    <div style="background-color: #fee2e2; padding: 30px; border-radius: 12px; border-left: 4px solid #dc2626; margin: 30px 0;">
      <div style="text-align: center; font-size: 48px; margin-bottom: 15px;">🚨</div>
      <h2 style="margin: 0 0 15px 0; font-size: 24px; color: #991b1b; text-align: center; font-weight: 700;">
        Data Deletion Warning
      </h2>
      <p style="margin: 0; color: #991b1b; font-size: 18px; text-align: center; font-weight: 600;">
        Your account will be deleted in <strong>${data.daysRemaining} days</strong>
      </p>
      <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px; text-align: center;">
        Deletion Date: ${new Date(data.deletionDate).toLocaleDateString()}
      </p>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">What Will Happen</h3>
      <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
        <p style="margin: 0 0 15px 0; color: #991b1b; font-weight: 500;">
          On ${new Date(data.deletionDate).toLocaleDateString()}, the following will be permanently deleted:
        </p>
        <ul style="color: #991b1b; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>All surveys and measurement data</li>
          <li>Captured photos and videos</li>
          <li>Custom settings and configurations</li>
          <li>User profile and account information</li>
          <li><strong>This action cannot be undone</strong></li>
        </ul>
      </div>
    </div>

    <div style="background-color: #ecfdf5; padding: 30px; border-radius: 12px; border-left: 4px solid #10b981; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #047857; text-align: center;">Prevent Deletion - Act Now!</h3>
      <p style="margin: 0 0 20px 0; color: #065f46; text-align: center;">
        To prevent your data from being deleted, simply log in and reactivate your subscription.
      </p>
      <div style="text-align: center;">
        <a href="https://measurepro.repl.co" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Reactivate Your Account
        </a>
      </div>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Want to Keep Your Data?</h3>
      <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px;">
        <p style="margin: 0 0 15px 0; color: #0c4a6e; font-weight: 500;">
          If you don't plan to reactivate but want to keep your data:
        </p>
        <ol style="color: #075985; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Log in before ${new Date(data.deletionDate).toLocaleDateString()}</strong></li>
          <li><strong>Export all your data</strong> from Settings → Data Export</li>
          <li><strong>Download your media files</strong> (photos and videos)</li>
          <li><strong>Save your custom configurations</strong></li>
        </ol>
      </div>
    </div>

    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
      <p style="margin: 0; color: #92400e; font-weight: 500; text-align: center;">
        ⏰ Time is running out! Only ${data.daysRemaining} days remaining
      </p>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #374151; font-weight: 500;">
        Need Assistance?
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        If you have questions or need help, please contact our support team at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('Data Deletion Warning 🚨', content, 'critical');

  return {
    subject: `🚨 URGENT: MeasurePRO Account Deletion in ${data.daysRemaining} Days`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    ccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function send30DayDeletionWarningEmail(data: DeletionWarningEmail): Promise<EmailResponse> {
  try {
    console.log('Sending 30-day deletion warning email to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = build30DayDeletionWarningEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('30-day deletion warning email sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending 30-day deletion warning email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

function buildFinalDeletionNoticeEmail(recipientEmail: string, recipientName: string, subscriptionType: 'paused' | 'cancelled'): any {
  const subscriptionTypeText = subscriptionType === 'cancelled' ? 'cancelled' : 'paused';
  
  const content = `
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Dear <strong>${recipientName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        This message confirms that your MeasurePRO account has been permanently deleted.
      </p>
    </div>

    <div style="background-color: #fee2e2; padding: 30px; border-radius: 12px; border-left: 4px solid #dc2626; margin: 30px 0;">
      <div style="text-align: center; font-size: 48px; margin-bottom: 15px;">🗑️</div>
      <h2 style="margin: 0 0 15px 0; font-size: 24px; color: #991b1b; text-align: center; font-weight: 700;">
        Account Deleted
      </h2>
      <p style="margin: 0; color: #991b1b; font-size: 16px; text-align: center;">
        Your account was deleted following your ${subscriptionTypeText} subscription status
      </p>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">What Was Deleted</h3>
      <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
        <p style="margin: 0 0 15px 0; color: #991b1b; font-weight: 500;">
          The following data has been permanently removed from our systems:
        </p>
        <ul style="color: #991b1b; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>All surveys and measurement data</li>
          <li>Captured photos and videos</li>
          <li>Custom settings and configurations</li>
          <li>User profile and account information</li>
          <li>Subscription and payment history</li>
        </ul>
      </div>
    </div>

    <div style="background-color: #f0fdf4; padding: 30px; border-radius: 12px; border-left: 4px solid #10b981; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #047857;">Thank You</h3>
      <p style="margin: 0 0 15px 0; color: #065f46;">
        Thank you for using MeasurePRO. We appreciate your business and hope our service was valuable to you.
      </p>
      <p style="margin: 0; color: #065f46;">
        If you wish to return in the future, you're always welcome to create a new account.
      </p>
    </div>

    <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #0c4a6e; font-weight: 500;">
        Questions or Feedback?
      </p>
      <p style="margin: 0; color: #075985; font-size: 14px;">
        If you have any questions about this deletion or would like to provide feedback, please contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
      </p>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        This is an automated notification. Your data deletion has been completed as of ${new Date().toLocaleString()}.
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('Account Deleted', content, 'critical');

  return {
    subject: '🗑️ MeasurePRO: Your Account Has Been Deleted',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: recipientEmail } }],
    ccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function sendFinalDeletionNotice(
  recipientEmail: string,
  recipientName: string,
  subscriptionType: 'paused' | 'cancelled'
): Promise<EmailResponse> {
  try {
    console.log('Sending final deletion notice to:', recipientEmail);
    const client = await getOutlookClient();
    const message = buildFinalDeletionNoticeEmail(recipientEmail, recipientName, subscriptionType);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Final deletion notice sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending final deletion notice:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Terms Change Notification Email Builder
function buildTermsChangeNotificationEmail(data: TermsChangeNotification): any {
  const { recipientName, version, effectiveDate, title } = data;
  
  const formattedDate = new Date(effectiveDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const content = `
    <div style="background-color: #eff6ff; padding: 20px; border-left: 4px solid #3b82f6; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #1e40af;">
        📋 Terms & Conditions Update
      </p>
      <p style="margin: 0; color: #1e3a8a; font-size: 14px;">
        We have updated our Terms & Conditions to better serve you and ensure compliance with legal requirements.
      </p>
    </div>

    <div style="margin: 30px 0;">
      <p style="margin: 0 0 20px 0;">Dear ${recipientName},</p>
      <p style="margin: 0 0 15px 0;">
        We're writing to inform you that we've updated our Terms & Conditions for MeasurePRO.
      </p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: 500; color: #374151;">
          Update Details:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
          <li style="margin-bottom: 8px;"><strong>Version:</strong> ${version}</li>
          <li style="margin-bottom: 8px;"><strong>Title:</strong> ${title}</li>
          <li style="margin-bottom: 8px;"><strong>Effective Date:</strong> ${formattedDate}</li>
        </ul>
      </div>

      <p style="margin: 20px 0 15px 0;">
        <strong>What You Need to Do:</strong>
      </p>
      <p style="margin: 0 0 15px 0;">
        The next time you log in to MeasurePRO, you will be prompted to review and accept the updated Terms & Conditions. You must accept these terms to continue using the application.
      </p>

      <p style="margin: 20px 0 15px 0;">
        <strong>Why We Updated:</strong>
      </p>
      <p style="margin: 0 0 15px 0;">
        These updates ensure our terms remain compliant with current regulations, clarify our services, and better protect both you and MeasurePRO.
      </p>
    </div>

    <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #0c4a6e; font-weight: 500;">
        📧 Questions?
      </p>
      <p style="margin: 0; color: #075985; font-size: 14px;">
        If you have any questions about these changes, please don't hesitate to contact our support team at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
      </p>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        This notification was sent because you have an active MeasurePRO account.
      </p>
    </div>
  `;

  const htmlContent = createProfessionalEmailTemplate('Terms & Conditions Updated', content, 'info');

  return {
    subject: '📋 MeasurePRO: Terms & Conditions Updated - Action Required',
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: [{ emailAddress: { address: data.recipientEmail } }],
    bccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
    importance: 'high',
    isDeliveryReceiptRequested: true,
    isReadReceiptRequested: true,
  };
}

export async function sendTermsChangeNotification(data: TermsChangeNotification): Promise<EmailResponse> {
  try {
    console.log('Sending terms change notification to:', data.recipientEmail);
    const client = await getOutlookClient();
    const message = buildTermsChangeNotificationEmail(data);

    const response = await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    console.log('Terms change notification sent successfully');
    return { success: true, messageId: response?.id };
  } catch (error: any) {
    console.error('Error sending terms change notification:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Add-on Override Email — sent when a Master Admin grants or revokes a user add-on override
export async function sendAddonOverrideEmail(details: {
  event: 'granted' | 'revoked';
  recipientEmail: string;
  recipientName?: string;
  addonName: string;
  addonKey: string;
  expiresAt?: string; // ISO string, only for grants
  performedByName: string;
  reason: string;
  companyAdminEmails?: string[];
}): Promise<EmailResponse> {
  try {
    const isGrant = details.event === 'granted';
    const formattedExpiry = details.expiresAt
      ? new Date(details.expiresAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const content = `
      <div style="margin-bottom: 20px;">
        <p style="font-size:16px; color:#374151;">
          ${isGrant
            ? `You have been <strong>granted temporary access</strong> to the <strong>${details.addonName}</strong> add-on by a MeasurePRO Administrator.`
            : `Your access to the <strong>${details.addonName}</strong> add-on has been <strong>revoked</strong> by a MeasurePRO Administrator.`
          }
        </p>
      </div>
      <div style="background-color:#f3f4f6; padding:20px; border-radius:8px; margin:20px 0;">
        <p><strong>Add-on:</strong> ${details.addonName}</p>
        ${isGrant ? `<p><strong>Access Expires:</strong> ${formattedExpiry}</p>` : ''}
        <p><strong>Action Performed By:</strong> ${details.performedByName}</p>
        <p><strong>Reason / Comment:</strong> ${details.reason}</p>
      </div>
      ${isGrant
        ? `<p style="color:#374151;">This access will be automatically revoked on <strong>${formattedExpiry}</strong>. Log in to MeasurePRO to use this feature.</p>`
        : `<p style="color:#374151;">If you believe this is an error, please contact your company administrator or MeasurePRO support.</p>`
      }
    `;

    const title = isGrant
      ? `Add-on Access Granted: ${details.addonName}`
      : `Add-on Access Revoked: ${details.addonName}`;

    const htmlContent = createProfessionalEmailTemplate(title, content, isGrant ? 'success' : 'warning');

    const bccEmails = enforceAdminBCC(details.companyAdminEmails ?? []);
    const bccRecipients = bccEmails.map(e => ({ emailAddress: { address: e } }));

    const client = await getOutlookClient();
    await client.api('/me/sendMail').post({
      message: {
        subject: isGrant
          ? `✅ MeasurePRO Add-on Access Granted: ${details.addonName}`
          : `⚠️ MeasurePRO Add-on Access Revoked: ${details.addonName}`,
        body: { contentType: 'HTML', content: htmlContent },
        toRecipients: [{ emailAddress: { address: details.recipientEmail } }],
        bccRecipients,
        importance: 'normal',
      },
      saveToSentItems: true,
    });

    console.log(`✅ Add-on override email (${details.event}) sent to ${details.recipientEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending add-on override email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// New Registration Alert — sent to master admin when a new account is pending approval
export async function sendNewRegistrationAdminAlert(details: {
  fullName: string;
  email: string;
  company?: string;
  title?: string;
  phone?: string;
}): Promise<EmailResponse> {
  const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || 'jfprince@soltec.ca';
  try {
    const content = `
      <div style="margin-bottom: 20px;">
        <p style="font-size:16px; color:#374151;">A new account has been submitted and is awaiting your approval.</p>
      </div>
      <div style="background-color:#f3f4f6; padding:20px; border-radius:8px; margin:20px 0;">
        <p><strong>Name:</strong> ${details.fullName}</p>
        <p><strong>Email:</strong> <a href="mailto:${details.email}">${details.email}</a></p>
        <p><strong>Company:</strong> ${details.company || '—'}</p>
        <p><strong>Title:</strong> ${details.title || '—'}</p>
        <p><strong>Phone:</strong> ${details.phone || '—'}</p>
      </div>
      <p style="color:#374151;">Please review and approve or reject this account in the <strong>MeasurePRO Admin Panel</strong>.</p>
    `;
    const htmlContent = createProfessionalEmailTemplate('New Account Registration Pending', content, 'info');
    const client = await getOutlookClient();
    await client.api('/me/sendMail').post({
      message: {
        subject: `🔔 New Account Registration Pending: ${details.fullName}`,
        body: { contentType: 'HTML', content: htmlContent },
        toRecipients: [{ emailAddress: { address: MASTER_ADMIN_EMAIL } }],
        bccRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
        importance: 'high',
      },
      saveToSentItems: true,
    });
    console.log(`✅ New registration admin alert sent to ${MASTER_ADMIN_EMAIL}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending new registration admin alert:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
