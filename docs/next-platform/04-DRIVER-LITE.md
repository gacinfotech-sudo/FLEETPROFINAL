# Driver Lite — Ultra-Lightweight Mobile App (WAVE 4)

**Status**: SPECIFICATION COMPLETE  
**Target Devices**: 2GB RAM, 3GB RAM, older Android (API 24+)  
**APK Size Budget**: ≤ 30MB  
**Startup Time**: < 5s cold, < 1s warm  
**Date**: 2026-08-12

---

## Product Vision

Driver Lite is the **absolute minimum** required for drivers to:
1. Accept duties assigned by operations
2. Execute assigned trips
3. Record expenses
4. Collect payments
5. Work offline

No CRM, no analytics, no heavy UI. **Lightweight. Reliable. Offline-first.**

---

## Architecture

### Tech Stack

```
Language:      Kotlin (or minimal Java)
Framework:     Android (native)
Min SDK:       24 (Android 7.0+)
Target SDK:    34 (Android 14)
Build System:  Gradle 8.x

Local DB:      SQLite (built-in, no dependencies)
HTTP Client:   OkHttp (minimal, async)
JSON:          kotlinx.serialization (zero reflection)

No:
- WebView
- Heavy charting libraries
- Analytics SDKs
- Ad networks
- Bloated dependencies
```

### Project Structure

```
driver-lite/
├── build.gradle.kts
├── build.gradle (root)
├── settings.gradle
├── gradle.properties
│
├── app/src/main/
│   ├── AndroidManifest.xml
│   ├── kotlin/com/fleetpro/driver/
│   │   ├── DriverLiteApp.kt           (Application class, DI setup)
│   │   ├── MainActivity.kt             (Single activity)
│   │   │
│   │   ├── ui/
│   │   │   ├── screens/                (Composable screens)
│   │   │   │   ├── LoginScreen.kt
│   │   │   │   ├── HomeScreen.kt
│   │   │   │   ├── DutiesListScreen.kt
│   │   │   │   ├── DutyDetailScreen.kt
│   │   │   │   ├── TripScreen.kt
│   │   │   │   ├── ExpenseScreen.kt
│   │   │   │   └── ProfileScreen.kt
│   │   │   ├── components/             (Reusable UI)
│   │   │   │   ├── DutyCard.kt
│   │   │   │   ├── CountdownTimer.kt
│   │   │   │   └── ActionButtons.kt
│   │   │   └── theme/
│   │   │       └── Theme.kt            (Simple theme, no Material 3 bloat)
│   │   │
│   │   ├── data/
│   │   │   ├── local/
│   │   │   │   ├── db/
│   │   │   │   │   ├── DriverLiteDb.kt (Room database)
│   │   │   │   │   ├── entities/       (SQLite entities)
│   │   │   │   │   │   ├── DutyEntity.kt
│   │   │   │   │   │   ├── ExpenseEntity.kt
│   │   │   │   │   │   ├── PaymentEntity.kt
│   │   │   │   │   │   └── SyncOperationEntity.kt
│   │   │   │   │   └── dao/            (Data access)
│   │   │   │   │       ├── DutyDao.kt
│   │   │   │   │       ├── ExpenseDao.kt
│   │   │   │   │       └── SyncOperationDao.kt
│   │   │   │   ├── prefs/
│   │   │   │   │   └── PreferencesManager.kt (SharedPreferences)
│   │   │   │   └── sync/
│   │   │   │       ├── SyncEngine.kt
│   │   │   │       ├── OutboxQueue.kt
│   │   │   │       └── SyncWorker.kt
│   │   │   │
│   │   │   ├── remote/
│   │   │   │   ├── ApiClient.kt
│   │   │   │   ├── auth/
│   │   │   │   │   ├── SessionManager.kt
│   │   │   │   │   ├── DeviceFingerprint.kt
│   │   │   │   │   └── TokenRefresh.kt
│   │   │   │   └── endpoints/
│   │   │   │       ├── AuthApi.kt
│   │   │   │       ├── DutyApi.kt
│   │   │   │       └── SyncApi.kt
│   │   │   │
│   │   │   └── repository/
│   │   │       ├── DutyRepository.kt   (Offline-first)
│   │   │       ├── ExpenseRepository.kt
│   │   │       └── SyncRepository.kt
│   │   │
│   │   ├── domain/
│   │   │   ├── models/
│   │   │   │   ├── Duty.kt
│   │   │   │   ├── Expense.kt
│   │   │   │   ├── Payment.kt
│   │   │   │   └── Driver.kt
│   │   │   └── usecases/
│   │   │       ├── AcceptDutyUseCase.kt
│   │   │       ├── RecordExpenseUseCase.kt
│   │   │       ├── SyncOperationsUseCase.kt
│   │   │       └── LoginUseCase.kt
│   │   │
│   │   ├── viewmodel/
│   │   │   ├── DutyListViewModel.kt
│   │   │   ├── DutyDetailViewModel.kt
│   │   │   ├── ExpenseViewModel.kt
│   │   │   └── SyncViewModel.kt
│   │   │
│   │   └── util/
│   │       ├── PhoneNormalizer.kt      (Shared from backend)
│   │       ├── Logger.kt
│   │       ├── DateFormatter.kt
│   │       └── NetworkUtils.kt
│   │
│   └── res/
│       ├── values/
│       │   ├── strings.xml
│       │   ├── colors.xml
│       │   ├── dimens.xml
│       │   └── styles.xml
│       ├── layout/                    (Legacy layouts if needed)
│       └── drawable/                  (Minimal icons)
│
├── app/src/test/
│   └── kotlin/com/fleetpro/driver/
│       ├── PhoneNormalizerTest.kt
│       ├── OfflineSyncTest.kt
│       ├── IdempotencyTest.kt
│       └── ConflictResolutionTest.kt
│
└── gradle/
    └── libs.versions.toml             (Dependency management)
```

---

## Database Schema (SQLite)

### DutyEntity
```sql
CREATE TABLE duties (
  id TEXT PRIMARY KEY,
  bookingId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  customerName TEXT NOT NULL,
  customerPhone TEXT NOT NULL,
  pickupLocation TEXT NOT NULL,
  dropLocation TEXT,
  pickupTime TEXT,
  pickupTimeSeconds LONG,
  vehicleId TEXT,
  vehicleNumber TEXT,
  status TEXT,          -- ASSIGNED, ACCEPTED, STARTED, COMPLETED, REJECTED
  assignmentId TEXT,
  acceptanceDeadlineSeconds LONG,
  downloadedAt LONG,
  syncedAt LONG,
  version INTEGER DEFAULT 1,
  createdAt LONG,
  updatedAt LONG
);
```

### ExpenseEntity
```sql
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  operationId TEXT UNIQUE,
  dutyId TEXT NOT NULL,
  category TEXT,         -- fuel, toll, parking, other
  amount REAL NOT NULL,
  description TEXT,
  photoUrl TEXT,
  status TEXT,           -- PENDING, SYNCED, CONFLICT
  deviceTimestamp LONG,
  syncStatus TEXT,       -- PENDING, SYNCED, FAILED
  version INTEGER DEFAULT 1,
  createdAt LONG,
  updatedAt LONG,
  FOREIGN KEY (dutyId) REFERENCES duties(id)
);
```

### SyncOperationEntity
```sql
CREATE TABLE sync_operations (
  id TEXT PRIMARY KEY,
  operationId TEXT UNIQUE NOT NULL,
  entityType TEXT,       -- EXPENSE, PAYMENT, DUTY_START, etc.
  entityId TEXT,
  payload TEXT,          -- JSON
  status TEXT,           -- PENDING, SYNCED, CONFLICT, FAILED
  deviceTimestamp LONG,
  serverTimestamp LONG,
  baseVersion INTEGER,
  attemptCount INTEGER DEFAULT 0,
  lastError TEXT,
  conflictDetails TEXT,  -- JSON
  createdAt LONG,
  updatedAt LONG
);
```

### PaymentEntity
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  operationId TEXT UNIQUE,
  dutyId TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,           -- CASH, UPI, CARD
  status TEXT,           -- PENDING, COLLECTED, SYNCED
  syncStatus TEXT,
  deviceTimestamp LONG,
  version INTEGER DEFAULT 1,
  createdAt LONG,
  FOREIGN KEY (dutyId) REFERENCES duties(id)
);
```

### Indexes
```sql
CREATE INDEX idx_duties_status ON duties(status);
CREATE INDEX idx_duties_syncedAt ON duties(syncedAt);
CREATE INDEX idx_expenses_dutyId ON expenses(dutyId);
CREATE INDEX idx_expenses_operationId ON expenses(operationId);
CREATE INDEX idx_sync_ops_status ON sync_operations(status);
CREATE INDEX idx_sync_ops_operationId ON sync_operations(operationId);
```

---

## Screens & Navigation

### 7 Core Screens

```
Login Screen
├─ Phone number input
├─ PIN entry
├─ Device registration
└─ Session creation

Home Screen (After Login)
├─ Welcome message
├─ Next Duty Card (prominent)
│  ├─ Pickup time countdown
│  ├─ Pickup location
│  ├─ Route
│  └─ Quick actions (NAVIGATE, CALL CUSTOMER)
├─ Today's Summary
│  ├─ Duties completed
│  ├─ Pending sync count
│  └─ Collections total
└─ Navigation (5 buttons at bottom)

Duties List Screen
├─ Today's duties
├─ Status filter (All, Pending, Completed)
├─ Duty cards (simplified)
│  ├─ Status badge
│  ├─ Customer name
│  ├─ Pickup time
│  └─ Tap to open
└─ Pull-to-refresh (manual sync trigger)

Duty Detail Screen
├─ Full duty information
│  ├─ Booking ID
│  ├─ Customer (name, phone)
│  ├─ Pickup (location, time, countdown)
│  ├─ Drop (location)
│  ├─ Route
│  └─ Special instructions
├─ Action buttons
│  ├─ ACCEPT DUTY (if pending)
│  ├─ NAVIGATE (Google Maps/Waze)
│  ├─ START TRIP
│  └─ COMPLETE
└─ Trip timeline (visual)

Trip Screen (During Active Trip)
├─ Current duty details (compact)
├─ Elapsed time
├─ KM counter (if manual, or from GPS if available)
├─ Quick actions
│  ├─ REACHED (at destination)
│  ├─ EXPENSE (add fuel/toll/parking)
│  ├─ COLLECTION (record payment)
│  └─ END TRIP
└─ Sync status (subtle indicator)

Expense Screen
├─ Add expense form
│  ├─ Category (dropdown: fuel, toll, parking, other)
│  ├─ Amount (numeric input)
│  ├─ Description (text)
│  └─ Optional: Photo (camera)
├─ Recent expenses (list)
└─ Add button (save locally)

Profile Screen
├─ Driver info (read-only from login)
│  ├─ Name
│  ├─ Phone
│  ├─ Driver ID
│  └─ Last login
├─ Settings
│  ├─ Sync status (manual check)
│  ├─ Offline mode (toggle)
│  ├─ Auto-sync interval
│  └─ Clear cache
└─ Logout button
```

---

## Offline-First Flow

### Local Operation (No Network)

1. **User accepts duty** → Stored locally, UI confirms immediately
2. **User records expense** → Stored with operationId, synced later
3. **User collects payment** → Stored locally, no server call needed
4. **App shows status**: "PENDING SYNC" (subtle)

### Automatic Sync (When Online)

1. **Background job** checks connectivity
2. If online: **SyncWorker** pulls operations from local queue
3. **SyncEngine** batches (up to 100 ops per request)
4. Sends `/mobile/v1/sync/push` with operationIds
5. Receives results: SYNCED, CONFLICT, FAILED
6. Updates local DB with sync status
7. **No UI prompt** — silent background work

### Conflict Handling

If expense conflicts on server:
- Mark as CONFLICT in local DB
- Show notification (not blocking)
- Allow user to manually retry or delete
- Never silently discard

---

## Performance Targets

| Metric | Target | How Measured |
|--------|--------|--------------|
| APK Size | ≤ 30MB | `adb shell pm dump` |
| Cold Start | < 5s | Stopwatch from tap to home |
| Warm Start | < 1s | Already open, backgrounded |
| DB Query | < 100ms | SQLite on 2GB device |
| Sync (100 ops) | < 10s | Network + parsing |
| Memory (idle) | < 80MB | `adb shell dumpsys meminfo` |
| Memory (active) | < 150MB | While trip in progress |
| Battery (8h duty) | ≤ 25% drain | Background sync + location |

---

## Dependencies (Minimal)

```toml
[versions]
kotlin = "1.9.0"
androidx-compose = "1.6.0"
androidx-room = "2.6.0"
okhttp = "4.11.0"

[libraries]
# Core Android
androidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version = "1.6.1" }
androidx-core = { group = "androidx.core", name = "core-ktx", version = "1.12.0" }

# Compose (lightweight UI)
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui", version.ref = "androidx-compose" }
androidx-compose-foundation = { group = "androidx.compose.foundation", name = "foundation", version.ref = "androidx-compose" }
androidx-compose-material = { group = "androidx.compose.material", name = "material", version.ref = "androidx-compose" }

# Local DB (built-in SQLite wrapper)
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "androidx-room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "androidx-room" }

# Network
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
kotlinx-serialization = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version = "1.6.0" }

# Lifecycle + ViewModel
androidx-lifecycle-viewmodel = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-ktx", version = "2.6.2" }
androidx-lifecycle-runtime = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version = "2.6.2" }

# DI (minimal)
hilt = { group = "com.google.dagger", name = "hilt-android", version = "2.48" }

# Testing
junit = { group = "junit", name = "junit", version = "4.13.2" }
androidx-test-espresso = { group = "androidx.test.espresso", name = "espresso-core", version = "3.5.1" }

# NO heavy libraries: no Firebase, no Crashlytics, no Analytics
```

---

## Permission Manifest

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
```

**Optional (if GPS used in future)**:
```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

---

## Testing Checklist (Per 2GB/3GB Device)

- [ ] Login flow (phone + PIN)
- [ ] Duty download (no network)
- [ ] Duty acceptance (offline, then sync)
- [ ] Expense recording (multiple, offline)
- [ ] Payment collection (offline)
- [ ] Sync (when online, automatic)
- [ ] Conflict resolution (manual retry)
- [ ] App kill (reopen, state preserved)
- [ ] Device reboot (app reopens, state OK)
- [ ] Low storage (clear cache, continue)
- [ ] Airplane mode (full offline, then toggle)
- [ ] Network switch (WiFi → 3G → WiFi)
- [ ] Memory pressure (duty still loads)
- [ ] Battery deep-sleep (background sync works)

---

## Success Criteria (WAVE 4 Complete)

- [ ] Project structure created (Gradle, dependencies)
- [ ] SQLite schema implemented (5 entities, indexes)
- [ ] 7 screens UI skeleton (Compose, no logic yet)
- [ ] Navigation flow (bottom tabs, screen switching)
- [ ] Authentication placeholder (mock device register)
- [ ] Local DB working (Room DAO tests pass)
- [ ] Offline-first architecture ready
- [ ] Zero TS/build errors
- [ ] APK builds successfully (debug build)

---

**Document Version**: 1.0  
**Status**: SPECIFICATION COMPLETE  
**Next**: WAVE 5 (Driver Assignment state machine + notifications)  
**Last Updated**: 2026-08-12
