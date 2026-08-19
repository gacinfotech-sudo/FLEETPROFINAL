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

export function buildBookingConfirmationMessage(booking: any, tenant: any): string {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const driver = booking.driverId && typeof booking.driverId === 'object' ? booking.driverId : null;
  const remaining = remainingBalance(booking);
  const tripLabel = booking.dropoffLocation ? `${booking.pickupLocation} → ${booking.dropoffLocation}` : booking.pickupLocation;

  const lines: string[] = [
    `╔════════════════════════════════════╗`,
    `║  ✅ आपकी बुकिंग पुष्टि हुई          ║`,
    `║  ${(tenant.businessName || tenant.name || 'FleetPro').padEnd(32)}║`,
    `╚════════════════════════════════════╝`,
    ``,
    `नमस्कार ${booking.customerName} जी,`,
    ``,
    `आपकी यात्रा के लिए सब कुछ तैयार है।`,
    ``,
    `━━━ 📋 बुकिंग विवरण ━━━`,
    `🔖 बुकिंग ID: ${booking.bookingId}`,
    `🚗 मार्ग: ${tripLabel}`,
    `📍 पिकअप: ${booking.pickupLocation}`,
  ];

  if (booking.dropoffLocation) lines.push(`🏁 ड्रॉप: ${booking.dropoffLocation}`);

  if (booking.pickupDate) {
    const dateStr = formatDate(booking.pickupDate);
    const timeStr = booking.pickupTime ? ` @ ${booking.pickupTime}` : '';
    lines.push(`📅 तारीख: ${dateStr}${timeStr}`);
  }

  if (driver) {
    lines.push(``,`━━━ 👨‍💼 ड्राइवर जानकारी ━━━`);
    lines.push(`👤 नाम: ${driver.name}`);
    lines.push(`📱 कॉल करें: ${driver.phone}`);
  }

  if (vehicle) {
    lines.push(``,`━━━ 🚙 वाहन विवरण ━━━`);
    lines.push(`🚗 गाड़ी: ${[vehicle.make, vehicle.vehicleModel].filter(Boolean).join(' ')}`);
    lines.push(`🏷️  नंबर: ${vehicle.licensePlate || 'N/A'}`);
  }

  lines.push(``,`━━━ 💰 भुगतान विवरण ━━━`);
  lines.push(`कुल किराया: ₹${booking.totalAmount}`);
  lines.push(`एडवांस: ₹${booking.advanceReceived || 0}`);
  lines.push(`शेष: ₹${remaining}`);

  if (remaining > 0) {
    lines.push(``,`⚠️  ₹${remaining} यात्रा के दौरान ड्राइवर को कैश में दें।`);
  }

  if (booking.notes) {
    lines.push(``,`━━━ 📌 विशेष निर्देश ━━━`);
    lines.push(booking.notes);
  }

  lines.push(``,`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,`🙏 धन्यवाद!`,``,`कोई समस्या? हमसे संपर्क करें:`);
  lines.push(`📞 ${tenant.phone || 'Support'}`);
  lines.push(`🌐 ${tenant.businessName || 'FleetPro'}`);

  return lines.join('\n');
}

export function buildDriverDutyMessage(booking: any, tenant: any): string {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const remaining = remainingBalance(booking);

  const lines: string[] = [
    `╔════════════════════════════════════╗`,
    `║  🚨 नई ड्यूटी असाइन               ║`,
    `║  ${(tenant.businessName || tenant.name || 'FleetPro').padEnd(32)}║`,
    `╚════════════════════════════════════╝`,
    ``,
    `👋 नमस्कार,`,
    ``,
    `आपको एक नई ड्यूटी असाइन की गई है।`,
    ``,
    `━━━ 📋 ड्यूटी विवरण ━━━`,
    `🔖 बुकिंग ID: ${booking.bookingId}`,
    `👤 कस्टमर: ${booking.customerName}`,
    `📱 कॉल करें: ${booking.customerPhone}`,
    ``,
    `━━━ 📍 मार्ग विवरण ━━━`,
    `🚩 पिकअप: ${booking.pickupLocation}`,
  ];

  if (booking.dropoffLocation) lines.push(`🏁 ड्रॉप: ${booking.dropoffLocation}`);

  if (Array.isArray(booking.additionalStops) && booking.additionalStops.length > 0) {
    lines.push(`📌 रुकने की जगहें: ${booking.additionalStops.join(', ')}`);
  }

  if (booking.pickupTime) lines.push(`⏰ पिकअप समय: ${booking.pickupTime}`);
  if (booking.returnDate) lines.push(`⌛ ड्यूटी खत्म: ${formatDate(booking.returnDate)}${booking.returnTime ? ` @ ${booking.returnTime}` : ''}`);

  if (vehicle) {
    lines.push(``,`━━━ 🚙 आपकी गाड़ी ━━━`);
    lines.push(`🚗 मॉडल: ${[vehicle.make, vehicle.vehicleModel].filter(Boolean).join(' ')}`);
    lines.push(`🏷️  नंबर: ${vehicle.licensePlate || 'N/A'}`);
  }

  lines.push(``,`━━━ 💰 भुगतान विवरण ━━━`);
  lines.push(`📌 कुल अमाउंट: ₹${booking.totalAmount}`);
  lines.push(`✅ एडवांस प्राप्त: ₹${booking.advanceReceived || 0}`);
  if (remaining > 0) {
    lines.push(`⚠️  कलेक्ट करना है: ₹${remaining} (कैश)`);
  }

  if (booking.customerDiscussionSummary) {
    lines.push(``);
    lines.push(`Customer Discussion:`);
    lines.push(booking.customerDiscussionSummary);
  }

  if (booking.notes) {
    lines.push(``);
    lines.push(`Driver Instruction:`);
    lines.push(booking.notes);
  }

  lines.push(``);
  lines.push(`किसी भी सहायता के लिए ऑफिस से संपर्क करें।`);
  if (tenant.phone) lines.push(`Office: ${tenant.phone}`);

  return lines.join('\n');
}

export function buildMessage(type: MessageType, booking: any, tenant: any): string {
  if (type === 'booking_confirmation') return buildBookingConfirmationMessage(booking, tenant);
  if (type === 'driver_duty') return buildDriverDutyMessage(booking, tenant);
  throw new Error(`Unknown message type: ${type}`);
}
