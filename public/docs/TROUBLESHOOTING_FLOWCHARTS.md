# MeasurePRO Troubleshooting Flowcharts

**Visual Decision Trees for Quick Problem Resolution**

---

## HOW TO USE THESE FLOWCHARTS

Each flowchart guides you through a systematic troubleshooting process:
1. Start at the top with the symptom/problem
2. Follow the decision branches (YES/NO or specific conditions)
3. Apply the solution when you reach a terminal node
4. If problem persists, escalate to support

**Visual Key:**
- `[START]` = Begin here with your symptom
- `{QUESTION?}` = Decision point (Yes/No)
- `→` = Follow this path
- `[SOLUTION]` = Action to take
- `[ESCALATE]` = Contact support

---

## FLOWCHART 1: LASER WON'T CONNECT

```
[START: No serial ports appear when trying to connect laser]
│
├─{Is USB cable physically connected?}
│  ├─ NO → [SOLUTION: Connect USB cable securely at both ends]
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is laser powered on?}
│  ├─ NO → [SOLUTION: Turn on laser power switch]
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Try different USB port on device}
│  └─{Serial ports now appear?}
│     ├─ YES → [SOLUTION: Use this USB port, previous one may be faulty]
│     │        └─[DONE ✓]
│     │
│     └─ NO → Continue
│
├─{Operating System?}
│  ├─ Windows →
│  │    ├─[SOLUTION: Install FTDI drivers]
│  │    │  1. Visit ftdichip.com/drivers
│  │    │  2. Download VCP drivers for Windows
│  │    │  3. Install and restart computer
│  │    │  4. Reconnect laser
│  │    └─{Fixed?}
│  │       ├─ YES → [DONE ✓]
│  │       └─ NO → [ESCALATE: Contact support with device info]
│  │
│  ├─ Mac/Linux →
│  │    └─{Drivers usually built-in}
│  │       └─Continue below
│  │
│  └─ Other → [ESCALATE: Unsupported OS]
│
├─{Try laser on different device}
│  └─{Works on different device?}
│     ├─ YES → [SOLUTION: Original device has USB issue or driver problem]
│     │        └─[ESCALATE: IT support for original device]
│     │
│     └─ NO → [SOLUTION: Laser hardware may be faulty]
│              └─[ESCALATE: Contact support for laser replacement]
│
└─{Still not working?}
   └─[ESCALATE: Contact support@soltec-innovation.com]
      Include: Device type, OS, laser model, USB cable type
```

---

## FLOWCHART 2: LASER CONNECTED BUT NO READINGS

```
[START: Laser shows "Connected" but displays no measurement data]
│
├─{Is laser lens clean?}
│  ├─ NO → [SOLUTION: Clean lens with soft cloth]
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is laser pointing at a surface?}
│  ├─ NO → [SOLUTION: Point laser at ceiling/overhead obstacle]
│  │        └─{Readings appear?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is surface within laser range?}
│  │  (Most lasers: 0.2m to 100m)
│  ├─ NO → [SOLUTION: Move closer to surface or aim at different target]
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Check laser mode/configuration}
│  └─[SOLUTION: Verify laser is in correct output mode]
│     • Some lasers have multiple modes (serial, display-only, etc.)
│     • Consult laser manual for serial output configuration
│     • May require button press or mode switch
│     └─{Fixed?}
│        ├─ YES → [DONE ✓]
│        └─ NO → Continue below
│
├─{Settings → Laser → Baud Rate correct?}
│  ├─ NO → [SOLUTION: Try different baud rates]
│  │        • Common: 9600, 19200, 38400, 115200
│  │        • Consult laser manual for correct baud
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Enable "Log Raw Data" in Settings → Laser → Advanced}
│  └─{Do raw bytes appear in console/log?}
│     ├─ YES → [SOLUTION: Data is transmitting but parsing failed]
│     │        └─[ESCALATE: Send raw data log to support]
│     │
│     └─ NO → [SOLUTION: No data from laser]
│              └─Continue below
│
├─{Disconnect and reconnect laser}
│  └─{Fixed?}
│     ├─ YES → [DONE ✓]
│     └─ NO → Continue below
│
├─{Try laser with different serial port (if multiple available)}
│  └─{Fixed?}
│     ├─ YES → [SOLUTION: Use this port, previous may be faulty]
│     │        └─[DONE ✓]
│     └─ NO → Continue below
│
└─[ESCALATE: Contact support with:]
   • Laser model and serial number
   • Baud rate being used
   • Screenshot of connection settings
   • Raw data log (if enabled)
```

---

## FLOWCHART 3: MEASUREMENTS ERRATIC / JUMPING

```
[START: Readings jump wildly (e.g., 20ft → 15ft → 25ft → 18ft rapidly)]
│
├─{Is laser securely mounted?}
│  ├─ NO → [SOLUTION: Secure laser mount]
│  │        • Tighten magnetic base or suction mount
│  │        • Eliminate vibration
│  │        • Ensure mount doesn't flex while driving
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is laser pointing straight up?}
│  ├─ NO → [SOLUTION: Adjust laser to point vertically]
│  │        • Angled laser measures different surfaces as vehicle moves
│  │        • Use level or alignment tool to verify
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is anything obstructing the laser beam?}
│  │  (e.g., antenna, roof rack bar, equipment)
│  ├─ YES → [SOLUTION: Relocate laser or remove obstruction]
│  │         └─{Fixed?}
│  │            ├─ YES → [DONE ✓]
│  │            └─ NO → Continue below
│  │
│  └─ NO → Continue
│
├─{Is laser lens dirty or wet?}
│  ├─ YES → [SOLUTION: Clean lens, dry if wet]
│  │        • Water droplets scatter laser beam
│  │        • Dirt causes inconsistent readings
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ NO → Continue
│
├─[SOLUTION: Enable averaging in Settings]
│  1. Settings → Laser tab
│  2. Advanced section
│  3. ☑️ Enable averaging
│  4. Set sample size: 5-10 readings
│  └─{Readings now smooth?}
│     ├─ YES → [DONE ✓]
│     │        Note: Slight lag is normal with averaging
│     │
│     └─ NO → Continue below
│
├─{Are you driving under overhanging trees/foliage?}
│  ├─ YES → [SOLUTION: This is normal behavior]
│  │        • Laser measures leaves, branches, gaps
│  │        • Readings will jump as different objects detected
│  │        • Use averaging to smooth
│  │        • Focus on minimum clearance values
│  │        └─[DONE ✓]
│  │
│  └─ NO → Continue
│
├─{Test laser in stationary position under solid surface}
│  └─{Readings stable when stationary?}
│     ├─ YES → [SOLUTION: Jumpiness is environmental]
│     │        • Reflective surfaces (water, metal) can cause issues
│     │        • Angled surfaces may reflect beam away
│     │        • Use averaging and monitor trends
│     │        └─[DONE ✓]
│     │
│     └─ NO → [SOLUTION: Laser hardware may be faulty]
│              └─[ESCALATE: Contact support for laser diagnosis/replacement]
│
└─[ESCALATE if still erratic after all steps]
```

---

## FLOWCHART 4: GPS NO FIX / SEARCHING

```
[START: GPS status shows "Searching..." or "No Fix"]
│
├─{Is this the first time using GPS in this location?}
│  ├─ YES → [SOLUTION: Wait 2-5 minutes for initial lock]
│  │        • First lock can take longer (cold start)
│  │        • GPS needs to download satellite almanac
│  │        • Be patient
│  │        └─{Got fix after waiting?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ NO → Continue
│
├─{Do you have clear view of sky?}
│  ├─ NO → [SOLUTION: Move to location with sky visibility]
│  │        ❌ Parking garages, tunnels, under bridges
│  │        ❌ Indoors (unless near window)
│  │        ❌ Dense tree cover or tall buildings
│  │        ✓ Open parking lot, field, highway
│  │        ✓ Near window if indoors
│  │        └─{Got fix now?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Using external GPS or device GPS?}
│  ├─ External GPS →
│  │    ├─{Is GPS antenna properly connected?}
│  │    │  ├─ NO → [SOLUTION: Connect GPS antenna cable]
│  │    │  │        └─{Fixed?}
│  │    │  │           ├─ YES → [DONE ✓]
│  │    │  │           └─ NO → Continue below
│  │    │  │
│  │    │  └─ YES → Continue
│  │    │
│  │    ├─{Is GPS module powered?}
│  │    │  ├─ NO → [SOLUTION: Check power connection/cable]
│  │    │  │        └─{Fixed?}
│  │    │  │           ├─ YES → [DONE ✓]
│  │    │  │           └─ NO → Continue below
│  │    │  │
│  │    │  └─ YES → Continue
│  │    │
│  │    ├─{Is GPS antenna on roof or near window?}
│  │    │  ├─ NO → [SOLUTION: Move antenna to roof/window]
│  │    │  │        └─{Fixed?}
│  │    │  │           ├─ YES → [DONE ✓]
│  │    │  │           └─ NO → Continue below
│  │    │  │
│  │    │  └─ YES → Continue
│  │    │
│  │    └─{Disconnect and reconnect GPS module}
│  │       └─{Fixed?}
│  │          ├─ YES → [DONE ✓]
│  │          └─ NO → [ESCALATE: GPS hardware may be faulty]
│  │
│  └─ Device GPS (phone/tablet built-in) →
│       ├─{Is location services enabled on device?}
│       │  ├─ NO → [SOLUTION: Enable location in device settings]
│       │  │        • iOS: Settings → Privacy → Location Services
│       │  │        • Android: Settings → Location → On
│       │  │        └─{Fixed?}
│       │  │           ├─ YES → [DONE ✓]
│       │  │           └─ NO → Continue below
│       │  │
│       │  └─ YES → Continue
│       │
│       ├─{Did browser prompt for location permission?}
│       │  ├─ NO → [SOLUTION: Check browser permission settings]
│       │  │        • Chrome: Site settings → Location → Allow
│       │  │        • Safari: Settings → Privacy → Location Services
│       │  │        • Refresh page to re-prompt
│       │  │        └─{Fixed?}
│       │  │           ├─ YES → [DONE ✓]
│       │  │           └─ NO → Continue below
│       │  │
│       │  └─ YES → Continue
│       │
│       └─{Device GPS may require cell/WiFi assistance}
│          └─[SOLUTION: Enable cell data or connect to WiFi]
│             • Device GPS uses cell towers for faster lock
│             • Try with airplane mode OFF
│             └─{Fixed?}
│                ├─ YES → [DONE ✓]
│                └─ NO → Continue below
│
├─{How many satellites visible?}
│  │  (Check GPS status display)
│  ├─ 0-3 → [SOLUTION: Insufficient satellites]
│  │        • Move to more open area
│  │        • Wait longer (satellites constantly moving)
│  │        • Metal roofs block signals
│  │        └─{Fixed after 5 min in open area?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → [ESCALATE: GPS hardware issue]
│  │
│  └─ 4+ → [SOLUTION: Should have fix with 4+ satellites]
│           └─Continue below
│
└─[ESCALATE: Contact support with:]
   • GPS module model (if external)
   • Satellite count visible
   • Location (lat/long if approximate)
   • Screenshot of GPS status
```

---

## FLOWCHART 5: PHOTOS NOT CAPTURING

```
[START: Camera error or photos appear black/blank]
│
├─{Did browser ask for camera permission?}
│  ├─ NO → [SOLUTION: Check browser camera permission]
│  │        1. Browser settings → Site permissions → Camera
│  │        2. Set to "Allow"
│  │        3. Refresh page to re-prompt
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES (but denied) →
│       └─[SOLUTION: Grant camera permission]
│          1. Browser settings → Site permissions → Camera
│          2. Change to "Allow"
│          3. Refresh page
│          └─{Fixed?}
│             ├─ YES → [DONE ✓]
│             └─ NO → Continue below
│
├─{Is camera in use by another app?}
│  └─[SOLUTION: Close other apps using camera]
│     • Only one app can access camera at a time
│     • Close Zoom, Skype, other camera apps
│     • Check task manager for background apps
│     └─{Fixed?}
│        ├─ YES → [DONE ✓]
│        └─ NO → Continue below
│
├─{Test camera in another app}
│  │  (e.g., native camera app, browser camera test site)
│  └─{Does camera work in other app?}
│     ├─ NO → [SOLUTION: Camera hardware issue]
│     │        • Check if camera is physically covered
│     │        • Try device restart
│     │        • May need device repair
│     │        └─[ESCALATE: Device hardware problem]
│     │
│     └─ YES → Continue below
│
├─{Are photos completely black?}
│  ├─ YES → [SOLUTION: Camera lens covered or lighting issue]
│  │        • Remove camera lens cover/protector
│  │        • Check if camera is facing dark surface
│  │        • Ensure adequate lighting
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ NO → Continue
│
├─{Try different browser}
│  └─{Works in different browser?}
│     ├─ YES → [SOLUTION: Original browser has issue]
│     │        • Clear original browser cache
│     │        • Update browser to latest version
│     │        • Use working browser as alternative
│     │        └─[DONE ✓]
│     │
│     └─ NO → Continue below
│
├─{Restart device}
│  └─{Fixed after restart?}
│     ├─ YES → [DONE ✓]
│     └─ NO → Continue below
│
└─[ESCALATE: Contact support with:]
   • Device type and OS version
   • Browser and version
   • Error message (if any)
   • Screenshot of issue
```

---

## FLOWCHART 6: DATA NOT SYNCING

```
[START: Sync queue shows items but they won't upload]
│
├─{Is internet connected?}
│  ├─ NO → [SOLUTION: Connect to internet]
│  │        • WiFi or cellular data
│  │        • Check if other apps/websites work
│  │        └─{Connected?}
│  │           ├─ YES → Wait 1-2 min, sync should auto-start
│  │           │        └─{Synced?}
│  │           │           ├─ YES → [DONE ✓]
│  │           │           └─ NO → Continue below
│  │           │
│  │           └─ NO → [SOLUTION: Fix internet connection first]
│  │
│  └─ YES → Continue
│
├─{Is Firebase sync enabled in settings?}
│  ├─ NO → [SOLUTION: Enable Firebase sync]
│  │        • Settings → Data → Cloud Sync
│  │        • Toggle "Enable Firebase Sync"
│  │        • Configure Firebase credentials (if prompted)
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Check browser console for errors}
│  │  (F12 → Console tab)
│  └─{Are there Firebase/network errors?}
│     ├─ YES → [SOLUTION: Address specific error]
│     │        • "Permission denied" → Check Firebase rules
│     │        • "Network error" → Firewall blocking?
│     │        • "Quota exceeded" → Storage limit reached
│     │        └─[ESCALATE: Send console error to support]
│     │
│     └─ NO → Continue below
│
├─{How many items in sync queue?}
│  ├─ 1000+ → [SOLUTION: Large queue may take time]
│  │           • Let it run for 10-15 minutes
│  │           • Check progress (should decrease slowly)
│  │           └─{Queue decreasing?}
│  │              ├─ YES → [SOLUTION: Be patient, syncing]
│  │              │        └─[DONE ✓]
│  │              └─ NO → Continue below
│  │
│  └─ <1000 → Continue
│
├─{Check device storage space}
│  └─{Is device storage full?}
│     ├─ YES → [SOLUTION: Free up storage space]
│     │        • IndexedDB can't write if storage full
│     │        • Delete unnecessary files/apps
│     │        • Sync may resume after freeing space
│     │        └─{Fixed?}
│     │           ├─ YES → [DONE ✓]
│     │           └─ NO → Continue below
│     │
│     └─ NO → Continue
│
├─{Clear browser cache and retry}
│  1. Clear browsing data (keep IndexedDB!)
│  2. Refresh page
│  3. Wait for sync to attempt
│  └─{Fixed?}
│     ├─ YES → [DONE ✓]
│     └─ NO → Continue below
│
├─[SOLUTION: Manual export as backup]
│  • Settings → Survey Manager → Export
│  • Export as ZIP or CSV to save data
│  • This ensures data isn't lost while troubleshooting
│  └─Continue below
│
└─[ESCALATE: Contact support with:]
   • Number of items in queue
   • Browser console errors
   • Firebase configuration status
   • Manual export completed as backup
```

---

## FLOWCHART 7: ROUTE ENFORCEMENT STOP MODAL WON'T CLEAR

```
[START: Driver has STOP modal, dispatch clicked "Clear" but modal persists]
│
├─{Does driver have internet connection?}
│  ├─ NO → [SOLUTION: Driver must connect to internet]
│  │        • STOP modal clearance requires real-time communication
│  │        • WiFi, cellular data, or hotspot
│  │        • Modal will clear once connected (if dispatch already cleared)
│  │        └─{Connected and cleared?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is convoy still active?}
│  │  (Check dispatch console)
│  ├─ NO (Completed/Deleted) → [SOLUTION: Cannot clear in inactive convoy]
│  │                            • Reactivate convoy if needed
│  │                            • Or driver must exit old convoy
│  │                            └─{Fixed?}
│  │                               ├─ YES → [DONE ✓]
│  │                               └─ NO → [ESCALATE]
│  │
│  └─ YES → Continue
│
├─{Have dispatch re-clear the incident}
│  1. Dispatch → Live View → Incident Queue
│  2. Find incident (should show "Cleared" if previously cleared)
│  3. Click "Clear" again
│  └─{Modal dismissed on driver side?}
│     ├─ YES → [DONE ✓]
│     │        Note: May have been timing/connection issue
│     │
│     └─ NO → Continue below
│
├─{Check driver's browser console for errors}
│  │  (Driver: Press F12 → Console tab)
│  └─{Are there WebSocket or connection errors?}
│     ├─ YES → [SOLUTION: WebSocket connection failed]
│     │        • Firewall may be blocking WebSocket
│     │        • Corporate network restrictions
│     │        • Try different network (hotspot)
│     │        └─[ESCALATE: Network/firewall issue]
│     │
│     └─ NO → Continue below
│
├─{Verify incident ID matches}
│  │  (Dispatch sees incident ID, driver sees incident ID)
│  └─{Do IDs match?}
│     ├─ NO → [SOLUTION: Driver has different incident]
│     │        • Driver may have triggered new incident
│     │        • Clear the correct incident ID
│     │        └─{Fixed?}
│     │           ├─ YES → [DONE ✓]
│     │           └─ NO → Continue below
│     │
│     └─ YES → Continue
│
├─{Driver: Refresh browser (LAST RESORT)}
│  │  ⚠️ This should rarely be necessary
│  │  ⚠️ Ensures latest state loads
│  1. Driver: Refresh page (Ctrl+R or Cmd+R)
│  2. Driver may need to rejoin convoy (scan QR again)
│  3. Dispatch: Re-clear incident if it reappears
│  └─{Fixed?}
│     ├─ YES → [DONE ✓]
│     └─ NO → Continue below
│
└─[ESCALATE: Contact support with:]
   • Convoy ID
   • Incident ID
   • Driver internet status
   • Console errors from both dispatch and driver
   • Whether incident shows "Cleared" in dispatch console
```

---

## FLOWCHART 8: PREMIUM FEATURE NOT AVAILABLE

```
[START: Premium feature not showing or not working]
│
├─{Is subscription active?}
│  │  (Contact admin to verify subscription status)
│  ├─ NO → [SOLUTION: Subscription inactive or expired]
│  │        • Contact administrator to activate subscription
│  │        • Admin checks start/end dates in admin panel
│  │        • Features activate automatically when subscription is valid
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is start date in the future?}
│  │  (Subscription may be pre-configured for future activation)
│  ├─ YES → [SOLUTION: Subscription not yet active]
│  │        • Wait until start date
│  │        • Or admin can change start date to today
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ NO → Continue
│
├─{Is user checking correct tier?}
│  │  (Make sure subscription tier matches the feature being accessed)
│  ├─ NO → [SOLUTION: Verify correct feature for subscription]
│  │        • AI Detection requires MeasurePRO+ subscription
│  │        • Envelope requires Envelope Clearance subscription
│  │        • Convoy requires Convoy Guardian subscription
│  │        • Route requires Route Enforcement subscription
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Check browser console for errors}
│  │  (F12 → Console tab)
│  └─{Are there database or connection errors?}
│     ├─ YES → [SOLUTION: Technical error checking subscription]
│     │        • "Database connection failed" → Server issue
│     │        • "Network error" → Connectivity issue
│     │        • "Permission denied" → Subscription validation issue
│     │        └─[ESCALATE: Send console error to support]
│     │
│     └─ NO → Continue below
│
├─{Refresh page and try activation again}
│  └─{Fixed?}
│     ├─ YES → [DONE ✓]
│     └─ NO → Continue below
│
├─{Admin: Verify subscription in database}
│  │  (Admin panel → check database record directly)
│  └─{Does subscription record exist?}
│     ├─ NO → [SOLUTION: Database record missing]
│     │        • Recreate subscription in admin panel
│     │        • Investigate why record was deleted
│     │        └─[DONE ✓]
│     │
│     └─ YES → Continue below
│
└─[ESCALATE: Contact support with:]
   • Customer name/ID
   • Subscription tier attempting to access
   • Subscription validity dates (start/end)
   • Console errors (if any)
   • Admin verification of subscription status
```

---

## FLOWCHART 9: AI DETECTION NOT WORKING

```
[START: AI enabled but not detecting objects]
│
├─{Is MeasurePRO+ subscription active?}
│  ├─ NO → [SOLUTION: Activate MeasurePRO+ subscription]
│  │        • AI Detection requires paid subscription
│  │        • Contact administrator to activate subscription
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is camera permission granted?}
│  ├─ NO → [SOLUTION: Grant camera permission]
│  │        • Browser will prompt for camera access
│  │        • Settings → Site permissions → Camera → Allow
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Does camera feed show in interface?}
│  ├─ NO → [SOLUTION: Camera not working]
│  │        • See "FLOWCHART 5: Photos Not Capturing"
│  │        • AI requires working camera
│  │        └─{Camera working now?}
│  │           ├─ YES → Continue with AI troubleshooting
│  │           └─ NO → [ESCALATE: Fix camera first]
│  │
│  └─ YES → Continue
│
├─{Is AI detection toggle enabled?}
│  │  (Settings → AI → Enable AI Detection)
│  ├─ NO → [SOLUTION: Toggle on AI Detection]
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is camera pointing at overhead objects?}
│  ├─ NO → [SOLUTION: Aim camera at sky/overhead]
│  │        • AI detects overhead objects (signs, wires, bridges)
│  │        • Camera pointing at road won't detect much
│  │        • Adjust camera angle to ~45° upward
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Are there objects to detect?}
│  │  (AI needs visible overhead objects)
│  ├─ NO → [SOLUTION: Drive under detectable objects]
│  │        • Traffic signs, signals, bridges, wires
│  │        • Open highway with nothing overhead = nothing to detect
│  │        • This is normal behavior
│  │        └─[DONE ✓]
│  │
│  └─ YES → Continue
│
├─{Check browser console for AI model errors}
│  │  (F12 → Console tab, look for TensorFlow errors)
│  └─{Are there model loading errors?}
│     ├─ YES → [SOLUTION: AI model failed to load]
│     │        • "Failed to fetch model" → Network issue
│     │        • "WebGL not supported" → Device/browser issue
│     │        • Clear cache and reload to re-download model
│     │        └─{Fixed?}
│     │           ├─ YES → [DONE ✓]
│     │           └─ NO → [ESCALATE: Browser/device incompatibility]
│     │
│     └─ NO → Continue below
│
├─{Check detection log}
│  │  (Settings → AI → View Detection Log)
│  └─{Are there any detections logged (even low confidence)?}
│     ├─ YES → [SOLUTION: AI is working but maybe not detecting current view]
│     │        • Low confidence detections still log
│     │        • Objects may be too far, too small, or uncommon
│     │        • Try driving under obvious objects (large traffic signs)
│     │        └─[DONE ✓]
│     │
│     └─ NO (Zero detections ever) → Continue below
│
├─{Try different browser}
│  │  (Some browsers have better WebGL support)
│  └─{Works in different browser?}
│     ├─ YES → [SOLUTION: Use working browser]
│     │        • Or update original browser
│     │        └─[DONE ✓]
│     │
│     └─ NO → Continue below
│
└─[ESCALATE: Contact support with:]
   • Device and browser info
   • Console errors (especially TensorFlow/WebGL)
   • Screenshot of camera feed
   • Detection log status (empty or has entries)
```

---

## FLOWCHART 10: CONVOY VEHICLES CAN'T COMMUNICATE

```
[START: Convoy vehicles joined but can't see each other's data]
│
├─{Are all vehicles part of same convoy?}
│  │  (Check convoy ID matches on all devices)
│  ├─ NO → [SOLUTION: All must join same convoy]
│  │        • Verify QR code is for correct convoy
│  │        • Check convoy name matches on all devices
│  │        • Rejoin with correct convoy token
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Do all vehicles have internet?}
│  │  (Convoy Guardian requires internet for real-time sync)
│  ├─ NO → [SOLUTION: All vehicles need internet]
│  │        • WiFi, cellular data, or hotspot
│  │        • Real-time data sharing requires connection
│  │        • Connect all vehicles and data should sync
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Is lead vehicle subscription active?}
│  │  (Only lead needs Convoy Guardian subscription)
│  ├─ NO → [SOLUTION: Activate Convoy Guardian on lead]
│  │        • Lead vehicle must have active $650/mo subscription
│  │        • Support vehicles join free but need active lead
│  │        └─{Fixed?}
│  │           ├─ YES → [DONE ✓]
│  │           └─ NO → Continue below
│  │
│  └─ YES → Continue
│
├─{Check WebSocket connection status}
│  │  (F12 → Console, look for WebSocket errors)
│  └─{WebSocket connected on all devices?}
│     ├─ NO → [SOLUTION: WebSocket connection failed]
│     │        • Firewall may block WebSocket
│     │        • Corporate/public WiFi restrictions
│     │        • Try cellular data/hotspot instead
│     │        • Port 443 (WSS) must be open
│     │        └─{Fixed?}
│     │           ├─ YES → [DONE ✓]
│     │           └─ NO → [ESCALATE: Network/firewall blocking]
│     │
│     └─ YES → Continue below
│
├─{Refresh all devices}
│  1. All vehicles: Refresh browser page
│  2. Vehicles may need to rejoin convoy
│  3. Check if data now syncing
│  └─{Fixed?}
│     ├─ YES → [DONE ✓]
│     └─ NO → Continue below
│
├─{Check convoy status in admin/dispatch}
│  └─{Is convoy showing as "Active"?}
│     ├─ NO → [SOLUTION: Reactivate convoy]
│     │        • Convoy may have been ended
│     │        • Recreate or reactivate
│     │        └─{Fixed?}
│     │           ├─ YES → [DONE ✓]
│     │           └─ NO → Continue below
│     │
│     └─ YES → Continue below
│
└─[ESCALATE: Contact support with:]
   • Convoy ID
   • Number of vehicles joined
   • Console errors from each vehicle
   • Network type (WiFi, cellular, etc.)
   • WebSocket connection status
```

---

## QUICK REFERENCE: WHEN TO ESCALATE

**Escalate to support@soltec-innovation.com if:**

✅ **Hardware Issues:**
- Laser won't connect after all troubleshooting steps
- GPS module not functioning after verification
- Camera physically damaged

✅ **Software Bugs:**
- Console shows repeated errors
- Feature not working despite correct configuration
- Data corruption or loss

✅ **Network/Infrastructure:**
- Firewall blocking required ports (after IT confirmation)
- WebSocket connections consistently failing
- Database connection errors

✅ **Account/Billing:**
- Subscription shows active but features won't enable
- Payment processed but access not granted
- Account locked or access issues

✅ **Data Recovery:**
- Accidentally deleted important data
- Sync failed and data not in cloud
- Database corruption suspected

**DO NOT escalate for:**
- User error (wrong password, wrong settings)
- Missing permissions (camera, GPS, location)
- Physical issues (USB unplugged, laser dirty)
- Normal behavior misunderstood as problem

**When escalating, always provide:**
1. Exact steps taken to troubleshoot
2. Device/browser/OS information
3. Error messages (screenshots or text)
4. Console logs (if applicable)
5. Timeline (when did problem start?)

---

## APPENDIX: DIAGNOSTIC COMMANDS

**Check Connection Status:**
```javascript
// Open browser console (F12) and run:

// Check IndexedDB
indexedDB.databases()

// Check localStorage
console.log(localStorage)

// Check current GPS
navigator.geolocation.getCurrentPosition(
  pos => console.log("GPS:", pos.coords),
  err => console.error("GPS Error:", err)
)

// Check camera
navigator.mediaDevices.getUserMedia({video: true})
  .then(() => console.log("Camera: OK"))
  .catch(err => console.error("Camera Error:", err))
```

**Network Diagnostics:**
```
// Test internet connectivity
ping 8.8.8.8

// Test DNS resolution
nslookup soltec-innovation.com

// Test WebSocket (from browser console)
let ws = new WebSocket('wss://your-server.com')
ws.onopen = () => console.log("WebSocket: Connected")
ws.onerror = (e) => console.error("WebSocket Error:", e)
```

---

## FLOWCHART 11: LASER READS ALL 0.000 m (PROTOCOL MISMATCH)

```
[START: Laser connected, live readings show exactly 0.000 m constantly]
│
├─{What laser hardware is connected?}
│  ├─ LDM71 → Check protocol selected
│  │    └─{Settings → Laser → Protocol — is "LDM71" selected?}
│  │       ├─ NO → [SOLUTION: Change to LDM71 (ASCII). Disconnect and reconnect.]
│  │       │       └─[DONE ✓]
│  │       └─ YES → Continue →
│  │
│  ├─ RSA / SolTec → Check protocol selected
│  │    └─{Settings → Laser → Protocol — is correct protocol selected?}
│  │       ├─ NO → [SOLUTION: RSA = 3-byte binary. SolTec = SolTec binary. Select correct one.]
│  │       │       └─[DONE ✓]
│  │       └─ YES → Continue →
│  │
│  └─ Not sure →
│       └─ Try LDM71 protocol first, then RSA, then SolTec binary in order.
│
├─{After protocol change, still 0.000?}
│  ├─ NO → [DONE ✓ — protocol was the issue]
│  └─ YES → Continue
│
├─{Is baud rate correct?}
│  ├─ All vertical lasers → 115,200 baud 8N1
│  └─ Lateral/Rear lasers → 19,200 baud 7E1
│
└─{Still 0.000 after baud check?}
   └─ [ESCALATE: Possible hardware fault. Contact support@soltecinnovation.com with device serial number]
```

---

## FLOWCHART 12: VOICE COMMANDS NOT WORKING

```
[START: Voice assistant not recognizing commands or microphone icon missing]
│
├─{Is Voice Assistant enabled?}
│  ├─ NO → Settings → Voice Commands → Enable Voice Assistant → Toggle ON
│  │        └─{Fixed?} → YES → [DONE ✓] / NO → Continue
│  └─ YES → Continue
│
├─{Is microphone permission granted in browser?}
│  ├─ NO → Click lock icon (address bar) → Microphone → Allow → Reload page
│  │        └─{Fixed?} → YES → [DONE ✓] / NO → Continue
│  └─ YES → Continue
│
├─{Is there an internet connection?}
│  ├─ NO → [INFORMATION: Voice commands (speech recognition) require internet.
│  │         Voice notes work offline. Connect to internet to use voice commands.]
│  └─ YES → Continue
│
├─{What browser is being used?}
│  ├─ Chrome / Edge / Brave / Opera → These are supported. Continue.
│  ├─ Firefox → [WARNING: Firefox has limited / experimental Web Speech API support.
│  │             Switch to Chrome or Edge for reliable voice command support.]
│  ├─ Safari → [NOT SUPPORTED: Web Speech API not available in Safari. Use Chrome/Edge.]
│  └─ Other → [SOLUTION: Switch to Chrome 90+ or Edge 90+]
│
├─{Is the correct language selected?}
│  ├─ Check Settings → Voice Commands → Language (EN / FR / ES)
│  └─ Ensure you are speaking in the selected language
│
├─{Is there background noise?}
│  ├─ YES → [SOLUTION: Move to quieter environment or speak more clearly]
│  └─ NO → Continue
│
└─{Still failing?}
   ├─ Say "help" — if assistant responds, recognition is working (wrong command phrasing)
   └─ [ESCALATE: Contact support@soltecinnovation.com with browser version and error]
```

---

## FLOWCHART 13: ROAD PROFILE MODULE NOT RECORDING

```
[START: Road Profile panel missing or not updating during drive]
│
├─{Is Road Profile Recording enabled?}
│  ├─ NO → Settings → Road Profile → Enable Road Profile Recording → toggle ON
│  │        └─[DONE ✓]
│  └─ YES → Continue
│
├─{What GPS source is active?}
│  ├─ USB GPS / Bluetooth GPS / Browser Geolocation →
│  │    [NOT SUPPORTED: Road Profile requires the Swift Navigation Duro RTK-GNSS receiver.
│  │     These GPS sources do not provide centimetre-level elevation or IMU data.
│  │     Connect the Duro to enable Road Profiling.]
│  │    └─[DONE — connect Duro]
│  └─ Duro → Continue
│
├─{What is the Duro fix type?}
│  ├─ No Fix / SBAS / Float →
│  │    [SOLUTION: Wait for RTK Fixed (green indicator). Road Profile accuracy requires RTK Fixed.
│  │     Check: is NTRIP configured? Is cellular connected? Is antenna clear of obstructions?]
│  └─ RTK Fixed → Continue
│
├─{Is logging active?}
│  ├─ NO → Press Alt+3 or open a survey and tap Start logging
│  │        └─[DONE ✓]
│  └─ YES → Continue
│
├─{Is the Road Profile panel on screen?}
│  ├─ NO → Toggle the Road Profile panel via View → Road Profile
│  └─ YES → Continue
│
└─{Still not updating?}
   └─[ESCALATE: Contact support@soltecinnovation.com — attach browser console log (F12 → Console)]
```

---

## FLOWCHART 14: ROUTE ENFORCEMENT STOP MODAL WON'T CLEAR

```
[START: Driver's screen shows STOP modal and cannot dismiss it]
│
├─{Is dispatch logged in and viewing the convoy console?}
│  ├─ NO → [SOLUTION: Dispatch must log into MeasurePRO and navigate to
│  │          Route Enforcement → Active Convoy → [Convoy Name] → Violations]
│  └─ YES → Continue
│
├─{Does the violation appear in the dispatch console?}
│  ├─ NO → Check if convoy is still active (has the session timed out?)
│  │         Reload the dispatch console and check the Active Convoys list
│  └─ YES → Continue
│
├─{Contact driver to confirm situation}
│  ├─ Use in-app call button on the dispatch console
│  └─ Assess whether the off-route event was: detour / wrong turn / GPS error / emergency
│
├─{Is it safe to clear the violation?}
│  ├─ NO → Do NOT clear — have driver stop vehicle and resolve situation first
│  └─ YES → Continue
│
├─{Click "Clear Violation" on the dispatch console}
│  └─ Add resolution notes: reason for off-route, corrective action, date/time
│
└─{STOP modal dismissed on driver's device → [DONE ✓]}
   Note: The violation is logged permanently in the convoy black box regardless of clearance.
```

---

## FLOWCHART 15: LICENSE KEY WON'T ACTIVATE (DESKTOP)

```
[START: User pasted license key but activation failed]
│
├─{What error message is shown?}
│
├─ "Cannot decode key" →
│    [SOLUTION: Key is corrupted or incomplete]
│    • Ensure the ENTIRE key was copied (it's a long base64 string)
│    • Re-copy from the original email/message
│    • Do not add spaces or line breaks
│    └─{Fixed?} → YES → [DONE ✓] / NO → [ESCALATE]
│
├─ "Key is for a different computer" →
│    [SOLUTION: Machine ID mismatch]
│    • The key was generated for a different computer
│    • Copy YOUR Machine ID from the activation screen
│    • Send it to your administrator for a new key
│    └─[DONE — wait for new key]
│
├─ "Invalid key — signature mismatch" →
│    [SOLUTION: Key was modified or is from wrong product]
│    • Re-copy the key exactly as received
│    • Ensure it's a MeasurePRO key (not RoadScope, SweptPRO, etc.)
│    └─{Fixed?} → YES → [DONE ✓] / NO → [ESCALATE]
│
├─ "License expired on YYYY-MM-DD" →
│    [SOLUTION: Key has expired]
│    • Contact administrator for a renewal key
│    • A new key with extended expiration is needed
│    └─[DONE — wait for new key]
│
├─ "System clock appears to have been set back" →
│    [SOLUTION: Clock rollback detected]
│    • Verify your system date/time is correct
│    • Enable automatic time sync in Windows Settings
│    └─{Fixed?} → YES → [DONE ✓] / NO → [ESCALATE]
│
└─ Other error →
   [ESCALATE: Contact support@soltecinnovation.com]
   Include: error message, Machine ID, screenshot
```

---

## FLOWCHART 16: TRIAL EXPIRED

```
[START: "Your 7-day free trial has expired" message shown]
│
├─{Do you have a license key?}
│  ├─ YES → Paste it in the License Key field and click "Activate License"
│  │        └─{Activated?} → YES → [DONE ✓] / NO → See FLOWCHART 15
│  │
│  └─ NO → Continue
│
├─{Have you contacted your administrator?}
│  ├─ NO → [SOLUTION: Request a license key]
│  │        1. Copy your Machine ID from the activation screen
│  │        2. Click "Send Machine ID to Administrator" button
│  │        3. Or email it to your admin / sales@soltecinnovation.com
│  │        4. Wait for your license key
│  │        └─[DONE — wait for key]
│  │
│  └─ YES → Continue
│
├─{Are you in the 2-day grace period?}
│  ├─ YES → You still have access — use this time to get your key activated
│  │        └─ Banner shows "Grace period: X days remaining"
│  │
│  └─ NO (fully locked out) → Continue
│
└─{Contact support}
   └─ Email: support@soltecinnovation.com
      Phone: +1.438.533.5344
      Provide: Machine ID + your name/company
```

---

## FLOWCHART 17: LIVE SUPPORT NOT CONNECTING

```
[START: Live Support session won't start or connect]
│
├─{Is there an internet connection?}
│  ├─ NO → [SOLUTION: Live Support requires internet for WebRTC signaling]
│  │        └─ Connect to WiFi or cellular data
│  └─ YES → Continue
│
├─{Are you signed in with Firebase?}
│  ├─ NO → [SOLUTION: Live Support requires authentication]
│  │        └─ Sign in first, then try again
│  └─ YES → Continue
│
├─{Did you get a session code?}
│  ├─ NO → [SOLUTION: Session creation failed]
│  │        • Check internet connection
│  │        • The RoadScope server may be down
│  │        • Try again in a few minutes
│  │        └─{Fixed?} → YES → [DONE ✓] / NO → [ESCALATE]
│  │
│  └─ YES → Continue
│
├─{Did the admin enter the code?}
│  ├─ NO → Share the session code with your support agent
│  │        └─ Code expires after 5 minutes
│  └─ YES → Continue
│
├─{Did you approve the admin's request?}
│  ├─ NO → Look for the "Admin wants to join" prompt and click Approve
│  └─ YES → Continue
│
├─{Is screen sharing working?}
│  ├─ NO → [SOLUTION: Screen capture permission]
│  │        • When prompted, choose which screen/window to share
│  │        • On macOS: System Settings → Privacy → Screen Recording → allow MeasurePRO
│  │        └─{Fixed?} → YES → [DONE ✓] / NO → [ESCALATE]
│  │
│  └─ YES → [DONE ✓]
│
└─[ESCALATE: Contact support with session code and error details]
```

---

**End of Troubleshooting Flowcharts**

*MeasurePRO by SolTecInnovation*  
*Version 3.0 | April 2026*
