import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { router } from './routes.js';
import { convoyHub } from './convoyHub.js';
import { initSlaveAppPairing, shutdownSlaveAppPairing } from './slaveAppPairing.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// CRITICAL: Fast health check endpoints MUST be first (before any middleware)
// Deployment systems need instant 200 responses without expensive operations

// Dedicated health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested at /health');
  res.status(200).send('OK');
});

// Root endpoint - respond instantly to health checks, serve frontend to browsers
app.get('/', (req, res, next) => {
  const acceptHeader = req.headers.accept || '';
  const userAgent = req.headers['user-agent'] || '';
  
  // Health check detection: deployment systems typically don't accept text/html
  // or use HEAD requests, while browsers explicitly request text/html
  const isHealthCheck = 
    req.method === 'HEAD' ||  // HEAD requests are health checks
    !acceptHeader.includes('text/html') ||  // Non-browser requests
    userAgent.includes('curl') ||  // curl/wget health checks
    userAgent.includes('health');  // Explicit health check agents
  
  if (isHealthCheck) {
    console.log('🏥 Root health check detected (fast path)');
    return res.status(200).send('OK');
  }
  
  // Browser request - continue to frontend serving (slower path)
  next();
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize convoy hub with WebSocket server
convoyHub.initWebSocketServer(wss);

// Initialize slave app pairing system
initSlaveAppPairing(wss);

// CORS for production
app.use(cors({
  origin: true,
  credentials: true,
}));

// Increase body size limit for survey uploads with photos/videos
// Default is 100kb, but survey packages can be 10-50MB with media
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// API routes
app.use('/api', router);

// Serve static files from the Vite build
// __dirname is dist-server/server, so we need to go up two levels to reach dist/
const distPath = path.join(__dirname, '..', '..', 'dist');
// Root of the workspace — used as a fallback for large static assets that may
// not have been copied into dist/ during the build (e.g. the 37 MB bridge exe)
const workspaceRoot = path.join(__dirname, '..', '..');

// Verify dist path exists
if (!existsSync(distPath)) {
  console.error(`❌ ERROR: dist folder not found at ${distPath}`);
  console.error(`Current __dirname: ${__dirname}`);
  console.error(`Please run 'npm run build' before starting production server`);
  process.exit(1);
}

if (!existsSync(path.join(distPath, 'index.html'))) {
  console.error(`❌ ERROR: index.html not found in ${distPath}`);
  console.error(`The build may be incomplete. Please run 'npm run build'`);
  process.exit(1);
}

// ── Explicit large-file download route ──────────────────────────────────────
// The bridge .exe (37 MB) may or may not have been copied into dist/ during
// the Vite build depending on the deployment environment.  We search three
// locations so it always resolves, regardless of how the build was run.
app.get('/downloads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const candidates = [
    path.join(distPath, 'downloads', filename),        // 1. dist/ (Vite copy)
    path.join(workspaceRoot, 'public', 'downloads', filename), // 2. public/ (source)
    path.join(workspaceRoot, 'downloads', filename),   // 3. repo root fallback
  ];

  console.log(`📥 Download request: ${filename}`);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log(`✅ Serving download from: ${candidate}`);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(candidate);
    }
    console.log(`   ✗ Not found: ${candidate}`);
  }

  console.error(`❌ Download not found in any location: ${filename}`);
  res.status(404).json({ error: `File not found: ${filename}` });
});

// ── Cache-Control strategy ──────────────────────────────────────────────────
//
// Service worker + manifest  → no-store (browser must re-fetch every time so
//                               it can detect new deployments immediately)
// index.html (SPA shell)     → no-store (same reason; drives new SW detection)
// Versioned JS/CSS assets    → 1 year immutable (content-hashed filenames)
// Everything else            → no-cache (validate with ETag before serving)
//
// Without these headers Express defaults to ETag-only caching which can keep
// browsers on a stale sw.js for the lifetime of the ETag max-age, blocking
// every new deployment from reaching users.
// ────────────────────────────────────────────────────────────────────────────

// 1. Service worker files — NEVER cache
// NOTE: Express path-to-regexp v8+ rejects bare '*' wildcards.
//       Use a middleware that checks the path instead of a wildcard route.
app.use((req, res, next) => {
  const p = req.path;
  const isSwFile =
    p === '/sw.js' ||
    p === '/registerSW.js' ||
    (p.startsWith('/workbox-') && p.endsWith('.js'));
  if (!isSwFile) return next();

  const filePath = path.join(distPath, p);
  if (existsSync(filePath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.sendFile(filePath);
  } else {
    next();
  }
});

// 2. Web app manifest — short TTL
app.get(['/manifest.webmanifest', '/site.webmanifest'], (req, res) => {
  const filePath = path.join(distPath, req.path);
  if (existsSync(filePath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

// 3. Versioned assets (content-hashed filenames) — cache for 1 year
app.use('/assets', express.static(path.join(distPath, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// 4. All other static files — validate with ETag but allow short-term caching
app.use(express.static(distPath, {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    // index.html must never be cached so users always get the latest shell
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  },
}));

// SPA fallback - serve index.html for all non-API routes
app.use((req, res, next) => {
  // If it's not an API route and not a static file, serve index.html
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  convoyHub.shutdown();
  shutdownSlaveAppPairing();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Log startup attempt
console.log('⏳ Starting MeasurePRO production server...');
console.log(`📍 PORT: ${PORT}`);
console.log(`📂 Dist path: ${distPath}`);
const bridgeInDist = path.join(distPath, 'downloads', 'MeasurePROBridge.exe');
const bridgeInPublic = path.join(workspaceRoot, 'public', 'downloads', 'MeasurePROBridge.exe');
console.log(`🔍 Bridge exe in dist:   ${existsSync(bridgeInDist) ? '✅ found' : '❌ missing'} (${bridgeInDist})`);
console.log(`🔍 Bridge exe in public: ${existsSync(bridgeInPublic) ? '✅ found' : '❌ missing'} (${bridgeInPublic})`);
console.log(`🌍 Binding to: 0.0.0.0:${PORT}`);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MeasurePRO production server running on port ${PORT}`);
  console.log(`📡 Serving frontend from ${distPath}`);
  console.log(`🔌 WebSocket server ready for Convoy Guardian`);
  console.log(`✅ Server startup complete - ready for connections`);
});
