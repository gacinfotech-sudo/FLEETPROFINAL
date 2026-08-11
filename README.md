<div align="center">

# 🚛 FleetPro

### *Professional Fleet Management System for Modern Businesses*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[🌐 Live Demo](https://fleetpro.raydify.in) • [📧 Support](mailto:support@raydify.in) • [📱 WhatsApp](https://wa.me/917777888220)

</div>

---

## 📖 Table of Contents

- [✨ Overview](#-overview)
- [🎯 Key Features](#-key-features)
- [🏗️ System Architecture](#️-system-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [👥 User Roles](#-user-roles)
- [📦 Installation](#-installation)
- [🚀 Getting Started](#-getting-started)
- [📂 Project Structure](#-project-structure)
- [🔌 API Documentation](#-api-documentation)
- [💳 Subscription Plans](#-subscription-plans)
- [🔐 Security Features](#-security-features)
- [📊 Dashboard Features](#-dashboard-features)
- [📱 Mobile & PWA Support](#-mobile--pwa-support)
- [📄 Reports & Exports](#-reports--exports)
- [🗄️ Database Schema](#️-database-schema)
- [🌐 Multi-Tenant Architecture](#-multi-tenant-architecture)
- [📈 Changelog](#-changelog)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Overview

**FleetPro** is a comprehensive multi-tenant fleet management system designed specifically for taxi and car rental businesses. Built with modern web technologies, it provides a complete solution for managing vehicles, drivers, bookings, revenue tracking, and team collaboration—all through an intuitive web interface.

### 🌟 Why FleetPro?

- 🏢 **Multi-Tenant Architecture** - Manage multiple businesses from one platform
- 👥 **Role-Based Access** - Admin, Client, and Manager roles with granular permissions
- 📱 **Mobile-First Design** - Fully responsive interface for on-the-go management
- 🔒 **Enterprise Security** - Advanced security features with audit trails
- 📊 **Smart Analytics** - Real-time revenue tracking and fleet utilization reports
- 📄 **Professional Invoicing** - Customizable PDF invoices with company branding
- 🌐 **PWA Support** - Install as a mobile app with offline capabilities
- 🔔 **WhatsApp Integration** - Share booking confirmations and invoices instantly

---

## 🎯 Key Features

### 🚗 Fleet Management
- ✅ Comprehensive vehicle inventory with specifications
- ✅ Multiple pricing models (per day, per kilometer)
- ✅ Vehicle availability tracking and status management
- ✅ Support for various vehicle types (Sedan, SUV, Hatchback, etc.)
- ✅ Real-time fleet utilization analytics
- ✅ Vehicle-wise revenue performance tracking

### 👨‍✈️ Driver Management
- ✅ Complete driver profiles with license details
- ✅ Additional fields (addresses, documents, date of joining)
- ✅ Driver availability and assignment tracking
- ✅ Third-party driver support with charge management
- ✅ Driver performance metrics

### 📅 Booking System
- ✅ Multi-step booking creation wizard
- ✅ Support for self-drive and chauffeur-driven options
- ✅ Local trips and "not decided yet" destination support
- ✅ Real-time pricing calculations
- ✅ Editable charges (fuel, toll, parking, miscellaneous)
- ✅ Automatic booking completion based on return dates
- ✅ Background scheduler for status updates
- ✅ Booking cancellation with reason tracking
- ✅ Audit trail (created by, creation timestamp)

### 💰 Revenue & Analytics
- ✅ Real-time revenue dashboard
- ✅ Multiple time period filters (Today, Week, Month, Quarter, Year)
- ✅ Fleet utilization percentage calculation
- ✅ Vehicle performance analytics
- ✅ Revenue breakdown by booking status
- ✅ Expense tracking and reporting

### 📄 PDF Reports & Exports
- ✅ **Booking Confirmations** - Professional e-receipts with safety notices
- ✅ **Invoices** - Customizable invoices with company branding
- ✅ **Revenue Reports** - 3-page professional reports with charts
- ✅ **Booking History** - Landscape format comprehensive reports
- ✅ WhatsApp sharing for all documents
- ✅ Auto-generated invoice numbers

### 👥 Team Collaboration
- ✅ Sub-user management (managers)
- ✅ Granular permission system
- ✅ Manager limits based on subscription plans
- ✅ Role-based dashboard access
- ✅ Activity tracking and audit logs

### 🏢 Business Profile
- ✅ Company branding with logo upload (base64 storage)
- ✅ Custom business information
- ✅ Digital signature for invoices
- ✅ Profile inheritance for managers
- ✅ Professional document generation

### 🔐 Advanced Security
- ✅ Password strength validation (8+ chars, mixed case, numbers, symbols)
- ✅ Brute force protection (5 failed attempts lockout)
- ✅ Rate limiting (5 requests/min)
- ✅ Session hijacking protection
- ✅ XSS and NoSQL injection prevention
- ✅ IP-based blocking for suspicious activity
- ✅ Comprehensive security monitoring dashboard
- ✅ Login attempt tracking with IP and user agent

---

## 🏗️ System Architecture

```mermaid
graph TB
    A[Client Browser/PWA] -->|HTTPS| B[React Frontend]
    B -->|API Calls| C[Express Server]
    C -->|Mongoose ODM| D[MongoDB Atlas]
    B -->|TanStack Query| C
    C -->|Session Store| D
    E[Admin] -->|Manages| F[Multiple Tenants]
    F -->|Contains| G[Clients & Managers]
    G -->|Manage| H[Fleet, Drivers, Bookings]
    C -->|Background Jobs| I[Booking Status Scheduler]
    C -->|Security| J[Rate Limiter & Auth]
```

### Architecture Highlights

**Frontend Layer**
- React 18 with TypeScript for type-safe development
- Vite for lightning-fast builds and HMR
- Wouter for lightweight client-side routing
- TanStack Query for efficient server state management
- Radix UI + shadcn/ui for accessible components
- Tailwind CSS for modern, responsive styling

**Backend Layer**
- Node.js with Express.js framework
- MongoDB Atlas with Mongoose ODM
- Session-based authentication with secure cookies
- Role-based middleware for tenant isolation
- Background schedulers for automated tasks
- RESTful API design with proper error handling

**Security Layer**
- Helmet for HTTP security headers
- Rate limiting and progressive slow-down
- Brute force protection with account lockout
- Input sanitization and XSS prevention
- NoSQL injection protection
- Session fingerprinting
- Comprehensive audit logging

---

## 🛠️ Tech Stack

<div align="center">

### Frontend Technologies

![React](https://img.shields.io/badge/-React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/-Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/-Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Radix UI](https://img.shields.io/badge/-Radix_UI-161618?style=flat-square&logo=radix-ui&logoColor=white)
![Wouter](https://img.shields.io/badge/-Wouter-FF6B6B?style=flat-square)

### Backend Technologies

![Node.js](https://img.shields.io/badge/-Node.js_20-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/-Express.js-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/-MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/-Mongoose-880000?style=flat-square&logo=mongoose&logoColor=white)
![Bcrypt](https://img.shields.io/badge/-Bcrypt-003B57?style=flat-square)

### UI & Utilities

![React Hook Form](https://img.shields.io/badge/-React_Hook_Form-EC5990?style=flat-square&logo=react-hook-form&logoColor=white)
![Zod](https://img.shields.io/badge/-Zod-3E67B1?style=flat-square)
![Lucide](https://img.shields.io/badge/-Lucide_Icons-F56565?style=flat-square)
![date-fns](https://img.shields.io/badge/-date--fns-770C56?style=flat-square)
![html2pdf](https://img.shields.io/badge/-html2pdf.js-E34F26?style=flat-square)

### Security & Monitoring

![Helmet](https://img.shields.io/badge/-Helmet-4A90E2?style=flat-square)
![Express Rate Limit](https://img.shields.io/badge/-Rate_Limiter-FF6B6B?style=flat-square)
![Connect PG Simple](https://img.shields.io/badge/-Session_Store-336791?style=flat-square)

</div>

---

## 👥 User Roles

### 🔴 Admin (Super User)
**Full System Access**
- Manage multiple tenant accounts
- Create and deactivate client businesses
- Password reset functionality for clients
- View all tenant data and statistics
- Configure subscription plans
- Access security monitoring dashboard
- Manage system-wide settings

### 🔵 Client (Business Owner)
**Complete Business Management**
- Full control over their company data
- Manage fleet (vehicles)
- Manage drivers
- Create and manage bookings
- Generate invoices and reports
- Access revenue analytics
- Manage sub-users (managers)
- Configure business profile
- View complete audit trails

### 🟢 Manager (Team Member)
**Operational Access**
- Create and edit bookings
- View booking history
- Generate invoices
- View fleet and driver information
- **Restricted from:**
  - Adding/editing/deleting vehicles
  - Managing drivers
  - Viewing revenue reports
  - Managing business profile
  - Adding other managers

### Permission System

Managers have granular permissions:
- `create_booking` - Create new bookings
- `delete_booking` - Delete existing bookings
- `generate_invoice` - Generate customer invoices
- `view_bookings` - View booking history
- `edit_booking` - Edit booking details

---

## 📦 Installation

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** or **yarn** or **pnpm**
- **MongoDB Atlas** account (or local MongoDB)
- Valid **SSL certificate** (for production)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/fleetpro.git
cd fleetpro

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Environment Configuration

Create a `.env` file:

```env
# MongoDB Connection
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/fleetpro

# Session Configuration
SESSION_SECRET=your-super-secure-secret-key-here

# Server Configuration
PORT=5000
NODE_ENV=development

# Security (Production)
TRUST_PROXY=true

# Optional: Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## 🚀 Getting Started

### Development Mode

```bash
# Start development server with hot reload
npm run dev
```

The application will be available at:
- Frontend: `http://localhost:5000`
- API: `http://localhost:5000/api`

### Production Build

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

### Database Setup

The application automatically creates necessary collections on first run. Default admin credentials will be displayed in console on first startup.

### First-Time Setup

1. **Admin Login**: Use default admin credentials
2. **Create Client**: Add your first business client
3. **Client Login**: Login with client credentials
4. **Complete Onboarding**: Follow 7-step welcome wizard
5. **Configure Profile**: Set up business information and logo
6. **Add Fleet**: Add your vehicles
7. **Add Drivers**: Add driver profiles
8. **Create Bookings**: Start managing bookings

---

## 📂 Project Structure

```
fleetpro/
├── 📁 client/                    # React frontend application
│   ├── 📁 src/
│   │   ├── 📁 components/        # Reusable UI components
│   │   │   ├── 📁 ui/           # shadcn/ui components
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── ClientDashboard.tsx
│   │   │   ├── ManagerDashboard.tsx
│   │   │   ├── InvoiceGenerator.tsx
│   │   │   ├── RevenueReport.tsx
│   │   │   └── WelcomeWizard.tsx
│   │   ├── 📁 pages/            # Page components
│   │   │   ├── LandingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── PasswordReset.tsx
│   │   ├── 📁 hooks/            # Custom React hooks
│   │   │   ├── use-auth.ts
│   │   │   ├── use-toast.ts
│   │   │   └── use-permissions.ts
│   │   ├── 📁 lib/              # Utilities & helpers
│   │   │   ├── queryClient.ts
│   │   │   └── utils.ts
│   │   └── 📄 main.tsx          # Application entry
│   └── 📄 index.html
├── 📁 server/                    # Express backend
│   ├── 📁 routes/               # API route handlers
│   │   ├── auth.ts              # Authentication
│   │   ├── admin.ts             # Admin operations
│   │   ├── vehicles.ts          # Vehicle management
│   │   ├── drivers.ts           # Driver management
│   │   ├── bookings.ts          # Booking operations
│   │   └── users.ts             # User management
│   ├── 📁 models/               # MongoDB models
│   │   ├── User.ts
│   │   ├── Tenant.ts
│   │   ├── Vehicle.ts
│   │   ├── Driver.ts
│   │   └── Booking.ts
│   ├── 📁 middleware/           # Custom middleware
│   │   ├── auth.ts              # Authentication
│   │   ├── security.ts          # Security features
│   │   └── rateLimiter.ts       # Rate limiting
│   ├── 📁 services/             # Business logic
│   │   └── scheduler.ts         # Background jobs
│   └── 📄 index.ts              # Server entry
├── 📁 uploads/                   # Upload directory
│   └── 📁 logos/                # Company logos
├── 📁 public/                    # Static assets
│   ├── 📄 robots.txt
│   ├── 📄 sitemap.xml
│   └── 📄 manifest.json
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 vite.config.ts
├── 📄 tailwind.config.js
└── 📄 SECURITY_GUIDE.md         # Security documentation
```

---

## 🔌 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/login` | User login | Public |
| `POST` | `/api/auth/logout` | User logout | Authenticated |
| `GET` | `/api/auth/me` | Get current user | Authenticated |
| `POST` | `/api/auth/reset-password` | Password reset | Authenticated |
| `GET` | `/api/auth/business-profile` | Get business profile | Client/Manager |
| `POST` | `/api/auth/business-profile` | Update business profile | Client |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/tenants` | List all tenants |
| `POST` | `/api/admin/tenants` | Create new tenant |
| `DELETE` | `/api/admin/tenants/:id` | Delete tenant |
| `POST` | `/api/admin/tenants/:id/deactivate` | Deactivate tenant |
| `POST` | `/api/admin/tenants/:id/activate` | Activate tenant |
| `POST` | `/api/admin/reset-password` | Reset client password |
| `GET` | `/api/admin/security/login-attempts` | View login attempts |
| `GET` | `/api/admin/stats` | System statistics |

### Vehicle Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/vehicles` | List vehicles |
| `POST` | `/api/vehicles` | Create vehicle |
| `PUT` | `/api/vehicles/:id` | Update vehicle |
| `DELETE` | `/api/vehicles/:id` | Delete vehicle |

### Driver Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/drivers` | List drivers |
| `POST` | `/api/drivers` | Create driver |
| `PUT` | `/api/drivers/:id` | Update driver |
| `DELETE` | `/api/drivers/:id` | Delete driver |

### Booking Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bookings` | List bookings |
| `POST` | `/api/bookings` | Create booking |
| `PUT` | `/api/bookings/:id` | Update booking |
| `DELETE` | `/api/bookings/:id` | Delete booking |
| `POST` | `/api/bookings/:id/cancel` | Cancel booking |
| `GET` | `/api/bookings/stats` | Booking statistics |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/sub-users` | List sub-users |
| `POST` | `/api/users/sub-users` | Create sub-user |
| `PUT` | `/api/users/sub-users/:id` | Update sub-user |
| `DELETE` | `/api/users/sub-users/:id` | Delete sub-user |

### Revenue & Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/revenue/report` | Generate revenue report |
| `GET` | `/api/revenue/stats` | Revenue statistics |

---

## 💳 Subscription Plans

### 📦 Starter Plan
**Perfect for Small Businesses**

- ✅ **6 Vehicles**
- ✅ **3 Drivers**
- ✅ **1 Manager**
- ✅ Basic Analytics
- ✅ Standard Invoice Templates
- ✅ Email Support
- ✅ WhatsApp Integration

**Ideal for**: New businesses, small taxi services

---

### 🚀 Pro Plan
**For Growing Businesses**

- ✅ **40 Vehicles**
- ✅ **60 Drivers**
- ✅ **20 Managers**
- ✅ Advanced Analytics
- ✅ Custom Invoice Templates
- ✅ Priority Support
- ✅ WhatsApp Integration
- ✅ Revenue Insights
- ✅ Fleet Optimization

**Ideal for**: Established rental companies, large taxi fleets

---

### 💎 Custom Plan
**Enterprise Solution**

- ✅ **Unlimited Vehicles**
- ✅ **Unlimited Drivers**
- ✅ **Unlimited Managers**
- ✅ Custom Features
- ✅ Dedicated Account Manager
- ✅ API Access
- ✅ Custom Integrations
- ✅ White-label Options
- ✅ 24/7 Priority Support

**Ideal for**: Enterprise fleets, franchise operations

---

## 🔐 Security Features

### Authentication & Authorization
- ✅ **Session-based authentication** with secure HTTP-only cookies
- ✅ **Password strength validation** (8+ chars, uppercase, lowercase, numbers, symbols)
- ✅ **Bcrypt hashing** for password storage
- ✅ **Role-based access control** (Admin, Client, Manager)
- ✅ **Permission system** for granular access
- ✅ **Device-specific sessions** (prevents concurrent logins from different devices)
- ✅ **30-day session persistence** for PWA support

### Attack Prevention
- ✅ **Brute force protection** - 5 failed attempts lockout
- ✅ **Rate limiting** - 5 requests/min per IP
- ✅ **Progressive slow-down** - Increasing delays for repeated requests
- ✅ **XSS prevention** - Input sanitization and CSP headers
- ✅ **NoSQL injection protection** - Query sanitization
- ✅ **Session hijacking protection** - Fingerprinting and validation
- ✅ **IP-based blocking** - Automatic blocking of suspicious IPs

### Security Headers (Helmet)
```javascript
Content-Security-Policy
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security
Referrer-Policy: no-referrer
```

### Monitoring & Audit
- ✅ **Login attempt tracking** with IP and user agent
- ✅ **Security incident logging**
- ✅ **Audit trail** for all bookings (created by, timestamp)
- ✅ **Admin security dashboard**
- ✅ **Real-time threat detection**

### Data Security
- ✅ **Tenant isolation** - Complete data separation
- ✅ **Base64 file storage** - No file system dependencies
- ✅ **Encrypted sessions** - Secure session storage
- ✅ **HTTPS enforcement** in production
- ✅ **Environment variable protection**

---

## 📊 Dashboard Features

### Admin Dashboard
- 📈 System-wide statistics (total tenants, vehicles, bookings)
- 👥 Tenant management interface
- 🔐 Password reset tools
- 📊 Security monitoring
- ⚙️ System configuration

### Client Dashboard
- 📊 Business overview (available vehicles, active drivers, revenue)
- 🚗 Fleet management (add, edit, delete vehicles)
- 👨‍✈️ Driver management
- 📅 Booking creation and management
- 💰 Revenue analytics with multiple time periods
- 📄 Invoice generation
- 👥 Sub-user (manager) management
- 🏢 Business profile configuration
- 🔐 Security dashboard

### Manager Dashboard
- 📅 Booking creation and editing
- 📋 Booking history with filters
- 📄 Invoice generation
- 👀 View-only fleet and driver information
- 🔒 **No access to**: Revenue reports, profile management, fleet editing

---

## 📱 Mobile & PWA Support

### Progressive Web App Features
- ✅ **Installable** - Add to home screen on mobile devices
- ✅ **Offline detection** - Animated modal with connection status
- ✅ **Session persistence** - 30-day sessions across app closures
- ✅ **Responsive design** - Optimized for all screen sizes
- ✅ **Touch-friendly** - Large buttons and easy navigation
- ✅ **Fast loading** - Optimized bundle sizes

### Mobile Optimizations
- ✅ Horizontal navbar for better mobile UX
- ✅ Collapsible sections and accordions
- ✅ Touch-optimized forms
- ✅ Mobile-friendly modals and dialogs
- ✅ Responsive tables with horizontal scroll
- ✅ Bottom sheet-style navigation

### Offline Capabilities
- ✅ Continue working during connection issues
- ✅ localStorage-based session recovery
- ✅ Retry connection functionality
- ✅ Network status indicator
- ✅ Graceful error handling

---

## 📄 Reports & Exports

### 1. Booking Confirmation E-Receipt
**Professional booking confirmation with safety notices**

- Customer details
- Booking ID (prominent display)
- Vehicle information
- Trip details
- Safety notices (amber warning box)
- Contact information footer
- WhatsApp sharing capability

### 2. Customer Invoices
**Customizable invoices with company branding**

- Auto-generated invoice number (INV-YYYYMMDD/BookingID)
- Company logo and details
- Customer information
- Vehicle and service details
- Itemized charges breakdown
- Base fare, fuel, toll, parking, miscellaneous
- Third-party driver charges (if applicable)
- Grand total calculation
- Professional layout matching mockup design
- WhatsApp sharing

### 3. Revenue Reports (3-Page PDF)
**Comprehensive business analytics**

**Page 1: Revenue Summary**
- Total revenue with period comparison
- Number of bookings
- Average booking value
- Fleet utilization percentage

**Page 2: Revenue Breakdown**
- Revenue by booking status (Confirmed, Completed, Cancelled)
- Vehicle performance table
- Top performing vehicles

**Page 3: Expense Details**
- Booking-wise expense breakdown
- Fuel charges, toll, parking
- Third-party driver charges
- Total expenses summary

### 4. Booking History Export
**Landscape-format comprehensive report**

- Company branding in header and footer
- Complete booking list with all details
- Customer information
- Vehicle details
- Trip dates and locations
- Amounts with INR formatting
- Status indicators
- Created by and timestamp
- Summary statistics boxes

### PDF Generation Features
- ✅ Professional A4/landscape layouts
- ✅ Company logo integration (base64)
- ✅ Clean, print-ready formatting
- ✅ Proper pagination
- ✅ Currency formatting (₹)
- ✅ Alternating row colors in tables
- ✅ WhatsApp sharing integration
- ✅ Error handling with user notifications

---

## 🗄️ Database Schema

### MongoDB Collections

#### Tenants (Clients/Companies)
```javascript
{
  _id: ObjectId,
  companyName: String,
  contactEmail: String,
  contactPhone: String,
  isActive: Boolean,
  subscriptionPlan: String, // 'starter', 'pro', 'custom'
  maxVehicles: Number,
  maxDrivers: Number,
  maxManagers: Number,
  businessDetails: {
    logo: String (base64),
    address: String,
    signature: String (base64),
    // ... other business info
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Users
```javascript
{
  _id: ObjectId,
  userId: String (unique),
  password: String (hashed),
  role: String, // 'admin', 'client', 'manager'
  tenantId: ObjectId,
  parentUserId: ObjectId, // For managers
  isActive: Boolean,
  requirePasswordReset: Boolean,
  failedLoginAttempts: Number,
  lastFailedLogin: Date,
  accountLockedUntil: Date,
  hasCompletedOnboarding: Boolean,
  permissions: [String], // For managers
  createdAt: Date,
  updatedAt: Date
}
```

#### Vehicles
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  make: String (required),
  model: String,
  year: Number,
  registrationNumber: String,
  type: String, // 'sedan', 'suv', 'hatchback', etc.
  seats: Number,
  transmission: String,
  fuelType: String,
  ratePerDay: Number,
  ratePerKilometer: Number,
  status: String, // 'available', 'booked', 'maintenance'
  createdAt: Date,
  updatedAt: Date
}
```

#### Drivers
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  name: String (required),
  phone: String,
  email: String,
  licenseNumber: String,
  licenseExpiry: Date,
  status: String, // 'available', 'on-trip', 'off-duty'
  permanentAddress: String,
  currentAddress: String,
  maritalStatus: String,
  aadharNumber: String,
  panNumber: String,
  dateOfJoining: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Bookings
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  bookingId: String (unique),
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  vehicleId: ObjectId,
  driverId: ObjectId (optional),
  pickupLocation: String,
  dropoffLocation: String,
  pickupDate: Date,
  pickupTime: String,
  returnDate: Date,
  returnTime: String,
  tripType: String, // 'self-drive', 'with-driver'
  status: String, // 'confirmed', 'completed', 'cancelled'
  baseAmount: Number,
  pricingType: String, // 'per-day', 'per-km'
  totalKilometers: Number,
  fuelCharges: Number,
  tollCharges: Number,
  parkingCharges: Number,
  miscExpenses: Number,
  miscDescription: String,
  useThirdPartyDriver: Boolean,
  thirdPartyDriverName: String,
  thirdPartyDriverCharges: Number,
  totalAmount: Number,
  cancellationReason: String,
  createdBy: String, // User email
  createdByRole: String, // 'client', 'manager'
  createdAt: Date,
  updatedAt: Date
}
```

#### Login Attempts (Security)
```javascript
{
  _id: ObjectId,
  userId: String,
  ipAddress: String,
  userAgent: String,
  success: Boolean,
  failureReason: String,
  timestamp: Date
}
```

---

## 🌐 Multi-Tenant Architecture

### Tenant Isolation Strategy

FleetPro implements strict tenant isolation to ensure complete data security and privacy between businesses.

#### How It Works

1. **Tenant Assignment**
   - Each client business is assigned a unique `tenantId`
   - All resources (vehicles, drivers, bookings) are tagged with `tenantId`
   - Managers inherit `tenantId` from their parent client

2. **Middleware Protection**
   ```javascript
   // Every API call is filtered by tenant
   const vehicles = await Vehicle.find({ tenantId: req.user.tenantId });
   ```

3. **Database Queries**
   - All queries automatically include tenant filter
   - No cross-tenant data leakage possible
   - MongoDB indexes on `tenantId` for performance

4. **Session Management**
   - Sessions store `tenantId` and `role`
   - Middleware validates tenant access on every request
   - Admins can access all tenants, others are restricted

5. **API Security**
   ```javascript
   // Example middleware
   const requireTenant = (req, res, next) => {
     if (req.user.role === 'admin') return next();
     if (!req.user.tenantId) return res.status(403).json({ error: 'No tenant access' });
     next();
   };
   ```

### Benefits

- ✅ **Complete Data Isolation** - No business can see another's data
- ✅ **Scalable** - Add unlimited tenants without performance issues
- ✅ **Secure** - Multiple layers of tenant validation
- ✅ **Flexible** - Easy to add new tenant-specific features
- ✅ **Maintainable** - Single codebase for all businesses

---

## 📈 Changelog

<details>
<summary><b>🗓️ View Full Development History</b></summary>

### 2025

**July 18**
- 🔧 Suppressed Rollup bundle size warnings during development

**July 17**
- 🔄 Fixed authentication infinite loop and session management
- 🌐 Implemented PWA session persistence (30-day sessions)
- 📡 Added comprehensive offline detection system
- ⚠️ Implemented safety confirmations for critical admin actions
- 🐛 Fixed blank screen issue by removing WebSocket dependencies

**July 16**
- 💰 Fixed toll and parking charges to deduct from base amount

**July 12**
- 🚗 Implemented third-party driver functionality
- 🐛 Fixed critical revenue calculation bugs
- 💼 Added comprehensive salary management

**July 9**
- 📝 Enhanced driver form with additional fields
- 🗑️ Removed proof of address upload section

**July 8**
- 🖼️ Fixed logo persistence using base64 storage
- 📄 Enhanced PDF exports with company branding
- 🧹 Performed comprehensive codebase cleanup

**July 7**
- 👥 Fixed manager profile inheritance system
- 🔐 Enhanced manager privacy controls
- 🐛 Fixed sub-user creation and session management
- 📄 Corrected PDF layout issues

**July 5**
- 📊 Redesigned revenue report with 3-page layout
- 🔍 Implemented comprehensive SEO optimization
- 🛡️ Added enterprise-grade security system

**July 2**
- 🔐 Implemented comprehensive security system
- 💳 Added subscription plan management
- 🔑 Enhanced authentication with brute force protection
- 🚪 Fixed logout and password reset issues

**July 1**
- 🎓 Created first-time login welcome wizard
- 📊 Implemented manager limit business logic
- 💰 Fixed revenue report date filtering
- 🌐 Created professional landing page

**June 30**
- 👥 Implemented role-based access control system
- 🔒 Enhanced manager role restrictions
- 📝 Added booking audit trail system
- 🏢 Implemented business profile with logo upload

**June 29**
- 🔗 Implemented URL-based navigation
- 🔽 Enhanced booking history sorting (newest first)
- 🎯 Fixed filter functionality
- 📊 Fixed fleet utilization calculation
- 🔔 Enhanced toast notification system
- 📱 Added WhatsApp sharing functionality
- 📄 Implemented comprehensive invoice generator

**June 28**
- 🔄 Migrated from PostgreSQL to MongoDB Atlas
- 🐛 Fixed tenant access and vehicle display issues
- 💰 Enhanced pricing preference selection
- 📄 Added invoice download functionality
- 💵 Implemented miscellaneous expenses
- 🔐 Restored admin panel functionality

**June 27**
- 📍 Added location-based booking system
- 💰 Enhanced revenue calculations
- 📄 Implemented PDF export for revenue reports
- 🔐 Added first-time login password reset
- 👤 Implemented user activation/deactivation

**June 26**
- 🚀 Initial setup and dashboard redesign
- 📊 Fixed stats calculations
- 📅 Added time fields to bookings
- ⏰ Implemented background scheduler
- 💅 Enhanced login page design
- 📄 Added PDF export for booking history

</details>

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute

1. **🐛 Report Bugs** - Submit detailed issue reports
2. **💡 Suggest Features** - Share your ideas for improvements
3. **📝 Improve Documentation** - Help us make docs better
4. **🔧 Submit Pull Requests** - Fix bugs or add features
5. **🧪 Testing** - Help test new features
6. **🌍 Translations** - Add language support

### Contribution Guidelines

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **Commit** your changes
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. **Push** to the branch
   ```bash
   git push origin feature/AmazingFeature
   ```
5. **Open** a Pull Request

### Code Standards

- ✅ TypeScript strict mode
- ✅ ESLint configuration
- ✅ Prettier formatting
- ✅ Meaningful commit messages
- ✅ Component documentation
- ✅ Unit tests for new features
- ✅ Update changelog

### Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type checking
npm run check

# Linting
npm run lint

# Format code
npm run format
```

---

## 🐛 Known Issues & Roadmap

### Known Issues

- [ ] Large PDF exports (>100 pages) may have performance issues
- [ ] WhatsApp sharing requires phone number validation
- [ ] Session recovery in PWA mode needs user interaction

### Upcoming Features

- [ ] **Mobile App** - Native iOS and Android apps
- [ ] **Payment Integration** - Online payment gateway
- [ ] **SMS Notifications** - Booking confirmations via SMS
- [ ] **GPS Tracking** - Real-time vehicle tracking
- [ ] **Fuel Management** - Fuel expense tracking
- [ ] **Maintenance Alerts** - Automated vehicle maintenance reminders
- [ ] **Customer Portal** - Self-service booking for customers
- [ ] **Multi-language Support** - Regional language options
- [ ] **API Access** - RESTful API for integrations
- [ ] **Expense Management** - Comprehensive expense tracking
- [ ] **Advanced Analytics** - Predictive analytics and insights

---

## 📚 Additional Resources

### Documentation

- 📖 [API Documentation](./docs/API.md)
- 🔐 [Security Guide](./SECURITY_GUIDE.md)
- 🚀 [Deployment Guide](./docs/DEPLOYMENT.md)
- 💡 [Feature Guide](./docs/FEATURES.md)
- 🎨 [UI/UX Guidelines](./docs/UI_GUIDELINES.md)

### Support

- 📧 **Email Support**: support@raydify.in
- 💬 **WhatsApp**: +91 7777888220
- 🌐 **Website**: [raydify.in](https://raydify.in)
- 📱 **Live Demo**: [fleetpro.raydify.in](https://fleetpro.raydify.in)

### Community

- 💡 [GitHub Discussions](https://github.com/yourusername/fleetpro/discussions)
- 🐛 [Issue Tracker](https://github.com/yourusername/fleetpro/issues)
- 📢 [Changelog](https://github.com/yourusername/fleetpro/releases)

---

## 🏆 Credits & Acknowledgments

### Built With

Special thanks to the open-source community and these amazing projects:

- [React](https://reactjs.org/) - UI framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Express.js](https://expressjs.com/) - Backend framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - UI primitives
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [TanStack Query](https://tanstack.com/query) - Data fetching
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) - PDF generation

### Team

Developed and maintained by **Raydify Technologies**

- Product Design & Development
- Security & Infrastructure
- Customer Support & Success

---

## 📄 License

This project is proprietary software owned by **Raydify Technologies**. All rights reserved.

### License Terms

- ✅ Licensed for use as per subscription agreement
- ✅ Source code access for licensees only
- ❌ No redistribution without permission
- ❌ No commercial use without license
- ❌ No derivative works without authorization

For licensing inquiries, contact: support@raydify.in

---

## 🔒 Security

### Reporting Security Issues

If you discover a security vulnerability, please email us at:
**security@raydify.in**

Please **DO NOT** create a public GitHub issue for security vulnerabilities.

### Security Response

- We take all security reports seriously
- Response within 24 hours
- Fix deployment within 48 hours for critical issues
- Public disclosure after fix deployment

---

<div align="center">

## 💬 Get in Touch

**FleetPro by Raydify Technologies**

🌐 [fleetpro.raydify.in](https://fleetpro.raydify.in) | 📧 [support@raydify.in](mailto:support@raydify.in)

📱 **Call/WhatsApp**: [+91 7777888220](tel:+917777888220)

📍 **Office**: Gurugram, Haryana, India

---

### ⭐ Star this repo if FleetPro helps your business!

### 🚀 Ready to transform your fleet management?

[Get Started →](https://fleetpro.raydify.in)

---

[![Made with ❤️ by Krishna Gurjar](https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F%20by-Raydify-blue?style=for-the-badge)](https://raydify.in)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)](https://fleetpro.raydify.in)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge)](https://github.com/yourusername/fleetpro/releases)

**© 2025 Raydify Technologies. All rights reserved.**

</div>
