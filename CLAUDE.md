# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MeasurePRO Desktop is a professional surveying and measurement Electron application. It's an offline-first desktop app for field data collection with hardware integration (laser distance meters, GNSS receivers, LiDAR, cameras, Insta360), AI-powered detection, real-time convoy coordination, and RoadScope cloud sync.

## Commands

```bash
# Development — Vite dev server + Electron (hot reload)
npm run electron:dev

# Vite dev server only (renderer, port 5173)
npm run dev

# Build frontend for production (outputs to dist/)
npm run build

# Build Windows installer (runs npm run build + electron-builder)
npm run electron:build

# Start Electron in production mode
npm run start

# TypeScript type check (no emit)
npm run type-check

# Run all tests
npx vitest run

# Run a single test file
npx vitest run src/path/to/file.test.ts

# Run tests in watch mode
npx vitest
```

## Architecture

**Platform:** Electron 35 (main process in `electron/main.cjs`, preload in `electron/preload.cjs`)  
**Frontend:** React 18 + TypeScript (strict) + Vite + Tailwind CSS  
**State:** Zustand stores + React Query for server cache + React Context for auth/theme  
**Database:** IndexedDB (offline-first local), Firebase Firestore (cloud sync)  
**Validation:** Zod schemas in `shared/schema.ts`  
**Testing:** Vitest + happy-dom + React Testing Library  
**Auto-update:** electron-updater, publishes to GitHub Releases (`SolTecInnov/measurepro-releases`)  
**Licensing:** Offline HMAC-SHA256 signed keys validated by `electron/license/engine.cjs` — no server dependency. 7-day trial for new installs.

### Path Aliases

- `@/` → `src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Key Directories

- `electron/` — Electron main process, preload, license engine, IPC handlers
- `src/components/` — React components organized by feature domain (ai, camera, convoy, gnss, lidar, liveSupport, measurement, survey, licensing, ui, etc.)
- `src/lib/` — Business logic, services, and utilities organized by domain
- `src/lib/stores/` — Zustand state stores
- `src/hooks/` — Custom React hooks (useLicenseEnforcement, useLicenseCheck, etc.)
- `src/lib/liveSupport/` — Live Support WebRTC client, peer manager, store
- `src/lib/roadscope/` — RoadScope API client and sync service
- `src/lib/licensing/` — Firebase-based licensing features and cloud functions API
- `shared/` — Shared types and Zod schemas

### Code Organization Pattern

Each feature domain follows a cohesive structure:
- Components in `src/components/<domain>/`
- Library/logic in `src/lib/<domain>/`
- Types colocated in domain directories
- Tests alongside source files (`*.test.ts` / `*.test.tsx`)

### Key Patterns

- **Offline-first:** Data stored in IndexedDB first, synced to Firebase in background via Web Workers
- **Electron IPC:** Hardware access (serial ports, screen capture, file I/O) goes through main process via `electron/preload.cjs` contextBridge
- **Lazy loading:** Heavy pages/libraries (TensorFlow, Three.js) loaded with `React.lazy()` in App.tsx
- **Error boundaries:** `ErrorBoundary` and `LazyLoadErrorBoundary` wrap route pages
- **Hardware abstraction:** SerialPort (Node.js) for lasers/GPS in Electron, Web Serial API fallback for PWA
- **License gating:** `FeatureProtectedRoute` + `useLicenseEnforcement` hook. Electron uses offline HMAC keys (`electronLicenseStore`), web uses Firebase cloud functions
- **UI components:** Reusable design system in `src/components/ui/` (shadcn/ui pattern)

### Hardware Support (Electron)

- **Lasers:** LDM71 (ASCII), RSA (3-byte binary), SolTec binary — via SerialPort in main process
- **GPS:** USB serial NMEA, Bluetooth NMEA, Swift Navigation Duro (RTK-GNSS via TCP)
- **Cameras:** MediaDevices API, Insta360 X5 native integration
- **Screen capture:** `setDisplayMediaRequestHandler` for Live Support
- **Drone import:** SD card scanning and photo matching

### License System

- Machine ID: SHA-256 of MAC addresses + hostname + CPU, formatted `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`
- Keys: base64url-encoded JSON signed with HMAC-SHA256, validated entirely offline
- Types: admin (all access), enterprise, commercial, pro, partner (addon-based), trial/demo/beta (basic + addons)
- Trial: 7 days + 2 days grace on first install, no key needed
- Key generation: LicensePRO (local Electron app) or LicensePRO Web (Replit)
- Addon IDs that MeasurePRO enforces: `ai_plus`, `envelope`, `convoy`, `route_analysis`, `swept_path`, `calibration`, `3d_view`
