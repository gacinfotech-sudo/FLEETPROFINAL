import { Db } from 'mongodb';

export interface ChannelConfig {
  id: string;
  tenantId: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  provider: string;
  isActive: boolean;
  config: Record<string, any>;
  rateLimits?: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelDelivery {
  id: string;
  tenantId: string;
  notificationId: string;
  channel: string;
  recipient: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  deliveredAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

class DeliveryChannelsManager {
  private db: Db | null = null;
  private configs: Map<string, ChannelConfig> = new Map();
  private deliveries: Map<string, ChannelDelivery> = new Map();

  constructor(db?: Db) {
    this.db = db || null;
  }

  setDatabase(db: Db) {
    this.db = db;
  }

  async initialize() {
    try {
      if (!this.db) {
        console.log('[DeliveryChannels] Database not initialized, running in memory mode');
        return;
      }

      const configs = await this.db.collection('channelConfigs')
        .find({ isActive: true })
        .toArray();

      for (const config of configs) {
        this.configs.set(config.id, config as ChannelConfig);
      }

      console.log(`[DeliveryChannels] Initialized with ${configs.length} channel configurations`);
    } catch (error) {
      console.error('[DeliveryChannels] Initialization error:', error);
    }
  }

  async setupChannel(
    tenantId: string,
    channel: string,
    provider: string,
    config: Record<string, any>,
    rateLimits?: { perMinute: number; perHour: number; perDay: number }
  ): Promise<ChannelConfig> {
    const channelConfig: ChannelConfig = {
      id: `ch-${tenantId}-${channel}-${Date.now()}`,
      tenantId,
      channel: channel as any,
      provider,
      isActive: true,
      config,
      rateLimits,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.configs.set(channelConfig.id, channelConfig);

    if (this.db) {
      try {
        await this.db.collection('channelConfigs').insertOne(channelConfig);
      } catch (e) {
        console.warn('[DeliveryChannels] Failed to persist config:', e);
      }
    }

    return channelConfig;
  }

  async getChannelConfig(tenantId: string, channel: string): Promise<ChannelConfig | null> {
    const configs = Array.from(this.configs.values())
      .filter(c => c.tenantId === tenantId && c.channel === channel && c.isActive);

    if (configs.length > 0) {
      return configs[0];
    }

    if (this.db) {
      try {
        const result = await this.db.collection('channelConfigs')
          .findOne({ tenantId, channel, isActive: true });
        return (result as ChannelConfig) || null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async recordDelivery(
    tenantId: string,
    notificationId: string,
    channel: string,
    recipient: string,
    status: 'pending' | 'sent' | 'failed' | 'bounced',
    errorMessage?: string
  ): Promise<ChannelDelivery> {
    const delivery: ChannelDelivery = {
      id: `del-${notificationId}-${channel}-${Date.now()}`,
      tenantId,
      notificationId,
      channel,
      recipient,
      status,
      errorMessage,
      retryCount: 0,
      createdAt: new Date(),
      ...(status === 'sent' && { deliveredAt: new Date() }),
    };

    this.deliveries.set(delivery.id, delivery);

    if (this.db) {
      try {
        await this.db.collection('channelDeliveries').insertOne(delivery);
      } catch (e) {
        console.warn('[DeliveryChannels] Failed to persist delivery:', e);
      }
    }

    return delivery;
  }

  async getDeliveryStatus(notificationId: string): Promise<ChannelDelivery[]> {
    const deliveries = Array.from(this.deliveries.values())
      .filter(d => d.notificationId === notificationId);

    if (deliveries.length > 0) {
      return deliveries;
    }

    if (this.db) {
      try {
        return await this.db.collection('channelDeliveries')
          .find({ notificationId })
          .toArray() as ChannelDelivery[];
      } catch (e) {
        return [];
      }
    }

    return [];
  }

  async getChannelStats(tenantId: string): Promise<Record<string, any>> {
    const deliveries = Array.from(this.deliveries.values())
      .filter(d => d.tenantId === tenantId);

    const stats = {
      total: deliveries.length,
      sent: deliveries.filter(d => d.status === 'sent').length,
      failed: deliveries.filter(d => d.status === 'failed').length,
      bounced: deliveries.filter(d => d.status === 'bounced').length,
      pending: deliveries.filter(d => d.status === 'pending').length,
      byChannel: {} as Record<string, number>,
      successRate: 0,
    };

    for (const delivery of deliveries) {
      stats.byChannel[delivery.channel] = (stats.byChannel[delivery.channel] || 0) + 1;
    }

    if (stats.total > 0) {
      stats.successRate = (stats.sent / stats.total) * 100;
    }

    return stats;
  }

  async retryFailedDelivery(deliveryId: string): Promise<boolean> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return false;

    delivery.status = 'pending';
    delivery.retryCount += 1;
    delivery.errorMessage = undefined;

    if (this.db) {
      try {
        await this.db.collection('channelDeliveries').updateOne(
          { id: deliveryId },
          { $set: { status: 'pending', retryCount: delivery.retryCount } }
        );
      } catch (e) {
        console.warn('[DeliveryChannels] Failed to update delivery:', e);
      }
    }

    return true;
  }

  async markAsDelivered(deliveryId: string): Promise<boolean> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return false;

    delivery.status = 'sent';
    delivery.deliveredAt = new Date();

    if (this.db) {
      try {
        await this.db.collection('channelDeliveries').updateOne(
          { id: deliveryId },
          { $set: { status: 'sent', deliveredAt: new Date() } }
        );
      } catch (e) {
        console.warn('[DeliveryChannels] Failed to update delivery:', e);
      }
    }

    return true;
  }

  async markAsFailed(deliveryId: string, error: string): Promise<boolean> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return false;

    delivery.status = 'failed';
    delivery.errorMessage = error;

    if (this.db) {
      try {
        await this.db.collection('channelDeliveries').updateOne(
          { id: deliveryId },
          { $set: { status: 'failed', errorMessage: error } }
        );
      } catch (e) {
        console.warn('[DeliveryChannels] Failed to update delivery:', e);
      }
    }

    return true;
  }

  async checkRateLimit(
    tenantId: string,
    channel: string,
    timeWindow: 'minute' | 'hour' | 'day'
  ): Promise<{ current: number; limit: number; allowed: boolean }> {
    const config = await this.getChannelConfig(tenantId, channel);
    if (!config || !config.rateLimits) {
      return { current: 0, limit: -1, allowed: true };
    }

    const now = new Date();
    let startTime = new Date();

    if (timeWindow === 'minute') {
      startTime.setMinutes(startTime.getMinutes() - 1);
    } else if (timeWindow === 'hour') {
      startTime.setHours(startTime.getHours() - 1);
    } else if (timeWindow === 'day') {
      startTime.setDate(startTime.getDate() - 1);
    }

    const deliveries = Array.from(this.deliveries.values())
      .filter(d => d.tenantId === tenantId && d.channel === channel && d.createdAt >= startTime);

    const limit = config.rateLimits[`per${timeWindow.charAt(0).toUpperCase() + timeWindow.slice(1)}` as keyof typeof config.rateLimits] || -1;
    const current = deliveries.length;

    return {
      current,
      limit,
      allowed: limit === -1 || current < limit,
    };
  }

  getConfigCount(): number {
    return this.configs.size;
  }

  getDeliveryCount(): number {
    return this.deliveries.size;
  }

  getStatus() {
    return {
      channelsConfigured: this.configs.size,
      deliveriesTracked: this.deliveries.size,
      timestamp: new Date(),
    };
  }
}

export const deliveryChannels = new DeliveryChannelsManager();
