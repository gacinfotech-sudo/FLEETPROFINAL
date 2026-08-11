// Notification Templates Management - Phase 37
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationTemplates');

export interface NotificationTemplate {
  _id?: string;
  tenantId?: string;
  name: string;
  description?: string;
  eventType?: string;
  category?: string;
  title: string;
  body: string;
  htmlBody?: string;
  variables: string[];
  channels?: string[];
  version?: number;
  enabled?: boolean;
  status?: string;
  icon?: string;
  badge?: string;
  tags?: string[];
  previewData?: Record<string, any>;
  metadata?: Record<string, any>;
  abTestConfig?: {
    variantA: { title: string; body: string; weight: number };
    variantB: { title: string; body: string; weight: number };
  };
  locales?: Record<string, { title: string; body: string }>;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export type TemplateCategory = 'booking' | 'payment' | 'notification' | 'alert' | 'reminder';

class TemplateManager {
  private db = mongoose.connection.db!;

  async createTemplate(template: Omit<NotificationTemplate, '_id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const collection = this.db.collection('notification_templates');

      const doc = {
        ...template,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(doc as any);

      log.info('Template created', {
        templateId: result.insertedId,
        name: template.name,
        eventType: template.eventType
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to create template', { error });
      throw error;
    }
  }

  async updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<void> {
    try {
      const collection = this.db.collection('notification_templates');

      const result = await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(templateId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
            $inc: { version: 1 }
          }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Template not found');
      }

      log.info('Template updated', { templateId });
    } catch (error) {
      log.error('Failed to update template', { templateId, error });
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    try {
      const collection = this.db.collection('notification_templates');

      return await collection.findOne({
        _id: new mongoose.Types.ObjectId(templateId)
      }) as any;
    } catch (error) {
      log.error('Failed to get template', { templateId, error });
      return null;
    }
  }

  async getTemplatesByEvent(tenantId: string, eventType: string): Promise<NotificationTemplate[]> {
    try {
      const collection = this.db.collection('notification_templates');

      return await collection
        .find({
          tenantId,
          eventType,
          enabled: true
        })
        .toArray() as any;
    } catch (error) {
      log.error('Failed to get templates by event', { eventType, error });
      return [];
    }
  }

  interpolateTemplate(template: NotificationTemplate, data: Record<string, any>): { title: string; body: string } {
    let title = template.title;
    let body = template.body;

    for (const variable of template.variables) {
      const value = data[variable] || '';
      const regex = new RegExp(`{{${variable}}}`, 'g');
      title = title.replace(regex, String(value));
      body = body.replace(regex, String(value));
    }

    return { title, body };
  }

  async selectABTestVariant(template: NotificationTemplate): Promise<{ title: string; body: string }> {
    if (!template.abTestConfig) {
      return { title: template.title, body: template.body };
    }

    const rand = Math.random() * 100;
    const variantA = template.abTestConfig.variantA;

    if (rand < variantA.weight) {
      return { title: variantA.title, body: variantA.body };
    } else {
      return {
        title: template.abTestConfig.variantB.title,
        body: template.abTestConfig.variantB.body
      };
    }
  }

  async getLocalizedTemplate(template: NotificationTemplate, locale: string): Promise<{ title: string; body: string }> {
    if (template.locales && template.locales[locale]) {
      return template.locales[locale];
    }

    return { title: template.title, body: template.body };
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const collection = this.db.collection('notification_templates');

      const result = await collection.deleteOne({
        _id: new mongoose.Types.ObjectId(templateId)
      });

      if (result.deletedCount === 0) {
        throw new Error('Template not found');
      }

      log.info('Template deleted', { templateId });
    } catch (error) {
      log.error('Failed to delete template', { templateId, error });
      throw error;
    }
  }

  async listTemplates(category?: string, page: number = 1, limit: number = 50): Promise<NotificationTemplate[]> {
    try {
      const collection = this.db.collection('notification_templates');
      const filter: any = { status: 'active' };

      if (category) {
        filter.category = category;
      }

      const templates = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray() as any;

      return templates;
    } catch (error) {
      log.error('Failed to list templates', { error });
      return [];
    }
  }

  async getTemplateByName(name: string): Promise<NotificationTemplate | null> {
    try {
      const collection = this.db.collection('notification_templates');
      return await collection.findOne({ name, status: 'active' }) as any;
    } catch (error) {
      log.error('Failed to get template by name', { name, error });
      return null;
    }
  }

  renderTemplate(template: NotificationTemplate, data: Record<string, any>): { title: string; body: string } {
    let title = template.title;
    let body = template.body;

    if (template.variables) {
      for (const variable of template.variables) {
        const value = data[variable] || '';
        const regex = new RegExp(`{{${variable}}}`, 'g');
        title = title.replace(regex, String(value));
        body = body.replace(regex, String(value));
      }
    }

    return { title, body };
  }

  async searchTemplates(query: string): Promise<NotificationTemplate[]> {
    try {
      const collection = this.db.collection('notification_templates');

      return await collection
        .find({
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ],
          status: 'active'
        })
        .toArray() as any;
    } catch (error) {
      log.error('Failed to search templates', { query, error });
      return [];
    }
  }

  async getTemplateStats(): Promise<Record<string, any>> {
    try {
      const collection = this.db.collection('notification_templates');

      const total = await collection.countDocuments();
      const active = await collection.countDocuments({ status: 'active' });

      const byCategory = await collection
        .aggregate([
          { $match: { status: 'active' } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ])
        .toArray();

      return {
        total,
        active,
        byCategory: Object.fromEntries(byCategory.map(b => [b._id || 'uncategorized', b.count]))
      };
    } catch (error) {
      log.error('Failed to get template stats', { error });
      return { total: 0, active: 0, byCategory: {} };
    }
  }
}

export const notificationTemplateManager = new TemplateManager();
