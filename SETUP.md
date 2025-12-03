# mobiFaktura - Setup Instructions

## Prerequisites
- Docker Desktop for Windows installed and **running**

## Database Setup (Docker)

### 1. Start Docker Desktop
Open Docker Desktop application and wait until it's fully running.

### 2. Start Database Containers
```powershell
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- MinIO (S3 storage) on `localhost:9000` (API) and `localhost:9001` (Console)

### 3. Initialize Database Schema
```powershell
npm run db:push
```

### 4. Create Test Users
```powershell
npm run db:seed
```

Test accounts:
- **User**: `user@test.pl` / `TestUser123!`
- **Accountant**: `ksiegowy@test.pl` / `TestAccountant123!`

### 5. Start Development Server
```powershell
npm run dev
```

Visit: http://localhost:3000

## Alternative: Without Docker

### Option 1: Local PostgreSQL + MinIO
Install PostgreSQL and MinIO locally, update `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mobifaktura"
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_USE_SSL=false
```

### Option 2: Cloud Services
Use Neon (PostgreSQL) + Cloudflare R2 (S3):

1. Create Neon database: https://neon.tech
2. Update `DATABASE_URL` in `.env`
3. For R2, update MinIO config to use Cloudflare R2 endpoint

## Verify Setup
1. Login at http://localhost:3000/login
2. Register a new user or use test accounts
3. Upload an invoice with camera/photo
4. Login as accountant to review invoices

## Troubleshooting

### Docker not starting?
- Ensure Docker Desktop is running (check system tray)
- Run: `docker ps` to verify Docker engine is accessible
- Check Docker Desktop settings for WSL2 integration

### Database connection error?
- Verify containers are running: `docker ps`
- Check PostgreSQL logs: `docker logs mobifaktura-db`
- Ensure port 5432 is not in use by another service

### MinIO bucket not found?
- Access MinIO Console: http://localhost:9001
- Login: `minioadmin` / `minioadmin`
- Create bucket named `invoices` manually if needed
