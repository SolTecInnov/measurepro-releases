import { toast } from 'sonner';
import QRCode from 'qrcode';

// Email requires a real HTTP backend. In Electron, /api resolves to file:///C:/api/ which fails.
// Use the configured VITE_API_URL or the production API endpoint.
const API_BASE_URL = (() => {
  const viteUrl = import.meta.env.VITE_API_URL;
  if (viteUrl && viteUrl.startsWith('http')) return `${viteUrl}/api`;
  // Electron: can't use relative /api — needs a real server
  if ((window as any).electronAPI?.isElectron) return 'https://measure-pro.app/api';
  return '/api';
})();

// Check if email server is available before attempting sends
async function isEmailServerAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE_URL}/health`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

// Helper to convert file/blob to base64
export async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result?.toString().split(',')[1];
      resolve(base64 || '');
    };
    reader.onerror = (error) => reject(error);
  });
}

// Send survey completion email with download link (for large packages)
// NOTE: Full packages are typically 100MB-500MB, too large for email attachments
// Instead, we upload to Firebase Storage and send a download link
export async function sendSurveyCompletionEmail(
  surveyData: {
    to: string[];
    bcc: string[];
    surveyTitle: string;
    surveyorName: string;
    clientName: string;
    projectNumber?: string;
    measurementCount: number;
    notes?: string;
    downloadUrl?: string;  // Firebase Storage download link
    packageSize?: string;  // Human-readable size (e.g., "45.2 MB")
  }
) {
  try {
    const payload = {
      ...surveyData,
      completionDate: new Date().toISOString(),
      hasDownloadLink: !!surveyData.downloadUrl,
    };

    const response = await fetch(`${API_BASE_URL}/email/survey-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const result = contentType?.includes('application/json') 
      ? await response.json() 
      : { success: true };

    if (result.success) {
      console.log('[Email] Survey completion email sent successfully');
      return true;
    } else {
      toast.error('Failed to email survey report', {
        description: result.error || 'Please try again',
      });
      return false;
    }
  } catch (error: any) {
    toast.error('Failed to email survey report', {
      description: error.message || 'Please check your connection',
    });
    return false;
  }
}

// Send alert threshold email with BCC admin
export async function sendAlertThresholdEmail(
  alertData: {
    to: string[];
    bcc: string[];
    alertType: 'WARNING' | 'CRITICAL';
    measurementValue: number;
    thresholdValue: number;
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    surveyTitle?: string;
    surveyorName?: string;
    clientName?: string;
    projectNumber?: string;
    poiNumber?: number;
    roadNumber?: number;
    notes?: string;
    attachments?: {
      filename: string;
      content: string;
      contentType: string;
    }[];
  }
) {
  try {
    const payload = {
      ...alertData,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/email/alert-threshold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const result = contentType?.includes('application/json') 
      ? await response.json() 
      : { success: true };

    if (result.success) {
      const recipientList = alertData.to.length > 0 ? alertData.to.join(', ') : 'recipients';
      /* toast removed */
      return true;
    } else {
      toast.error('Failed to email alert', {
        description: result.error || 'Please try again',
      });
      return false;
    }
  } catch (error: any) {
    toast.error('Failed to email alert', {
      description: error.message || 'Please check your connection',
    });
    return false;
  }
}

// Send data export email
export async function sendDataExportEmail(
  recipientEmail: string,
  exportData: {
    exportType: 'csv' | 'json' | 'geojson' | 'media';
    measurementCount: number;
    dateRange: {
      from: string;
      to: string;
    };
    filters?: {
      surveyId?: string;
      userId?: string;
      poiType?: string;
    };
    fileContent: string;
    fileName: string;
    additionalNotes?: string;
  }
) {
  try {
    const contentType = exportData.exportType === 'csv' 
      ? 'text/csv' 
      : 'application/json';

    const fileBlob = new Blob([exportData.fileContent], { type: contentType });
    const base64Content = await fileToBase64(fileBlob);

    const payload = {
      recipientEmail,
      exportType: exportData.exportType,
      measurementCount: exportData.measurementCount,
      dateRange: exportData.dateRange,
      filters: exportData.filters,
      attachment: {
        filename: exportData.fileName,
        content: base64Content,
        contentType,
      },
      additionalNotes: exportData.additionalNotes,
    };

    const response = await fetch(`${API_BASE_URL}/email/data-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const responseContentType = response.headers.get('content-type');
    const result = responseContentType?.includes('application/json') 
      ? await response.json() 
      : { success: true };

    if (result.success) {
      /* toast removed */
      return true;
    } else {
      toast.error('Failed to email data export', {
        description: result.error || 'Please try again',
      });
      return false;
    }
  } catch (error: any) {
    toast.error('Failed to email data export', {
      description: error.message || 'Please check your connection',
    });
    return false;
  }
}

// Generate QR code and send live monitor email
export async function sendLiveMonitorQREmail(
  recipientEmail: string,
  monitorData: {
    monitorUrl: string;
    senderName: string;
    expiryDate?: string;
    accessInstructions?: string;
  }
) {
  try {
    // Generate QR code
    const qrCodeBase64 = await QRCode.toDataURL(monitorData.monitorUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Remove data URL prefix to get just base64
    const base64Only = qrCodeBase64.split(',')[1];

    const payload = {
      recipientEmail,
      ...monitorData,
      qrCodeBase64: base64Only,
    };

    const response = await fetch(`${API_BASE_URL}/email/live-monitor-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const result = contentType?.includes('application/json') 
      ? await response.json() 
      : { success: true };

    if (result.success) {
      /* toast removed */
      return true;
    } else {
      toast.error('Failed to email live monitor access', {
        description: result.error || 'Please try again',
      });
      return false;
    }
  } catch (error: any) {
    toast.error('Failed to email live monitor access', {
      description: error.message || 'Please check your connection',
    });
    return false;
  }
}

// Send sync completion email
export async function sendSyncCompletionEmail(
  recipientEmail: string,
  syncData: {
    syncStatus: 'success' | 'partial' | 'failed';
    totalItems: number;
    syncedItems: number;
    failedItems: number;
    syncDuration: string;
    errors?: Array<{
      item: string;
      error: string;
    }>;
    summary: string;
  }
) {
  try {
    const payload = {
      recipientEmail,
      ...syncData,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/email/sync-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const result = contentType?.includes('application/json') 
      ? await response.json() 
      : { success: true };

    if (result.success) {
      /* toast removed */
      return true;
    } else {
      toast.error('Failed to email sync report', {
        description: result.error || 'Please try again',
      });
      return false;
    }
  } catch (error: any) {
    toast.error('Failed to email sync report', {
      description: error.message || 'Please check your connection',
    });
    return false;
  }
}

// Send measurement log email with all data and images
export async function sendMeasurementLogEmail(
  surveyData: {
    to: string[];
    bcc: string[];
    surveyTitle: string;
    surveyorName: string;
    clientName: string;
    projectNumber?: string;
    measurementCount: number;
    notes?: string;
  },
  exportData: {
    csv?: string;
    json?: string;
    geojson?: string;
  },
  images: Array<{ url: string; filename: string }> = []
) {
  // In Electron, check server availability first to avoid confusing error toasts
  if ((window as any).electronAPI?.isElectron) {
    const available = await isEmailServerAvailable();
    if (!available) {
      console.warn('[Email] Server not reachable — skipping email send');
      return false;
    }
  }
  try {
    const attachments = [];

    // Add CSV attachment if available
    if (exportData.csv) {
      const csvBlob = new Blob([exportData.csv], { type: 'text/csv' });
      const csvBase64 = await fileToBase64(csvBlob);
      attachments.push({
        filename: `${surveyData.surveyTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`,
        content: csvBase64,
        contentType: 'text/csv',
      });
    }

    // Add JSON attachment if available
    if (exportData.json) {
      const jsonBlob = new Blob([exportData.json], { type: 'application/json' });
      const jsonBase64 = await fileToBase64(jsonBlob);
      attachments.push({
        filename: `${surveyData.surveyTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`,
        content: jsonBase64,
        contentType: 'application/json',
      });
    }

    // Add GeoJSON attachment if available
    if (exportData.geojson) {
      const geojsonBlob = new Blob([exportData.geojson], { type: 'application/json' });
      const geojsonBase64 = await fileToBase64(geojsonBlob);
      attachments.push({
        filename: `${surveyData.surveyTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.geojson`,
        content: geojsonBase64,
        contentType: 'application/json',
      });
    }

    // Add all captured images as attachments
    const imageAttachments = [];
    for (const img of images) {
      try {
        if (img.url.startsWith('data:')) {
          // Extract base64 from data URL
          const base64 = img.url.split(',')[1];
          if (base64) {
            imageAttachments.push({
              filename: img.filename,
              content: base64,
              contentType: 'image/jpeg',
            });
          }
        } else {
          // Fetch image and convert to base64
          const response = await fetch(img.url);
          const blob = await response.blob();
          const base64 = await fileToBase64(blob);
          imageAttachments.push({
            filename: img.filename,
            content: base64,
            contentType: blob.type || 'image/jpeg',
          });
        }
      } catch (error) {
        // Silent fail
      }
    }

    const payload = {
      ...surveyData,
      exportFormats: Object.keys(exportData) as ('csv' | 'json' | 'geojson')[],
      attachments,
      imageAttachments,
    };

    const response = await fetch(`${API_BASE_URL}/email/measurement-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const result = contentType?.includes('application/json') 
      ? await response.json() 
      : { success: true };

    if (result.success) {
      const recipientList = surveyData.to.length > 0 ? surveyData.to.join(', ') : 'recipients';
      const totalAttachments = attachments.length + imageAttachments.length;
      /* toast removed */
      return true;
    } else {
      toast.error('Failed to email measurement log', {
        description: result.error || 'Please try again',
      });
      return false;
    }
  } catch (error: any) {
    toast.error('Failed to email measurement log', {
      description: error.message || 'Please check your connection',
    });
    return false;
  }
}
