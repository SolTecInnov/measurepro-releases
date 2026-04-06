const fs = require('fs');
const path = require('path');

const asar = '/mnt/c/Users/jfpri/measurepro-electron/release-builds/win-unpacked/resources/app.asar';
const asarBin = '/mnt/c/Users/jfpri/measurepro-electron/node_modules/@electron/asar/bin/asar.js';

const { execSync } = require('child_process');
const list = execSync(`node "${asarBin}" list "${asar}"`, { encoding: 'utf8', maxBuffer: 100*1024*1024 });
const lines = list.split('\n');

const hasMs = lines.some(l => l === '/node_modules/ms' || l.startsWith('/node_modules/ms/'));
const hasDebug = lines.some(l => l.startsWith('/node_modules/debug/'));
const hasSerial = lines.some(l => l.startsWith('/node_modules/serialport/'));

console.log('ms:', hasMs ? '✅' : '❌ MISSING');
console.log('debug:', hasDebug ? '✅' : '❌ MISSING');
console.log('serialport:', hasSerial ? '✅' : '❌ MISSING');
console.log('Total files in asar:', lines.length);
console.log('Asar size:', Math.round(fs.statSync(asar).size/1024/1024) + ' MB');
