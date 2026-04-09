# MeasurePRO v16.0.7 — Full Audit Report

**Date:** 2026-04-08
**Audited by:** Claude Code (5 parallel agents)
**Scope:** Security, Dead Code, Architecture, Hardware/IPC, UI/UX

---

## CRITICAL (Fix before next release)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **`webSecurity: false` in Electron** | `electron/main.cjs:34` | Disables CORS/origin policy — opens door to cross-origin attacks |
| 2 | **Unrestricted `file:write` IPC** — no path validation | `electron/main.cjs:318-321` | Arbitrary file write to any disk location |
| 3 | **Client-side passwords in bundle** — `AdminPRO2025`, `SolTec1234`, `SolTec` | `.env` VITE_* vars baked into JS | Trivially extractable from DevTools or decompiled bundle |
| 4 | **Competitor brand names in UI** — "RSA", "Jenoptik" visible to users | `LaserQuickStartPage.tsx:157,164,346`, `FieldReferencePage.tsx:397`, `aiAssistant.ts:590` | Violates confidentiality rules |
| 5 | **Missing IPC handlers** — 8 laser+GNSS channels exposed in preload but unimplemented | `electron/preload.cjs:50-113` vs `electron/main.cjs` | Laser & Duro GNSS completely non-functional in Electron mode |
| 6 | **Insta360 & Drone services never initialized** — defined but never started | `electron/main.cjs` missing `require()` + `startPolling()` | Camera & drone detection dead in Electron |
| 7 | **Offline auth trusts client headers** — `x-user-id`/`x-user-email` accepted without verification | `server/routes.ts:201-246` | User impersonation / privilege escalation |

## HIGH (Fix soon)

| # | Issue | Location |
|---|-------|----------|
| 8 | **No `before-quit` cleanup** — serial ports, TCP sockets, polling timers never stopped | `electron/main.cjs:390-392` |
| 9 | **`dangerouslySetInnerHTML` without DOMPurify** (3 locations) | `TermsPage.tsx:173`, `MarketingPage.tsx:344`, `RawPayloadInspector.tsx:346` |
| 10 | **Hardcoded admin emails** in server auth | `server/routes.ts:286-287`, `server/middleware/adminAuth.ts:5-6` |
| 11 | **564 uses of `any` type**, 149 `as any` casts | 158+ files |
| 12 | **30+ bare `.catch(() => {})` handlers** — silent failure, impossible to debug | `App.tsx`, `AuthContext.tsx`, and 28+ more |
| 13 | **Monolithic components**: Settings.tsx (2,088 lines), App.tsx (1,548), LiveCamera.tsx (1,151) | |
| 14 | **669 console.log/warn/error statements** in production code | Across entire `src/` |
| 15 | **SurveyForm submit has no loading state** — user can double-click and create duplicates | `SurveyForm.tsx:157-193` |

## MEDIUM

| # | Issue | Location |
|---|-------|----------|
| 16 | **Duplicate router libraries** — React Router + Wouter (only 3 files use Wouter) | `package.json` |
| 17 | **2 unused npm deps** — `@microsoft/microsoft-graph-client`, `@neondatabase/serverless` | `package.json` |
| 18 | **10 sound files referenced but don't exist** on disk (fallback works) | `src/lib/sounds.ts:76-85` |
| 19 | **Production build has `minify: false`** — larger bundle, slower startup | `vite.config.ts:40` |
| 20 | **Legacy C# Jenoptik code** (~2MB) sitting in `src/assets/jenoptik lds-30/` | Should be in archive, not src |
| 21 | **Serial writer `releaseLock()` not in finally block** — can leak on close error | `src/lib/serial.ts:556-563` |
| 22 | **GPS buffer overflow truncates mid-NMEA sentence** | `serialGPSReader.ts:26-29` |
| 23 | **Duro GNSS: no fallback to HTTP if IPC fails** — fails silently | `duroGpsService.ts:365-397` |
| 24 | **No CSP/security headers** on Express server | `server/index.ts` |
| 25 | **`type-check` not in build pipeline** — TypeScript errors don't block builds | `package.json` scripts |

## LOW

| # | Issue | Location |
|---|-------|----------|
| 26 | Missing `aria-label` on icon-only buttons | Multiple components |
| 27 | Index-based React keys in 15+ components | Various `.map((item, i) => <div key={i}>` |
| 28 | `noUnusedLocals`/`noUnusedParameters` disabled in tsconfig | `tsconfig.app.json:28-29` |
| 29 | 50+ "toast suppressed" comments leftover from refactoring | Various files |
| 30 | Square payment hardcoded to `sandbox` environment | `server/routes.ts:110` |

## What's Working Well

- Laser protocol parsing — LDM71 ASCII driver is robust, edge cases handled
- Auto-Capture state machine (sky-object-sky) — solid implementation
- Amplitude filter — proper hysteresis and windowing
- contextBridge/contextIsolation — Electron preload security correct
- Offline-first architecture — IndexedDB + Firebase sync well-designed
- Toast discipline — success toasts properly suppressed, sounds used instead
- Error boundaries and lazy loading implemented
- Dark mode theme provider working, print styles optimized
- Form validation consistent and clear
- Empty states handled with contextual messages

## Recommended Fix Order

### Phase 1 — Security (before any new release)
1. Set `webSecurity: true`
2. Validate paths in `file:write` IPC handler
3. Remove competitor brand names from all UI strings
4. Add DOMPurify to `dangerouslySetInnerHTML` usages
5. Move admin emails to env vars

### Phase 2 — Functionality (Electron features broken)
6. Implement missing laser/GNSS IPC handlers in main.cjs
7. Import & initialize Insta360/Drone services in main.cjs
8. Add `before-quit` cleanup for all resources
9. Add Duro GNSS fallback to HTTP when IPC fails

### Phase 3 — Code Quality
10. Enable minification in production builds
11. Remove unused deps (graph-client, neon)
12. Remove Wouter, migrate 3 files to React Router
13. Add `type-check` to build pipeline
14. Start reducing `any` usage (564 instances)
