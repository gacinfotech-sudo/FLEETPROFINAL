/**
 * AUTOMATED SUPPORT SERVICE
 * FAQ matching, ticket categorization, and smart escalation rules
 */

import mongoose from 'mongoose';

export class AutomatedSupportService {
  /**
   * Match ticket to relevant FAQ articles
   */
  static async matchFAQ(ticketDescription: string, tenantId: string, topK: number = 3): Promise<any[]> {
    try {
      const Article = mongoose.model('KnowledgeBaseArticle');

      // Simple keyword matching (production would use semantic search)
      const keywords = ticketDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3);

      const relevantArticles = await Article.find({
        tenantId,
        status: 'published',
        $or: [
          { title: { $regex: keywords.join('|'), $options: 'i' } },
          { content: { $regex: keywords.join('|'), $options: 'i' } },
          { tags: { $in: keywords } },
        ],
      })
        .sort({ viewCount: -1 })
        .limit(topK);

      return relevantArticles.map(a => a.toObject());
    } catch (error) {
      console.error('Error matching FAQ:', error);
      return [];
    }
  }

  /**
   * Auto-categorize ticket based on content
   */
  static async categorizTicket(ticketSubject: string, ticketDescription: string): Promise<string> {
    const combined = `${ticketSubject} ${ticketDescription}`.toLowerCase();

    const categories: { [key: string]: string[] } = {
      billing: ['payment', 'invoice', 'charge', 'refund', 'price', 'cost', 'billing', 'subscription'],
      technical: ['error', 'bug', 'broken', 'crash', 'slow', 'connection', 'technical', 'issue', 'not working'],
      account: ['login', 'password', 'email', 'profile', 'account', 'reset', 'access', 'user'],
      general: ['question', 'how', 'can i', 'information', 'general'],
      feedback: ['feedback', 'suggestion', 'improve', 'feature', 'request'],
      complaint: ['complaint', 'bad', 'terrible', 'poor', 'disappointed', 'angry', 'upset'],
    };

    let bestCategory = 'general';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categories)) {
      const score = keywords.filter(kw => combined.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  /**
   * Determine ticket priority based on sentiment and content
   */
  static async determinePriority(
    description: string,
    sentiment: string,
    category: string
  ): Promise<'critical' | 'high' | 'medium' | 'low'> {
    const urgentKeywords = ['urgent', 'critical', 'asap', 'emergency', 'down', 'broken', 'crash'];
    const negativeKeywords = ['angry', 'disappointed', 'terrible', 'worst', 'unacceptable'];

    const descLower = description.toLowerCase();
    const isUrgent = urgentKeywords.some(kw => descLower.includes(kw));
    const isNegative = negativeKeywords.some(kw => descLower.includes(kw));

    if (isUrgent || (category === 'technical' && isNegative)) return 'critical';
    if ((category === 'billing' && isNegative) || (sentiment === 'negative' && isUrgent)) return 'high';
    if (sentiment === 'negative' || category === 'complaint') return 'medium';
    return 'low';
  }

  /**
   * Detect and mark duplicate tickets
   */
  static async detectDuplicates(tenantId: string, ticketDescription: string, threshold: number = 0.85): Promise<string[]> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const recentTickets = await Ticket.find({
        tenantId,
        createdAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      }).select('ticketId description subject');

      const keywords = ticketDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const duplicates: string[] = [];

      recentTickets.forEach(ticket => {
        const ticketText = `${ticket.subject} ${ticket.description}`.toLowerCase();
        const matchingKeywords = keywords.filter(kw => ticketText.includes(kw)).length;
        const similarity = matchingKeywords / keywords.length;

        if (similarity > threshold) {
          duplicates.push(ticket.ticketId);
        }
      });

      return duplicates;
    } catch (error) {
      console.error('Error detecting duplicates:', error);
      return [];
    }
  }

  /**
   * Detect spam/abuse tickets
   */
  static async detectSpam(ticketDescription: string): Promise<boolean> {
    const spamIndicators = [
      /viagra|cialis|casino|lottery|prize/gi,
      /click here|buy now|limited time/gi,
      /urgent action required|verify account/gi,
      /confirm password|update payment/gi,
    ];

    return spamIndicators.some(pattern => pattern.test(ticketDescription));
  }

  /**
   * Auto-escalate aging tickets
   */
  static async autoEscalateAgingTickets(tenantId: string, ageHoursThreshold: number = 24): Promise<number> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const cutoffTime = new Date(Date.now() - ageHoursThreshold * 60 * 60 * 1000);

      const result = await Ticket.updateMany(
        {
          tenantId,
          status: { $in: ['open', 'in_progress'] },
          createdAt: { $lt: cutoffTime },
          priority: { $nin: ['critical', 'high'] },
        },
        {
          $set: { priority: 'high' },
          updatedAt: new Date(),
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Error escalating aging tickets:', error);
      throw new Error('Failed to escalate aging tickets');
    }
  }

  /**
   * Suggest resolution based on similar resolved tickets
   */
  static async suggestResolution(tenantId: string, category: string, topK: number = 3): Promise<string[]> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const recentResolutions = await Ticket.find({
        tenantId,
        category,
        status: 'resolved',
        resolutionNotes: { $exists: true, $ne: '' },
      })
        .select('resolutionNotes')
        .sort({ resolvedAt: -1 })
        .limit(topK);

      return recentResolutions.map(t => t.resolutionNotes || '').filter(text => text.length > 0);
    } catch (error) {
      console.error('Error suggesting resolutions:', error);
      return [];
    }
  }

  /**
   * Auto-close resolved tickets after set period
   */
  static async autoCloseTenacious(tenantId: string, daysBeforeClose: number = 7): Promise<number> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBeforeClose);

      const result = await Ticket.updateMany(
        {
          tenantId,
          status: 'resolved',
          resolvedAt: { $lt: cutoffDate },
          updatedAt: { $lt: cutoffDate },
        },
        {
          $set: { status: 'closed', updatedAt: new Date() },
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Error auto-closing tickets:', error);
      throw new Error('Failed to auto-close tickets');
    }
  }

  /**
   * Route ticket to specialist based on skills
   */
  static async routeToSpecialist(tenantId: string, category: string, priority: string): Promise<string | null> {
    try {
      const Agent = mongoose.model('SupportAgent');

      // Find agent with matching skills who has capacity
      const agent = await Agent.findOne({
        tenantId,
        skills: { $in: [category] },
        status: 'available',
      }).sort({ ticketsHandled: 1 });

      return agent ? agent.agentId : null;
    } catch (error) {
      console.error('Error routing to specialist:', error);
      return null;
    }
  }

  /**
   * Generate common issue report
   */
  static async generateCommonIssueReport(tenantId: string, limit: number = 5): Promise<{
    issue: string;
    count: number;
    suggestedFAQ?: string;
  }[]> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const issues = await Ticket.aggregate([
        {
          $match: { tenantId: new mongoose.Types.ObjectId(tenantId as string) },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);

      return issues.map(issue => ({
        issue: issue._id,
        count: issue.count,
        suggestedFAQ: undefined,
      }));
    } catch (error) {
      console.error('Error generating issue report:', error);
      throw new Error('Failed to generate issue report');
    }
  }
}
