// Generates WhatsApp message text from actual booking/tenant data. No
// customer, driver, vehicle, price or route detail is ever hard-coded —
// every value comes from the booking document passed in.

export type MessageType = 'booking_confirmation' | 'driver_duty';

function formatDate(d: any): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function remainingBalance(booking: any): number {
  return Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0));
}

function amountDueAtTripStart(booking: any): number {
  const fiftyPercent = Math.ceil((booking.totalAmount || 0) * 0.5);
  const alreadyPaid = booking.advanceReceived || 0;
  return Math.max(0, fiftyPercent - alreadyPaid);
}

// CUSTOMER MESSAGE - PROFESSIONAL FORMAT
export function buildBookingConfirmationMessage(booking: any, tenant: any): string {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const driver = booking.driverId && typeof booking.driverId === 'object' ? booking.driverId : null;
  const remaining = remainingBalance(booking);
  const driverPhone = driver?.phone || 'N/A';
  const driverName = driver?.name || 'Assigned Driver';
  const vehicleModel = vehicle ? `${vehicle.make || ''} ${vehicle.vehicleModel || ''}`.trim() : 'TBD';
  const vehicleNumber = vehicle?.licensePlate || 'TBD';
  const dueAtStart = amountDueAtTripStart(booking);

  // Check if payment collection is disabled
  const collectPayment = booking.collectPayment !== false;

  const lines: string[] = [
    `✅ *BOOKING CONFIRMED*`,
    `*${tenant.businessName || 'FleetPro'} Services*`,
    ``,
    `Dear *${booking.customerName}*,`,
    `Your booking has been successfully confirmed. 🚘`,
    ``,
    `📋 *TRIP DETAILS*`,
    `🔖 Booking ID: *${booking.bookingId}*`,
    `📍 Pickup: *${booking.pickupLocation}*`,
    `🏁 Drop: *${booking.dropoffLocation || 'Local'}*`,
    `📅 Date & Time: *${formatDate(booking.pickupDate)} | ${booking.pickupTime || 'TBD'}*`,
    ``,
    `👨‍✈️ *DRIVER & VEHICLE*`,
    `👤 ${driverName} | 📞 ${driverPhone}`,
    `🚗 ${vehicleModel} | *${vehicleNumber}*`,
  ];

  // Only add payment section if payment collection is enabled
  if (collectPayment) {
    lines.push(
      ``,
      `💳 *PAYMENT SUMMARY*`,
      `Total Booking: *₹${booking.totalAmount}*`,
      `✅ Advance Paid: *₹${booking.advanceReceived || 0}*`,
      `🚘 Due at Trip Start: *₹${dueAtStart}*`,
      `💰 Remaining Balance: *₹${remaining}*`,
      ``,
      `📌 *PAYMENT TERMS*`,
      `• At trip start, payment should be completed up to *50% of the total booking amount*.`,
      `• Remaining balance must be paid *at least 2 hours before trip completion*, directly to the driver.`,
      `• Please avoid fare/payment negotiation with the driver, as the driver cannot change confirmed booking terms.`,
      `• For any payment or service-related issue, please contact *${tenant.businessName || 'FleetPro'} Support* directly. We will assist you.`,
      ``
    );
  } else {
    lines.push(
      ``,
      `ℹ️ *NO PAYMENT COLLECTION*`,
      `This booking does not require payment collection from you.`,
      ``
    );
  }

  lines.push(
    `🗺️ *TRIP TERMS*`,
    `• Trip will run as per the *confirmed itinerary/route*.`,
    `• Extra destination, route change, sightseeing, kilometres or waiting may be charged separately.`,
    `• Fuel, toll, parking, state tax or other charges not included in the package will be payable separately, wherever applicable.`,
    `• For any change, please contact our office before proceeding.`,
    ``,
    `Thank you for choosing *${tenant.businessName || 'FleetPro'} Services* 🙏`,
    `*Safe Journey • Professional Service*`,
    ``,
    `📞 Support: ${tenant.phone || '+91 9200006646'}`
  );

  return lines.join('\n');
}

// DRIVER MESSAGE - PROFESSIONAL HINDI FORMAT
export function buildDriverDutyMessage(booking: any, tenant: any): string {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const remaining = remainingBalance(booking);
  const vehicleModel = vehicle ? `${vehicle.make || ''} ${vehicle.vehicleModel || ''}`.trim() : 'TBD';
  const vehicleNumber = vehicle?.licensePlate || 'TBD';
  const driverName = booking.driverId?.name || 'ड्राइवर';
  const companyName = tenant?.businessName || tenant?.name || 'FleetPro';
  const supportPhone = tenant?.phone || '+91 9200006646';
  const collectPayment = booking.collectPayment !== false;

  const dueAtStart = amountDueAtTripStart(booking);
  const fiftyPercent = Math.ceil((booking.totalAmount || 0) * 0.5);
  const dueAtEnd = Math.max(0, (booking.totalAmount || 0) - fiftyPercent);
  const collectTollParking = booking.collectTollParking !== false;
  const tollParkingAmount = (booking.tollCharges || 0) + (booking.parkingCharges || 0);

  const lines: string[] = [
    `🚨 *नई ड्यूटी असाइन | ${companyName} Services*`,
    ``,
    `👋 नमस्कार *${driverName} जी*,`,
    `आपको एक नई ड्यूटी असाइन की गई है।`,
    ``,
    `📋 *ड्यूटी की जानकारी*`,
    `🔖 बुकिंग आईडी: *${booking.bookingId}*`,
    `👤 ग्राहक: *${booking.customerName}*`,
    `📱 मोबाइल: *${booking.customerPhone}*`,
    ``,
    `📍 *यात्रा विवरण*`,
    `🚩 पिकअप: *${booking.pickupLocation}*`,
    `🏁 ड्रॉप: *${booking.dropoffLocation || 'Local'}*`,
    `📅 शुरू: *${formatDate(booking.pickupDate)} | ${booking.pickupTime || 'TBD'}*`,
    `⌛ समाप्त: *TBD*`,
    ``,
    `🚘 *गाड़ी*`,
    `${vehicleModel} | *${vehicleNumber}*`,
    ``,
    ...(collectPayment ? [
      `💰 *भुगतान की जानकारी*`,
      `कुल किराया: *₹${booking.totalAmount}*`,
      `✅ एडवांस प्राप्त: *₹${booking.advanceReceived || 0}*`,
      `▶️ यात्रा शुरू होने पर लेना है: *₹${dueAtStart}*`,
      `⏰ यात्रा समाप्त होने से 2 घंटे पहले लेना है: *₹${dueAtEnd}*`,
      `💵 कुल प्राप्त करना है: *₹${remaining}*`,
    ] : [
      `ℹ️ *कोई भुगतान नहीं*`,
      `यह बुकिंग पर ग्राहक से कोई भुगतान नहीं लेना है।`,
    ]),
    ...(collectTollParking && tollParkingAmount > 0 ? [
      ``,
      `🛣️ *टोल/पार्किंग*`,
      `एडवांस में टोल/पार्किंग: *₹${tollParkingAmount}*`,
      `यह राशि ग्राहक से एडवांस में लेना है या यात्रा के समय।`,
    ] : collectTollParking ? [
      ``,
      `🛣️ *टोल/पार्किंग*`,
      `यदि यात्रा में टोल/पार्किंग लगे तो ग्राहक से सीधे कलेक्ट करें।`,
    ] : []),
    ``,
    `📌 *जरूरी निर्देश*`,
    `• यात्रा केवल ऑफिस से तय किए गए मार्ग और कार्यक्रम के अनुसार करें।`,
    `• अतिरिक्त जगह, मार्ग या समय के लिए पहले ऑफिस से अनुमति लें।`,
    `• ईंधन आदि यात्रा खर्च ग्राहक से करवाएँ, जैसा ऑफिस द्वारा बताया गया हो।`,
    `• *टोल और पार्किंग अलग से लागू होने पर ग्राहक से अलग कलेक्ट करें।* किसी भी संदेह में पहले ऑफिस से बात कर लें।`,
    `• किराये या भुगतान में अपने स्तर पर कोई बदलाव न करें।`,
    `• यदि *कॉर्पोरेट बुकिंग* है, तो ग्राहक से भुगतान लेने से पहले ऑफिस से जरूर पूछ लें कि भुगतान लेना है या नहीं।`,
    `• ग्राहक से बहस या विवाद न करें। किसी भी समस्या में तुरंत ऑफिस से संपर्क करें।`,
    ``,
    `📞 *${companyName} सहायता: ${supportPhone}*`,
    ``,
    `✅ समय पर पिकअप करें और सभी भुगतान तय नियम के अनुसार प्राप्त करें।`,
  ];

  return lines.join('\n');
}

export function buildMessage(type: MessageType, booking: any, tenant: any): string {
  console.log(`[BUILDMSG] Building ${type} message`);
  if (type === 'booking_confirmation') return buildBookingConfirmationMessage(booking, tenant);
  if (type === 'driver_duty') {
    const msg = buildDriverDutyMessage(booking, tenant);
    console.log(`[BUILDMSG] driver_duty message length: ${msg.length}`);
    return msg;
  }
  throw new Error(`Unknown message type: ${type}`);
}
