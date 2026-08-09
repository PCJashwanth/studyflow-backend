# studyflow-backend

Express + Prisma REST API for **StudyFlow**. Database is Supabase Postgres. Deployed on Render.

## Stack
Node + Express · Prisma ORM · Supabase Postgres · JWT + bcrypt · Zod validation

## Getting started

```bash
npm install
cp .env.example .env          # then fill in the values
openssl rand -hex 32          # paste as JWT_SECRET
npm run prisma:generate
npm run prisma:migrate        # needs a real Supabase DATABASE_URL/DIRECT_URL
npm run seed                  # optional: 1 demo user per role
npm run dev                   # http://localhost:4000
```

### Supabase connection strings
From your Supabase project → **Connect**:
- `DATABASE_URL` → **Transaction pooler** host, port **6543**, add `?pgbouncer=true` (used by the running app).
- `DIRECT_URL` → **Direct** host, port **5432** (used by `prisma migrate`).

## Project layout
```
prisma/schema.prisma        Data models + migrations
src/
  server.js                 Boot
  app.js                    Express app + middleware chain
  config/env.js             Zod-validated environment
  lib/                      prisma, jwt, password, asyncHandler
  middleware/               authenticate, requireRole, validate, error
  modules/auth/             routes · controller · service · schema
```

## API (current)
| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/health` | — | — |
| POST | `/api/auth/signup` | — | `fullName, email, password, role?` |
| POST | `/api/auth/login` | — | `email, password` |
| GET | `/api/auth/me` | Bearer | — |

Auth endpoints return `{ token, user }`. Send the token as `Authorization: Bearer <token>`.

## Conventions
- Controllers stay thin (HTTP I/O only); business logic lives in `*.service.js`.
- Services throw `Error` with a `.status`; the central error handler shapes the response.
- Every new domain = a folder under `src/modules/` with routes + controller + service + schema
