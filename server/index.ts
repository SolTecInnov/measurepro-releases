import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
// semver is listed as a direct dependency to prevent transitive resolution failures
// (firebase-admin → jsonwebtoken → semver). If semver were missing, the server would
// crash with "Cannot find module 'semver'". Having it here as a direct dep ensures
// it is always available regardless of dependency hoisting behaviour.
import 'semver';
import { router, adminDb } from './routes.js';
import { convoyHub } from './convoyHub.js';
import { storage } from './storage.js';
import { sendFinalDeletionNotice } from './services/emailService.js';
import { duroClient } from './gnss/duroClient.js';
import { gnssConfig } from './gnss/config.js';
import { GnssFirestore } from './gnss/firestore.js';
import { initSlaveAppPairing, shutdownSlaveAppPairing } from './slaveAppPairing.js';

const app = express();
const PORT = 3001;

// Build version for deployment verification
const BUILD_VERSION = '2025-11-25-v14-storage-fix';

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize convoy hub with WebSocket server
convoyHub.initWebSocketServer(wss);

// Initialize slave app pairing system
initSlaveAppPairing(wss);

// Initialize GNSS system
let gnssFirestore: GnssFirestore | null = null;
if (adminDb && gnssConfig.duroMode === 'tcp') {
  gnssFirestore = new GnssFirestore(adminDb);
  
  // Start Duro TCP client
  console.log(`[GNSS] Starting Duro TCP client (${gnssConfig.duroTcpHost}:${gnssConfig.duroTcpPort})...`);
  duroClient.connect();
  
  // Broadcast GNSS samples via WebSocket
  duroClient.on('sample', async (sample) => {
    try {
      // Save to Firestore
      await gnssFirestore!.insertSample(sample);
      
      // Broadcast to WebSocket clients
      if (gnssConfig.wsBroadcastGnss) {
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'gnss_sample',
              data: sample,
            }));
          }
        });
      }
    } catch (error) {
      console.error('[GNSS] Failed to save sample:', error);
    }
  });
  
  duroClient.on('connected', () => {
    console.log('[GNSS] ✅ Duro connected');
  });
  
  duroClient.on('disconnected', () => {
    console.log('[GNSS] ⚠️ Duro disconnected');
  });
  
  duroClient.on('error', (error) => {
    console.error('[GNSS] Duro error:', error.message);
  });
} else if (gnssConfig.duroMode === 'disabled') {
  console.log('[GNSS] Duro client disabled (DURO_MODE=disabled)');
} else {
  console.log('[GNSS] Firebase not available - GNSS features disabled');
}

app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:3000'],
  credentials: true,
}));

// Increase body size limit for RoadScope routes (POIs with base64 images can be large)
app.use('/api/roadscope', express.json({ limit: '50mb' }));

// Default body parser for other routes
app.use(express.json({ limit: '10mb' }));

app.use('/api', router);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Payment server is running' });
});

// Build version endpoint for deployment verification
app.get('/api/version', (req, res) => {
  res.json({ 
    version: BUILD_VERSION,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  convoyHub.shutdown();
  shutdownSlaveAppPairing();
  duroClient.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Payment server running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for localhost:3000 and localhost:5000`);
  console.log(`🔌 WebSocket server ready for Convoy Guardian`);
  
  // Optional: Automated cleanup cron job (runs every 24 hours)
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  
  setInterval(async () => {
    try {
      console.log('🧹 Running scheduled account cleanup...');
      
      const { expiredPaused, expiredCancelled } = await storage.enforceGracePeriods();
      const allExpiredEmails = [...expiredPaused, ...expiredCancelled];
      
      if (allExpiredEmails.length === 0) {
        console.log('✅ No expired accounts to clean up');
      } else {
        console.log(`Found ${allExpiredEmails.length} expired accounts to delete`);
        
        // Send final deletion notices
        for (const email of allExpiredEmails) {
          try {
            const userProgress = await storage.getSignupProgressByEmail(email);
            if (userProgress) {
              const subscriptionType = expiredPaused.includes(email) ? 'paused' : 'cancelled';
              const userName = (userProgress.step1Data as any)?.name || email;
              await sendFinalDeletionNotice(
                email,
                userName,
                subscriptionType as 'paused' | 'cancelled'
              );
              console.log(`✅ Sent final deletion notice to: ${email}`);
            }
          } catch (error: any) {
            console.error(`⚠️ Failed to send final deletion notice to ${email}:`, error);
          }
        }
        
        // Delete expired user data (pass explicit list to prevent race conditions)
        const deletedUsers = await storage.deleteExpiredUserData(allExpiredEmails);
        console.log(`✅ Subscription cleanup completed: Deleted ${deletedUsers.length} expired user accounts`);
      }

      // Also clean up signup_progress rows that have been in_progress for more than 48 hours
      try {
        const incompleteResult = await storage.cleanupIncompleteSignups(48);
        if (incompleteResult.deletedCount > 0) {
          console.log(`🧹 Incomplete signup cleanup: Deleted ${incompleteResult.deletedCount} abandoned wizard session(s) older than 48h`);
        } else {
          console.log('✅ No stale incomplete signups to clean up');
        }
      } catch (incompleteErr: any) {
        console.error('⚠️ Incomplete signup cleanup failed:', incompleteErr);
      }
    } catch (error: any) {
      console.error('❌ Scheduled cleanup failed:', error);
    }
  }, CLEANUP_INTERVAL);
  
  console.log(`⏰ Automated cleanup cron job scheduled (runs every 24 hours)`);
});
