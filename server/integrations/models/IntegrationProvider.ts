/**
 * IntegrationProvider Model
 * Canonical definition of third-party providers
 * Supports: WhatsApp, Calling, GPS, KYC, eSign, etc.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { IntegrationCategory, ProviderHealthStatus, ProviderMetadata } from '../types';

/**
 * IntegrationProvider Interface
 * Single source of truth for all provider definitions
 */
export interface IIntegrationProvider extends Document {
  // Unique provider identifier (e.g., 'twilio', 'whatsapp-business', 'google-maps')
  providerId: string;

  // Provider category (MESSAGING, CALLING, GPS, KYC, ESIGN, etc.)
  category: IntegrationCategory;

  // Display name and description
  displayName: string;
  description: string;

  // Provider version (for tracking compatibility)
  version: string;

  // Documentation URL
  documentationUrl?: string;

  // Metadata about provider capabilities
  metadata: ProviderMetadata;

  // Provider configuration schema (JSON schema for validation)
  configurationSchema: Record<string, any>;

  // List of required credential fields
  requiredCredentials: string[];

  // List of optional credential fields
  optionalCredentials?: string[];

  // Webhook configuration
  webhookConfig?: {
    enabled: boolean;
    events: string[];
    timeout?: number;
    retryAttempts?: number;
  };

  // Rate limiting configuration
  rateLimiting?: {
    enabled: boolean;
    requestsPerMinute: number;
    requestsPerDay?: number;
    burstLimit?: number;
  };

  // Health check configuration
  healthCheck?: {
    enabled: boolean;
    endpoint?: string;
    interval?: number; // milliseconds
    timeout?: number; // milliseconds
  };

  // Provider-specific settings
  settings: {
    // Default timeout for API calls (milliseconds)
    defaultTimeout?: number;

    // Maximum retry attempts for failed requests
    maxRetries?: number;

    // Supported regions/endpoints
    supportedRegions?: string[];

    // API version
    apiVersion?: string;

    // Custom settings
    [key: string]: any;
  };

  // Provider status
  isActive: boolean;

  // When provider was added to the system
  createdAt: Date;

  // When provider was last updated
  updatedAt: Date;

  // When provider was last used (for analytics)
  lastUsedAt?: Date;

  // Internal notes about the provider
  internalNotes?: {
    note: string;
    authorId: string;
    createdAt: Date;
  }[];

  // Tags for categorization
  tags?: string[];

  // Feature flags
  features?: {
    [key: string]: boolean;
  };
}

/**
 * IntegrationProvider Schema
 */
const IntegrationProviderSchema = new Schema<IIntegrationProvider>(
  {
    providerId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['MESSAGING', 'CALLING', 'GPS', 'KYC', 'ESIGN', 'PAYMENT', 'ANALYTICS', 'STORAGE', 'CUSTOM'],
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    version: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    documentationUrl: {
      type: String,
    },
    metadata: {
      displayName: String,
      description: String,
      icon: String,
      category: String,
      version: String,
      documentation: String,
      supportedFeatures: [String],
      requiredCredentials: [String],
    },
    configurationSchema: {
      type: Schema.Types.Mixed,
      required: true,
    },
    requiredCredentials: {
      type: [String],
      required: true,
    },
    optionalCredentials: [String],
    webhookConfig: {
      enabled: Boolean,
      events: [String],
      timeout: Number,
      retryAttempts: Number,
    },
    rateLimiting: {
      enabled: Boolean,
      requestsPerMinute: Number,
      requestsPerDay: Number,
      burstLimit: Number,
    },
    healthCheck: {
      enabled: Boolean,
      endpoint: String,
      interval: Number,
      timeout: Number,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: Date,
    internalNotes: [
      {
        note: String,
        authorId: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    tags: [String],
    features: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
IntegrationProviderSchema.index({ category: 1, isActive: 1 });
IntegrationProviderSchema.index({ tags: 1 });
IntegrationProviderSchema.index({ createdAt: -1 });

// Virtual for provider status
IntegrationProviderSchema.virtual('isHealthy').get(function () {
  return this.isActive && this.healthCheck?.enabled === true;
});

/**
 * Create or get IntegrationProvider model
 */
export const IntegrationProvider =
  mongoose.models.IntegrationProvider ||
  mongoose.model<IIntegrationProvider>('IntegrationProvider', IntegrationProviderSchema);

export default IntegrationProvider;
