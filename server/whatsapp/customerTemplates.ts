export const CUSTOMER_TEMPLATE_KEYS = [
  'booking_summary',
  'payment_reminder',
  'driver_details',
  'reward_balance',
  'loyalty_offer',
] as const;

export type CustomerTemplateKey = typeof CUSTOMER_TEMPLATE_KEYS[number];

export interface CustomerTemplatePreview {
  key: CustomerTemplateKey;
  title: string;
  description: string;
  category: 'transactional' | 'promotional';
  content: string;
  enabled: boolean;
  disabledReason?: string;
  bookingId?: string;
}

function money(value: number): string {
  return `₹${Math.max(0, value || 0).toLocaleString('en-IN')}`;
}

function date(value: any): string {
  return value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';
}

function displayPhone(value?: string): string {
  return value?.replace(/^91/, '') || '-';
}

function bookingDue(booking: any): number {
  return Math.max(0, (booking?.totalAmount || 0) - (booking?.advanceReceived || 0));
}

export function buildCustomerTemplatePreviews(params: {
  customer: any;
  bookings: any[];
  tenant: any;
  preferredBookingId?: string;
}): CustomerTemplatePreview[] {
  const { customer, bookings, tenant, preferredBookingId } = params;
  const activeStatuses = new Set([
    'confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch',
    'trip_started', 'ongoing', 'extended', 'return_pending',
  ]);
  const selected = bookings.find((b) => b._id.toString() === preferredBookingId)
    || bookings.find((b) => activeStatuses.has(b.status))
    || bookings[0];
  const driver = selected?.driverId && typeof selected.driverId === 'object' ? selected.driverId : null;
  const vehicle = selected?.vehicleId && typeof selected.vehicleId === 'object' ? selected.vehicleId : null;
  const totalDue = bookings
    .filter((b) => !['cancelled', 'no_show'].includes(b.status))
    .reduce((sum, b) => sum + bookingDue(b), 0);
  const business = tenant.businessName || tenant.name || 'FleetPro';
  const supportPhone = tenant.phone ? `\nHelp: ${displayPhone(tenant.phone)}` : '';
  const firstName = customer.name || 'Customer';
  const selectedId = selected?._id?.toString();

  const bookingSummary = selected
    ? [
        `Namaste ${firstName} ji,`,
        `Booking ${selected.bookingId} ka latest summary:`,
        `${selected.pickupLocation} → ${selected.dropoffLocation || '-'}`,
        `Pickup: ${date(selected.pickupDate)} ${selected.pickupTime || ''}`.trim(),
        `Status: ${String(selected.status || '').replace(/_/g, ' ')}`,
        `Total: ${money(selected.totalAmount)} | Paid: ${money(selected.advanceReceived)} | Due: ${money(bookingDue(selected))}`,
        `- ${business}${supportPhone}`,
      ].join('\n')
    : `Namaste ${firstName} ji, aapki koi booking available nahi hai. - ${business}`;

  const paymentReminder = [
    `Namaste ${firstName} ji,`,
    `Aapke account par total pending payment ${money(totalDue)} hai.`,
    selected ? `Latest booking: ${selected.bookingId}` : '',
    `Payment karne ke baad reference share kar dein.`,
    `- ${business}${supportPhone}`,
  ].filter(Boolean).join('\n');

  const driverDetails = selected && driver
    ? [
        `Namaste ${firstName} ji, aapki booking ${selected.bookingId} ke service details:`,
        `Driver: ${driver.name}`,
        `Driver mobile: ${displayPhone(driver.phone)}`,
        `Vehicle: ${[vehicle?.make, vehicle?.vehicleModel].filter(Boolean).join(' ') || '-'}`,
        `Vehicle number: ${vehicle?.licensePlate || '-'}`,
        `Pickup: ${date(selected.pickupDate)} ${selected.pickupTime || ''}`.trim(),
        `- ${business}${supportPhone}`,
      ].join('\n')
    : `Namaste ${firstName} ji, driver abhi assign nahi hua hai. Assign hote hi details share ki jayengi. - ${business}`;

  const rewardBalance = [
    `Namaste ${firstName} ji,`,
    `Aapke FleetPro reward balance mein ${customer.rewardPointsBalance || 0} points hain.`,
    `Loyalty tier: ${customer.loyaltyTier || 'Regular'}.`,
    `Agli eligible booking par rewards redeem karne ke liye hume batayein.`,
    `- ${business}${supportPhone}`,
  ].join('\n');

  const loyaltyOffer = [
    `Namaste ${firstName} ji 👋`,
    `${customer.loyaltyTier || 'Regular'} member hone ke liye dhanyavaad!`,
    `Aapke paas ${customer.rewardPointsBalance || 0} reward points available hain.`,
    `Apni next ride ke liye reply karein—hum best available loyalty benefit share karenge.`,
    `- ${business}${supportPhone}`,
  ].join('\n');

  return [
    {
      key: 'booking_summary', title: 'Booking Summary', description: 'Latest route, date, status and amount',
      category: 'transactional', content: bookingSummary, enabled: !!selected,
      disabledReason: selected ? undefined : 'No booking available', bookingId: selectedId,
    },
    {
      key: 'payment_reminder', title: 'Payment Reminder', description: `Pending ${money(totalDue)}`,
      category: 'transactional', content: paymentReminder, enabled: totalDue > 0,
      disabledReason: totalDue > 0 ? undefined : 'No pending payment', bookingId: selectedId,
    },
    {
      key: 'driver_details', title: 'Driver & Vehicle', description: 'Assigned service contact details',
      category: 'transactional', content: driverDetails, enabled: !!selected && !!driver,
      disabledReason: selected && driver ? undefined : 'Driver is not assigned', bookingId: selectedId,
    },
    {
      key: 'reward_balance', title: 'Reward Balance', description: `${customer.rewardPointsBalance || 0} points available`,
      category: 'transactional', content: rewardBalance, enabled: true, bookingId: selectedId,
    },
    {
      key: 'loyalty_offer', title: 'Loyalty Offer', description: 'Promotional repeat-booking message',
      category: 'promotional', content: loyaltyOffer,
      enabled: customer.status !== 'do_not_contact' && !!customer.consent?.promotional,
      disabledReason: customer.consent?.promotional ? undefined : 'Promotional consent is required', bookingId: selectedId,
    },
  ];
}
