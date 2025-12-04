# mobiFaktura

Invoice management system built with Next.js 15, tRPC, Drizzle ORM, PostgreSQL, and MinIO.

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: tRPC, Drizzle ORM, Zod
- **Database**: PostgreSQL 16
- **Storage**: MinIO (S3-compatible)
- **Auth**: Argon2id, JWT sessions

## Features

- **Users**: Upload invoices with images, track status
- **Accountants**: Review and approve/reject invoices
- **Admin**: Manage users and companies
- Real-time updates and multi-accountant workflow

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start databases (Docker required)
docker compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:push

# Create test users
npm run db:seed

# Start dev server
npm run dev
```

Visit: http://localhost:3000

**Test Accounts:**
- User: `user@test.pl` / `TestUser123!`
- Accountant: `ksiegowy@test.pl` / `TestAccountant123!`

### Production

```bash
# Copy environment file
cp .env.example .env

# Start all services
docker compose up -d
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/mobifaktura"
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="invoices"
JWT_SECRET="your-secret-key-min-32-chars"
```

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## License

MIT
