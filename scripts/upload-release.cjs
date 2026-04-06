#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const TOKEN = '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';
const REPO = 'SolTecInnov/measurepro-releases';
const RELEASE_DIR = '/mnt/c/Users/jfpri/measurepro-electron/release-builds';

function apiRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path, method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'MeasurePRO',
        'Accept': 'application/vnd.github+json',
        ...headers
      }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { resolve(body); }
      });
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
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'MeasurePRO',
        'Content-Type': contentType,
        'Content-Length': fileData.length
      }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          console.log(`  Uploaded: ${fileName} → ${parsed.browser_download_url}`);
          resolve(parsed);
        } catch(e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function main() {
  // Get latest release
  const release = await apiRequest('GET', `/repos/${REPO}/releases/latest`);
  console.log(`Release: ${release.tag_name} (id: ${release.id})`);
  console.log(`Existing assets: ${release.assets.map(a => a.name).join(', ')}`);

  const files = [
    { path: `${RELEASE_DIR}/MeasurePROSetup.exe`, type: 'application/octet-stream' },
    { path: `${RELEASE_DIR}/MeasurePROSetup.exe.blockmap`, type: 'application/octet-stream' },
    { path: `${RELEASE_DIR}/latest.yml`, type: 'text/yaml' },
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      console.log(`  SKIP (not found): ${file.path}`);
      continue;
    }

    const fileName = file.path.split('/').pop();
    // Delete existing asset if present
    const existing = release.assets.find(a => a.name === fileName);
    if (existing) {
      console.log(`  Deleting existing: ${fileName}`);
      await apiRequest('DELETE', `/repos/${REPO}/releases/assets/${existing.id}`);
    }

    const sizeMB = (fs.statSync(file.path).size / 1024 / 1024).toFixed(1);
    console.log(`  Uploading ${fileName} (${sizeMB} MB)...`);
    await uploadAsset(release.id, file.path, file.type);
  }

  console.log('\nDone! All assets uploaded.');
}

main().catch(console.error);
