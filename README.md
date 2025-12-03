# mobiFaktura

System zarządzania fakturami - aplikacja full-stack zbudowana z użyciem Next.js 15, tRPC, Drizzle ORM, PostgreSQL i MinIO.

## Technologie

- **Frontend**: Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Shadcn/UI, Lucide Icons
- **Backend**: tRPC, Drizzle ORM, Zod
- **Baza danych**: PostgreSQL 16 z connection poolingiem
- **Storage**: MinIO (S3-compatible)
- **Autentykacja**: Argon2id (hashowanie haseł), JWT (sesje)
- **Infrastruktura**: Docker, Docker Compose

## Funkcjonalności

### Użytkownik (mobilne UI)
- Logowanie i rejestracja
- Lista wysłanych faktur ze statusami
- Upload faktur (zdjęcie, numer, opis)
- Podgląd statusu zatwierdzenia

### Księgowy (desktopowe UI)
- Panel z listą faktur do zatwierdzenia
- Lista rozpatrzonych faktur
- Podgląd szczegółów faktury z obrazem
- Akceptacja/odrzucenie faktury

## Wymagania

- Docker i Docker Compose
- Node.js 20+ (dla developmentu lokalnego)

## Szybki start (Docker)

### 1. Sklonuj repozytorium i przygotuj pliki środowiskowe

```bash
cp .env.example .env
```

Zmodyfikuj `.env` według potrzeb (szczególnie `JWT_SECRET` na produkcji).

### 2. Uruchom całą aplikację

```bash
docker-compose up -d
```

To uruchomi:
- PostgreSQL (port 5432 - wewnętrzny)
- MinIO (porty 9000, 9001)
- Aplikację Next.js (port 3000)

### 3. Zastosuj migracje bazy danych

Po pierwszym uruchomieniu wykonaj migrację:

```bash
docker exec -it mobifaktura_postgres_dev psql -U mobifaktura -d mobifaktura -f /docker-entrypoint-initdb.d/0001_initial.sql
```

Lub użyj Drizzle:

```bash
npm run db:push
```

### 4. Otwórz aplikację

- Aplikacja: http://localhost:3000
- MinIO Console: http://localhost:9001 (mobifaktura_minio / mobifaktura_minio_secret)

## Development lokalny

### 1. Uruchom bazy danych

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Zastosuj migracje

```bash
npm run db:push
```

### 4. Uruchom serwer deweloperski

```bash
npm run dev
```

Aplikacja będzie dostępna na http://localhost:3000

## Struktura projektu

```
mobiFaktura/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/trpc/          # tRPC API endpoint
│   │   ├── auth/              # Strony chronione (po zalogowaniu)
│   │   │   ├── dashboard/     # Dashboard użytkownika
│   │   │   ├── upload/        # Upload faktury
│   │   │   └── accountant/    # Panel księgowego
│   │   ├── login/             # Strona logowania
│   │   ├── register/          # Strona rejestracji
│   │   └── layout.tsx         # Root layout
│   ├── components/
│   │   ├── ui/                # Komponenty Shadcn/UI
│   │   └── *.tsx              # Komponenty aplikacji
│   ├── lib/
│   │   ├── trpc/              # Klient tRPC
│   │   └── utils.ts           # Narzędzia
│   └── server/
│       ├── auth/              # Logika autentykacji
│       ├── db/                # Schemat i połączenie Drizzle
│       ├── storage/           # Klient MinIO
│       └── trpc/              # Routery tRPC
├── drizzle/                   # Migracje SQL
├── public/                    # Pliki statyczne
├── docker-compose.yml         # Docker produkcyjny
├── docker-compose.dev.yml     # Docker deweloperski
└── Dockerfile                 # Build aplikacji
```

## Zmienne środowiskowe

| Zmienna | Opis | Przykład |
|---------|------|----------|
| `DATABASE_URL` | URL PostgreSQL | `postgres://user:pass@host:5432/db` |
| `MINIO_ENDPOINT` | Host MinIO | `minio` lub `localhost` |
| `MINIO_PORT` | Port MinIO | `9000` |
| `MINIO_ACCESS_KEY` | Klucz dostępu MinIO | `mobifaktura_minio` |
| `MINIO_SECRET_KEY` | Sekret MinIO | `mobifaktura_minio_secret` |
| `MINIO_BUCKET` | Nazwa bucketa | `invoices` |
| `JWT_SECRET` | Sekret JWT (min. 32 znaki) | `your-secret-key...` |
| `SESSION_COOKIE_NAME` | Nazwa ciasteczka sesji | `mobifaktura_session` |

## Bezpieczeństwo

- Hasła hashowane Argon2id (najsilniejszy wariant Argon2)
- Sesje JWT z HttpOnly cookies
- Walidacja wejść Zod na wszystkich endpointach
- Security headers (HSTS, X-Frame-Options, etc.)
- Connection pooling dla bazy danych
- Presigned URLs dla plików (1h ważności)

## Komendy

```bash
# Development
npm run dev              # Uruchom serwer deweloperski (Turbopack)
npm run build            # Zbuduj aplikację
npm run start            # Uruchom zbudowaną aplikację
npm run lint             # Sprawdź linting

# Baza danych
npm run db:generate      # Generuj migracje Drizzle
npm run db:migrate       # Zastosuj migracje
npm run db:push          # Push schematu do bazy
npm run db:studio        # Otwórz Drizzle Studio

# Docker
docker-compose up -d     # Uruchom wszystkie usługi (produkcja)
docker-compose down      # Zatrzymaj wszystkie usługi
docker-compose logs -f   # Śledź logi
```

## Licencja

MIT
