/**
 * Integration Models Index
 * Central export point for all integration models
 */

export {
  IntegrationProvider,
  type IIntegrationProvider,
} from './IntegrationProvider';

export {
  ProviderConnection,
  type IProviderConnection,
} from './ProviderConnection';

export {
  IntegrationAuditLog,
  type IIntegrationAuditLog,
} from './IntegrationAuditLog';

export default {
  IntegrationProvider,
  ProviderConnection,
  IntegrationAuditLog,
};
