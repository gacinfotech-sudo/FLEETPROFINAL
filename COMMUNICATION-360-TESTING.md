# Booking 360 Communication & WhatsApp Testing Guide

## New Endpoints

### 1. Get Communications (Messages + Reminders)

**Endpoint:** `GET /api/bookings/:id/360/communications`

**Response:**
```json
{
  "communications": {
    "messages": [
      {
        "id": "64abc123...",
        "type": "update_driver_change",
        "to": "9876543210",
        "recipientType": "customer",
        "status": "sent",
        "content": "✅ *ड्राइवर में परिवर्तन*...",
        "sentAt": "2026-08-21T02:50:00.000Z",
        "createdAt": "2026-08-21T02:49:00.000Z"
      }
    ],
    "stats": {
      "total": 5,
      "sent": 4,
      "failed": 1
    }
  },
  "reminders": {
    "scheduled": [
      {
        "id": "64xyz789...",
        "type": "customer",
        "to": "9876543210",
        "status": "pending",
        "scheduledFor": "2026-08-21T10:00:00.000Z",
        "intervalBefore": 5,
        "sentAt": null
      }
    ],
    "stats": {
      "total": 7,
      "pending": 3,
      "sent": 4,
      "failed": 0
    }
  }
}
```

### 2. Verify System (Check if everything working)

**Endpoint:** `GET /api/bookings/:id/360/verify`

**Response:**
```json
{
  "booking": {
    "id": "BK1234567890",
    "customer": "राज कुमार",
    "phone": "9876543210",
    "pickup": "2026-08-21T10:00:00.000Z",
    "status": "confirmed"
  },
  "communications": {
    "messages": {
      "total": 5,
      "sent": 4,
      "pending": 1,
      "ok": "✅"
    },
    "reminders": {
      "total": 7,
      "sent": 2,
      "pending": 5,
      "ok": "✅"
    }
  },
  "systemHealth": {
    "whatsappConnected": "✅",
    "remindersRunning": "✅",
    "databaseOK": "✅"
  },
  "nextActions": {
    "sendDriverNotification": "/api/bookings/BK1234567890/notify/driver-change",
    "sendVehicleNotification": "/api/bookings/BK1234567890/notify/vehicle-change",
    "sendCustomMessage": "/api/bookings/BK1234567890/notify/custom",
    "sendBookingUpdate": "/api/bookings/BK1234567890/notify/update"
  }
}
```

---

## Testing Steps

### Step 1: Get Booking ID
```bash
# Get a booking
curl http://localhost:5050/api/bookings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Copy a booking's MongoDB ID (e.g., 64abc123def456ghi789jkl)
BOOKING_ID="64abc123def456ghi789jkl"
```

### Step 2: Check Communications
```bash
curl http://localhost:5050/api/bookings/$BOOKING_ID/360/communications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected: Lists all messages & reminders for this booking

### Step 3: Verify System Health
```bash
curl http://localhost:5050/api/bookings/$BOOKING_ID/360/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected: Shows ✅ for working systems

### Step 4: Send Driver Change Notification
```bash
curl -X POST http://localhost:5050/api/bookings/$BOOKING_ID/notify/driver-change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "driverName": "नया ड्राइवर",
    "driverPhone": "9876543210"
  }'
```

Expected:
```json
{
  "success": true,
  "messageId": "wamsg-12345",
  "message": "driver_change notification sent to 9876543210"
}
```

### Step 5: Check Communications Again
```bash
curl http://localhost:5050/api/bookings/$BOOKING_ID/360/communications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected: New message appears in list with status "sent" or "queued"

---

## UI Integration Points

### In Booking 360 View

Add Communication Tab with:

```
📞 COMMUNICATIONS
├─ Recent Messages
│  ├─ Driver Change (✅ Sent)
│  ├─ Vehicle Change (⏳ Queued)
│  └─ Custom Message (❌ Failed)
│
├─ Quick Actions
│  ├─ [Send Driver Change] → Opens dialog
│  ├─ [Send Vehicle Change] → Opens dialog
│  ├─ [Send Custom Message] → Opens dialog
│  └─ [Send Booking Update] → Sends immediately
│
└─ Reminders Status
   ├─ Pending: 5
   ├─ Sent: 2
   └─ Failed: 0
```

### Dialog for Driver Change

```
┌─────────────────────────────────────┐
│ Send Driver Change Notification      │
├─────────────────────────────────────┤
│ Driver Name: [________]              │
│ Driver Phone: [________]             │
│                                      │
│ [Cancel] [Send]                      │
└─────────────────────────────────────┘
```

---

## What Gets Tested

✅ **Messages are created in database**
✅ **Reminders are scheduled**
✅ **WhatsApp provider is connected**
✅ **Customer notification is sent**
✅ **Messages are logged**
✅ **Status is tracked**

---

## Troubleshooting

### If Communications endpoint shows 0 messages:
1. Check if booking exists: `GET /api/bookings/:id/360`
2. Check if reminders were scheduled: Look at server logs for `[REMINDER]`
3. Check database: `mongosh` → `db.whatsappmessages.count()`

### If Reminders show "pending":
1. Reminders are scheduled but not yet due (waiting for time)
2. Processor runs every 60 seconds
3. Check logs: `tail -f /tmp/server.log | grep "\[REMINDER\]"`

### If Notifications show "failed":
1. Check WhatsApp connection: `GET /api/whatsapp/session/status`
2. Check error message in communications response
3. Check server logs for `[UPDATE]` prefix

---

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/bookings/:id/360/communications` | See all messages & reminders |
| GET | `/api/bookings/:id/360/verify` | Verify system health |
| POST | `/api/bookings/:id/notify/driver-change` | Send driver change |
| POST | `/api/bookings/:id/notify/vehicle-change` | Send vehicle change |
| POST | `/api/bookings/:id/notify/update` | Send booking update |
| POST | `/api/bookings/:id/notify/custom` | Send custom message |

---

## Server Logs Format

```
[UPDATE] Sending driver_change notification for booking BK123
[UPDATE] Message built (456 chars)
[UPDATE] Sending to 9876543210...
[UPDATE] ✅ Sent successfully - Message ID: wamsg-123abc

[REMINDER] Scheduling reminders for booking BK123
[REMINDER] Scheduling customer reminders to 9876543210
[REMINDER] Processing 5 due WhatsApp reminders...
✅ Reminder sent: customer → 9876543210
```

---

**Status:** ✅ Ready for testing
**Last Updated:** 2026-08-21
