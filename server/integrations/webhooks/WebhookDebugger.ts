/**
 * Webhook Debugger - Request/Response Logging and Diagnostics
 * Comprehensive debugging tools for webhook development and troubleshooting
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import axios from 'axios';

interface DebugLog {
  id: string;
  timestamp: Date;
  webhookId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
    bodySize: number;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: any;
    bodySize: number;
  };
  timing: {
    totalTime: number;
    dnsTime?: number;
    connectTime?: number;
    tlsTime?: number;
    firstByteTime?: number;
    downloadTime?: number;
  };
  errors?: {
    type: string;
    message: string;
    stack?: string;
  };
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    retryCount?: number;
    signature?: string;
  };
}

interface PayloadInspection {
  valid: boolean;
  size: number;
  sizeFormatted: string;
  structure: Record<string, any>;
  eventType?: string;
  timestamp?: Date;
  dataFields?: string[];
  issues?: string[];
}

interface TestPayload {
  id: string;
  eventType: string;
  timestamp: Date;
  data: Record<string, any>;
  tenantId: string;
  version: string;
}

export class WebhookDebugger extends EventEmitter {
  private debugLogs: Map<string, DebugLog[]> = new Map();
  private maxLogsPerWebhook: number = 100;
  private payloadCache: Map<string, PayloadInspection> = new Map();

  constructor() {
    super();
  }

  /**
   * Log webhook request/response
   */
  logDelivery(
    webhookId: string,
    request: any,
    response: any,
    timing: any,
    error?: any
  ): DebugLog {
    const log: DebugLog = {
      id: `log_${crypto.randomBytes(6).toString('hex')}`,
      timestamp: new Date(),
      webhookId,
      request: {
        url: request.url,
        method: request.method || 'POST',
        headers: this.sanitizeHeaders(request.headers),
        body: this.truncatePayload(request.body),
        bodySize: JSON.stringify(request.body).length,
      },
      response: {
        statusCode: response?.status || 0,
        headers: response?.headers ? this.sanitizeHeaders(response.headers) : {},
        body: response?.data ? this.truncatePayload(response.data) : null,
        bodySize: response?.data ? JSON.stringify(response.data).length : 0,
      },
      timing,
      metadata: {
        userAgent: request.headers?.['user-agent'],
        retryCount: request.headers?.['x-retry-count']
          ? parseInt(request.headers['x-retry-count'])
          : 0,
        signature: request.headers?.['x-webhook-signature']?.substring(0, 20) + '...',
      },
    };

    if (error) {
      log.errors = {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack?.substring(0, 500),
      };
    }

    this.storeDebugLog(webhookId, log);
    this.emit('log:created', log);

    return log;
  }

  /**
   * Inspect webhook payload
   */
  inspectPayload(payload: any): PayloadInspection {
    const payloadStr = JSON.stringify(payload);
    const size = payloadStr.length;

    const inspection: PayloadInspection = {
      valid: true,
      size,
      sizeFormatted: this.formatBytes(size),
      structure: this.analyzeStructure(payload),
      eventType: payload.eventType,
      timestamp: payload.timestamp,
      dataFields: payload.data ? Object.keys(payload.data) : [],
      issues: [],
    };

    // Validate payload
    if (size > 1024 * 1024) {
      inspection.issues?.push('Payload exceeds 1MB');
    }

    if (!payload.id) {
      inspection.issues?.push('Missing event ID');
    }

    if (!payload.eventType) {
      inspection.issues?.push('Missing event type');
    }

    if (!payload.timestamp) {
      inspection.issues?.push('Missing timestamp');
    }

    if (payload.timestamp && new Date(payload.timestamp).getTime() < Date.now() - 3600000) {
      inspection.issues?.push('Event timestamp is more than 1 hour old');
    }

    inspection.valid = inspection.issues!.length === 0;

    return inspection;
  }

  /**
   * Analyze payload structure
   */
  private analyzeStructure(obj: any, depth: number = 0): Record<string, any> {
    if (depth > 5) return { type: 'nested' };

    if (Array.isArray(obj)) {
      return {
        type: 'array',
        length: obj.length,
        elementType: obj.length > 0 ? typeof obj[0] : 'unknown',
      };
    }

    if (obj === null) {
      return { type: 'null' };
    }

    if (typeof obj === 'object') {
      const structure: Record<string, any> = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          structure[key] = {
            type: typeof value,
            ...(Array.isArray(value) && {
              length: value.length,
            }),
            ...(typeof value === 'string' && {
              length: value.length,
            }),
            ...(typeof value === 'object' && value !== null && {
              keys: Object.keys(value).length,
            }),
          };
        }
      }
      return structure;
    }

    return { type: typeof obj };
  }

  /**
   * Generate test payload
   */
  generateTestPayload(eventType: string, customData?: any): TestPayload {
    const payload: TestPayload = {
      id: `evt_${crypto.randomBytes(8).toString('hex')}`,
      eventType,
      timestamp: new Date(),
      data: customData || this.getDefaultPayloadForEventType(eventType),
      tenantId: 'test_tenant',
      version: '1.0.0',
    };

    return payload;
  }

  /**
   * Get default payload for event type
   */
  private getDefaultPayloadForEventType(eventType: string): Record<string, any> {
    const templates: Record<string, Record<string, any>> = {
      'booking.created': {
        bookingId: 'BK001',
        customerId: 'CUST001',
        vehicleType: 'Sedan',
        pickupLocation: 'Downtown',
        dropoffLocation: 'Airport',
        amount: 500,
        status: 'confirmed',
      },
      'booking.completed': {
        bookingId: 'BK001',
        duration: 120,
        distance: 25.5,
        actualAmount: 510,
        rating: 4.5,
      },
      'payment.received': {
        paymentId: 'PAY001',
        bookingId: 'BK001',
        amount: 500,
        method: 'card',
        status: 'completed',
      },
      'driver.assigned': {
        bookingId: 'BK001',
        driverId: 'DRV001',
        driverName: 'John Doe',
        rating: 4.8,
        vehicleNumber: 'KA-01-AB-1234',
      },
      'webhook.test': {
        message: 'Test webhook payload',
        testData: {
          key1: 'value1',
          key2: 'value2',
        },
      },
    };

    return templates[eventType] || { message: `Test payload for ${eventType}` };
  }

  /**
   * Test webhook delivery with full diagnostics
   */
  async testDeliveryWithDiagnostics(
    webhookUrl: string,
    payload: any,
    secret: string,
    customHeaders?: Record<string, string>
  ): Promise<{
    success: boolean;
    diagnostics: {
      dnsResolution: boolean;
      tlsValid: boolean;
      timeout: boolean;
      statusCode: number;
      responseTime: number;
      issues: string[];
      recommendations: string[];
    };
    log: DebugLog;
  }> {
    const startTime = Date.now();
    const diagnostics = {
      dnsResolution: true,
      tlsValid: true,
      timeout: false,
      statusCode: 0,
      responseTime: 0,
      issues: [] as string[],
      recommendations: [] as string[],
    };

    try {
      const signature = this.generateSignature(payload, secret);
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Test': 'true',
        ...customHeaders,
      };

      const response = await axios.post(webhookUrl, payload, {
        headers,
        timeout: 30000,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;
      diagnostics.statusCode = response.status;
      diagnostics.responseTime = responseTime;

      if (response.status >= 400) {
        diagnostics.issues.push(`HTTP ${response.status} response`);
        if (response.status === 401 || response.status === 403) {
          diagnostics.recommendations.push('Check webhook credentials or authentication');
        }
        if (response.status === 404) {
          diagnostics.recommendations.push('Verify webhook URL is correct');
        }
        if (response.status === 500) {
          diagnostics.recommendations.push('Webhook endpoint returned server error');
        }
      }

      if (responseTime > 10000) {
        diagnostics.issues.push('Slow response time');
        diagnostics.recommendations.push('Webhook endpoint may be overloaded or slow');
      }

      const log = this.logDelivery(
        'test_webhook',
        { url: webhookUrl, method: 'POST', headers, body: payload },
        response,
        { totalTime: responseTime }
      );

      return {
        success: response.status >= 200 && response.status < 300,
        diagnostics,
        log,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      if (error.code === 'ENOTFOUND') {
        diagnostics.dnsResolution = false;
        diagnostics.issues.push('DNS resolution failed');
        diagnostics.recommendations.push('Verify webhook URL domain is valid');
      } else if (error.code === 'ECONNREFUSED') {
        diagnostics.issues.push('Connection refused');
        diagnostics.recommendations.push('Verify webhook endpoint is running');
      } else if (error.code === 'ETIMEDOUT') {
        diagnostics.timeout = true;
        diagnostics.issues.push('Request timeout');
        diagnostics.recommendations.push('Webhook endpoint may be slow or unresponsive');
      } else if (error.message.includes('ERR_TLS')) {
        diagnostics.tlsValid = false;
        diagnostics.issues.push('TLS/SSL certificate error');
        diagnostics.recommendations.push('Verify TLS certificate is valid');
      }

      const log = this.logDelivery(
        'test_webhook',
        { url: webhookUrl, method: 'POST', headers: {}, body: payload },
        null,
        { totalTime: responseTime },
        error
      );

      return {
        success: false,
        diagnostics,
        log,
      };
    }
  }

  /**
   * Analyze request timing
   */
  analyzeRequestTiming(log: DebugLog): any {
    const timing = log.timing;
    const analysis = {
      total: timing.totalTime,
      breakdown: {
        dns: timing.dnsTime || 0,
        connect: timing.connectTime || 0,
        tls: timing.tlsTime || 0,
        firstByte: timing.firstByteTime || 0,
        download: timing.downloadTime || 0,
      },
      bottleneck: '',
      optimization: '',
    };

    const maxTime = Math.max(
      timing.dnsTime || 0,
      timing.connectTime || 0,
      timing.tlsTime || 0,
      timing.firstByteTime || 0,
      timing.downloadTime || 0
    );

    if (timing.dnsTime === maxTime) {
      analysis.bottleneck = 'DNS Resolution';
      analysis.optimization = 'Consider using a faster DNS provider';
    } else if (timing.tlsTime === maxTime) {
      analysis.bottleneck = 'TLS Handshake';
      analysis.optimization = 'Webhook endpoint may have slow SSL/TLS setup';
    } else if (timing.firstByteTime === maxTime) {
      analysis.bottleneck = 'Server Processing';
      analysis.optimization = 'Webhook endpoint is slow to respond';
    } else if (timing.downloadTime === maxTime) {
      analysis.bottleneck = 'Response Download';
      analysis.optimization = 'Response payload is large';
    }

    return analysis;
  }

  /**
   * Get debug logs for webhook
   */
  getDebugLogs(webhookId: string, limit: number = 50): DebugLog[] {
    return (this.debugLogs.get(webhookId) || []).slice(-limit);
  }

  /**
   * Clear debug logs
   */
  clearDebugLogs(webhookId: string): void {
    this.debugLogs.delete(webhookId);
    this.emit('logs:cleared', { webhookId, timestamp: new Date() });
  }

  /**
   * Export debug logs
   */
  exportDebugLogs(webhookId: string): string {
    const logs = this.getDebugLogs(webhookId, 100);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Generate signature for payload
   */
  private generateSignature(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    return `sha256=${signature}`;
  }

  /**
   * Sanitize sensitive headers
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'x-access-token',
      'x-webhook-signature',
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '***masked***';
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Truncate large payloads
   */
  private truncatePayload(payload: any, maxSize: number = 5000): any {
    const str = JSON.stringify(payload);
    if (str.length > maxSize) {
      return {
        ...payload,
        __truncated: true,
        __originalSize: str.length,
        __message: `Payload truncated (original: ${this.formatBytes(str.length)})`,
      };
    }
    return payload;
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Store debug log
   */
  private storeDebugLog(webhookId: string, log: DebugLog): void {
    if (!this.debugLogs.has(webhookId)) {
      this.debugLogs.set(webhookId, []);
    }

    const logs = this.debugLogs.get(webhookId)!;
    logs.push(log);

    // Keep only last N logs
    if (logs.length > this.maxLogsPerWebhook) {
      logs.shift();
    }
  }

  /**
   * Get statistics
   */
  getDebugStatistics(webhookId: string): any {
    const logs = this.getDebugLogs(webhookId, 100);
    if (logs.length === 0) return null;

    const successCount = logs.filter((l) => l.response.statusCode >= 200 && l.response.statusCode < 300).length;
    const avgResponseTime = logs.reduce((sum, l) => sum + l.timing.totalTime, 0) / logs.length;
    const errorCount = logs.filter((l) => l.errors).length;

    return {
      totalRequests: logs.length,
      successCount,
      failureCount: logs.length - successCount,
      errorCount,
      successRate: (successCount / logs.length) * 100,
      averageResponseTime: Math.round(avgResponseTime),
      minResponseTime: Math.min(...logs.map((l) => l.timing.totalTime)),
      maxResponseTime: Math.max(...logs.map((l) => l.timing.totalTime)),
    };
  }
}

export default WebhookDebugger;
