#!/usr/bin/env node

/**
 * FleetPro Platform Owner / Root Account Recovery Tool
 *
 * LOCAL EXECUTION ONLY
 * This tool must be run on the server with local database access.
 * It is NOT exposed as a public API endpoint.
 *
 * Usage:
 *   npm run recover:owner
 *   or
 *   node scripts/recover-platform-owner.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const readline = require('readline');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
const SALT_ROUNDS = 12;
const RECOVERY_CODES_COUNT = 10;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '═'.repeat(70), 'cyan');
  log(`  ${title}`, 'cyan');
  log('═'.repeat(70) + '\n', 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function questionHidden(rl, prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    process.stdout.write(prompt);

    let input = '';
    stdin.on('data', (char) => {
      if (char === '\n' || char === '\r') {
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write('\n');
        resolve(input);
      } else if (char === '') {
        process.exit(0);
      } else {
        input += char;
      }
    });
  });
}

function generateRecoveryCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateFormattedRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODES_COUNT }, () => {
    const parts = [
      generateRecoveryCode(),
      generateRecoveryCode(),
      generateRecoveryCode(),
    ];
    return parts.join('-');
  });
}

async function hashRecoveryCode(code) {
  return await bcrypt.hash(code, SALT_ROUNDS);
}

async function findPlatformOwner(db) {
  const usersCollection = db.collection('users');

  const owner = await usersCollection.findOne({
    platformRole: 'PLATFORM_ROOT',
  });

  return owner;
}

async function validatePassword(candidatePassword, hashedPassword) {
  try {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  } catch (error) {
    return false;
  }
}

async function resetOwnerPassword(db, ownerId, newPassword) {
  const usersCollection = db.collection('users');
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const result = await usersCollection.updateOne(
    { _id: ownerId },
    {
      $set: {
        password: hashedPassword,
        passwordUpdatedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        authVersion: (new Date()).getTime(), // Revoke old sessions
      },
    }
  );

  return result.modifiedCount === 1;
}

async function saveRecoveryCodes(db, ownerId, codes) {
  const usersCollection = db.collection('users');

  const hashedCodes = await Promise.all(codes.map(code => hashRecoveryCode(code)));

  const codeRecords = hashedCodes.map((hash, idx) => ({
    hash,
    createdAt: new Date(),
    usedAt: null,
    status: 'ACTIVE',
  }));

  const result = await usersCollection.updateOne(
    { _id: ownerId },
    {
      $set: {
        recoveryCodes: codeRecords,
        recoveryCodesUpdatedAt: new Date(),
      },
    }
  );

  return result.modifiedCount === 1;
}

async function revokeOldSessions(db, ownerId) {
  const sessionsCollection = db.collection('sessions');

  const result = await sessionsCollection.deleteMany({
    userId: ownerId.toString(),
  });

  return result.deletedCount;
}

async function auditLog(db, action, ownerId, details = {}) {
  const auditCollection = db.collection('audit_logs');

  await auditCollection.insertOne({
    timestamp: new Date(),
    action,
    userId: ownerId.toString(),
    entityId: ownerId.toString(),
    entityType: 'PLATFORM_OWNER',
    details,
    ipAddress: 'LOCAL',
    userAgent: 'recovery-tool',
  });
}

async function main() {
  let rl;
  let db;
  let mongooseConnection;

  try {
    logSection('FleetPro Platform Owner Recovery Tool');
    logInfo('This tool is for LOCAL SERVER USE ONLY');
    logInfo('It connects directly to MongoDB to recover the Platform Owner account\n');

    // Connect to MongoDB
    logInfo('Connecting to MongoDB...');
    mongooseConnection = await mongoose.connect(MONGODB_URI);
    db = mongoose.connection.db;
    logSuccess('Connected to MongoDB\n');

    // Find Platform Owner
    logInfo('Locating canonical Platform Owner account...');
    const owner = await findPlatformOwner(db);

    if (!owner) {
      logError('Platform Owner account not found!');
      logWarning('No account with platformRole: PLATFORM_ROOT exists');
      process.exit(1);
    }

    logSuccess(`Platform Owner found!\n`);
    log(`  ID:                 ${owner._id}`, 'bold');
    log(`  Email:              ${owner.email}`);
    log(`  Role:               ${owner.role}`);
    log(`  PlatformRole:       ${owner.platformRole}`);
    log(`  Active:             ${owner.isActive ? 'YES' : 'NO'}`);
    log(`  MFA Enabled:        ${owner.mfaEnabled ? 'YES' : 'NO'}`);
    log(`  Last Login:         ${owner.lastLogin || 'Never'}`);
    log(`  Created:            ${owner.createdAt}\n`);

    // Show menu
    rl = createReadlineInterface();
    logSection('Recovery Options');

    let action = '';
    let validAction = false;

    while (!validAction) {
      log('1. Reset Password', 'yellow');
      log('2. Unlock Account', 'yellow');
      log('3. Revoke All Sessions', 'yellow');
      log('4. Generate Recovery Codes', 'yellow');
      log('5. View MFA Status', 'yellow');
      log('6. Exit', 'yellow');
      log('');

      action = await question(rl, 'Select action (1-6): ');

      if (['1', '2', '3', '4', '5', '6'].includes(action)) {
        validAction = true;
      } else {
        logError('Invalid selection. Please choose 1-6.\n');
      }
    }

    // Execute action
    switch (action) {
      case '1': // Reset Password
        await handleResetPassword(db, rl, owner);
        break;

      case '2': // Unlock Account
        await handleUnlockAccount(db, owner);
        break;

      case '3': // Revoke Sessions
        await handleRevokeSessions(db, owner);
        break;

      case '4': // Generate Recovery Codes
        await handleGenerateRecoveryCodes(db, owner);
        break;

      case '5': // View MFA Status
        await handleViewMFAStatus(owner);
        break;

      case '6': // Exit
        logInfo('Exiting without changes.');
        break;
    }

    rl.close();
    await mongooseConnection.disconnect();

  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (rl) rl.close();
    if (mongooseConnection) await mongooseConnection.disconnect();
  }
}

async function handleResetPassword(db, rl, owner) {
  logSection('Reset Platform Owner Password');

  log('Enter new password. Requirements:', 'yellow');
  log('  • Minimum 12 characters');
  log('  • At least one uppercase letter (A-Z)');
  log('  • At least one lowercase letter (a-z)');
  log('  • At least one number (0-9)');
  log('  • At least one special character (!@#$%^&*)\n');

  let password = '';
  let valid = false;

  while (!valid) {
    password = await questionHidden(rl, 'New Password: ');

    if (password.length < 12) {
      logError('Password must be at least 12 characters long');
      continue;
    }

    if (!/[A-Z]/.test(password)) {
      logError('Password must contain at least one uppercase letter');
      continue;
    }

    if (!/[a-z]/.test(password)) {
      logError('Password must contain at least one lowercase letter');
      continue;
    }

    if (!/[0-9]/.test(password)) {
      logError('Password must contain at least one number');
      continue;
    }

    if (!/[!@#$%^&*]/.test(password)) {
      logError('Password must contain at least one special character (!@#$%^&*)');
      continue;
    }

    valid = true;
  }

  const confirmPassword = await questionHidden(rl, 'Confirm Password: ');

  if (password !== confirmPassword) {
    logError('Passwords do not match!');
    return;
  }

  logInfo('Resetting password...');

  try {
    const resetSuccess = await resetOwnerPassword(db, owner._id, password);

    if (resetSuccess) {
      logSuccess('Password reset successfully!');

      logInfo('Revoking old sessions...');
      const revokedCount = await revokeOldSessions(db, owner._id);
      logSuccess(`Revoked ${revokedCount} old sessions`);

      await auditLog(db, 'PLATFORM_OWNER_PASSWORD_RESET', owner._id, {
        method: 'local-recovery-tool',
        timestamp: new Date(),
      });

      logSuccess('Audit log entry created');

      logSection('Password Reset Complete');
      logInfo(`You can now login with your new password at:`);
      log(`https://localhost:5050`, 'yellow');
      log(`Email: ${owner.email}\n`);
      logWarning('⚠️  All other logged-in sessions have been revoked');
      logWarning('⚠️  You will need to login again with the new password\n');

    } else {
      logError('Failed to reset password');
    }
  } catch (error) {
    logError(`Password reset failed: ${error.message}`);
  }
}

async function handleUnlockAccount(db, owner) {
  logSection('Unlock Account');

  if (!owner.lockedUntil) {
    logInfo('Account is not currently locked');
    return;
  }

  logInfo('Unlocking account...');

  try {
    const result = await db.collection('users').updateOne(
      { _id: owner._id },
      {
        $set: {
          lockedUntil: null,
          failedLoginCount: 0,
        },
      }
    );

    if (result.modifiedCount === 1) {
      logSuccess('Account unlocked successfully!');

      await auditLog(db, 'PLATFORM_OWNER_ACCOUNT_UNLOCKED', owner._id, {
        method: 'local-recovery-tool',
      });

    } else {
      logError('Failed to unlock account');
    }
  } catch (error) {
    logError(`Unlock failed: ${error.message}`);
  }
}

async function handleRevokeSessions(db, owner) {
  logSection('Revoke All Sessions');

  logInfo('This will log out all authenticated sessions for this account');

  try {
    const revokedCount = await revokeOldSessions(db, owner._id);
    logSuccess(`Revoked ${revokedCount} sessions`);

    await auditLog(db, 'PLATFORM_OWNER_SESSIONS_REVOKED', owner._id, {
      method: 'local-recovery-tool',
      revokedCount,
    });

  } catch (error) {
    logError(`Session revocation failed: ${error.message}`);
  }
}

async function handleGenerateRecoveryCodes(db, owner) {
  logSection('Generate Recovery Codes');

  logInfo('Generating 10 one-time recovery codes...\n');

  try {
    const codes = generateFormattedRecoveryCodes();

    log('Your Recovery Codes:', 'bold');
    log('(Save these in a secure location. Each code can only be used once.)\n', 'yellow');

    codes.forEach((code, idx) => {
      log(`${idx + 1}. ${code}`);
    });

    log('\n⚠️  SAVE THESE NOW - They will not be displayed again!', 'red');

    logInfo('\nSaving recovery codes to database...');

    const saved = await saveRecoveryCodes(db, owner._id, codes);

    if (saved) {
      logSuccess('Recovery codes saved successfully');

      await auditLog(db, 'PLATFORM_OWNER_RECOVERY_CODES_GENERATED', owner._id, {
        method: 'local-recovery-tool',
        count: codes.length,
      });

      log('\n📝 Keep these codes in a secure location:', 'bold');
      log('  • Password manager', 'yellow');
      log('  • Secure offline storage', 'yellow');
      log('  • Do NOT share via email/chat', 'yellow');
      log('  • Do NOT store in version control\n');

    } else {
      logError('Failed to save recovery codes');
    }
  } catch (error) {
    logError(`Recovery code generation failed: ${error.message}`);
  }
}

async function handleViewMFAStatus(owner) {
  logSection('MFA Status');

  if (owner.mfaEnabled) {
    log('MFA Status: ENABLED', 'green');
    log(`Enabled At: ${owner.mfaEnabledAt || 'Unknown'}`);
    log('\nNote: MFA is preserved after password reset', 'yellow');
  } else {
    log('MFA Status: DISABLED', 'yellow');
    log('\nRecommendation: Enable MFA for enhanced security', 'cyan');
    log('You can enable MFA after logging in to the account\n');
  }
}

// Run the tool
main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
