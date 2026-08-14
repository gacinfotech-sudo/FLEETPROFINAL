import { Db } from 'mongodb';

export interface NotificationTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  subject?: string;
  body: string;
  variables: string[];
  channel: 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP' | 'MULTI';
  category: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

class NotificationTemplateEngine {
  private db: Db | null = null;
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor(db?: Db) {
    this.db = db || null;
  }

  setDatabase(db: Db) {
    this.db = db;
  }

  async initialize() {
    try {
      if (!this.db) {
        console.log('[TemplateEngine] Database not initialized, running in memory mode');
        return;
      }

      const templates = await this.db.collection('notificationTemplates')
        .find({ isActive: true })
        .toArray();

      for (const template of templates) {
        this.templates.set(template.id, template as NotificationTemplate);
      }

      console.log(`[TemplateEngine] Initialized with ${templates.length} templates`);
    } catch (error) {
      console.error('[TemplateEngine] Initialization error:', error);
    }
  }

  async createTemplate(
    tenantId: string,
    name: string,
    description: string,
    body: string,
    channel: string,
    category: string,
    createdBy: string,
    subject?: string
  ): Promise<NotificationTemplate> {
    const variables = this.extractVariables(body);

    const template: NotificationTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      name,
      description,
      subject: subject || `[${category}] ${name}`,
      body,
      variables,
      channel: channel as any,
      category,
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(template.id, template);

    if (this.db) {
      try {
        await this.db.collection('notificationTemplates').insertOne(template);
      } catch (e) {
        console.warn('[TemplateEngine] Failed to persist template:', e);
      }
    }

    return template;
  }

  private extractVariables(body: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = [...body.matchAll(regex)];
    return [...new Set(matches.map(m => m[1]))];
  }

  async renderTemplate(templateId: string, data: Record<string, any>): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    let rendered = template.body;

    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    const inMemory = this.templates.get(templateId);
    if (inMemory) return inMemory;

    if (this.db) {
      try {
        const result = await this.db.collection('notificationTemplates').findOne({ id: templateId });
        return (result as NotificationTemplate) || null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async listTemplates(tenantId: string, category?: string): Promise<NotificationTemplate[]> {
    let inMemory = Array.from(this.templates.values())
      .filter(t => t.tenantId === tenantId && t.isActive);

    if (category) {
      inMemory = inMemory.filter(t => t.category === category);
    }

    if (this.db) {
      try {
        const query: any = { tenantId, isActive: true };
        if (category) query.category = category;

        return await this.db.collection('notificationTemplates')
          .find(query)
          .sort({ createdAt: -1 })
          .toArray() as NotificationTemplate[];
      } catch (e) {
        return inMemory;
      }
    }

    return inMemory;
  }

  async updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate | null> {
    const template = await this.getTemplate(templateId);
    if (!template) return null;

    const updated = { ...template, ...updates, updatedAt: new Date() };
    this.templates.set(templateId, updated);

    if (this.db) {
      try {
        await this.db.collection('notificationTemplates').updateOne(
          { id: templateId },
          { $set: updated }
        );
      } catch (e) {
        console.warn('[TemplateEngine] Failed to update database:', e);
      }
    }

    return updated;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    this.templates.delete(templateId);

    if (this.db) {
      try {
        await this.db.collection('notificationTemplates').updateOne(
          { id: templateId },
          { $set: { isActive: false, updatedAt: new Date() } }
        );
        return true;
      } catch (e) {
        console.warn('[TemplateEngine] Failed to delete template:', e);
        return false;
      }
    }

    return true;
  }

  async searchTemplates(tenantId: string, keyword: string): Promise<NotificationTemplate[]> {
    const inMemory = Array.from(this.templates.values())
      .filter(t => t.tenantId === tenantId && t.isActive)
      .filter(t => t.name.includes(keyword) || t.description.includes(keyword));

    if (this.db) {
      try {
        return await this.db.collection('notificationTemplates')
          .find({
            tenantId,
            isActive: true,
            $or: [
              { name: { $regex: keyword, $options: 'i' } },
              { description: { $regex: keyword, $options: 'i' } }
            ]
          })
          .toArray() as NotificationTemplate[];
      } catch (e) {
        return inMemory;
      }
    }

    return inMemory;
  }

  getTemplateCount(): number {
    return this.templates.size;
  }

  getStatus() {
    return {
      templatesLoaded: this.templates.size,
      timestamp: new Date(),
    };
  }
}

export const templateEngine = new NotificationTemplateEngine();
