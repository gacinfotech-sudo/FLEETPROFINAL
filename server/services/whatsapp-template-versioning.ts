import mongoose from 'mongoose';
import { storage } from '../storage-mongodb';

export interface TemplateVersion {
  versionNumber: number;
  isLatest: boolean;
  name: string;
  body: string;
  status: string;
  changesSummary: string;
  changedBy: string;
  changedAt: Date;
}

export interface TemplateAudit {
  action: string;
  versionNumber?: number;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  changedBy: string;
  changedAt: Date;
  reason: string;
}

export class WhatsAppTemplateVersioning {
  /**
   * Create new version when template is updated
   */
  static async createVersion(
    tenantId: string,
    templateId: string,
    templateData: any,
    changesSummary: string,
    changedBy: string
  ): Promise<any> {
    try {
      const db = await storage.getDb();

      // Get latest version number
      const latestVersion = await db.collection('whatsappTemplateVersions').findOne(
        { tenantId: new mongoose.Types.ObjectId(tenantId), templateId: new mongoose.Types.ObjectId(templateId), isLatest: true },
        { sort: { versionNumber: -1 } }
      );

      const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

      // Mark previous version as not latest
      await db.collection('whatsappTemplateVersions').updateMany(
        { tenantId: new mongoose.Types.ObjectId(tenantId), templateId: new mongoose.Types.ObjectId(templateId), isLatest: true },
        { $set: { isLatest: false } }
      );

      // Create new version
      const newVersion = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        templateId: new mongoose.Types.ObjectId(templateId),
        versionNumber: nextVersionNumber,
        isLatest: true,
        templateType: templateData.templateType,
        messageType: templateData.messageType,
        name: templateData.name,
        language: templateData.language,
        subject: templateData.subject,
        body: templateData.body,
        variables: templateData.variables || [],
        status: templateData.status || 'draft',
        changesSummary,
        changedBy,
        changedAt: new Date(),
        createdAt: new Date(),
      };

      const result = await db.collection('whatsappTemplateVersions').insertOne(newVersion);

      // Create audit record
      await this.createAudit(tenantId, templateId, 'updated', nextVersionNumber, {}, templateData, changedBy, changesSummary);

      return { versionNumber: nextVersionNumber, _id: result.insertedId };
    } catch (error) {
      console.error('Error creating template version:', error);
      throw error;
    }
  }

  /**
   * Get version history for a template
   */
  static async getVersionHistory(tenantId: string, templateId: string): Promise<TemplateVersion[]> {
    try {
      const db = await storage.getDb();

      const versions = await db
        .collection('whatsappTemplateVersions')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          templateId: new mongoose.Types.ObjectId(templateId),
        })
        .sort({ versionNumber: -1 })
        .toArray();

      return versions.map((v) => ({
        versionNumber: v.versionNumber,
        isLatest: v.isLatest,
        name: v.name,
        body: v.body,
        status: v.status,
        changesSummary: v.changesSummary || '',
        changedBy: v.changedBy,
        changedAt: v.changedAt,
      }));
    } catch (error) {
      console.error('Error fetching version history:', error);
      throw error;
    }
  }

  /**
   * Get specific version details
   */
  static async getVersion(tenantId: string, templateId: string, versionNumber: number): Promise<any> {
    try {
      const db = await storage.getDb();

      const version = await db.collection('whatsappTemplateVersions').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        templateId: new mongoose.Types.ObjectId(templateId),
        versionNumber,
      });

      if (!version) {
        throw new Error(`Version ${versionNumber} not found`);
      }

      return version;
    } catch (error) {
      console.error('Error fetching version:', error);
      throw error;
    }
  }

  /**
   * Restore template to previous version
   */
  static async restoreVersion(
    tenantId: string,
    templateId: string,
    versionNumber: number,
    restoredBy: string
  ): Promise<any> {
    try {
      const db = await storage.getDb();

      // Get the version to restore
      const versionToRestore = await this.getVersion(tenantId, templateId, versionNumber);

      // Update current template with restored version
      const updatedTemplate = {
        name: versionToRestore.name,
        body: versionToRestore.body,
        status: versionToRestore.status,
        variables: versionToRestore.variables,
        subject: versionToRestore.subject,
        updatedAt: new Date(),
      };

      const result = await db.collection('whatsappTemplates').findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(templateId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
        },
        { $set: updatedTemplate },
        { returnDocument: 'after' }
      );

      // Create new version entry for the restore
      const restoreChangesSummary = `Restored from version ${versionNumber}`;
      await this.createVersion(
        tenantId,
        templateId,
        result.value,
        restoreChangesSummary,
        restoredBy
      );

      // Create audit record
      await this.createAudit(
        tenantId,
        templateId,
        'restored',
        versionNumber,
        {},
        result.value,
        restoredBy,
        `Restored from version ${versionNumber}`,
        result.value
      );

      return result.value;
    } catch (error) {
      console.error('Error restoring version:', error);
      throw error;
    }
  }

  /**
   * Reset to default template
   */
  static async resetToDefault(
    tenantId: string,
    templateId: string,
    defaultTemplate: any,
    resetBy: string
  ): Promise<any> {
    try {
      const db = await storage.getDb();

      const resetTemplate = {
        ...defaultTemplate,
        updatedAt: new Date(),
      };

      const result = await db.collection('whatsappTemplates').findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(templateId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
        },
        { $set: resetTemplate },
        { returnDocument: 'after' }
      );

      // Create new version
      await this.createVersion(tenantId, templateId, result.value, 'Reset to default template', resetBy);

      // Create audit record
      await this.createAudit(tenantId, templateId, 'updated', undefined, {}, result.value, resetBy, 'Reset to default template', result.value);

      return result.value;
    } catch (error) {
      console.error('Error resetting to default:', error);
      throw error;
    }
  }

  /**
   * Create audit trail entry
   */
  static async createAudit(
    tenantId: string,
    templateId: string,
    action: string,
    versionNumber: number | undefined,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    changedBy: string,
    reason: string,
    details?: any
  ): Promise<void> {
    try {
      const db = await storage.getDb();

      const audit = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        templateId: new mongoose.Types.ObjectId(templateId),
        action,
        versionNumber: versionNumber || null,
        oldValues,
        newValues,
        changedBy,
        changedAt: new Date(),
        reason,
        details: details ? JSON.stringify(details) : null,
        createdAt: new Date(),
      };

      await db.collection('whatsappTemplateAudit').insertOne(audit);
    } catch (error) {
      console.error('Error creating audit record:', error);
      // Don't throw - audit failure shouldn't block operations
    }
  }

  /**
   * Get audit trail for template
   */
  static async getAuditTrail(tenantId: string, templateId: string, limit: number = 50): Promise<TemplateAudit[]> {
    try {
      const db = await storage.getDb();

      const audits = await db
        .collection('whatsappTemplateAudit')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          templateId: new mongoose.Types.ObjectId(templateId),
        })
        .sort({ changedAt: -1 })
        .limit(limit)
        .toArray();

      return audits.map((a) => ({
        action: a.action,
        versionNumber: a.versionNumber,
        oldValues: a.oldValues || {},
        newValues: a.newValues || {},
        changedBy: a.changedBy,
        changedAt: a.changedAt,
        reason: a.reason,
      }));
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      throw error;
    }
  }

  /**
   * Compare two versions
   */
  static async compareVersions(
    tenantId: string,
    templateId: string,
    versionA: number,
    versionB: number
  ): Promise<{
    versionA: any;
    versionB: any;
    differences: Record<string, { old: any; new: any }>;
  }> {
    try {
      const v1 = await this.getVersion(tenantId, templateId, versionA);
      const v2 = await this.getVersion(tenantId, templateId, versionB);

      const differences: Record<string, { old: any; new: any }> = {};

      // Compare relevant fields
      const fieldsToCompare = ['name', 'body', 'subject', 'status', 'variables'];
      fieldsToCompare.forEach((field) => {
        if (JSON.stringify(v1[field]) !== JSON.stringify(v2[field])) {
          differences[field] = {
            old: v1[field],
            new: v2[field],
          };
        }
      });

      return { versionA: v1, versionB: v2, differences };
    } catch (error) {
      console.error('Error comparing versions:', error);
      throw error;
    }
  }

  /**
   * Purge old versions (keep last N versions)
   */
  static async purgeOldVersions(tenantId: string, templateId: string, keepLast: number = 20): Promise<number> {
    try {
      const db = await storage.getDb();

      // Get all versions sorted by version number
      const versions = await db
        .collection('whatsappTemplateVersions')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          templateId: new mongoose.Types.ObjectId(templateId),
        })
        .sort({ versionNumber: -1 })
        .toArray();

      if (versions.length <= keepLast) {
        return 0; // Nothing to purge
      }

      const versionsToDelete = versions.slice(keepLast);
      const versionNumbersToDelete = versionsToDelete.map((v) => v.versionNumber);

      // Delete old versions
      const result = await db.collection('whatsappTemplateVersions').deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        templateId: new mongoose.Types.ObjectId(templateId),
        versionNumber: { $in: versionNumbersToDelete },
      });

      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error purging old versions:', error);
      throw error;
    }
  }
}

export default WhatsAppTemplateVersioning;
