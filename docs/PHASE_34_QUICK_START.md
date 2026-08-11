# Phase 34: Quick Start Guide

## Quick Integration

### Use the Main Component
```tsx
import { NotificationPreferencesPanel } from '@/components/notifications';

export function SettingsPage() {
  return <NotificationPreferencesPanel userId={currentUserId} />;
}
```

### Use Individual Components
```tsx
import {
  ChannelToggle,
  QuietHours,
  CategorySubscriptions,
  FrequencyCaps
} from '@/components/notifications';
```

## API Quick Reference

### Fetch Preferences
```typescript
const response = await fetch(`/api/notification-preferences/${userId}`);
const { preferences } = await response.json();
```

### Update All Preferences
```typescript
await fetch(`/api/notification-preferences/${userId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    globalEnabled: true,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  })
});
```

### Toggle Quiet Hours
```typescript
await fetch(`/api/notification-preferences/${userId}/quiet-hours`, {
  method: 'PUT',
  body: JSON.stringify({
    enabled: true,
    start: '22:00',
    end: '08:00',
    timezone: 'IST'
  })
});
```

### Update Category
```typescript
await fetch(`/api/notification-preferences/${userId}/category/booking`, {
  method: 'PUT',
  body: JSON.stringify({
    enabled: true,
    channels: ['push', 'email']
  })
});
```

### Set Frequency Caps
```typescript
await fetch(`/api/notification-preferences/${userId}/frequency-caps`, {
  method: 'PUT',
  body: JSON.stringify({
    dailyCap: 50,
    hourlyCap: 10
  })
});
```

### Unsubscribe from Category
```typescript
await fetch(`/api/notification-preferences/${userId}/unsubscribe/promo`, {
  method: 'POST'
});
```

### Reset to Defaults
```typescript
await fetch(`/api/notification-preferences/${userId}/reset-defaults`, {
  method: 'POST'
});
```

## Key Features

### Notification Categories (9 types)
- `booking` - Booking Updates
- `payment` - Payment Reminders
- `driver` - Driver Assignments
- `vehicle` - Vehicle Updates
- `customer` - Customer Messages
- `alert` - Critical Alerts
- `reminder` - Reminders
- `promo` - Promotions
- `system` - System Updates

### Notification Channels (4 types)
- `push` - Browser/Mobile Push
- `email` - Email
- `sms` - SMS/Text
- `in_app` - In-App Notifications

### Timezones Supported (10)
- IST (India Standard Time)
- UTC (Coordinated Universal Time)
- EST (Eastern Standard Time)
- CST (Central Standard Time)
- MST (Mountain Standard Time)
- PST (Pacific Standard Time)
- GMT (Greenwich Mean Time)
- CET (Central European Time)
- JST (Japan Standard Time)
- AEST (Australian Eastern Time)

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

## UI Components

### NotificationPreferencesPanel
- Full settings interface
- All features in one component
- Real-time sync with backend
- Dark mode support
- Responsive design

### ChannelToggle
- Checkbox grid for channels
- Configurable columns
- Icon + description
- Disabled state

### QuietHours
- Time inputs (HH:MM)
- Timezone dropdown
- Toggle enable/disable
- Info messages

### CategorySubscriptions
- Expandable cards
- Per-category settings
- Unsubscribe buttons
- Status badges

### FrequencyCaps
- Daily/hourly limits
- Quick presets
- Input validation
- Info tips

## Common Patterns

### Check if Notification Should Be Sent
```typescript
import { notificationPreferenceManager } from '@/server/utils/notificationPreferences';

const canSend = await notificationPreferenceManager.canSendNotification(
  userId,
  'booking',
  'email'
);

if (canSend) {
  // Send notification
}
```

### Get User Preferences
```typescript
const prefs = await notificationPreferenceManager.getPreferences(userId);
console.log('Quiet hours enabled:', prefs.quietHoursEnabled);
```

### Update Multiple Settings
```typescript
await notificationPreferenceManager.setPreferences(userId, {
  dailyFrequencyCap: 50,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00'
});
```

## Styling

### Dark Mode
Automatically handled by Tailwind CSS classes:
- `dark:bg-blue-950`
- `dark:text-blue-300`
- `dark:border-blue-800`

### Responsive Breakpoints
- Mobile: 1 column
- Tablet (md): 2 columns
- Desktop (lg): 2-4 columns

### Colors
- Primary: Brand color
- Muted: Gray
- Destructive: Red (when appropriate)
- Success: Green

## Performance Tips

1. **Debounce API calls**: NotificationPreferencesPanel debounces changes by 2000ms
2. **Lazy load components**: Use React.lazy for large lists
3. **Memoize callbacks**: Use useCallback for handlers
4. **Cache preferences**: Store in localStorage for faster reload
5. **Batch updates**: Update multiple settings at once

## Error Handling

### Common Errors

```typescript
// 400 Bad Request - Invalid input
{
  "error": "Invalid input",
  "message": "quietHoursStart must be in HH:MM format"
}

// 403 Forbidden - Not authorized
{
  "error": "Forbidden",
  "message": "You can only access your own notification preferences"
}

// 500 Server Error - Database issue
{
  "error": "Failed to update preferences",
  "message": "Database connection error"
}
```

### Retry Logic
```typescript
async function saveWithRetry(userId, prefs, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`/api/notification-preferences/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(prefs)
      });
      if (response.ok) return response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

## Testing

### Test Component
```tsx
import { render, screen } from '@testing-library/react';
import { NotificationPreferencesPanel } from '@/components/notifications';

test('renders preferences panel', () => {
  render(<NotificationPreferencesPanel userId="test-user" />);
  expect(screen.getByText(/Notification Settings/i)).toBeInTheDocument();
});
```

### Test API
```typescript
import { notificationPreferenceManager } from '@/server/utils/notificationPreferences';

test('saves preferences', async () => {
  const prefs = await notificationPreferenceManager.getPreferences('user-123');
  expect(prefs.globalEnabled).toBe(true);
});
```

## Next Steps

1. Add NotificationPreferencesPanel to settings page
2. Update user profile to include preferences link
3. Integrate with notification sending logic
4. Monitor preference patterns
5. Add analytics tracking

## Documentation

- **Full Guide**: See `NOTIFICATION_PREFERENCES_GUIDE.md`
- **Implementation**: See `PHASE_34_SUMMARY.md`
- **Components**: Check `client/src/components/notifications/`
- **API**: See `server/routes/notification-preferences.ts`

## Support

For issues or questions:
1. Check the full guide
2. Review test examples
3. Check server logs
4. Verify database indexes

---

**Last Updated**: 2026-08-11  
**Phase**: 34  
**Status**: Production Ready ✅
