/**
 * Onboarding Component Types
 * Types for driver salary setup and onboarding workflows
 */

/**
 * Driver Salary Setup Form Data
 * Matches IDriverSalaryMaster from server
 */
export interface DriverSalaryFormData {
  joiningDate: string;
  joiningBaseSalary: number;
  currentBaseSalary: number;
  employmentType: 'permanent' | 'contract' | 'probation' | 'temporary' | 'casual';
  salaryType: 'fixed_monthly' | 'daily' | 'per_trip' | 'fixed_incentive' | 'custom';
  baseSalary: number;
  perDaySalary?: number;
  perTripSalary?: number;
  kmIncentivePerKm?: number;
  nightAllowancePerNight?: number;
  outstationAllowancePerDay?: number;
  foodAllowance?: number;
  perBookingFoodCharge?: number;
  overtimeRatePerHour?: number;
  extraDutyRate?: number;
  weeklyOffDays: number[];
  weeklyOffLeaveType: 'paid' | 'unpaid' | 'compensatory';
  salaryStartDate: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

/**
 * Driver Salary Master Response from API
 */
export interface DriverSalaryMaster extends DriverSalaryFormData {
  _id: string;
  tenantId: string;
  driverId: string;
  name: string;
  mobile: string;
  status: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Employment Type Option
 */
export interface EmploymentTypeOption {
  value: 'permanent' | 'contract' | 'probation' | 'temporary' | 'casual';
  label: string;
}

/**
 * Salary Type Option
 */
export interface SalaryTypeOption {
  value: 'fixed_monthly' | 'daily' | 'per_trip' | 'fixed_incentive' | 'custom';
  label: string;
}

/**
 * Weekly Off Day Option
 */
export interface WeeklyOffDayOption {
  value: number;
  label: string;
}

/**
 * Leave Type Option
 */
export interface LeaveTypeOption {
  value: 'paid' | 'unpaid' | 'compensatory';
  label: string;
}

/**
 * Salary Calculation Result
 * For displaying estimated monthly earning
 */
export interface SalaryCalculationResult {
  baseSalary: number;
  dailyCompensation: number;
  tripCompensation: number;
  kmIncentive: number;
  nightAllowance: number;
  outstationAllowance: number;
  foodAllowance: number;
  overtimeCompensation: number;
  extraDutyCompensation: number;
  totalMonthly: number;
}

/**
 * Driver Salary Setup Panel Props
 */
export interface DriverSalarySetupPanelProps {
  driverId: string;
  driverName: string;
  onSalarySetupComplete?: () => void;
  onCancel?: () => void;
  isReadOnly?: boolean;
}

/**
 * Onboarding Step Definition
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  optional?: boolean;
  dependencies?: string[];
}

/**
 * Onboarding Context
 */
export interface OnboardingContext {
  driverId: string;
  driverName: string;
  currentStep: string;
  completedSteps: string[];
  progress: number;
  salaryConfigured: boolean;
}

/**
 * API Response for Salary Master Creation
 */
export interface SalaryMasterCreateResponse {
  success: true;
  data: DriverSalaryMaster;
  message: string;
}

/**
 * API Response for Salary Master Fetch
 */
export interface SalaryMasterFetchResponse {
  data: DriverSalaryMaster;
}

/**
 * Bank Payment Details
 */
export interface BankPaymentDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

/**
 * UPI Payment Details
 */
export interface UpiPaymentDetails {
  upiId: string;
}

/**
 * Payment Details Union
 */
export type PaymentDetails = BankPaymentDetails | UpiPaymentDetails;

/**
 * Salary Structure Template
 * Pre-configured salary structures for quick setup
 */
export interface SalaryStructureTemplate {
  id: string;
  name: string;
  description: string;
  salaryType: DriverSalaryFormData['salaryType'];
  defaults: Partial<DriverSalaryFormData>;
  icon?: string;
}

/**
 * Validation Error
 */
export interface ValidationError {
  field: string;
  message: string;
  type: 'required' | 'invalid' | 'conflict';
}

/**
 * Form Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Salary Configuration Summary
 * For display/preview purposes
 */
export interface SalaryConfigurationSummary {
  employmentType: string;
  salaryType: string;
  totalMonthly: number;
  weeklyOffs: number;
  paymentMethod: 'bank' | 'upi' | 'cash';
  lastUpdated: Date;
  status: string;
}

/**
 * Onboarding Workflow Configuration
 */
export interface OnboardingWorkflowConfig {
  steps: OnboardingStep[];
  allowSkip: boolean;
  requireSalarySetup: boolean;
  requireBankDetails: boolean;
  autoSave: boolean;
  saveInterval: number;
}
