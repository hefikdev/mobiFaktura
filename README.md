# mobiFaktura

Professional Polish invoice and financial management system built with modern web technologies. Designed for businesses to streamline invoice processing, budget management, and financial workflows with role-based access control.

## 🎯 Project Overview

mobiFaktura is an enterprise-grade financial management platform that enables:

- **Users** to upload and track invoices, request budget increases, manage advances, and monitor their balance (saldo)
- **Accountants** to review and process invoices, budget requests, advances, and corrections with bulk operations and comprehensive reporting
- **Admins** to manage users, companies, permissions, and oversee all system operations with analytics

The system features comprehensive financial workflows including invoice management (e-invoices, receipts, corrections), budget request system, advance payments (zaliczki), balance tracking (saldo), KSeF integration for Polish e-invoicing, and complete audit trails.

## 🏗️ Architecture

### Frontend
- **Next.js 16** - React framework with App Router for optimal performance
- **TypeScript** - Full type safety across the application
- **Tailwind CSS** - Utility-first CSS for responsive design
- **Shadcn/UI** - Unstyled, accessible component library
- **React Query** - Server state management and caching
- **tRPC Client** - End-to-end type-safe API client

### Backend
- **tRPC** - Type-safe Remote Procedure Calls with automatic validation
- **Drizzle ORM** - Type-safe SQL query builder with migrations
- **Zod** - Runtime schema validation for all inputs
- **Next.js API Routes** - Serverless backend functions

### Infrastructure
- **PostgreSQL 16** - Primary relational database with performance indexing
- **SeaweedFS S3** - Distributed S3-compatible object storage for invoice files
- **Docker & Docker Compose** - Containerization for development and production
- **Node.js 20** - JavaScript runtime with Alpine Linux for minimal image size

### Security & Authentication
- **Argon2id** - Industry-standard password hashing (winner of Password Hashing Competition 2015)
- **JWT Sessions** - Stateful session management with database validation
- **CSRF Protection** - Origin-based CSRF validation on all mutations
- **Login Attempt Lockout** - Account lockout after 3 failed attempts (30-second cooldown)

## 📋 Core Features

### 👤 User Management
- **Role-based access control** (User, Accountant, Admin)
- **Secure authentication** with Argon2id password hashing
- **Session management** with 60-day expiration
- **Multi-company support** with per-company permissions
- **Emergency super admin** account for disaster recovery
- **Login tracking & lockout** after 3 failed attempts
- **Audit trail** for all user actions

### 📄 Invoice Management
- **Multiple invoice types**: E-invoices, receipts (paragons), corrections
- **Status workflow**: Pending → In Review → Accepted/Rejected → Transferred → Settled
- **KSeF integration**: Direct upload to Polish e-invoicing system with QR code scanning
- **Bulk operations**: Approve/reject multiple invoices at once
- **Edit history**: Complete audit trail of all changes
- **Advanced search & filters**: By company, date, status, amount, type, KSeF number
- **File storage**: Secure S3-compatible SeaweedFS storage with image preview and zoom

### 💰 Financial Management
- **Saldo (Balance) System**: Per-user balance tracking with transaction history
- **Budget Requests**: Users request balance increases, accountants approve/reject/settle
- **Advances (Zaliczki)**: Track advance payments with transfer dates and settlement
- **Corrections**: Create correction invoices that automatically adjust user balances
- **Transaction Ledger**: Complete history of all balance changes with references

### 📊 Reporting & Analytics
- **Analytics Dashboard**: Visual charts for invoices, budget requests, saldo trends
- **Advanced Export System**: Generate Excel/PDF reports for invoices, advances, budget requests, saldo, corrections
- **Customizable filters**: Date ranges, companies, statuses, users
- **Performance metrics**: Submission rates, review times, approval rates

### 🧾 Accounting Operations
- **Unified Review Dashboard**: All pending items (invoices, budget requests) in one view
- **Multi-accountant workflow**: Concurrent reviews with conflict resolution
- **Bulk actions**: Process multiple items efficiently
- **Quality control**: Rejection reasons, review comments
- **Status management**: Mark invoices as transferred/settled after payment

### 🔧 Admin Functions
- **User & Company Management**: Create, edit, deactivate users and companies
- **Permission Management**: Assign users to specific companies
- **Bulk Data Operations**: Delete old invoices, budget requests, notifications
- **System Monitoring**: View system stats, storage usage
- **Notification Management**: System-wide announcements

### 🔔 Notification System
- **In-app notifications**: Real-time alerts for status changes
- **Customizable preferences**: Users control which notifications they receive
- **Sound alerts**: Optional audio notifications (can be disabled)
- **Auto-cleanup**: Old notifications deleted after 2 days

### 🔒 Security & Compliance
- **Argon2id password hashing**: Industry-leading password security
- **CSRF protection**: Origin-based validation on all mutations
- **JWT sessions**: Secure httpOnly cookies with database validation
- **Data encryption**: Secure storage for all sensitive data
- **Audit logging**: Complete trail of all system actions
- **GDPR compliant**: Data retention policies and cleanup

### ⚙️ Technical Features
- **Progressive Web App (PWA)**: Install as native app, offline capability
- **Real-time Updates**: Optimistic UI with automatic refetching
- **Type Safety**: Full end-to-end TypeScript with tRPC
- **Performance Optimized**: Image optimization, lazy loading, code splitting
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Mode**: Full dark theme support
- **Database Migrations**: Version-controlled schema changes
- **Automated Cleanup**: Daily maintenance tasks (sessions, logs, notifications)

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Start services (PostgreSQL, SeaweedFS S3)
docker-compose up -d

# 3. Initialize database
npm run db:push

# 4. Seed test data
npm run db:seed

# 5. Start development server
npm run dev
```

Visit: http://localhost:3000

**Test Accounts (from seeding):**
- **User**: `user@test.pl` / `TestUser123!`
- **Accountant**: `ksiegowy@test.pl` / `TestAccountant123!`
- **Admin**: `admin@test.pl` / `TestAdmin123!`

### Production Deployment

```bash
# 1. Configure production environment (.env)
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
JWT_SECRET=<generate-secure-value>
COOKIE_DOMAIN=yourdomain.com

# 2. Start services
docker-compose up -d

# Application is ready
```

## 🔒 Security Architecture

### Authentication Flow
1. User submits credentials (email + password)
2. System validates against Argon2id hash in database
3. Session created in PostgreSQL with expiration time
4. JWT token generated and stored in httpOnly cookie
5. Each request validates: JWT signature + session existence + expiration

### CSRF Protection
- Origin validation middleware on all mutations
- Queries (GET) are exempt from CSRF checks
- Attackers cannot forge requests from different origins
- Logged CSRF attempts for security monitoring

### Data Protection
- All passwords hashed with Argon2id (64MB memory cost, 3 iterations)
- Session data in encrypted PostgreSQL
- File uploads stored in SeaweedFS S3 with private access and authentication
- Audit logs track all user actions
- Login attempt tracking prevents brute force attacks

## 📊 Database Schema

### Core Tables
- **users** - User accounts with roles and permissions
- **sessions** - Active user sessions with expiration
- **companies** - Company/organization data
- **invoices** - Invoice records with status tracking
- **invoice_edits** - Edit history for audit trail
- **notifications** - User notifications and preferences
- **login_logs** - Login attempt tracking and audit trail
- **login_attempts** - Failed login attempts for lockout

### Performance Features
- Composite indexes on frequently queried fields
- Partial indexes for filtered queries
- Optimized query patterns with connection pooling
- Query performance monitoring

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run pending migrations
npm run db:generate      # Generate migration files
npm run db:studio        # Open Drizzle Studio GUI

# Testing
npm run test             # Run unit tests
npm run test:ui          # Interactive test UI
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # Run ESLint
```

## 🐳 Docker Compose Structure

### Services
- **postgres** - PostgreSQL 16 database with health checks
- **seaweedfs-master** - SeaweedFS master server for cluster coordination
- **seaweedfs-volume** - SeaweedFS volume server for data storage
- **seaweedfs-filer** - SeaweedFS filer for file system interface
- **seaweedfs-s3** - SeaweedFS S3-compatible API gateway
- **seaweedfs-init** - Automated bucket initialization
- **app** - Next.js application with health checks

### Configuration
All services read from `.env` file. Set `NODE_ENV=production` for production deployments.

### Port Mappings (Development)
- App: `3000`
- PostgreSQL: `5432`
- SeaweedFS S3 API: `9000`
- SeaweedFS Master: `9333`
- SeaweedFS Volume: `8080`
- SeaweedFS Filer: `8888`

## 📈 Performance Considerations

- **Next.js Optimization**: Automatic code splitting and image optimization
- **Database Indexing**: Composite indexes on common query patterns
- **Caching Strategy**: React Query for client-side caching with stale-while-revalidate
- **Session Caching**: React's `cache()` API reduces database queries per request
- **Container Optimization**: Multi-stage Docker build reduces image size by 60%+
- **Health Checks**: All services have health checks for automatic recovery

## 🔧 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env
- Ensure hostname is "postgres" (Docker service name)
- Try connecting directly: `docker-compose exec postgres psql -U mobifaktura`

### SeaweedFS S3 Issues
- Access SeaweedFS Master UI at http://localhost:9333
- Verify bucket exists using AWS CLI or S3 client
- Check S3_ENDPOINT configuration
- Ensure port 9000 is accessible

### Application Won't Start
- Verify JWT_SECRET is set and > 32 characters
- Check database schema: `npm run db:push`
- Review logs: `docker-compose logs -f app`
- Verify .env file is in project root

### Session/Cookie Issues
- Verify COOKIE_DOMAIN matches your domain
- Check secure flag in production
- Inspect browser DevTools > Application > Cookies
- Clear cookies and restart browser in dev

### Performance Issues
- Check database indexes: `npm run db:studio`
- Review tRPC procedure logs for slow queries
- Monitor Docker container resource usage
- Check SeaweedFS S3 bucket size and file count

## 📚 Documentation

**📖 [Complete Documentation Index](docs/INDEX.md)** - Full documentation navigation

### Quick Links

**For Users:**
- **[USER_GUIDE.md](docs/USER_GUIDE.md)** - Complete user manual with step-by-step instructions

**For Developers:**
- **[FEATURES.md](docs/FEATURES.md)** - Detailed feature documentation
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and design
- **[API.md](docs/API.md)** - tRPC API reference
- **[LOGIC.md](docs/LOGIC.md)** - Business logic and workflows

**For Administrators:**
- **[ADMIN_QUICKREF.md](docs/ADMIN_QUICKREF.md)** - Admin panel quick reference
- **[ADMIN_ACCOUNT_MANAGEMENT.md](docs/ADMIN_ACCOUNT_MANAGEMENT.md)** - User management
- **[DATA_LIFECYCLE_STRATEGY.md](docs/DATA_LIFECYCLE_STRATEGY.md)** - Data retention policies

**For DevOps:**
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment guide
- **[MONITORING.md](docs/MONITORING.md)** - System monitoring setup

### Feature-Specific Guides

- **[INVOICE_TYPES_QUICKREF.md](docs/INVOICE_TYPES_QUICKREF.md)** - Invoice types reference
- **[KSEF_QUICKREF.md](docs/KSEF_QUICKREF.md)** - KSeF e-invoicing integration
- **[SALDO_QUICKREF.md](docs/SALDO_QUICKREF.md)** - Balance system reference
- **[MONEY_TRANSFERRED_QUICKREF.md](docs/MONEY_TRANSFERRED_QUICKREF.md)** - Payment workflow

### Technical Documentation

- **[TESTING.md](docs/TESTING.md)** - Testing strategy
- **[LOGGING.md](docs/LOGGING.md)** - Logging system
- **[RATE_LIMITING.md](docs/RATE_LIMITING.md)** - Rate limiting
- **[PWA_IMPLEMENTATION.md](docs/PWA_IMPLEMENTATION.md)** - Progressive Web App

## 📝 License

MIT

## 🤝 Contributing

1. Create a feature branch
2. Commit changes with clear messages
3. Ensure all tests pass
4. Create a pull request

## 💬 Support

For issues or questions:
1. Check existing documentation in `/docs`
2. Review application logs: `docker-compose logs app`
3. Verify .env configuration matches requirements
4. Check troubleshooting section above
