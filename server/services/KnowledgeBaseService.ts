/**
 * KNOWLEDGE BASE SERVICE
 * Self-service article management with search, versioning, and analytics
 */

import mongoose from 'mongoose';

export interface IArticle {
  tenantId: string | mongoose.Types.ObjectId;
  articleId: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  author: string;
  version: number;
  helpfulCount: number;
  viewCount: number;
  isRelatedTo: string[]; // articleIds
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new mongoose.Schema<IArticle>({
  tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  articleId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, index: true },
  content: { type: String, required: true },
  category: { type: String, required: true, index: true },
  subcategory: { type: String },
  tags: { type: [String], default: [], index: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  author: { type: String, required: true },
  version: { type: Number, default: 1 },
  helpfulCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  isRelatedTo: { type: [String], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ArticleSchema.index({ tenantId: 1, status: 1 });
ArticleSchema.index({ tenantId: 1, category: 1 });
ArticleSchema.index({ title: 'text', content: 'text' });

export const Article = mongoose.model<IArticle>('KnowledgeBaseArticle', ArticleSchema);

export class KnowledgeBaseService {
  /**
   * Create a new knowledge base article
   */
  static async createArticle(input: Omit<IArticle, 'createdAt' | 'updatedAt' | 'articleId' | 'version'>): Promise<IArticle> {
    try {
      const articleId = `ART-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const article = new Article({
        ...input,
        articleId,
        version: 1,
        helpfulCount: 0,
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await article.save();
      return article.toObject();
    } catch (error) {
      console.error('Error creating article:', error);
      throw new Error('Failed to create article');
    }
  }

  /**
   * Update article content (auto-increment version)
   */
  static async updateArticle(tenantId: string, articleId: string, updates: Partial<IArticle>): Promise<IArticle | null> {
    try {
      const article = await Article.findOne({ tenantId, articleId });
      if (!article) return null;

      const newVersion = (article.version || 1) + 1;
      const updated = await Article.findOneAndUpdate(
        { tenantId, articleId },
        {
          ...updates,
          version: newVersion,
          updatedAt: new Date(),
        },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error updating article:', error);
      throw new Error('Failed to update article');
    }
  }

  /**
   * Increment view count
   */
  static async incrementViewCount(tenantId: string, articleId: string): Promise<void> {
    try {
      await Article.findOneAndUpdate(
        { tenantId, articleId },
        { $inc: { viewCount: 1 } }
      );
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  }

  /**
   * Mark article as helpful
   */
  static async markHelpful(tenantId: string, articleId: string): Promise<IArticle | null> {
    try {
      const updated = await Article.findOneAndUpdate(
        { tenantId, articleId },
        { $inc: { helpfulCount: 1 } },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error marking article helpful:', error);
      throw new Error('Failed to mark article as helpful');
    }
  }

  /**
   * Search articles with full-text and faceted search
   */
  static async searchArticles(
    tenantId: string,
    filters: {
      query?: string;
      category?: string;
      tags?: string[];
      status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ articles: IArticle[]; total: number }> {
    try {
      const searchQuery: any = { tenantId, status: 'published' };

      if (filters.status) searchQuery.status = filters.status;
      if (filters.category) searchQuery.category = filters.category;
      if (filters.tags && filters.tags.length > 0) {
        searchQuery.tags = { $in: filters.tags };
      }

      let query = Article.find(searchQuery);

      if (filters.query) {
        query = Article.find(
          { ...searchQuery, $text: { $search: filters.query } },
          { score: { $meta: 'textScore' } }
        ).sort({ score: { $meta: 'textScore' } });
      } else {
        query = query.sort({ viewCount: -1, updatedAt: -1 });
      }

      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const [articles, total] = await Promise.all([
        query.skip(skip).limit(limit),
        Article.countDocuments(searchQuery),
      ]);

      return {
        articles: articles.map(a => a.toObject()),
        total,
      };
    } catch (error) {
      console.error('Error searching articles:', error);
      throw new Error('Failed to search articles');
    }
  }

  /**
   * Get related articles
   */
  static async getRelatedArticles(tenantId: string, articleId: string, limit: number = 3): Promise<IArticle[]> {
    try {
      const article = await Article.findOne({ tenantId, articleId });
      if (!article) return [];

      const related = await Article.find({
        tenantId,
        status: 'published',
        $or: [
          { category: article.category },
          { tags: { $in: article.tags } },
          { articleId: { $in: article.isRelatedTo } },
        ],
        articleId: { $ne: articleId },
      })
        .limit(limit)
        .sort({ viewCount: -1 });

      return related.map(a => a.toObject());
    } catch (error) {
      console.error('Error getting related articles:', error);
      return [];
    }
  }

  /**
   * Get articles by category
   */
  static async getByCategory(tenantId: string, category: string): Promise<IArticle[]> {
    try {
      const articles = await Article.find({
        tenantId,
        category,
        status: 'published',
      }).sort({ viewCount: -1, updatedAt: -1 });

      return articles.map(a => a.toObject());
    } catch (error) {
      console.error('Error fetching articles by category:', error);
      throw new Error('Failed to fetch articles');
    }
  }

  /**
   * Get article details
   */
  static async getArticle(tenantId: string, articleId: string): Promise<IArticle | null> {
    try {
      const article = await Article.findOne({ tenantId, articleId });
      if (article) {
        await this.incrementViewCount(tenantId, articleId);
      }
      return article ? article.toObject() : null;
    } catch (error) {
      console.error('Error fetching article:', error);
      throw new Error('Failed to fetch article');
    }
  }

  /**
   * Get top articles by views
   */
  static async getTopArticles(tenantId: string, limit: number = 10): Promise<IArticle[]> {
    try {
      const articles = await Article.find({ tenantId, status: 'published' })
        .sort({ viewCount: -1 })
        .limit(limit);

      return articles.map(a => a.toObject());
    } catch (error) {
      console.error('Error fetching top articles:', error);
      throw new Error('Failed to fetch top articles');
    }
  }

  /**
   * Archive article
   */
  static async archiveArticle(tenantId: string, articleId: string): Promise<IArticle | null> {
    try {
      const updated = await Article.findOneAndUpdate(
        { tenantId, articleId },
        { status: 'archived', updatedAt: new Date() },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error archiving article:', error);
      throw new Error('Failed to archive article');
    }
  }
}
