/**
 * Onboarding Components & Types
 * Export all onboarding-related components and types
 */

export { default as OnboardingWizard } from './onboarding-wizard';
export { default as DriverSalarySetupPanel } from './DriverSalarySetupPanel';

export type {
  DriverSalaryFormData,
  DriverSalaryMaster,
  EmploymentTypeOption,
  SalaryTypeOption,
  WeeklyOffDayOption,
  LeaveTypeOption,
  SalaryCalculationResult,
  DriverSalarySetupPanelProps,
  OnboardingStep,
  OnboardingContext,
  SalaryMasterCreateResponse,
  SalaryMasterFetchResponse,
  BankPaymentDetails,
  UpiPaymentDetails,
  PaymentDetails,
  SalaryStructureTemplate,
  ValidationError,
  ValidationResult,
  SalaryConfigurationSummary,
  OnboardingWorkflowConfig,
} from './types';
