// Notification Templates - Reusable notification patterns
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationTemplates');

export enum TemplateCategory {
  BOOKING = 'booking',
  PAYMENT = 'payment',
  DRIVER = 'driver',
  VEHICLE = 'vehicle',
  CUSTOMER = 'customer',
  ALERT = 'alert',
  REMINDER = 'reminder',
  PROMO = 'promo',
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export interface NotificationTemplate {
  _id?: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tags: string[];
  variables: string[]; // e.g., ['customerName', 'bookingId', 'amount']
  previewData?: Record<string, any>;
  status: 'active' | 'inactive' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface TemplateRenderData {
  [key: string]: string | number | boolean | Date;
}

export interface RenderedNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    templateId: string;
    variables: TemplateRenderData;
  };
}

class NotificationTemplateManager {
  private db = mongoose.connection.db!;

  // Pre-built templates
  private builtInTemplates: NotificationTemplate[] = [
    {
      name: 'Booking Confirmed',
      description: 'Send when a booking is confirmed',
      category: TemplateCategory.BOOKING,
      title: 'Booking Confirmed - {{bookingId}}',
      body: 'Hi {{customerName}}, your booking for {{vehicleType}} is confirmed for {{bookingDate}}.',
      icon: '/icons/booking.png',
      tags: ['booking', 'confirmation'],
      variables: ['customerName', 'bookingId', 'vehicleType', 'bookingDate'],
      previewData: {
        customerName: 'John Doe',
        bookingId: 'BK-12345',
        vehicleType: 'SUV',
        bookingDate: '2026-08-15'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Booking Cancelled',
      description: 'Send when a booking is cancelled',
      category: TemplateCategory.BOOKING,
      title: 'Booking Cancelled - {{bookingId}}',
      body: 'Your booking {{bookingId}} has been cancelled. {{refundAmount}} will be refunded to your account.',
      tags: ['booking', 'cancellation'],
      variables: ['bookingId', 'refundAmount'],
      previewData: {
        bookingId: 'BK-12345',
        refundAmount: '₹5,000'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Payment Due Reminder',
      description: 'Reminder for upcoming payment',
      category: TemplateCategory.PAYMENT,
      title: 'Payment Due - {{amount}}',
      body: 'Hi {{customerName}}, payment of {{amount}} is due on {{dueDate}}. Please pay now.',
      tags: ['payment', 'reminder'],
      variables: ['customerName', 'amount', 'dueDate'],
      previewData: {
        customerName: 'John Doe',
        amount: '₹5,000',
        dueDate: '2026-08-20'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Payment Received',
      description: 'Confirmation of payment received',
      category: TemplateCategory.PAYMENT,
      title: 'Payment Received - {{amount}}',
      body: 'Thank you {{customerName}}! We received your payment of {{amount}}. Booking {{bookingId}} is now paid.',
      tags: ['payment', 'confirmation'],
      variables: ['customerName', 'amount', 'bookingId'],
      previewData: {
        customerName: 'John Doe',
        amount: '₹5,000',
        bookingId: 'BK-12345'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Driver Assignment',
      description: 'Notify customer of assigned driver',
      category: TemplateCategory.DRIVER,
      title: 'Driver Assigned - {{driverName}}',
      body: 'Hi {{customerName}}, {{driverName}} has been assigned to your booking. Contact: {{driverPhone}}',
      tags: ['driver', 'assignment'],
      variables: ['customerName', 'driverName', 'driverPhone'],
      previewData: {
        customerName: 'John Doe',
        driverName: 'Rajesh Kumar',
        driverPhone: '+91-98765-43210'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Trip Started',
      description: 'Notify when trip begins',
      category: TemplateCategory.BOOKING,
      title: 'Trip Started - {{vehicleNumber}}',
      body: 'Hi {{customerName}}, your trip has started. Driver {{driverName}} is on the way.',
      tags: ['booking', 'trip', 'real-time'],
      variables: ['customerName', 'driverName', 'vehicleNumber'],
      previewData: {
        customerName: 'John Doe',
        driverName: 'Rajesh Kumar',
        vehicleNumber: 'KA-01-AB-1234'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Vehicle Maintenance Alert',
      description: 'Alert for vehicle maintenance due',
      category: TemplateCategory.VEHICLE,
      title: 'Maintenance Due - {{vehicleNumber}}',
      body: 'Vehicle {{vehicleNumber}} is due for {{maintenanceType}} maintenance. Please schedule.',
      tags: ['vehicle', 'maintenance', 'alert'],
      variables: ['vehicleNumber', 'maintenanceType'],
      previewData: {
        vehicleNumber: 'KA-01-AB-1234',
        maintenanceType: 'Oil Change'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Driver Payroll Ready',
      description: 'Notify driver when payroll is ready',
      category: TemplateCategory.DRIVER,
      title: 'Payroll Ready - {{amount}}',
      body: 'Hi {{driverName}}, your payroll of {{amount}} for {{month}} is ready. Click to view details.',
      tags: ['driver', 'payroll'],
      variables: ['driverName', 'amount', 'month'],
      previewData: {
        driverName: 'Rajesh Kumar',
        amount: '₹15,000',
        month: 'August 2026'
      },
      status: 'active',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  async createTemplate(template: Omit<NotificationTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const collection = this.db.collection('notification_templates');

      const record: NotificationTemplate = {
        ...template,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(record as any);

      log.info('Template created', {
        id: result.insertedId,
        name: template.name,
        category: template.category
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to create template', { error });
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    try {
      const collection = this.db.collection('notification_templates');

      const template = await collection.findOne({
        _id: new mongoose.Types.ObjectId(templateId)
      });

      return template as NotificationTemplate | null;
    } catch (error) {
      log.error('Failed to get template', { error });
      throw error;
    }
  }

  async getTemplateByName(name: string): Promise<NotificationTemplate | null> {
    try {
      const collection = this.db.collection('notification_templates');

      const template = await collection.findOne({ name, status: 'active' });

      return template as NotificationTemplate | null;
    } catch (error) {
      log.error('Failed to get template by name', { error });
      throw error;
    }
  }

  async listTemplates(category?: TemplateCategory): Promise<NotificationTemplate[]> {
    try {
      const collection = this.db.collection('notification_templates');

      const filter: any = { status: 'active' };
      if (category) {
        filter.category = category;
      }

      const templates = await collection
        .find(filter)
        .sort({ category: 1, name: 1 })
        .toArray();

      return templates as NotificationTemplate[];
    } catch (error) {
      log.error('Failed to list templates', { error });
      throw error;
    }
  }

  async updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_templates');

      const result = await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(templateId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        log.info('Template updated', { templateId });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to update template', { error });
      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_templates');

      const result = await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(templateId) },
        {
          $set: {
            status: 'archived',
            updatedAt: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        log.info('Template archived', { templateId });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to delete template', { error });
      throw error;
    }
  }

  renderTemplate(template: NotificationTemplate, data: TemplateRenderData): RenderedNotification {
    try {
      const render = (text: string) => {
        let rendered = text;
        for (const [key, value] of Object.entries(data)) {
          const placeholder = `{{${key}}}`;
          rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
        }
        return rendered;
      };

      return {
        title: render(template.title),
        body: render(template.body),
        icon: template.icon,
        badge: template.badge,
        data: {
          templateId: template._id?.toString() || '',
          variables: data
        }
      };
    } catch (error) {
      log.error('Failed to render template', { error });
      throw error;
    }
  }

  async initializeBuiltInTemplates(): Promise<void> {
    try {
      const collection = this.db.collection('notification_templates');

      // Check if templates already exist
      const count = await collection.countDocuments();

      if (count === 0) {
        log.info('Initializing built-in notification templates');

        await collection.insertMany(this.builtInTemplates as any);

        log.info(`Created ${this.builtInTemplates.length} built-in templates`);
      } else {
        log.info('Built-in templates already exist, skipping initialization');
      }
    } catch (error) {
      log.error('Failed to initialize built-in templates', { error });
      throw error;
    }
  }

  async searchTemplates(query: string): Promise<NotificationTemplate[]> {
    try {
      const collection = this.db.collection('notification_templates');

      const templates = await collection
        .find({
          status: 'active',
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: query }
          ]
        })
        .toArray();

      return templates as NotificationTemplate[];
    } catch (error) {
      log.error('Failed to search templates', { error });
      throw error;
    }
  }

  async getTemplateStats(): Promise<Record<string, number>> {
    try {
      const collection = this.db.collection('notification_templates');

      const stats: Record<string, number> = {};

      for (const category of Object.values(TemplateCategory)) {
        const count = await collection.countDocuments({
          category,
          status: 'active'
        });
        stats[category] = count;
      }

      stats.total = await collection.countDocuments({ status: 'active' });
      stats.archived = await collection.countDocuments({ status: 'archived' });

      return stats;
    } catch (error) {
      log.error('Failed to get template stats', { error });
      throw error;
    }
  }
}

export const notificationTemplateManager = new NotificationTemplateManager();
