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
  const tripLabel = booking.dropoffLocation ? `${booking.pickupLocation} से ${booking.dropoffLocation}` : booking.pickupLocation;

  const lines: string[] = [
    `नमस्कार ${booking.customerName} जी,`,
    ``,
    `आपकी बुकिंग सफलतापूर्वक कन्फर्म हो गई है।`,
    ``,
    `Booking ID: ${booking.bookingId}`,
    `Trip: ${tripLabel}`,
    `Pickup: ${booking.pickupLocation}`,
  ];
  if (booking.dropoffLocation) lines.push(`Drop: ${booking.dropoffLocation}`);
  if (Array.isArray(booking.additionalStops) && booking.additionalStops.length > 0) {
    lines.push(`Additional Stops: ${booking.additionalStops.join(', ')}`);
  }
  if (booking.pickupDate) lines.push(`Pickup Date: ${formatDate(booking.pickupDate)}`);
  if (booking.pickupTime) lines.push(`Pickup Time: ${booking.pickupTime}`);
  if (booking.returnDate) lines.push(`Return Date: ${formatDate(booking.returnDate)}${booking.returnTime ? ` ${booking.returnTime}` : ''}`);

  lines.push(``);
  lines.push(`कुल किराया: ₹${booking.totalAmount}`);
  lines.push(`एडवांस प्राप्त: ₹${booking.advanceReceived || 0}`);
  lines.push(`शेष भुगतान: ₹${remaining}`);

  if (remaining > 0) {
    lines.push(``);
    lines.push(`शेष ₹${remaining} यात्रा के दौरान कैश में ड्राइवर को देना है।`);
  }

  if (driver) {
    lines.push(``);
    lines.push(`Driver Details:`);
    lines.push(`नाम: ${driver.name}`);
    lines.push(`मोबाइल: ${driver.phone}`);
  }

  if (vehicle) {
    lines.push(``);
    lines.push(`Vehicle Details:`);
    lines.push(`Vehicle: ${[vehicle.make, vehicle.vehicleModel].filter(Boolean).join(' ')}`);
    lines.push(`Vehicle Number: ${vehicle.licensePlate || 'N/A'}`);
  }

  if (booking.notes) {
    lines.push(``);
    lines.push(`महत्वपूर्ण निर्देश:`);
    lines.push(booking.notes);
  }

  lines.push(``);
  lines.push(`सहायता के लिए संपर्क:`);
  lines.push(`${tenant.businessName || tenant.name}`);
  if (tenant.phone) lines.push(`मोबाइल: ${tenant.phone}`);
  lines.push(``);
  lines.push(`धन्यवाद।`);

  return lines.join('\n');
}

export function buildDriverDutyMessage(booking: any, tenant: any): string {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const remaining = remainingBalance(booking);

  const lines: string[] = [
    `नई ड्यूटी असाइन की गई है।`,
    ``,
    `Booking ID: ${booking.bookingId}`,
    `Customer: ${booking.customerName}`,
    `Customer Mobile: ${booking.customerPhone}`,
    ``,
    `Pickup: ${booking.pickupLocation}`,
  ];
  if (booking.dropoffLocation) lines.push(`Drop: ${booking.dropoffLocation}`);
  if (Array.isArray(booking.additionalStops) && booking.additionalStops.length > 0) {
    lines.push(`Additional Stops: ${booking.additionalStops.join(', ')}`);
  }
  if (booking.pickupTime) lines.push(`Pickup Time: ${booking.pickupTime}`);
  if (booking.returnDate) lines.push(`Duty End: ${formatDate(booking.returnDate)}${booking.returnTime ? ` ${booking.returnTime}` : ''}`);

  if (vehicle) {
    lines.push(``);
    lines.push(`Vehicle: ${[vehicle.make, vehicle.vehicleModel].filter(Boolean).join(' ')}`);
    lines.push(`Vehicle Number: ${vehicle.licensePlate || 'N/A'}`);
  }

  lines.push(``);
  lines.push(`कुल बुकिंग: ₹${booking.totalAmount}`);
  lines.push(`एडवांस प्राप्त: ₹${booking.advanceReceived || 0}`);
  if (remaining > 0) {
    lines.push(`कस्टमर से कलेक्ट करना है: ₹${remaining} Cash`);
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
