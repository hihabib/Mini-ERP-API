# Mini ERP API

A production-grade backend for an **Inventory & Sales Management System**, built feature-by-feature with a modular, fully-tested architecture.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (LTS) |
| Framework | Express.js |
| Language | TypeScript (strict) |
| Database | MongoDB + Mongoose |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| Real-time | Socket.io |
| API Docs | Swagger / OpenAPI |
| Testing | Vitest + Supertest + mongodb-memory-server |
| Package manager | pnpm |

## Prerequisites

- [Node.js 22+](https://nodejs.org/) (LTS)
- [pnpm 11+](https://pnpm.io/) — `npm install -g pnpm`
- [Docker](https://www.docker.com/) + Docker Compose (for local MongoDB)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd mini-erp-api
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | no | `development` / `production` / `test` (default: `development`) |
| `PORT` | no | HTTP server port (default: `5000`) |
| `MONGO_URI` | **yes** | MongoDB connection string |
| `JWT_ACCESS_SECRET` | **yes** | Secret for signing access tokens |
| `JWT_ACCESS_EXPIRES_IN` | no | Access token TTL (default: `15m`) |
| `JWT_REFRESH_SECRET` | **yes** | Secret for signing refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | no | Refresh token TTL (default: `7d`) |
| `CLIENT_ORIGIN` | no | Allowed CORS origin (default: `http://localhost:5173`) |
| `UPLOAD_DIR` | no | Local upload directory (default: `uploads`) |
| `MAX_UPLOAD_SIZE_MB` | no | Max upload size in MB (default: `5`) |

### 3. Start MongoDB via Docker Compose

```bash
# MongoDB only (default)
docker compose up -d

# MongoDB + Mongo Express admin UI at http://localhost:8081
docker compose --profile admin up -d
```

MongoDB is exposed on `localhost:27017`. Update `MONGO_URI` in `.env` if needed.

### 4. Run the development server

```bash
pnpm dev
```

The server starts at `http://localhost:5000`.  
Health check: `GET http://localhost:5000/health`

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with watch mode |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled production build |
| `pnpm test` | Run full test suite once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm lint` | Lint all TypeScript files |
| `pnpm lint:fix` | Lint and auto-fix |
| `pnpm format` | Format all files with Prettier |
| `pnpm typecheck` | Type-check without emitting |

## Testing

Tests use an in-memory MongoDB instance — no external database required.

```bash
pnpm test
```

The first run downloads the MongoDB binary (~84 MB). Subsequent runs are fast.

## Git Hooks

Husky enforces quality gates automatically:

- **Pre-commit**: ESLint + Prettier (staged files only), then `tsc --noEmit`
- **Pre-push**: full test suite — push is blocked if any test fails

## Project Structure

```
src/
├── app.ts                      # Express app (middlewares, routes, error handler)
├── server.ts                   # HTTP server bootstrap + Socket.io + DB connect
├── config/
│   ├── env.ts                  # Zod-validated environment loader (single source of truth)
│   ├── db.ts                   # Mongoose connection
│   └── socket.ts               # Socket.io init
├── modules/                    # Feature modules — each self-contained
│   ├── auth/
│   ├── user/
│   ├── role/                   # Dynamic role & permission management
│   ├── product/
│   ├── sale/
│   └── dashboard/
├── middlewares/
│   ├── auth.middleware.ts      # JWT verification
│   ├── permission.middleware.ts # Dynamic permission check
│   ├── validate.middleware.ts  # Zod request validation
│   └── error.middleware.ts     # Global error handler
├── shared/
│   ├── utils/
│   ├── queryBuilder/           # Generic search / filter / sort / pagination
│   ├── apiResponse.ts          # sendSuccess / sendError helpers
│   └── ApiError.ts             # Custom error class
├── types/
└── docs/swagger.ts
tests/
└── setup.ts                    # In-memory MongoDB test bootstrap
```

Each module follows `route → controller → service → model`:

- **Route** — registers endpoints, applies middlewares
- **Controller** — HTTP concerns only (parse, delegate, respond)
- **Service** — all business logic
- **Model** — Mongoose schema and data access

## API

### Health Check

```
GET /health
```

```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "status": "ok",
    "timestamp": "2026-07-07T00:00:00.000Z"
  }
}
```

Full API docs are available at `GET /api/docs` (Swagger UI — added as modules are implemented).

## Docker

Build and run the API itself in Docker:

```bash
docker build -t mini-erp-api .
docker run -p 5000:5000 --env-file .env mini-erp-api
```

## Architectural Principles

1. **Feature-based modules** — code is organized by business domain, not technical layer
2. **Strict layering** — no business logic in controllers; services own all logic
3. **Database-driven roles and permissions** — never hardcoded
4. **Swappable interfaces** — e.g. image storage moves from local disk to S3 without touching the product module
5. **No `process.env` calls** — always import from `src/config/env.ts`
6. **No feature ships without tests** — unit + integration coverage required for every module

## Schema Migrations

MongoDB is schemaless at the database level, so schema migrations here means one-off transform scripts that run against live data when a breaking schema change is made (e.g. renaming a field, changing a type, adding a required field to existing documents).

**Convention:**

- Scripts live in `src/scripts/migrations/`
- File naming: `YYYY-MM-DD-short-description.ts`
- Each script must document: what changed, which collection, and how existing documents are transformed
- Run manually: `node_modules/.bin/tsx src/scripts/migrations/<filename>.ts`
- Commit the script after running it — it serves as a permanent audit trail

**When to write one:**

| Change | Migration needed? |
|---|---|
| Adding a new optional field | No — existing docs simply lack the field |
| Adding a new required field | Yes — backfill existing documents |
| Renaming a field | Yes — rename in all existing documents |
| Changing a field type | Yes — transform existing values |
| Dropping a field | Optional — `$unset` for cleanup |

## Seeding

Populate the database with default permissions, roles, and an admin user:

```bash
pnpm seed
```

Required env vars: `MONGO_URI`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

The seed is idempotent — running it multiple times is safe.
