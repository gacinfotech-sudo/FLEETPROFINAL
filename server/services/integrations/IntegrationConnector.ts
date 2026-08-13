import { EventEmitter } from "events";

interface Integration {
  integrationId: string;
  provider: "stripe" | "razorpay" | "paypal" | "twilio" | "sendgrid" | "aws";
  type: "payment" | "sms" | "email" | "storage" | "analytics";
  status: "connected" | "disconnected" | "error";
  credentials: Record<string, string>;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastError?: string;
}

interface IntegrationResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode: number;
  latency: number; // ms
}

export class IntegrationConnector extends EventEmitter {
  private integrations: Map<string, Integration> = new Map();
  private connectionCache: Map<string, any> = new Map();

  /**
   * Connect to a third-party provider
   */
  async connectProvider(
    integrationId: string,
    provider: Integration["provider"],
    credentials: Record<string, string>
  ): Promise<Integration> {
    try {
      const start = Date.now();

      // Validate credentials
      await this.validateCredentials(provider, credentials);

      const integration: Integration = {
        integrationId,
        provider,
        type: this.getIntegrationType(provider),
        status: "connected",
        credentials,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.integrations.set(integrationId, integration);
      this.emit("integration-connected", integration);

      console.log(`Connected to ${provider} in ${Date.now() - start}ms`);
      return integration;
    } catch (error: any) {
      const integration: Integration = {
        integrationId,
        provider,
        type: this.getIntegrationType(provider),
        status: "error",
        credentials,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastError: error.message,
      };

      this.integrations.set(integrationId, integration);
      this.emit("integration-failed", integration);
      throw error;
    }
  }

  /**
   * Process payment via Stripe/Razorpay
   */
  async processPayment(
    integrationId: string,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<IntegrationResponse> {
    const start = Date.now();
    const integration = this.integrations.get(integrationId);

    if (!integration) {
      throw new Error("Integration not found");
    }

    try {
      if (integration.provider === "stripe") {
        return await this.stripePayment(integration, amount, currency, metadata);
      } else if (integration.provider === "razorpay") {
        return await this.razorpayPayment(integration, amount, currency, metadata);
      } else if (integration.provider === "paypal") {
        return await this.paypalPayment(integration, amount, currency, metadata);
      }

      return {
        success: false,
        error: "Payment provider not supported",
        statusCode: 400,
        latency: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        statusCode: 500,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(
    integrationId: string,
    to: string,
    message: string
  ): Promise<IntegrationResponse> {
    const start = Date.now();
    const integration = this.integrations.get(integrationId);

    if (!integration) {
      throw new Error("Integration not found");
    }

    try {
      if (integration.provider !== "twilio") {
        return {
          success: false,
          error: "Provider is not Twilio",
          statusCode: 400,
          latency: Date.now() - start,
        };
      }

      // Simulate Twilio API call
      return {
        success: true,
        data: {
          messageId: `msg_${Date.now()}`,
          to,
          status: "sent",
        },
        statusCode: 200,
        latency: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        statusCode: 500,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Send email via SendGrid
   */
  async sendEmail(
    integrationId: string,
    to: string,
    subject: string,
    body: string,
    htmlBody?: string
  ): Promise<IntegrationResponse> {
    const start = Date.now();
    const integration = this.integrations.get(integrationId);

    if (!integration) {
      throw new Error("Integration not found");
    }

    try {
      if (integration.provider !== "sendgrid") {
        return {
          success: false,
          error: "Provider is not SendGrid",
          statusCode: 400,
          latency: Date.now() - start,
        };
      }

      // Simulate SendGrid API call
      return {
        success: true,
        data: {
          messageId: `email_${Date.now()}`,
          to,
          status: "sent",
        },
        statusCode: 202,
        latency: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        statusCode: 500,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Upload file to AWS S3
   */
  async uploadToStorage(
    integrationId: string,
    bucket: string,
    key: string,
    data: Buffer,
    contentType?: string
  ): Promise<IntegrationResponse> {
    const start = Date.now();
    const integration = this.integrations.get(integrationId);

    if (!integration) {
      throw new Error("Integration not found");
    }

    try {
      if (integration.provider !== "aws") {
        return {
          success: false,
          error: "Provider is not AWS",
          statusCode: 400,
          latency: Date.now() - start,
        };
      }

      // Simulate S3 upload
      return {
        success: true,
        data: {
          bucket,
          key,
          url: `https://${bucket}.s3.amazonaws.com/${key}`,
          size: data.length,
        },
        statusCode: 200,
        latency: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        statusCode: 500,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Get integration status
   */
  getIntegration(integrationId: string): Integration | undefined {
    return this.integrations.get(integrationId);
  }

  /**
   * List all integrations
   */
  listIntegrations(): Integration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Disconnect integration
   */
  disconnectIntegration(integrationId: string): void {
    const integration = this.integrations.get(integrationId);
    if (integration) {
      integration.status = "disconnected";
      integration.updatedAt = new Date();
      this.connectionCache.delete(integrationId);
      this.emit("integration-disconnected", integration);
    }
  }

  /**
   * Test connection
   */
  async testConnection(integrationId: string): Promise<boolean> {
    const integration = this.integrations.get(integrationId);
    if (!integration) return false;

    try {
      await this.validateCredentials(integration.provider, integration.credentials);
      integration.status = "connected";
      integration.lastError = undefined;
      return true;
    } catch (error: any) {
      integration.status = "error";
      integration.lastError = error.message;
      return false;
    }
  }

  private async validateCredentials(
    provider: string,
    credentials: Record<string, string>
  ): Promise<void> {
    switch (provider) {
      case "stripe":
        if (!credentials.apiKey) throw new Error("Stripe API key required");
        break;
      case "razorpay":
        if (!credentials.keyId || !credentials.keySecret)
          throw new Error("Razorpay credentials required");
        break;
      case "twilio":
        if (!credentials.accountSid || !credentials.authToken)
          throw new Error("Twilio credentials required");
        break;
      case "sendgrid":
        if (!credentials.apiKey) throw new Error("SendGrid API key required");
        break;
      case "aws":
        if (!credentials.accessKeyId || !credentials.secretAccessKey)
          throw new Error("AWS credentials required");
        break;
      default:
        throw new Error("Unknown provider");
    }
  }

  private getIntegrationType(
    provider: string
  ): Integration["type"] {
    const types: Record<string, Integration["type"]> = {
      stripe: "payment",
      razorpay: "payment",
      paypal: "payment",
      twilio: "sms",
      sendgrid: "email",
      aws: "storage",
    };
    return types[provider] || "storage";
  }

  private async stripePayment(
    integration: Integration,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<IntegrationResponse> {
    return {
      success: true,
      data: {
        transactionId: `ch_${Date.now()}`,
        amount,
        currency,
        status: "succeeded",
      },
      statusCode: 200,
      latency: 250,
    };
  }

  private async razorpayPayment(
    integration: Integration,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<IntegrationResponse> {
    return {
      success: true,
      data: {
        transactionId: `pay_${Date.now()}`,
        amount,
        currency,
        status: "authorized",
      },
      statusCode: 200,
      latency: 300,
    };
  }

  private async paypalPayment(
    integration: Integration,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<IntegrationResponse> {
    return {
      success: true,
      data: {
        transactionId: `PAYID_${Date.now()}`,
        amount,
        currency,
        status: "completed",
      },
      statusCode: 200,
      latency: 400,
    };
  }
}
