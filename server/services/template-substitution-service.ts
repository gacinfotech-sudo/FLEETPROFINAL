import { storage } from '../storage-mongodb';

export async function getAndSubstituteTemplate(
  tenantId: string,
  templateType: 'customer' | 'driver' | 'owner' | 'finance' | 'staff',
  messageType: string,
  bookingData: any,
  recipientType: 'customer' | 'driver' | 'owner' | 'staff'
): Promise<{ body: string; found: boolean; templateId?: string }> {
  try {
    // Fetch template from database
    const template = await storage.client
      ?.db('fleetpro')
      .collection('whatsappTemplates')
      .findOne({
        tenantId,
        templateType,
        messageType,
        isActive: true,
        isCustom: true // Prefer custom templates first
      });

    if (!template) {
      console.log(`[TEMPLATE] No custom template found for ${templateType}/${messageType}, trying default`);
      // Fall back to default if no custom template
      const defaultTemplate = await storage.client
        ?.db('fleetpro')
        .collection('whatsappTemplates')
        .findOne({
          tenantId,
          templateType,
          messageType,
          isActive: true
        });

      if (!defaultTemplate) {
        console.log(`[TEMPLATE] No template found at all for ${templateType}/${messageType}`);
        return { body: '', found: false };
      }

      const substituted = substituteVariables(defaultTemplate.body, bookingData);
      return { body: substituted, found: true, templateId: defaultTemplate._id };
    }

    const substituted = substituteVariables(template.body, bookingData);
    return { body: substituted, found: true, templateId: template._id };
  } catch (error: any) {
    console.error('[TEMPLATE] Error fetching template:', error.message);
    return { body: '', found: false };
  }
}

export function substituteVariables(template: string, data: any): string {
  console.log('[SUBST] Starting substitution, template length:', template.length);
  console.log('[SUBST] data.booking?.bookingId=', data.booking?.bookingId);
  console.log('[SUBST] data.booking?.driverId?.name=', data.booking?.driverId?.name);
  console.log('[SUBST] data.tenant?.businessName=', data.tenant?.businessName);

  let result = template;

  // Define all variable mappings
  const variables: Record<string, any> = {
    '{{companyName}}': data.tenant?.businessName || data.tenant?.name || 'FleetPro',
    '{{bookingId}}': data.booking?.bookingId || '',
    '{{customerName}}': data.booking?.customerName || '',
    '{{customerPhone}}': data.booking?.customerPhone || '',
    '{{customerEmail}}': data.booking?.customerEmail || '',
    '{{driverName}}': data.booking?.driverId?.name || data.driver?.name || '',
    '{{driverPhone}}': data.booking?.driverId?.phone || data.driver?.phone || '',
    '{{vehicleName}}': data.booking?.vehicleId?.make && data.booking?.vehicleId?.vehicleModel
      ? `${data.booking.vehicleId.make} ${data.booking.vehicleId.vehicleModel}`
      : data.vehicle?.name || '',
    '{{vehicleNumber}}': data.booking?.vehicleId?.licensePlate || data.vehicle?.licensePlate || '',
    '{{pickup}}': data.booking?.pickupLocation || '',
    '{{drop}}': data.booking?.dropoffLocation || '',
    '{{pickupDate}}': formatDate(data.booking?.pickupDate),
    '{{pickupTime}}': data.booking?.pickupTime || '',
    '{{itinerary}}': data.booking?.pickupLocation && data.booking?.dropoffLocation
      ? `${data.booking.pickupLocation} → ${data.booking.dropoffLocation}`
      : '',
    '{{bookingAmount}}': `₹${data.booking?.totalAmount || 0}`,
    '{{amountReceived}}': `₹${data.booking?.advanceReceived || 0}`,
    '{{balanceDue}}': `₹${Math.max(0, (data.booking?.totalAmount || 0) - (data.booking?.advanceReceived || 0))}`,
    '{{driverCollectAmount}}': `₹${Math.max(0, (data.booking?.totalAmount || 0) - (data.booking?.advanceReceived || 0))}`,
    '{{supportPhone}}': data.tenant?.phone || '+91 9200006646',
    '{{summaryDate}}': formatDate(new Date()),
    '{{totalBookings}}': data.stats?.totalBookings || 0,
    '{{completedBookings}}': data.stats?.completedBookings || 0,
    '{{pendingBookings}}': data.stats?.pendingBookings || 0,
    '{{totalBookingValue}}': `₹${data.stats?.totalBookingValue || 0}`,
    '{{todayReceived}}': `₹${data.stats?.todayReceived || 0}`,
    '{{outstanding}}': `₹${data.stats?.outstanding || 0}`,
    '{{driverHeld}}': `₹${data.stats?.driverHeld || 0}`,
    '{{activeVehicles}}': data.stats?.activeVehicles || 0,
    '{{vehiclesOnBooking}}': data.stats?.vehiclesOnBooking || 0,
    '{{availableVehicles}}': data.stats?.availableVehicles || 0,
    '{{utilization}}': data.stats?.utilization || 0,
    '{{daysOutstanding}}': data.stats?.daysOutstanding || 0,
  };

  // Replace all variables
  let replaceCount = 0;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const before = result;
    result = result.replace(regex, String(value || ''));
    if (before !== result) replaceCount++;
  });

  console.log(`[SUBST] Replaced ${replaceCount} variables, result length: ${result.length}`);
  return result;
}

function formatDate(date: any): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}
