# MeasurePRO Admin Training Manual

**For System Administrators, Fleet Managers, and Operations Coordinators**

---

## TABLE OF CONTENTS

1. [Administrator Overview](#administrator-overview)
2. [Admin Panel Access](#admin-panel-access)
3. [Customer Management](#customer-management)
4. [Subscription Management](#subscription-management)
5. [Route Enforcement Management](#route-enforcement-management)
6. [Convoy Guardian Management](#convoy-guardian-management)
7. [AI Training Data Management](#ai-training-data-management)
8. [Violation Management](#violation-management)
9. [System Configuration](#system-configuration)
10. [User Support](#user-support)
11. [Reporting & Analytics](#reporting--analytics)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## ADMINISTRATOR OVERVIEW

### What is an Administrator?
An administrator in MeasurePRO has elevated permissions to manage customers, subscriptions, view violations, access training data, and configure system settings. This role is typically held by:
- Fleet managers overseeing multiple vehicles/drivers
- Operations coordinators managing convoys
- IT administrators maintaining the system
- Compliance officers monitoring violations

### Administrator Responsibilities
✅ Creating and managing customer accounts  
✅ Activating and deactivating premium subscriptions  
✅ Monitoring route enforcement violations  
✅ Managing convoy operations  
✅ Collecting and exporting AI training data  
✅ Generating compliance reports  
✅ Providing user support  
✅ Configuring system-wide settings  

### Security & Access Control
Administrators authenticate using the **ADMIN_PASSWORD** environment variable. This password must be kept secure and changed regularly. Never share admin credentials with non-admin users.

---

## ADMIN PANEL ACCESS

### Accessing the Admin Panel

**URL:** Navigate to `/admin`

**Login:**
1. Enter admin password (stored in ADMIN_PASSWORD environment variable)
2. Click "Login"
3. Admin dashboard loads

**Security:**
- Session expires after 30 minutes of inactivity
- Requires re-authentication
- All admin actions are logged for audit trails

### Admin Dashboard Overview

The dashboard provides quick access to:
- **Customer List** - All active customers and subscriptions
- **Violation Queue** - Unacknowledged route/envelope violations
- **Active Convoys** - Currently running convoy operations
- **Training Data** - AI detection data ready for export
- **System Status** - Health checks and diagnostics
- **Quick Actions** - Common tasks (create customer, view reports, etc.)

---

## CUSTOMER MANAGEMENT

### Creating a New Customer

**Path:** Admin → Customers → Create New Customer

**Required Information:**
- **Customer Name:** Company or individual name
- **Email:** Primary contact email
- **Phone:** Contact phone number
- **Address:** Physical address (for billing/shipping)
- **Account Type:** Individual | Fleet | Enterprise
- **Notes:** Any relevant information

**Procedure:**
1. Click "Create New Customer"
2. Fill in customer details
3. Select account type
4. Add internal notes (optional)
5. Click "Create Customer"
6. Customer ID generated automatically
7. Send welcome email with setup instructions

**Best Practices:**
- Use consistent naming conventions (e.g., "ABC Transport Inc." not "ABC transport")
- Include fleet size in notes for fleet customers
- Tag enterprise customers for special handling
- Record sales rep or account manager in notes

### Viewing Customer Details

**Path:** Admin → Customers → [Select Customer]

**Customer Profile Shows:**
- Contact information
- Subscription history
- Active premium features
- Total data collected (measurements, POIs, violations)
- Last activity timestamp
- Devices registered
- Payment status

**Actions Available:**
- Edit customer information
- View subscription details
- Deactivate/reactivate account
- Export customer data
- Send notification email
- View activity logs

### Editing Customer Information

**Path:** Admin → Customers → [Select Customer] → Edit

**Editable Fields:**
- Name, email, phone, address
- Account type
- Notes

**Procedure:**
1. Click "Edit" on customer profile
2. Update fields as needed
3. Click "Save Changes"
4. Changes reflected immediately
5. Audit log updated with change timestamp

### Deactivating a Customer

**Path:** Admin → Customers → [Select Customer] → Deactivate

**When to Deactivate:**
- Customer cancels service
- Non-payment (after grace period)
- Violation of terms of service
- Account closure request

**What Happens:**
- Premium features immediately disabled
- Customer can still access free tier
- Data remains in system (read-only)
- Can be reactivated later if needed

**Procedure:**
1. Navigate to customer profile
2. Click "Deactivate Account"
3. Confirm deactivation reason
4. Click "Confirm Deactivate"
5. Customer receives deactivation email notification

---

## SUBSCRIPTION MANAGEMENT

### Understanding Subscription Tiers

| Tier | Monthly Cost | Key Features |
|------|-------------|--------------|
| **Free** | $0 | Basic measurements, GPS, POI, export |
| **MeasurePRO+** | $100 | AI detection, auto-logging, training data |
| **Envelope Clearance** | $250 | Multi-directional clearance, violations |
| **Convoy Guardian** | $2,000 | Multi-vehicle, black box, emergency |
| **Route Enforcement** | $350 | GPS compliance, 3 convoys included |
| **Route Add-on** | $55 | Each additional convoy beyond 3 |

### Creating a Subscription

**Path:** Admin → Customers → [Select Customer] → Add Subscription

**Procedure:**
1. Select customer
2. Click "Add Subscription"
3. Choose tier (MeasurePRO+, Envelope, Convoy, Route)
4. Set start date (default: today)
5. Set end date (default: 1 year from start, or "No expiration")
6. Add notes (PO number, contract terms, etc.)
7. Click "Create Subscription"
8. Subscription activated automatically - customer can use immediately

**Subscription Management:**
Subscriptions are managed in the admin panel with validity dates, not passwords. The system automatically:
- Activates features when subscription is active (current date within start/end dates)
- Deactivates features when subscription expires
- Tracks usage and billing periods
- No customer action required - admin manages everything

**Example:**
```
Customer: ABC Transport Inc.
Tier: Convoy Guardian
Start Date: 2025-02-01
End Date: 2026-01-31
Status: Active (automatically activated by system)
Notes: Annual contract, PO #12345, 5 vehicles
```

### Viewing Active Subscriptions

**Path:** Admin → Subscriptions → Active

**List Shows:**
- Customer name
- Subscription tier
- Start date / End date
- Status (Active, Expiring Soon, Expired)
- Actions (Edit, Renew, Cancel)

**Filters:**
- By tier (show only Convoy Guardian subscriptions)
- By expiration (expiring in next 30 days)
- By customer
- By status

### Renewing a Subscription

**Path:** Admin → Subscriptions → [Select Subscription] → Renew

**Procedure:**
1. Locate expiring subscription
2. Click "Renew"
3. Confirm new end date (default: +1 year from current end)
4. Update pricing if changed
5. Click "Confirm Renewal"
6. Customer receives renewal confirmation email

**Auto-Renewal:**
- Can be enabled per-subscription
- Automatically extends subscription 30 days before expiration
- Sends notification to customer

### Canceling a Subscription

**Path:** Admin → Subscriptions → [Select Subscription] → Cancel

**When to Cancel:**
- Customer requests cancellation
- Non-payment
- Downgrade to lower tier
- End of contract period

**Procedure:**
1. Select subscription
2. Click "Cancel Subscription"
3. Choose effective date:
   - Immediate (cancels now)
   - End of billing period (cancels at end date)
4. Enter cancellation reason (internal notes)
5. Click "Confirm Cancellation"
6. Premium feature disabled on effective date
7. Customer receives cancellation confirmation

**Data Retention:**
- Customer's collected data remains accessible (read-only)
- Customer can still export historical data
- Premium-specific features (AI detections, violations) remain viewable but frozen

---

## ROUTE ENFORCEMENT MANAGEMENT

### Monitoring Active Convoys

**Path:** Admin → Route Enforcement → Active Convoys

**List Shows:**
- Convoy name
- Customer/creator
- Number of drivers enrolled
- Start date/time
- Status (Active, Pending, Completed)
- Incident count
- Actions (View Details, Monitor Live, End Convoy)

### Viewing Convoy Details

**Path:** Admin → Route Enforcement → [Select Convoy] → Details

**Information Displayed:**
- Route map with buffer zones
- All enrolled drivers (names, vehicle IDs, phones)
- Incident history
- GPS tracks for all drivers
- Compliance statistics (% on-route)

### Viewing Route Violations

**Path:** Admin → Route Enforcement → Violations

**Violation List Shows:**
- Timestamp
- Driver name
- Convoy name
- Distance off-route
- Duration off-route
- GPS location
- Status (Pending, Acknowledged, Cleared)
- Actions (View Details, Acknowledge, Clear)

**Filters:**
- By convoy
- By driver
- By status (pending only, cleared only)
- By date range
- By severity (distance off-route)

### Managing Violations

**Acknowledging a Violation:**
1. Select violation from list
2. Click "Acknowledge"
3. Driver sees "Dispatch Acknowledged" on STOP modal
4. Driver knows you're aware and assessing
5. Violation status updates to "Acknowledged"

**Clearing a Violation:**
1. Contact driver (via phone or convoy messaging)
2. Assess situation (legitimate detour? wrong turn? GPS error?)
3. If safe to proceed, click "Clear Violation"
4. Driver's STOP modal dismisses
5. Violation status updates to "Cleared"
6. Add notes documenting resolution

**Example Workflow:**
```
Violation: Driver 47m off-route for 15 seconds
1. Acknowledge (driver knows you see it)
2. Call driver: "What happened?"
   Driver: "Detour sign, road closed ahead"
3. Verify on map (construction zone visible)
4. Clear violation: "Proceed via detour, rejoin route at Highway 80"
5. Add note: "Construction detour, cleared to proceed"
```

### Generating Compliance Reports

**Path:** Admin → Route Enforcement → Reports

**Report Types:**

**1. Convoy Summary Report**
- All convoys in date range
- Total incidents
- Average compliance rate
- Driver performance

**2. Violation Details Report**
- All violations in date range
- Severity breakdown
- Resolution times (how long to clear)
- GPS heatmap of violation locations

**3. Driver Performance Report**
- Per-driver compliance statistics
- Violation count per driver
- Average distance off-route
- Recommendations for training

**Export Formats:**
- PDF (formatted report with maps)
- CSV (data for Excel analysis)
- JSON (for integration with other systems)

---

## CONVOY GUARDIAN MANAGEMENT

### Monitoring Active Convoys

**Path:** Admin → Convoy Guardian → Active Convoys

**Real-Time Dashboard:**
- All active convoys
- Number of vehicles per convoy
- Current status (Moving, Stopped, Emergency)
- Latest measurements from all vehicles
- Communication activity
- Black box recording status

### Viewing Convoy Details

**Path:** Admin → Convoy Guardian → [Select Convoy] → Details

**Convoy Profile:**
- Lead vehicle information
- All member vehicles
- Real-time map showing all positions
- Measurement history from all vehicles
- Communication log
- Emergency alert history

### Emergency Alert Management

**Path:** Admin → Convoy Guardian → [Select Convoy] → Emergency Alerts

**Alert List Shows:**
- Timestamp
- Vehicle that triggered alert
- GPS location
- Alert type (Emergency, Warning, Info)
- Message/reason
- Status (Active, Acknowledged, Resolved)

**Admin Actions:**
- View alert details
- See vehicle location on map
- Contact vehicle directly (call)
- Mark as resolved
- Add notes for documentation

### Black Box Data Access

**Path:** Admin → Convoy Guardian → [Select Convoy] → Black Box

**Data Available:**
- Complete measurement logs from all vehicles
- GPS tracks for all vehicles
- All alerts and communications
- Video recordings (if enabled)
- Timestamp-synchronized playback

**Export Options:**
- Full data package (ZIP with all files)
- Filtered export (specific time range or vehicle)
- Forensic report (PDF summary with key events)

**Use Cases:**
- Incident investigation
- Insurance claims
- Compliance documentation
- Training and review
- Post-operation analysis

---

## AI TRAINING DATA MANAGEMENT

### Understanding AI Training Data

MeasurePRO+ AI Detection logs every detected object with:
- Photo of the object
- Bounding box coordinates
- Classification (traffic sign, signal, wire, etc.)
- Confidence score
- GPS location
- Timestamp

This data can be used to train custom machine learning models.

### Accessing Training Data

**Path:** Admin → AI Training → Available Data

**List Shows:**
- Customer name
- Number of detections
- Date range
- Object types detected
- Total storage size
- Export status

**Filters:**
- By customer
- By date range
- By object type
- By minimum confidence score

### Exporting Training Data

**Path:** Admin → AI Training → [Select Dataset] → Export

**Export Formats:**

**1. YOLO Format (Recommended for ML)**
- Images folder with all detection photos
- Labels folder with bounding box annotations
- classes.txt with object class names
- Ready for YOLOv5/v8 training

**2. COCO Format**
- JSON file with annotations
- Images folder
- Standard format for many ML frameworks

**3. Raw Data**
- Photos with filenames matching detection IDs
- CSV with detection metadata
- For custom processing

**Procedure:**
1. Select customer/date range/filters
2. Choose export format (YOLO recommended)
3. Click "Export Training Data"
4. System prepares download (may take minutes for large datasets)
5. Download ZIP file
6. Use for training custom models

### Managing Customer Training Data

**Permissions:**
- Customers own their training data
- Admin can export on behalf of customer (with consent)
- Training data can be aggregated across customers (anonymized) for model improvement with consent

**Data Retention:**
- Training data stored indefinitely (unless customer requests deletion)
- Can be purged after export to save storage
- Comply with data retention policies and regulations

---

## VIOLATION MANAGEMENT

### Envelope Clearance Violations

**Path:** Admin → Violations → Envelope Clearance

**Violation List Shows:**
- Customer/vehicle
- Timestamp
- Violation type (Overhead, Left Side, Right Side, Front)
- Clearance value (how close)
- Critical threshold violated
- GPS location
- Photo evidence
- Status (New, Reviewed, Archived)

**Reviewing Violations:**
1. Select violation from list
2. View photo evidence
3. See GPS location on map
4. Review vehicle profile (dimensions)
5. Check if legitimate violation or sensor error
6. Mark as "Reviewed"
7. Add notes (e.g., "Low bridge, driver aware, no damage")

**Generating Violation Reports:**
**Path:** Admin → Violations → Generate Report

- Select date range
- Filter by customer/vehicle
- Export as PDF or CSV
- Use for compliance audits, insurance, training

### Route Enforcement Violations

(Covered in [Route Enforcement Management](#route-enforcement-management) section above)

---

## SYSTEM CONFIGURATION

### Environment Variables

**Critical Environment Variables:**
(Set in Replit Secrets or server environment)

```
ADMIN_PASSWORD=<secure-admin-password>
VITE_ADMIN_PASSWORD=<same-as-ADMIN_PASSWORD>
DATABASE_URL=<postgresql-connection-string>
FIREBASE_API_KEY=<firebase-key> (if using Firebase sync)
```

**Changing Admin Password:**
1. Update ADMIN_PASSWORD in Replit Secrets
2. Update VITE_ADMIN_PASSWORD to match
3. Restart application
4. Notify all admins of new password
5. Log out and log back in to verify

**Security Best Practices:**
- Use strong passwords (16+ characters, mixed case, numbers, symbols)
- Change admin password quarterly
- Never commit passwords to version control
- Use different passwords for staging vs. production

### Database Management

**Path:** Admin → System → Database

**Health Checks:**
- Connection status
- Total records (customers, subscriptions, measurements, POI, violations)
- Storage usage
- Recent errors

**Maintenance Tasks:**
- Run vacuum (PostgreSQL optimization)
- Clear old logs (optional, with retention policy)
- Export full database backup
- Restore from backup

**Backup Procedure:**
1. Admin → System → Database → Export Backup
2. Full database export as SQL file
3. Download and store securely (encrypted storage recommended)
4. Test restore on staging environment quarterly

### User Permissions

**Path:** Admin → System → Users

**Permission Levels:**
1. **User (Default)** - Can use all features based on subscription
2. **Admin** - Can manage customers, subscriptions, view all data
3. **Super Admin** - Can modify system settings, access database directly

**Creating Additional Admins:**
1. Admin → System → Users → Add Admin
2. Enter name and email
3. Set permission level (Admin or Super Admin)
4. Generate admin credentials
5. Send secure credentials to new admin
6. New admin must change password on first login

---

## USER SUPPORT

### Viewing User Activity Logs

**Path:** Admin → Support → User Activity

**Search by:**
- Customer name
- Email
- Date range
- Activity type (login, export, violation, etc.)

**Activity Log Shows:**
- Timestamp
- User/customer
- Action taken (e.g., "Exported CSV data")
- Device/browser info
- IP address (if needed for security)
- Success/failure status

**Use Cases:**
- Troubleshooting user issues ("I can't export data" → check export logs)
- Security audits (unusual login patterns)
- Usage analytics (which features are most used)

### Common Support Tasks

**Subscription Access Issues:**
- Subscriptions are managed by validity dates, not passwords
- If customer can't access premium features:
  1. Admin → Customers → [Select Customer] → Subscriptions
  2. Verify subscription status is "Active"
  3. Check start date (subscription may be future-dated)
  4. Verify end date hasn't passed
  5. Customer needs no password - features activate automatically when subscription is valid

**Data Recovery:**
- If user accidentally deletes local data
- Check if Firebase sync enabled
  - Yes: Restore from Firebase backup
  - No: Data lost (local only, can't recover)
- Lesson: Always recommend enabling Firebase sync

**Troubleshooting Connection Issues:**
1. Check user's browser and version (need modern browser)
2. Verify hardware connections (USB laser/GPS)
3. Check device permissions (camera, GPS)
4. Try different USB ports
5. Test on different device to isolate issue

---

## REPORTING & ANALYTICS

### Dashboard Overview

**Path:** Admin → Analytics → Dashboard

**Key Metrics:**
- Total active customers
- Total active subscriptions (by tier)
- Total measurements logged (system-wide)
- Total POI captured (system-wide)
- Total violations (route + envelope)
- Active convoys
- Revenue (if billing integration enabled)

**Trends:**
- New customers per month
- Subscription growth
- Feature adoption (% using AI, Envelope, etc.)
- Average measurements per customer
- Most active customers (top 10 by usage)

### Custom Reports

**Path:** Admin → Analytics → Custom Reports

**Report Builder:**
1. Select data source (customers, subscriptions, measurements, violations)
2. Choose fields to include
3. Apply filters (date range, customer type, tier, etc.)
4. Group by (customer, date, tier, etc.)
5. Select aggregations (count, sum, average, min, max)
6. Generate report

**Export Options:**
- CSV (for Excel)
- PDF (formatted report)
- Chart/Graph (visual representation)

**Example Reports:**

**Revenue Report:**
- Group by tier
- Sum of monthly subscription costs
- Breakdown by customer type (individual, fleet, enterprise)
- Year-over-year growth

**Usage Report:**
- Average measurements per customer per month
- POI capture rate
- Feature adoption percentage
- Identify underutilized features

**Compliance Report:**
- Total violations (route + envelope)
- Violations per customer
- Clearance times (how quickly violations resolved)
- Trend over time (improving or worsening)

---

## TROUBLESHOOTING

### Common Admin Issues

#### Cannot Access Admin Panel

**Symptoms:** Login fails, "Invalid password" error

**Solutions:**
1. Verify ADMIN_PASSWORD environment variable is set correctly
2. Ensure VITE_ADMIN_PASSWORD matches ADMIN_PASSWORD (frontend needs it)
3. Clear browser cache and retry
4. Check for typos (passwords are case-sensitive)
5. Restart application to reload environment variables

#### Customer Cannot Access Premium Feature

**Symptoms:** Customer says premium feature isn't available/working

**Checklist:**
1. Verify subscription is active (not expired)
2. Check start date (subscription may be future-dated)
3. Verify subscription tier matches the feature (Convoy subscription needed for Convoy features)
4. Check end date hasn't passed
5. Verify database connection (feature activation requires DB access)
6. Check browser console for JavaScript errors
7. Ask customer to refresh browser and check again

**Resolution:**
- If subscription is valid, features should automatically work
- Customer needs no password or activation steps
- If dates are correct but not working, contact technical support
- May need to extend end date or create new subscription if expired

#### Violation Not Clearing

**Symptoms:** Admin clicks "Clear Violation", driver's STOP modal persists

**Causes:**
- Driver lost internet connection (clearance requires real-time communication)
- Convoy was ended/deleted (can't clear violations in inactive convoys)
- WebSocket connection failed (real-time communication broken)

**Solutions:**
1. Verify driver has internet (ask them to check)
2. Have dispatch re-clear the violation
3. Check convoy status (must be "Active")
4. Restart driver's browser as last resort (data is safe)

#### Black Box Data Not Recording

**Symptoms:** Convoy completed, black box has no data

**Causes:**
- Convoy Guardian subscription not active
- Storage quota exceeded (device full)
- Database write failure

**Solutions:**
1. Verify Convoy Guardian subscription is active for lead vehicle
2. Check device storage space on all vehicles
3. Review database logs for write errors
4. Test new convoy to verify recording works
5. Use manual export as backup during troubleshooting

---

## BEST PRACTICES

### Customer Onboarding

**Recommended Onboarding Flow:**
1. Create customer account
2. Send welcome email with:
   - Login instructions
   - Link to Quick Start Guide
   - Support contact info
3. Activate subscription in admin panel (if purchased)
   - Set start and end dates
   - Features activate automatically for customer
4. Schedule onboarding call or webinar (optional, for enterprise)
5. Follow up in 1 week to ensure successful setup
6. Collect feedback and address any issues

### Subscription Management

**Best Practices:**
- Set calendar reminders for subscription expirations (30 days before)
- Proactively reach out to renew (don't wait for customer to ask)
- Review usage before renewal (if customer barely used it, discuss needs)
- Document contract terms in subscription notes
- Tag annual contracts for special handling

### Violation Management

**Recommended Workflow:**
1. Monitor violation queue regularly (at least hourly during operations)
2. Acknowledge violations within 5 minutes (driver knows you're aware)
3. Contact driver to assess situation
4. Clear only after confirming safe to proceed
5. Document resolution in notes (why it happened, how resolved)
6. Review violations weekly for patterns (same driver? same location?)
7. Use patterns for training (if one location has many violations, is route bad?)

### Data Management

**Data Retention Policy:**
- Measurement data: 2 years (typical)
- POI photos: 2 years (typical)
- Violations: 5 years (compliance/legal)
- Training data: Indefinite (valuable for ML)
- Customer records: 7 years after account closure (legal/tax)

**Backup Schedule:**
- Full database backup: Weekly
- Incremental backups: Daily
- Test restore: Quarterly
- Off-site storage: Always (cloud or remote server)

### Communication

**Customer Communication Best Practices:**
- Respond to support requests within 24 hours
- Proactive outreach for subscription renewals (30 days before expiration)
- Announce new features via email newsletter (monthly or quarterly)
- Conduct satisfaction surveys (annually)
- Provide uptime notifications (if scheduled maintenance)

**Internal Communication:**
- Daily standup for support team (address escalated issues)
- Weekly admin meetings (review metrics, discuss improvements)
- Document all major customer issues in CRM/ticketing system
- Share knowledge base articles internally

---

## APPENDIX: QUICK REFERENCE

### Common Admin Tasks Cheat Sheet

| Task | Path |
|------|------|
| Create customer | Admin → Customers → Create New |
| Activate subscription | Admin → Customers → [Select] → Add Subscription |
| Renew subscription | Admin → Subscriptions → [Select] → Renew |
| View violations | Admin → Violations → Envelope or Route |
| Clear route violation | Admin → Route Enforcement → Violations → [Select] → Clear |
| Export training data | Admin → AI Training → [Select Dataset] → Export |
| View convoy black box | Admin → Convoy Guardian → [Select Convoy] → Black Box |
| Generate compliance report | Admin → Route Enforcement → Reports |
| Run database backup | Admin → System → Database → Export Backup |
| View user activity logs | Admin → Support → User Activity |

### New Feature Quick Reference

| Feature | Requires | Admin action |
|---|---|---|
| LDM71 laser | Protocol set to "LDM71" in Settings | Ensure operator knows to select LDM71, not RSA |
| Road Profiling | Duro RTK + RTK Fixed fix | Enable in Settings → Road Profile; Duro-only |
| Cross-Slope / Banking | Duro (IMU roll) | Auto-available when Duro connected; no admin config |
| Amplitude Filter | Any laser | Settings → Laser → Amplitude Filter; adjust per conditions |
| Convoy Guardian | Premium licence + QR code | Admin → Convoy Guardian → Create Convoy |
| Route Enforcement | GPX file + Convoy plan | Admin → Route Enforcement → New Convoy |
| Auto-Part Manager | Any licence | Settings → Survey → Auto-Part; threshold default 200 POI |
| RoadScope Mobile | iOS/Android + credentials | User downloads app; logs in with existing credentials |
| Voice Commands | Chrome/Edge + microphone | Settings → Voice Commands → Enable Voice Assistant |

### Support Contact Quick Reference

**Internal Support:**
- IT/Technical Issues: it@soltecinnovation.com
- Billing Questions: billing@soltecinnovation.com
- Feature Requests: features@soltecinnovation.com

**Customer Support:**
- Email: support@soltecinnovation.com
- Phone: +1.438.533.5344
- Emergency: +1.438.533.5344 (24/7 enterprise)

### Password Security Checklist

- [ ] Admin password is 16+ characters
- [ ] Password includes uppercase, lowercase, numbers, symbols
- [ ] Password changed within last 90 days
- [ ] ADMIN_PASSWORD and VITE_ADMIN_PASSWORD match
- [ ] Password not shared via insecure channels (Slack, email)
- [ ] Password not committed to version control
- [ ] All admins aware of current password
- [ ] Backup password recovery method documented

---

**End of Admin Training Manual**

For additional training, contact: **training@soltec-innovation.com**  
For technical support, contact: **support@soltec-innovation.com**

*MeasurePRO by SolTecInnovation - Administrator Guide v1.0*  
*Last Updated: January 2025*
