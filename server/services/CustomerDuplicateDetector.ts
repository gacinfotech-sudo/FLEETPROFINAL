/**
 * CustomerDuplicateDetector (WAVE 2)
 *
 * Identifies and prevents duplicate customer records within a tenant.
 * Uses normalized phones as primary deduplication key.
 */

import mongoose from 'mongoose';
import { PhoneNormalizer } from './PhoneNormalizer';

export interface IDuplicateMatch {
  customerId: mongoose.Types.ObjectId;
  matchScore: number; // 0-100: confidence level
  matchReasons: string[]; // Why it matched
  confidence: 'DEFINITE' | 'LIKELY' | 'POSSIBLE';
}

export interface IDuplicateCheckResult {
  isDuplicate: boolean;
  matches: IDuplicateMatch[];
  action: 'CREATE_NEW' | 'USE_EXISTING' | 'MANUAL_REVIEW';
  recommendation?: string;
}

/**
 * Duplicate detection service
 */
export class CustomerDuplicateDetector {
  /**
   * Check if a new customer is a duplicate of an existing one
   *
   * @param tenantId Tenant to search within
   * @param name Customer name
   * @param phones Phone numbers (primary, alternate, whatsapp)
   * @param mongoClient MongoDB connection
   * @returns Duplicate check result
   */
  static async check(
    tenantId: mongoose.Types.ObjectId,
    name: string,
    phones: {
      primaryMobile: string;
      alternateMobile?: string;
      whatsappNumber?: string;
    },
    mongoClient: any // mongoose.Connection
  ): Promise<IDuplicateCheckResult> {
    const customerCollection = mongoClient.collection('customers');

    // Normalize all phones
    const normalizedPhones = PhoneNormalizer.getAllPhones(
      phones.primaryMobile,
      phones.alternateMobile,
      phones.whatsappNumber
    );

    if (normalizedPhones.length === 0) {
      return {
        isDuplicate: false,
        matches: [],
        action: 'MANUAL_REVIEW',
        recommendation: 'Unable to validate phone numbers; manual review required',
      };
    }

    // Query for existing customers with matching phones
    const matches = await customerCollection
      .find({
        tenantId,
        $or: [
          { primaryMobile: { $in: normalizedPhones } },
          { alternateMobile: { $in: normalizedPhones } },
          { whatsappNumber: { $in: normalizedPhones } },
          { phoneAliases: { $in: normalizedPhones } },
        ],
      })
      .toArray();

    const duplicateMatches: IDuplicateMatch[] = matches.map((existing) => {
      const reasons: string[] = [];
      let score = 0;

      // Phone match (strongest signal)
      if (normalizedPhones.includes(existing.primaryMobile)) {
        reasons.push('Primary phone exact match');
        score += 50;
      }
      if (existing.alternateMobile && normalizedPhones.includes(existing.alternateMobile)) {
        reasons.push('Alternate phone exact match');
        score += 40;
      }
      if (existing.whatsappNumber && normalizedPhones.includes(existing.whatsappNumber)) {
        reasons.push('WhatsApp number exact match');
        score += 35;
      }

      // Name match (secondary signal)
      if (this.namesMatch(name, existing.name)) {
        reasons.push('Name matches');
        score += 25;
      }

      return {
        customerId: existing._id,
        matchScore: Math.min(score, 100),
        matchReasons: reasons,
        confidence: score >= 75 ? 'DEFINITE' : score >= 50 ? 'LIKELY' : 'POSSIBLE',
      };
    });

    // Determine action
    const definitiveMatches = duplicateMatches.filter((m) => m.confidence === 'DEFINITE');
    const likelyMatches = duplicateMatches.filter((m) => m.confidence === 'LIKELY');

    if (definitiveMatches.length === 1) {
      return {
        isDuplicate: true,
        matches: duplicateMatches.sort((a, b) => b.matchScore - a.matchScore),
        action: 'USE_EXISTING',
        recommendation: `Use existing customer ${definitiveMatches[0].customerId}`,
      };
    } else if (definitiveMatches.length > 1 || likelyMatches.length > 0) {
      return {
        isDuplicate: true,
        matches: duplicateMatches.sort((a, b) => b.matchScore - a.matchScore),
        action: 'MANUAL_REVIEW',
        recommendation: `${definitiveMatches.length} definite + ${likelyMatches.length} likely matches; manual review recommended`,
      };
    } else {
      return {
        isDuplicate: false,
        matches: [],
        action: 'CREATE_NEW',
      };
    }
  }

  /**
   * Validate a customer merge (combining two customers into one)
   * Ensures no data loss
   *
   * @param sourceCustomerId Customer to merge FROM
   * @param targetCustomerId Customer to merge INTO
   * @param mongoClient MongoDB connection
   * @returns Validation result
   */
  static async validateMerge(
    sourceCustomerId: mongoose.Types.ObjectId,
    targetCustomerId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<{
    valid: boolean;
    sourceBookings: number;
    sourcePayments: number;
    sourceFollowUps: number;
    warnings: string[];
  }> {
    const bookingCollection = mongoClient.collection('bookings');
    const paymentCollection = mongoClient.collection('payments');
    const followUpCollection = mongoClient.collection('customerfollowups');

    const [sourceBookings, sourcePayments, sourceFollowUps] = await Promise.all([
      bookingCollection.countDocuments({ customerId: sourceCustomerId }),
      paymentCollection.countDocuments({ customerId: sourceCustomerId }),
      followUpCollection.countDocuments({ customerId: sourceCustomerId }),
    ]);

    const warnings: string[] = [];

    if (sourceBookings > 100) {
      warnings.push(`Large number of bookings (${sourceBookings}) may affect performance`);
    }
    if (sourcePayments > 50) {
      warnings.push(`Large number of payments (${sourcePayments}) to reconcile`);
    }

    return {
      valid: true, // Always allow merge; operator decides if necessary
      sourceBookings,
      sourcePayments,
      sourceFollowUps,
      warnings,
    };
  }

  /**
   * Execute a customer merge
   * Transfers all bookings, payments, etc. to target customer
   * Marks source as merged
   *
   * @param sourceCustomerId Customer to merge FROM
   * @param targetCustomerId Customer to merge INTO
   * @param mergedBy User performing merge
   * @param mongoClient MongoDB connection
   */
  static async merge(
    sourceCustomerId: mongoose.Types.ObjectId,
    targetCustomerId: mongoose.Types.ObjectId,
    mergedBy: { userId: string; role: string },
    mongoClient: any
  ): Promise<{
    bookingsRelinked: number;
    paymentsRelinked: number;
    followUpsRelinked: number;
  }> {
    const customerCollection = mongoClient.collection('customers');
    const bookingCollection = mongoClient.collection('bookings');
    const paymentCollection = mongoClient.collection('payments');
    const followUpCollection = mongoClient.collection('customerfollowups');

    // Relink all bookings
    const bookingsResult = await bookingCollection.updateMany(
      { customerId: sourceCustomerId },
      { $set: { customerId: targetCustomerId } }
    );

    // Relink all payments
    const paymentsResult = await paymentCollection.updateMany(
      { customerId: sourceCustomerId },
      { $set: { customerId: targetCustomerId } }
    );

    // Relink all follow-ups
    const followUpsResult = await followUpCollection.updateMany(
      { customerId: sourceCustomerId },
      { $set: { customerId: targetCustomerId } }
    );

    // Mark source customer as merged (don't delete!)
    await customerCollection.updateOne(
      { _id: sourceCustomerId },
      {
        $set: {
          mergedIntoCustomerId: targetCustomerId,
          mergedAt: new Date(),
          isDeleted: true,
          updatedBy: mergedBy,
        },
      }
    );

    return {
      bookingsRelinked: bookingsResult.modifiedCount,
      paymentsRelinked: paymentsResult.modifiedCount,
      followUpsRelinked: followUpsResult.modifiedCount,
    };
  }

  /**
   * Audit existing duplicates in a tenant
   * Scans for customers with same phone/email
   *
   * @param tenantId Tenant to audit
   * @param mongoClient MongoDB connection
   * @returns Potential duplicate groups
   */
  static async auditDuplicates(
    tenantId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<
    Array<{
      phoneNumber: string;
      customerCount: number;
      customers: Array<{
        _id: mongoose.Types.ObjectId;
        name: string;
        lastBookingDate?: Date;
      }>;
    }>
  > {
    const customerCollection = mongoClient.collection('customers');

    // Group by primaryMobile to find duplicates
    const duplicateGroups = await customerCollection
      .aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: '$primaryMobile',
            customerCount: { $sum: 1 },
            customers: {
              $push: {
                _id: '$_id',
                name: '$name',
                lastBookingDate: '$lastBookingDate',
              },
            },
          },
        },
        { $match: { customerCount: { $gt: 1 } } },
        { $sort: { customerCount: -1 } },
      ])
      .toArray();

    return duplicateGroups.map((group) => ({
      phoneNumber: group._id,
      customerCount: group.customerCount,
      customers: group.customers,
    }));
  }

  /**
   * Internal helper: check if two names are similar
   * Basic comparison; doesn't require exact match
   */
  private static namesMatch(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;

    // Exact match
    if (name1.toLowerCase() === name2.toLowerCase()) return true;

    // Partial match (e.g., first name matches)
    const parts1 = name1.toLowerCase().split(/\s+/);
    const parts2 = name2.toLowerCase().split(/\s+/);

    // If any part matches, consider it a match
    return parts1.some((part) => parts2.includes(part));
  }
}

export default CustomerDuplicateDetector;
