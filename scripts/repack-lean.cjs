#!/usr/bin/env node
/**
 * Repacks the Electron app into a clean app.asar.
 * Strategy: use rsync to copy node_modules (handles symlinks + errors gracefully),
 * exclude build-only tools to keep size reasonable.
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = '/mnt/c/Users/jfpri/measurepro-electron';
const asarBin = path.join(projectDir, 'node_modules/@electron/asar/bin/asar.js');
const staging = '/tmp/mp-lean-stage';
const outAsar = '/tmp/mp-lean.asar';
const destAsar = path.join(projectDir, 'release-builds/win-unpacked/resources/app.asar');

// Clean staging
console.log('Cleaning staging...');
if (fs.existsSync(staging)) {
  execSync(`chmod -R 777 "${staging}" 2>/dev/null || true`, { shell: '/bin/bash' });
  execSync(`rm -rf "${staging}" 2>/dev/null || true`, { shell: '/bin/bash' });
}
fs.mkdirSync(path.join(staging, 'node_modules'), { recursive: true });

// Copy app files
console.log('Copying dist/ electron/ package.json...');
execSync(`cp -r "${projectDir}/dist" "${staging}/dist"`);
execSync(`cp -r "${projectDir}/electron" "${staging}/electron"`);
execSync(`cp "${projectDir}/package.json" "${staging}/package.json"`);

// Packages to EXCLUDE (build-only, not needed at runtime in electron)
const EXCLUDE = [
  'electron', 'electron-builder', 'vite', '@vitejs/plugin-react',
  'typescript', 'esbuild', '@esbuild',
  'rollup', '@rollup', 'rolldown', '@rolldown',
  'node-gyp', 'concurrently', 'cross-env', 'wait-on', 'tree-kill',
  'app-builder-lib', 'app-builder-bin', 'builder-util', 'builder-util-runtime',
  'electron-publish', 'dmg-builder', 'electron-builder-squirrel-windows',
  '7zip-bin', 'resedit', 'pe-library', 'read-binary-file-arch',
  'autoprefixer', 'postcss', 'tailwindcss', 'postcss-import',
  'postcss-js', 'postcss-load-config', 'postcss-nested',
  'postcss-selector-parser', 'postcss-value-parser',
  '@electron/rebuild', '@electron/universal', '@electron/notarize', '@electron/osx-sign',
  'node-pre-gyp', '@mapbox/node-pre-gyp',
  'update-browserslist-db', 'browserslist', 'caniuse-lite',
];

// Build rsync exclude args
const excludeArgs = EXCLUDE.map(e => `--exclude="${e}"`).join(' ');

console.log('Syncing node_modules via rsync (this may take 1-2 min)...');
const rsyncResult = spawnSync('bash', ['-c',
  `rsync -a --ignore-errors --no-perms \
  ${excludeArgs} \
  "${projectDir}/node_modules/" "${staging}/node_modules/"`
], { stdio: 'inherit', timeout: 300000 });

if (rsyncResult.status !== 0 && rsyncResult.status !== 23) {
  console.warn('rsync exited with', rsyncResult.status, '— continuing anyway');
}

// Verify key deps are present
const check = (p) => {
  const exists = fs.existsSync(path.join(staging, 'node_modules', p));
  console.log(` ${exists ? '✅' : '❌'} ${p}`);
  return exists;
};
console.log('\nVerifying key modules:');
check('ms');
check('debug');
check('serialport');
check('@serialport/bindings-cpp');

const nmCount = fs.readdirSync(path.join(staging, 'node_modules')).length;
console.log(`\nTotal packages in staging: ${nmCount}`);

// Pack
if (fs.existsSync(outAsar)) fs.unlinkSync(outAsar);
console.log('\nPacking asar...');
execSync(`node "${asarBin}" pack "${staging}" "${outAsar}"`, { stdio: 'inherit', timeout: 600000 });

const size = fs.statSync(outAsar).size;
console.log(`Packed: ${Math.round(size/1024/1024)} MB`);

// Deploy
fs.copyFileSync(outAsar, destAsar);
console.log(`✅ Deployed: ${Math.round(fs.statSync(destAsar).size/1024/1024)} MB`);
