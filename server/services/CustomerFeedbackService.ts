/**
 * CUSTOMER FEEDBACK SERVICE
 * CSAT, NPS tracking, and feedback analytics
 */

import mongoose from 'mongoose';

export interface IFeedback {
  tenantId: string | mongoose.Types.ObjectId;
  feedbackId: string;
  ticketId?: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail?: string;
  feedbackType: 'csat' | 'nps' | 'general';
  score: number; // 1-5 for CSAT, 0-10 for NPS
  category?: string;
  comment: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  tags: string[];
  followUpRequired: boolean;
  createdAt: Date;
}

const FeedbackSchema = new mongoose.Schema<IFeedback>({
  tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  feedbackId: { type: String, required: true, unique: true },
  ticketId: { type: String },
  customerId: { type: mongoose.Schema.Types.ObjectId },
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  feedbackType: { type: String, enum: ['csat', 'nps', 'general'], required: true },
  score: { type: Number, required: true, min: 0, max: 10 },
  category: { type: String },
  comment: { type: String, required: true },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
  tags: { type: [String], default: [] },
  followUpRequired: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
});

FeedbackSchema.index({ tenantId: 1, feedbackType: 1 });
FeedbackSchema.index({ tenantId: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>('CustomerFeedback', FeedbackSchema);

export class CustomerFeedbackService {
  /**
   * Collect CSAT feedback (post-ticket)
   */
  static async collectCSAT(input: Omit<IFeedback, 'createdAt' | 'feedbackId' | 'feedbackType' | 'sentiment'>): Promise<IFeedback> {
    try {
      const feedbackId = `FDB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sentiment = this.analyzeSentiment(input.comment);

      const feedback = new Feedback({
        ...input,
        feedbackId,
        feedbackType: 'csat',
        sentiment,
      });
      await feedback.save();
      return feedback.toObject();
    } catch (error) {
      console.error('Error collecting CSAT:', error);
      throw new Error('Failed to collect CSAT feedback');
    }
  }

  /**
   * Collect NPS feedback
   */
  static async collectNPS(input: Omit<IFeedback, 'createdAt' | 'feedbackId' | 'feedbackType' | 'sentiment'>): Promise<IFeedback> {
    try {
      const feedbackId = `NPS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sentiment = this.analyzeSentiment(input.comment);

      const feedback = new Feedback({
        ...input,
        feedbackId,
        feedbackType: 'nps',
        sentiment,
      });
      await feedback.save();
      return feedback.toObject();
    } catch (error) {
      console.error('Error collecting NPS:', error);
      throw new Error('Failed to collect NPS feedback');
    }
  }

  /**
   * Get CSAT score trends
   */
  static async getCSATTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: Date; averageScore: number; count: number }[]> {
    try {
      const trends = await Feedback.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId as string),
            feedbackType: 'csat',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            averageScore: { $avg: '$score' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return trends.map(t => ({
        date: new Date(t._id),
        averageScore: Math.round(t.averageScore * 100) / 100,
        count: t.count,
      }));
    } catch (error) {
      console.error('Error fetching CSAT trends:', error);
      throw new Error('Failed to fetch CSAT trends');
    }
  }

  /**
   * Get NPS distribution
   */
  static async getNPSDistribution(tenantId: string): Promise<{
    promoters: number;
    passives: number;
    detractors: number;
    nps: number;
  }> {
    try {
      const feedbacks = await Feedback.find({
        tenantId,
        feedbackType: 'nps',
      });

      const promoters = feedbacks.filter(f => f.score >= 9).length;
      const detractors = feedbacks.filter(f => f.score <= 6).length;
      const passives = feedbacks.filter(f => f.score > 6 && f.score < 9).length;

      const total = feedbacks.length;
      const nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0;

      return {
        promoters,
        passives,
        detractors,
        nps: Math.round(nps),
      };
    } catch (error) {
      console.error('Error calculating NPS distribution:', error);
      throw new Error('Failed to calculate NPS distribution');
    }
  }

  /**
   * Get feedback requiring follow-up
   */
  static async getPendingFollowUps(tenantId: string): Promise<IFeedback[]> {
    try {
      const feedbacks = await Feedback.find({
        tenantId,
        followUpRequired: true,
      }).sort({ createdAt: -1 });

      return feedbacks.map(f => f.toObject());
    } catch (error) {
      console.error('Error fetching pending follow-ups:', error);
      throw new Error('Failed to fetch pending follow-ups');
    }
  }

  /**
   * Mark feedback as addressed
   */
  static async markAsAddressed(feedbackId: string): Promise<IFeedback | null> {
    try {
      const updated = await Feedback.findOneAndUpdate(
        { feedbackId },
        { followUpRequired: false },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error marking feedback as addressed:', error);
      throw new Error('Failed to mark feedback as addressed');
    }
  }

  /**
   * Get feedback summary
   */
  static async getFeedbackSummary(tenantId: string, days: number = 30): Promise<{
    totalFeedback: number;
    averageCSAT: number;
    averageNPS: number;
    positiveCount: number;
    negativeCount: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const feedbacks = await Feedback.find({
        tenantId,
        createdAt: { $gte: startDate },
      });

      const csatFeedbacks = feedbacks.filter(f => f.feedbackType === 'csat');
      const npsFeedbacks = feedbacks.filter(f => f.feedbackType === 'nps');

      const averageCSAT = csatFeedbacks.length > 0
        ? Math.round((csatFeedbacks.reduce((sum, f) => sum + f.score, 0) / csatFeedbacks.length) * 100) / 100
        : 0;

      const averageNPS = npsFeedbacks.length > 0
        ? Math.round((npsFeedbacks.reduce((sum, f) => sum + f.score, 0) / npsFeedbacks.length) * 100) / 100
        : 0;

      const positiveCount = feedbacks.filter(f => f.sentiment === 'positive').length;
      const negativeCount = feedbacks.filter(f => f.sentiment === 'negative').length;

      return {
        totalFeedback: feedbacks.length,
        averageCSAT,
        averageNPS,
        positiveCount,
        negativeCount,
      };
    } catch (error) {
      console.error('Error fetching feedback summary:', error);
      throw new Error('Failed to fetch feedback summary');
    }
  }

  /**
   * Analyze sentiment
   */
  private static analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveKeywords = ['good', 'excellent', 'great', 'thank', 'appreciate', 'solved', 'fixed', 'happy', 'satisfied'];
    const negativeKeywords = ['bad', 'terrible', 'hate', 'broken', 'problem', 'issue', 'angry', 'frustrated', 'disappointed'];

    const lowerText = text.toLowerCase();
    let posCount = 0;
    let negCount = 0;

    positiveKeywords.forEach(kw => {
      if (lowerText.includes(kw)) posCount++;
    });

    negativeKeywords.forEach(kw => {
      if (lowerText.includes(kw)) negCount++;
    });

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }
}
