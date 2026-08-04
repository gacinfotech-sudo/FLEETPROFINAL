# FleetPro Deployment Guide

## For Git-based Deployment (Render, Vercel, etc.)

### Required Environment Variables
Set these environment variables in your deployment platform:

```
DATABASE_URL=your_mongodb_connection_string
SESSION_SECRET=your_secure_session_secret_key
NODE_ENV=production
```

### Build Configuration
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Node Version**: 20.x
- **Install Command**: `npm install`

### Platform-Specific Instructions

#### Render
1. Connect your GitHub repository
2. Set Build Command: `npm run build`
3. Set Start Command: `npm run start`
4. Add environment variables listed above
5. Set Node version to 20.x in Environment settings

#### Vercel (Detailed Guide)

**Step 1: Import Project**
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project" 
3. Import from your Git repository (GitHub/GitLab/Bitbucket)
4. Select your FleetPro repository

**Step 2: Configure Project Settings**
- **Framework Preset**: Select "Other" (not Vite, since we have a custom full-stack setup)
- **Root Directory**: Leave as `./` (root)
- **Project Name**: Choose your preferred name (e.g., "fleetpro" or "car-rental-master")

**Step 3: Build and Output Settings**
Click "Build and Output Settings" to expand:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install` (default)

**Step 4: Environment Variables**
Click "Environment Variables" to expand and add:
```
DATABASE_URL = your_mongodb_atlas_connection_string
SESSION_SECRET = your_secure_random_key_here
NODE_ENV = production
```

**Step 5: Deploy**
Click "Deploy" button and wait for the build to complete.

**Important Notes for Vercel:**
- Vercel automatically detects Node.js and will use the correct version
- The build process will install all dependencies and create the production build
- Your app will be available at `https://your-project-name.vercel.app`
- Vercel provides automatic HTTPS and global CDN

**Troubleshooting Vercel Deployment:**
- If build fails, check the build logs in Vercel dashboard
- Ensure all environment variables are set correctly
- MongoDB Atlas must allow connections from 0.0.0.0/0 (all IPs) for Vercel's serverless functions

#### Railway
1. Deploy from GitHub
2. Add environment variables
3. Railway will auto-detect the build configuration

### Database Setup
1. Create a MongoDB Atlas cluster
2. Whitelist your deployment platform's IP addresses (or use 0.0.0.0/0 for simplicity)
3. Create a database user with read/write permissions
4. Get the connection string and set it as DATABASE_URL

### Security Notes
- All security features are production-ready including rate limiting, CSP headers, and brute force protection
- Make sure to use HTTPS in production (most platforms handle this automatically)
- Use a strong SESSION_SECRET (generate with `openssl rand -base64 32`)

### Troubleshooting
- If build fails with "vite not found", the dependencies have been moved to production packages
- If authentication fails, check that SESSION_SECRET is set correctly
- For database connection issues, verify the DATABASE_URL format and IP whitelist

### Features Included in Production Build
- Comprehensive security system with helmet, rate limiting, and brute force protection
- Multi-tenant fleet management with role-based access control
- Subscription plan management (Starter, Pro, Custom)
- Invoice generation and PDF export functionality
- Real-time booking management and revenue tracking
- Mobile-responsive admin panel and client dashboard