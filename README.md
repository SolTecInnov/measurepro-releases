# MeasurePRO Desktop

Professional measurement and surveying application built with Electron + React + TypeScript.

## Development

```bash
npm install
npm run electron:dev
```

This starts Vite dev server on port 5173 and opens Electron loading from it, with hot reload.

## Build for Windows

```bash
npm run electron:build
```

The installer will be output to `release-builds/`.

## Build Resources

Place `icon.ico` (256x256) in `build-resources/` before building the Windows installer.

## Architecture

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **State:** Zustand + React Query + IndexedDB (offline-first)
- **Cloud:** Firebase for auth and sync
- **Electron:** Main process in `electron/main.cjs`, preload in `electron/preload.cjs`
