#!/usr/bin/env node

/**
 * Quick Admin Password Reset Tool
 * 
 * Usage: node reset-admin.js [new-password]
 * Example: node reset-admin.js MyNewPassword123
 */

import { spawn } from 'child_process';

async function resetAdminPassword() {
  const newPassword = process.argv[2];
  
  if (!newPassword) {
    console.log('❌ Please provide a new password');
    console.log('Usage: node reset-admin.js <new-password>');
    console.log('Example: node reset-admin.js MyNewPassword123');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.log('❌ Password must be at least 8 characters long');
    process.exit(1);
  }

  console.log('🔐 Resetting admin password...');
  
  // Create the reset command
  const resetCommand = `
const { emergencyAdminPasswordReset } = require('./server/admin-recovery');
const connectDB = require('./server/connectDB');

(async () => {
  try {
    await connectDB();
    await emergencyAdminPasswordReset('${newPassword}');
    console.log('\\n✅ Admin password reset complete!');
    console.log('Login with: admin / ${newPassword}');
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
  }
  process.exit(0);
})();
  `;

  // Execute the reset
  const child = spawn('node', ['-e', resetCommand], { stdio: 'inherit' });
  
  child.on('exit', (code) => {
    if (code === 0) {
      console.log('\n🎉 Password reset successful!');
      console.log('You can now login to FleetPro with:');
      console.log(`User ID: admin`);
      console.log(`Password: ${newPassword}`);
    } else {
      console.log('\n❌ Password reset failed. Please try the manual recovery script.');
    }
  });
}

resetAdminPassword();