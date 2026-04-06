/**
 * SMS Verification Service
 *
 * Sends 6-digit verification codes via SMS using the Twilio REST API.
 * When Twilio credentials are not configured, falls back to dev mode:
 * the code is logged to the server console so developers can test
 * the full verification flow without a real SIM card.
 *
 * Required environment variables (add via Replit Secrets):
 *   TWILIO_ACCOUNT_SID  — e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN   — 32-char token from Twilio Console
 *   TWILIO_FROM_NUMBER  — Twilio phone number e.g. +15551234567
 */

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
  devMode?: boolean;
}

function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

/**
 * Normalize a phone number to E.164 format for Twilio.
 * Strips spaces, dashes, parentheses. Adds +1 prefix if no country code.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (raw.trim().startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Send a 6-digit verification code via SMS.
 * Returns { success: true } when delivered (or in dev mode).
 */
export async function sendSmsVerification(
  to: string,
  code: string,
  context = 'MeasurePRO account verification'
): Promise<SmsResult> {
  const normalizedTo = normalizePhone(to);
  const body = `Your ${context} code is: ${code}. Valid for 10 minutes. Do not share this code.`;

  if (!isTwilioConfigured()) {
    console.warn(
      `[SMS DEV MODE] Twilio not configured. SMS to ${normalizedTo}: "${body}"`
    );
    return { success: true, devMode: true };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_FROM_NUMBER!;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams({
    To: normalizedTo,
    From: fromNumber,
    Body: body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      const msg = err.message || `Twilio HTTP ${response.status}`;
      console.error('[SMS] Twilio error:', msg);
      return { success: false, error: msg };
    }

    const data = await response.json() as any;
    console.log(`[SMS] Sent to ${normalizedTo}, SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error('[SMS] Network error:', err.message);
    return { success: false, error: 'Failed to send SMS. Please check the phone number and try again.' };
  }
}
