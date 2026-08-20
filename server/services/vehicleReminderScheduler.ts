import mongoose from 'mongoose';
import { VehicleCompliance, VehicleEMI, VehicleReminder } from '../models';

const COMPLIANCE_DOCUMENTS = ['insurance', 'fitness', 'permit', 'puc', 'roadTax'];
const COMPLIANCE_SCHEDULE = [30, 20, 18, 15, 10, 8, 7, 6, 5, 4, 3, 2, 1];
const EMI_SCHEDULE = [3, 2, 1, 0]; // 3, 2, 1 days before, and due date (0)

interface ReminderQueue {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  reminderType: 'compliance' | 'emi';
  documentType?: string;
  recipientType: 'owner' | 'fleet_manager';
  recipientName: string;
  recipientWhatsApp: string;
  expiryDate: Date;
  daysRemaining: number;
  scheduledDay: number;
}

export async function processVehicleReminders(tenantId: mongoose.Types.ObjectId) {
  try {
    console.log(`[VehicleReminders] Processing reminders for tenant: ${tenantId}`);

    const remindersToQueue: ReminderQueue[] = [];

    // Process compliance reminders
    const complianceRecords = await (mongoose.models.VehicleCompliance as any).find({
      tenantId,
    });

    for (const record of complianceRecords) {
      const queuedReminders = await processComplianceReminders(record, tenantId);
      remindersToQueue.push(...queuedReminders);
    }

    // Process EMI reminders
    const emiRecords = await (mongoose.models.VehicleEMI as any).find({
      tenantId,
      financeStatus: 'financed',
    });

    for (const record of emiRecords) {
      const queuedReminders = await processEMIReminders(record, tenantId);
      remindersToQueue.push(...queuedReminders);
    }

    console.log(`[VehicleReminders] Queued ${remindersToQueue.length} reminders`);

    // Queue all reminders for WhatsApp sending
    for (const reminder of remindersToQueue) {
      await queueReminderForSending(reminder);
    }

  } catch (error) {
    console.error('[VehicleReminders] Scheduler error:', error);
  }
}

async function processComplianceReminders(
  compliance: any,
  tenantId: mongoose.Types.ObjectId
): Promise<ReminderQueue[]> {
  const reminders: ReminderQueue[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const docType of COMPLIANCE_DOCUMENTS) {
    const docData = compliance[docType];
    if (!docData || !docData.expiryDate) continue;

    const expiryDate = new Date(docData.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Check if reminder should be sent today
    if (COMPLIANCE_SCHEDULE.includes(daysRemaining)) {
      // Send to Owner
      if (compliance.ownerWhatsApp) {
        const isDuplicate = await checkDuplicate(
          tenantId,
          compliance.vehicleId,
          'compliance',
          docType,
          'owner',
          daysRemaining
        );

        if (!isDuplicate) {
          reminders.push({
            tenantId,
            vehicleId: compliance.vehicleId,
            reminderType: 'compliance',
            documentType: docType,
            recipientType: 'owner',
            recipientName: compliance.ownerName || 'Vehicle Owner',
            recipientWhatsApp: compliance.ownerWhatsApp,
            expiryDate,
            daysRemaining,
            scheduledDay: daysRemaining,
          });
        }
      }

      // Send to Fleet Manager (only if different WhatsApp number)
      if (compliance.fleetManagerWhatsApp &&
          normalizeWhatsApp(compliance.fleetManagerWhatsApp) !== normalizeWhatsApp(compliance.ownerWhatsApp)) {
        const isDuplicate = await checkDuplicate(
          tenantId,
          compliance.vehicleId,
          'compliance',
          docType,
          'fleet_manager',
          daysRemaining
        );

        if (!isDuplicate) {
          reminders.push({
            tenantId,
            vehicleId: compliance.vehicleId,
            reminderType: 'compliance',
            documentType: docType,
            recipientType: 'fleet_manager',
            recipientName: compliance.fleetManagerName || 'Fleet Manager',
            recipientWhatsApp: compliance.fleetManagerWhatsApp,
            expiryDate,
            daysRemaining,
            scheduledDay: daysRemaining,
          });
        }
      }
    }
  }

  return reminders;
}

async function processEMIReminders(
  emi: any,
  tenantId: mongoose.Types.ObjectId
): Promise<ReminderQueue[]> {
  const reminders: ReminderQueue[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!emi.nextEMIDate) return reminders;

  const emiDate = new Date(emi.nextEMIDate);
  emiDate.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil((emiDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Check if EMI reminder should be sent today
  if (EMI_SCHEDULE.includes(daysRemaining)) {
    // Get owner details from compliance record
    const compliance = await (mongoose.models.VehicleCompliance as any).findOne({
      tenantId,
      vehicleId: emi.vehicleId,
    });

    if (compliance && compliance.ownerWhatsApp) {
      const emiCycle = `${emi.nextEMIDate.getFullYear()}-${String(emi.nextEMIDate.getMonth() + 1).padStart(2, '0')}`;

      const isDuplicate = await checkDuplicate(
        tenantId,
        emi.vehicleId,
        'emi',
        undefined,
        'owner',
        daysRemaining
      );

      if (!isDuplicate) {
        reminders.push({
          tenantId,
          vehicleId: emi.vehicleId,
          reminderType: 'emi',
          recipientType: 'owner',
          recipientName: compliance.ownerName || 'Vehicle Owner',
          recipientWhatsApp: compliance.ownerWhatsApp,
          expiryDate: emiDate,
          daysRemaining,
          scheduledDay: daysRemaining,
        });
      }
    }
  }

  return reminders;
}

async function checkDuplicate(
  tenantId: mongoose.Types.ObjectId,
  vehicleId: mongoose.Types.ObjectId,
  reminderType: string,
  documentType: string | undefined,
  recipientType: string,
  daysRemaining: number
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDay = new Date(today);
  nextDay.setDate(nextDay.getDate() + 1);

  const query: any = {
    tenantId,
    vehicleId,
    reminderType,
    recipientType,
    daysRemaining,
    createdAt: { $gte: today, $lt: nextDay },
  };

  if (documentType) {
    query.documentType = documentType;
  }

  const existing = await (mongoose.models.VehicleReminder as any).findOne(query);
  return !!existing;
}

async function queueReminderForSending(reminder: ReminderQueue) {
  try {
    const reminderRecord = await (mongoose.models.VehicleReminder as any).create({
      ...reminder,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Queue for WhatsApp - integrate with existing WhatsApp service
    queueWhatsAppMessage(reminder, reminderRecord._id);
  } catch (error) {
    console.error('[VehicleReminders] Failed to queue reminder:', error);
  }
}

function queueWhatsAppMessage(reminder: ReminderQueue, reminderId: mongoose.Types.ObjectId) {
  // This will be integrated with existing WhatsApp service
  // For now, mark as queued in database
  console.log(`[WhatsApp] Queued reminder ${reminderId} for ${reminder.recipientName}`);
}

function normalizeWhatsApp(number: string): string {
  // Normalize WhatsApp number to compare duplicates
  return number.replace(/[^\d]/g, '').slice(-10);
}

export async function markEMIAsPaid(
  tenantId: mongoose.Types.ObjectId,
  vehicleId: mongoose.Types.ObjectId,
  paidAmount: number,
  paymentReference: string
) {
  try {
    const emi = await (mongoose.models.VehicleEMI as any).findOne({
      tenantId,
      vehicleId,
    });

    if (!emi) {
      throw new Error('EMI record not found');
    }

    // Update remaining EMI
    const newRemaining = (emi.remainingEMI || 0) - 1;

    // Calculate next EMI date
    const nextEMIDate = calculateNextEMIDate(emi.emiDueDay);

    // Update EMI record
    await (mongoose.models.VehicleEMI as any).findOneAndUpdate(
      { tenantId, vehicleId },
      {
        remainingEMI: newRemaining,
        nextEMIDate,
        emiStatus: newRemaining <= 0 ? 'paid_all' : 'active',
        updatedAt: new Date(),
      }
    );

    // Create reminder record for payment made
    await (mongoose.models.VehicleReminder as any).create({
      tenantId,
      vehicleId,
      reminderType: 'emi',
      recipientType: 'owner',
      recipientName: 'Owner',
      recipientWhatsApp: '',
      expiryDate: new Date(),
      daysRemaining: 0,
      scheduledDay: 0,
      status: 'skipped',
      messageId: paymentReference,
      sentAt: new Date(),
    });
  } catch (error) {
    console.error('[VehicleReminders] Error marking EMI as paid:', error);
    throw error;
  }
}

function calculateNextEMIDate(emiDueDay: number): Date {
  const today = new Date();
  const currentDate = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  if (currentDate <= emiDueDay) {
    return new Date(currentYear, currentMonth, emiDueDay);
  } else {
    return new Date(currentYear, currentMonth + 1, emiDueDay);
  }
}

export async function renewalStopsReminders(
  tenantId: mongoose.Types.ObjectId,
  vehicleId: mongoose.Types.ObjectId,
  documentType: string,
  oldExpiryDate: Date
) {
  try {
    // Find all pending reminders for old expiry date
    const oldReminders = await (mongoose.models.VehicleReminder as any).find({
      tenantId,
      vehicleId,
      documentType,
      expiryDate: oldExpiryDate,
      status: { $in: ['queued', 'sent'] },
    });

    // Skip all old reminders
    await (mongoose.models.VehicleReminder as any).updateMany(
      { _id: { $in: oldReminders.map((r: any) => r._id) } },
      { status: 'skipped' }
    );

    console.log(`[VehicleReminders] Stopped ${oldReminders.length} old reminders for ${documentType}`);
  } catch (error) {
    console.error('[VehicleReminders] Error stopping old reminders:', error);
  }
}
