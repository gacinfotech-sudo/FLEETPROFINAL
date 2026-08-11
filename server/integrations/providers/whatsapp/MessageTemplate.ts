/**
 * WhatsApp Message Template System
 * Reusable message templates with variable interpolation
 * Supports booking, quotation, reminder templates
 */

import { MessageTemplate, TemplateParameter } from './types';

/**
 * Template engine for message personalization
 */
export class TemplateEngine {
  /**
   * Interpolate template variables
   * Example: "Hi {{name}}, your booking {{bookingId}} is confirmed"
   */
  static interpolate(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    return result;
  }

  /**
   * Extract template variables
   */
  static extractVariables(template: string): string[] {
    const regex = /{{(\w+)}}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    return [...new Set(variables)];
  }

  /**
   * Validate template has all required variables
   */
  static validateVariables(template: string, provided: Record<string, any>): boolean {
    const required = this.extractVariables(template);
    return required.every(v => v in provided);
  }
}

/**
 * Built-in message templates
 */
export const BUILTIN_TEMPLATES = {
  // Booking templates
  BOOKING_CONFIRMATION: {
    templateId: 'booking_confirmation',
    name: 'Booking Confirmation',
    category: 'transactional' as const,
    template: `Hi {{customerName}}, your booking #{{bookingId}} is confirmed!
Vehicle: {{vehicleType}}
From: {{pickupDate}} at {{pickupTime}}
To: {{dropoffDate}} at {{dropoffTime}}
Total Amount: ₹{{totalAmount}}

Booking Details: {{bookingLink}}`,
  },

  BOOKING_REMINDER: {
    templateId: 'booking_reminder',
    name: 'Booking Reminder',
    category: 'transactional' as const,
    template: `Reminder: Your booking #{{bookingId}} is due in {{hoursRemaining}} hours.
Vehicle: {{vehicleType}}
Date: {{pickupDate}} at {{pickupTime}}
Pickup Location: {{pickupLocation}}

View Details: {{bookingLink}}`,
  },

  DRIVER_DETAILS: {
    templateId: 'driver_details',
    name: 'Driver Details',
    category: 'informational' as const,
    template: `Hi {{customerName}}, meet your driver for booking #{{bookingId}}!
Driver: {{driverName}} ({{driverPhone}})
Vehicle: {{vehicleName}} ({{vehicleNumber}})
Pickup Time: {{pickupTime}}

Contact: {{driverPhone}}`,
  },

  PAYMENT_REMINDER: {
    templateId: 'payment_reminder',
    name: 'Payment Reminder',
    category: 'transactional' as const,
    template: `Hi {{customerName}}, payment reminder for booking #{{bookingId}}
Amount Due: ₹{{amountDue}}
Due Date: {{dueDate}}
Booking: {{bookingLink}}

Pay Now: {{paymentLink}}`,
  },

  // Quotation templates
  QUOTATION_SEND: {
    templateId: 'quotation_send',
    name: 'Quotation Sent',
    category: 'transactional' as const,
    template: `Hi {{customerName}}, your quotation #{{quotationId}} is ready!
Trip: {{tripDescription}}
Estimated Cost: ₹{{quotedAmount}}
Valid Until: {{validUntil}}

Download PDF: {{quotationLink}}
Respond: {{respondLink}}`,
  },

  QUOTATION_APPROVED: {
    templateId: 'quotation_approved',
    name: 'Quotation Approved',
    category: 'transactional' as const,
    template: `Thanks {{customerName}}! Your quotation #{{quotationId}} has been approved.
Amount: ₹{{approvedAmount}}
Next Step: Your booking is being prepared.

Booking Details: {{bookingLink}}`,
  },

  // Support templates
  SUPPORT_TICKET: {
    templateId: 'support_ticket',
    name: 'Support Ticket Created',
    category: 'informational' as const,
    template: `Hi {{customerName}}, we received your support request.
Ticket #{{ticketId}}
Subject: {{subject}}
Status: {{status}}

Track: {{ticketLink}}`,
  },

  // Loyalty & Rewards
  REWARD_EARNED: {
    templateId: 'reward_earned',
    name: 'Reward Earned',
    category: 'promotional' as const,
    template: `Great! You earned {{rewardPoints}} reward points on booking #{{bookingId}}.
Total Balance: {{totalPoints}} points
Redeem: {{rewardLink}}`,
  },

  LOYALTY_OFFER: {
    templateId: 'loyalty_offer',
    name: 'Loyalty Offer',
    category: 'promotional' as const,
    template: `Hi {{customerName}}, special offer just for you!
Discount: {{discountPercent}}% off your next booking
Code: {{promoCode}}
Valid Until: {{validUntil}}

Book Now: {{bookingLink}}`,
  },
};

/**
 * Message template builder
 */
export class MessageTemplateBuilder {
  private templateId: string;
  private name: string;
  private category: 'marketing' | 'transactional' | 'informational' = 'transactional';
  private content: string = '';
  private parameters: Record<string, TemplateParameter> = {};

  constructor(templateId: string, name: string) {
    this.templateId = templateId;
    this.name = name;
  }

  /**
   * Set template content
   */
  withContent(content: string): this {
    this.content = content;
    return this;
  }

  /**
   * Set template category
   */
  withCategory(category: 'marketing' | 'transactional' | 'informational'): this {
    this.category = category;
    return this;
  }

  /**
   * Add template parameter
   */
  withParameter(name: string, type: 'text' | 'image' | 'document', value?: any): this {
    this.parameters[name] = { type, value };
    return this;
  }

  /**
   * Add multiple parameters
   */
  withParameters(params: Record<string, any>): this {
    for (const [key, value] of Object.entries(params)) {
      this.parameters[key] = { type: 'text', value };
    }
    return this;
  }

  /**
   * Build template object
   */
  build(): MessageTemplate {
    return {
      templateId: this.templateId,
      name: this.name,
      category: this.category,
      parameters: Object.keys(this.parameters).length > 0 ? this.parameters : undefined,
    };
  }
}

/**
 * Template registry for managing custom templates
 */
export class TemplateRegistry {
  private templates = new Map<string, MessageTemplate>();

  constructor() {
    // Register built-in templates
    Object.entries(BUILTIN_TEMPLATES).forEach(([, config]: any) => {
      this.register({
        templateId: config.templateId,
        name: config.name,
        category: config.category,
      });
    });
  }

  /**
   * Register a template
   */
  register(template: MessageTemplate): void {
    this.templates.set(template.templateId, template);
  }

  /**
   * Get template by ID
   */
  get(templateId: string): MessageTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAll(): MessageTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getByCategory(category: string): MessageTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  /**
   * Check if template exists
   */
  exists(templateId: string): boolean {
    return this.templates.has(templateId);
  }

  /**
   * Render template with variables
   */
  render(templateId: string, variables: Record<string, any>): string {
    const builtin = Object.entries(BUILTIN_TEMPLATES).find(
      ([, config]: any) => config.templateId === templateId,
    )?.[1] as any;

    if (!builtin) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return TemplateEngine.interpolate(builtin.template, variables);
  }
}

export default TemplateEngine;
