# Push Notifications - Quick Setup Guide

## 5-Minute Setup

### Step 1: Generate VAPID Keys (One-time)

```bash
npx web-push generate-vapid-keys
```

This outputs:
```
Public Key: BJ...
Private Key: ...
```

### Step 2: Update Environment Variables

Edit `.env`:
```env
# Add these lines
VITE_VAPID_PUBLIC_KEY=<your-public-key>
SERVER_VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:support@fleetpro.local
```

### Step 3: Register Service Worker

Add to `client/src/App.tsx` or main entry point:

```typescript
useEffect(() => {
  // Register service worker for push notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    }).then(registration => {
      console.log('Service Worker registered:', registration);
    }).catch(error => {
      console.error('Service Worker registration failed:', error);
    });
  }
}, []);
```

### Step 4: Add Permission Prompt

Add to your app's main layout or onboarding:

```typescript
import NotificationPermissionPrompt from './components/notifications/NotificationPermissionPrompt';

export default function App() {
  return (
    <div>
      <NotificationPermissionPrompt 
        onGranted={() => console.log('Notifications enabled')}
      />
      {/* Rest of app */}
    </div>
  );
}
```

### Step 5: Add Notification Bell

Add to header or navigation:

```typescript
import NotificationBell from './components/notifications/NotificationBell';

export default function Header() {
  return (
    <header>
      <NotificationBell 
        onOpenNotificationCenter={() => {
          // Open notification center modal
        }}
      />
    </header>
  );
}
```

### Step 6: Add Settings Page

Add to user settings:

```typescript
import PushNotificationSettings from './components/notifications/PushNotificationSettings';

export default function SettingsPage() {
  return (
    <div>
      <h2>Notifications</h2>
      <PushNotificationSettings />
    </div>
  );
}
```

### Step 7: Send Test Notification

Use the API:

```bash
curl -X POST http://localhost:5050/api/push-notifications/send \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["<userId>"],
    "title": "Hello!",
    "body": "This is a test notification"
  }'
```

---

## Usage Examples

### Send Notification to Single User

```typescript
import { pushNotificationService } from '../utils/pushNotificationService';

const result = await pushNotificationService.sendToUser(
  userId,
  {
    title: 'Booking Confirmed',
    body: 'Your booking #123 has been confirmed',
    icon: '/icons/booking.png',
    tag: 'booking-notification',
    data: {
      bookingId: '123',
      type: 'booking',
    },
  }
);

console.log(`Sent to ${result.sent} devices`);
```

### Send to Multiple Users

```typescript
const userIds = ['user1', 'user2', 'user3'];

const result = await pushNotificationService.sendToUsers(
  userIds,
  {
    title: 'System Maintenance',
    body: 'We will perform maintenance at 2:00 AM',
  }
);

console.log(`Sent: ${result.sent}, Failed: ${result.failed}`);
```

### Send to User Segment

```typescript
const result = await pushNotificationService.sendToSegment(
  {
    title: 'Driver Bonus',
    body: 'You earned a $5 bonus!',
  },
  {
    role: 'driver',
    tags: ['active'],
  }
);
```

### Broadcast to All Users

```typescript
const result = await pushNotificationService.sendBroadcast(
  {
    title: 'Important Update',
    body: 'Please update the app for new features',
  },
  {
    targetRole: 'driver', // Optional: send only to drivers
  }
);
```

### Send with Action Buttons

```typescript
const result = await pushNotificationService.sendToUser(
  userId,
  {
    title: 'Accept Booking?',
    body: 'New booking available: Airport run',
    actions: [
      { action: 'approve', title: 'Accept' },
      { action: 'reject', title: 'Decline' },
    ],
  }
);
```

---

## API Reference

### GET /api/push-notifications/config

Get VAPID public key for client.

**Response:**
```json
{ "publicKey": "BJ..." }
```

### POST /api/push-notifications/subscribe

Register push subscription.

**Request:**
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  },
  "expirationTime": null,
  "deviceInfo": {
    "type": "web",
    "browser": "Chrome",
    "platform": "Windows"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription registered successfully",
  "subscription": { ... }
}
```

### DELETE /api/push-notifications/unsubscribe

Remove push subscription.

**Request:**
```json
{ "endpoint": "https://fcm.googleapis.com/..." }
```

**Response:**
```json
{
  "success": true,
  "message": "Unsubscribed successfully"
}
```

### GET /api/push-notifications/subscriptions

List user's registered devices.

**Response:**
```json
{
  "success": true,
  "subscriptions": [
    {
      "id": "123",
      "deviceType": "web",
      "deviceName": "Chrome on Windows",
      "browser": "Chrome",
      "platform": "Windows",
      "createdAt": "2026-08-11T10:00:00Z",
      "lastUsedAt": "2026-08-11T15:00:00Z",
      "isActive": true
    }
  ]
}
```

### POST /api/push-notifications/send (Admin)

Send targeted notification.

**Request:**
```json
{
  "userIds": ["user1", "user2"],
  "title": "Notification Title",
  "body": "Notification body text",
  "icon": "/icons/icon.png",
  "badge": "/icons/badge.png",
  "tag": "notification-tag",
  "data": { "customField": "value" },
  "actions": [
    { "action": "view", "title": "View" },
    { "action": "dismiss", "title": "Dismiss" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notifications sent",
  "notificationId": "notif-1234567890-abc",
  "results": {
    "sent": 2,
    "failed": 0
  }
}
```

### POST /api/push-notifications/broadcast (Admin)

Send broadcast notification.

**Request:**
```json
{
  "title": "Broadcast Title",
  "body": "Broadcast message",
  "targetRole": "driver"
}
```

### POST /api/push-notifications/response

Record notification interaction.

**Request:**
```json
{
  "notificationId": "notif-123",
  "action": "approve",
  "respondedAt": "2026-08-11T15:30:00Z"
}
```

### GET /api/push-notifications/unread-count

Get unread notification count.

**Response:**
```json
{ "count": 5 }
```

### GET /api/push-notifications/stats (Admin)

Get subscription statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSubscriptions": 1250,
    "activeSubscriptions": 1200,
    "inactiveSubscriptions": 50,
    "byDeviceType": {
      "web": 800,
      "mobile": 350,
      "tablet": 50
    },
    "byBrowser": {
      "Chrome": 600,
      "Safari": 350,
      "Firefox": 250
    }
  }
}
```

---

## Troubleshooting

### "Push notifications not configured"

**Solution:** Verify VAPID keys in `.env`
```bash
echo $VAPID_PRIVATE_KEY
# Should output your private key
```

If empty, add keys to `.env` and restart server.

### "Service Worker not registered"

**Check in browser console:**
```javascript
navigator.serviceWorker.getRegistrations()
```

If empty, verify:
1. `/service-worker.js` exists in public folder
2. Browser DevTools > Application > Service Workers shows registration
3. No CORS or permission errors in console

### "No notifications received"

**Debug checklist:**
1. ✅ User has granted permission (DevTools > Application > Manifest)
2. ✅ Subscription is active (mongosh: `db.push_subscriptions.findOne()`)
3. ✅ VAPID keys are valid
4. ✅ No errors in server logs
5. ✅ Network tab shows push delivery (might not show in dev tools)

### "Subscription expired"

**Solution:** Auto-handled by cleanup
- System automatically removes invalid subscriptions
- User is re-prompted for permission
- Run manual cleanup: `POST /api/push-notifications/cleanup`

---

## Testing

### Manual Testing

1. Open app in browser
2. Grant notification permission
3. Open DevTools > Application > Service Workers
4. Verify service worker is active
5. Click "Make Offline" to test offline queueing
6. Send test notification via API or admin panel
7. Verify notification appears

### E2E Testing

```bash
# Run test suite
npm run test server/tests/pushNotificationService.test.ts
npm run test server/tests/pushSubscriptionManager.test.ts

# Test specific scenario
npm run test -- --grep "Send to multiple users"
```

### Load Testing

```bash
# Send 1000 notifications
for i in {1..1000}; do
  curl -X POST http://localhost:5050/api/push-notifications/send \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d "{\"userIds\": [\"<userId>\"], \"title\": \"Test $i\", \"body\": \"Message $i\"}"
done
```

---

## Performance Tips

1. **Batch Large Sends**
   ```typescript
   // Good: Send to 50 at a time
   await pushNotificationService.sendToUsers(userIds, payload, {
     batchSize: 50
   });
   ```

2. **Use Segments**
   ```typescript
   // Better than fetching all users
   await pushNotificationService.sendToSegment(payload, {
     role: 'driver',
     status: 'active'
   });
   ```

3. **Cache Subscriptions**
   - Don't fetch subscriptions on every request
   - Pre-warm cache at app startup

4. **Cleanup Regularly**
   ```bash
   # Run weekly cleanup
   curl -X POST http://localhost:5050/api/push-notifications/cleanup \
     -H "Authorization: Bearer <admin-token>"
   ```

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Push Notifications | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Action Buttons | ✅ | ✅ | ⚠️ | ✅ |
| Vibration | ✅ | ✅ | ⚠️ | ✅ |
| Background Sync | ✅ | ⚠️ | ⚠️ | ✅ |

---

## Security Notes

- Public VAPID key is exposed (intended for client subscription)
- Private VAPID key MUST be kept secret
- Never commit private keys to git
- Use environment variables for all secrets
- Validate user input on API endpoints
- Admin endpoints require authentication

---

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs: `npm run dev 2>&1 | grep NOTIF`
3. Verify VAPID configuration
4. Review test files for examples
5. Check browser compatibility

---

*Push Notifications are now ready to use!*
