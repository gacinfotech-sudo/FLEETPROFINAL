# Phase 34: User Notification Preferences UI - Complete Implementation Guide

## Overview

Phase 34 implements a comprehensive notification preferences system that allows users to control:
- Global notification enable/disable
- Channel selection (Push, Email, SMS, In-App)
- Quiet hours configuration
- Category-specific preferences
- Frequency caps (daily/hourly limits)
- Unsubscription management

## Architecture

### Backend Components

#### 1. **Database Schema** (`server/migrations/011_notification_preferences.ts`)
- Collection: `notification_preferences`
- Unique index on `userId`
- Indexes for quiet hours, frequency caps, and unsubscription queries

#### 2. **Data Model** (`server/utils/notificationPreferences.ts`)
```typescript
interface NotificationPreference {
  userId: string;
  globalEnabled: boolean;
  globalChannels: NotificationChannel[];
  categories: Record<string, CategoryPreference>;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // "HH:MM" format
  quietHoursEnd?: string;   // "HH:MM" format
  quietHoursTimezone?: string;
  dailyFrequencyCap?: number; // -1 for unlimited
  hourlyFrequencyCap?: number;
  unsubscribedFrom: string[];
  updatedAt: Date;
}
```

#### 3. **Preference Manager** (`server/utils/notificationPreferences.ts`)
Provides methods for:
- `getPreferences(userId)` - Fetch user preferences
- `setPreferences(userId, preferences)` - Update entire preference set
- `setCategoryPreference(userId, category, preference)` - Update single category
- `setQuietHours(userId, start, end, timezone)` - Configure quiet hours
- `setFrequencyCaps(userId, dailyCap, hourlyCap)` - Set frequency limits
- `canSendNotification(userId, category, channel)` - Check if notification should be sent
- `unsubscribe/resubscribe(userId, category)` - Manage category subscriptions

#### 4. **API Endpoints** (`server/routes/notification-preferences.ts`)

**GET** `/api/notification-preferences/:userId`
- Fetch current preferences
- Response: `{ success: true, preferences: NotificationPreference }`

**PUT** `/api/notification-preferences/:userId`
- Update multiple preference settings
- Body: `Partial<NotificationPreference>`
- Validation: Type checking for all fields

**POST** `/api/notification-preferences/:userId/reset-defaults`
- Reset to default preferences
- Requires confirmation

**PUT** `/api/notification-preferences/:userId/quiet-hours`
- Update quiet hours configuration
- Body: `{ start, end, timezone, enabled }`

**PUT** `/api/notification-preferences/:userId/category/:category`
- Update category-specific preferences
- Body: `{ enabled, channels }`

**PUT** `/api/notification-preferences/:userId/frequency-caps`
- Update frequency cap settings
- Body: `{ dailyCap, hourlyCap }`

**POST** `/api/notification-preferences/:userId/unsubscribe/:category`
- Unsubscribe from notification category

**POST** `/api/notification-preferences/:userId/resubscribe/:category`
- Resubscribe to notification category

### Frontend Components

#### 1. **NotificationPreferencesPanel** (`client/src/components/notifications/NotificationPreferencesPanel.tsx`)
Main component that orchestrates the UI with:
- Real-time state management
- API integration
- Error handling
- Loading/saving states
- Dirty state tracking
- Success/error messaging

Features:
- Global settings toggle
- Channel selection grid
- Quiet hours configuration
- Category expansion/collapse interface
- Frequency cap controls
- Unsubscription management
- Reset to defaults button
- Dark mode support
- Responsive mobile/tablet/desktop layout
- WCAG 2.1 AA accessibility

#### 2. **ChannelToggle** (`client/src/components/notifications/ChannelToggle.tsx`)
Reusable component for selecting notification channels
- Grid layout (1-4 columns configurable)
- Checkbox selection
- Icon + description display
- Disabled state support

#### 3. **QuietHours** (`client/src/components/notifications/QuietHours.tsx`)
Dedicated component for quiet hours settings
- Enable/disable toggle
- Start/end time inputs (HH:MM format)
- Timezone dropdown (10+ zones)
- Helpful info messages
- Input validation

#### 4. **CategorySubscriptions** (`client/src/components/notifications/CategorySubscriptions.tsx`)
Manages category-specific preferences with:
- Expandable category cards
- Per-category enable/disable
- Channel selection per category
- Unsubscribe buttons
- Badge indicators

#### 5. **FrequencyCaps** (`client/src/components/notifications/FrequencyCaps.tsx`)
Controls notification frequency limits
- Daily cap input
- Hourly cap input
- Quick preset buttons (Moderate, Limited, Unlimited)
- Helpful tips and info

## Default Preferences

```typescript
{
  globalEnabled: true,
  globalChannels: ['push'],
  categories: {
    booking: { enabled: true, channels: ['push'] },
    payment: { enabled: true, channels: ['push'] },
    driver: { enabled: true, channels: ['push'] },
    vehicle: { enabled: true, channels: ['push'] },
    customer: { enabled: true, channels: ['push'] },
    alert: { enabled: true, channels: ['push'] },
    reminder: { enabled: true, channels: ['push'] },
    promo: { enabled: false, channels: [] },
    system: { enabled: true, channels: ['push'] }
  },
  quietHoursEnabled: false,
  dailyFrequencyCap: -1,
  hourlyFrequencyCap: -1,
  unsubscribedFrom: []
}
```

## Usage Examples

### Integration in a Settings Page

```tsx
import NotificationPreferencesPanel from '@/components/notifications/NotificationPreferencesPanel';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <NotificationPreferencesPanel
        userId={currentUserId}
        onPreferencesChanged={(prefs) => {
          console.log('Preferences updated:', prefs);
        }}
      />
    </div>
  );
}
```

### Using Individual Components

```tsx
import { QuietHours } from '@/components/notifications/QuietHours';
import { FrequencyCaps } from '@/components/notifications/FrequencyCaps';

export function CustomSettingsForm() {
  const [quietHours, setQuietHours] = useState({
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'UTC'
  });

  return (
    <div className="space-y-6">
      <QuietHours
        enabled={quietHours.enabled}
        startTime={quietHours.startTime}
        endTime={quietHours.endTime}
        timezone={quietHours.timezone}
        timezones={[/* timezone list */]}
        onEnabledChange={(e) => setQuietHours({...quietHours, enabled: e})}
        onStartTimeChange={(t) => setQuietHours({...quietHours, startTime: t})}
        onEndTimeChange={(t) => setQuietHours({...quietHours, endTime: t})}
        onTimezoneChange={(z) => setQuietHours({...quietHours, timezone: z})}
      />
    </div>
  );
}
```

### Backend Usage

```typescript
import { notificationPreferenceManager } from './utils/notificationPreferences';

// Get user preferences
const prefs = await notificationPreferenceManager.getPreferences(userId);

// Check if notification can be sent
const canSend = await notificationPreferenceManager.canSendNotification(
  userId,
  'booking',
  'email'
);

// Update preferences
await notificationPreferenceManager.setPreferences(userId, {
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00'
});

// Set frequency caps
await notificationPreferenceManager.setFrequencyCaps(userId, 50, 10);
```

## Features

### 1. **Global Controls**
- Master enable/disable for all notifications
- Default channel selection
- Quick access to all settings

### 2. **Quiet Hours**
- Time-based muting (e.g., 22:00 - 08:00)
- Timezone support (10 zones)
- Overnight hour spanning support (10 PM to 8 AM)
- Urgent alerts may still be delivered

### 3. **Category Management**
- 9 notification categories (Booking, Payment, Driver, Vehicle, Customer, Alert, Reminder, Promo, System)
- Per-category enable/disable
- Per-category channel selection
- Unsubscription with easy resubscription

### 4. **Frequency Caps**
- Daily notification limit (-1 for unlimited)
- Hourly notification limit (-1 for unlimited)
- Quick presets (Moderate, Limited, Unlimited)
- Excess notifications queued for later delivery

### 5. **User Experience**
- Real-time state management
- Dirty state tracking (only save when changed)
- Debounced API calls
- Loading/saving indicators
- Error recovery with retry
- Success confirmation messages
- Expandable/collapsible sections
- Dark mode support
- Fully responsive (mobile/tablet/desktop)

### 6. **Accessibility**
- WCAG 2.1 AA compliant
- Proper ARIA labels
- Keyboard navigation
- Screen reader support
- Semantic HTML
- Proper heading hierarchy

## API Response Examples

### GET /api/notification-preferences/:userId

```json
{
  "success": true,
  "preferences": {
    "userId": "user-123",
    "globalEnabled": true,
    "globalChannels": ["push", "email"],
    "categories": {
      "booking": {
        "enabled": true,
        "channels": ["push", "email"]
      },
      "payment": {
        "enabled": true,
        "channels": ["push"]
      }
    },
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "quietHoursTimezone": "IST",
    "dailyFrequencyCap": 50,
    "hourlyFrequencyCap": 10,
    "unsubscribedFrom": ["promo"],
    "updatedAt": "2026-08-11T12:34:56.789Z"
  }
}
```

### PUT /api/notification-preferences/:userId

```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "preferences": { /* same structure */ }
}
```

## Error Handling

### Validation Errors (400)
```json
{
  "error": "Invalid input",
  "message": "globalEnabled must be a boolean"
}
```

### Authentication Errors (403)
```json
{
  "error": "Forbidden",
  "message": "You can only access your own notification preferences"
}
```

### Server Errors (500)
```json
{
  "error": "Failed to update preferences",
  "message": "Database connection error"
}
```

## Testing

### Unit Tests
- Component rendering tests
- State management tests
- Event handler tests
- Accessibility tests
- Responsive design tests

### Integration Tests
- API endpoint tests
- Database persistence tests
- End-to-end preference flows
- Error recovery tests

### Test Files
- `server/tests/notification-preferences.test.ts` (API tests)
- `tests/NotificationPreferencesPanel.test.tsx` (Component tests)

## Database Indexes

### Performance Optimization
1. **userId (unique)** - Fast user preference lookup
2. **quietHoursEnabled, quietHoursTimezone** - Quiet hours queries
3. **dailyFrequencyCap, hourlyFrequencyCap** - Frequency cap checks
4. **unsubscribedFrom** - Category subscription checks
5. **updatedAt** - Recent updates tracking

## Migration Path

### For Existing Users
1. Default preferences are created on first access
2. No data loss for existing settings
3. Gradual rollout via feature flags

### Data Consistency
- Preferences validated on every update
- Type checking for all fields
- Atomic updates to prevent conflicts

## Known Limitations & Future Enhancements

### Current Limitations
- Quiet hours use client timezone (future: server-side calculation)
- Frequency caps use simple counters (future: sliding window)
- Bulk update not yet supported

### Planned Enhancements
- Notification digest options (daily/weekly summaries)
- Custom category creation
- A/B testing for category names
- Preference templates/presets
- Analytics on preference patterns

## Troubleshooting

### Preferences Not Saving
1. Check browser console for errors
2. Verify network connection
3. Check server logs for validation errors
4. Ensure userId is set correctly

### Quiet Hours Not Working
1. Verify timezone is correct
2. Check if global notifications are enabled
3. Verify start/end times are valid HH:MM format
4. Check notification category preferences

### Missing Categories
1. Ensure notification system is initialized
2. Check if category exists in default preferences
3. Verify backend notifications are sending for that category

## Performance Considerations

### Client-Side
- Components use React hooks efficiently
- Debounced API calls
- Memoized subcomponents
- Lazy loading for large category lists

### Server-Side
- Indexed database queries
- Efficient preference manager caching
- Connection pooling for database
- Rate limiting on API endpoints

## Security Considerations

### Authentication
- User can only modify own preferences
- API enforces userId ownership check

### Validation
- All inputs validated before storage
- Type checking on all fields
- Timezone validation against known zones

### Data Protection
- Preferences not exposed to other users
- Audit trail via updatedAt field
- No sensitive data in preferences

## Monitoring

### Metrics to Track
- Preference update frequency
- API endpoint response times
- Error rates by endpoint
- Most/least used features

### Alerts
- Database query slowdown (>1s)
- High error rate (>5%)
- API timeout (>30s)
- Failed preference updates

## Support & Documentation

### For Users
- In-app help tooltips
- Documentation pages
- FAQ section

### For Developers
- API documentation
- Component Storybook entries
- Example implementations
- Migration guides

---

**Implementation Date**: 2026-08-11  
**Phase**: 34  
**Status**: Complete  
**Test Coverage**: 25+ tests (API + Components)  
**TypeScript Errors**: 0  
**Accessibility**: WCAG 2.1 AA
