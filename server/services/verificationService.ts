/**
 * Shared email verification service used by both the RegisterPage flow
 * (/api/registration/start + /api/registration/verify) and the SignupPage
 * 6-step wizard (/api/signup/send-verification + /api/signup/verify-code).
 *
 * Having one service ensures both flows generate, hash, and verify codes the
 * same way, preventing subtle security divergence between paths.
 */
import bcrypt from 'bcryptjs';

export const VERIFICATION_CODE_EXPIRY_MINUTES = 15;
const SALT_ROUNDS = 10;

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function hashVerificationCode(code: string): Promise<string> {
  return await bcrypt.hash(code, SALT_ROUNDS);
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(code, hash);
}

/**
 * In-memory rate limiter (5 attempts / 60 s per key).
 *
 * ⚠️ PRODUCTION WARNING: resets on server restart and does not work across
 * multiple instances. For production, migrate to Redis or a DB-backed counter.
 */
const verificationAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const attempts = verificationAttempts.get(key);

  if (!attempts || attempts.resetAt < now) {
    verificationAttempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (attempts.count >= 5) return false;

  attempts.count++;
  return true;
}
