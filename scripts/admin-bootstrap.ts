import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { storage } from '../server/storage-mongodb';
import { logAdminRecoveryAction } from '../server/admin-recovery';
import { generateSecurePassword } from './lib/secure-password';
import { detectLanCandidates, getPort } from './lib/lan-network';

const DEFAULT_USERID = 'superadmin';
const RUNTIME_DIR = path.resolve(import.meta.dirname, '..', '.runtime');
const CREDENTIAL_FILE = path.join(RUNTIME_DIR, 'fleetpro-superadmin-onetime.txt');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await storage.getUsers();
  const existingAdmin = users.find((u) => u.role === 'admin' && u.isActive);

  if (existingAdmin) {
    console.log('✅ An active Super Admin already exists — nothing to do (idempotent, no duplicate created).\n');
    console.log(`Username:            ${existingAdmin.userId}`);
    console.log(`Must reset password: ${existingAdmin.mustResetPassword ? 'yes (pending)' : 'no'}`);
    console.log('\nForgot the password? Use the existing recovery tool:');
    console.log('  node reset-admin.js <new-password>');
    await logAdminRecoveryAction('SUPERADMIN_BOOTSTRAP_SKIPPED_EXISTING', { userId: existingAdmin.userId });
    await mongoose.disconnect();
    return;
  }

  const userId = (process.env.SUPERADMIN_USERID || DEFAULT_USERID).toLowerCase();
  const password = generateSecurePassword(24);

  const created = await storage.createUser({
    userId,
    password,
    role: 'admin',
    isActive: true,
    mustResetPassword: true,
  });

  const port = getPort();
  const candidates = detectLanCandidates();
  const lanUrl = candidates.length > 0 ? `http://${candidates[0].address}:${port}` : `http://<this-computer-LAN-IP>:${port}`;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  fs.mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    CREDENTIAL_FILE,
    [
      'FleetPro Super Admin — ONE-TIME credential',
      'Delete this file once you have logged in and changed the password.',
      '',
      `Username:      ${created.userId}`,
      `Password:      ${password}`,
      `LAN URL:       ${lanUrl}`,
      `Generated:     ${createdAt.toISOString()}`,
      `Expires:       ${expiresAt.toISOString()} (change the password before this — the account keeps mustResetPassword=true until then)`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  await logAdminRecoveryAction('SUPERADMIN_BOOTSTRAP_CREATED', { userId: created.userId });

  console.log('✅ Super Admin created.\n');
  console.log(`Username:  ${created.userId}`);
  console.log(`Password:  ${password}`);
  console.log(`LAN URL:   ${lanUrl}`);
  console.log(`\nAlso saved to: ${CREDENTIAL_FILE} (gitignored, chmod 600)`);
  console.log('This password is shown only once. Password change is required on first login.\n');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ Super Admin bootstrap failed:', error?.message || error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
