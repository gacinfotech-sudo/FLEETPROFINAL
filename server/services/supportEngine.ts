import { EventEmitter } from "events";

export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed" | "escalated";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type IssueCategory = "payment" | "booking" | "driver" | "ride" | "account" | "feature" | "complaint" | "refund" | "safety" | "other";
export type ResolutionType = "resolved" | "workaround_provided" | "feature_request" | "duplicate" | "cannot_help" | "customer_abandoned";

export interface SupportTicket {
  ticketId: string;
  customerId: string;
  category: IssueCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent?: string;
  resolution?: Resolution;
  messages: TicketMessage[];
  relatedTickets?: string[];
  aiSuggestions: AISuggestion[];
  satisfactionScore?: number; // 0-100
  timeToFirstResponse: number; // seconds
  timeToResolution?: number; // seconds
  escalationHistory: Escalation[];
  tags: string[];
}

export interface TicketMessage {
  messageId: string;
  sender: "customer" | "agent" | "system";
  senderName: string;
  content: string;
  attachments?: string[];
  sentAt: Date;
  readAt?: Date;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface AISuggestion {
  suggestionId: string;
  type: "faq_match" | "resolution_template" | "category_recommendation" | "routing_suggestion" | "escalation_trigger";
  content: string;
  confidence: number; // 0-100
  action?: string; // URL or action to take
}

export interface Escalation {
  escalationId: string;
  fromAgent?: string;
  toQueue: string; // "senior_support", "manager", "legal", "engineering"
  reason: string;
  timestamp: Date;
  status: "pending" | "accepted" | "in_progress" | "resolved";
  assignedTo?: string;
}

export interface Resolution {
  resolutionId: string;
  type: ResolutionType;
  description: string;
  resolvedAt: Date;
  resolvedBy: string;
  compensationOffered?: {
    type: "credit" | "refund" | "discount" | "priority";
    amount: number; // ₹ or percentage
  };
}

export interface CustomerSatisfaction {
  surveyId: string;
  ticketId: string;
  score: number; // 0-100
  rating: "very_satisfied" | "satisfied" | "neutral" | "dissatisfied" | "very_dissatisfied";
  comments: string;
  submittedAt: Date;
  actionItems?: string[];
}

export interface FAQ {
  faqId: string;
  category: IssueCategory;
  question: string;
  answer: string;
  keywords: string[];
  helpfulCount: number;
  unhelpfulCount: number;
  resolveRate: number; // percentage
  lastUpdated: Date;
}

export interface AgentPerformance {
  agentId: string;
  name: string;
  status: "online" | "break" | "offline";
  ticketsHandled: number;
  avgResolutionTime: number; // seconds
  avgSatisfactionScore: number; // 0-100
  escalationRate: number; // percentage
  firstContactResolutionRate: number; // percentage
  responseTimeAvg: number; // seconds
  skills: string[];
  lastActiveAt: Date;
}

export interface SupportAnalytics {
  timestamp: Date;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number; // seconds
  avgSatisfactionScore: number; // 0-100
  firstContactResolutionRate: number; // percentage
  escalationRate: number; // percentage
  topIssueCategories: { category: IssueCategory; count: number }[];
  agentUtilization: number; // percentage
  customerSentiment: { positive: number; neutral: number; negative: number };
  peakHours: { hour: number; ticketCount: number }[];
}

class SupportEngine extends EventEmitter {
  private tickets: Map<string, SupportTicket> = new Map();
  private faqs: Map<string, FAQ> = new Map();
  private agents: Map<string, AgentPerformance> = new Map();
  private satisfactionSurveys: Map<string, CustomerSatisfaction> = new Map();
  private ticketHistory: SupportTicket[] = [];

  constructor() {
    super();
    this.setupFAQs();
    this.setupAgents();
  }

  private setupFAQs() {
    const faqs: FAQ[] = [
      {
        faqId: "faq_1",
        category: "payment",
        question: "Why was I charged twice for the same ride?",
        answer:
          "Double charges can occur due to payment processing delays. Please wait 24-48 hours for your bank to process. If the charge persists, contact support with your transaction ID.",
        keywords: ["double charge", "payment", "refund", "twice"],
        helpfulCount: 245,
        unhelpfulCount: 12,
        resolveRate: 92,
        lastUpdated: new Date(),
      },
      {
        faqId: "faq_2",
        category: "booking",
        question: "How do I cancel a booking?",
        answer:
          "Open the app, go to Active Rides, tap the ride you want to cancel, and select Cancel Ride. Cancellation charges may apply based on the time.",
        keywords: ["cancel", "booking", "ride", "cancellation"],
        helpfulCount: 512,
        unhelpfulCount: 8,
        resolveRate: 98,
        lastUpdated: new Date(),
      },
      {
        faqId: "faq_3",
        category: "refund",
        question: "What is your refund policy?",
        answer:
          "Rides cancelled within 2 minutes of booking get full refunds. After 2 minutes, a cancellation fee applies. Refunds are processed within 5-7 business days.",
        keywords: ["refund", "policy", "cancellation", "money back"],
        helpfulCount: 389,
        unhelpfulCount: 15,
        resolveRate: 85,
        lastUpdated: new Date(),
      },
      {
        faqId: "faq_4",
        category: "driver",
        question: "Why was the driver cancelled my ride?",
        answer:
          "Drivers may cancel due to technical issues, personal emergencies, or pickup location concerns. You'll receive a notification with the reason and a full refund.",
        keywords: ["driver", "cancelled", "cancel", "why"],
        helpfulCount: 178,
        unhelpfulCount: 45,
        resolveRate: 72,
        lastUpdated: new Date(),
      },
      {
        faqId: "faq_5",
        category: "safety",
        question: "How do I report an unsafe driver?",
        answer:
          "After the ride ends, go to Ride Details and select Report. Choose Safety Concern and describe the incident. Our team will investigate within 24 hours.",
        keywords: ["safety", "unsafe", "driver", "report", "concern"],
        helpfulCount: 267,
        unhelpfulCount: 18,
        resolveRate: 89,
        lastUpdated: new Date(),
      },
    ];

    faqs.forEach((faq) => {
      this.faqs.set(faq.faqId, faq);
    });
  }

  private setupAgents() {
    const agents: AgentPerformance[] = [
      {
        agentId: "agent_001",
        name: "Priya Singh",
        status: "online",
        ticketsHandled: 285,
        avgResolutionTime: 480,
        avgSatisfactionScore: 4.6,
        escalationRate: 8,
        firstContactResolutionRate: 82,
        responseTimeAvg: 45,
        skills: ["payment", "booking", "refund"],
        lastActiveAt: new Date(),
      },
      {
        agentId: "agent_002",
        name: "Rajesh Kumar",
        status: "online",
        ticketsHandled: 312,
        avgResolutionTime: 520,
        avgSatisfactionScore: 4.4,
        escalationRate: 12,
        firstContactResolutionRate: 78,
        responseTimeAvg: 52,
        skills: ["driver", "safety", "account"],
        lastActiveAt: new Date(),
      },
      {
        agentId: "agent_003",
        name: "Neha Verma",
        status: "break",
        ticketsHandled: 198,
        avgResolutionTime: 445,
        avgSatisfactionScore: 4.7,
        escalationRate: 6,
        firstContactResolutionRate: 86,
        responseTimeAvg: 38,
        skills: ["feature", "complaint", "payment"],
        lastActiveAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ];

    agents.forEach((agent) => {
      this.agents.set(agent.agentId, agent);
    });
  }

  createTicket(
    customerId: string,
    category: IssueCategory,
    subject: string,
    description: string
  ): SupportTicket {
    const ticket: SupportTicket = {
      ticketId: `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId,
      category,
      subject,
      description,
      priority: this.determinePriority(category, description),
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          messageId: `msg_${Date.now()}`,
          sender: "system",
          senderName: "Support System",
          content: `Thank you for contacting us. Your ticket #${this.formatTicketId()} has been created. We'll get back to you shortly.`,
          sentAt: new Date(),
        },
      ],
      aiSuggestions: this.generateSuggestions(category, description),
      escalationHistory: [],
      tags: this.extractTags(description),
      timeToFirstResponse: 0,
    };

    this.tickets.set(ticket.ticketId, ticket);
    this.ticketHistory.push(ticket);

    // Auto-assign based on category and agent availability
    const agent = this.findBestAgent(category);
    if (agent) {
      ticket.assignedAgent = agent.agentId;
      ticket.status = "in_progress";
    }

    this.emit("ticket:created", ticket);
    return ticket;
  }

  private determinePriority(
    category: IssueCategory,
    description: string
  ): TicketPriority {
    if (
      category === "safety" ||
      description.toLowerCase().includes("unsafe")
    ) {
      return "critical";
    }
    if (category === "payment" || category === "refund") {
      return "high";
    }
    if (category === "complaint" || description.toLowerCase().includes("urgent")) {
      return "high";
    }
    return "medium";
  }

  private generateSuggestions(
    category: IssueCategory,
    description: string
  ): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    // Find matching FAQs
    const matchingFAQs = Array.from(this.faqs.values()).filter((faq) =>
      faq.keywords.some((kw) =>
        description.toLowerCase().includes(kw.toLowerCase())
      )
    );

    matchingFAQs.slice(0, 2).forEach((faq) => {
      suggestions.push({
        suggestionId: `sugg_${Date.now()}`,
        type: "faq_match",
        content: faq.question,
        confidence: 85 + Math.random() * 10,
        action: faq.faqId,
      });
    });

    // Category recommendation
    if (description.length < 50) {
      suggestions.push({
        suggestionId: `sugg_${Date.now()}_cat`,
        type: "category_recommendation",
        content: `This issue might be better categorized as "${this.suggestCategory(description)}"`,
        confidence: 72,
      });
    }

    // Resolution template
    suggestions.push({
      suggestionId: `sugg_${Date.now()}_res`,
      type: "resolution_template",
      content: "Send standard resolution email and offer ₹100 credit",
      confidence: 68,
    });

    // Escalation trigger
    if (category === "safety") {
      suggestions.push({
        suggestionId: `sugg_${Date.now()}_esc`,
        type: "escalation_trigger",
        content: "Escalate to Safety Team immediately",
        confidence: 95,
      });
    }

    return suggestions;
  }

  private suggestCategory(description: string): IssueCategory {
    const lower = description.toLowerCase();
    if (lower.includes("driver")) return "driver";
    if (lower.includes("payment") || lower.includes("charge")) return "payment";
    if (lower.includes("refund")) return "refund";
    if (lower.includes("booking")) return "booking";
    return "other";
  }

  private extractTags(description: string): string[] {
    const tags: string[] = [];
    if (description.toLowerCase().includes("urgent")) tags.push("urgent");
    if (description.toLowerCase().includes("new user")) tags.push("new_user");
    if (description.toLowerCase().includes("repeat")) tags.push("repeat_issue");
    return tags;
  }

  private findBestAgent(category: IssueCategory): AgentPerformance | null {
    const availableAgents = Array.from(this.agents.values()).filter(
      (a) => a.status === "online" && a.skills.includes(category)
    );

    if (availableAgents.length === 0) {
      return Array.from(this.agents.values()).find((a) => a.status === "online") || null;
    }

    // Return agent with lowest current load
    return availableAgents.sort(
      (a, b) => a.avgResolutionTime - b.avgResolutionTime
    )[0];
  }

  private formatTicketId(): string {
    return `${Date.now()}`.slice(-6);
  }

  addMessage(
    ticketId: string,
    sender: "customer" | "agent" | "system",
    senderName: string,
    content: string
  ): boolean {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return false;

    const message: TicketMessage = {
      messageId: `msg_${Date.now()}`,
      sender,
      senderName,
      content,
      sentAt: new Date(),
      sentiment: this.analyzeSentiment(content),
    };

    ticket.messages.push(message);
    ticket.updatedAt = new Date();

    if (sender === "agent" && ticket.timeToFirstResponse === 0) {
      ticket.timeToFirstResponse =
        new Date().getTime() - ticket.createdAt.getTime();
    }

    this.emit("message:added", { ticketId, message });
    return true;
  }

  private analyzeSentiment(text: string): "positive" | "neutral" | "negative" {
    const positiveWords = [
      "thank",
      "happy",
      "great",
      "excellent",
      "good",
      "perfect",
    ];
    const negativeWords = [
      "angry",
      "frustrated",
      "bad",
      "terrible",
      "awful",
      "upset",
      "disappointing",
    ];

    const lower = text.toLowerCase();
    const positiveCount = positiveWords.filter((w) =>
      lower.includes(w)
    ).length;
    const negativeCount = negativeWords.filter((w) =>
      lower.includes(w)
    ).length;

    if (negativeCount > positiveCount) return "negative";
    if (positiveCount > negativeCount) return "positive";
    return "neutral";
  }

  resolveTicket(
    ticketId: string,
    resolutionType: ResolutionType,
    description: string,
    resolvedBy: string,
    compensation?: { type: string; amount: number }
  ): boolean {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return false;

    ticket.resolution = {
      resolutionId: `res_${Date.now()}`,
      type: resolutionType,
      description,
      resolvedAt: new Date(),
      resolvedBy,
      compensationOffered: compensation as any,
    };

    ticket.status = "resolved";
    ticket.timeToResolution =
      new Date().getTime() - ticket.createdAt.getTime();

    this.emit("ticket:resolved", ticket);
    return true;
  }

  escalateTicket(
    ticketId: string,
    toQueue: string,
    reason: string,
    fromAgent?: string
  ): boolean {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return false;

    const escalation: Escalation = {
      escalationId: `esc_${Date.now()}`,
      fromAgent,
      toQueue,
      reason,
      timestamp: new Date(),
      status: "pending",
    };

    ticket.escalationHistory.push(escalation);
    ticket.status = "escalated";

    this.emit("ticket:escalated", { ticketId, escalation });
    return true;
  }

  recordSatisfaction(
    ticketId: string,
    score: number,
    comments: string
  ): boolean {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return false;

    const rating =
      score >= 80 ? "very_satisfied" : score >= 60 ? "satisfied" : score >= 40 ? "neutral" : score >= 20 ? "dissatisfied" : "very_dissatisfied";

    const survey: CustomerSatisfaction = {
      surveyId: `survey_${Date.now()}`,
      ticketId,
      score,
      rating,
      comments,
      submittedAt: new Date(),
    };

    this.satisfactionSurveys.set(survey.surveyId, survey);
    ticket.satisfactionScore = score;

    this.emit("satisfaction:recorded", survey);
    return true;
  }

  getSupportAnalytics(): SupportAnalytics {
    const allTickets = Array.from(this.tickets.values());
    const resolvedTickets = allTickets.filter(
      (t) => t.status === "resolved" || t.status === "closed"
    );

    const avgResolutionTime =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => sum + (t.timeToResolution || 0), 0) /
          resolvedTickets.length
        : 0;

    const surveys = Array.from(this.satisfactionSurveys.values());
    const avgSatisfaction =
      surveys.length > 0
        ? surveys.reduce((sum, s) => sum + s.score, 0) / surveys.length
        : 0;

    const firstContactResolved = resolvedTickets.filter(
      (t) => t.escalationHistory.length === 0
    ).length;
    const fcrRate =
      resolvedTickets.length > 0
        ? (firstContactResolved / resolvedTickets.length) * 100
        : 0;

    const escalatedCount = allTickets.filter(
      (t) => t.escalationHistory.length > 0
    ).length;
    const escalationRate = allTickets.length > 0 ? (escalatedCount / allTickets.length) * 100 : 0;

    const categoryBreakdown: { category: IssueCategory; count: number }[] = [];
    const categoryMap = new Map<IssueCategory, number>();
    allTickets.forEach((t) => {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1);
    });
    categoryMap.forEach((count, category) => {
      categoryBreakdown.push({ category, count });
    });

    const sentimentAnalysis = { positive: 0, neutral: 0, negative: 0 };
    allTickets.forEach((t) => {
      t.messages.forEach((m) => {
        if (m.sentiment === "positive") sentimentAnalysis.positive++;
        else if (m.sentiment === "negative") sentimentAnalysis.negative++;
        else sentimentAnalysis.neutral++;
      });
    });

    return {
      timestamp: new Date(),
      totalTickets: allTickets.length,
      openTickets: allTickets.filter((t) => t.status === "open").length,
      resolvedTickets: resolvedTickets.length,
      avgResolutionTime: Math.round(avgResolutionTime / 1000 / 60), // Convert to minutes
      avgSatisfactionScore: Math.round(avgSatisfaction * 10) / 10,
      firstContactResolutionRate: Math.round(fcrRate),
      escalationRate: Math.round(escalationRate),
      topIssueCategories: categoryBreakdown
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      agentUtilization: Math.min(
        100,
        (allTickets.filter((t) => t.status === "in_progress").length /
          this.agents.size) *
          100
      ),
      customerSentiment: sentimentAnalysis,
      peakHours: this.getPeakHours(allTickets),
    };
  }

  private getPeakHours(
    tickets: SupportTicket[]
  ): { hour: number; ticketCount: number }[] {
    const hourMap = new Map<number, number>();
    tickets.forEach((t) => {
      const hour = t.createdAt.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    const peakHours: { hour: number; ticketCount: number }[] = [];
    hourMap.forEach((count, hour) => {
      peakHours.push({ hour, ticketCount: count });
    });

    return peakHours.sort((a, b) => b.ticketCount - a.ticketCount).slice(0, 5);
  }

  getAgentStats(): AgentPerformance[] {
    return Array.from(this.agents.values());
  }

  getTicket(ticketId: string): SupportTicket | undefined {
    return this.tickets.get(ticketId);
  }

  getTicketsByCustomer(customerId: string): SupportTicket[] {
    return Array.from(this.tickets.values()).filter((t) => t.customerId === customerId);
  }

  getFAQs(category?: IssueCategory): FAQ[] {
    const allFAQs = Array.from(this.faqs.values());
    if (category) {
      return allFAQs.filter((f) => f.category === category);
    }
    return allFAQs;
  }
}

export const supportEngine = new SupportEngine();
