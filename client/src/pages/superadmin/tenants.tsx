// This page is now handled by tenants-list.tsx
// Keeping this as a wrapper to avoid breaking existing routes
import TenantsList from './tenants-list';

export default function SuperAdminTenants() {
  return <TenantsList />;
}
