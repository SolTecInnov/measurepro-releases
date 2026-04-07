#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

const TOKEN = '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';
const REPO = 'SolTecInnov/measurepro-releases';
const RELEASE_DIR = '/mnt/c/Users/jfpri/measurepro-electron/release-builds';

const VERSION = process.argv[2] || '15.4.3';
const TAG = `v${VERSION}`;
const BODY = process.argv[3] || `MeasurePRO ${TAG}`;

function apiRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com', path, method,
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'MeasurePRO', 'Accept': 'application/vnd.github+json', ...headers }
    };
    const req = https.request(opts, res => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(body); } });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

function uploadAsset(releaseId, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const fileName = filePath.split('/').pop();
    const fileData = fs.readFileSync(filePath);
    const opts = {
      hostname: 'uploads.github.com',
      path: `/repos/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'MeasurePRO', 'Content-Type': contentType, 'Content-Length': fileData.length }
    };
    const req = https.request(opts, res => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => { try { const p = JSON.parse(body); console.log(`  ✅ ${fileName} → ${p.browser_download_url}`); resolve(p); } catch(e) { resolve(body); } });
    });
    req.on('error', reject);
    req.write(fileData); req.end();
  });
}

async function main() {
  console.log(`Creating release ${TAG}...`);
  const release = await apiRequest('POST', `/repos/${REPO}/releases`, {
    tag_name: TAG, name: `MeasurePRO ${TAG}`, body: BODY, draft: false, prerelease: false
  }, { 'Content-Type': 'application/json' });

  if (!release.id) { console.error('Failed:', release); process.exit(1); }
  console.log(`Release created: id=${release.id}`);

  const files = [
    { path: `${RELEASE_DIR}/MeasurePROSetup.exe`, type: 'application/octet-stream' },
    { path: `${RELEASE_DIR}/MeasurePROSetup.exe.blockmap`, type: 'application/octet-stream' },
    { path: `${RELEASE_DIR}/latest.yml`, type: 'text/yaml' },
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) { console.log(`  SKIP: ${file.path}`); continue; }
    const sizeMB = (fs.statSync(file.path).size / 1024 / 1024).toFixed(1);
    console.log(`  Uploading ${file.path.split('/').pop()} (${sizeMB} MB)...`);
    await uploadAsset(release.id, file.path, file.type);
  }
  console.log('\nDone!');
}

main().catch(console.error);
