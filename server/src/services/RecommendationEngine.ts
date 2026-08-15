// ============================================================================
// RECOMMENDATION ENGINE - Collaborative & content-based recommendations
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import {
  Recommendation,
  RecommendationItem,
  RecommendationType,
  UserItemInteraction,
} from '../types/ai-ml.types';

/**
 * RecommendationEngine: Hybrid recommendation system
 * - Collaborative filtering (user-based, item-based)
 * - Content-based recommendations
 * - Hybrid approach combining both
 * - A/B test variants
 * - Personalization scoring
 * - Cold-start handling for new users/items
 */
export class RecommendationEngine {
  private userInteractions: UserItemInteraction[] = [];
  private itemCatalog: Map<string, RecommendationItem> = new Map();
  private userSimilarityMatrix: Map<string, Map<string, number>> = new Map();
  private recommendations: Map<string, Recommendation> = new Map();

  constructor() {
    this.initializeEngine();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeEngine(): void {
    console.log('[RecommendationEngine] Service initialized');
    this.initializeCatalog();
  }

  private initializeCatalog(): void {
    // Sample product catalog
    const sampleItems: RecommendationItem[] = [
      {
        id: 'item_1',
        type: RecommendationType.FEATURE,
        name: 'Advanced Analytics',
        description: 'Deep insights into your business metrics',
        score: 0.95,
      },
      {
        id: 'item_2',
        type: RecommendationType.FEATURE,
        name: 'API Integration',
        description: 'Connect your tools and automate workflows',
        score: 0.87,
      },
      {
        id: 'item_3',
        type: RecommendationType.SERVICE,
        name: 'Premium Support',
        description: '24/7 dedicated support team',
        score: 0.92,
      },
      {
        id: 'item_4',
        type: RecommendationType.FEATURE,
        name: 'Custom Workflows',
        description: 'Build automation rules for your process',
        score: 0.85,
      },
      {
        id: 'item_5',
        type: RecommendationType.FEATURE,
        name: 'Data Export',
        description: 'Export data in multiple formats',
        score: 0.78,
      },
      {
        id: 'item_6',
        type: RecommendationType.SERVICE,
        name: 'Training & Onboarding',
        description: 'Get trained by our experts',
        score: 0.88,
      },
      {
        id: 'item_7',
        type: RecommendationType.CONTENT,
        name: 'Best Practices Guide',
        description: 'Learn industry best practices',
        score: 0.75,
      },
      {
        id: 'item_8',
        type: RecommendationType.FEATURE,
        name: 'Real-time Monitoring',
        description: 'Monitor your operations 24/7',
        score: 0.91,
      },
    ];

    sampleItems.forEach(item => this.itemCatalog.set(item.id, item));
  }

  // ========================================================================
  // COLLABORATIVE FILTERING
  // ========================================================================

  /**
   * Calculate similarity between two users based on their interactions
   */
  private calculateUserSimilarity(userId1: string, userId2: string): number {
    const user1Interactions = this.userInteractions.filter(i => i.userId === userId1);
    const user2Interactions = this.userInteractions.filter(i => i.userId === userId2);

    if (user1Interactions.length === 0 || user2Interactions.length === 0) {
      return 0;
    }

    // Find common items
    const user1Items = new Set(user1Interactions.map(i => i.itemId));
    const user2Items = new Set(user2Interactions.map(i => i.itemId));
    const commonItems = [...user1Items].filter(item => user2Items.has(item));

    if (commonItems.length === 0) {
      return 0;
    }

    // Calculate Jaccard similarity
    const intersection = commonItems.length;
    const union = user1Items.size + user2Items.size - commonItems.length;
    return intersection / union;
  }

  /**
   * Get user-based collaborative filtering recommendations
   */
  private getCollaborativeRecommendations(userId: string): RecommendationItem[] {
    // Find similar users
    const similarUsers: { userId: string; similarity: number }[] = [];
    const allUsers = [...new Set(this.userInteractions.map(i => i.userId))];

    for (const otherUserId of allUsers) {
      if (otherUserId !== userId) {
        const similarity = this.calculateUserSimilarity(userId, otherUserId);
        if (similarity > 0) {
          similarUsers.push({ userId: otherUserId, similarity });
        }
      }
    }

    // Sort by similarity
    similarUsers.sort((a, b) => b.similarity - a.similarity);
    const topSimilarUsers = similarUsers.slice(0, 5);

    // Get items liked by similar users
    const userItems = new Set(
      this.userInteractions
        .filter(i => i.userId === userId)
        .map(i => i.itemId)
    );

    const recommendations: Map<string, number> = new Map();
    for (const { userId: similarUserId, similarity } of topSimilarUsers) {
      const similarUserItems = this.userInteractions.filter(i => i.userId === similarUserId);
      for (const interaction of similarUserItems) {
        if (!userItems.has(interaction.itemId)) {
          const currentScore = recommendations.get(interaction.itemId) || 0;
          recommendations.set(
            interaction.itemId,
            currentScore + (interaction.rating || 1) * similarity
          );
        }
      }
    }

    // Convert to items
    return Array.from(recommendations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([itemId, score]) => ({
        ...this.itemCatalog.get(itemId)!,
        score: Math.min(1, score / 10),
      }));
  }

  // ========================================================================
  // CONTENT-BASED RECOMMENDATIONS
  // ========================================================================

  /**
   * Calculate similarity between items based on content features
   */
  private calculateItemSimilarity(itemId1: string, itemId2: string): number {
    const item1 = this.itemCatalog.get(itemId1);
    const item2 = this.itemCatalog.get(itemId2);

    if (!item1 || !item2) return 0;

    // Same type bonus
    let similarity = item1.type === item2.type ? 0.5 : 0;

    // Score similarity
    similarity += 1 - Math.abs(item1.score - item2.score);

    return similarity / 2;
  }

  /**
   * Get content-based recommendations
   */
  private getContentBasedRecommendations(userId: string): RecommendationItem[] {
    const userItems = this.userInteractions
      .filter(i => i.userId === userId)
      .map(i => i.itemId);

    if (userItems.length === 0) {
      return this.getPopularItems();
    }

    const recommendations: Map<string, number> = new Map();

    for (const userItemId of userItems) {
      for (const [catalogItemId, item] of this.itemCatalog) {
        if (userItemId !== catalogItemId) {
          const similarity = this.calculateItemSimilarity(userItemId, catalogItemId);
          if (similarity > 0) {
            const currentScore = recommendations.get(catalogItemId) || 0;
            recommendations.set(catalogItemId, currentScore + similarity);
          }
        }
      }
    }

    return Array.from(recommendations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([itemId, score]) => ({
        ...this.itemCatalog.get(itemId)!,
        score: Math.min(1, score / 5),
      }));
  }

  // ========================================================================
  // HYBRID RECOMMENDATIONS
  // ========================================================================

  /**
   * Generate hybrid recommendations combining collaborative and content-based
   */
  async generateRecommendations(
    userId: string,
    tenantId: string,
    strategy: 'collaborative' | 'content_based' | 'hybrid' = 'hybrid'
  ): Promise<Recommendation> {
    const recommendationId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let items: RecommendationItem[] = [];
    let finalStrategy: 'collaborative' | 'content_based' | 'hybrid' = strategy;

    if (strategy === 'collaborative' || strategy === 'hybrid') {
      const collaborativeItems = this.getCollaborativeRecommendations(userId);
      if (collaborativeItems.length > 0) {
        items = collaborativeItems;
        finalStrategy = 'collaborative';
      }
    }

    if (items.length < 3 && (strategy === 'content_based' || strategy === 'hybrid')) {
      const contentItems = this.getContentBasedRecommendations(userId);
      if (contentItems.length > 0) {
        items = contentItems;
        finalStrategy = 'content_based';
      }
    }

    if (items.length < 3) {
      items = this.getPopularItems();
      finalStrategy = 'hybrid';
    }

    // Add reasoning
    items = items.map(item => ({
      ...item,
      reasoning: this.generateReasoning(item.type),
    }));

    const recommendation: Recommendation = {
      id: recommendationId,
      userId,
      tenantId,
      items,
      strategy: finalStrategy,
      personalizationScore: this.calculatePersonalizationScore(userId),
      timestamp: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      abTestVariant: this.assignABTestVariant(),
    };

    this.recommendations.set(recommendationId, recommendation);
    return recommendation;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Track user interaction with items
   */
  async trackInteraction(
    userId: string,
    itemId: string,
    itemType: RecommendationType,
    interactionType: 'view' | 'click' | 'purchase' | 'rating',
    rating?: number
  ): Promise<void> {
    this.userInteractions.push({
      userId,
      itemId,
      itemType,
      interactionType,
      timestamp: new Date(),
      rating,
    });
  }

  /**
   * Get most popular items
   */
  private getPopularItems(): RecommendationItem[] {
    return Array.from(this.itemCatalog.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  /**
   * Calculate personalization score based on user activity
   */
  private calculatePersonalizationScore(userId: string): number {
    const userInteractionCount = this.userInteractions.filter(i => i.userId === userId).length;
    return Math.min(1, userInteractionCount / 50); // Max 50 interactions for 1.0 score
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(itemType: RecommendationType): string {
    const reasonings: Record<RecommendationType, string> = {
      [RecommendationType.FEATURE]: 'Based on similar features you liked',
      [RecommendationType.SERVICE]: 'Services that complement your usage',
      [RecommendationType.PRODUCT]: 'Popular in your industry',
      [RecommendationType.CONTENT]: 'Helpful resources for your needs',
    };
    return reasonings[itemType];
  }

  /**
   * Assign A/B test variant
   */
  private assignABTestVariant(): string {
    const variants = ['variant_a', 'variant_b', 'control'];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  /**
   * Calculate click-through rate
   */
  async calculateClickThroughRate(recommendationId: string): Promise<number> {
    const recommendation = this.recommendations.get(recommendationId);
    if (!recommendation) return 0;

    const clicks = this.userInteractions.filter(
      i => i.userId === recommendation.userId && i.interactionType === 'click'
    ).length;

    const views = this.userInteractions.filter(
      i => i.userId === recommendation.userId && i.interactionType === 'view'
    ).length;

    return views > 0 ? clicks / views : 0;
  }

  /**
   * Get recommendation by ID
   */
  async getRecommendation(recommendationId: string): Promise<Recommendation | null> {
    return this.recommendations.get(recommendationId) || null;
  }

  /**
   * Get all recommendations for user
   */
  async getUserRecommendations(userId: string): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values()).filter(r => r.userId === userId);
  }
}

// Export singleton instance
export const recommendationEngine = new RecommendationEngine();
