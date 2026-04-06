#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

const projectDir = '/mnt/c/Users/jfpri/measurepro-electron';
const asarBin = projectDir + '/node_modules/@electron/asar/bin/asar.js';
const staging = '/tmp/mp-lean-stage';
const outAsar = '/tmp/mp-lean-fixed.asar';
const destAsar = projectDir + '/release-builds/win-unpacked/resources/app.asar';

// Sync updated dist/ and electron/ into existing staging
console.log('Syncing dist/ and electron/ into staging...');
execSync(`rsync -a --delete "${projectDir}/dist/" "${staging}/dist/"`, { stdio: 'inherit' });
execSync(`rsync -a "${projectDir}/electron/" "${staging}/electron/"`, { stdio: 'inherit' });
console.log('Synced.');

// Repack
if (fs.existsSync(outAsar)) fs.unlinkSync(outAsar);
console.log('Packing asar...');
execSync(`node "${asarBin}" pack "${staging}" "${outAsar}"`, { stdio: 'inherit', timeout: 600000 });
console.log('Packed:', Math.round(fs.statSync(outAsar).size / 1024 / 1024) + ' MB');

// Deploy
fs.copyFileSync(outAsar, destAsar);
console.log('✅ Deployed:', Math.round(fs.statSync(destAsar).size / 1024 / 1024) + ' MB');
