#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.join(__dirname, '..');
const srcDir = path.join(projectDir, 'release-builds', 'app-extracted');
const asarBin = path.join(projectDir, 'node_modules/@electron/asar/bin/asar.js');
const outPath = path.join(projectDir, 'release-builds', 'app-new-clean.asar');
const destPath = path.join(projectDir, 'release-builds', 'win-unpacked', 'resources', 'app.asar');

console.log('Source:', srcDir);
console.log('Output:', outPath);

if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

execSync(`node "${asarBin}" pack "${srcDir}" "${outPath}"`, {
  stdio: 'inherit',
  timeout: 600000
});

const size = fs.statSync(outPath).size;
console.log('Packed! Size:', Math.round(size / 1024 / 1024) + ' MB');

// Deploy
fs.copyFileSync(outPath, destPath);
console.log('Deployed to:', destPath);
console.log('Final size:', Math.round(fs.statSync(destPath).size / 1024 / 1024) + ' MB');
