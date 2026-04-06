/**
 * Trial Notifications
 * Sends email alerts to user + admin when trial is expiring or expired.
 * Called once per session — uses localStorage to avoid duplicate sends.
 */

const ADMIN_EMAIL = 'support@soltecinnovation.com';
const NOTIF_KEY = (email: string, type: string) =>
  `trial_notif_sent_${type}_${email.toLowerCase()}`;

async function sendEmail(to: string, subject: string, message: string): Promise<void> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    await fetch(`${apiUrl}/api/email/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MeasurePRO System',
        email: to,
        subject,
        message,
      }),
    });
  } catch (e) {
    console.warn('[TrialNotif] Email send failed:', e);
  }
}

/**
 * Check trial status and send notifications if needed.
 * Safe to call on every login — deduplicates via localStorage.
 */
export async function checkAndSendTrialNotifications(
  userEmail: string,
  daysRemaining: number,
  isExpired: boolean,
  isInGracePeriod: boolean,
): Promise<void> {
  if (!userEmail || !navigator.onLine) return;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // --- Expiry warning (2 days before) ---
  if (!isExpired && !isInGracePeriod && daysRemaining <= 2) {
    const key = NOTIF_KEY(userEmail, `warning_${today}`);
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');

      // Email to user
      await sendEmail(
        userEmail,
        `⚠️ MeasurePRO trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
        `Hi,\n\nYour MeasurePRO 7-day free trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.\n\nTo continue using MeasurePRO without interruption, please contact us to activate a paid licence:\n\n📧 support@soltecinnovation.com\n\nAvailable plans:\n• Monthly — flexible month-to-month\n• Annual — best value, save 20%\n• Custom — enterprise or project-based\n\nThank you for trying MeasurePRO!\n\n— SolTec Innovation Team`,
      );

      // Email to admin
      await sendEmail(
        ADMIN_EMAIL,
        `[MeasurePRO] Trial expiring soon — ${userEmail}`,
        `User ${userEmail} has ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining on their trial.\n\nConsider reaching out proactively to convert them to a paid licence.\n\nAdmin panel: https://soltecinnovation.com → Login → Admin → License Admin → Create Licence`,
      );
    }
  }

  // --- Trial expired ---
  if (isExpired) {
    const key = NOTIF_KEY(userEmail, `expired_${today}`);
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');

      // Email to user
      await sendEmail(
        userEmail,
        '🔒 Your MeasurePRO trial has expired',
        `Hi,\n\nYour MeasurePRO 7-day free trial has expired.\n\nTo reactivate your access, please contact us:\n\n📧 support@soltecinnovation.com\n📞 Or visit https://soltecinnovation.com\n\nAvailable plans:\n• Monthly — flexible month-to-month\n• Annual — best value, save 20%\n• Custom — enterprise or project-based\n\nWe hope you enjoyed your trial and look forward to hearing from you!\n\n— SolTec Innovation Team`,
      );

      // Email to admin
      await sendEmail(
        ADMIN_EMAIL,
        `[MeasurePRO] Trial EXPIRED — ${userEmail} needs a licence`,
        `TRIAL EXPIRED\n\nUser: ${userEmail}\nExpired: today\n\nAction required: Create a licence for this user if they have paid, or follow up.\n\nAdmin panel → License Admin → Create Licence → enter ${userEmail}`,
      );
    }
  }

  // --- Grace period started ---
  if (isInGracePeriod) {
    const key = NOTIF_KEY(userEmail, `grace_${today}`);
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');

      await sendEmail(
        ADMIN_EMAIL,
        `[MeasurePRO] User in grace period — ${userEmail}`,
        `User ${userEmail} is in their grace period.\nApp access will be blocked soon.\n\nCreate their licence now: Admin panel → License Admin → Create Licence`,
      );
    }
  }
}
