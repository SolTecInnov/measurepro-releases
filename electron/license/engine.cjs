'use strict';
/**
 * MeasurePRO License Engine
 * Compatible with LicensePRO — same HMAC verification.
 * Validates license keys offline without any server dependency.
 */
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ── HMAC Secret (must match LicensePRO's MeasurePRO entry) ──────────────────
// Obfuscated: built at runtime from parts so it's not a single searchable string
const _S = ['SoltecInnovation', 'MeasurePRO', '2026', 'LicenseSecret', 'Vb7hK4jN1mR5cQ2w'];
const SECRET = _S.join('-');

// ── Machine ID ──────────────────────────────────────────────────────────────
// Persisted to file so it survives network adapter changes (VPN, dock, WiFi)
const MACHINE_ID_RE = /^[A-F0-9]{4}(-[A-F0-9]{4}){7}$/;

function calcMachineId() {
  const nets = os.networkInterfaces();
  const macs = [];
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const info of iface) {
      if (!info.internal && info.mac && info.mac !== '00:00:00:00:00:00') {
        macs.push(info.mac.replace(/:/g, '').toUpperCase());
      }
    }
  }
  macs.sort();
  const raw = macs.join('|') + '|' + os.hostname() + '|' + os.cpus()[0]?.model;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  return hash.slice(0, 32).match(/.{4}/g).join('-');
}

function getMachineId() {
  const idPath = path.join(getLicenseDir(), 'machine.id');
  try {
    const saved = fs.readFileSync(idPath, 'utf8').trim();
    if (MACHINE_ID_RE.test(saved)) return saved;
  } catch {}
  const id = calcMachineId();
  try { fs.writeFileSync(idPath, id, 'utf8'); } catch {}
  return id;
}

// ── Crypto ──────────────────────────────────────────────────────────────────
function sign(payload) {
  const keys = Object.keys(payload).filter(k => k !== 'sig').sort();
  return crypto.createHmac('sha256', SECRET).update(JSON.stringify(payload, keys)).digest('hex');
}

function decodeKey(key) {
  try { return JSON.parse(Buffer.from(key.trim(), 'base64url').toString('utf8')); }
  catch { return null; }
}

function verifyKey(key, machineId) {
  const p = decodeKey(key);
  if (!p) return { valid: false, reason: 'Cannot decode key' };
  if (p.product !== 'MeasurePRO') return { valid: false, reason: 'Key is for ' + p.product + ', not MeasurePRO' };

  // Verify signature
  const expected = sign(p);
  if (expected !== p.sig) return { valid: false, reason: 'Invalid key — signature mismatch' };

  // Verify machine
  if (p.machineId !== machineId) return { valid: false, reason: 'Key is for a different computer' };

  // Verify expiration
  if (p.expiresAt !== 'NEVER') {
    const expiryDate = new Date(p.expiresAt);
    if (isNaN(expiryDate.getTime())) return { valid: false, reason: 'Invalid expiry date' };
    if (new Date() > expiryDate) {
      return { valid: false, expired: true, reason: 'License expired on ' + p.expiresAt, payload: p };
    }
  }

  // Monotonic time check — prevent clock rollback
  const timeFloorPath = getTimeFloorPath();
  const now = Date.now();
  try {
    const floor = parseInt(fs.readFileSync(timeFloorPath, 'utf8').trim());
    if (!isNaN(floor) && now < floor - 86400000) { // Allow 1 day drift
      return { valid: false, reason: 'System clock appears to have been set back' };
    }
  } catch {}
  try { fs.writeFileSync(timeFloorPath, String(now)); } catch {}

  const daysLeft = p.expiresAt === 'NEVER' ? null :
    Math.ceil((new Date(p.expiresAt) - new Date()) / 86400000);

  return { valid: true, payload: p, daysLeft };
}

// ── Storage ─────────────────────────────────────────────────────────────────
function getLicenseDir() {
  const d = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'SoltecInnovation', 'MeasurePRO')
    : path.join(os.homedir(), '.measurepro');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function getLicensePath() {
  return path.join(getLicenseDir(), 'license.key');
}

function getTimeFloorPath() {
  return path.join(getLicenseDir(), '.timefloor');
}

function saveLicenseKey(key) {
  fs.writeFileSync(getLicensePath(), key.trim(), 'utf8');
}

function loadLicenseKey() {
  try {
    return fs.readFileSync(getLicensePath(), 'utf8').trim();
  } catch {
    return null;
  }
}

function clearLicenseKey() {
  try { fs.unlinkSync(getLicensePath()); } catch {}
}

// ── Validate stored license ─────────────────────────────────────────────────
function validateStoredLicense() {
  const key = loadLicenseKey();
  if (!key) return { valid: false, reason: 'No license key found', needsActivation: true };
  const machineId = getMachineId();
  const result = verifyKey(key, machineId);
  result.needsActivation = !result.valid;
  return result;
}

module.exports = {
  getMachineId,
  verifyKey,
  decodeKey,
  saveLicenseKey,
  loadLicenseKey,
  clearLicenseKey,
  validateStoredLicense,
  getLicenseDir,
};
