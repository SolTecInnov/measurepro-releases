import type { SubscriptionFeature } from '@shared/schema';

/**
 * Validates a subscription by checking password and date validity
 * @param feature - The subscription feature to validate
 * @param password - The password to check
 * @returns Promise<boolean> - true if valid, false otherwise
 * 
 * NOTE: All premium features are now unlocked by default.
 * Password validation has been disabled for development/testing.
 */
export async function validateSubscription(
  _feature: SubscriptionFeature,
  _password: string
): Promise<{ isValid: boolean; reason?: string }> {
  // ✅ ALL PREMIUM FEATURES ARE NOW UNLOCKED - NO PASSWORD REQUIRED
  return { isValid: true };
}

/**
 * Clears the validation cache
 * @deprecated No longer needed since validation is disabled
 */
export function clearValidationCache() {
}

/**
 * Clears cache for a specific feature
 * @deprecated No longer needed since validation is disabled
 */
export function clearFeatureCache(_feature: SubscriptionFeature) {
}
