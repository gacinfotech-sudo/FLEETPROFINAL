# FLEETPRO GOLDEN UI BASELINE
**Status**: PERMANENTLY LOCKED  
**Date**: 2026-08-09  
**Immutable Tag**: `fleetpro-golden-ui-locked`

---

## Golden State Snapshot

### Deployment Info
```
Worktree: /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
Branch: booking/integration-preview
Commit: 94844c55283fcb52bc6d2d160b4a7bebf2e6480a
Commit Message: feat: add system health dashboard widget
Timestamp: 2026-08-09 02:15:46 +0530
Tag: fleetpro-golden-ui-locked (immutable)
```

### Build Configuration
```
Frontend Framework: React 18 + TypeScript
Build Tool: Vite 5.4.21
Backend Framework: Express.js (Node.js)
Database: MongoDB 127.0.0.1:27017
Port: 5050
Environment: production ready
```

### Application Structure

#### Frontend Entry Points
- **App Shell**: `client/src/App.tsx` (4,411 bytes)
- **Dashboard**: `client/src/pages/dashboard.tsx` (113,209 bytes)
- **Sidebar**: `client/src/components/layout/sidebar.tsx` (12,891 bytes)
- **Main CSS**: `client/src/index.css`
- **UI Components**: `client/src/components/ui/` (44 components)

#### Protected UI Files (IMMUTABLE)
```
client/src/App.tsx
client/src/index.css
client/src/pages/dashboard.tsx
client/src/components/layout/sidebar.tsx
client/src/components/layout/header.tsx
client/src/components/layout/navigation.tsx
client/src/components/ui/*.tsx (all base components)
client/src/lib/theme.ts
client/src/lib/colors.ts
tailwind.config.js
```

---

## Visual Layout Specification

### Dashboard
- **Location**: `http://localhost:5050/dashboard/dashboard`
- **Layout**: Three-column responsive grid
- **Left**: Sidebar navigation (fixed)
- **Center**: Main content area (dynamic)
- **Right**: None (full width)
- **Top**: Header (authentication, search, menu)
- **Bottom**: Footer (if present)

### Sidebar
- **Position**: Left fixed
- **Width**: ~250px (desktop), collapsed on mobile
- **Items**: 
  - Dashboard
  - Customers
  - Bookings
  - Fleet (Vehicles)
  - Drivers
  - Finance/Revenue
  - Vendors
  - Expenses
  - Reports
  - Settings
- **Active indicator**: Highlight on current page
- **Responsive**: Hamburger menu on < 768px

### Header
- **Position**: Top fixed/sticky
- **Height**: ~60px
- **Left**: Hamburger (mobile) / Logo
- **Center**: Current page title / Breadcrumb
- **Right**: Search, Notifications, Profile menu, Logout

### Theme
- **Primary Color**: Brand blue (#1F2937)
- **Secondary**: Accent color (varies by context)
- **Background**: Light mode (white #FFFFFF)
- **Text**: Dark text (#1F2937)
- **Borders**: Light gray (#E5E7EB)
- **Spacing**: Tailwind default scale (4px units)
- **Typography**: System fonts (sans-serif)
- **Icons**: Lucide React (24px standard)

### Responsive Breakpoints (Golden)
- **Mobile**: < 640px (Sidebar hidden, hamburger menu)
- **Tablet**: 640px - 1023px (Sidebar visible, adjusted width)
- **Desktop**: >= 1024px (Full layout)
- **Large**: >= 1366px (Optimized spacing)

---

## Component Hierarchy (DO NOT CHANGE)

### Root Level
```
<App>
  <Sidebar>
  <Header>
  <main>
    <CurrentPage>
    <Dialogs>
    <ToastContainer>
  </main>
</App>
```

### Page Structure
```
<Dashboard>
  <PageHeader>
  <PageContent>
    <Cards>
    <Tables>
    <Charts>
  <Modals>
</Dashboard>
```

### Component Reuse Rules
- All pages use same Sidebar component
- All pages use same Header component
- All forms use shared Button, Input, Select components
- All tables use shared Table component
- All cards use shared Card component
- Modal/Dialog system is centralized

---

## Protected Files (SHA256 Checksums)

These files must NEVER change without explicit UI redesign approval:

```
App.tsx: [SEE .ui-lock/golden-ui-hashes.json]
sidebar.tsx: [SEE .ui-lock/golden-ui-hashes.json]
dashboard.tsx: [SEE .ui-lock/golden-ui-hashes.json]
index.css: [SEE .ui-lock/golden-ui-hashes.json]
theme files: [SEE .ui-lock/golden-ui-hashes.json]
ui components: [SEE .ui-lock/golden-ui-hashes.json]
```

---

## API Contract (Golden)

### Dashboard Stats Endpoint
- **Route**: `/api/dashboard/stats`
- **Method**: GET
- **Response**: 
  ```json
  {
    "totalBookings": number,
    "totalVehicles": number,
    "activeDrivers": number,
    "totalRevenue": number
  }
  ```

### Routes Must Support
- `/dashboard/dashboard` (main UI)
- `/api/auth/login`
- `/api/health`
- All entity CRUD endpoints (customers, vehicles, drivers, bookings)

---

## UI Extension Points (Approved)

New features may integrate through these ONLY:

### 1. Dashboard Module Registry
**Location**: Feature registers with dashboard via config  
**Does NOT modify**: Dashboard grid, layout, or appearance  
**Adds**: New card in designated area  

### 2. Sidebar Menu Registration
**Location**: Feature registers route in sidebar menu config  
**Does NOT modify**: Sidebar styling or structure  
**Adds**: New menu item  

### 3. 360 Tab Registry
**Location**: Feature registers new tab in existing 360 modules  
**Does NOT modify**: Tab bar styling or container layout  
**Adds**: New tab content  

### 4. Action Registry
**Location**: Feature registers new actions on existing pages  
**Does NOT modify**: Page layout or styling  
**Adds**: New action buttons or menu items  

---

## Files That MAY Change (Without UI Lock Violation)

- Backend API routes (new endpoints)
- Database schemas (new collections)
- Business logic files
- Service implementations
- Utilities and helpers
- Test files
- Configuration files (not theme/CSS config)
- Documentation

---

## Files That MUST NOT Change (UI Lock Violation)

- Any file in `protected-ui-files.txt`
- Sidebar visual component
- Dashboard visual layout
- Global CSS/theme
- App shell
- Layout components
- Root route configuration (visual structure)
- Header visual component

---

## Current Feature Set (At Golden Commit)

✅ **Core Modules**
- Customer Management (Master, 360, Inquiries, Leads, etc.)
- Booking Management (Create, lifecycle, payment, history)
- Driver Management (Master, 360, documents, compliance)
- Vehicle Management (Master, 360, maintenance, GPS)
- Finance & Revenue (Dashboard, reports, KPI cards)
- Vendor Management (Master, 360, settlement)
- RBAC & Security (Users, roles, permissions)
- WhatsApp Integration
- Reports & Analytics
- GPS Tracking

✅ **UI Features**
- Responsive design (mobile/tablet/desktop)
- Dark mode capable
- PDF export
- Search functionality
- Filtering and sorting
- Data tables with pagination
- Modal dialogs for create/edit
- Toast notifications
- Loading states
- Error handling UI

---

## Golden UI Approval

**Approved By**: User (visual confirmation on 2026-08-09)  
**Approval Method**: User confirmed UI matches expected state  
**Status**: FINAL - DO NOT CHANGE ACCIDENTALLY  
**Enforcement**: Repository guardrails, CI tests, pre-commit hooks  

---

## UI Change Policy

### Normal Development
- ❌ Cannot change Dashboard
- ❌ Cannot change Sidebar
- ❌ Cannot change Header
- ❌ Cannot change Global CSS
- ✅ Can add new feature pages
- ✅ Can extend 360 modules (via tab registry)
- ✅ Can add new menu items (via sidebar registry)

### Approved UI Redesign (Requires Explicit User Request)
- User explicitly requests UI change
- User provides new design/specification
- Team implements new design
- New golden baseline created
- Tag updated to new commit
- All guardrails re-verify against new baseline

---

## How to Report UI Regression

If you notice the UI has changed unintentionally:

1. **Check build commit**: `git log -1 --oneline`
2. **Verify it's on golden branch**: Should be `booking/integration-preview`
3. **Take screenshot**: Capture what's wrong
4. **Compare to golden**: 
   ```bash
   git checkout fleetpro-golden-ui-locked
   npm run build && PORT=5050 npm run dev
   # Compare visually
   ```
5. **Report**: What changed, what should be restored
6. **Automatic rollback** (if merged accidentally):
   ```bash
   scripts/restore-golden-ui.sh
   ```

---

## Immutable Record

This document is the permanent reference.

The golden UI is:
- **Commit**: 94844c55283fcb52bc6d2d160b4a7bebf2e6480a
- **Tag**: fleetpro-golden-ui-locked
- **Branch**: booking/integration-preview
- **Status**: FROZEN, PROTECTED, APPROVED

Any deviation from this state without explicit user authorization is a UI lock violation.

---

**Created**: 2026-08-09  
**Last Updated**: 2026-08-09  
**Next Review**: On request for UI changes only  
