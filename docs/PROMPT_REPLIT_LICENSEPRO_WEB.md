# Prompt for Replit — LicensePRO Web: Multi-Product License Administration Platform

Copy-paste this into Replit:

---

## Context

SolTec Innovation builds desktop Electron apps for professional surveying and transportation. Each app validates its license **offline** using HMAC-SHA256 signed keys — no server dependency. Currently, only one person (the owner) can generate license keys using a local Electron app. We need a **web-based LicensePRO** so multiple admins can generate keys for customers, while only the owner can delete/modify anything.

### How the license system works

1. Each desktop app has a **Machine ID** (SHA-256 of MAC addresses + hostname + CPU, formatted as `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`)
2. User sends their Machine ID to an admin
3. Admin enters the Machine ID in LicensePRO, selects product, type, duration, addons
4. LicensePRO generates a **license key** (base64url-encoded JSON signed with HMAC-SHA256)
5. Admin sends the key back to the user
6. User pastes the key in the app — validated **entirely offline** (no server call)

The key payload looks like this:
```json
{
  "machineId": "A1B2-C3D4-E5F6-G7H8-I9J0-K1L2-M3N4-O5P6",
  "product": "MeasurePRO",
  "customer": "ABC Transport Inc.",
  "email": "john@abctransport.com",
  "issuedAt": "2026-04-30",
  "expiresAt": "2027-04-30",
  "type": "commercial",
  "addons": ["ai_plus", "envelope", "convoy"],
  "sig": "hmac-sha256-hex-string"
}
```

The key is: `base64url(JSON.stringify(payload))`

The signature is: `HMAC-SHA256(secret, JSON.stringify(payload, sortedKeys))` — keys sorted alphabetically, `sig` field excluded from signing.

---

## Product Registry

There are 6 products. Each has its own HMAC secret, addon catalog, and color. **The secrets are critical — they must match exactly what's embedded in each desktop app.**

```javascript
const PRODUCTS = {
  MeasurePRO: {
    label: 'MeasurePRO',
    desc: 'Laser Distance Measurement & Surveying',
    color: '#FF8C00',
    secret: 'SoltecInnovation-MeasurePRO-2026-LicenseSecret-Vb7hK4jN1mR5cQ2w',
    addons: {
      // These IDs MUST match what MeasurePRO's useLicenseEnforcement.tsx checks
      'ai_plus':        'AI Detection (MeasurePRO+)',
      'envelope':       'Envelope Clearance Monitoring',
      'convoy':         'Convoy Guardian',
      'route_analysis': 'Route Enforcement',
      'swept_path':     'Swept Path Analysis',
      'calibration':    'Camera Calibration',
      '3d_view':        'Point Cloud / 3D View',
    },
  },
  RoadScope: {
    label: 'RoadScope',
    desc: 'Road Condition Assessment',
    color: '#378ADD',
    secret: 'SoltecInnovation-RoadScope-2026-LicenseSecret-Pq3nM8xW2kT6vA9s',
    addons: {
      // Placeholder — not enforced in app yet, but ready for future
      'iri_module':      'IRI Calculation Module',
      'rut_depth':       'Rut Depth Analysis',
      'crack_detection': 'Crack Detection AI',
      'export_gis':      'GIS Export Pack',
      'cloud_sync':      'Cloud Sync',
    },
  },
  ConvoyGuardian: {
    label: 'ConvoyGuardian',
    desc: 'Multi-Vehicle Convoy Coordination',
    color: '#E74C3C',
    secret: 'SoltecInnovation-ConvoyGuardian-2026-LicenseSecret-Tk4mR8wN2pL6vQ3j',
    addons: {
      'blackbox':       'Black Box Recording',
      'video_sync':     'Video Feed Sync',
      'emergency':      'Emergency Alert System',
      'dispatch':       'Dispatch Console',
    },
  },
  SweptPRO: {
    label: 'SweptPRO',
    desc: 'Vehicle Swept Path Simulation',
    color: '#9B59B6',
    secret: 'SoltecInnovation-SweptPRO-2026-LicenseSecret-Zd5fL9pE3nC8bY1t',
    addons: {
      'vehicle_library': 'Extended Vehicle Library',
      'cad_export':      'CAD Export (DXF/DWG)',
      'animation':       'Animation Mode',
      'batch_sim':       'Batch Simulation',
    },
  },
  LoadPRO: {
    label: 'LoadPRO',
    desc: 'Load & Weight Management',
    color: '#E24B4A',
    secret: 'SoltecInnovation-LoadPRO-2026-LicenseSecret-Gm2wX6kP4qS0vF7n',
    addons: {
      'axle_analysis': 'Axle Load Analysis',
      'permit_calc':   'Permit Calculation Module',
      'bridge_rating': 'Bridge Rating Module',
      'gnss_link':     'GNSS Location Link',
      'report_gen':    'Report Generator',
    },
  },
  RailPRO: {
    label: 'RailPRO',
    desc: 'Rail Track Geometry Analysis',
    color: '#F39C12',
    secret: 'SoltecInnovation-RailPRO-2026-LicenseSecret-Hn8bT3eW5mK9aU4c',
    addons: {
      'gauge_measure':  'Gauge Measurement Module',
      'cant_twist':     'Cant & Twist Analysis',
      'alignment_rep':  'Alignment Report',
      'tamping_export': 'Tamping Machine Export',
      'video_log':      'Video Log Sync',
    },
  },
};
```

### License Types (universal across all products)

```javascript
const LICENSE_TYPES = [
  { value: 'admin',      label: 'Admin',      desc: 'Full access to all features (internal)' },
  { value: 'enterprise', label: 'Enterprise',  desc: 'Full access to all features (customer)' },
  { value: 'commercial', label: 'Commercial',  desc: 'Access based on selected addons' },
  { value: 'pro',        label: 'Pro',         desc: 'Access based on selected addons' },
  { value: 'partner',    label: 'Partner',     desc: 'Access based on selected addons' },
  { value: 'trial',      label: 'Trial',       desc: 'Basic access + selected addons (time-limited)' },
  { value: 'demo',       label: 'Demo',        desc: 'Basic access + selected addons (time-limited)' },
  { value: 'beta',       label: 'Beta',        desc: 'Basic access + selected addons' },
  { value: 'internal',   label: 'Internal',    desc: 'Full access (internal use only)' },
];
```

**How types affect access in the desktop apps:**
- `admin`, `enterprise`, `internal` → **all features unlocked** (addons ignored)
- `commercial`, `pro`, `partner` → **only selected addons unlocked**
- `trial`, `demo`, `beta` → **basic features + selected addons** (limited)

### Duration Helpers

Support these formats for expiration:
- `NEVER` → never expires
- `+30d` → 30 days from now
- `+6m` → 6 months from now
- `+1y` → 1 year from now
- `2027-04-30` → specific date (ISO format)

---

## What to Build

### Stack
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL via Drizzle ORM (Replit provides this)
- **Frontend:** React + TypeScript + Tailwind CSS (or your preferred setup)
- **Auth:** Email/password with bcrypt, JWT sessions

### Database Schema

```sql
-- Admin users
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',  -- 'owner' or 'admin'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- Customers (optional — for tracking who licenses are issued to)
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  company VARCHAR(255),
  phone VARCHAR(50),
  notes TEXT,
  created_by INTEGER REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generated license keys (audit log)
CREATE TABLE license_keys (
  id SERIAL PRIMARY KEY,
  product VARCHAR(50) NOT NULL,
  machine_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_id INTEGER REFERENCES customers(id),
  license_type VARCHAR(20) NOT NULL,
  addons TEXT[] DEFAULT '{}',
  issued_at DATE NOT NULL,
  expires_at VARCHAR(20) NOT NULL,          -- 'NEVER' or ISO date
  key_hash VARCHAR(64) NOT NULL,            -- SHA-256 of the key (don't store the key itself)
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP,
  revoked_by INTEGER REFERENCES admins(id),
  revoke_reason TEXT,
  notes TEXT,
  generated_by INTEGER REFERENCES admins(id) NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log (every action, immutable)
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) NOT NULL,
  action VARCHAR(50) NOT NULL,              -- 'generate_key', 'revoke_key', 'create_customer', 'create_admin', etc.
  target_type VARCHAR(50),                  -- 'license_key', 'customer', 'admin'
  target_id INTEGER,
  details JSONB,                            -- action-specific details
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_license_keys_product ON license_keys(product);
CREATE INDEX idx_license_keys_machine ON license_keys(machine_id);
CREATE INDEX idx_license_keys_customer ON license_keys(customer_id);
CREATE INDEX idx_audit_log_admin ON audit_log(admin_id, created_at);
```

---

### Role-Based Access Control

**Two roles: `owner` and `admin`.**

| Action | Owner | Admin |
|--------|-------|-------|
| Generate license keys | Yes | Yes |
| View all license history | Yes | Yes |
| View customers | Yes | Yes |
| Create customers | Yes | Yes |
| Edit customers | Yes | No |
| Delete customers | Yes | No |
| Revoke/modify license keys | Yes | No |
| Create admin accounts | Yes | No |
| Deactivate admin accounts | Yes | No |
| View audit log | Yes | No |
| Change own password | Yes | Yes |
| Delete any record | Yes | No |

**CRITICAL:** Admins can ONLY generate keys and view history. They CANNOT delete, modify, or revoke anything. All destructive actions are owner-only. Enforce this at the API level (middleware), not just in the UI.

### Initial Owner Account

On first run, if no admins exist, create the owner account:
- Email: `jfprince@soltec.ca`
- Password: set via environment variable `OWNER_PASSWORD`
- Role: `owner`

---

### Pages / Routes

#### 1. Login Page (`/login`)
- Email + password form
- JWT token stored in httpOnly cookie or localStorage
- Redirect to dashboard after login

#### 2. Dashboard (`/`)
- Quick stats: total keys generated (by product), active admins, recent activity
- Quick action buttons: "Generate Key", "Add Customer"
- Recent keys table (last 10)

#### 3. Generate Key Page (`/generate`) — **Main page, must be excellent UX**

This is the most important page. The flow:

1. **Select Product** — 6 product cards with colors and icons, click to select
2. **Enter Machine ID** — text input, auto-formats to `XXXX-XXXX-...` pattern, validates format
3. **Customer Info** — name, email (optional autocomplete from customers table)
4. **License Type** — dropdown with descriptions (admin/commercial/pro/trial/etc.)
5. **Duration** — quick buttons: `30 days`, `90 days`, `6 months`, `1 year`, `NEVER`, or custom date picker
6. **Select Addons** — checkboxes showing the product's available addons with descriptions
   - If type is `admin`/`enterprise`/`internal`, show info: "All features included — addons not needed"
   - If type is `commercial`/`pro`/`partner`, addons determine what features are unlocked
   - "Select All" / "Clear All" buttons
7. **Generate** button → shows the generated key in a large, copyable text box
   - Copy button (copies to clipboard)
   - "Send via Email" button (opens mailto: with key in body)
   - Key is displayed once — only the hash is stored in DB

**Key Generation Logic (server-side):**

```javascript
const crypto = require('crypto');

function sign(payload, secret) {
  const keys = Object.keys(payload).filter(k => k !== 'sig').sort();
  return crypto.createHmac('sha256', secret)
    .update(JSON.stringify(payload, keys))
    .digest('hex');
}

function resolveExpiry(raw) {
  if (!raw || raw.toUpperCase() === 'NEVER') return 'NEVER';
  if (raw.startsWith('+')) {
    const d = new Date();
    const val = parseInt(raw.slice(1));
    const unit = raw.slice(-1).toLowerCase();
    if (unit === 'd') d.setDate(d.getDate() + val);
    else if (unit === 'm') d.setMonth(d.getMonth() + val);
    else if (unit === 'y') d.setFullYear(d.getFullYear() + val);
    return d.toISOString().slice(0, 10);
  }
  return raw; // already ISO date
}

function generateKey({ product, machineId, customer, email, expiresAt, type, addons }) {
  const p = PRODUCTS[product];
  if (!p) throw new Error('Unknown product: ' + product);
  
  const payload = {
    machineId: machineId.trim().toUpperCase(),
    product,
    customer: (customer || '').trim(),
    email: (email || '').trim(),
    issuedAt: new Date().toISOString().slice(0, 10),
    expiresAt: resolveExpiry(expiresAt),
    type: type || 'commercial',
    addons: addons || [],
  };
  
  payload.sig = sign(payload, p.secret);
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}
```

**IMPORTANT:** The `JSON.stringify(payload, keys)` for signing uses the **sorted keys** as the second argument (replacer). This ensures deterministic serialization. The sorting is: `Object.keys(payload).filter(k => k !== 'sig').sort()`. This MUST match exactly — if the order differs, the desktop app will reject the key.

#### 4. Key Verification Page (`/verify`)
- Paste a license key to decode and verify it
- Shows: product, customer, machine ID, type, addons, expiry, valid/invalid
- Useful for debugging "my key doesn't work" support requests

#### 5. License History Page (`/history`)
- Searchable, filterable table of all generated keys
- Columns: Date, Product, Customer, Type, Addons, Expires, Generated By, Status
- Filters: by product, by admin, by date range, by customer
- Click a row to see full details
- Owner can revoke keys (mark as revoked with reason — the key still works offline, but it's tracked)
- Export to CSV

#### 6. Customer Management (`/customers`) 
- List all customers
- Add/edit customer (owner only for edit)
- Click customer → see all their license keys
- Search by name, email, company

#### 7. Admin Management (`/admins`) — **Owner only**
- List all admin accounts
- Create new admin (name, email, password)
- Deactivate/reactivate admin
- Cannot delete the owner account
- Show last login date

#### 8. Audit Log (`/audit`) — **Owner only**
- Chronological log of every action
- Filter by admin, action type, date range
- Shows: timestamp, admin name, action, details, IP address
- Cannot be deleted or modified by anyone

---

### API Endpoints

```
POST   /api/auth/login              → { token }
POST   /api/auth/change-password    → { success }

GET    /api/dashboard/stats         → { keysByProduct, recentKeys, activeAdmins }

POST   /api/keys/generate           → { key, keyId }  (both roles)
POST   /api/keys/verify             → { valid, payload, ... }  (both roles)
GET    /api/keys                    → paginated list  (both roles)
GET    /api/keys/:id                → key details  (both roles)
PATCH  /api/keys/:id/revoke         → { success }  (owner only)

GET    /api/customers               → list  (both roles)
POST   /api/customers               → { id }  (both roles)
PATCH  /api/customers/:id           → { success }  (owner only)
DELETE /api/customers/:id           → { success }  (owner only)

GET    /api/admins                  → list  (owner only)
POST   /api/admins                  → { id }  (owner only)
PATCH  /api/admins/:id              → { success }  (owner only)
DELETE /api/admins/:id              → { success }  (owner only)

GET    /api/audit                   → paginated log  (owner only)

GET    /api/products                → product registry (names, colors, addons — NO secrets)
```

**Security middleware:**
- `requireAuth` — validates JWT, attaches admin to request
- `requireOwner` — checks `admin.role === 'owner'`, returns 403 if not
- Never expose HMAC secrets to the frontend — key generation happens server-side only
- Rate limit key generation to prevent abuse (10 per minute per admin)

---

### Environment Variables

```
DATABASE_URL=postgresql://...        # Replit provides this
JWT_SECRET=<random-32-char-string>   # For signing JWT tokens
OWNER_PASSWORD=<initial-password>    # Owner's initial password (change after first login)
```

**Do NOT put HMAC secrets in env vars** — they're hardcoded in the server-side product registry (same as the desktop apps). This is intentional: the secrets must match byte-for-byte with what's compiled into each desktop app.

---

### UI Design

- Clean, professional, dark theme (dark gray background, white text)
- Product cards with their brand colors (MeasurePRO orange, RoadScope blue, etc.)
- The Generate Key page should feel fast and efficient — admins may generate 10+ keys per day
- Mobile-responsive (admins might use phones)
- Toast notifications for success/error
- Loading states for all async operations

### Machine ID Input

The Machine ID format is `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (8 groups of 4 hex chars, uppercase).

- Auto-format as user types (insert dashes automatically)
- Validate format before allowing generation
- Show error if format is wrong
- Allow paste (strip whitespace, auto-format)

---

## Important Notes

1. **Secrets stay server-side.** The PRODUCTS registry with secrets lives in server code only. The frontend gets product names, colors, descriptions, addon lists — never secrets.

2. **Keys are not stored.** Only the SHA-256 hash of the generated key is stored in the database. The actual key is shown once to the admin and never retrievable again. This is by design.

3. **Revocation is soft.** Revoking a key in LicensePRO marks it as revoked in the database, but the key still works offline in the desktop app (there's no phone-home). Revocation is for tracking/audit purposes.

4. **MeasurePRO addons are critical.** The addon IDs for MeasurePRO (`ai_plus`, `envelope`, `convoy`, `route_analysis`, `swept_path`, `calibration`, `3d_view`) must be exactly these strings. The desktop app maps them to feature keys:
   - `ai_plus` → AI Detection
   - `envelope` → Envelope Clearance
   - `convoy` → Convoy Guardian
   - `route_analysis` → Route Enforcement
   - `swept_path` → Swept Path Analysis
   - `calibration` → Camera Calibration
   - `3d_view` → Point Cloud / 3D View

5. **Other products' addons are placeholders.** RoadScope, SweptPRO, LoadPRO, RailPRO, ConvoyGuardian don't enforce addons in their apps yet. But the addon system should be ready — when those apps are updated, the keys generated today should already work.

6. **Audit everything.** Every key generation, revocation, admin creation, customer edit — log it to the audit table with admin ID, timestamp, IP address, and full action details.

7. **The owner account (`jfprince@soltec.ca`) can never be deactivated or deleted.** Hardcode this protection.
