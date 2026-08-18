# FleetPro Push Notifications Setup Guide

## Overview

FleetPro uses the **Web Push API** with VAPID (Voluntary Application Server Identification) for sending secure push notifications to installed PWA apps. This guide walks you through the complete setup process.

## Architecture

```
User's Device (Browser/PWA)
    ↓
Service Worker (registration)
    ↓
Push Subscription (endpoint + keys)
    ↓
Server (VAPID-signed delivery)
    ↓
Browser Push Service (Google/Mozilla)
    ↓
Device Notification
```

## Step 1: Generate VAPID Keys

VAPID keys are asymmetric encryption keys that identify your application server.

### Option A: Using npm (Recommended)

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Output:
```
Public Key: BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Option B: Using Node.js Script

```bash
cat > generate-vapid.js << 'EOF'
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
EOF

node generate-vapid.js
rm generate-vapid.js
```

## Step 2: Configure Environment Variables

Update your `.env` file with the generated keys:

```env
# VAPID Keys for Push Notifications
VITE_VAPID_PUBLIC_KEY=<your-public-key>
SERVER_VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:support@fleetpro.local

# Enable notifications
NOTIFICATION_ENABLED=true
BACKGROUND_SYNC_ENABLED=true
```

### Key Details

- **VITE_VAPID_PUBLIC_KEY**: Shared with browser, used by client to subscribe
  - Prefix: `VITE_` makes it available in browser
  - Safe to commit (public)
  
- **SERVER_VAPID_PRIVATE_KEY**: NEVER share, only on server
  - Keep this SECRET
  - Never commit to version control
  - Use strong random key (65+ characters)
  
- **VAPID_SUBJECT**: Contact email for push service
  - Used if anything goes wrong with your notifications
  - Format: `mailto:your-email@example.com`

## Step 3: Verify Server Configuration

The server automatically initializes VAPID on startup:

```bash
npm run dev
```

Check logs for:
```
[VAPIDConfig] VAPID keys configured successfully
```

If VAPID keys are missing:
```
[VAPIDConfig] VAPID keys not configured. Push notifications will be disabled.
```

## Step 4: Client-Side Subscription

Users see a notification permission prompt when they install the app.

### Automatic Flow (PWAStatus Component)

1. User installs app
2. PWA Status banner appears: "Enable notifications"
3. User clicks "Enable"
4. Browser requests permission
5. User grants permission
6. Client automatically subscribes
7. Subscription sent to server: `POST /api/notifications/subscribe`

### Manual Subscription

```typescript
import { pushNotificationManager } from '@/utils/pushNotifications';

// Request permission
const granted = await pushNotificationManager.requestPermission();

// Subscribe
const subscription = await pushNotificationManager.subscribeToNotifications();

// Send to server
fetch('/api/notifications/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(subscription),
});
```

## Step 5: Send Notifications

### From the Server (TypeScript)

```typescript
import { vapidManager } from './utils/vapidConfig';
import { db } from './connectDB';

// Get user's subscription
const user = await db.collection('users').findOne({ _id });
const subscription = user.pushSubscription;

// Send notification
await vapidManager.sendPushNotification(subscription, {
  title: 'Booking Confirmed',
  body: 'Your booking is ready',
  icon: '/icons/icon-192x192.png',
  data: { bookingId: '123' },
});
```

### API Endpoints

#### Subscribe to Notifications

```
POST /api/notifications/subscribe
Content-Type: application/json
Authorization: Bearer <token>

{
  "endpoint": "https://...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

#### Unsubscribe

```
POST /api/notifications/unsubscribe
Authorization: Bearer <token>
```

#### Send to Specific Users (Admin)

```
POST /api/notifications/send
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "userIds": ["user1", "user2"],
  "title": "Important Update",
  "body": "New feature available",
  "data": {
    "action": "open-bookings"
  }
}
```

#### Broadcast to All (Admin)

```
POST /api/notifications/broadcast
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "title": "Maintenance Window",
  "body": "System will be down for 1 hour",
  "targetRole": "admin"  // Optional: admin, driver, customer
}
```

#### Get Notification Status

```
GET /api/notifications/status
Authorization: Bearer <token>
```

Response:
```json
{
  "notificationsEnabled": true,
  "subscribed": true,
  "subscribedAt": "2026-08-11T10:30:00Z",
  "vpaidConfigured": true
}
```

#### Get VAPID Config

```
GET /api/notifications/config
```

Response:
```json
{
  "publicKey": "BCxxxxxxx..."
}
```

## Step 6: Test Push Notifications

### Manual Test

```bash
# Get VAPID public key
curl http://localhost:5050/api/notifications/config

# Send test notification to user
curl -X POST http://localhost:5050/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "userIds": ["<user-id>"],
    "title": "Test Notification",
    "body": "This is a test",
    "data": {"test": true}
  }'
```

### Test Checklist

- [ ] Install app on mobile device
- [ ] Click "Enable notifications" when prompted
- [ ] Close app
- [ ] Send notification via API
- [ ] Notification appears on lock screen
- [ ] Tap notification to open app
- [ ] App navigates to correct page (if data includes routing)
- [ ] Unsubscribe from notifications
- [ ] Verify "Enable notifications" prompt reappears

## Step 7: Database Schema (Optional Update)

Add these fields to user documents for better notification tracking:

```javascript
db.users.updateMany(
  {},
  {
    $set: {
      notificationsEnabled: false,
      pushSubscription: null,
    }
  }
)
```

Fields automatically updated by server:
- `pushSubscription`: PushSubscription object with endpoint + keys
- `notificationsEnabled`: Boolean flag
- `pushSubscription.subscribedAt`: Timestamp of subscription

## Troubleshooting

### "VAPID keys not configured"

**Problem**: Push notifications disabled on server

**Solution**:
1. Generate VAPID keys: `web-push generate-vapid-keys`
2. Add to `.env`:
   ```
   VITE_VAPID_PUBLIC_KEY=...
   SERVER_VAPID_PRIVATE_KEY=...
   ```
3. Restart server

### "Service Worker not ready"

**Problem**: Client can't subscribe because SW isn't active

**Solution**:
1. Verify service-worker.js is at `/public/service-worker.js`
2. Check browser console for SW registration errors
3. Clear cache: DevTools → Application → Clear storage
4. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### "Subscription expired (410)"

**Problem**: Stored subscription is invalid

**Solution**:
1. Server automatically removes invalid subscriptions
2. User sees "Enable notifications" prompt again
3. User re-subscribes with new subscription

### "Permission denied"

**Problem**: User blocked notifications

**Solution**:
1. Restore permission in browser settings
2. Close and reopen app
3. Click "Enable notifications" again

### Notifications not showing

**Problem**: Push sent but no notification appears

**Debug**:
1. Check browser console for SW errors
2. Verify app has `push` event handler in service-worker.js
3. Check notification permission: DevTools → Application → Manifest
4. Ensure HTTPS in production (required by spec)

## Production Checklist

- [ ] VAPID keys generated and stored securely
- [ ] Private key NEVER committed to version control
- [ ] VAPID_SUBJECT email is valid
- [ ] Service Worker deployed to production
- [ ] HTTPS enabled (required for push)
- [ ] API endpoints tested for security
- [ ] Admin-only send endpoints protected
- [ ] Invalid subscriptions cleaned up (410 handling)
- [ ] Push logs monitored
- [ ] User opt-out respected

## Security Best Practices

### Public Key Safety

✅ Safe to share:
- Include in manifest
- Distribute to clients
- Store in version control
- Use in frontend code

### Private Key Safety

🔒 Keep SECRET:
- Store only on server
- Use environment variables
- NEVER commit to git
- Rotate periodically
- Use separate key per environment (dev/staging/prod)

### Subscription Data

✅ Store safely:
- Endpoint is unique per browser
- Keys are encrypted in transit
- Subscriptions expire naturally
- Server cleans up invalid ones

🚫 Never:
- Use subscription as auth token
- Share private key in subscription
- Log full endpoint in plain text

## Performance Considerations

### Batch Notifications

For large audiences, use broadcast:
```
POST /api/notifications/broadcast
```

Instead of calling send multiple times.

### Retry Logic

- Server retries failed subscriptions automatically
- Invalid subscriptions (410) removed immediately
- Network errors logged for monitoring

### Rate Limiting

Consider implementing:
- Max notifications per user per day
- Notification queue with batching
- Priority levels (urgent vs normal)
- Time windows (don't send at night)

## Integration Examples

### Booking Confirmation

```typescript
// When booking confirmed
const user = await db.collection('users').findOne({ _id: userId });
if (user.pushSubscription) {
  await vapidManager.sendPushNotification(user.pushSubscription, {
    title: 'Booking Confirmed',
    body: `Pickup at ${booking.pickupLocation} at ${booking.pickupTime}`,
    data: { bookingId: booking._id },
  });
}
```

### Payment Received

```typescript
// When payment processed
const users = await db.collection('users')
  .find({ 'pushSubscription': { $exists: true } })
  .toArray();

await vapidManager.sendBulkPushNotifications(users.map(u => u.pushSubscription), {
  title: 'Payment Received',
  body: `₹${amount} received for booking`,
  data: { transactionId: txnId },
});
```

### Admin Broadcast

```typescript
// System maintenance notice
await vapidManager.sendBulkPushNotifications(
  adminSubscriptions,
  {
    title: 'Maintenance Scheduled',
    body: 'System will be down 10 PM - 11 PM IST',
    requireInteraction: true,
  }
);
```

## References

- [Web Push Protocol](https://tools.ietf.org/html/draft-thomson-webpush-protocol)
- [VAPID Specification](https://tools.ietf.org/html/draft-thomson-webpush-vapid)
- [Push API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web-push npm](https://www.npmjs.com/package/web-push)

## Support

For issues with push notifications:
1. Check logs: `npm run dev 2>&1 | grep -i "push\|notification"`
2. Enable debug logging: `LOG_LEVEL=DEBUG npm run dev`
3. Test with curl: See "Test Push Notifications" section above
4. Review browser DevTools → Application → Service Workers

---

**Last Updated**: 2026-08-11  
**Phase**: 14  
**Status**: Production-Ready
