import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';

// Admin email addresses
const ADMIN_EMAIL = 'admin@soltec.ca';
const MASTER_ADMIN_EMAIL = 'jfprince@soltec.ca';

// Admin UIDs for more secure admin authentication
// TODO: Migrate to Firebase custom claims for more scalable admin management
const ADMIN_UIDS: string[] = process.env.ADMIN_UIDS 
  ? process.env.ADMIN_UIDS.split(',').map(uid => uid.trim())
  : [];

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  /** True if the verified Firebase token has the admin custom claim or is a known admin email */
  isAdmin?: boolean;
}

/**
 * Middleware to verify admin access
 * SECURITY: Uses strict UID-based authentication when ADMIN_UIDS is configured
 * Falls back to email check only when ADMIN_UIDS is not configured
 * TODO: Migrate to Firebase custom claims for more scalable admin management
 */
export const verifyAdminAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // SECURITY FIX: If ADMIN_UIDS is configured, ONLY check UIDs (strict mode)
    // This prevents email-based bypass when UID allowlist is configured
    if (ADMIN_UIDS.length > 0) {
      if (!ADMIN_UIDS.includes(decodedToken.uid)) {
        console.warn('❌ Admin access denied - UID not in allowlist:', decodedToken.uid);
        return res.status(403).json({
          success: false,
          error: 'Admin access denied',
        });
      }
    } else {
      // Fallback to email check only if ADMIN_UIDS not configured
      if (decodedToken.email !== ADMIN_EMAIL) {
        console.warn('❌ Admin access denied - email mismatch:', decodedToken.email);
        return res.status(403).json({
          success: false,
          error: 'Admin access denied',
        });
      }
    }

    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error: any) {
    console.error('Admin verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token',
    });
  }
};

/**
 * Middleware to verify admin access via either:
 * 1. Master admin email (jfprince@soltec.ca)
 * 2. Firebase custom claim admin:true (set by Admin SDK)
 * Used for user-management admin endpoints (create user, reset password, update subscription).
 */
export const verifyAdminOrMasterAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);

    const isMasterAdmin = decodedToken.email === MASTER_ADMIN_EMAIL;
    const hasAdminClaim = decodedToken['admin'] === true;

    if (!isMasterAdmin && !hasAdminClaim) {
      console.warn('❌ Admin access denied:', decodedToken.email, 'claim:', decodedToken['admin']);
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error: any) {
    console.error('Admin verification error:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }
};

/**
 * Middleware to verify master admin access (jfprince@soltec.ca only)
 * Used for sensitive operations like pricing management and mass email sending
 * SECURITY: This is the ONLY middleware that should be used for endpoints that can send mass emails
 */
export const verifyMasterAdminAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    
    if (decodedToken.email !== MASTER_ADMIN_EMAIL) {
      console.warn('❌ Master admin access denied - email mismatch:', decodedToken.email);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Master admin access required',
        message: 'Only master admin (jfprince@soltec.ca) can access this endpoint',
      });
    }

    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error: any) {
    console.error('Master admin verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token',
    });
  }
};
