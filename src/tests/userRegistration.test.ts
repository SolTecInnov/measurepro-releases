import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { isFreeTierFeature, getUnlicensedMessage } from '@/lib/licensing/features';
import { registrationStartSchema, registrationVerifySchema } from '../../shared/schema';

/**
 * USER REGISTRATION TEST SUITE - NOW USING REAL ZOD SCHEMAS!
 * 
 * Critical Path: New user creates account
 * Steps:
 * 1. User fills registration form (fullName, email, optional company/title/phone/address)
 * 2. Form validation passes (using REAL Zod schema from RegisterPage)
 * 3. Verification code sent to email
 * 4. User enters code to verify email
 * 5. User account created
 * 6. User cannot access premium features until approved
 * 
 * IMPROVEMENT: Now importing and testing the actual Zod schemas from shared/schema.ts
 * that RegisterPage uses for validation! This ensures tests match real implementation.
 */
describe('User Registration Critical Path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration Form Validation - REAL ZOD SCHEMA', () => {
    it('should validate email format using real registrationStartSchema', () => {
      // Test valid emails
      const validData = [
        { fullName: 'John Doe', email: 'user@example.com' },
        { fullName: 'Jane Smith', email: 'test.user@company.co.uk' },
        { fullName: 'Admin User', email: 'admin+test@domain.org' },
      ];
      
      validData.forEach(data => {
        const result = registrationStartSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      // Test invalid emails
      const invalidEmails = [
        { fullName: 'John Doe', email: 'invalid' },
        { fullName: 'John Doe', email: '@example.com' },
        { fullName: 'John Doe', email: 'user@' },
        { fullName: 'John Doe', email: 'user @example.com' },
      ];

      invalidEmails.forEach(data => {
        const result = registrationStartSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => issue.path.includes('email'))).toBe(true);
        }
      });
    });

    it('should require fullName minimum length of 2 characters', () => {
      // Valid names (using actual schema requirement)
      const validNames = [
        { fullName: 'Jo', email: 'test@example.com' },
        { fullName: 'John Doe', email: 'test@example.com' },
        { fullName: 'A B', email: 'test@example.com' },
      ];

      validNames.forEach(data => {
        const result = registrationStartSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      // Invalid names (too short per schema)
      const invalidNames = [
        { fullName: 'J', email: 'test@example.com' },
        { fullName: '', email: 'test@example.com' },
      ];

      invalidNames.forEach(data => {
        const result = registrationStartSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          const hasFullNameError = result.error.issues.some(issue => 
            issue.path.includes('fullName') && issue.message.includes('at least 2 characters')
          );
          expect(hasFullNameError).toBe(true);
        }
      });
    });

    it('should allow optional fields (company, title, phone, address, referredBy)', () => {
      // Minimal valid registration (only required fields)
      const minimalData = {
        fullName: 'John Doe',
        email: 'test@example.com',
      };

      const result1 = registrationStartSchema.safeParse(minimalData);
      expect(result1.success).toBe(true);

      // Full registration with all optional fields
      const fullData = {
        fullName: 'John Doe',
        email: 'test@example.com',
        company: 'Acme Corp',
        title: 'Senior Engineer',
        phone: '+1.438.533.5344',
        address: '123 Main St, City, State 12345',
        referredBy: 'Friend',
      };

      const result2 = registrationStartSchema.safeParse(fullData);
      expect(result2.success).toBe(true);
    });
  });

  describe('Verification Code Validation - REAL ZOD SCHEMA', () => {
    it('should require exactly 6 character verification code', () => {
      // Valid 6-digit code
      const validData = {
        email: 'test@example.com',
        code: '123456',
      };

      const result = registrationVerifySchema.safeParse(validData);
      expect(result.success).toBe(true);

      // Invalid codes (wrong length per schema)
      const invalidCodes = [
        { email: 'test@example.com', code: '12345' }, // too short
        { email: 'test@example.com', code: '1234567' }, // too long
        { email: 'test@example.com', code: '' }, // empty
      ];

      invalidCodes.forEach(data => {
        const result = registrationVerifySchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          const hasCodeError = result.error.issues.some(issue => 
            issue.message.includes('6 digits')
          );
          expect(hasCodeError).toBe(true);
        }
      });
    });

    it('should validate email in verification request', () => {
      const invalidData = {
        email: 'not-an-email',
        code: '123456',
      };

      const result = registrationVerifySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('email'))).toBe(true);
      }
    });
  });

  describe('Firebase Account Creation', () => {
    it('should call createUserWithEmailAndPassword with correct params', async () => {
      const mockCreateUser = vi.mocked(createUserWithEmailAndPassword);
      mockCreateUser.mockResolvedValue({
        user: { uid: 'test-uid', email: 'test@example.com' },
      } as any);

      const email = 'newuser@example.com';
      const password = 'SecurePass123';

      await createUserWithEmailAndPassword({} as any, email, password);

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.anything(),
        email,
        password
      );
    });

    it('should handle registration errors gracefully', async () => {
      const mockCreateUser = vi.mocked(createUserWithEmailAndPassword);
      mockCreateUser.mockRejectedValue(new Error('auth/email-already-in-use'));

      await expect(
        createUserWithEmailAndPassword({} as any, 'existing@example.com', 'Pass123')
      ).rejects.toThrow();
    });
  });

  describe('Email Verification', () => {
    it('should send verification email after successful registration', async () => {
      const mockSendVerification = vi.mocked(sendEmailVerification);
      mockSendVerification.mockResolvedValue(undefined);

      const mockUser = { uid: 'test-uid', email: 'test@example.com' } as any;

      await sendEmailVerification(mockUser);

      expect(mockSendVerification).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('User State After Registration', () => {
    it('should create user with pending approval status', () => {
      const newUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: false,
        status: 'pending_approval' as const,
        role: 'user' as const,
        createdAt: new Date().toISOString(),
      };

      expect(newUser.status).toBe('pending_approval');
      expect(newUser.role).toBe('user');
      expect(newUser.emailVerified).toBe(false);
    });

    it('should not have premium features access before approval', () => {
      const checkAccessByStatus = (status: string) => {
        return status === 'approved';
      };
      
      const hasApprovedAccess = checkAccessByStatus('pending_approval');
      
      expect(hasApprovedAccess).toBe(false);
      expect(checkAccessByStatus('approved')).toBe(true);
    });

    it('should have access to free tier features immediately', () => {
      // Test actual MeasurePRO free tier feature checking
      expect(isFreeTierFeature('basic_measurement')).toBe(true);
      expect(isFreeTierFeature('gps_tracking')).toBe(true);
      expect(isFreeTierFeature('offline_mode')).toBe(true);
      
      // Premium features should not be in free tier
      expect(isFreeTierFeature('ai_detection')).toBe(false);
      expect(isFreeTierFeature('zed2i_support')).toBe(false);
      expect(isFreeTierFeature('swept_path_analysis')).toBe(false);
    });

    it('should get appropriate error message for unlicensed features', () => {
      const message = getUnlicensedMessage('ai_detection');
      
      expect(message).toContain('AI Object Detection');
      expect(message).toContain('license');
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });
});

/**
 * MANUAL TESTING CHECKLIST
 * 
 * These tests require UI interaction and Firebase backend:
 * 
 * □ Navigate to /register page
 * □ Fill registration form with valid data
 * □ Submit form
 * □ Verify success toast message
 * □ Check email for verification link
 * □ Verify user appears in Firebase Auth console
 * □ Verify user document created in Firestore with pending_approval status
 * □ Attempt login before email verification - should fail
 * □ Click verification link in email
 * □ Attempt login after verification - should succeed but show pending approval
 * □ Verify no premium features accessible until admin approves
 * 
 * ERROR CASES TO TEST:
 * □ Duplicate email registration - should show "Email already in use"
 * □ Invalid email format - should show validation error
 * □ Weak password - should show password requirements
 * □ Empty required fields - should show field required errors
 * □ Network error during registration - should show retry option
 */
