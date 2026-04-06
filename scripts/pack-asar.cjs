#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.join(__dirname, '..');
const asarBin = path.join(projectDir, 'node_modules/@electron/asar/bin/asar.js');
const outPath = '/tmp/app-new.asar';

console.log('Packing asar from:', projectDir);
console.log('Output:', outPath);

try {
  // Remove output if exists
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  
  execSync(`node "${asarBin}" pack "${projectDir}" "${outPath}" --unpack-dir "node_modules"`, {
    cwd: projectDir,
    stdio: 'inherit',
    timeout: 300000
  });
  
  const size = fs.statSync(outPath).size;
  console.log('Done! Size:', Math.round(size / 1024 / 1024) + ' MB');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
