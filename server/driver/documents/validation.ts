import { z } from 'zod';
import { DOCUMENT_TYPES } from './types';

export const uploadDocumentFieldsSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  label: z.string().trim().min(1).max(200).optional(),
  documentNumber: z.string().trim().min(1).max(64).optional(),
  issueDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.documentType === 'other' && !value.label) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['label'], message: 'label is required for documentType "other".' });
  }
});

export const verifyDocumentSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.status === 'rejected' && !value.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'reason is required when rejecting a document.' });
  }
});

const credentialField = z.string().trim().max(20000);

export const createDriveConnectionSchema = z.object({
  connectionName: z.string().trim().min(2).max(120).optional(),
  authType: z.enum(['service_account', 'oauth_consent']),
  sharedDriveId: z.string().trim().min(3).max(200),
  rootFolderName: z.string().trim().min(1).max(200).optional(),
  enabled: z.boolean().default(false),
  serviceAccountKeyJson: credentialField.optional(),
  clientId: credentialField.optional(),
  clientSecret: credentialField.optional(),
  refreshToken: credentialField.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.authType === 'service_account' && value.enabled && !value.serviceAccountKeyJson) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['serviceAccountKeyJson'], message: 'serviceAccountKeyJson is required to enable a service_account connection.' });
  }
  if (value.authType === 'oauth_consent' && value.enabled && (!value.clientId || !value.clientSecret || !value.refreshToken)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['refreshToken'], message: 'clientId, clientSecret and refreshToken are required to enable an oauth_consent connection.' });
  }
});

export const updateDriveConnectionSchema = z.object({
  connectionName: z.string().trim().min(2).max(120).optional(),
  sharedDriveId: z.string().trim().min(3).max(200).optional(),
  rootFolderName: z.string().trim().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
}).strict();

export const rotateDriveCredentialsSchema = z.object({
  serviceAccountKeyJson: credentialField.optional(),
  clientId: credentialField.optional(),
  clientSecret: credentialField.optional(),
  refreshToken: credentialField.optional(),
  reason: z.string().trim().min(3).max(500),
}).strict();
