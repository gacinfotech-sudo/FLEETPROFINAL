/**
 * Integration Types (Client-side)
 * Defines the contract for integration UI and API communication
 */

export type ProviderType = 'whatsapp' | 'calling' | 'gps' | 'kyc' | 'esign' | 'hub';

export interface ProviderConfig {
  provider: ProviderType;
  credentials: Record<string, any>;
  isActive: boolean;
  lastConfigured?: Date;
  features?: string[];
}

export interface ProviderStatus {
  provider: ProviderType;
  status: 'connected' | 'disconnected' | 'error' | 'initializing';
  lastCheck?: Date;
  errorMessage?: string;
  features?: string[];
  metrics?: {
    requestsToday?: number;
    successRate?: number;
    averageResponseTime?: number;
    webhooksProcessed?: number;
  };
}

export interface HealthCheckResult {
  provider: ProviderType;
  healthy: boolean;
  timestamp: Date;
  responseTime: number;
  details: {
    connectionStatus: string;
    authStatus: string;
    webhookStatus?: string;
    errorDetails?: string;
  };
}

export interface TestConnectionRequest {
  provider: ProviderType;
  credentials?: Record<string, any>;
}

export interface ProviderStatistics {
  provider: ProviderType;
  todayRequestCount: number;
  totalRequestCount: number;
  successRate: number;
  failureCount: number;
  averageResponseTime: number;
  lastRequest?: Date;
  webhooksProcessed?: number;
  lastWebhookTime?: Date;
}

export interface WebhookLog {
  id: string;
  provider: ProviderType;
  eventType: string;
  payload: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
  responseTime?: number;
  errorMessage?: string;
}

export interface ProviderConfigRequest {
  provider: ProviderType;
  credentials: Record<string, any>;
}

export const PROVIDER_CONFIGS: Record<ProviderType, {
  name: string;
  description: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'textarea' | 'select';
    required: boolean;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
  }>;
}> = {
  whatsapp: {
    name: 'WhatsApp Business API',
    description: 'Send messages and notifications via WhatsApp',
    fields: [
      {
        name: 'phoneNumberId',
        label: 'Phone Number ID',
        type: 'text',
        required: true,
        placeholder: 'e.g., 102345678901234567',
      },
      {
        name: 'businessAccountId',
        label: 'Business Account ID',
        type: 'text',
        required: true,
        placeholder: 'e.g., 987654321',
      },
      {
        name: 'accessToken',
        label: 'Access Token',
        type: 'password',
        required: true,
        placeholder: 'Your WhatsApp Business API access token',
      },
      {
        name: 'webhookVerifyToken',
        label: 'Webhook Verify Token',
        type: 'text',
        required: true,
        placeholder: 'Secure token for webhook verification',
      },
    ],
  },
  calling: {
    name: 'VoIP Calling Provider',
    description: 'Enable voice calling capabilities',
    fields: [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'Your calling provider API key',
      },
      {
        name: 'apiSecret',
        label: 'API Secret',
        type: 'password',
        required: true,
        placeholder: 'Your calling provider API secret',
      },
      {
        name: 'sipServer',
        label: 'SIP Server',
        type: 'text',
        required: false,
        placeholder: 'SIP server address (if applicable)',
      },
      {
        name: 'callbackUrl',
        label: 'Callback URL',
        type: 'text',
        required: true,
        placeholder: 'https://your-domain.com/webhooks/calling',
      },
    ],
  },
  gps: {
    name: 'GPS Tracking',
    description: 'Real-time vehicle GPS tracking and location services',
    fields: [
      {
        name: 'deviceId',
        label: 'Device/Fleet ID',
        type: 'text',
        required: true,
        placeholder: 'Your device or fleet identifier',
      },
      {
        name: 'apiUrl',
        label: 'API Endpoint',
        type: 'text',
        required: true,
        placeholder: 'https://api.gps-provider.com/v1',
      },
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'Your GPS provider API key',
      },
      {
        name: 'updateFrequency',
        label: 'Update Frequency (seconds)',
        type: 'select',
        required: true,
        options: [
          { label: '30 seconds', value: '30' },
          { label: '1 minute', value: '60' },
          { label: '5 minutes', value: '300' },
          { label: '15 minutes', value: '900' },
        ],
      },
    ],
  },
  kyc: {
    name: 'KYC Verification',
    description: 'Customer identity verification and compliance checks',
    fields: [
      {
        name: 'partnerId',
        label: 'Partner ID',
        type: 'text',
        required: true,
        placeholder: 'Your KYC provider partner ID',
      },
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'Your KYC provider API key',
      },
      {
        name: 'apiSecret',
        label: 'API Secret',
        type: 'password',
        required: true,
        placeholder: 'Your KYC provider API secret',
      },
      {
        name: 'verificationUrl',
        label: 'Verification Endpoint',
        type: 'text',
        required: true,
        placeholder: 'https://api.kyc-provider.com/verify',
      },
    ],
  },
  esign: {
    name: 'Digital eSignature',
    description: 'Digital document signing and signature verification',
    fields: [
      {
        name: 'organizationId',
        label: 'Organization ID',
        type: 'text',
        required: true,
        placeholder: 'Your esign provider organization ID',
      },
      {
        name: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'Your esign client ID',
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Your esign client secret',
      },
      {
        name: 'signingUrl',
        label: 'Signing URL',
        type: 'text',
        required: true,
        placeholder: 'https://sign.esign-provider.com',
      },
    ],
  },
  hub: {
    name: 'Integration Hub',
    description: 'Unified integration management and orchestration',
    fields: [
      {
        name: 'hubUrl',
        label: 'Hub URL',
        type: 'text',
        required: true,
        placeholder: 'https://hub.integration-platform.com',
      },
      {
        name: 'accessKey',
        label: 'Access Key',
        type: 'password',
        required: true,
        placeholder: 'Your integration hub access key',
      },
      {
        name: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        required: true,
        placeholder: 'Your integration hub secret key',
      },
      {
        name: 'webhookEndpoint',
        label: 'Webhook Endpoint',
        type: 'text',
        required: true,
        placeholder: 'https://your-domain.com/webhooks/hub',
      },
    ],
  },
};
