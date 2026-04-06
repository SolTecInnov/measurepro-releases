# MeasurePRO - Frequently Asked Questions (FAQ)

---

## GENERAL QUESTIONS

### What is MeasurePRO?
MeasurePRO is a professional measurement system for field operations, transportation, and survey teams. It combines laser distance meters, GPS tracking, and intelligent software to provide real-time overhead clearance monitoring, route documentation, and compliance enforcement.

### Do I need to download or install software?
No. MeasurePRO is a web-based application that runs in your browser. Just navigate to the URL and start using it. For the best experience, you can install it as a Progressive Web App (PWA), which enables offline functionality and gives you a home screen icon.

### What devices does MeasurePRO work on?
MeasurePRO works on any device with a modern web browser:
- Tablets (iPad, Android, Windows) - **Recommended for field use**
- Laptops (Windows, Mac, Linux)
- Smartphones (iOS, Android)

We recommend a 10-inch ruggedized tablet for field operations.

### Does it work offline?
Yes! MeasurePRO is designed as an offline-first application. Core features (measurements, GPS tracking, POI capture, data logging) work completely offline. Data syncs automatically when you reconnect to the internet.

### What browsers are supported?
- Chrome 90+ (recommended)
- Microsoft Edge 90+
- Safari 14+
- Firefox 88+

### What is camera calibration and why do I need it?
Camera calibration is a one-time setup that allows MeasurePRO to convert AI detections into accurate real-world measurements. If you plan to use measurement modes (bridge surveys, lane width, traffic signals), you need to calibrate your camera once using a chessboard pattern. Basic features (GPS, laser, POI capture) don't require calibration.

### What measurement modes are available?
MeasurePRO offers four specialized measurement modes:
- **Bridge Clearance Survey**: Measure minimum overhead clearance with Quebec (5.3m) and Ontario (5.1m) compliance checking
- **Lane Width Measurement**: Calculate road lane widths and markings
- **Traffic Signal Survey**: Measure signal clearances and spacing
- **Railroad Overhead**: Measure railroad structure clearances

All modes require camera calibration and AI detection enabled.

---

## HARDWARE QUESTIONS

### Do I need special hardware?
The basic (free) version works with just your device. For professional use, we recommend:
- **Laser distance meter** (for real-time overhead clearance)
- **External GPS module** (for improved accuracy)
- **ZED 2i stereo camera** (for Envelope Clearance premium feature)

### What laser distance meter should I use?
We recommend the **SolTec MeasurePRO Lidar2D**, specifically designed for this application. However, MeasurePRO works with most USB serial laser distance meters that output NMEA or custom protocols.

### How do I mount the hardware?
All mounting is non-permanent:
- **Laser:** Roof rack or magnetic mount (must point straight up)
- **GPS:** Magnetic antenna on roof center
- **Camera:** Front bumper/grille clamp mount
- **Tablet:** Dashboard suction mount or windshield mount

Installation takes approximately 5 minutes and requires no tools or vehicle modifications.

### Can I use my phone's built-in GPS?
Yes. If you don't have an external GPS module, MeasurePRO will automatically use your device's built-in GPS. External GPS is more accurate, especially in urban areas or under tree cover.

### What if my laser disconnects while driving?
MeasurePRO will show a "Disconnected" status and attempt to auto-reconnect (if enabled in settings). Your logged data remains safe. Reconnect the laser when you can stop safely.

### How do I calibrate my camera?
1. Print a 9×6 chessboard pattern (search "chessboard calibration pattern" or download from our website)
2. Go to Settings → Calibration tab in MeasurePRO
3. Capture 10-15 images of the pattern from different angles and distances
4. System automatically calculates calibration parameters
5. Save calibration - it's good for the life of your camera/lens

Aim for a reprojection error under 0.5 pixels for best accuracy.

---

## MEASUREMENT QUESTIONS

### How accurate are the measurements?
- **Laser accuracy:** ±1-2mm (millimeter-level precision)
- **GPS accuracy:** 3-15 meters (varies by conditions and hardware)
- **Overall clearance accuracy:** Depends on laser mounting stability and vehicle pitch/roll

### What is "ground reference"?
Ground reference is your vehicle or load height. The laser measures the distance from itself to whatever is overhead. By subtracting your ground reference (vehicle height), MeasurePRO calculates your actual clearance margin.

Example: Laser reads 18 ft to bridge. Vehicle is 15 ft tall. Clearance = 18 - 15 = 3 ft.

### Can I measure side clearances, not just overhead?
Yes, but only with the **Envelope Clearance** premium feature ($250/month), which requires a ZED 2i stereo camera. This monitors clearances in all directions—overhead, sides, and front.

### Why are my measurements jumping around?
This is usually sensor noise or vibration. Enable averaging in **Settings → Laser → Enable averaging** to smooth the readings. Also check that your laser is securely mounted and pointing straight up.

### Can I use imperial and metric units?
Yes. Choose your preferred units in **Settings → Measurement → Units**. You can switch between Imperial (feet/inches) and Metric (meters/centimeters) at any time.

---

## PREMIUM FEATURES

### How do I activate premium features?
1. Subscribe to the premium tier you want
2. Your administrator will activate your subscription
3. Go to **Settings** → Select the feature tab (AI, Envelope, Convoy, or Route)
4. Your premium features are now available ✓

Contact your administrator if you need a subscription activated.

### What happens if my subscription expires?
Premium features stop working, but your data remains accessible. You can still view, export, and analyze data collected while subscribed. Re-subscribe to continue using premium features.

### Can I use multiple premium features simultaneously?
Yes. Each premium feature is independent. You can subscribe to MeasurePRO+ and Convoy Guardian simultaneously, for example. Each has its own password.

### What's the difference between MeasurePRO+ and Envelope Clearance?
- **MeasurePRO+ ($100/mo):** AI automatically detects overhead objects and logs them. You still use one laser for overhead measurement.
- **Envelope Clearance ($250/mo):** Monitors your entire vehicle envelope (overhead + sides + front) using a stereo camera. Includes vehicle profile configuration and violation logging.

---

## ENVELOPE CLEARANCE

### How many vehicle profiles are available?
MeasurePRO includes 25 industry-standard OS/OW (Oversize/Overweight) vehicle profiles covering:
- **Standard trailers**: 5-axle flatbed, step deck
- **Lowboy/RGN trailers**: 2-12 axle configurations
- **Perimeter & beam trailers**: 7-13 axles
- **Dual lane configurations**: 16-19 axles
- **Schnabel trailers**: 13-19 axles (for transformers, heavy machinery)
- **Specialized equipment**: Blade trailers, tower trailers, modular 19-22 axle combinations

Each profile includes complete specifications: dimensions, overhangs, cargo capacity, weight limits, and axle configuration.

### Can I create custom vehicle profiles?
Yes! While we provide 25 industry-standard profiles, you can create unlimited custom profiles with your specific vehicle dimensions, overhangs, cargo specifications, and weight capacity. Custom profiles are saved to your device.

### Where do clearance violations get logged?
Clearance violations are now logged to both the envelope violation store AND the main measurement database. This dual logging allows you to export all violations together with your other measurements in CSV, GeoJSON, or ZIP formats for unified reporting and analysis.

---

## AI DETECTION (MeasurePRO+)

### What objects can the AI detect?
The AI is trained to detect:
- Traffic signs
- Traffic signals
- Bridge structures
- Utility wires and poles
- Overpasses
- Tree canopies
- Building overhangs
- Any overhead obstacle

### How accurate is the AI detection?
The AI achieves 85-95% accuracy on most objects. Each detection includes a confidence score (e.g., "Traffic Sign 94%"). Lower confidence detections may be less reliable.

### Can I train the AI on custom objects?
Not directly, but you can export your detections in YOLO format (**Settings → AI → Export Training Data**) and use them to train your own custom models.

### Does AI detection work offline?
Yes. The AI model is loaded locally in your browser. Detection happens on-device and doesn't require internet.

---

## CONVOY GUARDIAN

### How many vehicles can join a convoy?
Up to 100 vehicles per convoy. Most professional operations use 3-10 vehicles (pilot car, load vehicle, chase cars).

### Do all vehicles need their own subscription?
No. Only the lead vehicle needs the Convoy Guardian subscription ($2,000/month). Support vehicles join for free using the QR code.

### What data is shared between convoy vehicles?
- Current measurements (overhead clearance)
- GPS positions (real-time)
- Alert status (safe/warning/critical)
- Emergency alerts
- Video feeds (if cameras enabled)
- Messages and communications

### What is the "black box"?
The black box is forensic-grade logging. Every measurement from every vehicle, all GPS tracks, all alerts, all communications, and optional video feeds are recorded. If something goes wrong, you have complete evidence of what happened, when, where, and what every vehicle knew.

### How big are black box files?
Approximately 1-5 GB per 8-hour convoy operation, depending on the number of vehicles and whether video is recorded.

---

## ROUTE ENFORCEMENT

### What is Route Enforcement?
Route Enforcement ensures drivers stay on permitted routes. It's GPS-based compliance monitoring for oversized loads, hazmat transport, or any operation where legal route adherence is required.

### How does the STOP modal work?
If a driver goes off-route for 7+ consecutive seconds, a full-screen red STOP modal triggers. It cannot be dismissed by the driver—only dispatch can clear it remotely. This ensures every off-route incident is acknowledged and assessed.

### Can the driver override the STOP modal?
No. This is by design. Only dispatch can clear STOP modals. This ensures compliance and accountability.

### What if there's a legitimate detour?
The driver calls dispatch (one-tap "Call Dispatch" button on STOP modal), explains the situation, and dispatch assesses. If it's a legitimate, clearly-marked detour, dispatch clears the incident and the driver proceeds.

### What are buffer zones?
Buffer zones define how much deviation from the route is allowed before triggering an alert. Rural routes use 30-meter buffers (roads are wider, GPS less critical). Urban routes use 15-meter buffers (tighter streets, more precision needed).

### What file format is the route?
GPX (GPS Exchange Format). This is the standard format used by route planning software, Google Maps (via export), and GPS devices.

---

## DATA & EXPORT

### Where is my data stored?
Data is stored locally on your device in IndexedDB (browser database). Optionally, you can enable Firebase cloud sync to back up data to the cloud and access it from multiple devices.

### How long is data retained?
Indefinitely, unless you manually delete it or enable auto-cleanup rules. Your device storage is the only limit. Most users can store months of data without issues.

### Can I export data to Excel?
Yes. Export as CSV (**Settings → Survey Manager → Export → CSV**), then open in Excel, Google Sheets, or any spreadsheet software.

### Can I use exported data in GIS software?
Yes. Export as GeoJSON (**Settings → Survey Manager → Export → GeoJSON**), then import into QGIS, ArcGIS, or other GIS applications.

### How do I share data with someone who doesn't have MeasurePRO?
Export as ZIP (**Settings → Survey Manager → Export → ZIP**). This creates a complete package with all photos, a CSV data file, and a folder structure. Share the ZIP file via email or file transfer.

### Can I automate data exports?
Yes, through email reporting. Configure automated daily summaries or incident reports in **Settings → Email**. Reports are emailed automatically with attachments.

---

## TROUBLESHOOTING

### The laser shows "No Serial Ports Found"
This means your device doesn't detect any USB serial devices. Solutions:
- Check USB cable is connected
- Try a different USB port on your device
- Verify the laser is powered on
- On Windows, install FTDI drivers (usually automatic)
- Restart your device

### GPS stuck on "Searching..." / "No Fix"
GPS needs a clear view of the sky to lock satellites. Solutions:
- Move outdoors or near a window
- Wait 1-2 minutes (first lock takes longer)
- Check GPS antenna connection
- Verify GPS module is powered on
- Try built-in device GPS as fallback

### Photos appear black or camera won't activate
Camera access is blocked. Solutions:
- Allow camera permission (browser prompt)
- Check browser settings → site permissions → allow camera
- Ensure no other app is using the camera
- Restart the browser
- Test camera in another app to verify hardware works

### Data not syncing to cloud
Cloud sync requires internet and Firebase configuration. Solutions:
- Check internet connection
- Verify Firebase is configured in settings
- Clear browser cache and retry
- Check device storage space (full storage prevents writes)
- Manually export as backup

### Route Enforcement STOP modal won't clear
STOP modal clearance requires internet connection. Solutions:
- Verify driver has internet (check connection)
- Have dispatch re-clear the incident
- Ensure convoy is still active (not completed/deleted)
- Refresh browser (last resort, data is safe)

---

## ACCOUNT & BILLING

### Is there a free trial?
Yes. The basic tier is completely free forever. You can use live measurements, GPS tracking, POI capture, and data export without any subscription.

### How do I upgrade to a premium tier?
Contact SolTecInnovation sales at **sales@soltec-innovation.com** or call **+1.438.533.5344**. They'll set up your subscription and activate it for you. Your premium features will be available immediately.

### Can I cancel my subscription anytime?
Yes. Premium subscriptions are month-to-month with no long-term contracts (unless you negotiate an annual contract for discounts). Contact support to cancel.

### What payment methods are accepted?
- Credit card (Visa, Mastercard, Amex)
- ACH bank transfer (enterprise accounts)
- Purchase orders (approved enterprise customers)
- Annual invoicing (enterprise accounts)

### Is there a discount for annual subscriptions?
Yes. Annual subscriptions receive 10-20% discounts depending on the tier. Contact sales for pricing.

---

## SUPPORT

### Where can I find the full user manual?
**Settings → Help** provides the complete user manual inside the app. You can also access documentation at **www.soltec-innovation.com/docs**.

### How do I contact support?
- **Email:** support@soltec-innovation.com (24-48 hour response)
- **Phone:** +1.438.533.5344 (M-F 8AM-6PM PST)
- **Live Chat:** Available on website during business hours
- **Emergency:** +1.438.533.5344 (24/7 for enterprise customers)

### Is training available?
Yes. We offer:
- **Monthly webinars** (free, online)
- **On-site training** (custom pricing)
- **Video tutorials** (free, on-demand)
- **Custom enterprise training** (tailored to your workflows)

Contact **training@soltec-innovation.com** to schedule.

### Can I request new features?
Absolutely! Submit feature requests to **features@soltec-innovation.com**. Popular requests are prioritized for future releases.

### Where do I report bugs?
Email **bugs@soltec-innovation.com** with:
- Description of the bug
- Steps to reproduce
- Device and browser info
- Screenshots (if applicable)
- Error messages

We prioritize bugs based on severity and impact.

---

## LEGAL & COMPLIANCE

### Is MeasurePRO certified for commercial use?
MeasurePRO is professional-grade software used by commercial operations. However, it's a measurement and documentation tool—it does not replace legal permits, certifications, or professional engineering assessments.

### Can I use MeasurePRO for permit applications?
Yes. Exported data (CSV, GeoJSON, photos) can be submitted as supporting documentation for permit applications. However, permitting authorities may require additional certifications or professional surveys.

### Does Route Enforcement replace legal permits?
**No.** Route Enforcement is a monitoring and compliance tool. You still must obtain legal permits and route approvals from authorities. Route Enforcement helps you adhere to permitted routes, but it doesn't grant permission.

### Who owns the data I collect?
You do. All data collected using MeasurePRO belongs to you. SolTecInnovation does not claim ownership of your field data, measurements, photos, or reports.

### Is my data secure?
Yes. Data is stored locally on your device and optionally synced to Firebase (Google Cloud Platform) with enterprise-grade security. We do not sell, share, or access your data without permission.

### What about privacy?
MeasurePRO collects GPS coordinates and photos as part of its functionality. This data is stored locally and/or in your Firebase account (under your control). We do not track your location or collect personal data beyond what's necessary for the app to function.

---

## TECHNICAL

### What is PWA (Progressive Web App)?
A PWA is a web application that can be installed like a native app. It works offline, has a home screen icon, and provides an app-like experience without downloading from an app store.

### Can I integrate MeasurePRO with other software?
Yes. Use data exports (CSV, JSON, GeoJSON) to integrate with other systems. For custom API integrations, contact **developers@soltec-innovation.com** for API documentation.

### Does MeasurePRO use my phone's storage?
Yes. Data is stored in your browser's IndexedDB. Storage usage depends on how much data you log and how many photos you capture. Typical usage: 100-500 MB for months of data.

### Can I use MeasurePRO on multiple devices?
Yes. Your account can be used on multiple devices. If you enable Firebase cloud sync, your data syncs across devices. Otherwise, data is device-specific.

### What happens if I clear my browser cache?
If you clear browsing data and select "Cached images and files," your locally stored MeasurePRO data may be deleted. To prevent data loss:
- Export data regularly
- Enable Firebase cloud sync
- Use the PWA installed app (less likely to be cleared)

---

## VOICE COMMANDS

### Does MeasurePRO have voice control?
Yes. MeasurePRO includes a built-in voice command system that lets you control the app hands-free while driving. Say commands like "log measurement", "next POI type", "start logging", "stop logging", or "what is my height" to interact with the app without taking your hands off the wheel.

### How do I activate voice commands?
1. Go to **Settings → Voice Commands**
2. Toggle "Enable Voice Assistant" to ON
3. Grant microphone permission when prompted
4. A microphone icon appears in the main toolbar — green when active

### What languages are supported for voice commands?
English (EN), French (FR), and Spanish (ES). Switch language in Settings → Voice Commands → Language.

### Do voice commands require internet?
Voice commands (speech recognition) require an internet connection. Voice notes (audio recordings attached to measurements) work completely offline and are stored locally.

### What are the most useful voice commands?
- **"log measurement"** — saves the current laser reading as a POI
- **"start logging" / "stop logging"** — toggle continuous recording
- **"what is my height"** — announces the current laser reading aloud
- **"next POI type"** — cycles to the next POI category
- **"take photo"** — captures a photo from the connected camera
- **"clear all alerts"** — dismisses active alerts
- **"GPS trace"** — starts GPS trace recording

See the Voice Command Reference card at `/docs/voice-commands` for all 65+ commands.

---

## MULTI-LASER CONFIGURATION

### Can I connect more than one laser at a time?
Yes. MeasurePRO supports a multi-laser configuration for more complex surveys:
- **Primary laser** (forward-facing, vertical): SolTec or RSA device on the boom
- **Lateral laser** (side-facing): Measures distance to kerb, wall, or lane edge
- **Rear laser**: Measures rear clearance

### What are the serial settings for the lateral / rear lasers?
Multi-laser lateral and rear devices use: **19,200 baud, 7 data bits, Even parity, 1 stop bit (7-E-1)**.
The primary boom laser uses 115,200 baud, 8N1 (no parity).

### What is the LDM71 and how do I connect it?
The LDM71 is a laser distance meter that outputs ASCII distance strings. Connection settings:
- **Baud rate:** 115,200
- **Framing:** 8N1
- **Protocol:** Select "LDM71" in Settings → Hardware → Laser → Protocol

If readings show exactly 0.000 m, confirm the protocol selection — RSA uses 3-byte binary; LDM71 uses ASCII.

---

## ROAD PROFILING & GNSS

### What is Road Profiling?
Road Profiling is a module that records the longitudinal profile of a road as you drive. It calculates:
- **Chainage** — cumulative distance from the survey start (metres)
- **Grade** — road slope as a percentage (positive = uphill, negative = downhill)
- **K-factor** — rate of change between grade segments (used for vertical curve design)

### What GPS hardware is required for Road Profiling?
Road Profiling requires the **Swift Navigation Duro** RTK-GNSS receiver. It needs centimetre-level elevation data and IMU (pitch, roll, yaw) output. USB GPS, Bluetooth GPS, and browser geolocation do not provide the elevation accuracy or IMU data required.

### How do I activate Road Profiling?
1. Connect the Swift Navigation Duro and achieve **RTK Fixed** fix (green indicator)
2. Open **Settings → Road Profile**
3. Toggle "Enable Road Profile Recording" to ON
4. Create or open a survey and start logging (Alt+3)
5. The Road Profile panel updates in real time as you drive

### What is GPS failover?
If the Duro loses signal, MeasurePRO automatically switches to the next available GPS source: Duro → USB GPS → Bluetooth GPS → Browser geolocation. The failover happens within 5 seconds of signal loss. Failover is indicated by a yellow badge on the GPS status panel.

### What is cross-slope / banking?
Cross-slope (banking/superelevation) is the lateral tilt of the road surface in degrees. MeasurePRO reads the IMU roll angle from the Duro in real time. For OS/OW loads, excessive banking can shift the load's centre of gravity, risking instability. Banking angles >7° are flagged automatically.

---

## ROUTE ENFORCEMENT & CONVOY

### What is Route Enforcement?
Route Enforcement ensures drivers stay on their permitted route. Dispatch uploads a GPX file defining the approved path, and the driver's device monitors GPS position continuously. If the vehicle goes off-route for 7+ consecutive seconds, a full-screen red STOP modal appears on the driver's device that only dispatch can dismiss.

### What is Convoy Guardian?
Convoy Guardian connects multiple survey vehicles in real time over a WebSocket network. The lead vehicle hosts the convoy session; support vehicles join via QR code. Features:
- Up to 100 vehicles per convoy
- Real-time GPS positions for all vehicles
- Shared measurements and alerts
- Voice and text messaging between vehicles
- Emergency alert broadcast

### Does the Route Enforcement STOP modal lock the screen?
Yes. The STOP modal is a full-screen overlay that the driver cannot dismiss. Only dispatch can clear it remotely after assessing the situation via the dispatch console.

### How is a Route Enforcement STOP cleared?
1. Dispatch sees the off-route alert on the convoy console
2. Contact the driver via the in-app call button
3. Assess the situation (detour, wrong turn, GPS error, etc.)
4. Click "Clear Violation" to dismiss the driver's STOP modal
5. Add resolution notes for compliance records

---

## STILL HAVE QUESTIONS?

**Contact us:**
- **Email:** support@soltecinnovation.com
- **Technical:** support@soltecinnovation.com
- **Phone:** +1.438.533.5344
- **Website:** www.soltecinnovation.com

**We're here to help you succeed with MeasurePRO!**

---

*Last Updated: April 2026*  
*MeasurePRO by SolTecInnovation*
