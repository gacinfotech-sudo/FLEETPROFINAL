import { EventEmitter } from "events";

export type CampaignType = "retention" | "engagement" | "upsell" | "reactivation" | "loyalty" | "referral";
export type CampaignStatus = "draft" | "scheduled" | "active" | "completed" | "paused" | "cancelled";
export type CampaignChannel = "email" | "sms" | "push" | "in_app" | "all";

export interface Campaign {
  id: string;
  type: CampaignType;
  name: string;
  description: string;
  status: CampaignStatus;
  channels: CampaignChannel[];
  targetSegments: string[]; // vip, regular, casual, dormant, at_risk
  targetCustomers: string[];
  budget: number;
  spent: number;
  startDate: Date;
  endDate: Date;
  template: CampaignTemplate;
  performance: CampaignPerformance;
  createdAt: Date;
  createdBy: string;
}

export interface CampaignTemplate {
  subject: string;
  preheader?: string;
  title: string;
  body: string;
  callToAction: string;
  ctaLink: string;
  incentive: {
    type: "discount" | "credit" | "points" | "free_upgrade";
    value: number;
    label: string;
  };
  imageUrl?: string;
}

export interface CampaignPerformance {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  roi: number;
  createdAt: Date;
}

export interface AutomatedCampaignTrigger {
  id: string;
  trigger: "churn_risk" | "inactive" | "anniversary" | "frequency_milestone" | "rating_low" | "birthday";
  condition: Record<string, any>;
  campaignId: string;
  active: boolean;
}

class CampaignOrchestrationEngine extends EventEmitter {
  private campaigns: Map<string, Campaign> = new Map();
  private triggers: Map<string, AutomatedCampaignTrigger> = new Map();
  private sentCampaigns: Map<string, Set<string>> = new Map(); // campaignId -> sentCustomerIds

  constructor() {
    super();
    this.setupAutomatedTriggers();
  }

  private setupAutomatedTriggers() {
    // Auto-triggers for different scenarios
    const triggers: AutomatedCampaignTrigger[] = [
      {
        id: "churn-risk-trigger",
        trigger: "churn_risk",
        condition: { churnRiskThreshold: 70 },
        campaignId: "",
        active: true,
      },
      {
        id: "inactive-trigger",
        trigger: "inactive",
        condition: { daysSinceLastBooking: 30 },
        campaignId: "",
        active: true,
      },
      {
        id: "frequency-milestone-trigger",
        trigger: "frequency_milestone",
        condition: { bookingCount: 10 },
        campaignId: "",
        active: true,
      },
    ];

    triggers.forEach((trigger) => {
      this.triggers.set(trigger.id, trigger);
    });
  }

  createCampaign(campaignData: any): Campaign {
    const campaign: Campaign = {
      id: `campaign_${Date.now()}`,
      type: campaignData.type,
      name: campaignData.name,
      description: campaignData.description,
      status: "draft",
      channels: campaignData.channels || ["all"],
      targetSegments: campaignData.targetSegments || [],
      targetCustomers: campaignData.targetCustomers || [],
      budget: campaignData.budget || 10000,
      spent: 0,
      startDate: campaignData.startDate || new Date(),
      endDate: campaignData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      template: campaignData.template,
      performance: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
        revenue: 0,
        openRate: 0,
        clickRate: 0,
        conversionRate: 0,
        roi: 0,
        createdAt: new Date(),
      },
      createdAt: new Date(),
      createdBy: campaignData.createdBy,
    };

    this.campaigns.set(campaign.id, campaign);
    this.sentCampaigns.set(campaign.id, new Set());

    this.emit("campaign:created", campaign);
    return campaign;
  }

  launchCampaign(campaignId: string): Campaign | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    campaign.status = "active";
    campaign.startDate = new Date();

    this.emit("campaign:launched", campaign);
    return campaign;
  }

  recordCampaignEvent(
    campaignId: string,
    customerId: string,
    eventType: "sent" | "delivered" | "opened" | "clicked" | "converted",
    data?: any
  ): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return;

    const perf = campaign.performance;

    if (eventType === "sent") {
      perf.sent++;
      this.sentCampaigns.get(campaignId)?.add(customerId);
    } else if (eventType === "delivered") {
      perf.delivered++;
    } else if (eventType === "opened") {
      perf.opened++;
    } else if (eventType === "clicked") {
      perf.clicked++;
    } else if (eventType === "converted") {
      perf.converted++;
      if (data?.revenue) {
        perf.revenue += data.revenue;
      }
    }

    // Recalculate rates
    if (perf.sent > 0) {
      perf.openRate = (perf.opened / perf.sent) * 100;
      perf.clickRate = (perf.clicked / perf.sent) * 100;
      perf.conversionRate = (perf.converted / perf.sent) * 100;

      if (campaign.spent > 0) {
        perf.roi = ((perf.revenue - campaign.spent) / campaign.spent) * 100;
      }
    }

    this.emit("campaign:event", {
      campaignId,
      customerId,
      eventType,
      performance: perf,
    });
  }

  generateOptimalSchedule(
    campaignId: string,
    customerIds: string[]
  ): Map<string, Date> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return new Map();

    const schedule = new Map<string, Date>();

    // Distribute sends over campaign duration
    const durationMs = campaign.endDate.getTime() - campaign.startDate.getTime();
    const sendIntervalMs = durationMs / Math.max(customerIds.length, 1);

    customerIds.forEach((customerId, index) => {
      const sendTime = new Date(
        campaign.startDate.getTime() + sendIntervalMs * index
      );
      schedule.set(customerId, sendTime);
    });

    return schedule;
  }

  calculateOptimalContent(
    campaignType: CampaignType,
    targetSegment: string
  ): Partial<CampaignTemplate> {
    const contentLibrary: Record<string, Record<string, Partial<CampaignTemplate>>> = {
      retention: {
        at_risk: {
          subject: "We miss you! Come back for 50% off your next ride",
          title: "Your Premium Offer Awaits",
          body: "You've been a valued member of our community. We'd love to see you again!",
          callToAction: "Claim Your Offer",
          incentive: {
            type: "discount",
            value: 50,
            label: "50% off next booking",
          },
        },
        dormant: {
          subject: "Special comeback offer just for you",
          title: "Come Back & Save Big",
          body: "Things have improved since you were last here. Check out our new features!",
          callToAction: "Book Now",
          incentive: {
            type: "credit",
            value: 500,
            label: "₹500 credit",
          },
        },
      },
      engagement: {
        casual: {
          subject: "Become a regular and unlock exclusive rewards",
          title: "Join Our Loyalty Program",
          body: "Book 3 times this month and earn rewards for life!",
          callToAction: "Start Earning",
          incentive: {
            type: "points",
            value: 300,
            label: "300 loyalty points",
          },
        },
      },
      upsell: {
        regular: {
          subject: "Upgrade your experience with premium rides",
          title: "Premium Rides Now Available",
          body: "Enjoy premium vehicles with 30% discount for loyal customers",
          callToAction: "Explore Premium",
          incentive: {
            type: "discount",
            value: 30,
            label: "30% off premium rides",
          },
        },
      },
      referral: {
        vip: {
          subject: "Refer friends and earn ₹500 per referral",
          title: "Your Referral Rewards Program",
          body: "Share the love and earn rewards when your friends join!",
          callToAction: "Start Referring",
          incentive: {
            type: "credit",
            value: 500,
            label: "₹500 per referral",
          },
        },
      },
      reactivation: {
        dormant: {
          subject: "Fresh reasons to ride: Check what's new!",
          title: "New Features You'll Love",
          body: "We've added amazing new features since you were here last",
          callToAction: "See What's New",
          incentive: {
            type: "free_upgrade",
            value: 1,
            label: "Free premium upgrade",
          },
        },
      },
      loyalty: {
        vip: {
          subject: "VIP Exclusive: Your Platinum Status Benefits",
          title: "Welcome to Our Elite Circle",
          body: "Enjoy exclusive perks, priority support, and special events",
          callToAction: "Claim Benefits",
          incentive: {
            type: "discount",
            value: 20,
            label: "20% all rides + perks",
          },
        },
      },
    };

    return contentLibrary[campaignType]?.[targetSegment] || {};
  }

  generateCampaignInsights(campaignId: string): {
    performanceScore: number;
    topPerformer: string;
    bottleneck: string;
    recommendation: string;
  } | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    const perf = campaign.performance;

    // Calculate performance score (0-100)
    const deliveryScore = (perf.delivered / Math.max(perf.sent, 1)) * 20;
    const engagementScore = (perf.openRate / 100) * 20;
    const clickScore = (perf.clickRate / 100) * 20;
    const conversionScore = (perf.conversionRate / 100) * 20;
    const roiScore = Math.min(100, (perf.roi / 100) * 20);

    const performanceScore = deliveryScore + engagementScore + clickScore + conversionScore + roiScore;

    // Identify top performer
    let topPerformer = "Delivery";
    let maxScore = deliveryScore;
    if (engagementScore > maxScore) {
      topPerformer = "Open Rate";
      maxScore = engagementScore;
    }
    if (clickScore > maxScore) {
      topPerformer = "Click Rate";
      maxScore = clickScore;
    }
    if (conversionScore > maxScore) {
      topPerformer = "Conversion";
      maxScore = conversionScore;
    }

    // Identify bottleneck
    let bottleneck = "Conversions";
    let minScore = conversionScore;
    if (deliveryScore < minScore) {
      bottleneck = "Delivery";
      minScore = deliveryScore;
    }
    if (engagementScore < minScore) {
      bottleneck = "Open Rate";
      minScore = engagementScore;
    }

    // Generate recommendation
    let recommendation = "";
    if (perf.openRate < 20) {
      recommendation = "Subject line needs improvement. Test variations.";
    } else if (perf.clickRate < 5) {
      recommendation = "CTA is weak. Improve copy and incentive clarity.";
    } else if (perf.conversionRate < 2) {
      recommendation = "Landing page or offer needs optimization.";
    } else if (perf.roi < 0) {
      recommendation = "Cost too high for ROI. Reduce targeting or increase incentive.";
    } else {
      recommendation = "Campaign performing well. Consider scaling budget.";
    }

    return {
      performanceScore: Math.round(performanceScore),
      topPerformer,
      bottleneck,
      recommendation,
    };
  }

  pauseCampaign(campaignId: string): Campaign | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    campaign.status = "paused";
    this.emit("campaign:paused", campaign);
    return campaign;
  }

  completeCampaign(campaignId: string): Campaign | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    campaign.status = "completed";
    campaign.endDate = new Date();

    this.emit("campaign:completed", campaign);
    return campaign;
  }

  getCampaign(campaignId: string): Campaign | null {
    return this.campaigns.get(campaignId) || null;
  }

  getAllCampaigns(status?: CampaignStatus): Campaign[] {
    const campaigns = Array.from(this.campaigns.values());
    if (status) {
      return campaigns.filter((c) => c.status === status);
    }
    return campaigns;
  }

  getCampaignStats(): {
    totalCampaigns: number;
    activeCampaigns: number;
    totalSent: number;
    totalRevenue: number;
    avgOpenRate: number;
    avgClickRate: number;
    avgConversionRate: number;
    avgROI: number;
  } {
    const allCampaigns = Array.from(this.campaigns.values());

    let totalSent = 0;
    let totalRevenue = 0;
    let totalOpenRate = 0;
    let totalClickRate = 0;
    let totalConversionRate = 0;
    let totalROI = 0;
    let activeCampaigns = 0;

    allCampaigns.forEach((campaign) => {
      if (campaign.status === "active") activeCampaigns++;
      totalSent += campaign.performance.sent;
      totalRevenue += campaign.performance.revenue;
      totalOpenRate += campaign.performance.openRate;
      totalClickRate += campaign.performance.clickRate;
      totalConversionRate += campaign.performance.conversionRate;
      totalROI += campaign.performance.roi;
    });

    const count = allCampaigns.length;

    return {
      totalCampaigns: count,
      activeCampaigns,
      totalSent,
      totalRevenue,
      avgOpenRate: count > 0 ? totalOpenRate / count : 0,
      avgClickRate: count > 0 ? totalClickRate / count : 0,
      avgConversionRate: count > 0 ? totalConversionRate / count : 0,
      avgROI: count > 0 ? totalROI / count : 0,
    };
  }
}

export const campaignOrchestrationEngine = new CampaignOrchestrationEngine();
