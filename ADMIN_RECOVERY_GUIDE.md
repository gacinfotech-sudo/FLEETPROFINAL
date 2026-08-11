# Admin Password Recovery Guide

## 🔐 If Admin Forgets Password

Your FleetPro system has multiple recovery options for admin password reset. Here are the steps to regain admin access:

### Method 1: Emergency Recovery Script (Recommended)

This is the safest and most secure method to reset admin password:

#### Step 1: Access Server Terminal
- Open your Replit project
- Click on the Shell/Terminal tab
- Make sure you're in the project root directory

#### Step 2: Run Recovery Script
```bash
npx tsx server/recovery-script.ts
```

#### Step 3: Follow Interactive Prompts
The script will ask:
1. **Choose action**: Reset existing admin password (Option 1)
2. **Enter new password**: Must be at least 8 characters
3. **Confirm action**: Type 'CONFIRM' to proceed

#### Step 4: Login with New Password
- Go to your FleetPro login page
- Use admin user ID: `admin`
- Use the new password you just set

### Method 2: Database Direct Reset

If the script doesn't work, you can reset directly through the database:

#### Step 1: Open MongoDB Compass or Atlas
- Connect to your MongoDB database
- Navigate to the `users` collection

#### Step 2: Find Admin User
```javascript
// Find admin user document
db.users.findOne({ role: "admin" })
```

#### Step 3: Generate New Password Hash
```bash
# In terminal, run Node.js
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('YOUR_NEW_PASSWORD', 12)
  .then(hash => console.log('New hash:', hash));
"
```

#### Step 4: Update Admin Password
```javascript
// Update admin password in database
db.users.updateOne(
  { role: "admin" },
  { 
    $set: { 
      password: "PASTE_HASH_HERE",
      mustResetPassword: false,
      sessionId: null
    }
  }
)
```

### Method 3: Create New Admin User

If the admin user is corrupted or missing:

#### Step 1: Run Backup Admin Script
```bash
npx tsx server/recovery-script.ts
```

#### Step 2: Choose Option 2
- Select "Create backup admin user"
- Enter new admin user ID (e.g., "superadmin")
- Enter secure password (min 8 characters)

#### Step 3: Login with New Admin
- Use the new admin credentials you created
- Deactivate the old admin user if needed

### Method 4: Environment Variable Override

For emergency access, you can create a temporary admin override:

#### Step 1: Add Emergency Admin to Environment
```env
EMERGENCY_ADMIN_ID=emergency
EMERGENCY_ADMIN_PASSWORD=YourSecurePassword123
```

#### Step 2: Restart Application
- The system will create an emergency admin user
- Login with emergency credentials
- Reset the main admin password
- Remove emergency credentials

### Method 5: Manual Database Creation

If all else fails, manually create admin user in MongoDB:

```javascript
// Connect to MongoDB and run this command
db.users.insertOne({
  userId: "newadmin",
  password: "$2b$12$hashedPasswordHere", // Use bcrypt to hash
  role: "admin",
  isActive: true,
  mustResetPassword: false,
  createdAt: new Date(),
  lastLogin: null,
  loginIP: null,
  userAgent: null,
  sessionId: null
})
```

## 🛡️ Security Best Practices

### After Password Recovery:

1. **Change Password Immediately**
   - Login with recovered credentials
   - Go to Profile → Security section
   - Set a strong, unique password

2. **Review Security Logs**
   - Check Admin Dashboard → Security Stats
   - Look for any suspicious login attempts
   - Review recent admin activities

3. **Update Recovery Information**
   - Document the new password securely
   - Update any shared admin credentials
   - Inform other authorized personnel

4. **Enable Additional Security**
   - Consider adding 2FA (if implemented)
   - Review admin session timeouts
   - Check IP access restrictions

### Password Requirements:
- **Minimum 8 characters**
- **At least one uppercase letter**
- **At least one lowercase letter**
- **At least one number**
- **At least one special character**

## 🚨 Emergency Contacts

If you're unable to recover admin access:

### Technical Support
- **Email**: support@raydify.in
- **Phone**: +91-7777888220
- **Emergency**: 24/7 support available

### Recovery Support
- **Database Access**: Contact Replit support
- **System Recovery**: Full backup restoration available
- **Data Export**: Emergency data export services

## 📋 Prevention Tips

### Avoid Future Lockouts:

1. **Multiple Admin Users**
   - Create at least 2 admin accounts
   - Use different email addresses
   - Store credentials securely

2. **Regular Password Updates**
   - Change admin passwords every 90 days
   - Use password managers
   - Keep backup recovery codes

3. **Documentation**
   - Maintain secure admin credential records
   - Document recovery procedures
   - Train multiple team members

4. **Backup Plans**
   - Regular database backups
   - Emergency recovery procedures
   - Alternative access methods

## 🔧 Script Commands Summary

```bash
# Reset existing admin password
npx tsx server/recovery-script.ts

# Direct password reset function
node -e "
const { emergencyAdminPasswordReset } = require('./server/admin-recovery');
const connectDB = require('./server/connectDB');
(async () => {
  await connectDB();
  await emergencyAdminPasswordReset('NewSecurePassword123');
  process.exit(0);
})();
"

# Create backup admin
node -e "
const { createBackupAdmin } = require('./server/admin-recovery');
const connectDB = require('./server/connectDB');
(async () => {
  await connectDB();
  await createBackupAdmin('backupadmin', 'SecurePassword123');
  process.exit(0);
})();
"
```

## 📱 Quick Recovery Checklist

- [ ] Try recovery script first
- [ ] Verify database connection
- [ ] Check new password strength
- [ ] Test login immediately
- [ ] Change password after recovery
- [ ] Review security logs
- [ ] Document incident
- [ ] Update backup procedures

---

**Remember**: Admin access is critical for your fleet management system. Always maintain secure backup access methods and document your recovery procedures.