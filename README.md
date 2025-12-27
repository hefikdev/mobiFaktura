# mobiFaktura

Professional invoice management system built with modern web technologies. Designed for businesses to streamline invoice processing with role-based workflows (Users, Accountants, Admins).

## 🎯 Project Overview

mobiFaktura is an enterprise-grade invoice management platform that enables:

- **Users** to upload, track, and manage invoices with real-time status updates
- **Accountants** to review invoices efficiently with bulk operations and quality control
- **Admins** to manage users, companies, and oversee system operations

The system is built with security and scalability in mind, featuring end-to-end encryption for sensitive data, comprehensive audit logging, and enterprise backup strategies.

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
- **MinIO** - S3-compatible object storage for invoice files
- **Docker & Docker Compose** - Containerization for development and production
- **Node.js 20** - JavaScript runtime with Alpine Linux for minimal image size

### Security & Authentication
- **Argon2id** - Industry-standard password hashing (winner of Password Hashing Competition 2015)
- **JWT Sessions** - Stateful session management with database validation
- **CSRF Protection** - Origin-based CSRF validation on all mutations
- **Rate Limiting** - In-memory rate limiting with configurable limits per operation type
- **Login Attempt Lockout** - Account lockout after 3 failed attempts (30-second cooldown)

## 📋 Features

### User Management
- Role-based access control (User, Accountant, Admin)
- Secure authentication with email and password
- Session management with 60-day expiration
- Emergency super admin account for disaster recovery
- Comprehensive login logging and attempt tracking

### Invoice Management
- Upload invoices with multiple file formats
- Real-time status tracking (Draft, Under Review, Approved, Rejected)
- Bulk operations for efficient batch processing
- Edit history tracking with audit logs
- Search and filtering capabilities
- File storage in S3-compatible MinIO

### Accounting Operations
- Multi-accountant workflow with concurrent reviews
- Bulk approve/reject with comments
- Performance tracking with submission and review metrics
- Quality metrics and reporting
- Rejection reason tracking for process improvement

### Admin Functions
- User and company management
- System monitoring and logging
- Automatic backups (PostgreSQL + MinIO) with configurable retention
- Emergency account lockout recovery
- Notification management and preferences

### Technical Features
- **Real-time Updates** - WebSocket-ready architecture for live status updates
- **Comprehensive Logging** - Structured logging for debugging and monitoring
- **Progressive Web App (PWA)** - Offline-first capabilities with service workers
- **Performance Optimized** - Image optimization, code splitting, lazy loading
- **Type Safety** - Full TypeScript with zero-any policy
- **Database Migrations** - Drizzle-powered schema versioning
- **API Documentation** - Auto-generated from tRPC procedures

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Start services (PostgreSQL, MinIO)
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

### Rate Limiting
- **Global**: 300 requests/minute per IP
- **Authentication**: 10 attempts/minute (with 30-second lockout)
- **Read Operations**: 500 requests/minute
- **Write Operations**: 100 requests/minute

### Data Protection
- All passwords hashed with Argon2id (64MB memory cost, 3 iterations)
- Session data in encrypted PostgreSQL
- File uploads stored in MinIO with private ACLs
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

# Backups
npm run backup:postgres  # Backup PostgreSQL database
npm run backup:minio     # Backup MinIO files
npm run backup:all       # Backup everything
npm run backup:list      # List available backups

# Code Quality
npm run lint             # Run ESLint
```

## 🐳 Docker Compose Structure

### Services
- **postgres** - PostgreSQL 16 database with health checks
- **minio** - S3-compatible object storage with console
- **minio-init** - Automated bucket initialization
- **app** - Next.js application with health checks
- **backup** - Automated backup service with cron scheduling

### Configuration
All services read from `.env` file. Set `NODE_ENV=production` for production deployments.

### Port Mappings (Development)
- App: `3000`
- PostgreSQL: `5432`
- MinIO API: `9000`
- MinIO Console: `9001`

## 📈 Performance Considerations

- **Next.js Optimization**: Automatic code splitting and image optimization
- **Database Indexing**: Composite indexes on common query patterns
- **Caching Strategy**: React Query for client-side caching with stale-while-revalidate
- **Rate Limiting**: Prevents abuse and ensures fair resource allocation
- **Session Caching**: React's `cache()` API reduces database queries per request
- **Container Optimization**: Multi-stage Docker build reduces image size by 60%+
- **Health Checks**: All services have health checks for automatic recovery

## 🔧 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env
- Ensure hostname is "postgres" (Docker service name)
- Try connecting directly: `docker-compose exec postgres psql -U mobifaktura`

### MinIO Issues
- Access console at http://localhost:9001
- Default credentials: minioadmin / minioadmin
- Verify bucket exists
- Check MINIO_ENDPOINT configuration

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
- Check MinIO bucket size and file count

## 📚 Documentation

For detailed information, see:
- [AUTH_SECURITY_AUDIT.md](docs/AUTH_SECURITY_AUDIT.md) - Security analysis and migration recommendations
- [AUTH_IMPLEMENTATION_GUIDE.md](docs/AUTH_IMPLEMENTATION_GUIDE.md) - Auth system implementation details
- [AUTH_FIXES_IMPLEMENTED.md](docs/AUTH_FIXES_IMPLEMENTED.md) - Summary of security fixes
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture and design decisions
- [BACKUP_SYSTEM.md](docs/BACKUP_SYSTEM.md) - Backup and restore procedures
- [BACKUP_QUICKREF.md](docs/BACKUP_QUICKREF.md) - Quick reference for backups
- [MONITORING.md](docs/MONITORING.md) - System monitoring and logging

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
