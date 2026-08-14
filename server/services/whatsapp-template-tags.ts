import mongoose from 'mongoose';
import { storage } from '../storage-mongodb';

export interface TemplateTag {
  _id?: string;
  tenantId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  templateCount?: number;
  usage?: number;
}

export interface TemplateCategory {
  _id?: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  defaultLanguage?: string;
  defaultApprovalRequired?: boolean;
  autoApprove?: boolean;
}

export class WhatsAppTemplateTags {
  /**
   * Create new tag
   */
  static async createTag(tenantId: string, tag: TemplateTag): Promise<any> {
    try {
      const db = await storage.getDb();
      const newTag = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: tag.name,
        description: tag.description || '',
        color: tag.color || '#3B82F6',
        icon: tag.icon || '',
        templateCount: 0,
        usage: 0,
        createdBy: tag.createdBy || 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('whatsappTemplateTags').insertOne(newTag);
      return { ...newTag, _id: result.insertedId };
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  /**
   * Get all tags for tenant
   */
  static async getTags(tenantId: string): Promise<TemplateTag[]> {
    try {
      const db = await storage.getDb();
      const tags = await db
        .collection('whatsappTemplateTags')
        .find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .sort({ createdAt: -1 })
        .toArray();
      return tags;
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }
  }

  /**
   * Update tag
   */
  static async updateTag(tenantId: string, tagId: string, updates: Partial<TemplateTag>): Promise<any> {
    try {
      const db = await storage.getDb();
      const result = await db.collection('whatsappTemplateTags').findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(tagId), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  }

  /**
   * Delete tag
   */
  static async deleteTag(tenantId: string, tagId: string): Promise<any> {
    try {
      const db = await storage.getDb();
      // Remove tag from all templates
      await db
        .collection('whatsappTemplates')
        .updateMany(
          { tenantId: new mongoose.Types.ObjectId(tenantId) },
          { $pull: { tags: new mongoose.Types.ObjectId(tagId) } }
        );

      // Delete tag
      const result = await db.collection('whatsappTemplateTags').deleteOne({
        _id: new mongoose.Types.ObjectId(tagId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });
      return result;
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  }

  /**
   * Create category
   */
  static async createCategory(tenantId: string, category: TemplateCategory): Promise<any> {
    try {
      const db = await storage.getDb();
      const newCategory = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: category.name,
        description: category.description || '',
        icon: category.icon || '',
        order: category.order || 0,
        defaultLanguage: category.defaultLanguage || 'en',
        defaultApprovalRequired: category.defaultApprovalRequired || false,
        autoApprove: category.autoApprove !== undefined ? category.autoApprove : true,
        templateCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('whatsappTemplateCategories').insertOne(newCategory);
      return { ...newCategory, _id: result.insertedId };
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Get all categories for tenant
   */
  static async getCategories(tenantId: string): Promise<TemplateCategory[]> {
    try {
      const db = await storage.getDb();
      const categories = await db
        .collection('whatsappTemplateCategories')
        .find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .sort({ order: 1, createdAt: 1 })
        .toArray();
      return categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Update category
   */
  static async updateCategory(
    tenantId: string,
    categoryId: string,
    updates: Partial<TemplateCategory>
  ): Promise<any> {
    try {
      const db = await storage.getDb();
      const result = await db.collection('whatsappTemplateCategories').findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(categoryId), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Delete category
   */
  static async deleteCategory(tenantId: string, categoryId: string): Promise<any> {
    try {
      const db = await storage.getDb();
      // Unset category from all templates
      await db.collection('whatsappTemplates').updateMany(
        { tenantId: new mongoose.Types.ObjectId(tenantId), category: new mongoose.Types.ObjectId(categoryId) },
        { $unset: { category: '' } }
      );

      // Delete category
      const result = await db.collection('whatsappTemplateCategories').deleteOne({
        _id: new mongoose.Types.ObjectId(categoryId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });
      return result;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Add tag to template
   */
  static async addTagToTemplate(tenantId: string, templateId: string, tagId: string): Promise<any> {
    try {
      const db = await storage.getDb();

      // Add tag to template
      const result = await db.collection('whatsappTemplates').findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(templateId), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $addToSet: { tags: new mongoose.Types.ObjectId(tagId) } },
        { returnDocument: 'after' }
      );

      // Increment tag count
      await db.collection('whatsappTemplateTags').updateOne(
        { _id: new mongoose.Types.ObjectId(tagId) },
        { $inc: { templateCount: 1 } }
      );

      return result.value;
    } catch (error) {
      console.error('Error adding tag to template:', error);
      throw error;
    }
  }

  /**
   * Remove tag from template
   */
  static async removeTagFromTemplate(tenantId: string, templateId: string, tagId: string): Promise<any> {
    try {
      const db = await storage.getDb();

      // Remove tag from template
      const result = await db.collection('whatsappTemplates').findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(templateId), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $pull: { tags: new mongoose.Types.ObjectId(tagId) } },
        { returnDocument: 'after' }
      );

      // Decrement tag count
      await db.collection('whatsappTemplateTags').updateOne(
        { _id: new mongoose.Types.ObjectId(tagId) },
        { $inc: { templateCount: -1 } }
      );

      return result.value;
    } catch (error) {
      console.error('Error removing tag from template:', error);
      throw error;
    }
  }

  /**
   * Search templates by tags
   */
  static async searchByTags(tenantId: string, tagIds: string[]): Promise<any[]> {
    try {
      const db = await storage.getDb();
      const templates = await db
        .collection('whatsappTemplates')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          tags: { $in: tagIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
        .toArray();
      return templates;
    } catch (error) {
      console.error('Error searching templates by tags:', error);
      throw error;
    }
  }

  /**
   * Search templates by keyword
   */
  static async searchByKeyword(tenantId: string, keyword: string): Promise<any[]> {
    try {
      const db = await storage.getDb();
      const regex = new RegExp(keyword, 'i');

      const templates = await db
        .collection('whatsappTemplates')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          $or: [
            { name: regex },
            { body: regex },
            { messageType: regex },
            { searchKeywords: regex },
          ],
        })
        .toArray();
      return templates;
    } catch (error) {
      console.error('Error searching templates:', error);
      throw error;
    }
  }

  /**
   * Get templates by category
   */
  static async getTemplatesByCategory(tenantId: string, categoryId: string): Promise<any[]> {
    try {
      const db = await storage.getDb();
      const templates = await db
        .collection('whatsappTemplates')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          category: new mongoose.Types.ObjectId(categoryId),
        })
        .toArray();
      return templates;
    } catch (error) {
      console.error('Error fetching templates by category:', error);
      throw error;
    }
  }

  /**
   * Update tag usage count
   */
  static async incrementTagUsage(tagId: string): Promise<void> {
    try {
      const db = await storage.getDb();
      await db.collection('whatsappTemplateTags').updateOne(
        { _id: new mongoose.Types.ObjectId(tagId) },
        { $inc: { usage: 1 } }
      );
    } catch (error) {
      console.error('Error updating tag usage:', error);
    }
  }

  /**
   * Get popular tags (by usage)
   */
  static async getPopularTags(tenantId: string, limit: number = 10): Promise<TemplateTag[]> {
    try {
      const db = await storage.getDb();
      const tags = await db
        .collection('whatsappTemplateTags')
        .find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .sort({ usage: -1 })
        .limit(limit)
        .toArray();
      return tags;
    } catch (error) {
      console.error('Error fetching popular tags:', error);
      throw error;
    }
  }
}

export default WhatsAppTemplateTags;
