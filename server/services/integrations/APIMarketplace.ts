import { EventEmitter } from "events";
import * as crypto from "crypto";

interface APIKey {
  keyId: string;
  tenantId: string;
  name: string;
  key: string; // secret key (masked in responses)
  lastFourDigits: string;
  scopes: string[];
  rateLimit: number; // requests per minute
  active: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

interface SDKTemplate {
  language: "typescript" | "python" | "go";
  version: string;
  template: string;
}

interface APIDoc {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  response: Record<string, any>;
  example: string;
}

export class APIMarketplace extends EventEmitter {
  private apiKeys: Map<string, APIKey> = new Map();
  private sdkTemplates: Map<string, SDKTemplate> = new Map();
  private apiDocs: APIDoc[] = [];
  private usageStats: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializeSdkTemplates();
    this.initializeApiDocs();
  }

  /**
   * Generate API key for tenant
   */
  generateAPIKey(
    tenantId: string,
    name: string,
    scopes: string[] = ["read", "write"],
    expiresIn?: number // days
  ): APIKey {
    const keyId = `key_${Date.now()}`;
    const secret = crypto.randomBytes(32).toString("hex");
    const apiKey: APIKey = {
      keyId,
      tenantId,
      name,
      key: secret,
      lastFourDigits: secret.slice(-4),
      scopes,
      rateLimit: 1000, // 1000 requests/minute
      active: true,
      createdAt: new Date(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : undefined,
    };

    this.apiKeys.set(keyId, apiKey);
    this.emit("api-key-created", { keyId, tenantId, name });

    return {
      ...apiKey,
      key: `${secret.slice(0, 8)}...${secret.slice(-4)}`, // Mask key
    };
  }

  /**
   * Get API key (masked)
   */
  getAPIKey(keyId: string): APIKey | undefined {
    const key = this.apiKeys.get(keyId);
    if (key) {
      return {
        ...key,
        key: `${key.key.slice(0, 8)}...${key.key.slice(-4)}`,
      };
    }
    return undefined;
  }

  /**
   * Verify API key
   */
  verifyAPIKey(key: string): boolean {
    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.key === key && apiKey.active) {
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          return false;
        }
        apiKey.lastUsedAt = new Date();
        return true;
      }
    }
    return false;
  }

  /**
   * Revoke API key
   */
  revokeAPIKey(keyId: string): void {
    const key = this.apiKeys.get(keyId);
    if (key) {
      key.active = false;
      this.emit("api-key-revoked", { keyId });
    }
  }

  /**
   * Rotate API key
   */
  rotateAPIKey(keyId: string): APIKey | undefined {
    const oldKey = this.apiKeys.get(keyId);
    if (!oldKey) return undefined;

    // Create new key with same scopes
    const newKey = this.generateAPIKey(
      oldKey.tenantId,
      `${oldKey.name} (rotated)`,
      oldKey.scopes
    );

    // Revoke old key
    this.revokeAPIKey(keyId);

    this.emit("api-key-rotated", { oldKeyId: keyId, newKeyId: newKey.keyId });
    return newKey;
  }

  /**
   * List API keys for tenant (masked)
   */
  listAPIKeys(tenantId: string): APIKey[] {
    return Array.from(this.apiKeys.values())
      .filter((k) => k.tenantId === tenantId)
      .map((k) => ({
        ...k,
        key: `${k.key.slice(0, 8)}...${k.key.slice(-4)}`,
      }));
  }

  /**
   * Generate SDK code
   */
  generateSDK(language: "typescript" | "python" | "go", apiKey: string): string {
    const template = this.sdkTemplates.get(language);
    if (!template) {
      throw new Error(`SDK template for ${language} not found`);
    }

    // Replace placeholder with actual key (masked)
    return template.template.replace("YOUR_API_KEY", apiKey.slice(0, 8) + "...");
  }

  /**
   * Get API documentation
   */
  getAPIDocumentation(): APIDoc[] {
    return this.apiDocs;
  }

  /**
   * Get specific endpoint documentation
   */
  getEndpointDoc(endpoint: string, method: string): APIDoc | undefined {
    return this.apiDocs.find((d) => d.endpoint === endpoint && d.method === method);
  }

  /**
   * Track API usage
   */
  recordUsage(keyId: string, count: number = 1): void {
    const current = this.usageStats.get(keyId) || 0;
    this.usageStats.set(keyId, current + count);
  }

  /**
   * Get usage stats
   */
  getUsageStats(keyId: string): number {
    return this.usageStats.get(keyId) || 0;
  }

  /**
   * Check rate limit
   */
  checkRateLimit(keyId: string): { allowed: boolean; remaining: number } {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) {
      return { allowed: false, remaining: 0 };
    }

    const usage = this.getUsageStats(keyId);
    const allowed = usage < apiKey.rateLimit;
    const remaining = Math.max(0, apiKey.rateLimit - usage);

    return { allowed, remaining };
  }

  /**
   * Reset usage stats daily
   */
  resetDailyStats(): void {
    this.usageStats.clear();
    this.emit("stats-reset");
  }

  /**
   * Get SDK template
   */
  getSdkTemplate(language: string): SDKTemplate | undefined {
    return this.sdkTemplates.get(language);
  }

  private initializeSdkTemplates(): void {
    this.sdkTemplates.set("typescript", {
      language: "typescript",
      version: "1.0.0",
      template: `
import { FleetProAPI } from '@fleetpro/sdk';

const client = new FleetProAPI({
  apiKey: 'YOUR_API_KEY'
});

// Example: Create booking
const booking = await client.bookings.create({
  pickupLocation: 'Connaught Place',
  dropoffLocation: 'Indira Gandhi Airport',
  vehicleType: 'sedan'
});

console.log('Booking created:', booking.id);
      `,
    });

    this.sdkTemplates.set("python", {
      language: "python",
      version: "1.0.0",
      template: `
from fleetpro import FleetProClient

client = FleetProClient(api_key='YOUR_API_KEY')

# Example: Create booking
booking = client.bookings.create(
    pickup_location='Connaught Place',
    dropoff_location='Indira Gandhi Airport',
    vehicle_type='sedan'
)

print(f'Booking created: {booking.id}')
      `,
    });

    this.sdkTemplates.set("go", {
      language: "go",
      version: "1.0.0",
      template: `
package main

import (
  "fmt"
  "github.com/fleetpro/go-sdk"
)

func main() {
  client := fleetpro.NewClient("YOUR_API_KEY")

  booking, err := client.Bookings.Create(&fleetpro.BookingRequest{
    PickupLocation:   "Connaught Place",
    DropoffLocation:  "Indira Gandhi Airport",
    VehicleType:      "sedan",
  })

  if err != nil {
    panic(err)
  }

  fmt.Printf("Booking created: %s\\n", booking.ID)
}
      `,
    });
  }

  private initializeApiDocs(): void {
    this.apiDocs = [
      {
        endpoint: "/api/v2/bookings",
        method: "POST",
        description: "Create a new booking",
        parameters: [
          {
            name: "pickupLocation",
            type: "string",
            required: true,
            description: "Pickup location address",
          },
          {
            name: "dropoffLocation",
            type: "string",
            required: true,
            description: "Dropoff location address",
          },
          {
            name: "vehicleType",
            type: "string",
            required: false,
            description: "Type of vehicle (sedan, suv, premium)",
          },
        ],
        response: {
          id: "booking_123",
          status: "pending",
          fare: 450,
        },
        example: `curl -X POST https://api.example.com/api/v2/bookings \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"pickupLocation":"CP","dropoffLocation":"IGT"}'`,
      },
      {
        endpoint: "/api/v2/bookings/:id",
        method: "GET",
        description: "Get booking details",
        parameters: [
          {
            name: "id",
            type: "string",
            required: true,
            description: "Booking ID",
          },
        ],
        response: {
          id: "booking_123",
          status: "completed",
          fare: 450,
          driver: "Driver Name",
          rating: 4.8,
        },
        example: `curl -X GET https://api.example.com/api/v2/bookings/booking_123 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      },
    ];
  }
}
