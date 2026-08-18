// TASK-DRIVER-DOMAIN-02 — barrel export for the driver lifecycle domain
// module. Downstream tasks (Onboarding-UI-04, Vehicle-Handover-05,
// Operations-06) should import from here rather than reaching into
// individual files, so internal reorganization doesn't break them.
export * from './types';
export * from './models';
export * from './access';
export * from './piiMasking';
export * from './auditLog';
export * from './auditLogService';
export * from './eligibility';
export {
  transitionLifecycleStage, getEffectiveLifecycleStage, isValidLifecycleTransition,
  InvalidLifecycleTransitionError, DriverNotFoundError as LifecycleDriverNotFoundError,
} from './lifecycleService';
export {
  createDriverContact, listDriverContacts, deactivateDriverContact, setContactVerificationStatus,
  getDriverContactPolicy, setDriverContactPolicy,
  DuplicateContactPhoneError, ContactPolicyViolationError,
  DriverNotFoundError as ContactDriverNotFoundError,
} from './contactService';
export {
  createEmploymentHistoryEntry, listEmploymentHistory, setEmploymentHistoryVerificationStatus,
  deactivateEmploymentHistoryEntry,
  DriverNotFoundError as EmploymentHistoryDriverNotFoundError,
} from './employmentHistoryService';
export {
  computeDriverCompleteness, registerCompletenessSection,
  DriverNotFoundError as CompletenessDriverNotFoundError,
} from './completenessService';
export type { CompletenessSection, CompletenessSectionCheck, DriverCompleteness } from './completenessService';
export { registerDriverDomainRoutes } from './routes';
