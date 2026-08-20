# Customer Update Notifications API

**Pure Add-On Service** - No modifications to existing code

## Overview

Send WhatsApp notifications to customers when booking details change:
- Driver change
- Vehicle change
- Booking updates
- Custom messages

## API Endpoints

All endpoints require authentication (`authenticateUser, requireTenant`)

### 1. Driver Change Notification

**Endpoint:** `POST /api/bookings/:id/notify/driver-change`

**Request Body:**
```json
{
  "driverName": "राज कुमार",
  "driverPhone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "message-id-123",
  "message": "driver_change notification sent to 9876543210"
}
```

### 2. Vehicle Change Notification

**Endpoint:** `POST /api/bookings/:id/notify/vehicle-change`

**Request Body:**
```json
{
  "vehicleName": "Innova Crysta | MP09AB6578",
  "vehicleNumber": "MP09AB6578"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "message-id-124",
  "message": "vehicle_change notification sent to 9876543211"
}
```

### 3. Booking Update Notification

**Endpoint:** `POST /api/bookings/:id/notify/update`

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "messageId": "message-id-125",
  "message": "booking_update notification sent to 9876543212"
}
```

Sends a generic booking details update message to customer.

### 4. Custom Message

**Endpoint:** `POST /api/bookings/:id/notify/custom`

**Request Body:**
```json
{
  "customMessage": "आपकी यात्रा में कोई समस्या आ रही है? कृपया हमसे संपर्क करें।"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "message-id-126",
  "message": "custom notification sent to 9876543213"
}
```

## Message Templates

### Driver Change
```
✅ *ड्राइवर में परिवर्तन*

नमस्कार <CustomerName>,

आपकी बुकिंग <BookingID> के लिए ड्राइवर में परिवर्तन हुआ है।

👨‍✈️ *नया ड्राइवर*
नाम: <DriverName>
📱 मोबाइल: <DriverPhone>

📍 पिकअप: <PickupLocation>
🏁 ड्रॉप: <DropLocation>
📅 तारीख: <Date>

धन्यवाद!
```

### Vehicle Change
```
🚗 *गाड़ी में परिवर्तन*

नमस्कार <CustomerName>,

आपकी बुकिंग <BookingID> के लिए गाड़ी में परिवर्तन हुआ है।

🚘 *नई गाड़ी*
नाम: <VehicleName>
नंबर प्लेट: <VehicleNumber>

📍 पिकअप: <PickupLocation>
🏁 ड्रॉप: <DropLocation>
📅 तारीख: <Date>

धन्यवाद!
```

### Booking Update
```
📝 *बुकिंग में अपडेट*

नमस्कार <CustomerName>,

आपकी बुकिंग <BookingID> में कुछ विवरण अपडेट किए गए हैं।

📋 *बुकिंग विवरण*
🔖 बुकिंग आईडी: <BookingID>
📍 पिकअप: <PickupLocation>
🏁 ड्रॉप: <DropLocation>
📅 तारीख: <Date>
💰 कुल किराया: ₹<Amount>

धन्यवाद!
```

## Service Functions

**File:** `server/services/customer-update-notifications.ts`

### Main Function
```typescript
async function sendCustomerUpdateNotification(
  params: UpdateNotificationParams
): Promise<SendUpdateResult>
```

### Batch Function
```typescript
async function sendBatchUpdateNotifications(
  tenantId: string,
  bookingIds: string[],
  updateType: 'driver_change' | 'vehicle_change' | 'booking_update',
  newDetails?: any
): Promise<{ sent: number; failed: number; errors: string[] }>
```

## Logging

All operations log with `[UPDATE]` prefix:

```
[UPDATE] Sending driver_change notification for booking BK123456
[UPDATE] Message built (456 chars)
[UPDATE] Sending to 9876543210...
[UPDATE] ✅ Sent successfully - Message ID: wamsg-123abc
```

## Error Handling

All endpoints return:

**Success:**
```json
{
  "success": true,
  "messageId": "wamsg-xxx",
  "message": "Notification sent"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Integration Points

### Step 1: Update booking details
```typescript
// Your code updates the driver/vehicle
await Booking.updateOne(
  { _id: bookingId },
  { driverId: newDriver._id }
);
```

### Step 2: Send notification
```typescript
const response = await fetch(
  `/api/bookings/${bookingId}/notify/driver-change`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      driverName: newDriver.name,
      driverPhone: newDriver.phone
    })
  }
);
```

## Database Logging

All messages are stored in `whatsapp_messages` collection:

```json
{
  "_id": "ObjectId",
  "bookingId": "ObjectId",
  "recipientPhone": "9876543210",
  "messageType": "update_driver_change",
  "content": "...",
  "status": "sent",
  "sentAt": "2026-08-21T...",
  "providerMessageId": "wamsg-123"
}
```

## Future Enhancements

- Batch update notifications
- Scheduled update notifications
- Update confirmation callbacks
- Analytics dashboard for updates
- Template customization per tenant
