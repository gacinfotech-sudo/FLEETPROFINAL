import { EventEmitter } from "events";

export type FeedbackType = "booking" | "driver" | "service" | "app" | "payment" | "vehicle" | "safety" | "other";
export type Rating = 1 | 2 | 3 | 4 | 5;
export type SentimentScore = "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
export type ReviewStatus = "pending_moderation" | "approved" | "rejected" | "flagged" | "published";

export interface Review {
  reviewId: string;
  entityId: string; // driver, vehicle, or booking ID
  entityType: "driver" | "service" | "booking";
  customerId: string;
  rating: Rating;
  title: string;
  comment: string;
  sentiment: SentimentScore;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  moderationNotes?: string;
  tags: string[];
  aiTags: string[]; // Auto-extracted tags
  helpfulCount: number;
  unhelpfulCount: number;
  photos?: string[];
  verified: boolean; // Customer completed the booking/service
}

export interface FeedbackCategory {
  categoryId: string;
  name: FeedbackType;
  description: string;
  minRating?: number; // Trigger escalation if below
  escalationThreshold: number; // Number of reports to trigger
  activeReports: number;
  resolutionDueDate?: Date;
}

export interface SentimentAnalysis {
  overallSentiment: SentimentScore;
  score: number; // -1 to 1
  confidence: number; // 0-100
  emotionalTriggers: string[];
  keyPhrases: string[];
}

export interface ReviewerInsight {
  insightId: string;
  category: FeedbackType;
  trend: "improving" | "declining" | "stable";
  period: "7d" | "30d" | "90d";
  avgRating: number;
  totalReviews: number;
  sentimentBreakdown: { [key in SentimentScore]: number };
  topPositiveThemes: string[];
  topNegativeThemes: string[];
  recommendations: string[];
  lastUpdated: Date;
}

export interface ReviewModeration {
  moderationId: string;
  reviewId: string;
  status: "pending" | "approved" | "rejected" | "requires_review";
  moderatorId?: string;
  flags: string[];
  reason?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

export interface ReputationScore {
  entityId: string;
  entityType: "driver" | "service";
  totalReviews: number;
  avgRating: number;
  detailedRatings: { [key in Rating]: number };
  sentimentDistribution: { [key in SentimentScore]: number };
  trustScore: number; // 0-100
  consistencyScore: number; // How consistent ratings are
  responseRate: number; // % of reviews with replies
  category: string;
  lastUpdated: Date;
  badges: string[]; // "highly_rated", "responsive", "verified", "trusted"
}

export interface FeedbackResponse {
  responseId: string;
  reviewId: string;
  responderId: string; // driver or manager
  responderName: string;
  responseText: string;
  sentiment: SentimentScore;
  createdAt: Date;
  updatedAt: Date;
  helpful: boolean;
}

interface ReviewCounts {
  [key: number]: number;
}

class FeedbackEngine extends EventEmitter {
  private reviews: Map<string, Review> = new Map();
  private sentimentAnalyses: Map<string, SentimentAnalysis> = new Map();
  private reputationScores: Map<string, ReputationScore> = new Map();
  private moderations: Map<string, ReviewModeration> = new Map();
  private responses: Map<string, FeedbackResponse> = new Map();
  private insights: Map<string, ReviewerInsight> = new Map();
  private categories: Map<string, FeedbackCategory> = new Map();
  private reviewHistory: Review[] = [];

  constructor() {
    super();
    this.setupCategories();
  }

  private setupCategories() {
    const categories: FeedbackCategory[] = [
      {
        categoryId: "cat_1",
        name: "driver",
        description: "Driver behavior and professionalism feedback",
        minRating: 2,
        escalationThreshold: 5,
        activeReports: 0,
      },
      {
        categoryId: "cat_2",
        name: "service",
        description: "Overall service quality feedback",
        minRating: 3,
        escalationThreshold: 10,
        activeReports: 0,
      },
      {
        categoryId: "cat_3",
        name: "booking",
        description: "Booking experience feedback",
        minRating: 2,
        escalationThreshold: 8,
        activeReports: 0,
      },
      {
        categoryId: "cat_4",
        name: "app",
        description: "Mobile app feedback",
        minRating: 2,
        escalationThreshold: 15,
        activeReports: 0,
      },
      {
        categoryId: "cat_5",
        name: "payment",
        description: "Payment experience feedback",
        minRating: 2,
        escalationThreshold: 5,
        activeReports: 0,
      },
    ];

    categories.forEach((cat) => {
      this.categories.set(cat.categoryId, cat);
    });
  }

  submitReview(
    entityId: string,
    entityType: "driver" | "service" | "booking",
    customerId: string,
    rating: Rating,
    title: string,
    comment: string,
    photos?: string[]
  ): Review {
    const review: Review = {
      reviewId: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityId,
      entityType,
      customerId,
      rating,
      title,
      comment,
      sentiment: this.analyzeSentiment(comment),
      status: "pending_moderation",
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: this.extractTags(comment),
      aiTags: this.extractAITags(comment, rating),
      helpfulCount: 0,
      unhelpfulCount: 0,
      photos,
      verified: true, // Assume customer completed service
    };

    this.reviews.set(review.reviewId, review);
    this.reviewHistory.push(review);

    // Generate moderation record
    const moderation: ReviewModeration = {
      moderationId: `mod_${Date.now()}`,
      reviewId: review.reviewId,
      status: this.shouldFlagForReview(review) ? "requires_review" : "pending",
      flags: this.detectContentFlags(comment),
      createdAt: new Date(),
    };

    this.moderations.set(moderation.moderationId, moderation);

    // Update reputation scores
    this.updateReputationScore(entityId, entityType, rating);

    this.emit("review:submitted", review);
    return review;
  }

  private analyzeSentiment(text: string): SentimentScore {
    const veryPositiveWords = ["excellent", "amazing", "wonderful", "perfect", "outstanding"];
    const positiveWords = ["good", "great", "nice", "helpful", "professional"];
    const negativeWords = ["bad", "poor", "terrible", "rude", "unprofessional"];
    const veryNegativeWords = ["awful", "horrible", "disgusting", "unacceptable", "dangerous"];

    const lower = text.toLowerCase();
    const veryPositiveCount = veryPositiveWords.filter((w) =>
      lower.includes(w)
    ).length;
    const positiveCount = positiveWords.filter((w) => lower.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lower.includes(w)).length;
    const veryNegativeCount = veryNegativeWords.filter((w) =>
      lower.includes(w)
    ).length;

    if (veryNegativeCount > 0) return "very_negative";
    if (negativeCount > positiveCount + veryPositiveCount)
      return "negative";
    if (veryPositiveCount > 0) return "very_positive";
    if (positiveCount > negativeCount) return "positive";
    return "neutral";
  }

  private extractTags(comment: string): string[] {
    const tags: string[] = [];
    if (comment.toLowerCase().includes("driver")) tags.push("driver");
    if (comment.toLowerCase().includes("clean")) tags.push("cleanliness");
    if (comment.toLowerCase().includes("time")) tags.push("punctuality");
    if (comment.toLowerCase().includes("route")) tags.push("navigation");
    if (comment.toLowerCase().includes("communication"))
      tags.push("communication");
    if (comment.toLowerCase().includes("comfort")) tags.push("comfort");
    return tags;
  }

  private extractAITags(comment: string, rating: Rating): string[] {
    const aiTags: string[] = [];
    const words = comment.toLowerCase().split(/\s+/);

    // Behavior-based tagging
    if (
      words.some((w) =>
        ["fast", "quick", "rapid", "speedy"].includes(w)
      )
    )
      aiTags.push("speed");
    if (
      words.some((w) =>
        ["polite", "courteous", "respectful", "friendly"].includes(w)
      )
    )
      aiTags.push("politeness");
    if (
      words.some((w) =>
        ["safe", "careful", "cautious", "defensive"].includes(w)
      )
    )
      aiTags.push("safety");
    if (
      words.some((w) =>
        ["late", "delayed", "slow", "took"].includes(w)
      )
    )
      aiTags.push("punctuality_issue");

    // Rating-based tagging
    if (rating === 5) aiTags.push("exceptional_experience");
    if (rating === 1) aiTags.push("critical_issue");
    if (rating <= 2 && aiTags.includes("safety")) aiTags.push("safety_critical");

    return aiTags;
  }

  private shouldFlagForReview(review: Review): boolean {
    if (review.rating <= 2) return true;
    if (review.sentiment === "very_negative") return true;
    if (this.detectContentFlags(review.comment).length > 0) return true;
    if (review.comment.length > 500 && review.rating === 1) return true;
    return false;
  }

  private detectContentFlags(text: string): string[] {
    const flags: string[] = [];
    const lower = text.toLowerCase();

    if (
      lower.includes("abuse") ||
      lower.includes("harassment") ||
      lower.includes("offensive")
    )
      flags.push("offensive_content");
    if (
      lower.includes("threat") ||
      lower.includes("danger") ||
      lower.includes("unsafe")
    )
      flags.push("safety_concern");
    if (lower.includes("scam") || lower.includes("fraud"))
      flags.push("fraud_allegation");
    if (text.length > 2000) flags.push("excessive_length");
    if ((text.match(/!/g) || []).length > 5) flags.push("excessive_punctuation");

    return flags;
  }

  private updateReputationScore(
    entityId: string,
    entityType: "driver" | "service",
    rating: Rating
  ) {
    let score = this.reputationScores.get(entityId);

    if (!score) {
      score = {
        entityId,
        entityType,
        totalReviews: 0,
        avgRating: 0,
        detailedRatings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        sentimentDistribution: {
          very_positive: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          very_negative: 0,
        },
        trustScore: 50,
        consistencyScore: 100,
        responseRate: 0,
        category: entityType,
        lastUpdated: new Date(),
        badges: [],
      };
    }

    score.detailedRatings[rating]++;
    score.totalReviews++;
    score.avgRating =
      Object.entries(score.detailedRatings).reduce(
        (sum, [ratingValue, count]) => sum + parseInt(ratingValue) * count,
        0
      ) / score.totalReviews;

    // Calculate trust score
    score.trustScore = Math.max(
      20,
      Math.min(100, score.avgRating * 20 + (score.totalReviews > 50 ? 10 : 0))
    );

    // Award badges
    score.badges = [];
    if (score.avgRating >= 4.8) score.badges.push("highly_rated");
    if (score.totalReviews >= 100) score.badges.push("verified");
    if (score.avgRating >= 4.5 && score.totalReviews >= 50)
      score.badges.push("trusted");
    if (score.responseRate >= 80) score.badges.push("responsive");

    score.lastUpdated = new Date();
    this.reputationScores.set(entityId, score);
  }

  approveReview(reviewId: string, moderatorId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;

    review.status = "published";
    review.updatedAt = new Date();

    const moderation = Array.from(this.moderations.values()).find(
      (m) => m.reviewId === reviewId
    );
    if (moderation) {
      moderation.status = "approved";
      moderation.moderatorId = moderatorId;
      moderation.reviewedAt = new Date();
    }

    this.emit("review:approved", review);
    return true;
  }

  rejectReview(
    reviewId: string,
    moderatorId: string,
    reason: string
  ): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;

    review.status = "rejected";
    review.moderationNotes = reason;
    review.updatedAt = new Date();

    const moderation = Array.from(this.moderations.values()).find(
      (m) => m.reviewId === reviewId
    );
    if (moderation) {
      moderation.status = "rejected";
      moderation.moderatorId = moderatorId;
      moderation.reason = reason;
      moderation.reviewedAt = new Date();
    }

    this.emit("review:rejected", review);
    return true;
  }

  respondToReview(
    reviewId: string,
    responderId: string,
    responderName: string,
    responseText: string
  ): FeedbackResponse {
    const response: FeedbackResponse = {
      responseId: `resp_${Date.now()}`,
      reviewId,
      responderId,
      responderName,
      responseText,
      sentiment: this.analyzeSentiment(responseText),
      createdAt: new Date(),
      updatedAt: new Date(),
      helpful: true,
    };

    this.responses.set(response.responseId, response);
    this.emit("response:added", response);
    return response;
  }

  getReputationScore(entityId: string): ReputationScore | undefined {
    return this.reputationScores.get(entityId);
  }

  getReviewInsights(category: FeedbackType, period: "7d" | "30d" | "90d"): ReviewerInsight {
    const daysMs =
      period === "7d" ? 7 * 24 * 60 * 60 * 1000 : period === "30d"
        ? 30 * 24 * 60 * 60 * 1000
        : 90 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - daysMs);

    const categoryReviews = this.reviewHistory.filter(
      (r) => r.createdAt > cutoffDate
    );

    const ratings = categoryReviews.map((r) => r.rating);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    const sentimentBreakdown = {
      very_positive: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      very_negative: 0,
    };

    categoryReviews.forEach((r) => {
      sentimentBreakdown[r.sentiment]++;
    });

    const allTags = categoryReviews.flatMap((r) => r.aiTags);
    const tagCounts = new Map<string, number>();
    allTags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });

    const trend =
      categoryReviews.length < 5
        ? "stable"
        : avgRating > 4
        ? "improving"
        : "declining";

    const insight: ReviewerInsight = {
      insightId: `insight_${Date.now()}`,
      category,
      trend,
      period,
      avgRating,
      totalReviews: categoryReviews.length,
      sentimentBreakdown,
      topPositiveThemes: Array.from(tagCounts.entries())
        .filter(([tag]) => !tag.includes("issue"))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag),
      topNegativeThemes: Array.from(tagCounts.entries())
        .filter(([tag]) => tag.includes("issue"))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag),
      recommendations: this.generateRecommendations(avgRating, trend),
      lastUpdated: new Date(),
    };

    this.insights.set(insight.insightId, insight);
    return insight;
  }

  private generateRecommendations(
    avgRating: number,
    trend: string
  ): string[] {
    const recommendations: string[] = [];

    if (avgRating < 3) {
      recommendations.push("Urgent: Address critical feedback themes immediately");
      recommendations.push("Conduct quality audit for service issues");
      recommendations.push("Escalate low-rating reviews for investigation");
    } else if (avgRating < 4) {
      recommendations.push("Focus on top negative themes");
      recommendations.push("Implement targeted improvement program");
    } else {
      recommendations.push("Maintain current service quality");
      recommendations.push("Share positive feedback with team");
    }

    if (trend === "declining") {
      recommendations.push(
        "Investigate root cause of declining satisfaction"
      );
    }

    return recommendations;
  }

  getReviewsByEntity(
    entityId: string,
    status?: ReviewStatus
  ): Review[] {
    return Array.from(this.reviews.values()).filter((r) => {
      const matchesEntity = r.entityId === entityId;
      const matchesStatus = !status || r.status === status;
      return matchesEntity && matchesStatus;
    });
  }

  getPendingModerations(): ReviewModeration[] {
    return Array.from(this.moderations.values()).filter(
      (m) => m.status === "pending" || m.status === "requires_review"
    );
  }

  markReviewHelpful(reviewId: string, helpful: boolean): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;

    if (helpful) {
      review.helpfulCount++;
    } else {
      review.unhelpfulCount++;
    }

    return true;
  }

  getFeedbackStats() {
    const allReviews = Array.from(this.reviews.values());
    const publishedReviews = allReviews.filter((r) => r.status === "published");
    const pendingModeration = this.getPendingModerations();

    const ratingDistribution: ReviewCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    publishedReviews.forEach((r) => {
      ratingDistribution[r.rating]++;
    });

    const sentimentCounts = {
      very_positive: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      very_negative: 0,
    };

    publishedReviews.forEach((r) => {
      sentimentCounts[r.sentiment]++;
    });

    const avgRating =
      publishedReviews.length > 0
        ? publishedReviews.reduce((sum, r) => sum + r.rating, 0) /
          publishedReviews.length
        : 0;

    const topRatedEntities = Array.from(this.reputationScores.values())
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);

    return {
      totalReviews: allReviews.length,
      publishedReviews: publishedReviews.length,
      pendingModeration: pendingModeration.length,
      avgRating: Math.round(avgRating * 10) / 10,
      ratingDistribution,
      sentimentCounts,
      topRatedEntities,
      responseRate:
        publishedReviews.length > 0
          ? (Array.from(this.responses.values()).length /
            publishedReviews.length) *
          100
          : 0,
    };
  }
}

export const feedbackEngine = new FeedbackEngine();
