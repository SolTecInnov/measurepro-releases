#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const newAsar = '/tmp/app-new.asar';
const destAsar = 'C:\\Users\\jfpri\\measurepro-electron\\release-builds\\win-unpacked\\resources\\app.asar';

if (!fs.existsSync(newAsar)) {
  console.error('ERROR: New asar not found at', newAsar);
  process.exit(1);
}

const size = fs.statSync(newAsar).size;
console.log('New asar size:', Math.round(size / 1024 / 1024) + ' MB');

// Kill the app first
try {
  execSync('taskkill /F /IM MeasurePRO.exe 2>nul', { shell: 'cmd.exe' });
  console.log('App stopped');
} catch(e) { console.log('App was not running'); }

// Copy new asar
fs.copyFileSync(newAsar, destAsar);
console.log('Asar deployed!');

// Launch the app
const appExe = 'C:\\Users\\jfpri\\measurepro-electron\\release-builds\\win-unpacked\\MeasurePRO.exe';
execSync(`start "" "${appExe}"`, { shell: 'cmd.exe', detached: true });
console.log('App launched!');
