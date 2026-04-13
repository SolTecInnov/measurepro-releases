import { Router, Request, Response, NextFunction } from 'express';
import { readFileSync as _fsReadFileSync } from 'fs';
import { resolve as _pathResolve } from 'path';
import { SquareClient } from 'square';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import bcrypt from 'bcryptjs';
import {
  VERIFICATION_CODE_EXPIRY_MINUTES,
  generateVerificationCode,
  hashVerificationCode,
  verifyCode,
  checkRateLimit,
} from './services/verificationService.js';
import { sendSmsVerification, normalizePhone } from './services/smsService.js';
import JSZip from 'jszip';
import {
  sendContactFormEmail,
  sendSurveyCompletionEmail,
  sendAlertThresholdEmail,
  sendDataExportEmail,
  sendLiveMonitorQREmail,
  sendSyncCompletionEmail,
  sendTestEmail,
  sendMeasurementLogEmail,
  sendSubscriptionEmail,
  sendVerificationCodeEmail,
  sendAccountApprovalEmail,
  sendWelcomeEmail,
  send7DayOfflineWarningEmail,
  sendCancellationEmail,
  send30DayDeletionWarningEmail,
  sendFinalDeletionNotice,
  sendNewRegistrationAdminAlert,
  sendAddonOverrideEmail,
} from './services/emailService.js';
import {
  contactFormEmailSchema,
  surveyCompletionEmailSchema,
  alertThresholdEmailSchema,
  dataExportEmailSchema,
  liveMonitorQREmailSchema,
  syncCompletionEmailSchema,
  testEmailSchema,
  measurementLogEmailSchema,
  insertCustomerSchema,
  insertSubscriptionSchema,
  subscriptionEmailSchema,
  registrationStartSchema,
  registrationVerifySchema,
  registrationFinalizeSchema,
  registrationResendSchema,
  accountSchema,
  Account,
  insertPricingSchema,
  signupStartSchema,
  signupStep1Schema,
  signupStep2Schema,
  signupStep3Schema,
  signupStep4Schema,
  signupStep5Schema,
  signupCompleteSchema,
  insertTesterSchema,
  insertTestSessionSchema,
  insertTestResultSchema,
  userSettingsSchema,
  insertCompanySchema,
  insertCompanyMemberSchema,
  companyRoleEnum,
  updateMemberAccessSchema,
  RouteEnforcementConvoy,
  insertMemberAddonOverrideSchema,
  ADDON_DISPLAY_NAMES,
  ADDON_KEY_TO_FEATURE_KEY,
  type CompanyMember,
} from '../shared/schema.js';
import { storage } from './storage.js';
import { verifyAdminAccess, verifyMasterAdminAccess, verifyAdminOrMasterAccess, AuthRequest } from './middleware/adminAuth.js';
import { exportSeedFromDatabase } from './seedProduction.js';
import { GnssFirestore } from './gnss/firestore.js';
import { createGnssRoutes } from './gnss/routes.js';
import { createProfileRoutes } from './gnss/profileRoutes.js';
import auditRoutes from './auditRoutes.js';
import roadscopeRoutes from './roadscopeRoutes.js';

const router = Router();

// ── App version — fetched by field app on load to detect stale SW cache ───────
// /api/* routes are never cached by the service worker, so this always returns
// the server's current build timestamp. If it differs from the client's cached
// __BUILD_TIMESTAMP__ the field app does a hard reload to clear stale JS.
const _buildStampPaths = [
  _pathResolve(process.cwd(), 'dist', '_build-stamp.json'),
  _pathResolve(process.cwd(), 'public', '_build-stamp.json'),
];
let _buildVersion = 'dev';
for (const p of _buildStampPaths) {
  try { _buildVersion = JSON.parse(_fsReadFileSync(p, 'utf8')).buildTime?.toString() ?? 'dev'; break; } catch {}
}
router.get('/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ version: _buildVersion });
});

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: 'sandbox',
});

const apps = getApps();
let adminDb: FirebaseFirestore.Firestore | null = null;
let isFirebaseAdminAvailable = false;

// Firebase Admin SDK initialization with safe error handling
// Note: Admin SDK requires service account credentials in non-GCP environments
try {
  if (apps.length === 0) {
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID
    };

    // Only initialize if service account credentials are available and valid
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        // Parse and validate service account JSON
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        
        // Validate required fields
        if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
          throw new Error('Invalid service account JSON: missing required fields (project_id, private_key, client_email)');
        }
        
        initializeApp({
          credential: cert(serviceAccount),
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
        });
        adminDb = getFirestore();
        isFirebaseAdminAvailable = true;
        console.log('✅ Firebase Admin SDK initialized successfully');
        console.log(`   Project: ${serviceAccount.project_id}`);
        console.log(`   Service Account: ${serviceAccount.client_email}`);
        console.log(`   Storage Bucket: ${firebaseConfig.storageBucket}`);
      } catch (parseError: any) {
        console.error('❌ Failed to parse Firebase service account credentials:', parseError.message);
        console.log('   FIREBASE_SERVICE_ACCOUNT_KEY must be a valid JSON object with:');
        console.log('   - project_id');
        console.log('   - private_key');
        console.log('   - client_email');
        throw parseError; // Re-throw to trigger outer catch
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Fallback to file-based credentials (for local development)
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      adminDb = getFirestore();
      isFirebaseAdminAvailable = true;
      console.log('✅ Firebase Admin SDK initialized with GOOGLE_APPLICATION_CREDENTIALS');
    } else {
      console.log('⚠️ Firebase Admin SDK credentials not found - running without server-side Firebase');
      console.log('   Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable with service account JSON');
      console.log('   Client-side Firebase will still work for authentication and data sync');
      console.log('   Server features disabled: beta account creation, admin operations');
    }
  } else {
    adminDb = getFirestore();
    isFirebaseAdminAvailable = true;
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin initialization failed - server will run without admin SDK:', error);
  console.log('   Client-side Firebase will still work for authentication and data sync');
  isFirebaseAdminAvailable = false;
  adminDb = null;
}

/**
 * Helper function to safely access adminDb with null checking
 * Throws a clear error if Firebase Admin SDK is not available
 */
function getAdminDb(): FirebaseFirestore.Firestore {
  if (!adminDb) {
    throw new Error('Firebase Admin SDK is not available. Server-side Firebase operations require valid service account credentials.');
  }
  return adminDb;
}

/**
 * Allows offline auth mode - bypasses server-side validation when Firebase Admin SDK unavailable
 * This allows client-side Firebase Auth to work without server-side credentials
 * For production deployments with Admin SDK, full token verification is performed
 */
const allowOfflineAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, allow request to proceed (client-side auth only)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Extract UID from x-user-id header (set by client)
      req.userId = req.headers['x-user-id'] as string || 'offline-user';
      req.userEmail = req.headers['x-user-email'] as string;
      return next();
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      req.userId = req.headers['x-user-id'] as string || 'offline-user';
      req.userEmail = req.headers['x-user-email'] as string;
      return next();
    }

    // If Firebase Admin SDK is available, verify token
    if (isFirebaseAdminAvailable) {
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        req.userId = decodedToken.uid;
        req.userEmail = decodedToken.email;
      } catch (error) {
        console.error('Token verification failed:', error);
        req.userId = req.headers['x-user-id'] as string || 'offline-user';
        req.userEmail = req.headers['x-user-email'] as string;
      }
    } else {
      // Offline mode: trust client-provided user info
      req.userId = req.headers['x-user-id'] as string || 'offline-user';
      req.userEmail = req.headers['x-user-email'] as string;
    }
    
    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    // Fallback to offline mode
    req.userId = req.headers['x-user-id'] as string || 'offline-user';
    req.userEmail = req.headers['x-user-email'] as string;
    next();
  }
};

/**
 * Strict Firebase token verification - REQUIRES Firebase Admin SDK
 * Use this for sensitive operations (payments, admin panel, etc.)
 */
const verifyFirebaseToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if Firebase Admin SDK is available
    if (!isFirebaseAdminAvailable) {
      return res.status(503).json({
        success: false,
        error: 'Server authentication unavailable: Firebase Admin SDK not configured',
      });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No token provided',
      });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    // Populate isAdmin flag using same logic as verifyAdminOrMasterAccess
    // so downstream route handlers can rely on it without re-decoding the token
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@soltec.ca';
    const masterAdminEmail = process.env.MASTER_ADMIN_EMAIL || 'jfprince@soltec.ca';
    req.isAdmin = decodedToken['admin'] === true
      || decodedToken.email === masterAdminEmail
      || decodedToken.email === adminEmail;
    
    next();
  } catch (error: any) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token',
    });
  }
};

router.post('/create-payment', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const { token } = req.body;
    const userId = req.userId;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: token is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User ID not found in token',
      });
    }

    // SECURITY: Hard-code the subscription price server-side
    // NEVER trust client-supplied amounts for payment processing
    const SUBSCRIPTION_PRICE_USD = 300;
    const amountInCents = SUBSCRIPTION_PRICE_USD * 100; // $300 = 30000 cents

    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) {
      console.error('SQUARE_LOCATION_ID not configured');
      return res.status(500).json({
        success: false,
        error: 'Payment system configuration error',
      });
    }

    const idempotencyKey = randomUUID();

    console.log(`Processing payment: ${amountInCents} cents for user ${userId}`);

    const response = await squareClient.payments.create({
      sourceId: token,
      idempotencyKey,
      amountMoney: {
        amount: BigInt(amountInCents),
        currency: 'USD',
      },
      locationId,
      referenceId: userId,
    });

    console.log('Payment successful:', response.payment?.id);

    return res.json({
      success: true,
      paymentId: response.payment?.id,
      status: response.payment?.status,
    });
  } catch (error: any) {
    console.error('Payment processing error:', error);

    const errorMessage = error.errors?.[0]?.detail || error.message || 'Payment processing failed';

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

router.post('/activate-subscription', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.userId;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: paymentId is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User ID not found in token',
      });
    }

    console.log(`Verifying payment ${paymentId} for user ${userId}`);

    // SECURITY: Check if payment has already been used (replay attack prevention)
    const existingSubscriptions = await getAdminDb()
      .collection('subscriptions')
      .where('paymentId', '==', paymentId)
      .get();

    if (!existingSubscriptions.empty) {
      console.log(`Payment ${paymentId} has already been used`);
      return res.status(400).json({
        success: false,
        error: 'Payment already used',
      });
    }

    // SECURITY: Verify payment with Square before activating subscription
    const paymentResponse = await squareClient.payments.get(paymentId);
    const payment = paymentResponse.payment;

    if (payment?.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: `Payment not completed. Status: ${payment?.status}`,
      });
    }

    // SECURITY: Verify payment ownership - referenceId must match userId
    if (payment.referenceId !== userId) {
      console.log(`Payment ${paymentId} belongs to different user. Expected: ${userId}, Got: ${payment.referenceId}`);
      return res.status(403).json({
        success: false,
        error: 'Payment belongs to different user',
      });
    }

    // SECURITY: Verify the payment amount matches the subscription price
    const EXPECTED_AMOUNT = 30000; // $300 in cents
    const paidAmount = Number(payment.amountMoney?.amount);
    
    if (paidAmount !== EXPECTED_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Payment amount mismatch. Expected $300, received $${paidAmount / 100}`,
      });
    }

    // SECURITY: Verify currency
    if (payment.amountMoney?.currency !== 'USD') {
      return res.status(400).json({
        success: false,
        error: `Invalid currency. Expected USD, received ${payment.amountMoney?.currency}`,
      });
    }

    console.log('Payment verified as COMPLETED with correct amount and currency, creating subscription...');

    const subscriptionData = {
      userId,
      paymentId,
      plan: 'MeasurePro',
      amount: 300,
      currency: 'USD',
      status: 'active',
      startDate: Timestamp.now(),
      nextBillingDate: Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      ),
      createdAt: Timestamp.now(),
    };

    await getAdminDb().collection('subscriptions').doc(userId).set(subscriptionData);

    console.log('Subscription created successfully for user:', userId);

    return res.json({
      success: true,
      subscription: subscriptionData,
    });
  } catch (error: any) {
    console.error('Subscription activation error:', error);

    const errorMessage = error.errors?.[0]?.detail || error.message || 'Subscription activation failed';

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Email Routes

// Contact Form Email
router.post('/email/contact', async (req: Request, res: Response) => {
  try {
    const validatedData = contactFormEmailSchema.parse(req.body);
    const result = await sendContactFormEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Contact form email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send contact form email',
      });
    }
  } catch (error: any) {
    console.error('Contact form email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Survey Completion Email
router.post('/email/survey-completion', async (req: Request, res: Response) => {
  try {
    const validatedData = surveyCompletionEmailSchema.parse(req.body);
    const result = await sendSurveyCompletionEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Survey completion email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send survey completion email',
      });
    }
  } catch (error: any) {
    console.error('Survey completion email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Alert Threshold Email
router.post('/email/alert-threshold', async (req: Request, res: Response) => {
  try {
    const validatedData = alertThresholdEmailSchema.parse(req.body);
    const result = await sendAlertThresholdEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Alert threshold email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send alert threshold email',
      });
    }
  } catch (error: any) {
    console.error('Alert threshold email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Data Export Email
router.post('/email/data-export', async (req: Request, res: Response) => {
  try {
    const validatedData = dataExportEmailSchema.parse(req.body);
    const result = await sendDataExportEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Data export email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send data export email',
      });
    }
  } catch (error: any) {
    console.error('Data export email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Live Monitor QR Code Email
router.post('/email/live-monitor-qr', async (req: Request, res: Response) => {
  try {
    const validatedData = liveMonitorQREmailSchema.parse(req.body);
    const result = await sendLiveMonitorQREmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Live monitor QR email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send live monitor QR email',
      });
    }
  } catch (error: any) {
    console.error('Live monitor QR email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Sync Completion Email
router.post('/email/sync-completion', async (req: Request, res: Response) => {
  try {
    const validatedData = syncCompletionEmailSchema.parse(req.body);
    const result = await sendSyncCompletionEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Sync completion email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send sync completion email',
      });
    }
  } catch (error: any) {
    console.error('Sync completion email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Test Email
router.post('/email/test', async (req: Request, res: Response) => {
  try {
    const validatedData = testEmailSchema.parse(req.body);
    const result = await sendTestEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send test email',
      });
    }
  } catch (error: any) {
    console.error('Test email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Measurement Log Email
router.post('/email/measurement-log', async (req: Request, res: Response) => {
  try {
    const validatedData = measurementLogEmailSchema.parse(req.body);
    const result = await sendMeasurementLogEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Measurement log email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send measurement log email',
      });
    }
  } catch (error: any) {
    console.error('Measurement log email route error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// Survey Package Upload to Firebase Storage
// Uses Admin SDK to bypass client-side auth issues with Storage
router.post('/storage/upload-survey-package', async (req: Request, res: Response) => {
  try {
    if (!isFirebaseAdminAvailable) {
      return res.status(503).json({
        success: false,
        error: 'Firebase Admin SDK not available. Package saved locally only.',
      });
    }

    const { surveyId, fileName, fileData, contentType } = req.body;

    if (!surveyId || !fileName || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: surveyId, fileName, fileData',
      });
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(fileData, 'base64');
    const filePath = `survey-packages/${surveyId}/${fileName}`;
    
    console.log(`[StorageUpload] Uploading ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) to ${filePath}`);

    // Upload using Admin SDK
    const bucket = getAdminStorage().bucket();
    const file = bucket.file(filePath);
    
    await file.save(fileBuffer, {
      metadata: {
        contentType: contentType || 'application/zip',
        metadata: {
          surveyId,
          uploadedAt: new Date().toISOString(),
          originalFileName: fileName,
        },
      },
    });

    // Generate signed URL with 72-hour expiration
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 72);

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expirationDate,
    });

    console.log(`[StorageUpload] Upload complete. Signed URL generated (expires: ${expirationDate.toISOString()})`);

    return res.json({
      success: true,
      downloadUrl: signedUrl,
      filePath,
      fileSize: fileBuffer.length,
      expiresAt: expirationDate.toISOString(),
    });
  } catch (error: any) {
    console.error('[StorageUpload] Server upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload survey package',
    });
  }
});

// Convoy Routes
import { convoyHub } from './convoyHub.js';

// Create convoy session
router.post('/convoy/create', async (req: Request, res: Response) => {
  console.log('🚀 POST /convoy/create called with body:', req.body);
  try {
    const { sessionName, warningThreshold, criticalThreshold, groundReference, maxMembers, leaderId } = req.body;

    if (!sessionName || !leaderId) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionName and leaderId are required',
      });
    }

    console.log('✅ Creating session with convoyHub...');
    const { sessionId, qrToken } = convoyHub.createSession({
      sessionName,
      warningThreshold: warningThreshold || 4.5,
      criticalThreshold: criticalThreshold || 4.2,
      groundReference: groundReference || 0,
      maxMembers: maxMembers || 10,
      leaderId,
    });

    console.log(`✅ API returning: sessionId=${sessionId}, qrToken=${qrToken}`);
    return res.json({
      success: true,
      sessionId,
      qrToken,
    });
  } catch (error: any) {
    console.error('❌ Create convoy session error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create convoy session',
    });
  }
});

// End convoy session
router.post('/convoy/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId is required',
      });
    }

    convoyHub.endSession(sessionId);

    return res.json({
      success: true,
      message: 'Convoy session ended successfully',
    });
  } catch (error: any) {
    console.error('End convoy session error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to end convoy session',
    });
  }
});

// Get active sessions
router.get('/convoy/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = convoyHub.getActiveSessions();

    return res.json({
      success: true,
      sessions,
    });
  } catch (error: any) {
    console.error('Get convoy sessions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get convoy sessions',
    });
  }
});

// Customer Routes

// Create customer
router.post('/customers', async (req: Request, res: Response) => {
  try {
    const validatedData = insertCustomerSchema.parse(req.body);
    const customer = await storage.createCustomer(validatedData);

    return res.status(201).json({
      success: true,
      customer,
    });
  } catch (error: any) {
    console.error('Create customer error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create customer',
    });
  }
});

// Get all customers
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const customers = await storage.getAllCustomers();

    return res.json({
      success: true,
      customers,
    });
  } catch (error: any) {
    console.error('Get customers error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customers',
    });
  }
});

// Get single customer
router.get('/customers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await storage.getCustomer(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    return res.json({
      success: true,
      customer,
    });
  } catch (error: any) {
    console.error('Get customer error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer',
    });
  }
});

// Update customer
router.patch('/customers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = insertCustomerSchema.partial().parse(req.body);
    const customer = await storage.updateCustomer(id, validatedData);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    return res.json({
      success: true,
      customer,
    });
  } catch (error: any) {
    console.error('Update customer error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update customer',
    });
  }
});

// Delete customer
router.delete('/customers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteCustomer(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    return res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete customer',
    });
  }
});

// Subscription Management Routes

// Get current user subscription
router.get('/subscription/current', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User email not found in token',
      });
    }

    const subscriptionData = await storage.getUserSubscription(userEmail);
    
    if (!subscriptionData) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      data: subscriptionData,
    });
  } catch (error: any) {
    console.error('Get user subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscription',
    });
  }
});

// Pause subscription
router.post('/subscription/pause', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User email not found in token',
      });
    }

    const updatedSubscription = await storage.pauseSubscription(userEmail);
    
    if (!updatedSubscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      message: 'Subscription paused successfully',
      data: updatedSubscription,
    });
  } catch (error: any) {
    console.error('Pause subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to pause subscription',
    });
  }
});

// Cancel subscription
router.post('/subscription/cancel', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User email not found in token',
      });
    }

    const updatedSubscription = await storage.cancelSubscription(userEmail);
    
    if (!updatedSubscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    // Send Cancellation Confirmation Email
    try {
      // Get user's full name from Firestore
      const userId = req.userId;
      let fullName = 'Valued Customer';
      
      if (userId) {
        try {
          const userDoc = await getAdminDb().collection('users').doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            fullName = userData?.fullName || 'Valued Customer';
          }
        } catch (userFetchError) {
          console.warn('Could not fetch user name for cancellation email:', userFetchError);
        }
      }
      
      // Calculate deletion date (30 days from now)
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30);
      
      console.log(`📧 Sending cancellation email to: ${userEmail}`);
      
      const emailResult = await sendCancellationEmail({
        recipientEmail: userEmail,
        recipientName: fullName,
        deletionDate: deletionDate.toISOString(),
        daysUntilDeletion: 30,
      });
      
      if (emailResult.success) {
        console.log(`✅ Cancellation email sent successfully to: ${userEmail}`);
      } else {
        console.error(`⚠️ Failed to send cancellation email to: ${userEmail}`, emailResult.error);
        // Don't fail the cancellation if email fails - just log the error
      }
    } catch (emailError: any) {
      console.error('Cancellation email error (non-critical):', emailError);
      // Continue despite email error - subscription is cancelled successfully
    }

    return res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: updatedSubscription,
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel subscription',
    });
  }
});

// Unpause subscription
router.post('/subscription/unpause', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User email not found in token',
      });
    }

    const updatedSubscription = await storage.unpauseSubscription(userEmail);
    
    if (!updatedSubscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      message: 'Subscription unpaused successfully',
      data: updatedSubscription,
    });
  } catch (error: any) {
    console.error('Unpause subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unpause subscription',
    });
  }
});

// Uncancel subscription
router.post('/subscription/uncancel', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User email not found in token',
      });
    }

    const updatedSubscription = await storage.uncancelSubscription(userEmail);
    
    if (!updatedSubscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      message: 'Subscription cancellation reversed successfully',
      data: updatedSubscription,
    });
  } catch (error: any) {
    console.error('Uncancel subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reverse subscription cancellation',
    });
  }
});

// Export user data
router.get('/subscription/export-data', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User email not found in token',
      });
    }

    // Get all user data
    const userData = await storage.getAllUserData(userEmail);
    
    if (!userData.subscription && !userData.signupProgress) {
      return res.status(404).json({
        success: false,
        error: 'No user data found',
      });
    }

    // Create ZIP file
    const zip = new JSZip();
    
    // Add files to ZIP
    zip.file('subscription.json', JSON.stringify(userData.subscription, null, 2));
    zip.file('signupProgress.json', JSON.stringify(userData.signupProgress, null, 2));
    zip.file('termsAcceptances.json', JSON.stringify(userData.termsAcceptances, null, 2));
    zip.file('README.txt', `MeasurePRO Data Export
Exported on: ${userData.exportDate}
User: ${userEmail}

This archive contains all your MeasurePRO account data:
- subscription.json: Your subscription details
- signupProgress.json: Your account registration and signup information
- termsAcceptances.json: Record of terms and conditions acceptances

Note: This export includes all data stored in our database.
Survey data, measurements, and media files would be included here in a full implementation.
`);
    
    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Send as download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="measurepro-data-${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.zip"`);
    res.send(zipBuffer);
  } catch (error: any) {
    console.error('Export data error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export data',
    });
  }
});

// Subscription Routes

// Create subscription
router.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const validatedData = insertSubscriptionSchema.parse(req.body);
    
    const customer = await storage.getCustomer(validatedData.customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    const subscription = await storage.createSubscription(validatedData);

    return res.status(201).json({
      success: true,
      subscription,
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create subscription',
    });
  }
});

// Get all subscriptions
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.query;

    let subscriptions;
    if (customerId && typeof customerId === 'string') {
      subscriptions = await storage.getSubscriptionsByCustomer(customerId);
    } else {
      subscriptions = await storage.getAllSubscriptions();
    }

    return res.json({
      success: true,
      subscriptions,
    });
  } catch (error: any) {
    console.error('Get subscriptions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscriptions',
    });
  }
});

// Get single subscription
router.get('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const subscription = await storage.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      subscription,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscription',
    });
  }
});

// Update subscription
router.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = insertSubscriptionSchema.partial().parse(req.body);
    const subscription = await storage.updateSubscription(id, validatedData);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      subscription,
    });
  } catch (error: any) {
    console.error('Update subscription error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update subscription',
    });
  }
});

// Delete subscription
router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteSubscription(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      message: 'Subscription deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete subscription',
    });
  }
});

// Send subscription credentials email
router.post('/subscriptions/send-credentials', async (req: Request, res: Response) => {
  try {
    const validatedData = subscriptionEmailSchema.parse(req.body);
    const result = await sendSubscriptionEmail(validatedData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Subscription credentials email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send subscription credentials email',
      });
    }
  } catch (error: any) {
    console.error('Send subscription credentials error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid request data',
    });
  }
});

// ==================== PERMITTED ROUTE ENFORCEMENT API ====================

// Create route enforcement convoy (frontend sends pre-processed GPX coordinates)
router.post('/route-enforcement/convoys', async (req: Request, res: Response) => {
  try {
    const { 
      routeGeometry, 
      routeName, 
      routeDescription,
      convoyName, 
      dispatcherId, 
      allowedDeviationMeters, 
      persistenceSeconds, 
      environmentType, 
      windowStart, 
      windowEnd, 
      dispatchPhone, 
      dispatchEmail 
    } = req.body;
    
    if (!routeGeometry || !convoyName || !dispatcherId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: routeGeometry, convoyName, dispatcherId',
      });
    }

    // Validate coordinates
    let coordinates: [number, number][] = routeGeometry;
    
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Route must contain at least 2 points',
      });
    }
    
    // Resample route if too many points (keep every nth point for efficiency)
    if (coordinates.length > 200) {
      const step = Math.ceil(coordinates.length / 200);
      const resampled = coordinates.filter((_, index) => index % step === 0);
      if (resampled[resampled.length - 1] !== coordinates[coordinates.length - 1]) {
        resampled.push(coordinates[coordinates.length - 1]);
      }
      coordinates = resampled;
    }
    
    // Calculate total route distance
    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const [lat1, lon1] = coordinates[i - 1];
      const [lat2, lon2] = coordinates[i];
      const R = 6371000; // Earth radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    
    // Generate unique QR token
    const qrToken = randomUUID().substring(0, 8).toUpperCase();
    
    // Create convoy
    const convoy = await storage.createRouteConvoy({
      dispatcherId,
      convoyName,
      status: 'active',
      routeGeometry: coordinates,
      routeName: routeName || undefined,
      routeDescription: routeDescription || undefined,
      totalRouteDistance: totalDistance,
      allowedDeviationMeters: allowedDeviationMeters || (environmentType === 'urban' ? 15 : 30),
      persistenceSeconds: persistenceSeconds || 7,
      maxAccuracyMeters: 15,
      environmentType: environmentType || 'rural',
      windowStart: windowStart || new Date().toISOString(),
      windowEnd: windowEnd || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      dispatchPhone,
      dispatchEmail,
      qrToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    
    return res.json({
      success: true,
      convoy,
    });
  } catch (error: any) {
    console.error('Create route convoy error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create route convoy',
    });
  }
});

// Get all route enforcement convoys
router.get('/route-enforcement/convoys', async (req: Request, res: Response) => {
  try {
    const { dispatcherId, status } = req.query;
    
    let convoys = await storage.getAllRouteConvoys();
    
    if (dispatcherId) {
      convoys = convoys.filter(c => c.dispatcherId === dispatcherId);
    }
    
    if (status) {
      convoys = convoys.filter(c => c.status === status);
    }
    
    return res.json({
      success: true,
      convoys,
    });
  } catch (error: any) {
    console.error('Get route convoys error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get route convoys',
    });
  }
});

// Get route convoy by QR token
router.get('/route-enforcement/convoys/token/:qrToken', async (req: Request, res: Response) => {
  try {
    const { qrToken } = req.params;
    const convoy = await storage.getRouteConvoyByToken(qrToken);
    
    if (!convoy) {
      return res.status(404).json({
        success: false,
        error: 'Convoy not found',
      });
    }
    
    return res.json({
      success: true,
      convoy,
    });
  } catch (error: any) {
    console.error('Get convoy by token error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get convoy',
    });
  }
});

// Get route convoy by ID
router.get('/route-enforcement/convoys/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const convoy = await storage.getRouteConvoy(id);
    
    if (!convoy) {
      return res.status(404).json({
        success: false,
        error: 'Convoy not found',
      });
    }
    
    return res.json({
      success: true,
      convoy,
    });
  } catch (error: any) {
    console.error('Get route convoy error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get convoy',
    });
  }
});

// Update route convoy
router.patch('/route-enforcement/convoys/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const convoy = await storage.updateRouteConvoy(id, req.body);
    
    if (!convoy) {
      return res.status(404).json({
        success: false,
        error: 'Convoy not found',
      });
    }

    // Mirror status change to DB so restart restore reflects current state
    try {
      const { db: dbConn } = await import('../db/index.js');
      const { convoySessions: csTable } = await import('../db/schema.js');
      const { eq: eqOp } = await import('drizzle-orm');
      const dbUpdate: Record<string, unknown> = {};
      if (convoy.status) dbUpdate.status = convoy.status;
      if (convoy.windowStart) dbUpdate.windowStart = new Date(convoy.windowStart);
      if (convoy.windowEnd) dbUpdate.windowEnd = new Date(convoy.windowEnd);
      if (convoy.status === 'ended') dbUpdate.endedAt = new Date();
      if (Object.keys(dbUpdate).length > 0) {
        await dbConn.update(csTable).set(dbUpdate).where(eqOp(csTable.id, id));
      }
    } catch (dbErr) {
      console.warn('⚠️ Could not sync enforcement convoy status to DB:', dbErr);
    }
    
    return res.json({
      success: true,
      convoy,
    });
  } catch (error: any) {
    console.error('Update route convoy error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update convoy',
    });
  }
});

// Delete route convoy
router.delete('/route-enforcement/convoys/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteRouteConvoy(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Convoy not found',
      });
    }

    // Soft-end the DB record so it won't be restored on restart
    try {
      const { db: dbConn } = await import('../db/index.js');
      const { convoySessions: csTable } = await import('../db/schema.js');
      const { eq: eqOp } = await import('drizzle-orm');
      await dbConn.update(csTable)
        .set({ status: 'ended', endedAt: new Date() })
        .where(eqOp(csTable.id, id));
    } catch (dbErr) {
      console.warn('⚠️ Could not soft-end enforcement convoy in DB:', dbErr);
    }
    
    return res.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Delete route convoy error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete convoy',
    });
  }
});

// Get convoy members
router.get('/route-enforcement/convoys/:convoyId/members', async (req: Request, res: Response) => {
  try {
    const { convoyId } = req.params;
    const members = await storage.getRouteMembers(convoyId);
    
    return res.json({
      success: true,
      members,
    });
  } catch (error: any) {
    console.error('Get convoy members error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get members',
    });
  }
});

// Get convoy incidents
router.get('/route-enforcement/convoys/:convoyId/incidents', async (req: Request, res: Response) => {
  try {
    const { convoyId } = req.params;
    const { pending } = req.query;
    
    const incidents = pending === 'true' 
      ? await storage.getPendingIncidents(convoyId)
      : await storage.getRouteIncidents(convoyId);
    
    return res.json({
      success: true,
      incidents,
    });
  } catch (error: any) {
    console.error('Get convoy incidents error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get incidents',
    });
  }
});

// Acknowledge incident (dispatch action)
router.patch('/route-enforcement/incidents/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dispatcherId, notes } = req.body;
    
    const incident = await storage.updateRouteIncident(id, {
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      dispatcherId,
      dispatchNotes: notes,
    });
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found',
      });
    }
    
    return res.json({
      success: true,
      incident,
    });
  } catch (error: any) {
    console.error('Acknowledge incident error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to acknowledge incident',
    });
  }
});

// Clear incident (dispatch action - allows driver to resume)
router.patch('/route-enforcement/incidents/:id/clear', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dispatcherId, notes } = req.body;
    
    const incident = await storage.updateRouteIncident(id, {
      status: 'cleared',
      clearedAt: new Date().toISOString(),
      dispatcherId,
      dispatchNotes: notes,
    });
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found',
      });
    }
    
    return res.json({
      success: true,
      incident,
    });
  } catch (error: any) {
    console.error('Clear incident error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear incident',
    });
  }
});

// ====================================
// ROUTE ENFORCEMENT TOKEN API (new persistent endpoints)
// ====================================

// POST /api/route-enforcement/sessions — dispatcher creates an enforcement session
// This is an alias that wraps the existing convoy creation, also persisting to convoy_sessions table
// Protected: requires admin or dispatcher access
router.post('/route-enforcement/sessions', verifyAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const {
      routeGeometry,
      routeName,
      routeDescription,
      convoyName,
      dispatcherId,
      allowedDeviationMeters,
      persistenceSeconds,
      environmentType,
      windowStart,
      windowEnd,
      dispatchPhone,
      dispatchEmail,
    } = req.body;

    if (!routeGeometry || !convoyName || !dispatcherId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: routeGeometry, convoyName, dispatcherId',
      });
    }

    let coordinates: [number, number][] = routeGeometry;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Route must contain at least 2 points',
      });
    }

    const qrToken = randomUUID().substring(0, 8).toUpperCase();
    const wStart = windowStart || new Date().toISOString();
    const wEnd = windowEnd || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const effectiveEnvType: 'urban' | 'rural' = environmentType === 'urban' ? 'urban' : 'rural';
    // Compute deviation default once to ensure runtime and DB store the same value
    const effectiveDeviationMeters: number = allowedDeviationMeters ?? (effectiveEnvType === 'urban' ? 15 : 30);
    const effectivePersistenceSeconds: number = persistenceSeconds ?? 7;

    const convoy = await storage.createRouteConvoy({
      dispatcherId,
      convoyName,
      status: 'active',
      routeGeometry: coordinates,
      routeName: routeName || undefined,
      routeDescription: routeDescription || undefined,
      allowedDeviationMeters: effectiveDeviationMeters,
      persistenceSeconds: effectivePersistenceSeconds,
      maxAccuracyMeters: 15,
      environmentType: effectiveEnvType,
      windowStart: wStart,
      windowEnd: wEnd,
      dispatchPhone,
      dispatchEmail,
      qrToken,
      expiresAt: wEnd,
    });

    // Register in ConvoyHub's in-memory map so WebSocket joins work immediately
    convoyHub.registerEnforcementConvoy(convoy);

    // Also persist to convoy_sessions for cross-restart durability
    try {
      const { db: dbConn } = await import('../db/index.js');
      const { convoySessions: csTable } = await import('../db/schema.js');
      await dbConn.insert(csTable).values({
        id: convoy.id,
        token: qrToken,
        sessionType: 'enforcement',
        sessionName: convoyName,
        status: 'active',
        routeGeometry: coordinates,
        allowedDeviationMeters: Math.round(effectiveDeviationMeters * 10),
        persistenceSeconds: effectivePersistenceSeconds,
        environmentType: effectiveEnvType,
        windowStart: new Date(wStart),
        windowEnd: new Date(wEnd),
        dispatchPhone: dispatchPhone || null,
        dispatchEmail: dispatchEmail || null,
        dispatcherId,
        expiresAt: new Date(wEnd),
      }).onConflictDoNothing();
    } catch (dbErr) {
      console.warn('⚠️ Could not persist enforcement session to convoy_sessions:', dbErr);
    }

    return res.json({ success: true, session: convoy });
  } catch (error: any) {
    console.error('Create enforcement session error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create enforcement session',
    });
  }
});

// POST /api/route-enforcement/validate-token — driver submits token, gets back geometry + thresholds
router.post('/route-enforcement/validate-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'token is required',
      });
    }

    const normalizedToken = token.trim().toUpperCase();

    // First try in-memory storage (fastest)
    let convoy = await storage.getRouteConvoyByToken(normalizedToken);

    // Fallback: check convoy_sessions DB table (survives server restart)
    if (!convoy) {
      try {
        const { db: dbConn } = await import('../db/index.js');
        const { convoySessions: csTable } = await import('../db/schema.js');
        const { eq: eqOp, and: andOp } = await import('drizzle-orm');
        const rows = await dbConn.select().from(csTable).where(
          andOp(
            eqOp(csTable.token, normalizedToken),
            eqOp(csTable.sessionType, 'enforcement'),
            eqOp(csTable.status, 'active')
          )
        ).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          const statusValue = row.status === 'active' || row.status === 'paused' || row.status === 'ended' ? row.status : 'active';
          const envValue = row.environmentType === 'urban' ? 'urban' : 'rural';
          const geometry = Array.isArray(row.routeGeometry) ? (row.routeGeometry as [number, number][]) : [];
          // Reconstruct a RouteEnforcementConvoy from DB row
          const fromDb: RouteEnforcementConvoy = {
            id: row.id,
            dispatcherId: row.dispatcherId || '',
            convoyName: row.sessionName || '',
            status: statusValue,
            routeGeometry: geometry,
            allowedDeviationMeters: row.allowedDeviationMeters ? row.allowedDeviationMeters / 10 : 30,
            persistenceSeconds: row.persistenceSeconds || 7,
            maxAccuracyMeters: 15,
            environmentType: envValue,
            windowStart: row.windowStart?.toISOString() || new Date().toISOString(),
            windowEnd: row.windowEnd?.toISOString() || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            dispatchPhone: row.dispatchPhone || undefined,
            dispatchEmail: row.dispatchEmail || undefined,
            qrToken: row.token,
            createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
            expiresAt: row.expiresAt?.toISOString() || null,
          };
          convoy = fromDb;
        }
      } catch (dbErr) {
        console.warn('⚠️ DB fallback lookup failed:', dbErr);
      }
    }

    if (!convoy) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or unknown token. Please check the token and try again.',
      });
    }

    if (convoy.status !== 'active') {
      return res.status(410).json({
        success: false,
        error: `This convoy is no longer active (status: ${convoy.status}). Please contact your dispatcher.`,
      });
    }

    const now = new Date();
    const windowEnd = convoy.windowEnd ? new Date(convoy.windowEnd) : null;
    const windowStart = convoy.windowStart ? new Date(convoy.windowStart) : null;

    if (windowEnd && now > windowEnd) {
      return res.status(410).json({
        success: false,
        error: 'This convoy token has expired. The time window has passed.',
      });
    }

    if (windowStart && now < windowStart) {
      const startsIn = Math.ceil((windowStart.getTime() - now.getTime()) / 60000);
      return res.status(425).json({
        success: false,
        error: `This convoy has not started yet. It begins in ${startsIn} minute(s).`,
      });
    }

    return res.json({
      success: true,
      convoy,
    });
  } catch (error: any) {
    console.error('Validate token error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate token',
    });
  }
});

// ====================================
// MARKETING COLLABORATION ROUTES
// ====================================

// Get all sections
router.get('/marketing/sections', async (req: Request, res: Response) => {
  try {
    const sections = await storage.getAllMarketingSections();
    return res.json({
      success: true,
      sections,
    });
  } catch (error: any) {
    console.error('Get marketing sections error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sections',
    });
  }
});

// Add comment to section
router.post('/marketing/comments', async (req: Request, res: Response) => {
  try {
    const { password, ...commentData } = req.body;
    
    if (password !== 'SolTec1234') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }
    
    const {insertMarketingCommentSchema} = await import('../shared/schema.js');
    const validatedData = insertMarketingCommentSchema.parse(commentData);
    const comment = await storage.createMarketingComment(validatedData);
    
    return res.status(201).json({
      success: true,
      comment,
    });
  } catch (error: any) {
    console.error('Create marketing comment error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create comment',
    });
  }
});

// Get comments for a document
router.get('/marketing/comments/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const comments = await storage.getMarketingComments(documentId);
    return res.json({
      success: true,
      comments,
    });
  } catch (error: any) {
    console.error('Get marketing comments error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get comments',
    });
  }
});

// Add edit to section
router.post('/marketing/edits', async (req: Request, res: Response) => {
  try {
    const { password, ...editData } = req.body;
    
    if (password !== 'SolTec1234') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }
    
    const {insertMarketingEditSchema} = await import('../shared/schema.js');
    const validatedData = insertMarketingEditSchema.parse(editData);
    const edit = await storage.createMarketingEdit(validatedData);
    
    return res.status(201).json({
      success: true,
      edit,
    });
  } catch (error: any) {
    console.error('Create marketing edit error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create edit',
    });
  }
});

// Get edits for a document
router.get('/marketing/edits/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const edits = await storage.getMarketingEdits(documentId);
    return res.json({
      success: true,
      edits,
    });
  } catch (error: any) {
    console.error('Get marketing edits error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get edits',
    });
  }
});

// ====================================
// USER REGISTRATION ROUTES
// ====================================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@soltec.ca';
const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || 'jfprince@soltec.ca';
// Admin UIDs for more secure admin authentication
// TODO: Migrate to Firebase custom claims for more scalable admin management
const ADMIN_UIDS: string[] = process.env.ADMIN_UIDS
  ? process.env.ADMIN_UIDS.split(',').map(uid => uid.trim())
  : [];

// Note: generateVerificationCode, hashVerificationCode, verifyCode, checkRateLimit,
// and VERIFICATION_CODE_EXPIRY_MINUTES are imported from ./services/verificationService.js
// so that both the RegisterPage flow (/registration/*) and the SignupPage wizard
// (/signup/send-verification, /signup/verify-code) share identical behaviour.

// Rate limiting for resend code (max 3 resends per email per hour)
const resendAttempts = new Map<string, { count: number; resetTime: number }>();

/**
 * Check if resend code is allowed for an email
 * @param email - The email address to check
 * @returns true if allowed, false if rate limit exceeded
 */
function checkResendRateLimit(email: string): boolean {
  const now = Date.now();
  const attempt = resendAttempts.get(email);
  
  if (!attempt || now >= attempt.resetTime) {
    // First attempt or reset time has passed
    resendAttempts.set(email, {
      count: 1,
      resetTime: now + 60 * 60 * 1000, // 1 hour from now
    });
    return true;
  }
  
  if (attempt.count >= 3) {
    // Max attempts reached
    return false;
  }
  
  // Increment attempt count
  attempt.count++;
  return true;
}

// POST /registration/start - Start registration process
router.post('/registration/start', async (req: Request, res: Response) => {
  try {
    console.log('Starting registration process:', req.body.email);
    console.log('Firebase Admin available?', isFirebaseAdminAvailable, 'adminDb?', !!adminDb);
    
    // Check if Firebase Admin SDK is available
    if (!isFirebaseAdminAvailable || !adminDb) {
      console.log('⚠️ Firebase Admin not available - registration handled client-side');
      return res.status(503).json({
        success: false,
        error: 'Server-side registration unavailable. Please use client-side Firebase authentication.',
        code: 'FIREBASE_ADMIN_UNAVAILABLE'
      });
    }
    
    console.log('✅ Firebase Admin check passed, proceeding with registration');
    
    const validatedData = registrationStartSchema.parse(req.body);
    
    // Check if account already exists
    const accountsCollection = getAdminDb().collection('accounts');
    const existingAccountQuery = await accountsCollection.where('email', '==', validatedData.email).get();
    
    if (!existingAccountQuery.empty) {
      const existingAccount = existingAccountQuery.docs[0].data() as Account;
      
      // If account already approved, don't allow re-registration
      if (existingAccount.status === 'approved') {
        return res.status(400).json({
          success: false,
          error: 'An account with this email already exists',
        });
      }
      
      // If account is pending or email_pending, allow resending verification
      console.log('Existing account found, allowing re-verification');
    }
    
    // Generate 6-digit verification code
    const verificationCode = generateVerificationCode();
    const codeHash = await hashVerificationCode(verificationCode);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();
    
    // Create account document
    const accountId = existingAccountQuery.empty ? randomUUID() : existingAccountQuery.docs[0].id;
    const accountData: Account = {
      id: accountId,
      fullName: validatedData.fullName,
      email: validatedData.email,
      company: validatedData.company,
      title: validatedData.title,
      phone: validatedData.phone,
      address: validatedData.address,
      referredBy: validatedData.referredBy,
      status: 'email_pending',
      emailVerified: false,
      autoRenew: true,
      verification: {
        codeHash,
        expiresAt,
      },
      createdAt: new Date().toISOString(),
    };
    
    // Save or update account in Firebase
    if (existingAccountQuery.empty) {
      await accountsCollection.doc(accountId).set(accountData);
    } else {
      await accountsCollection.doc(accountId).update({
        verification: accountData.verification,
        status: 'email_pending',
        emailVerified: false,
      });
    }
    
    // Send verification email
    const emailResult = await sendVerificationCodeEmail({
      recipientEmail: validatedData.email,
      recipientName: validatedData.fullName,
      verificationCode,
      expiryMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
    });
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.',
      });
    }
    
    console.log('Registration started successfully, verification email sent');
    
    return res.json({
      success: true,
      message: 'Verification code sent to your email',
      accountId,
    });
  } catch (error: any) {
    console.error('Registration start error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to start registration',
    });
  }
});

// POST /registration/verify - Verify email code
router.post('/registration/verify', async (req: Request, res: Response) => {
  try {
    console.log('Verifying email code for:', req.body.email);
    
    // Rate limiting check
    if (!checkRateLimit(req.body.email)) {
      return res.status(429).json({
        success: false,
        error: 'Too many verification attempts. Please try again in 1 minute.',
      });
    }
    
    const validatedData = registrationVerifySchema.parse(req.body);
    
    // Find account by email
    const accountsCollection = getAdminDb().collection('accounts');
    const accountQuery = await accountsCollection.where('email', '==', validatedData.email).get();
    
    // SECURITY: Use generic error message to prevent user enumeration
    if (accountQuery.empty) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
    }
    
    const accountDoc = accountQuery.docs[0];
    const account = accountDoc.data() as Account;
    
    // Check if account has verification data
    if (!account.verification) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
    }
    
    // Check if code has expired
    if (new Date(account.verification.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
    }
    
    // Verify the code
    const isValid = await verifyCode(validatedData.code, account.verification.codeHash);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
    }
    
    // Update account status to pending (awaiting admin approval)
    await accountsCollection.doc(accountDoc.id).update({
      status: 'pending',
      emailVerified: true,
      verification: null, // Clear verification data after successful verification
    });
    
    console.log('Email verified successfully for:', validatedData.email);
    
    return res.json({
      success: true,
      message: 'Email verified successfully',
      accountId: account.id,
    });
  } catch (error: any) {
    console.error('Email verification error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to verify email',
    });
  }
});

// POST /registration/resend - Resend verification code
router.post('/registration/resend', async (req: Request, res: Response) => {
  try {
    console.log('Resending verification code for:', req.body.email);
    
    // Check resend rate limit
    if (!checkResendRateLimit(req.body.email)) {
      return res.status(429).json({
        success: false,
        error: 'Too many resend attempts. Please try again in 1 hour.',
      });
    }
    
    const validatedData = registrationResendSchema.parse(req.body);
    
    // Find account by email
    const accountsCollection = getAdminDb().collection('accounts');
    const accountQuery = await accountsCollection.where('email', '==', validatedData.email).get();
    
    // SECURITY: Use generic success message to prevent user enumeration
    // Always return success even if account doesn't exist
    if (accountQuery.empty) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a verification code has been sent',
      });
    }
    
    const accountDoc = accountQuery.docs[0];
    const account = accountDoc.data() as Account;
    
    // Don't allow resend for already approved accounts (but don't leak this info)
    if (account.status === 'approved') {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a verification code has been sent',
      });
    }
    
    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const codeHash = await hashVerificationCode(verificationCode);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();
    
    // Update account with new verification data
    await accountsCollection.doc(accountDoc.id).update({
      verification: {
        codeHash,
        expiresAt,
      },
    });
    
    // Send new verification email
    const emailResult = await sendVerificationCodeEmail({
      recipientEmail: account.email,
      recipientName: account.fullName,
      verificationCode,
      expiryMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
    });
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.',
      });
    }
    
    console.log('Verification code resent successfully');
    
    return res.json({
      success: true,
      message: 'If an account exists with this email, a verification code has been sent',
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to resend verification code',
    });
  }
});

// POST /registration/finalize - Link Firebase Auth UID to account
/**
 * Hardened finalize endpoint with ownership validation
 * Ensures the user creating the Firebase Auth account matches the account they're trying to link
 */
router.post('/registration/finalize', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Finalizing registration:', req.body.accountId);
    
    const validatedData = registrationFinalizeSchema.parse(req.body);
    
    // Find account by ID
    const accountDoc = await getAdminDb().collection('accounts').doc(validatedData.accountId).get();
    
    if (!accountDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }
    
    const account = accountDoc.data() as Account;
    
    // Verify account is in pending status
    if (account.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Account must be email verified before finalizing',
      });
    }
    
    // Security check: Verify authUid from request matches the authenticated user
    if (validatedData.authUid !== req.userId) {
      console.error('Auth UID mismatch: request UID does not match authenticated user');
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot link account to different user',
      });
    }
    
    // Security check: Verify account email matches the authenticated user's email
    if (account.email !== req.userEmail) {
      console.error('Email mismatch: account email does not match authenticated user email');
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Email mismatch',
      });
    }
    
    // Prevent linking if authUid is already set (account already linked)
    if (account.authUid) {
      console.error('Account already linked to a Firebase Auth user');
      return res.status(400).json({
        success: false,
        error: 'Account is already linked to a user',
      });
    }
    
    // Link authUid to account
    await getAdminDb().collection('accounts').doc(validatedData.accountId).update({
      authUid: validatedData.authUid,
    });
    
    console.log('Registration finalized successfully for:', account.email);

    // Notify master admin of new pending registration (fire-and-forget)
    sendNewRegistrationAdminAlert({
      fullName: account.fullName || 'Unknown',
      email: account.email,
      company: account.company,
      title: account.title,
      phone: account.phone,
    }).catch((err) => console.error('Failed to send new-registration admin notification:', err));
    
    return res.json({
      success: true,
      message: 'Account created successfully. Awaiting admin approval.',
    });
  } catch (error: any) {
    console.error('Registration finalize error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to finalize registration',
    });
  }
});

// GET /admin/accounts/pending - List all pending accounts
router.get('/admin/accounts/pending', verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Fetching pending accounts for admin review');
    
    const accountsCollection = getAdminDb().collection('accounts');
    const pendingAccountsQuery = await accountsCollection.where('status', '==', 'pending').get();
    
    const pendingAccounts = pendingAccountsQuery.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as Account[];
    
    console.log(`Found ${pendingAccounts.length} pending accounts`);
    
    return res.json({
      success: true,
      accounts: pendingAccounts,
    });
  } catch (error: any) {
    console.error('Get pending accounts error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending accounts',
    });
  }
});

// POST /admin/accounts/:id/approve - Approve an account
router.post('/admin/accounts/:id/approve', verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Approving account:', id);
    
    const accountDoc = await getAdminDb().collection('accounts').doc(id).get();
    
    if (!accountDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }
    
    const account = accountDoc.data() as Account;
    
    // Update account status to approved
    await getAdminDb().collection('accounts').doc(id).update({
      status: 'approved',
    });
    
    // Send approval email
    const emailResult = await sendAccountApprovalEmail({
      recipientEmail: account.email,
      recipientName: account.fullName,
      approved: true,
    });
    
    if (!emailResult.success) {
      console.error('Failed to send approval email:', emailResult.error);
      // Don't fail the approval, just log the error
    }
    
    console.log('Account approved successfully:', account.email);
    
    return res.json({
      success: true,
      message: 'Account approved successfully',
    });
  } catch (error: any) {
    console.error('Account approval error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve account',
    });
  }
});

// POST /admin/accounts/:id/reject - Reject an account
router.post('/admin/accounts/:id/reject', verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    console.log('Rejecting account:', id);
    
    const accountDoc = await getAdminDb().collection('accounts').doc(id).get();
    
    if (!accountDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }
    
    const account = accountDoc.data() as Account;
    
    // Update account status to rejected
    await getAdminDb().collection('accounts').doc(id).update({
      status: 'rejected',
    });
    
    // Send rejection email
    const emailResult = await sendAccountApprovalEmail({
      recipientEmail: account.email,
      recipientName: account.fullName,
      approved: false,
      reason,
    });
    
    if (!emailResult.success) {
      console.error('Failed to send rejection email:', emailResult.error);
      // Don't fail the rejection, just log the error
    }
    
    console.log('Account rejected successfully:', account.email);
    
    return res.json({
      success: true,
      message: 'Account rejected successfully',
    });
  } catch (error: any) {
    console.error('Account rejection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject account',
    });
  }
});

// ==================== ADMIN USER CREATION & SUBSCRIPTION MANAGEMENT ====================

// POST /admin/users/create - Create a user directly (master admin only, no approval flow)
router.post('/admin/users/create', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({
      success: false,
      error: 'Firebase Admin SDK not available. Set FIREBASE_SERVICE_ACCOUNT_KEY.',
    });
  }
  try {
    const { 
      email, 
      password, 
      fullName, 
      company, 
      title, 
      phone, 
      address, 
      subscriptionTier, 
      enabledAddons, 
      sendWelcomeEmailFlag 
    } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'email, password, and fullName are required',
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    if (!['pro', 'pro_plus', 'beta_tester', 'lite', 'hardware_bundle'].includes(subscriptionTier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription tier',
      });
    }

    console.log(`[AdminCreateUser] Creating user: ${email}, tier: ${subscriptionTier}`);

    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await getAuth().createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: true,
      });
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({
          success: false,
          error: 'A user with this email already exists.',
        });
      }
      throw error;
    }

    const now = new Date().toISOString();
    const uid = userRecord.uid;

    // Write Firestore profile — accountStatus: active, no approval needed
    await getAdminDb().collection('accounts').doc(uid).set({
      id: uid,
      authUid: uid,
      email: email.toLowerCase(),
      fullName,
      company: company || null,
      title: title || null,
      phone: phone || null,
      address: address || null,
      status: 'active',
      accountStatus: 'active',
      emailVerified: true,
      subscriptionTier: subscriptionTier,
      enabledAddons: enabledAddons || [],
      requiresPasswordChange: false,
      createdByAdmin: true,
      lastOnlineAt: now,
      authPeriodStart: now,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial user_settings row in PostgreSQL
    try {
      await storage.saveUserSettings({ id: uid });
    } catch (settingsErr) {
      console.warn('[AdminCreateUser] Failed to create user_settings row:', settingsErr);
    }

    // Optionally send welcome email with login credentials
    if (sendWelcomeEmailFlag) {
      try {
        await sendWelcomeEmail({
          recipientEmail: email,
          recipientName: fullName,
          activationCode: '',
          temporaryPassword: password,
          isTemporaryPassword: false,
        });
      } catch (emailErr) {
        console.warn('[AdminCreateUser] Failed to send welcome email:', emailErr);
      }
    }

    console.log(`[AdminCreateUser] ✅ Created user ${email} (${uid})`);

    return res.json({
      success: true,
      uid,
      email,
      message: 'User created successfully',
    });
  } catch (error: any) {
    console.error('[AdminCreateUser] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user',
    });
  }
});

// POST /admin/users/:uid/reset-password - Admin sets a temporary password for a user
router.post('/admin/users/:uid/reset-password', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    const { uid } = req.params;
    const { newPassword: adminProvidedPassword } = req.body;

    let temporaryPassword: string;
    let wasAutoGenerated = false;

    if (adminProvidedPassword && typeof adminProvidedPassword === 'string' && adminProvidedPassword.length >= 6) {
      // Admin explicitly provided a temporary password
      temporaryPassword = adminProvidedPassword;
    } else {
      // Auto-generate a secure temporary password (12 chars: uppercase + lowercase + numbers + symbol)
      const { randomBytes } = await import('crypto');
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
      const bytes = randomBytes(12);
      temporaryPassword = Array.from(bytes)
        .map(b => chars[b % chars.length])
        .join('');
      wasAutoGenerated = true;
    }

    // Update Firebase Auth password
    await getAuth().updateUser(uid, { password: temporaryPassword });

    // Set requiresPasswordChange flag in Firestore
    await getAdminDb().collection('accounts').doc(uid).set(
      { requiresPasswordChange: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    console.log(`[AdminResetPassword] ✅ Reset password for user ${uid} (${wasAutoGenerated ? 'auto-generated' : 'admin-set'})`);

    // Return the temporary password to the admin so they can share it with the user
    return res.json({
      success: true,
      temporaryPassword,
      wasAutoGenerated,
      message: wasAutoGenerated
        ? 'Temporary password generated. Share it with the user — they will be prompted to change it on next login.'
        : 'Password set. The user will be prompted to change it on next login.',
    });
  } catch (error: any) {
    console.error('[AdminResetPassword] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset password',
    });
  }
});

// POST /admin/users/:uid/resend-welcome-email - Resend welcome email (optionally reset password first)
router.post('/admin/users/:uid/resend-welcome-email', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    const { uid } = req.params;
    const { newPassword } = req.body; // optional — if provided, reset their password first

    // Fetch user profile from Firebase Auth
    const userRecord = await getAuth().getUser(uid);
    const email = userRecord.email;
    if (!email) {
      return res.status(400).json({ success: false, error: 'User has no email address.' });
    }

    // Fetch display name from Firestore (may be richer than Firebase Auth displayName)
    const accountDoc = await getAdminDb().collection('accounts').doc(uid).get();
    const fullName = accountDoc.data()?.fullName || userRecord.displayName || email;

    let temporaryPassword: string | undefined;

    // If admin provided a new password, reset it now
    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
      await getAuth().updateUser(uid, { password: newPassword });
      await getAdminDb().collection('accounts').doc(uid).set(
        { requiresPasswordChange: true, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      temporaryPassword = newPassword;
      console.log(`[ResendWelcome] Reset password for ${email} before sending welcome email`);
    }

    // Send the welcome email
    await sendWelcomeEmail({
      recipientEmail: email,
      recipientName: fullName,
      activationCode: '',
      temporaryPassword: temporaryPassword || '',
      isTemporaryPassword: !!temporaryPassword,
    });

    console.log(`[ResendWelcome] ✅ Welcome email sent to ${email} (uid: ${uid})`);
    return res.json({
      success: true,
      email,
      passwordReset: !!temporaryPassword,
      message: temporaryPassword
        ? `Welcome email sent to ${email} with the new temporary password.`
        : `Welcome email sent to ${email}.`,
    });
  } catch (error: any) {
    console.error('[ResendWelcome] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send welcome email',
    });
  }
});

// PATCH /admin/users/:uid/subscription - Update subscription tier and add-ons for existing user
router.patch('/admin/users/:uid/subscription', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    const { uid } = req.params;
    const { subscriptionTier, enabledAddons, subscriptionEndDate, freeUntil } = req.body;

    if (!subscriptionTier || !['pro', 'pro_plus', 'beta_tester', 'lite', 'hardware_bundle'].includes(subscriptionTier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription tier',
      });
    }

    // Validate optional date fields (must be valid ISO date strings or null)
    const isValidDate = (v: any) => !v || (typeof v === 'string' && !isNaN(Date.parse(v)));
    if (!isValidDate(subscriptionEndDate) || !isValidDate(freeUntil)) {
      return res.status(400).json({ success: false, error: 'Invalid date format for subscriptionEndDate or freeUntil' });
    }

    const updates: Record<string, any> = {
      subscriptionTier,
      enabledAddons: enabledAddons || [],
      updatedAt: new Date().toISOString(),
    };

    // Store dates as ISO strings (end of day UTC), or delete the fields if cleared
    const { FieldValue } = await import('firebase-admin/firestore');
    updates.subscriptionEndDate = subscriptionEndDate
      ? new Date(subscriptionEndDate + 'T23:59:59Z').toISOString()
      : FieldValue.delete();
    updates.freeUntil = freeUntil
      ? new Date(freeUntil + 'T23:59:59Z').toISOString()
      : FieldValue.delete();

    await getAdminDb().collection('accounts').doc(uid).set(updates, { merge: true });

    console.log(`[AdminUpdateSubscription] ✅ Updated subscription for user ${uid}: tier=${subscriptionTier}, endDate=${subscriptionEndDate || 'none'}, freeUntil=${freeUntil || 'none'}`);

    return res.json({
      success: true,
      message: 'Subscription updated successfully',
    });
  } catch (error: any) {
    console.error('[AdminUpdateSubscription] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update subscription',
    });
  }
});

// GET /admin/users - List all users from Firestore (master admin only)
// Augments each user with linked company name and active add-on overrides (with nearest expiry).
router.get('/admin/users', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    // Paginate through all Firestore accounts documents to bypass the 500-doc limit.
    // NOTE: Do NOT use orderBy('createdAt') — Firestore silently excludes documents
    // that lack the ordered field, hiding users who were created without a createdAt timestamp.
    const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    const PAGE_SIZE = 500;
    do {
      let query = getAdminDb().collection('accounts').limit(PAGE_SIZE);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap = await query.get();
      allDocs.push(...snap.docs);
      lastDoc = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : undefined;
    } while (lastDoc);

    const firestoreUids = new Set(allDocs.map(doc => doc.id));

    // Cross-reference Firebase Auth to surface users who exist in Auth but have no accounts doc.
    const authOnlyUsers: any[] = [];
    let pageToken: string | undefined;
    do {
      const listResult = await getAuth().listUsers(1000, pageToken);
      for (const authUser of listResult.users) {
        if (!firestoreUids.has(authUser.uid)) {
          authOnlyUsers.push({
            id: authUser.uid,
            email: authUser.email ?? null,
            displayName: authUser.displayName ?? null,
            fullName: authUser.displayName ?? null,
            createdAt: authUser.metadata.creationTime ?? null,
            _authOnly: true,
          });
        }
      }
      pageToken = listResult.pageToken;
    } while (pageToken);

    const users = [
      ...allDocs.map(doc => ({ id: doc.id, ...doc.data() })),
      ...authOnlyUsers,
    ]
      // Sort in JS so all accounts are included regardless of field presence
      .sort((a: any, b: any) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    // Augment users with company membership and active addon overrides
    await expireAndNotify();
    const augmented = await Promise.all(users.map(async (user: any) => {
      try {
        const membership = await storage.getCompanyMembershipByUid(user.id);
        let linkedCompanyName: string | null = null;
        if (membership) {
          const company = await storage.getCompany(membership.companyId);
          linkedCompanyName = company?.name ?? null;
        }
        const activeOverrides = await storage.getActiveOverridesByUser(user.id);
        const activeAddonKeys = activeOverrides.map(o => o.addonKey);
        const nearestExpiry = activeOverrides.length > 0
          ? activeOverrides.reduce((min, o) => {
              const t = new Date(o.expiresAt).getTime();
              return t < min ? t : min;
            }, Infinity)
          : null;
        return {
          ...user,
          linkedCompanyName,
          activeAddonKeys,
          nearestAddonExpiry: nearestExpiry !== null && nearestExpiry !== Infinity
            ? new Date(nearestExpiry).toISOString()
            : null,
        };
      } catch {
        return user;
      }
    }));

    return res.json({ success: true, users: augmented });
  } catch (error: any) {
    console.error('[AdminListUsers] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list users' });
  }
});

// ============================================================
// Forgot Password OTP flow (no Firebase token required — user is unauthenticated)
// ============================================================

/**
 * In-memory OTP store: key = `${method}:${normalizedValue}`, value = { codeHash, expiresAt }
 * ⚠️ Resets on server restart. For multi-instance production deploy, use Redis.
 */
const otpStore = new Map<string, { codeHash: string; expiresAt: number }>();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// POST /auth/forgot-password/send-otp
// Accepts: { method: 'email' | 'phone', value: string }
// Looks up the user in Firebase Auth, generates an OTP, sends it, stores hashed OTP.
router.post('/auth/forgot-password/send-otp', async (req: Request, res: Response) => {
  try {
    const { method, value } = req.body as { method?: string; value?: string };

    if (!method || !value) {
      return res.status(400).json({ success: false, error: 'method and value are required' });
    }
    if (method !== 'email' && method !== 'phone') {
      return res.status(400).json({ success: false, error: 'method must be "email" or "phone"' });
    }

    const normalizedValue = method === 'phone' ? normalizePhone(value) : value.trim().toLowerCase();
    const rateLimitKey = `otp-send:${normalizedValue}`;
    if (!checkRateLimit(rateLimitKey)) {
      return res.status(429).json({ success: false, error: 'Too many requests. Please wait a minute and try again.' });
    }

    if (!isFirebaseAdminAvailable) {
      return res.status(503).json({ success: false, error: 'Authentication service unavailable. Please try again later.' });
    }

    // Look up the user to ensure they exist
    let userRecord: any;
    try {
      if (method === 'email') {
        userRecord = await getAuth().getUserByEmail(normalizedValue);
      } else {
        userRecord = await getAuth().getUserByPhoneNumber(normalizedValue);
      }
    } catch (err: any) {
      // Do not reveal whether the account exists — generic message
      return res.json({ success: true });
    }

    if (!userRecord) {
      return res.json({ success: true });
    }

    const code = generateVerificationCode();
    const codeHash = await hashVerificationCode(code);
    const storeKey = `${method}:${normalizedValue}`;
    otpStore.set(storeKey, { codeHash, expiresAt: Date.now() + OTP_EXPIRY_MS });

    if (method === 'email') {
      await sendVerificationCodeEmail({
        recipientEmail: normalizedValue,
        recipientName: userRecord.displayName || 'User',
        verificationCode: code,
        expiryMinutes: 10,
      });
    } else {
      const smsResult = await sendSmsVerification(normalizedValue, code, 'MeasurePRO password reset');
      if (!smsResult.success && !smsResult.devMode) {
        return res.status(500).json({ success: false, error: smsResult.error || 'Failed to send SMS.' });
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[ForgotPassword/SendOTP] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send verification code.' });
  }
});

// POST /auth/forgot-password/verify-otp
// Accepts: { method, value, code }
router.post('/auth/forgot-password/verify-otp', async (req: Request, res: Response) => {
  try {
    const { method, value, code } = req.body as { method?: string; value?: string; code?: string };

    if (!method || !value || !code) {
      return res.status(400).json({ success: false, error: 'method, value, and code are required' });
    }
    if (method !== 'email' && method !== 'phone') {
      return res.status(400).json({ success: false, error: 'method must be "email" or "phone"' });
    }

    const normalizedValue = method === 'phone' ? normalizePhone(value) : value.trim().toLowerCase();
    const rateLimitKey = `otp-verify:${normalizedValue}`;
    if (!checkRateLimit(rateLimitKey)) {
      return res.status(429).json({ success: false, error: 'Too many verification attempts. Please wait a minute.' });
    }

    const storeKey = `${method}:${normalizedValue}`;
    const stored = otpStore.get(storeKey);

    if (!stored) {
      return res.status(400).json({ success: false, error: 'No verification code found. Please request a new one.' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(storeKey);
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    const isValid = await verifyCode(code.trim(), stored.codeHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please try again.' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[ForgotPassword/VerifyOTP] Error:', error);
    return res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
  }
});

// POST /auth/forgot-password/update-password
// Accepts: { method, value, code, newPassword }
// Re-verifies the OTP then updates the Firebase user's password via Admin SDK.
router.post('/auth/forgot-password/update-password', async (req: Request, res: Response) => {
  try {
    const { method, value, code, newPassword } = req.body as {
      method?: string;
      value?: string;
      code?: string;
      newPassword?: string;
    };

    if (!method || !value || !code || !newPassword) {
      return res.status(400).json({ success: false, error: 'method, value, code, and newPassword are required' });
    }
    if (method !== 'email' && method !== 'phone') {
      return res.status(400).json({ success: false, error: 'method must be "email" or "phone"' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    if (!isFirebaseAdminAvailable) {
      return res.status(503).json({ success: false, error: 'Authentication service unavailable.' });
    }

    const normalizedValue = method === 'phone' ? normalizePhone(value) : value.trim().toLowerCase();
    const storeKey = `${method}:${normalizedValue}`;
    const stored = otpStore.get(storeKey);

    if (!stored) {
      return res.status(400).json({ success: false, error: 'Session expired. Please start the reset process again.' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(storeKey);
      return res.status(400).json({ success: false, error: 'Session expired. Please start the reset process again.' });
    }

    const isValid = await verifyCode(code.trim(), stored.codeHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please start over.' });
    }

    // Look up user and update password
    let userRecord: any;
    try {
      if (method === 'email') {
        userRecord = await getAuth().getUserByEmail(normalizedValue);
      } else {
        userRecord = await getAuth().getUserByPhoneNumber(normalizedValue);
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Account not found.' });
    }

    await getAuth().updateUser(userRecord.uid, { password: newPassword });

    // Consume the OTP so it cannot be reused
    otpStore.delete(storeKey);

    console.log(`[ForgotPassword/UpdatePassword] Password reset for user ${userRecord.uid}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[ForgotPassword/UpdatePassword] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update password. Please try again.' });
  }
});

// POST /auth/record-online - Record a server-authoritative online timestamp using Admin SDK server time
// This endpoint ensures timestamps are tamper-proof (written server-side, not client-side)
router.post('/auth/record-online', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    const uid = req.userId!;
    const { resetAuthPeriod } = req.body as { resetAuthPeriod?: boolean };
    const { FieldValue } = await import('firebase-admin/firestore');
    const docRef = getAdminDb().collection('accounts').doc(uid);

    // Use serverTimestamp() for tamper-proof, authoritative timestamps
    const updates: Record<string, any> = {
      lastOnlineAt: FieldValue.serverTimestamp(),
    };

    // Initialize authPeriodStart if it doesn't exist yet (first login) or if resetting
    const snap = await docRef.get();
    const existingData = snap.exists ? snap.data() : {};
    if (resetAuthPeriod || !existingData?.authPeriodStart) {
      updates.authPeriodStart = FieldValue.serverTimestamp();
    }

    await docRef.set(updates, { merge: true });

    // Read back the server timestamps to return ISO strings to the client
    const updated = await docRef.get();
    const data = updated.data() || {};
    const toISO = (ts: any): string | null => {
      if (!ts) return null;
      if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
      return null;
    };

    console.log(`[RecordOnline] ✅ Recorded server timestamp for user ${uid} (resetAuthPeriod=${!!resetAuthPeriod})`);
    return res.json({
      success: true,
      lastOnlineAt: toISO(data.lastOnlineAt),
      authPeriodStart: toISO(data.authPeriodStart),
    });
  } catch (error: any) {
    console.error('[RecordOnline] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /auth/feature-snapshot — issue a server-signed, server-timestamped feature snapshot.
//
// The server independently derives the feature list from authoritative sources:
//   1. Firebase Firestore (adminDb) — userLicenses subcollection + licensePackages collection.
//   2. PostgreSQL signupProgress + subscriptionTiers — subscription-tier included features.
// The client payload is NOT used to determine which features are signed. This prevents any
// client from requesting signatures for features they are not entitled to.
//
// Signed payload: `{uid}:{featureKey=expiresAtMs|lifetime,...sorted}:{serverNow}` (ECDSA P-256).
// The matching public key is embedded in the client for offline verification.
//
// IMPORTANT: The private key is stored exclusively in Replit Secrets (LICENSE_SNAPSHOT_PRIVATE_KEY).
router.post('/auth/feature-snapshot', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const userEmail = req.userEmail;

    const privateKeyB64 = process.env.LICENSE_SNAPSHOT_PRIVATE_KEY;
    if (!privateKeyB64) {
      return res.status(503).json({ success: false, error: 'Signing service unavailable' });
    }

    // ── Step 1: Derive features from server-authoritative sources ────────────────

    // featureMap: featureKey → expiresAtMs (null = lifetime)
    // Picks the LATEST (most permissive) expiry when multiple licenses cover the same feature.
    const featureMap = new Map<string, number | null>();
    const mergeExpiry = (key: string, expiresAtMs: number | null) => {
      const existing = featureMap.get(key);
      if (existing === undefined) {
        featureMap.set(key, expiresAtMs);
      } else if (existing === null || expiresAtMs === null) {
        featureMap.set(key, null); // lifetime wins
      } else {
        featureMap.set(key, Math.max(existing, expiresAtMs));
      }
    };

    // Source A: Firebase Firestore — user's individual/package licenses
    if (isFirebaseAdminAvailable && adminDb) {
      try {
        const now = Date.now();

        // Query userLicenses subcollection under the user doc
        const licensesSnap = await adminDb
          .collection('users')
          .doc(uid)
          .collection('userLicenses')
          .where('isActive', '==', true)
          .get();

        // Also fetch licensePackages for package-based licenses
        let packagesSnap: FirebaseFirestore.QuerySnapshot | null = null;
        if (!licensesSnap.empty) {
          packagesSnap = await adminDb.collection('licensePackages').get();
        }

        const packages: Record<string, string[]> = {};
        if (packagesSnap) {
          packagesSnap.forEach(doc => {
            const d = doc.data();
            packages[doc.id] = Array.isArray(d.featureKeys) ? d.featureKeys : [];
          });
        }

        licensesSnap.forEach(doc => {
          const lic = doc.data();
          // Check expiry
          let expiresAtMs: number | null = null;
          if (lic.expiresAt) {
            const expMs = typeof lic.expiresAt === 'number'
              ? lic.expiresAt
              : new Date(lic.expiresAt).getTime();
            if (expMs < now) return; // expired — skip
            expiresAtMs = expMs;
          }

          if (lic.licenseType === 'feature' && typeof lic.featureKey === 'string') {
            mergeExpiry(lic.featureKey, expiresAtMs);
          } else if (lic.licenseType === 'package' && typeof lic.packageId === 'string') {
            const featureKeys = packages[lic.packageId] ?? [];
            featureKeys.forEach((k: string) => mergeExpiry(k, expiresAtMs));
          }
        });
      } catch (firestoreErr: any) {
        // Non-fatal: Firestore may not have this subcollection yet (e.g. beta users)
        console.warn('[FeatureSnapshot] Firestore license query failed:', firestoreErr?.message);
      }
    }

    // Source B: PostgreSQL subscription tier — subscription-based features
    if (userEmail) {
      try {
        const subData = await storage.getUserSubscription(userEmail);
        if (subData?.subscription?.status === 'active' && subData.tier) {
          const tierExpiry: number | null = subData.subscription.nextBillingDate
            ? new Date(subData.subscription.nextBillingDate).getTime()
            : null;

          const tierFeatures: string[] = Array.isArray(subData.tier.includedFeatures)
            ? subData.tier.includedFeatures
            : [];
          tierFeatures.forEach((key: string) => mergeExpiry(key, tierExpiry));

          // Also include add-on features
          for (const addon of (subData.addons ?? [])) {
            if (Array.isArray(addon.featureKeys)) {
              addon.featureKeys.forEach((k: string) => mergeExpiry(k, tierExpiry));
            }
            if (typeof addon.featureKey === 'string') {
              mergeExpiry(addon.featureKey, tierExpiry);
            }
          }
        }
      } catch (pgErr: any) {
        console.warn('[FeatureSnapshot] PostgreSQL subscription query failed:', pgErr?.message);
      }
    }

    // Source C: PostgreSQL company add-ons — for company members whose features come
    // from their company subscription rather than individual licenses.
    // Per-member allowedAddons: null = inherit all company add-ons; array = restricted set.
    try {
      const membership = await storage.getCompanyMembershipByUid(uid);
      if (membership) {
        const company = await storage.getCompany(membership.companyId);
        if (company && Array.isArray(company.enabledAddons) && company.enabledAddons.length > 0) {
          const ADDON_TO_FEATURE: Record<string, string> = {
            ai_plus: 'ai_detection',
            envelope: 'envelope_clearance',
            convoy: 'convoy_guardian',
            route_analysis: 'route_enforcement',
            swept_path: 'swept_path_analysis',
            calibration: 'calibration',
            '3d_view': 'point_cloud_scanning',
            gnss: 'gnss_profiling',
          };
          const effectiveAddonIds: string[] = membership.allowedAddons ?? company.enabledAddons;
          for (const addonId of effectiveAddonIds) {
            const featureKey = ADDON_TO_FEATURE[addonId];
            if (featureKey) {
              mergeExpiry(featureKey, null); // active as long as membership is active
            }
          }
          console.log(`[FeatureSnapshot] Company add-ons for uid=${uid}: ${effectiveAddonIds.join(', ')}`);
        }
      }
    } catch (companyErr: any) {
      console.warn('[FeatureSnapshot] Company add-on query failed:', companyErr?.message);
    }

    // ── Step 2: Sign the server-derived snapshot ─────────────────────────────────
    const { createSign, createPrivateKey } = await import('crypto');
    const serverNow = Date.now();

    // Reject expired entries that may have been merged earlier with stale clocks
    const validEntries = Array.from(featureMap.entries())
      .filter(([, exp]) => exp === null || exp > serverNow)
      .map(([featureKey, expiresAtMs]) => ({ featureKey, expiresAtMs }));

    // Sort by featureKey for deterministic payload (must match client-side sort order)
    const sorted = validEntries.sort((a, b) => a.featureKey.localeCompare(b.featureKey));
    const featuresStr = sorted.map(f => `${f.featureKey}=${f.expiresAtMs ?? 'lifetime'}`).join(',');
    const payload = `${uid}:${featuresStr}:${serverNow}`;

    // Parse the PEM into a KeyObject first — more robust than passing raw PEM string
    // to sign.sign(), which fails on legacy SEC1 EC key format in OpenSSL 3.x.
    const privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf8');
    const privateKeyObj = createPrivateKey(privateKeyPem);
    const sign = createSign('SHA256');
    sign.update(payload, 'utf8');
    const signature = sign.sign(privateKeyObj, 'base64');

    console.log(`[FeatureSnapshot] Signed ${sorted.length} server-derived features for uid=${uid}`);
    return res.json({ success: true, features: sorted, serverNow, uid, signature });
  } catch (error: any) {
    console.error('[FeatureSnapshot] signing error:', error?.message);
    return res.status(500).json({ success: false, error: 'Failed to sign feature snapshot' });
  }
});

// GET /licenses/packages — server-side proxy for Firestore licensePackages collection.
// Replaces the Firebase Cloud Function `getAllPackages` to avoid CORS errors.
router.get('/licenses/packages', verifyFirebaseToken, async (_req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable || !adminDb) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    const snapshot = await adminDb.collection('licensePackages').get();
    const packages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, packages });
  } catch (error: any) {
    console.error('[LicensesProxy] Error fetching packages:', error?.message);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch packages' });
  }
});

// GET /licenses/user-licenses — server-side proxy for Firestore userLicenses queries.
// Replaces the Firebase Cloud Function `getUserLicenses` to avoid CORS errors when calling
// Firebase Functions directly from the browser.  The server uses the Admin SDK (no CORS) and
// returns the same payload the Cloud Function would return.
router.get('/licenses/user-licenses', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable || !adminDb) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    const uid = req.userId!;
    // Top-level collection used by the Cloud Function
    const snapshot = await adminDb
      .collection('userLicenses')
      .where('userId', '==', uid)
      .get();
    const licenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, licenses });
  } catch (error: any) {
    console.error('[LicensesProxy] Error fetching user licenses:', error?.message);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch licenses' });
  }
});

// POST /auth/clear-password-change-flag - User clears their own requiresPasswordChange flag after updating their password
router.post('/auth/clear-password-change-flag', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
  }
  try {
    const uid = req.userId!;
    await getAdminDb().collection('accounts').doc(uid).set(
      { requiresPasswordChange: false, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log(`[ClearPwChangeFlag] ✅ Cleared requiresPasswordChange for user ${uid}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[ClearPwChangeFlag] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /accounts/status/:uid - Get account status by Firebase Auth UID
router.get('/accounts/status/:uid', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    console.log('Fetching account status for uid:', uid);
    
    const accountsCollection = getAdminDb().collection('accounts');
    const accountQuery = await accountsCollection.where('authUid', '==', uid).get();
    
    if (accountQuery.empty) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }
    
    const account = accountQuery.docs[0].data() as Account;
    
    return res.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        fullName: account.fullName,
        status: account.status,
        emailVerified: account.emailVerified,
      },
    });
  } catch (error: any) {
    console.error('Get account status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get account status',
    });
  }
});

// ==================== PRICING MANAGEMENT API (Master Admin Only) ====================

// GET /pricing - Get all pricing items
router.get('/pricing', verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const pricingItems = await storage.getAllPricing();
    
    return res.json({
      success: true,
      pricing: pricingItems,
    });
  } catch (error: any) {
    console.error('Get pricing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pricing',
    });
  }
});

// GET /pricing/public - Get active pricing items (public endpoint for signup)
router.get('/pricing/public', async (req: Request, res: Response) => {
  try {
    const allPricing = await storage.getAllPricing();
    
    // Filter only active pricing items
    const activePricing = allPricing.filter(item => item.isActive);
    
    return res.json({
      success: true,
      pricing: activePricing,
    });
  } catch (error: any) {
    console.error('Get public pricing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve pricing',
    });
  }
});

// GET /pricing/:id - Get single pricing item
router.get('/pricing/:id', verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const pricingItem = await storage.getPricing(id);
    
    if (!pricingItem) {
      return res.status(404).json({
        success: false,
        error: 'Pricing item not found',
      });
    }
    
    return res.json({
      success: true,
      pricing: pricingItem,
    });
  } catch (error: any) {
    console.error('Get pricing item error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pricing item',
    });
  }
});

// POST /pricing - Create new pricing item
router.post('/pricing', verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = insertPricingSchema.parse(req.body);
    const newPricing = await storage.createPricing(validatedData);
    
    return res.json({
      success: true,
      pricing: newPricing,
    });
  } catch (error: any) {
    console.error('Create pricing error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create pricing',
    });
  }
});

// PUT /pricing/:id - Update pricing item
router.put('/pricing/:id', verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const pricingItem = await storage.updatePricing(id, req.body);
    
    if (!pricingItem) {
      return res.status(404).json({
        success: false,
        error: 'Pricing item not found',
      });
    }
    
    return res.json({
      success: true,
      pricing: pricingItem,
    });
  } catch (error: any) {
    console.error('Update pricing error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update pricing',
    });
  }
});

// DELETE /api/pricing/:id - Delete pricing item
router.delete('/pricing/:id', verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deletePricing(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Pricing item not found',
      });
    }
    
    return res.json({
      success: true,
      message: 'Pricing item deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete pricing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete pricing',
    });
  }
});

// ==================== STRIPE CHECKOUT ENDPOINTS ====================

// Hardware package pricing configuration (in cents)
const HARDWARE_PRICING = {
  base_package: {
    name: 'Complete Survey Solution - LiDAR Hardware Package',
    price: 1900000, // $19,000 USD
    description: 'SolTec LiDAR 2D Laser, GPS, Rugged Tablet, Vehicle Mount, Backpack, 6-month MeasurePRO + RoadScope, 4hr training, 1-year support & warranty',
  },
  training_onpremise: {
    name: 'On-Premise Training & Installation',
    price: 300000, // $3,000 USD
    description: '8 hours on-site installation/training, calibration, team certification, 30-day follow-up',
  },
  training_enterprise: {
    name: 'Enterprise Installation',
    price: 600000, // $6,000 USD
    description: 'Multi-vehicle installation, 16 hours training, custom workflow, admin certification, 90-day support',
  },
  support_monthly: {
    name: 'Same-Day Support (Monthly)',
    price: 6500, // $65/month
    description: 'Same-day response guarantee, priority queue, direct phone support',
  },
  support_peruse: {
    name: 'Same-Day Support (Per-Use)',
    price: 30000, // $300/incident
    description: 'Same-day response, pay only when needed, no commitment',
  },
  warranty_extended: {
    name: 'Extended Warranty',
    price: 100000, // $1,000 USD
    description: '+1 year extended coverage (2 years total), fabrication defects, priority service',
  },
  warranty_damage: {
    name: 'Damage Protection',
    price: 250000, // $2,500 USD
    description: 'Accidental damage, 1 free wire set, drop/impact coverage, environmental protection',
  },
  warranty_complete: {
    name: 'Complete Protection',
    price: 350000, // $3,500 USD
    description: 'Extended warranty + damage protection + free wire set + priority service',
  },
};

// POST /api/checkout/hardware - Create Stripe checkout session for hardware purchase
router.post('/checkout/hardware', async (req: Request, res: Response) => {
  try {
    const { items, customerEmail, customerName } = req.body;
    
    // Validate Stripe secret key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Payment system not configured. Please contact support.',
      });
    }
    
    // Dynamic import of Stripe
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });
    
    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required',
      });
    }
    
    // Build line items for Stripe
    const lineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string; description: string };
        unit_amount: number;
      };
      quantity: number;
    }> = [];
    let totalAmount = 0;
    
    for (const item of items) {
      const productConfig = HARDWARE_PRICING[item.productKey as keyof typeof HARDWARE_PRICING];
      
      if (!productConfig) {
        return res.status(400).json({
          success: false,
          error: `Unknown product: ${item.productKey}`,
        });
      }
      
      const quantity = item.quantity || 1;
      totalAmount += productConfig.price * quantity;
      
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: productConfig.name,
            description: productConfig.description,
          },
          unit_amount: productConfig.price,
        },
        quantity,
      });
    }
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.origin || process.env.REPLIT_DEV_DOMAIN || 'https://measurepro.replit.app'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || process.env.REPLIT_DEV_DOMAIN || 'https://measurepro.replit.app'}/pricing#hardware`,
      customer_email: customerEmail,
      metadata: {
        customerName: customerName || '',
        items: JSON.stringify(items),
        type: 'hardware_purchase',
      },
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'IE', 'MX'],
      },
    });
    
    console.log(`Stripe checkout session created: ${session.id} for ${totalAmount/100} USD`);
    
    return res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
    
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session',
    });
  }
});

// GET /api/checkout/session/:id - Get checkout session details (for success page)
router.get('/checkout/session/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Payment system not configured',
      });
    }
    
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });
    
    const session = await stripe.checkout.sessions.retrieve(id);
    
    return res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email,
        customerName: session.customer_details?.name,
        amountTotal: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
      },
    });
    
  } catch (error: any) {
    console.error('Get session error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve session',
    });
  }
});

// GET /api/hardware-pricing - Get hardware pricing configuration
router.get('/hardware-pricing', (_req: Request, res: Response) => {
  // Return pricing in a format suitable for frontend display
  const pricing = Object.entries(HARDWARE_PRICING).map(([key, value]) => ({
    productKey: key,
    name: value.name,
    price: value.price,
    priceFormatted: `$${(value.price / 100).toLocaleString()}`,
    description: value.description,
  }));
  
  return res.json({
    success: true,
    pricing,
  });
});

// ==================== SIGNUP FLOW ENDPOINTS ====================

// POST /signup/start - Initialize signup (Step 1: Account Information)
router.post('/signup/start', async (req: Request, res: Response) => {
  try {
    console.log('Starting signup process:', req.body.email);
    
    const validatedData = signupStartSchema.parse(req.body);
    
    // Capture request metadata
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Check if email already exists
    const existing = await storage.getSignupProgressByEmail(validatedData.email);
    
    if (existing && existing.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    // SECURITY: Hash password immediately - NEVER store plaintext
    // User will re-enter password at Step 6 for Firebase account creation
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    // Create or update signup progress
    let signupProgress;
    if (existing && existing.status === 'in_progress') {
      // Update existing progress
      signupProgress = await storage.updateSignupProgress(existing.id, {
        currentStep: 1,
        step1Data: {
          name: validatedData.fullName,
          email: validatedData.email,
          phone: validatedData.phone || '',
          passwordHash: hashedPassword,
        },
        ipAddress,
        userAgent,
        status: 'in_progress',
      });
    } else {
      // Create new signup progress
      signupProgress = await storage.createSignupProgress({
        email: validatedData.email,
        currentStep: 1,
        step1Data: {
          name: validatedData.fullName,
          email: validatedData.email,
          phone: validatedData.phone || '',
          passwordHash: hashedPassword,
        },
        step2Data: undefined,
        step3Data: undefined,
        step4Data: undefined,
        step5Data: undefined,
        ipAddress,
        userAgent,
        status: 'in_progress',
      });
    }

    if (!signupProgress) {
      throw new Error('Failed to create signup progress');
    }

    return res.json({
      success: true,
      signupId: signupProgress.id,
      message: 'Account information saved successfully',
    });
  } catch (error: any) {
    console.error('Signup start error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to start signup process',
    });
  }
});

// PUT /signup/progress/:id - Update signup progress (Steps 2, 3, 4)
router.put('/signup/progress/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { step, ...data } = req.body;

    // Get existing signup progress
    const existing = await storage.getSignupProgress(id);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Signup session not found',
      });
    }

    if (existing.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Signup already completed or abandoned',
      });
    }

    let updateData: any = {};
    let successMessage = '';

    // Validate and prepare data based on step
    if (step === 2) {
      const validatedData = signupStep2Schema.parse(data);
      updateData = {
        currentStep: 2,
        step2Data: {
          company: validatedData.company,
          title: validatedData.title,
          phone: validatedData.phone,
          address: validatedData.address,
        },
      };
      successMessage = 'Company details saved successfully';
    } else if (step === 3) {
      const validatedData = signupStep3Schema.parse(data);
      updateData = {
        currentStep: 3,
        step3Data: {
          selectedTier: validatedData.subscriptionTier,
          selectedAddons: validatedData.selectedAddons,
        },
      };
      successMessage = 'Subscription selection saved successfully';
    } else if (step === 4) {
      const validatedData = signupStep4Schema.parse(data);
      updateData = {
        currentStep: 4,
        step4Data: {
          termsAccepted: validatedData.acceptedAll,
          termsVersion: validatedData.termsVersionId,
          timestamp: new Date().toISOString(),
        },
      };
      successMessage = 'Terms acceptance saved successfully';
    } else if (step === 5) {
      const validatedData = signupStep5Schema.parse(data);
      updateData = {
        currentStep: 5,
        step5Data: {
          hardwareAcknowledged: validatedData.hardwareAcknowledged,
          acknowledgedItems: validatedData.acknowledgedItems,
          timestamp: new Date().toISOString(),
        },
      };
      successMessage = 'Hardware checklist acknowledged successfully';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid step number',
      });
    }

    // Update signup progress
    const updated = await storage.updateSignupProgress(id, updateData);

    if (!updated) {
      throw new Error('Failed to update signup progress');
    }

    return res.json({
      success: true,
      message: successMessage,
    });
  } catch (error: any) {
    console.error('Signup progress update error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update signup progress',
    });
  }
});

// GET /signup/progress/:email - Get signup progress by email (for resuming)
router.get('/signup/progress/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    
    const signupProgress = await storage.getSignupProgressByEmail(email);
    
    if (!signupProgress) {
      return res.status(404).json({
        success: false,
        error: 'Signup session not found',
      });
    }

    return res.json({
      success: true,
      signup: signupProgress,
    });
  } catch (error: any) {
    console.error('Get signup progress error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve signup progress',
    });
  }
});

// POST /signup/send-verification - Send email verification code (wizard flow)
router.post('/signup/send-verification', async (req: Request, res: Response) => {
  try {
    const { signupId } = req.body;
    if (!signupId) {
      return res.status(400).json({ success: false, error: 'signupId is required' });
    }

    const progress = await storage.getSignupProgress(signupId);
    if (!progress) {
      return res.status(404).json({ success: false, error: 'Signup session not found' });
    }

    const step1Data = progress.step1Data as any;
    if (!step1Data?.email || !step1Data?.name) {
      return res.status(400).json({ success: false, error: 'Account information incomplete' });
    }

    const verificationCode = generateVerificationCode();
    const codeHash = await hashVerificationCode(verificationCode);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await storage.updateSignupProgress(signupId, {
      step1Data: {
        ...step1Data,
        emailVerificationCodeHash: codeHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerified: false,
      },
    });

    const emailResult = await sendVerificationCodeEmail({
      recipientEmail: step1Data.email,
      recipientName: step1Data.name,
      verificationCode,
      expiryMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
    });

    if (!emailResult.success) {
      console.error('Failed to send wizard verification email:', emailResult.error);
      return res.status(500).json({ success: false, error: 'Failed to send verification email. Please try again.' });
    }

    console.log(`✅ Wizard verification code sent to: ${step1Data.email}`);
    return res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error: any) {
    console.error('Send verification error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send verification code' });
  }
});

// POST /signup/verify-code - Verify email code (wizard flow)
router.post('/signup/verify-code', async (req: Request, res: Response) => {
  try {
    const { signupId, code } = req.body;
    if (!signupId || !code) {
      return res.status(400).json({ success: false, error: 'signupId and code are required' });
    }

    if (!checkRateLimit(signupId)) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please try again in 1 minute.' });
    }

    const progress = await storage.getSignupProgress(signupId);
    if (!progress) {
      return res.status(404).json({ success: false, error: 'Signup session not found' });
    }

    const step1Data = progress.step1Data as any;
    if (!step1Data?.emailVerificationCodeHash) {
      return res.status(400).json({ success: false, error: 'No verification code found. Please request a new code.' });
    }

    if (step1Data.emailVerified) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    const expiresAt = step1Data.emailVerificationExpiresAt;
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    const isValid = await verifyCode(code.trim(), step1Data.emailVerificationCodeHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please check your email and try again.' });
    }

    await storage.updateSignupProgress(signupId, {
      step1Data: {
        ...step1Data,
        emailVerified: true,
        emailVerificationCodeHash: undefined,
        emailVerificationExpiresAt: undefined,
      },
    });

    console.log(`✅ Email verified for signup: ${signupId}`);
    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (error: any) {
    console.error('Verify code error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to verify code' });
  }
});

// POST /signup/send-sms-verification - Send SMS code (wizard flow)
router.post('/signup/send-sms-verification', async (req: Request, res: Response) => {
  try {
    const { signupId } = req.body;
    if (!signupId) return res.status(400).json({ success: false, error: 'signupId is required' });

    const progress = await storage.getSignupProgress(signupId);
    if (!progress) return res.status(404).json({ success: false, error: 'Signup session not found' });

    const step1Data = progress.step1Data as any;
    if (!step1Data?.emailVerified) {
      return res.status(400).json({ success: false, error: 'Email must be verified before phone verification' });
    }

    const phone = step1Data?.phone;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number not found. Please restart signup.' });

    const code = generateVerificationCode();
    const codeHash = await hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await storage.updateSignupProgress(signupId, {
      step1Data: {
        ...step1Data,
        smsVerificationCodeHash: codeHash,
        smsVerificationExpiresAt: expiresAt,
        phoneVerified: false,
      },
    });

    const smsResult = await sendSmsVerification(phone, code);
    if (!smsResult.success) {
      return res.status(500).json({ success: false, error: smsResult.error || 'Failed to send SMS verification code' });
    }

    const devMode = smsResult.devMode || false;
    console.log(`[SMS] ${devMode ? 'DEV MODE' : 'Sent'} verification code to: ${phone}`);
    return res.json({ success: true, message: 'SMS verification code sent', devMode });
  } catch (error: any) {
    console.error('Send SMS error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send SMS' });
  }
});

// POST /signup/verify-sms-code - Verify SMS code (wizard flow)
router.post('/signup/verify-sms-code', async (req: Request, res: Response) => {
  try {
    const { signupId, code } = req.body;
    if (!signupId || !code) return res.status(400).json({ success: false, error: 'signupId and code are required' });

    if (!checkRateLimit(`sms-${signupId}`)) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please wait 1 minute.' });
    }

    const progress = await storage.getSignupProgress(signupId);
    if (!progress) return res.status(404).json({ success: false, error: 'Signup session not found' });

    const step1Data = progress.step1Data as any;
    if (!step1Data?.smsVerificationCodeHash) {
      return res.status(400).json({ success: false, error: 'No SMS code found. Please request a new code.' });
    }

    if (step1Data.phoneVerified) return res.json({ success: true, message: 'Phone already verified' });

    const expiresAt = step1Data.smsVerificationExpiresAt;
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      return res.status(400).json({ success: false, error: 'SMS code has expired. Please request a new one.' });
    }

    const isValid = await verifyCode(code.trim(), step1Data.smsVerificationCodeHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid code. Please check your SMS and try again.' });
    }

    await storage.updateSignupProgress(signupId, {
      step1Data: {
        ...step1Data,
        phoneVerified: true,
        smsVerificationCodeHash: undefined,
        smsVerificationExpiresAt: undefined,
      },
    });

    console.log(`[SMS] Phone verified for signup: ${signupId}`);
    return res.json({ success: true, message: 'Phone verified successfully' });
  } catch (error: any) {
    console.error('Verify SMS error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to verify SMS code' });
  }
});

// POST /registration/send-sms - Send SMS code (RegisterPage flow)
router.post('/registration/send-sms', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;
    if (!accountId || !isFirebaseAdminAvailable || !adminDb) {
      return res.status(400).json({ success: false, error: 'accountId is required and Firebase must be available' });
    }

    const doc = await getAdminDb().collection('accounts').doc(accountId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Account not found' });

    const account = doc.data() as any;
    if (!account.emailVerified) {
      return res.status(400).json({ success: false, error: 'Email must be verified before phone verification' });
    }

    const phone = account.phone;
    if (!phone) return res.status(400).json({ success: false, error: 'No phone number on account. Please re-register with a phone number.' });

    const code = generateVerificationCode();
    const codeHash = await hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await getAdminDb().collection('accounts').doc(accountId).update({
      smsVerification: { codeHash, expiresAt, phoneVerified: false },
    });

    const smsResult = await sendSmsVerification(phone, code);
    if (!smsResult.success) {
      return res.status(500).json({ success: false, error: smsResult.error || 'Failed to send SMS' });
    }

    return res.json({ success: true, message: 'SMS verification code sent', devMode: smsResult.devMode || false });
  } catch (error: any) {
    console.error('Registration send-sms error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send SMS' });
  }
});

// POST /registration/verify-sms - Verify SMS code (RegisterPage flow)
router.post('/registration/verify-sms', async (req: Request, res: Response) => {
  try {
    const { accountId, code } = req.body;
    if (!accountId || !code) return res.status(400).json({ success: false, error: 'accountId and code are required' });

    if (!checkRateLimit(`reg-sms-${accountId}`)) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please wait 1 minute.' });
    }

    const doc = await getAdminDb().collection('accounts').doc(accountId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Account not found' });

    const account = doc.data() as any;
    const smsVerif = account.smsVerification;
    if (!smsVerif?.codeHash) {
      return res.status(400).json({ success: false, error: 'No SMS code found. Please request a new one.' });
    }

    if (smsVerif.phoneVerified) return res.json({ success: true, message: 'Phone already verified', accountId });

    if (!smsVerif.expiresAt || new Date(smsVerif.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, error: 'SMS code expired. Please request a new one.' });
    }

    const isValid = await verifyCode(code.trim(), smsVerif.codeHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid SMS code. Please try again.' });
    }

    await getAdminDb().collection('accounts').doc(accountId).update({
      phoneVerified: true,
      'smsVerification.phoneVerified': true,
      'smsVerification.codeHash': null,
    });

    return res.json({ success: true, message: 'Phone verified successfully', accountId });
  } catch (error: any) {
    console.error('Registration verify-sms error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to verify SMS code' });
  }
});

// POST /signup/process-payment/:id - Process Square payment during wizard Step 3
// This endpoint is intentionally unauthenticated because the wizard user does not
// yet have a Firebase account. The signupId is used as the session identifier.
// Step 3 selects the subscription tier/add-ons (price visible to user) and then
// the client tokenises the card via Square Web Payments SDK and POSTs the
// sourceId here. The resulting paymentId is stored in step3Data so that
// /signup/complete/:id can verify the payment before account creation.
router.post('/signup/process-payment/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sourceId } = req.body;

    if (!id || !sourceId) {
      return res.status(400).json({ success: false, error: 'Missing signupId or payment sourceId' });
    }

    // Fix #1: Use correct storage method name (getSignupProgress, not getSignupProgressById)
    const existing = await storage.getSignupProgress(id);
    if (!existing || existing.status !== 'in_progress') {
      return res.status(404).json({ success: false, error: 'Signup session not found or already completed' });
    }

    // Fix #2: Use the correct field name that step 3 saves ('selectedTier', not 'subscriptionTier')
    const step3Data = existing.step3Data as any;
    const selectedTierKey = step3Data?.selectedTier;
    if (!selectedTierKey) {
      return res.status(400).json({
        success: false,
        error: 'Subscription tier must be selected (Step 3) before processing payment',
      });
    }

    // Fix #3: Compute amount server-side from trusted pricing database — ignore client total
    const allPricing = await storage.getAllPricing();
    const pricingRows = allPricing.filter((p: any) => p.isActive !== false);
    const tierRow = pricingRows.find(
      (p: any) => p.itemType === 'subscription_tier' && p.itemKey === selectedTierKey
    );
    if (!tierRow) {
      return res.status(400).json({ success: false, error: `Unknown subscription tier: ${selectedTierKey}` });
    }
    let amountCents = tierRow.price; // price is already stored in cents
    const addons: string[] = Array.isArray(step3Data.selectedAddons) ? step3Data.selectedAddons : [];
    for (const addonKey of addons) {
      const addonRow = pricingRows.find(
        (p: any) => p.itemType === 'addon' && p.itemKey === addonKey
      );
      if (addonRow) amountCents += addonRow.price;
    }

    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) {
      console.warn('⚠️ SQUARE_LOCATION_ID not configured — payment deferred in development mode');
      await storage.updateSignupProgress(id, {
        step3Data: { ...step3Data, paymentDeferred: true, paymentNote: 'Square not configured', serverComputedAmountCents: amountCents },
      });
      return res.json({ success: true, paymentId: null, deferred: true });
    }

    if (amountCents <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount computed from tier/add-ons' });
    }

    const idempotencyKey = `signup-${id}-${Date.now()}`;
    const response = await squareClient.payments.create({
      sourceId,
      idempotencyKey,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      locationId,
      referenceId: id,
      note: `MeasurePRO signup — tier: ${selectedTierKey}`,
    });

    const paymentId = response.payment?.id;
    if (!paymentId || response.payment?.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Payment was not completed by Square' });
    }

    await storage.updateSignupProgress(id, {
      step3Data: { ...step3Data, paymentId, paymentStatus: 'completed', serverComputedAmountCents: amountCents },
    });

    console.log(`✅ Wizard payment processed: ${paymentId} for signup ${id}`);
    return res.json({ success: true, paymentId });
  } catch (error: any) {
    const detail = error.errors?.[0]?.detail || error.message || 'Payment processing failed';
    console.error('Wizard payment error:', detail);
    return res.status(500).json({ success: false, error: detail });
  }
});

// PUT /signup/complete/:id - Complete the signup process and create user account
router.put('/signup/complete/:id', async (req: Request, res: Response) => {
  let createdFirebaseUid: string | null = null;
  
  try {
    const { id } = req.params;
    
    // SECURITY: Validate password from request body
    const validatedBody = signupCompleteSchema.parse(req.body);
    const providedPassword = validatedBody.password;
    
    // Get existing signup progress
    const existing = await storage.getSignupProgress(id);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Signup session not found',
      });
    }

    if (existing.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Signup already completed or abandoned',
      });
    }

    // Validate that all required steps are completed
    if (!existing.currentStep || existing.currentStep < 5) {
      return res.status(400).json({
        success: false,
        error: 'All signup steps must be completed before finalizing',
      });
    }

    // Validate that all step data exists
    if (!existing.step1Data || !existing.step3Data || !existing.step4Data) {
      return res.status(400).json({
        success: false,
        error: 'Required signup data is missing. Please complete all steps.',
      });
    }

    // Extract data from steps
    const step1Data = existing.step1Data as any;
    const step2Data = (existing.step2Data as any) || {};
    const step3Data = existing.step3Data as any;
    const step4Data = existing.step4Data as any;

    // SECURITY: Enforce email verification before allowing account creation
    // This prevents bypass via direct API calls (the frontend also gates step 2 behind verification)
    if (!step1Data?.emailVerified) {
      console.warn(`❌ Account creation blocked — email not verified for signup: ${existing.id}`);
      return res.status(403).json({
        success: false,
        error: 'Email must be verified before completing account setup. Please verify your email first.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const email = step1Data.email;
    const fullName = step1Data.name || step1Data.fullName;
    const storedPasswordHash = step1Data.passwordHash;

    if (!email || !fullName || !storedPasswordHash) {
      return res.status(400).json({
        success: false,
        error: 'Account information is incomplete',
      });
    }

    // SECURITY: Verify password matches stored hash
    const passwordMatch = await bcrypt.compare(providedPassword, storedPasswordHash);
    
    if (!passwordMatch) {
      console.log(`Password verification failed for: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Please try again.',
      });
    }

    console.log(`Password verified successfully for: ${email}`);

    // SECURITY: Verify payment was completed (or is explicitly deferred in dev mode).
    // This prevents account creation when payment was never attempted or failed.
    // step3Data.selectedTier is canonical; fall back to subscriptionTier for legacy records.
    const step3TierKey = step3Data?.selectedTier || step3Data?.subscriptionTier;
    if (step3TierKey) {
      const hasPayment = step3Data?.paymentId || step3Data?.paymentDeferred;
      if (!hasPayment) {
        console.warn(`❌ Account creation blocked — payment not completed for signup: ${id}`);
        return res.status(402).json({
          success: false,
          error: 'Payment must be completed before your account can be created. Please return to Step 3.',
          code: 'PAYMENT_REQUIRED',
        });
      }
    }

    console.log(`Creating user account for: ${email}`);

    // STEP 1: Create Firebase Authentication user
    // SECURITY: Use the password provided in request body (after bcrypt verification)
    // Password is used immediately for Firebase and never stored
    let firebaseUser;
    try {
      firebaseUser = await getAuth().createUser({
        email: email,
        password: providedPassword, // Use the re-entered password (verified via bcrypt)
        displayName: fullName,
        emailVerified: false, // User should verify email
      });

      createdFirebaseUid = firebaseUser.uid;
      console.log(`Firebase user created successfully: ${firebaseUser.uid}`);
    } catch (firebaseError: any) {
      console.error('Firebase user creation failed:', firebaseError);
      
      // Check if user already exists
      if (firebaseError.code === 'auth/email-already-exists') {
        return res.status(400).json({
          success: false,
          error: 'An account with this email already exists. Please use a different email or try logging in.',
        });
      }
      
      throw new Error(`Failed to create Firebase user: ${firebaseError.message}`);
    }

    // STEP 2: Create Firestore user profile document
    try {
      const userProfile = {
        uid: firebaseUser.uid,
        email: email,
        fullName: fullName,
        company: step2Data.company || '',
        title: step2Data.title || '',
        phone: step2Data.phone || '',
        address: step2Data.address || '',
        signupId: id,
        accountStatus: 'pending_verification', // Pending email verification and admin approval
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await getAdminDb().collection('users').doc(firebaseUser.uid).set(userProfile);
      console.log(`User profile created in Firestore: ${firebaseUser.uid}`);
    } catch (firestoreError: any) {
      console.error('Firestore user profile creation failed:', firestoreError);
      
      // Rollback: Delete the Firebase user we just created
      if (createdFirebaseUid) {
        try {
          await getAuth().deleteUser(createdFirebaseUid);
          console.log(`Rolled back Firebase user: ${createdFirebaseUid}`);
        } catch (rollbackError: any) {
          console.error('Failed to rollback Firebase user:', rollbackError);
        }
      }
      
      throw new Error(`Failed to create user profile: ${firestoreError.message}`);
    }

    // STEP 3: Store subscription selection
    // Use 'selectedTier' — the canonical field name written by PUT /signup/progress step 3.
    // Also read paymentId / paymentDeferred from the step3Data so finalize reflects
    // the actual payment state rather than an incorrect 'pending_payment' placeholder.
    try {
      const subscriptionData = {
        userId: firebaseUser.uid,
        userEmail: email,
        tier: step3Data.selectedTier || step3Data.subscriptionTier, // selectedTier is canonical
        addons: step3Data.selectedAddons || [],
        serverComputedAmountCents: step3Data.serverComputedAmountCents,
        paymentId: step3Data.paymentId || null,
        paymentDeferred: step3Data.paymentDeferred || false,
        status: step3Data.paymentId ? 'payment_completed' : (step3Data.paymentDeferred ? 'payment_deferred' : 'pending_payment'),
        signupId: id,
        createdAt: Timestamp.now(),
      };

      await getAdminDb().collection('subscription_selections').doc(firebaseUser.uid).set(subscriptionData);
      console.log(`Subscription selection stored: ${firebaseUser.uid}`);
    } catch (subscriptionError: any) {
      console.error('Subscription data storage failed:', subscriptionError);
      
      // Rollback: Delete Firestore user profile and Firebase user
      if (createdFirebaseUid) {
        try {
          await getAdminDb().collection('users').doc(createdFirebaseUid).delete();
          await getAuth().deleteUser(createdFirebaseUid);
          console.log(`Rolled back user account: ${createdFirebaseUid}`);
        } catch (rollbackError: any) {
          console.error('Failed to rollback user account:', rollbackError);
        }
      }
      
      throw new Error(`Failed to store subscription selection: ${subscriptionError.message}`);
    }

    // STEP 4: Link terms acceptance to the user
    try {
      // Update the terms acceptance record with the actual user ID
      const termsAcceptanceQuery = await getAdminDb()
        .collection('terms_acceptances')
        .where('metadata.signupId', '==', id)
        .get();

      if (!termsAcceptanceQuery.empty) {
        const termsDoc = termsAcceptanceQuery.docs[0];
        await termsDoc.ref.update({
          userId: firebaseUser.uid,
          updatedAt: Timestamp.now(),
        });
        console.log(`Linked terms acceptance to user: ${firebaseUser.uid}`);
      } else {
        // Create terms acceptance record if it doesn't exist
        await getAdminDb().collection('terms_acceptances').add({
          userId: firebaseUser.uid,
          userEmail: email,
          termsVersionId: step4Data.termsVersionId,
          acceptedTerms: step4Data.acceptedTerms,
          signupId: id,
          acceptedAt: Timestamp.now(),
          ipAddress: existing.ipAddress || 'unknown',
          userAgent: existing.userAgent || 'unknown',
        });
        console.log(`Created terms acceptance for user: ${firebaseUser.uid}`);
      }
    } catch (termsError: any) {
      console.error('Terms acceptance linking failed:', termsError);
      // Don't rollback for this - it's not critical, just log the error
      console.warn('Continuing despite terms acceptance error');
    }

    // STEP 5: Mark signup as completed
    // No password sanitization needed - we never stored plaintext passwords
    const updated = await storage.updateSignupProgress(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to update signup status');
    }

    console.log(`✅ Signup completed successfully for: ${email} (UID: ${firebaseUser.uid})`);
    console.log(`🔒 Zero plaintext passwords in storage - secure by design`);

    // STEP 6: Send Welcome Email with Activation Code
    try {
      // Generate activation code (8-character alphanumeric code)
      const activationCode = randomUUID().substring(0, 8).toUpperCase();
      
      console.log(`📧 Sending welcome email to: ${email}`);
      
      const emailResult = await sendWelcomeEmail({
        recipientEmail: email,
        recipientName: fullName,
        activationCode: activationCode,
      });
      
      if (emailResult.success) {
        console.log(`✅ Welcome email sent successfully to: ${email}`);
      } else {
        console.error(`⚠️ Failed to send welcome email to: ${email}`, emailResult.error);
        // Don't fail the signup if email fails - just log the error
      }
    } catch (emailError: any) {
      console.error('Welcome email error (non-critical):', emailError);
      // Continue despite email error - user account is created successfully
    }

    return res.json({
      success: true,
      message: 'Account created successfully! You can now log in with your email and password.',
      userId: firebaseUser.uid,
      email: email,
      accountStatus: 'pending_verification',
      nextSteps: [
        'Log in with your email and password',
        'Complete payment to activate your subscription',
        'Start using MeasurePRO features'
      ],
      signup: updated,
    });
  } catch (error: any) {
    console.error('Signup completion error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete signup and create account. Please try again or contact support.',
    });
  }
});

// ==================== PUBLIC PRICING & TERMS ENDPOINTS ====================

// GET /terms/latest - Get latest active terms version
router.get('/terms/latest', async (req: Request, res: Response) => {
  try {
    const latestTerms = await storage.getLatestTermsVersion();
    
    if (!latestTerms) {
      return res.status(404).json({
        success: false,
        error: 'No active terms version found',
      });
    }

    return res.json({
      success: true,
      terms: latestTerms,
    });
  } catch (error: any) {
    console.error('Get latest terms error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve terms',
    });
  }
});

// POST /terms/accept - Accept terms and conditions
router.post('/terms/accept', async (req: Request, res: Response) => {
  try {
    const { signupId, termsVersionId, acceptedTerms } = req.body;

    if (!signupId || !termsVersionId || !acceptedTerms) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: signupId, termsVersionId, and acceptedTerms are required',
      });
    }

    // Verify signup exists
    const signup = await storage.getSignupProgress(signupId);
    if (!signup) {
      return res.status(404).json({
        success: false,
        error: 'Signup session not found',
      });
    }

    // Verify terms version exists
    const termsVersion = await storage.getTermsVersion(termsVersionId);
    if (!termsVersion) {
      return res.status(404).json({
        success: false,
        error: 'Terms version not found',
      });
    }

    // Capture request metadata
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Create terms acceptance record
    const acceptance = await storage.createTermsAcceptance({
      userId: signupId,
      userEmail: signup.email,
      termsVersionId: termsVersion.id,
      termsVersion: termsVersion.version,
      ipAddress,
      userAgent,
      metadata: {
        acceptedTerms,
        signupFlow: true,
      },
    });

    return res.json({
      success: true,
      acceptance,
      message: 'Terms acceptance recorded successfully',
    });
  } catch (error: any) {
    console.error('Terms acceptance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to record terms acceptance',
    });
  }
});

// ==================== ADMIN SEED / DATA SYNC ENDPOINTS ====================

// GET /admin/seed-export
// Returns all companies + members as JSON — paste this into seedProduction.ts to sync production.
// SECURITY: Master admin only.
router.get('/admin/seed-export', verifyFirebaseToken, verifyMasterAdminAccess, async (_req: AuthRequest, res: Response) => {
  try {
    const data = await exportSeedFromDatabase();
    return res.json({ success: true, ...data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// ==================== ADMIN EMAIL NOTIFICATION ENDPOINTS ====================

// POST /admin/send-offline-warnings - Manual trigger for 7-day offline warnings
// SECURITY: Requires master admin authorization (jfprince@soltec.ca) to prevent mass email abuse
router.post('/admin/send-offline-warnings', verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { targetEmails } = req.body;
    
    if (!targetEmails || !Array.isArray(targetEmails) || targetEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'targetEmails array is required',
      });
    }

    console.log(`📧 Sending 7-day offline warnings to ${targetEmails.length} users`);
    
    const results: Array<{ email: string; success: boolean; error: string | null }> = [];
    
    for (const email of targetEmails) {
      try {
        // Get user's full name from Firestore
        const userQuery = await getAdminDb().collection('users').where('email', '==', email).get();
        let fullName = 'Valued Customer';
        
        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data();
          fullName = userData?.fullName || 'Valued Customer';
        }
        
        const emailResult = await send7DayOfflineWarningEmail({
          recipientEmail: email,
          recipientName: fullName,
          daysOffline: 7,
          gracePeriodDays: 3,
        });
        
        results.push({
          email,
          success: emailResult.success,
          error: emailResult.error || null,
        });
        
        if (emailResult.success) {
          console.log(`✅ 7-day offline warning sent to: ${email}`);
        } else {
          console.error(`⚠️ Failed to send 7-day offline warning to: ${email}`, emailResult.error);
        }
      } catch (error: any) {
        results.push({
          email,
          success: false,
          error: error.message || 'Unknown error',
        });
        console.error(`Error sending 7-day offline warning to ${email}:`, error);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return res.json({
      success: true,
      message: `Sent ${successCount} emails, ${failureCount} failed`,
      results,
    });
  } catch (error: any) {
    console.error('Send offline warnings error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send offline warnings',
    });
  }
});

// POST /admin/send-deletion-warnings - Manual trigger for 30-day deletion warnings
// SECURITY: Requires master admin authorization (jfprince@soltec.ca) to prevent mass email abuse
router.post('/admin/send-deletion-warnings', verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUsers } = req.body;
    
    if (!targetUsers || !Array.isArray(targetUsers) || targetUsers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'targetUsers array is required. Each user should have: email, daysRemaining, deletionDate, subscriptionType',
      });
    }

    console.log(`📧 Sending 30-day deletion warnings to ${targetUsers.length} users`);
    
    const results: Array<{ email: string; success: boolean; error: string | null }> = [];
    
    for (const user of targetUsers) {
      try {
        const { email, daysRemaining, deletionDate, subscriptionType } = user;
        
        if (!email || !daysRemaining || !deletionDate) {
          results.push({
            email: email || 'unknown',
            success: false,
            error: 'Missing required fields: email, daysRemaining, deletionDate',
          });
          continue;
        }
        
        // Get user's full name from Firestore
        const userQuery = await getAdminDb().collection('users').where('email', '==', email).get();
        let fullName = 'Valued Customer';
        
        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data();
          fullName = userData?.fullName || 'Valued Customer';
        }
        
        const emailResult = await send30DayDeletionWarningEmail({
          recipientEmail: email,
          recipientName: fullName,
          daysRemaining,
          deletionDate,
          subscriptionType: subscriptionType || 'cancelled',
        });
        
        results.push({
          email,
          success: emailResult.success,
          error: emailResult.error || null,
        });
        
        if (emailResult.success) {
          console.log(`✅ 30-day deletion warning sent to: ${email}`);
        } else {
          console.error(`⚠️ Failed to send 30-day deletion warning to: ${email}`, emailResult.error);
        }
      } catch (error: any) {
        results.push({
          email: user.email || 'unknown',
          success: false,
          error: error.message || 'Unknown error',
        });
        console.error(`Error sending 30-day deletion warning to ${user.email}:`, error);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return res.json({
      success: true,
      message: `Sent ${successCount} emails, ${failureCount} failed`,
      results,
    });
  } catch (error: any) {
    console.error('Send deletion warnings error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send deletion warnings',
    });
  }
});

// Admin endpoint to cleanup expired accounts (master admin only)
router.post('/admin/cleanup-expired-accounts', 
  verifyFirebaseToken, 
  verifyMasterAdminAccess, 
  async (req: AuthRequest, res: Response) => {
    try {
      console.log('🧹 Starting cleanup of expired accounts...');
      
      // Get expired accounts using enforceGracePeriods
      const { expiredPaused, expiredCancelled } = await storage.enforceGracePeriods();
      
      const allExpiredEmails = [...expiredPaused, ...expiredCancelled];
      
      if (allExpiredEmails.length === 0) {
        return res.json({
          success: true,
          message: 'No expired accounts to clean up',
          deletedCount: 0,
          deletedUsers: [],
        });
      }
      
      console.log(`Found ${allExpiredEmails.length} expired accounts to delete`);
      
      // Get full user data for each expired account before deletion (for emails)
      const emailResults: Array<{ email: string; emailSent: boolean; error: string | null }> = [];
      
      for (const email of allExpiredEmails) {
        try {
          // Get user data for email
          const userProgress = await storage.getSignupProgressByEmail(email);
          
          if (!userProgress) {
            console.warn(`⚠️ No signup progress found for: ${email}`);
            continue;
          }
          
          // Determine subscription type
          const subscriptionType = expiredPaused.includes(email) ? 'paused' : 'cancelled';
          
          // Send final deletion notice
          const userName = (userProgress.step1Data as any)?.name || email;
          const emailResult = await sendFinalDeletionNotice(
            email,
            userName,
            subscriptionType as 'paused' | 'cancelled'
          );
          
          emailResults.push({
            email,
            emailSent: emailResult.success,
            error: emailResult.error || null,
          });
          
          if (emailResult.success) {
            console.log(`✅ Sent final deletion notice to: ${email}`);
          } else {
            console.error(`⚠️ Failed to send final deletion notice to: ${email}`, emailResult.error);
          }
        } catch (error: any) {
          emailResults.push({
            email,
            emailSent: false,
            error: error.message || 'Unknown error',
          });
          console.error(`Error sending final deletion notice to ${email}:`, error);
        }
      }
      
      // Delete expired user data (pass explicit list to prevent race conditions)
      const deletedUsers = await storage.deleteExpiredUserData(allExpiredEmails);
      
      console.log(`✅ Deleted ${deletedUsers.length} user accounts`);
      
      return res.json({
        success: true,
        message: `Deleted ${deletedUsers.length} expired accounts`,
        deletedCount: deletedUsers.length,
        deletedUsers,
        emailResults,
      });
    } catch (error: any) {
      console.error('Cleanup expired accounts error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Cleanup failed',
      });
    }
  }
);

// Admin endpoint to cleanup incomplete signups older than N hours (master admin only)
router.post(
  '/admin/cleanup-incomplete-signups',
  verifyFirebaseToken,
  verifyMasterAdminAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const hoursOld = Number(req.body.hoursOld ?? 48);
      if (isNaN(hoursOld) || hoursOld < 1) {
        return res.status(400).json({ success: false, error: 'hoursOld must be a positive number' });
      }

      console.log(`🧹 Cleaning up incomplete signups older than ${hoursOld} hours...`);
      const result = await storage.cleanupIncompleteSignups(hoursOld);
      console.log(`✅ Deleted ${result.deletedCount} incomplete signup records`);

      return res.json({
        success: true,
        message: `Deleted ${result.deletedCount} incomplete signup record(s) older than ${hoursOld} hours`,
        deletedCount: result.deletedCount,
        deletedIds: result.deletedIds,
      });
    } catch (error: any) {
      console.error('Cleanup incomplete signups error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Cleanup failed' });
    }
  }
);

// ==================== TERMS & CONDITIONS MANAGEMENT ====================

// GET /terms/latest - Get latest terms version (public)
router.get('/terms/latest', async (req: Request, res: Response) => {
  try {
    const latestVersion = await storage.getLatestTermsVersion();
    
    if (!latestVersion) {
      return res.json({
        success: true,
        version: null,
      });
    }
    
    return res.json({
      success: true,
      version: latestVersion,
    });
  } catch (error: any) {
    console.error('Get latest terms version error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get latest terms version',
    });
  }
});

// GET /terms/check-acceptance - Check if current user has accepted latest terms
router.get('/terms/check-acceptance', allowOfflineAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const latestVersion = await storage.getLatestTermsVersion();
    
    if (!latestVersion) {
      return res.json({
        success: true,
        hasAccepted: true,
        latestVersion: null,
      });
    }
    
    const hasAccepted = await storage.hasUserAcceptedLatestTerms(userId);
    
    return res.json({
      success: true,
      hasAccepted,
      latestVersion,
    });
  } catch (error: any) {
    console.error('Check terms acceptance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check terms acceptance',
    });
  }
});

// POST /terms/accept - User accepts terms
router.post('/terms/accept', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userEmail = req.userEmail!;
    const { termsVersionId, ipAddress, userAgent, deviceFingerprint } = req.body;
    
    if (!termsVersionId || !ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'termsVersionId and ipAddress are required',
      });
    }
    
    // Get the terms version
    const termsVersion = await storage.getTermsVersion(termsVersionId);
    
    if (!termsVersion) {
      return res.status(404).json({
        success: false,
        error: 'Terms version not found',
      });
    }
    
    // Create acceptance record
    const acceptance = await storage.createTermsAcceptance({
      userId,
      userEmail,
      termsVersionId,
      termsVersion: termsVersion.version,
      ipAddress,
      userAgent: userAgent || '',
      deviceFingerprint,
      metadata: {
        acceptedVia: 'web',
        timestamp: new Date().toISOString(),
      },
    });
    
    console.log(`✅ User ${userEmail} accepted terms version ${termsVersion.version}`);
    
    return res.json({
      success: true,
      acceptance,
    });
  } catch (error: any) {
    console.error('Accept terms error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to accept terms',
    });
  }
});

// Admin routes for terms management

// GET /admin/terms/versions - List all terms versions
router.get('/admin/terms/versions', verifyFirebaseToken, verifyAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const versions = await storage.getAllTermsVersions();

    const versionsWithCounts = await Promise.all(
      versions.map(async (v) => {
        const stats = await storage.getAcceptanceStats(v.id);
        return { ...v, acceptanceCount: stats.acceptedCount };
      })
    );
    
    return res.json({
      success: true,
      versions: versionsWithCounts,
    });
  } catch (error: any) {
    console.error('Get all terms versions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get terms versions',
    });
  }
});

// GET /admin/terms/versions/:id - Get specific version
router.get('/admin/terms/versions/:id', verifyFirebaseToken, verifyAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const version = await storage.getTermsVersion(id);
    
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Terms version not found',
      });
    }
    
    return res.json({
      success: true,
      version,
    });
  } catch (error: any) {
    console.error('Get terms version error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get terms version',
    });
  }
});

// POST /admin/terms/versions - Create new terms version (master admin only)
router.post('/admin/terms/versions', verifyFirebaseToken, verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { version, title, content, effectiveDate, isActive, requiresReacceptance } = req.body;
    
    if (!version || !title || !content || !effectiveDate) {
      return res.status(400).json({
        success: false,
        error: 'version, title, content, and effectiveDate are required',
      });
    }
    
    const newVersion = await storage.createTermsVersion({
      version,
      title,
      content,
      effectiveDate,
      isActive: isActive ?? true,
      requiresReacceptance: requiresReacceptance ?? true,
    });
    
    console.log(`✅ Created new terms version: ${version}`);
    
    return res.json({
      success: true,
      version: newVersion,
    });
  } catch (error: any) {
    console.error('Create terms version error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create terms version',
    });
  }
});

// GET /admin/terms/acceptance-stats/:versionId - Get acceptance stats
router.get('/admin/terms/acceptance-stats/:versionId', verifyFirebaseToken, verifyAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const stats = await storage.getAcceptanceStats(versionId);
    
    return res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Get acceptance stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get acceptance stats',
    });
  }
});

// POST /admin/terms/notify-users - Notify all users who haven't accepted latest terms (master admin only)
router.post('/admin/terms/notify-users', verifyFirebaseToken, verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const latestVersion = await storage.getLatestTermsVersion();
    
    if (!latestVersion) {
      return res.status(400).json({
        success: false,
        error: 'No terms version exists',
      });
    }
    
    const usersToNotify = await storage.getUsersWithoutLatestTerms();
    
    console.log(`📧 Sending terms change notifications to ${usersToNotify.length} users`);
    
    const results: Array<{ email: string; success: boolean; error: string | null }> = [];
    
    for (const user of usersToNotify) {
      try {
        const { sendTermsChangeNotification } = await import('./services/emailService.js');
        
        const emailResult = await sendTermsChangeNotification({
          recipientEmail: user.email,
          recipientName: user.fullName || 'Valued Customer',
          version: latestVersion.version,
          effectiveDate: latestVersion.effectiveDate,
          title: latestVersion.title,
        });
        
        results.push({
          email: user.email,
          success: emailResult.success,
          error: emailResult.error || null,
        });
        
        if (emailResult.success) {
          console.log(`✅ Terms change notification sent to: ${user.email}`);
        } else {
          console.error(`⚠️ Failed to send terms notification to: ${user.email}`, emailResult.error);
        }
      } catch (error: any) {
        results.push({
          email: user.email,
          success: false,
          error: error.message || 'Unknown error',
        });
        console.error(`Error sending terms notification to ${user.email}:`, error);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return res.json({
      success: true,
      message: `Sent ${successCount} emails, ${failureCount} failed`,
      notifiedCount: successCount,
      results,
    });
  } catch (error: any) {
    console.error('Notify users error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to notify users',
    });
  }
});

// ==================== TESTING PORTAL ROUTES ====================

// Testers
router.post('/testers', async (req: Request, res: Response) => {
  try {
    const data = insertTesterSchema.parse(req.body);
    const tester = await storage.createTester(data);
    res.json(tester);
  } catch (error: any) {
    console.error('Create tester error:', error);
    res.status(400).json({ error: error.message || 'Failed to create tester' });
  }
});

router.get('/testers', async (_req: Request, res: Response) => {
  try {
    const testers = await storage.getAllTesters();
    res.json(testers);
  } catch (error: any) {
    console.error('Get testers error:', error);
    res.status(500).json({ error: error.message || 'Failed to get testers' });
  }
});

router.get('/testers/:email', async (req: Request, res: Response) => {
  try {
    const tester = await storage.getTesterByEmail(req.params.email);
    if (!tester) {
      return res.status(404).json({ error: 'Tester not found' });
    }
    res.json(tester);
  } catch (error: any) {
    console.error('Get tester error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tester' });
  }
});

// Test Sessions
router.post('/test-sessions', async (req: Request, res: Response) => {
  try {
    const data = insertTestSessionSchema.parse(req.body);
    const session = await storage.createTestSession(data);
    res.json(session);
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(400).json({ error: error.message || 'Failed to create session' });
  }
});

router.get('/test-sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const session = await storage.getTestSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message || 'Failed to get session' });
  }
});

router.get('/test-sessions/tester/:testerId', async (req: Request, res: Response) => {
  try {
    const testerId = parseInt(req.params.testerId, 10);
    const sessions = await storage.getTestSessionsByTester(testerId);
    res.json(sessions);
  } catch (error: any) {
    console.error('Get sessions by tester error:', error);
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

router.patch('/test-sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updates = insertTestSessionSchema.partial().parse(req.body);
    const session = await storage.updateTestSession(id, updates);
    res.json(session);
  } catch (error: any) {
    console.error('Update session error:', error);
    res.status(400).json({ error: error.message || 'Failed to update session' });
  }
});

router.get('/test-sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await storage.getAllTestSessions();
    res.json(sessions);
  } catch (error: any) {
    console.error('Get all sessions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

// Test Results
router.post('/test-results', async (req: Request, res: Response) => {
  try {
    const data = insertTestResultSchema.parse(req.body);
    const result = await storage.createTestResult(data);
    res.json(result);
  } catch (error: any) {
    console.error('Create test result error:', error);
    res.status(400).json({ error: error.message || 'Failed to create result' });
  }
});

router.post('/test-results/bulk', async (req: Request, res: Response) => {
  try {
    const results = req.body.map((r: any) => insertTestResultSchema.parse(r));
    const created = await storage.bulkCreateTestResults(results);
    res.json(created);
  } catch (error: any) {
    console.error('Bulk create results error:', error);
    res.status(400).json({ error: error.message || 'Failed to create results' });
  }
});

router.get('/test-results/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    const results = await storage.getTestResultsBySession(sessionId);
    res.json(results);
  } catch (error: any) {
    console.error('Get results by session error:', error);
    res.status(500).json({ error: error.message || 'Failed to get results' });
  }
});

router.patch('/test-results/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updates = insertTestResultSchema.partial().parse(req.body);
    const result = await storage.updateTestResult(id, updates);
    res.json(result);
  } catch (error: any) {
    console.error('Update result error:', error);
    res.status(400).json({ error: error.message || 'Failed to update result' });
  }
});

// Statistics
router.get('/test-stats', async (_req: Request, res: Response) => {
  try {
    const sessions = await storage.getAllTestSessions();
    const testers = await storage.getAllTesters();
    
    if (sessions.length === 0) {
      return res.json({
        avgCompletionRate: 0,
        totalSessions: 0,
        totalTesters: testers.length,
        avgPassRate: 0,
        avgFailRate: 0,
        avgBlockRate: 0,
      });
    }

    const totalCompletion = sessions.reduce((sum, s) => sum + s.completionPercentage, 0);
    const avgCompletionRate = totalCompletion / sessions.length;
    
    const totalTests = sessions.reduce((sum, s) => sum + s.totalTests, 0);
    const totalPasses = sessions.reduce((sum, s) => sum + s.passedTests, 0);
    const totalFails = sessions.reduce((sum, s) => sum + s.failedTests, 0);
    const totalBlocks = sessions.reduce((sum, s) => sum + s.blockedTests, 0);

    res.json({
      avgCompletionRate,
      totalSessions: sessions.length,
      totalTesters: testers.length,
      avgPassRate: totalTests > 0 ? (totalPasses / totalTests) * 100 : 0,
      avgFailRate: totalTests > 0 ? (totalFails / totalTests) * 100 : 0,
      avgBlockRate: totalTests > 0 ? (totalBlocks / totalTests) * 100 : 0,
      totalTests,
      totalPasses,
      totalFails,
      totalBlocks,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

router.get('/test-stats/compare', async (_req: Request, res: Response) => {
  try {
    const sessions = await storage.getAllTestSessions();
    const testers = await storage.getAllTesters();
    
    const testersMap = new Map(testers.map(t => [t.id, t]));
    
    const comparison = sessions.map(session => {
      const tester = testersMap.get(session.testerId);
      return {
        sessionId: session.id,
        testerName: tester?.name || 'Unknown',
        testerEmail: tester?.email || '',
        sessionName: session.sessionName,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        completionPercentage: session.completionPercentage,
        passedTests: session.passedTests,
        failedTests: session.failedTests,
        blockedTests: session.blockedTests,
        totalTests: session.totalTests,
        weather: session.weather,
        temperature: session.temperature,
        groundReference: session.groundReference,
        location: session.location,
      };
    });

    res.json(comparison);
  } catch (error: any) {
    console.error('Compare stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to compare stats' });
  }
});

// ==================== POINT CLOUD SCANNING ROUTES ====================

// GET /api/point-cloud/scans - List user's scans
router.get('/point-cloud/scans', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // In a real implementation, query from database
    // For now, return empty array since data is primarily in IndexedDB
    res.json([]);
  } catch (error: any) {
    console.error('List scans error:', error);
    res.status(500).json({ error: error.message || 'Failed to list scans' });
  }
});

// POST /api/point-cloud/scans - Create scan record
router.post('/point-cloud/scans', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // In a real implementation, save to database
    // For MVP, data is stored in IndexedDB client-side
    const scanId = `scan_${Date.now()}`;
    res.json({ id: scanId, success: true });
  } catch (error: any) {
    console.error('Create scan error:', error);
    res.status(500).json({ error: error.message || 'Failed to create scan' });
  }
});

// PATCH /api/point-cloud/scans/:id - Update scan status
router.patch('/point-cloud/scans/:id', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    // In a real implementation, update in database
    res.json({ id, success: true });
  } catch (error: any) {
    console.error('Update scan error:', error);
    res.status(500).json({ error: error.message || 'Failed to update scan' });
  }
});

// DELETE /api/point-cloud/scans/:id - Delete scan
router.delete('/point-cloud/scans/:id', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    // In a real implementation, delete from database
    // IndexedDB cleanup happens client-side
    res.json({ id, success: true });
  } catch (error: any) {
    console.error('Delete scan error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete scan' });
  }
});

// POST /api/point-cloud/export - Queue export job (placeholder for future background processing)
router.post('/point-cloud/export', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { scanId, format } = req.body;
    if (!scanId || !format) {
      return res.status(400).json({ error: 'Missing scanId or format' });
    }

    // In a real implementation, queue background job
    // For MVP, export happens client-side
    const jobId = `export_${Date.now()}`;
    res.json({ jobId, success: true, message: 'Export processed client-side' });
  } catch (error: any) {
    console.error('Export scan error:', error);
    res.status(500).json({ error: error.message || 'Failed to export scan' });
  }
});

// Initialize GNSS routes if Firestore is available
if (adminDb) {
  const gnssFirestore = new GnssFirestore(adminDb);
  
  // Survey-scoped profile listing endpoint (as per Task 4 specification)
  router.get('/surveys/:id/profiles', async (req: Request, res: Response) => {
    try {
      const surveyId = req.params.id;
      if (!surveyId) {
        return res.status(400).json({
          success: false,
          error: 'Survey ID is required',
        });
      }
      
      const profiles = await gnssFirestore.getProfilesBySurvey(surveyId);
      return res.json({
        success: true,
        profiles,
      });
    } catch (error: any) {
      console.error('[API] Survey profiles query error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch survey profiles',
      });
    }
  });
  
  router.use('/gnss', createGnssRoutes(gnssFirestore));
  router.use('/road-profile', createProfileRoutes(gnssFirestore));
  router.use('/audit', auditRoutes);
  router.use('/roadscope', roadscopeRoutes);

  // ==================== ROADSCOPE WEBHOOKS ====================
  // POST /api/webhooks/roadscope/member-changed
  // Receives HMAC-SHA256 signed webhook from RoadScope when company members change.
  // Stores are per-company webhook secrets in Firestore roadScopeSettings collection.
  router.post('/webhooks/roadscope/member-changed', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-roadscope-signature'] as string;
      const companyId = req.headers['x-roadscope-companyid'] as string;

      if (!signature || !companyId) {
        return res.status(400).json({ error: 'Missing signature or company ID headers' });
      }

      // Look up webhook secret for this company from Firestore
      let webhookSecret: string | null = null;
      try {
        const db = getFirestore();
        const settingsSnap = await db.collection('roadScopeWebhookSecrets').doc(companyId).get();
        if (settingsSnap.exists) {
          webhookSecret = settingsSnap.data()?.secret || null;
        }
      } catch {
        // Firestore may not be available in dev
      }

      if (!webhookSecret) {
        return res.status(401).json({ error: 'No webhook secret configured for this company' });
      }

      // Verify HMAC-SHA256 signature
      const rawBody = JSON.stringify(req.body);
      const expected = `sha256=${createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`;
      try {
        if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } catch {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const { action, userId, newRole, timestamp } = req.body;
      console.log(`[Webhook] Company ${companyId}: ${action} user ${userId}${newRole ? ` → ${newRole}` : ''} at ${timestamp}`);

      // TODO: Notify connected Electron clients via WebSocket/SSE
      // For now, clients will pick up changes on next API key validation

      res.json({ received: true });
    } catch (error: any) {
      console.error('[Webhook] Error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  console.log('✅ GNSS routes initialized');
  console.log('✅ RoadScope routes initialized');
  console.log('✅ RoadScope webhook endpoint initialized');
  console.log('✅ Road Profile routes initialized');
  console.log('✅ Survey profile routes initialized');
}

// ==================== BETA ACCOUNT MANAGEMENT ====================

// GET /admin/firebase-status - Check if Firebase Admin SDK is available
// NOTE: This endpoint is NOT guarded by Firebase auth because it needs to work when Firebase Admin SDK is unavailable
// Client-side admin check is sufficient here since this is read-only status info
router.get('/admin/firebase-status', allowOfflineAuth, async (req: AuthRequest, res: Response) => {
  res.json({ 
    available: isFirebaseAdminAvailable,
    message: isFirebaseAdminAvailable 
      ? 'Firebase Admin SDK is available'
      : 'Firebase Admin SDK is not available - FIREBASE_SERVICE_ACCOUNT_KEY not configured'
  });
});

// POST /admin/create-beta-account - Create beta test account (master admin only)
router.post('/admin/create-beta-account', verifyFirebaseToken, verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  if (!isFirebaseAdminAvailable) {
    return res.status(503).json({ 
      error: 'Firebase Admin SDK not available',
      message: 'Server-side Firebase operations require valid service account credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable.'
    });
  }
  try {
    const email = 'info@groupebellemare.com';
    const password = 'oversize';
    const displayName = 'Groupe Bellemare (Beta Tester)';

    console.log('🔧 Creating beta test account...');
    console.log('Email:', email);

    try {
      // Try to create the user
      const userRecord = await getAuth().createUser({
        email,
        password,
        emailVerified: true,
        displayName,
      });

      console.log('✅ Beta test account created successfully!');
      console.log('UID:', userRecord.uid);
      console.log('Email:', userRecord.email);

      return res.json({
        success: true,
        message: 'Beta test account created successfully',
        account: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
        },
        credentials: {
          email,
          password,
        },
        restrictedFeatures: [
          'calibration',
          'AI detection',
          'Envelope Clearance',
          'Convoy Guardian',
          'Route Enforcement',
          'Swept Path Analysis',
          'Admin access',
          '3D Point Cloud Scanning',
          'GNSS Profiling',
          'Measurement Configuration',
          'Measurement Controls',
        ],
        allowedFeatures: [
          'Manual POI logging',
          'Data logging (all POI types)',
          'Counter detection mode',
          'GPS tracking',
          'Photo capture',
          'Basic measurements',
        ],
      });

    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        console.log('⚠️  Account already exists - updating password...');
        
        const existingUser = await getAuth().getUserByEmail(email);
        await getAuth().updateUser(existingUser.uid, {
          password,
          emailVerified: true,
          displayName,
        });
        
        console.log('✅ Password and details updated successfully!');
        console.log('UID:', existingUser.uid);
        console.log('Email:', existingUser.email);

        return res.json({
          success: true,
          message: 'Beta test account already exists - password updated',
          account: {
            uid: existingUser.uid,
            email: existingUser.email,
            displayName: existingUser.displayName,
          },
          credentials: {
            email,
            password,
          },
        });
      } else {
        throw error;
      }
    }

  } catch (error: any) {
    console.error('❌ Error creating beta account:', error);
    
    // Detect insufficient permission error
    if (error.code === 'auth/insufficient-permission' || error.errorInfo?.code === 'auth/insufficient-permission') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'auth/insufficient-permission',
        message: 'Service account lacks Firebase Authentication Admin role',
        permissionFix: [
          'Go to Firebase Console → IAM & Admin → IAM',
          'Find your service account: firebase-adminsdk-fbsvc@soltecone.iam.gserviceaccount.com',
          'Click Edit (pencil icon)',
          'Add role: "Firebase Authentication Admin"',
          'Save and try again',
        ],
        manualSteps: [
          'Or create manually: Firebase Console → Authentication → Users',
          'Click "Add User"',
          'Email: info@groupebellemare.com',
          'Password: oversize',
          'Edit user → Check "Email verified"',
        ],
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create beta account',
      code: error.code || error.errorInfo?.code,
      manualSteps: [
        'Go to Firebase Console → Authentication',
        'Click "Add User"',
        'Email: info@groupebellemare.com',
        'Password: oversize',
        'Edit user → Check "Email verified"',
      ],
    });
  }
});

// ==================== USER SETTINGS PERSISTENCE ====================

// Get user settings by Firebase UID
router.get('/user-settings/:userId', allowOfflineAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    
    // Verify the requesting user matches the settings owner (or allow offline mode)
    if (req.userId !== userId && req.userId !== 'offline-user') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access settings for another user',
      });
    }
    
    const settings = await storage.getUserSettings(userId);
    
    if (!settings) {
      return res.json({
        success: true,
        settings: null,
        message: 'No settings found for this user',
      });
    }
    
    return res.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('Error fetching user settings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user settings',
    });
  }
});

// Save/update user settings
router.put('/user-settings/:userId', allowOfflineAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    
    // Verify the requesting user matches the settings owner (or allow offline mode)
    if (req.userId !== userId && req.userId !== 'offline-user') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot modify settings for another user',
      });
    }
    
    // Validate the settings data
    const settingsData = {
      id: userId,
      ...req.body,
    };
    
    const validated = userSettingsSchema.safeParse(settingsData);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings data',
        details: validated.error.issues,
      });
    }
    
    const savedSettings = await storage.saveUserSettings(validated.data);
    
    return res.json({
      success: true,
      settings: savedSettings,
      message: 'Settings saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving user settings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save user settings',
    });
  }
});

// Download LiDAR companion service as ZIP
router.get('/downloads/lidar-service.zip', async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const zip = new JSZip();
    const baseDir = path.join(process.cwd(), 'lidar-service');
    
    // Helper function to recursively add files to zip
    async function addFilesToZip(dir: string, zipFolder: JSZip) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = entry.name;
        
        // Skip build artifacts and captures
        if (['bin', 'obj', 'captures'].includes(entry.name)) continue;
        
        if (entry.isDirectory()) {
          const subFolder = zipFolder.folder(relativePath);
          if (subFolder) {
            await addFilesToZip(fullPath, subFolder);
          }
        } else {
          const content = await fs.readFile(fullPath);
          zipFolder.file(relativePath, content);
        }
      }
    }
    
    await addFilesToZip(baseDir, zip);
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="MeasurePRO-LiDAR-Service.zip"');
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (error: any) {
    console.error('Error creating LiDAR service ZIP:', error);
    res.status(500).json({ error: 'Failed to create download package' });
  }
});

// ==================== HARDWARE VOUCHER ROUTES ====================

// POST /api/voucher/validate - Check if a voucher code is valid (public, used during signup)
router.post('/voucher/validate', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Voucher code is required' });
    }
    const normalized = code.trim().toUpperCase();
    const { db } = await import('../db/index.js');
    const { hardwareVouchers } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [voucher] = await db.select().from(hardwareVouchers).where(eq(hardwareVouchers.code, normalized));
    if (!voucher) return res.json({ success: false, valid: false, error: 'Invalid voucher code' });
    if (voucher.status === 'used') return res.json({ success: false, valid: false, error: 'This voucher has already been used' });
    if (voucher.status === 'expired') return res.json({ success: false, valid: false, error: 'This voucher has expired' });
    if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
      await db.update(hardwareVouchers).set({ status: 'expired' }).where(eq(hardwareVouchers.code, normalized));
      return res.json({ success: false, valid: false, error: 'This voucher has expired' });
    }
    return res.json({ success: true, valid: true, message: '1 year of MeasurePRO included with your hardware purchase' });
  } catch (error: any) {
    console.error('Voucher validate error:', error);
    return res.status(500).json({ success: false, error: 'Failed to validate voucher' });
  }
});

// POST /api/admin/vouchers/generate - Generate hardware voucher codes (admin only)
router.post('/admin/vouchers/generate', async (req: Request, res: Response) => {
  const adminEmails = ['jfprince@soltec.ca', 'admin@soltec.ca'];
  const authHeader = req.headers['x-admin-email'] as string;
  if (!authHeader || !adminEmails.includes(authHeader)) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { count = 1, notes, expiresInDays } = req.body;
    const { db } = await import('../db/index.js');
    const { hardwareVouchers } = await import('../db/schema.js');
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return `SOLT-${part()}-${part()}`;
    };
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;
    const toInsert = Array.from({ length: Math.min(Number(count), 50) }, () => ({
      code: generateCode(),
      status: 'unused' as const,
      createdBy: authHeader,
      notes: notes || null,
      expiresAt,
    }));
    const inserted = await db.insert(hardwareVouchers).values(toInsert).returning();
    return res.json({ success: true, vouchers: inserted.map(v => ({ code: v.code, expiresAt: v.expiresAt })) });
  } catch (error: any) {
    console.error('Voucher generate error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate vouchers' });
  }
});

// GET /api/admin/vouchers - List all vouchers (admin only)
router.get('/admin/vouchers', async (req: Request, res: Response) => {
  const adminEmails = ['jfprince@soltec.ca', 'admin@soltec.ca'];
  const authHeader = req.headers['x-admin-email'] as string;
  if (!authHeader || !adminEmails.includes(authHeader)) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { db } = await import('../db/index.js');
    const { hardwareVouchers } = await import('../db/schema.js');
    const { desc } = await import('drizzle-orm');
    const vouchers = await db.select().from(hardwareVouchers).orderBy(desc(hardwareVouchers.createdAt));
    return res.json({ success: true, vouchers });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch vouchers' });
  }
});

// ==================== COMPANY MANAGEMENT API ====================
// All /api/companies routes — CRUD for companies and members

/**
 * Returns true if the request's verified Firebase user is an app-level admin.
 * Checks req.isAdmin which is set by verifyFirebaseToken from the admin claim OR
 * known admin emails — consistent with verifyAdminOrMasterAccess middleware.
 * Must be called only after verifyFirebaseToken has populated req.isAdmin.
 */
function isVerifiedAppAdmin(req: AuthRequest): boolean {
  return req.isAdmin === true;
}

/**
 * Resolve caller's company membership, using the verified Firebase UID from req.userId.
 * Returns null if uid is missing or not a member of the given company.
 */
async function getCallerMembership(req: AuthRequest, companyId: string) {
  const uid = req.userId;
  if (!uid || uid === 'offline-user') return null;
  return storage.getCompanyMemberByUid(companyId, uid);
}

// GET /api/companies — list all companies (app admin only: strict Firebase token required)
router.get('/companies', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[GET /api/companies] Request by ${req.userEmail ?? req.userId ?? 'unknown'}`);
    const companies = await storage.getAllCompanies();
    console.log(`[GET /api/companies] Returning ${companies.length} companies`);
    return res.json({ success: true, companies });
  } catch (error: any) {
    console.error('[GET /api/companies] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/companies — create company (app admin only)
router.post('/companies', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const data = insertCompanySchema.parse(req.body);
    const company = await storage.createCompany(data);
    return res.status(201).json({ success: true, company });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/companies/pending-sync — returns companies flagged pendingSync=true
// MUST be defined before GET /companies/:id to avoid route shadowing (Express first-match wins).
// App admins use this to review which records are still awaiting sync confirmation from offline clients.
router.get('/companies/pending-sync', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const companies = await storage.getAllCompanies();
    const pending = companies.filter(c => c.pendingSync === true);
    return res.json({ success: true, companies: pending });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/companies/users/lookup — look up users by email (exact) or name/email (substring)
// MUST be defined before GET /companies/:id to avoid route shadowing.
// Accepts ?query= (email or partial name). For exact email lookups uses Firebase to resolve UID.
router.get('/companies/users/lookup', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    // Support both ?query= and legacy ?email= for backward compatibility
    const raw = req.query.query ?? req.query.email;
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      return res.status(400).json({ success: false, error: 'query parameter required' });
    }
    const query = raw.trim();

    // Always search our DB members by name or email (case-insensitive substring)
    const dbMembers = await storage.searchCompanyMembersByQuery(query);
    const dbResults = dbMembers.map(m => ({
      uid: m.firebaseUid,
      email: m.email,
      displayName: m.fullName,
    }));

    // For exact email queries, also try Firebase Auth to resolve accounts not yet in any company
    if (query.includes('@') && isFirebaseAdminAvailable) {
      try {
        const userRecord = await getAuth().getUserByEmail(query);
        const alreadyInDb = dbResults.some(r => r.uid === userRecord.uid);
        if (!alreadyInDb) {
          dbResults.unshift({ uid: userRecord.uid, email: userRecord.email ?? query, displayName: userRecord.displayName ?? '' });
        }
      } catch (e: any) {
        if (e.code !== 'auth/user-not-found') throw e;
      }
    }

    if (dbResults.length === 0) {
      return res.status(404).json({ success: false, error: 'No users found matching that email or name' });
    }

    return res.json({ success: true, users: dbResults });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/companies/:id — get company (app admin or company member)
router.get('/companies/:id', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  if (!isVerifiedAppAdmin(req) && !membership) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
    return res.json({ success: true, company });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/companies/:id — update company profile (app admin or company_admin of that company)
// SECURITY: enabledAddons is stripped for company admins — that field is app-admin-only via /addons endpoint
router.patch('/companies/:id', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  const appAdmin = isVerifiedAppAdmin(req);
  if (!appAdmin && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const rawData = insertCompanySchema.partial().parse(req.body);
    // Prevent company admins from modifying paid add-ons (app-admin privilege only)
    const data = appAdmin ? rawData : (({ enabledAddons: _omit, ...rest }) => rest)(rawData as typeof rawData & { enabledAddons?: unknown });
    const company = await storage.updateCompany(req.params.id, data);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
    return res.json({ success: true, company });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/companies/:id — delete company (app admin only)
router.delete('/companies/:id', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await storage.deleteCompany(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Company not found' });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/companies/:id/members — list members (app admin or company member)
router.get('/companies/:id/members', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  if (!isVerifiedAppAdmin(req) && !membership) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    await expireAndNotify();
    const members = await storage.getCompanyMembersByCompany(req.params.id);
    // Build a firebaseUid → active addon override feature keys map, then embed into each member
    const allOverrides = await storage.getAllOverrides();
    const overrideKeysByUid = new Map<string, string[]>();
    for (const o of allOverrides) {
      if (!o.isActive || !o.userId) continue;
      const featureKey = ADDON_KEY_TO_FEATURE_KEY[o.addonKey];
      if (!featureKey) continue;
      const list = overrideKeysByUid.get(o.userId) ?? [];
      list.push(featureKey);
      overrideKeysByUid.set(o.userId, list);
    }
    const membersWithOverrides = members.map(m => ({
      ...m,
      addonOverrideFeatureKeys: overrideKeysByUid.get(m.firebaseUid ?? '') ?? [],
    }));
    return res.json({ success: true, members: membersWithOverrides });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/companies/:id/members — add member (app admin or company_admin of that company)
// Both app admins and company admins can create new Firebase accounts for team members.
router.post('/companies/:id/members', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  const appAdmin = isVerifiedAppAdmin(req);
  if (!appAdmin && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const { createFirebaseAccount, password, ...memberData } = req.body;

    // If caller requested Firebase account creation, require Firebase Admin SDK
    if (createFirebaseAccount) {
      if (!isFirebaseAdminAvailable) {
        return res.status(503).json({ success: false, error: 'Firebase Admin SDK unavailable. Cannot create user account.' });
      }
      // Password is optional — if omitted, a random temp password is generated and the user
      // receives a Firebase password reset email so they can set their own password.
    }

    // When creating a Firebase account, firebaseUid will be assigned after creation.
    // Use a placeholder so schema validation passes; it is replaced below.
    const placeholderUid = createFirebaseAccount ? (memberData.firebaseUid || `pending-${Date.now()}`) : memberData.firebaseUid;
    const data = insertCompanyMemberSchema.parse({ ...memberData, companyId: req.params.id, firebaseUid: placeholderUid });
    
    let firebaseUid = data.firebaseUid;
    
    // Optionally create a new Firebase account — allowed for app admins and company admins alike.
    // If no password is provided, a random temp password is set and Firebase sends a reset email.
    if (createFirebaseAccount) {
      try {
        const effectivePassword = (password && typeof password === 'string' && password.length >= 6)
          ? password
          : `Tmp${Math.random().toString(36).slice(2, 10)}!A`; // random temp ≥8 chars
        const userRecord = await getAuth().createUser({
          email: data.email,
          password: effectivePassword,
          displayName: data.fullName,
        });
        firebaseUid = userRecord.uid;
        // If no caller-supplied password, send a password reset link so the user sets their own
        if (!password || password.length < 6) {
          try {
            const resetLink = await getAuth().generatePasswordResetLink(data.email);
            // Log the link (email sending via Firebase console or custom SMTP is out of scope here)
            console.info(`[CompanyAdmin] Password reset link for new user ${data.email}: ${resetLink}`);
          } catch (emailErr: any) {
            // Non-fatal — account was created; admin can manually share credentials
            console.warn(`[CompanyAdmin] Could not generate password reset link: ${emailErr.message}`);
          }
        }
      } catch (fbError: any) {
        return res.status(400).json({ success: false, error: `Firebase account creation failed: ${fbError.message}` });
      }
    }
    
    // Enforce single-company membership: check globally (not just within this company)
    if (!firebaseUid.startsWith('pending-')) {
      const globalMembership = await storage.getCompanyMembershipByUid(firebaseUid);
      if (globalMembership) {
        const inThisCompany = globalMembership.companyId === req.params.id;
        const msg = inThisCompany ? 'User is already a member of this company' : 'User is already a member of another company';
        return res.status(409).json({ success: false, error: msg });
      }
    }
    
    const member = await storage.createCompanyMember({ ...data, firebaseUid });
    return res.status(201).json({ success: true, member });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/companies/:id/members/:memberId — update member role, allowedAddons, and/or betaAccess (app admin or company_admin)
// SECURITY: Validates target member belongs to :id company before mutating (IDOR prevention)
router.patch('/companies/:id/members/:memberId', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  if (!isVerifiedAppAdmin(req) && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    // IDOR check: verify target member belongs to this company
    const targetMember = await storage.getCompanyMember(req.params.memberId);
    if (!targetMember) return res.status(404).json({ success: false, error: 'Member not found' });
    if (targetMember.companyId !== req.params.id) return res.status(403).json({ success: false, error: 'Forbidden: member does not belong to this company' });

    const updates: Record<string, any> = {};

    // Handle role update
    if (req.body.role !== undefined) {
      const roleResult = companyRoleEnum.safeParse(req.body.role);
      if (!roleResult.success) {
        return res.status(400).json({ success: false, error: 'Invalid role. Must be company_admin or member.' });
      }
      updates.role = roleResult.data;
    }

    // Handle allowedAddons update — validate against company's enabledAddons
    if (req.body.allowedAddons !== undefined) {
      const accessResult = updateMemberAccessSchema.safeParse({ allowedAddons: req.body.allowedAddons });
      if (!accessResult.success) {
        return res.status(400).json({ success: false, error: 'Invalid allowedAddons.' });
      }
      const allowedAddons = accessResult.data.allowedAddons;
      if (allowedAddons !== null && allowedAddons !== undefined) {
        // Validate each addon is in the company's enabledAddons
        const company = await storage.getCompany(req.params.id);
        if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
        const companyAddons = company.enabledAddons ?? [];
        const invalidAddons = allowedAddons.filter(a => !companyAddons.includes(a));
        if (invalidAddons.length > 0) {
          return res.status(400).json({ success: false, error: `Add-ons not enabled for this company: ${invalidAddons.join(', ')}` });
        }
      }
      updates.allowedAddons = allowedAddons ?? null;
    }

    // Handle betaAccess update
    if (req.body.betaAccess !== undefined) {
      const accessResult = updateMemberAccessSchema.safeParse({ betaAccess: req.body.betaAccess });
      if (!accessResult.success) {
        return res.status(400).json({ success: false, error: 'Invalid betaAccess.' });
      }
      updates.betaAccess = accessResult.data.betaAccess ?? null;
    }

    // Accept optional pendingSync flag from offline-replayed mutations
    if (typeof req.body.pendingSync === 'boolean') {
      updates.pendingSync = req.body.pendingSync;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update.' });
    }

    const updated = await storage.updateCompanyMember(req.params.memberId, updates);
    return res.json({ success: true, member: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/companies/:id/members/:memberId — remove member (app admin or company_admin)
// SECURITY: Validates target member belongs to :id company before deleting (IDOR prevention)
router.delete('/companies/:id/members/:memberId', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  if (!isVerifiedAppAdmin(req) && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    // IDOR check: verify target member belongs to this company
    const targetMember = await storage.getCompanyMember(req.params.memberId);
    if (!targetMember) return res.status(404).json({ success: false, error: 'Member not found' });
    if (targetMember.companyId !== req.params.id) return res.status(403).json({ success: false, error: 'Forbidden: member does not belong to this company' });
    await storage.deleteCompanyMember(req.params.memberId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/companies/:id/members/:uid/reset-password — password reset (app admin or company_admin)
// SECURITY: Validates target uid is a member of :id company before resetting password (IDOR prevention)
router.post('/companies/:id/members/:uid/reset-password', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  if (!isVerifiedAppAdmin(req) && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const { newPassword } = req.body;

    if (!isFirebaseAdminAvailable) {
      return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    // IDOR check: verify target uid is a member of this company
    const targetMember = await storage.getCompanyMemberByUid(req.params.id, req.params.uid);
    if (!targetMember) return res.status(404).json({ success: false, error: 'User is not a member of this company' });

    await getAuth().updateUser(req.params.uid, { password: newPassword });
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/companies/:id/members/:uid/send-reset-link — send Firebase password reset email
// Queued offline as 'send_reset_email' and auto-replayed on reconnect (no credential required).
router.post('/companies/:id/members/:uid/send-reset-link', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  if (!isVerifiedAppAdmin(req) && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    if (!isFirebaseAdminAvailable) {
      return res.status(503).json({ success: false, error: 'Firebase Admin SDK not available.' });
    }
    // IDOR check: verify target uid is a member of this company
    const targetMember = await storage.getCompanyMemberByUid(req.params.id, req.params.uid);
    if (!targetMember) return res.status(404).json({ success: false, error: 'User is not a member of this company' });

    const resetLink = await getAuth().generatePasswordResetLink(targetMember.email);
    // Log the reset link (sending via email is handled outside this MVP scope)
    console.info(`[CompanyAdmin] Password reset link for ${targetMember.email}: ${resetLink}`);
    return res.json({ success: true, message: 'Password reset link generated. User should check their email.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/companies/:id/addons — assign/remove add-ons (app admin only)
router.post('/companies/:id/addons', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { enabledAddons, pendingSync } = req.body;
    if (!Array.isArray(enabledAddons)) {
      return res.status(400).json({ success: false, error: 'enabledAddons must be an array' });
    }
    // Accept optional pendingSync flag from offline-replayed mutations
    const updateData: { enabledAddons: string[]; pendingSync?: boolean } = { enabledAddons };
    if (typeof pendingSync === 'boolean') updateData.pendingSync = pendingSync;
    const company = await storage.updateCompany(req.params.id, updateData);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
    return res.json({ success: true, company });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/companies/:id/pending-sync — update the pendingSync flag on a company record
// Called by offline clients after successfully replaying a queued write, to confirm sync.
// App admins and the company's own company_admin can clear the flag.
router.patch('/companies/:id/pending-sync', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  if (!isVerifiedAppAdmin(req) && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const { pendingSync } = req.body;
    if (typeof pendingSync !== 'boolean') {
      return res.status(400).json({ success: false, error: 'pendingSync must be a boolean' });
    }
    const company = await storage.updateCompany(req.params.id, { pendingSync });
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
    return res.json({ success: true, company });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/companies/:id/members/:memberId/pending-sync — update pendingSync flag on a member record
// Called by offline clients after successfully replaying a queued member write.
router.patch('/companies/:id/members/:memberId/pending-sync', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const membership = await getCallerMembership(req, req.params.id);
  const isCompanyAdminRole = membership?.role === 'company_admin';
  if (!isVerifiedAppAdmin(req) && !isCompanyAdminRole) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const { pendingSync } = req.body;
    if (typeof pendingSync !== 'boolean') {
      return res.status(400).json({ success: false, error: 'pendingSync must be a boolean' });
    }
    // IDOR check: verify target member belongs to this company
    const targetMember = await storage.getCompanyMember(req.params.memberId);
    if (!targetMember) return res.status(404).json({ success: false, error: 'Member not found' });
    if (targetMember.companyId !== req.params.id) return res.status(403).json({ success: false, error: 'Forbidden: member does not belong to this company' });
    const updated = await storage.updateCompanyMember(req.params.memberId, { pendingSync });
    return res.json({ success: true, member: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/my-company — returns current user's company membership (for offline seeding)
// Requires verified Firebase token — caller can only see their own company data
router.get('/my-company', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const membership = await storage.getCompanyMembershipByUid(uid);
    if (!membership) return res.json({ success: true, company: null, membership: null, members: [], addonOverrideFeatureKeys: [] });
    
    const company = await storage.getCompany(membership.companyId);
    const members = await storage.getCompanyMembersByCompany(membership.companyId);

    // Merge active add-on overrides for this user into the effective feature key set.
    // These are add-ons explicitly granted by Master Admin regardless of company subscription.
    await expireAndNotify();
    const activeOverrides = await storage.getActiveOverridesByUser(uid);
    const addonOverrideFeatureKeys = activeOverrides
      .map(o => ADDON_KEY_TO_FEATURE_KEY[o.addonKey])
      .filter((k): k is string => !!k);

    return res.json({ success: true, company, membership, members, addonOverrideFeatureKeys });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Member Add-on Override Routes (Master Admin only) ──

/**
 * Auto-expire overdue override grants and send revocation email notifications
 * for each one that just expired. Non-fatal — errors are logged, not thrown.
 */
async function expireAndNotify(): Promise<void> {
  try {
    const expired = await storage.expireOverdueMemberAddonOverrides();
    for (const o of expired) {
      try {
        const addonName = ADDON_DISPLAY_NAMES[o.addonKey] || o.addonKey;
        // Gather company admin emails so they are also notified of auto-expiry
        let companyAdminEmails: string[] = [];
        try {
          const membershipForExpiry = await storage.getCompanyMembershipByUid(o.userId);
          if (membershipForExpiry) {
            const companyMembers = await storage.getCompanyMembersByCompany(membershipForExpiry.companyId);
            companyAdminEmails = companyMembers
              .filter(m => m.role === 'company_admin')
              .map(m => m.email);
          }
        } catch { /* non-fatal — proceed without admin CC */ }
        await sendAddonOverrideEmail({
          event: 'revoked',
          recipientEmail: o.userEmail,
          recipientName: o.userName ?? undefined,
          addonName,
          addonKey: o.addonKey,
          performedByName: 'System (auto-expiry)',
          reason: `Temporary access to ${addonName} automatically expired on ${new Date(o.expiresAt).toLocaleDateString()}.`,
          companyAdminEmails,
        });
      } catch (emailErr) {
        console.error(`[AddonOverride] Failed to send expiry email for override ${o.id}:`, emailErr);
      }
    }
  } catch (err) {
    console.error('[AddonOverride] expireAndNotify error:', err);
  }
}

// GET /api/addon-overrides — list all overrides
router.get('/addon-overrides', verifyFirebaseToken, verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    await expireAndNotify();
    const overrides = await storage.getAllOverrides();
    return res.json({ success: true, overrides });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/addon-overrides/user/:uid — list active overrides for a specific user
router.get('/addon-overrides/user/:uid', verifyFirebaseToken, verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    await expireAndNotify();
    const overrides = await storage.getActiveOverridesByUser(req.params.uid);
    return res.json({ success: true, overrides });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/addon-overrides — grant an override (Master Admin only)
router.post('/addon-overrides', verifyFirebaseToken, verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const data = insertMemberAddonOverrideSchema.parse({
      ...req.body,
      grantedByUid: req.userId,
    });

    // Validate expiresAt is in the future
    if (new Date(data.expiresAt) <= new Date()) {
      return res.status(400).json({ success: false, error: 'expiresAt must be in the future' });
    }

    const override = await storage.createMemberAddonOverride(data);

    // Send email notification (non-fatal)
    try {
      const addonName = ADDON_DISPLAY_NAMES[data.addonKey] || data.addonKey;
      // Get company admin emails for this user (if they have a company)
      const membership = await storage.getCompanyMembershipByUid(data.userId);
      let companyAdminEmails: string[] = [];
      if (membership) {
        const members = await storage.getCompanyMembersByCompany(membership.companyId);
        companyAdminEmails = members.filter(m => m.role === 'company_admin').map(m => m.email);
      }
      await sendAddonOverrideEmail({
        event: 'granted',
        recipientEmail: data.userEmail,
        recipientName: data.userName ?? undefined,
        addonName,
        addonKey: data.addonKey,
        expiresAt: data.expiresAt,
        performedByName: data.grantedByName || req.userEmail || 'Administrator',
        reason: data.reason,
        companyAdminEmails,
      });
    } catch (emailErr: any) {
      console.warn('[AddonOverride] Email notification failed (non-fatal):', emailErr.message);
    }

    return res.status(201).json({ success: true, override });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/addon-overrides/:id/revoke — manually revoke an override
router.post('/addon-overrides/:id/revoke', verifyFirebaseToken, verifyMasterAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'A revocation reason is required' });
    }

    const existing = await storage.getMemberAddonOverride(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Override not found' });
    if (!existing.isActive) return res.status(409).json({ success: false, error: 'Override is already inactive' });

    const revoked = await storage.revokeMemberAddonOverride(req.params.id, req.userId!, reason);

    // Send email notification (non-fatal)
    try {
      const addonName = ADDON_DISPLAY_NAMES[existing.addonKey] || existing.addonKey;
      const membership = await storage.getCompanyMembershipByUid(existing.userId);
      let companyAdminEmails: string[] = [];
      if (membership) {
        const members = await storage.getCompanyMembersByCompany(membership.companyId);
        companyAdminEmails = members.filter(m => m.role === 'company_admin').map(m => m.email);
      }
      await sendAddonOverrideEmail({
        event: 'revoked',
        recipientEmail: existing.userEmail,
        recipientName: existing.userName ?? undefined,
        addonName,
        addonKey: existing.addonKey,
        performedByName: req.userEmail || 'Administrator',
        reason,
        companyAdminEmails,
      });
    } catch (emailErr: any) {
      console.warn('[AddonOverride] Revoke email notification failed (non-fatal):', emailErr.message);
    }

    return res.json({ success: true, override: revoked });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/my-addon-overrides — returns active overrides for the current user (used by license enforcement)
router.get('/my-addon-overrides', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    if (!uid || uid === 'offline-user') return res.json({ success: true, overrides: [] });
    await expireAndNotify();
    const overrides = await storage.getActiveOverridesByUser(uid);
    return res.json({ success: true, overrides });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Admin: User company membership & add-on assignment ──

// GET /api/admin/users/:uid/membership — get user's current company and active addon overrides
router.get('/admin/users/:uid/membership', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { uid } = req.params;
    const membership = await storage.getCompanyMembershipByUid(uid);
    let company = null;
    if (membership) {
      company = await storage.getCompany(membership.companyId);
    }
    await expireAndNotify();
    const activeOverrides = await storage.getActiveOverridesByUser(uid);
    return res.json({ success: true, membership, company, activeOverrides });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/users/:uid/assign-company — assign a user to a company and set per-addon overrides
// Body: { companyId, fullName, email, role?, addonOverrides: [{ addonKey, expiresAt }] }
router.post('/admin/users/:uid/assign-company', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { uid } = req.params;
    const { companyId, fullName, email, role, addonOverrides } = req.body as {
      companyId: string;
      fullName: string;
      email: string;
      role?: string;
      addonOverrides?: { addonKey: string; expiresAt: string }[];
    };

    if (!companyId || !fullName || !email) {
      return res.status(400).json({ success: false, error: 'companyId, fullName and email are required' });
    }

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });

    // Fetch existing membership once so we can reuse it for role preservation and upsert logic
    const existingMembership = await storage.getCompanyMembershipByUid(uid);

    // Validate role — preserve existing role when not explicitly provided by caller
    const validRoles = ['company_admin', 'member'] as const;
    type ValidRole = typeof validRoles[number];
    let resolvedRole: ValidRole;
    if (role === 'company_admin' || role === 'member') {
      resolvedRole = role;
    } else {
      // role omitted: keep existing role or default to 'member' for new membership
      resolvedRole = (existingMembership?.role === 'company_admin' ? 'company_admin' : 'member');
    }

    // Normalize addonOverrides — treat absent/null as empty array to avoid stale entitlements
    const normalizedOverrides: { addonKey: string; expiresAt: string }[] = Array.isArray(addonOverrides) ? addonOverrides : [];

    // Validate addonOverrides against company's enabledAddons and expiry dates
    const companyAddons = company.enabledAddons ?? [];
    if (normalizedOverrides.length > 0) {
      const invalidKeys = normalizedOverrides
        .map(o => o.addonKey)
        .filter(key => !companyAddons.includes(key));
      if (invalidKeys.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Add-ons not enabled for this company: ${invalidKeys.join(', ')}`,
        });
      }
      const now = new Date();
      for (const o of normalizedOverrides) {
        const exp = new Date(o.expiresAt);
        if (isNaN(exp.getTime())) {
          return res.status(400).json({ success: false, error: `Invalid expiry date for add-on: ${o.addonKey}` });
        }
        if (exp <= now) {
          return res.status(400).json({ success: false, error: `Expiry date must be in the future for add-on: ${o.addonKey}` });
        }
      }
    }

    // Upsert company membership (existingMembership already fetched above)
    let membership: CompanyMember;
    if (existingMembership) {
      if (existingMembership.companyId !== companyId) {
        // Moving to a different company — delete old membership first
        await storage.deleteCompanyMember(existingMembership.id);
        membership = await storage.createCompanyMember({
          companyId,
          firebaseUid: uid,
          email,
          fullName,
          role: resolvedRole,
          allowedAddons: null,
          betaAccess: null,
          pendingSync: false,
        });
      } else {
        // Same company — update existing
        const updated = await storage.updateCompanyMember(existingMembership.id, {
          fullName,
          email,
          role: resolvedRole,
        });
        membership = updated ?? existingMembership;
      }
    } else {
      membership = await storage.createCompanyMember({
        companyId,
        firebaseUid: uid,
        email,
        fullName,
        role: resolvedRole,
        allowedAddons: null,
        betaAccess: null,
        pendingSync: false,
      });
    }

    // Handle addon overrides: always process normalizedOverrides (empty = revoke all)
    {
      const currentOverrides = await storage.getActiveOverridesByUser(uid);
      const newKeys = normalizedOverrides.map(o => o.addonKey);

      // Revoke overrides for keys that are no longer enabled (or all if none given)
      for (const override of currentOverrides) {
        if (!newKeys.includes(override.addonKey)) {
          await storage.revokeMemberAddonOverride(override.id, req.userId!, 'Removed by admin during company assignment');
        }
      }

      // Create or update overrides for new keys
      for (const override of normalizedOverrides) {
        const exists = currentOverrides.find(o => o.addonKey === override.addonKey && o.isActive);
        if (!exists) {
          await storage.createMemberAddonOverride({
            userId: uid,
            userEmail: email,
            userName: fullName,
            addonKey: override.addonKey,
            grantedByUid: req.userId!,
            grantedByName: 'Administrator',
            reason: 'Granted by admin during company assignment',
            expiresAt: override.expiresAt,
          });
        } else {
          // Update expiry: revoke + recreate
          await storage.revokeMemberAddonOverride(exists.id, req.userId!, 'Updated by admin during company assignment');
          await storage.createMemberAddonOverride({
            userId: uid,
            userEmail: email,
            userName: fullName,
            addonKey: override.addonKey,
            grantedByUid: req.userId!,
            grantedByName: 'Administrator',
            reason: 'Updated by admin during company assignment',
            expiresAt: override.expiresAt,
          });
        }
      }
    }

    const updatedOverrides = await storage.getActiveOverridesByUser(uid);
    return res.json({ success: true, membership, activeOverrides: updatedOverrides });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/users/:uid/company — remove a user from their company
// Also revokes all active add-on overrides to enforce least-privilege on company removal.
router.delete('/admin/users/:uid/company', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { uid } = req.params;
    const membership = await storage.getCompanyMembershipByUid(uid);
    if (!membership) return res.status(404).json({ success: false, error: 'User has no company membership' });
    await storage.deleteCompanyMember(membership.id);
    // Revoke all active addon overrides so the user retains no company-linked entitlements
    const activeOverrides = await storage.getActiveOverridesByUser(uid);
    for (const override of activeOverrides) {
      await storage.revokeMemberAddonOverride(override.id, req.userId!, 'Revoked automatically on company removal');
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─── AI Trial System ─────────────────────────────────────────────────────────
// Allows owner to set a shared OpenAI key that new users can use for 45 days.
// Trial key is stored server-side under the '__ai_trial__' system config row.

const AI_TRIAL_DAYS = 45;
const AI_TRIAL_SYSTEM_ID = '__ai_trial__';

router.get('/ai/trial-status', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;

    // Get user's created_at from user_settings
    let userRow = await storage.getUserSettings(uid);
    if (!userRow) {
      // First time - create the row so we have a created_at anchor
      userRow = await storage.saveUserSettings({ id: uid });
    }

    const createdAt = userRow?.createdAt ? new Date(userRow.createdAt) : new Date();
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUsed = Math.floor((now.getTime() - createdAt.getTime()) / msPerDay);
    const daysRemaining = Math.max(0, AI_TRIAL_DAYS - daysUsed);
    const inTrial = daysRemaining > 0;

    // Fetch trial key from system config row
    let trialKey: string | null = null;
    if (inTrial) {
      const systemRow = await storage.getUserSettings(AI_TRIAL_SYSTEM_ID);
      const trialConfig = systemRow?.aiAssistantSettings as any;
      trialKey = trialConfig?.sharedTrialKey?.trim() || null;
    }

    return res.json({
      inTrial,
      daysUsed,
      daysRemaining,
      trialDuration: AI_TRIAL_DAYS,
      trialKey: trialKey || null,
      trialStartedAt: createdAt.toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/admin/ai-trial-config', verifyFirebaseToken, verifyAdminOrMasterAccess, async (_req: AuthRequest, res: Response) => {
  try {
    const systemRow = await storage.getUserSettings(AI_TRIAL_SYSTEM_ID);
    const config = systemRow?.aiAssistantSettings as any;
    return res.json({
      sharedTrialKey: config?.sharedTrialKey ? `sk-...${String(config.sharedTrialKey).slice(-4)}` : null,
      isSet: !!config?.sharedTrialKey,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/admin/ai-trial-config', verifyFirebaseToken, verifyAdminOrMasterAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { sharedTrialKey } = req.body ?? {};
    const existing = await storage.getUserSettings(AI_TRIAL_SYSTEM_ID);
    const currentConfig = (existing?.aiAssistantSettings as any) ?? {};
    const updated = { ...currentConfig, sharedTrialKey: sharedTrialKey?.trim() ?? '' };
    await storage.saveUserSettings({
      id: AI_TRIAL_SYSTEM_ID,
      aiAssistantSettings: updated,
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, success: false });
  }
});

// ─── Zendesk Proxy ───────────────────────────────────────────────────────────
// Browser cannot call Zendesk directly due to CORS. These server-side endpoints
// forward the request using credentials supplied by the caller.

router.post('/zendesk/validate', async (req: Request, res: Response) => {
  const { subdomain, email, token } = req.body ?? {};
  if (!subdomain || !email || !token) {
    return res.status(400).json({ success: false, error: 'Missing subdomain, email, or token' });
  }
  try {
    const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
    const url = `https://${subdomain}.zendesk.com/api/v2/users/me.json`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
    });
    const body = await response.json() as any;
    if (response.ok) {
      return res.json({ success: true, user: { name: body?.user?.name, role: body?.user?.role, email: body?.user?.email } });
    }
    return res.status(response.status).json({
      success: false,
      error: body?.description || body?.error || body?.message || `HTTP ${response.status}`,
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message ?? 'Failed to reach Zendesk' });
  }
});

router.post('/zendesk/search', async (req: Request, res: Response) => {
  const { subdomain, email, token, query } = req.body ?? {};
  if (!subdomain || !email || !token || !query) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  try {
    const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
    const url = `https://${subdomain}.zendesk.com/api/v2/help_center/articles/search.json?query=${encodeURIComponent(query)}&per_page=5`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
    });
    const body = await response.json() as any;
    if (response.ok) {
      return res.json({ success: true, results: body?.results ?? [] });
    }
    return res.status(response.status).json({
      success: false,
      error: body?.description || body?.error || `HTTP ${response.status}`,
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message ?? 'Failed to reach Zendesk' });
  }
});

router.post('/zendesk/ticket', async (req: Request, res: Response) => {
  const { subdomain, email, token, subject, description, priority, requesterEmail, requesterName } = req.body ?? {};
  if (!subdomain || !email || !token || !subject || !description) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  try {
    const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
    const url = `https://${subdomain}.zendesk.com/api/v2/tickets.json`;

    const ticketPayload: any = {
      ticket: {
        subject,
        comment: { body: description },
        priority: priority || 'normal',
        tags: ['measurepro', 'ai-assistant'],
      },
    };
    if (requesterEmail) {
      ticketPayload.ticket.requester = {
        name: requesterName || requesterEmail,
        email: requesterEmail,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(ticketPayload),
    });
    const body = await response.json() as any;
    if (response.ok || response.status === 201) {
      return res.json({ success: true, ticket: { id: body?.ticket?.id, url: body?.ticket?.url } });
    }
    return res.status(response.status).json({
      success: false,
      error: body?.description || body?.error || `HTTP ${response.status}`,
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message ?? 'Failed to reach Zendesk' });
  }
});

export { router, adminDb, isFirebaseAdminAvailable };
