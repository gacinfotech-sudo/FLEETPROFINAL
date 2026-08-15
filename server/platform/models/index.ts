// STEP 10: Platform Models
// All 5 fresh MongoDB collections with indexes

export { Subscription } from './Subscription';
export { PlatformInvoice } from './PlatformInvoice';
export { PlatformPayment } from './PlatformPayment';
export { SupportTicket } from './SupportTicket';
export { AuditLog } from './AuditLog';
export { Plan } from './Plan';
export { PlatformCompany } from './PlatformCompany';

// Bootstrap
export { bootstrapPlatformCollections } from './bootstrap';
