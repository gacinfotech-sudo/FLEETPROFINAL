/**
 * LEAVE CONFIGURATION MODEL
 * Stores tenant-level leave policies and configurations
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ILeaveConfiguration extends Document {
  tenantId: mongoose.Types.ObjectId;
  paidLeavePolicy: {
    annualQuota: number;
    accrualType: 'fixed' | 'monthly' | 'quarterly';
    accrualValue: number;
    carryForwardAllowed: boolean;
    maxCarryForward: number;
    expiryMonths: number;
  };
  unpaidLeavePolicy: {
    allowUnpaid: boolean;
    maxConsecutiveDays: number;
    requireApproval: boolean;
    deductionType: 'full' | 'half' | 'none';
  };
  weeklyOffPolicy: {
    dayOfWeek: number; // 0-6 (Sun-Sat)
    alternateWeeklyOff: boolean;
    alternatePattern: 'first_second' | 'weekly_rotation';
    compensatoryOffAllowed: boolean;
    compOffExpiryDays: number;
  };
  medicalLeavePolicy: {
    annualQuota: number;
    requiresCertificate: boolean;
    certificateAfterDays: number;
  };
  emergencyLeavePolicy: {
    allowEmergency: boolean;
    maxConsecutiveDays: number;
    requireApproval: boolean;
  };
  holidayPolicy: {
    holidays: Array<{
      date: string; // YYYY-MM-DD
      name: string;
    }>;
    rotationalHolidays: Array<{
      name: string;
      datePattern: string;
    }>;
  };
  leaveApprovalFlow: {
    requiresManagerApproval: boolean;
    requiresHRApproval: boolean;
    approvalOrder: ('manager' | 'hr' | 'admin')[];
    maxPendingDays: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LeaveConfigurationSchema = new Schema<ILeaveConfiguration>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    paidLeavePolicy: {
      annualQuota: {
        type: Number,
        default: 12,
        min: 0,
        max: 365,
      },
      accrualType: {
        type: String,
        enum: ['fixed', 'monthly', 'quarterly'],
        default: 'monthly',
      },
      accrualValue: {
        type: Number,
        default: 1,
        min: 0,
      },
      carryForwardAllowed: {
        type: Boolean,
        default: true,
      },
      maxCarryForward: {
        type: Number,
        default: 5,
        min: 0,
      },
      expiryMonths: {
        type: Number,
        default: 18,
        min: 0,
      },
    },
    unpaidLeavePolicy: {
      allowUnpaid: {
        type: Boolean,
        default: true,
      },
      maxConsecutiveDays: {
        type: Number,
        default: 30,
        min: 0,
      },
      requireApproval: {
        type: Boolean,
        default: true,
      },
      deductionType: {
        type: String,
        enum: ['full', 'half', 'none'],
        default: 'full',
      },
    },
    weeklyOffPolicy: {
      dayOfWeek: {
        type: Number,
        default: 0, // Sunday
        min: 0,
        max: 6,
      },
      alternateWeeklyOff: {
        type: Boolean,
        default: false,
      },
      alternatePattern: {
        type: String,
        enum: ['first_second', 'weekly_rotation'],
        default: 'first_second',
      },
      compensatoryOffAllowed: {
        type: Boolean,
        default: true,
      },
      compOffExpiryDays: {
        type: Number,
        default: 30,
        min: 0,
      },
    },
    medicalLeavePolicy: {
      annualQuota: {
        type: Number,
        default: 6,
        min: 0,
      },
      requiresCertificate: {
        type: Boolean,
        default: true,
      },
      certificateAfterDays: {
        type: Number,
        default: 3,
        min: 0,
      },
    },
    emergencyLeavePolicy: {
      allowEmergency: {
        type: Boolean,
        default: true,
      },
      maxConsecutiveDays: {
        type: Number,
        default: 3,
        min: 0,
      },
      requireApproval: {
        type: Boolean,
        default: false,
      },
    },
    holidayPolicy: {
      holidays: [
        {
          date: {
            type: String,
            required: true,
          },
          name: {
            type: String,
            required: true,
          },
        },
      ],
      rotationalHolidays: [
        {
          name: String,
          datePattern: String,
        },
      ],
    },
    leaveApprovalFlow: {
      requiresManagerApproval: {
        type: Boolean,
        default: true,
      },
      requiresHRApproval: {
        type: Boolean,
        default: true,
      },
      approvalOrder: [
        {
          type: String,
          enum: ['manager', 'hr', 'admin'],
        },
      ],
      maxPendingDays: {
        type: Number,
        default: 7,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
    collection: 'leave_configurations',
  }
);

// Indexes for common queries
LeaveConfigurationSchema.index({ tenantId: 1 }, { unique: true });
LeaveConfigurationSchema.index({ updatedAt: -1 });

const LeaveConfiguration = mongoose.model<ILeaveConfiguration>(
  'LeaveConfiguration',
  LeaveConfigurationSchema
);

export default LeaveConfiguration;
