# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MeasurePro is a full-stack professional surveying and measurement platform. It's a PWA-first, offline-capable application for field data collection with AI-powered analysis, hardware integration (laser, GNSS, LiDAR, cameras), and real-time collaboration.

## Commands

```bash
# Development (runs backend + frontend concurrently)
npm run dev

# Frontend only (Vite on port 5000)
npm run dev:frontend

# Backend only (tsx watch on port 3001)
npm run dev:backend

# Build for production
npm run build

# Start production server
npm run start

# Lint (strict, zero warnings allowed)
npm run lint

# Run all tests
npx vitest run

# Run a single test file
npx vitest run src/path/to/file.test.ts

# Run tests in watch mode
npx vitest

# Push database schema changes
npm run db:push
```

## Architecture

**Frontend:** React 18 + TypeScript (strict) + Vite + Tailwind CSS  
**Backend:** Express.js 5 + TypeScript (server/index.ts, port 3001)  
**State:** Zustand stores + React Query for server cache + React Context for auth/theme  
**Database:** IndexedDB (offline-first local), Firebase Firestore (cloud sync), PostgreSQL via Drizzle ORM (admin/licensing/subscriptions)  
**Validation:** Zod schemas in `shared/schema.ts`  
**Testing:** Vitest + happy-dom + React Testing Library  
**Real-time:** WebSocket via ConvoyHub (`server/convoyHub.ts`)

### Path Aliases

- `@/` → `src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Key Directories

- `src/components/` — React components organized by feature domain (ai, camera, convoy, gnss, lidar, measurement, survey, ui, etc.)
- `src/lib/` — Business logic, services, and utilities organized by domain
- `src/stores/` and `src/lib/stores/` — Zustand state stores
- `src/hooks/` — Custom React hooks
- `server/` — Express backend (routes.ts is the main API file, storage.ts for cloud storage)
- `shared/` — Shared types and Zod schemas used by both client and server
- `db/` — Drizzle ORM schema and database config

### Code Organization Pattern

Each feature domain follows a cohesive structure:
- Components in `src/components/<domain>/`
- Library/logic in `src/lib/<domain>/`
- Types colocated in domain directories
- Tests alongside source files (`*.test.ts` / `*.test.tsx`)

### Key Patterns

- **Offline-first:** Data stored in IndexedDB first, synced to Firebase in background via Web Workers
- **Lazy loading:** Heavy pages/libraries (TensorFlow, Three.js) loaded with `React.lazy()` in App.tsx
- **Error boundaries:** `ErrorBoundary` and `LazyLoadErrorBoundary` wrap route pages
- **Hardware abstraction:** Web Serial API for lasers, Web Bluetooth for GPS, MediaDevices for cameras
- **License gating:** `FeatureProtectedRoute` component controls access to premium features
- **UI components:** Reusable design system in `src/components/ui/`
