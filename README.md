# FoundIt Campus

University of Ilorin lost-and-found, rebuilt with the original navy-and-amber interface and a fresh database.

**Final stack: Next.js on Vercel + Supabase PostgreSQL, Auth and private Storage.** This repository has no ChatGPT sign-in, Cloudflare, D1 or R2 runtime dependency.

## Features

- Responsive public pages and member dashboard
- Email/password sign-in, registration, confirmation, Google OAuth and password recovery
- Lost/found reports, photos, private identifying details, editing and closing
- Search, category/location/status filters and match suggestions
- Ownership claims with private proof, disputes and handover confirmation
- Participant-only messaging, blocking, unread counts and in-app notifications
- University affiliation verification
- Administration: moderation, disputes, verification, members, announcements, taxonomy and audited investigations

## Local setup

Use Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
# Fill the values from your NEW Supabase project. Do not commit .env.local.
npm run dev
```

Apply the two SQL migrations in `supabase/migrations/` to the new Supabase project, in filename order, before testing database features. Production has no seeded reports or test accounts.

## Deploy

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to configure Supabase, import this repository into Vercel, set environment variables, configure Google OAuth, and provision the owner.

## Check

```sh
npm run typecheck
npm test
npm run build
```

Tests run the PostgreSQL schema and real application API handlers against PGlite (PostgreSQL compiled to WASM), with mocked identity and storage transport. They do not require production credentials. GitHub Actions runs the checks on pushes and pull requests.

## Source map

| Path                                 | Purpose                                           |
| ------------------------------------ | ------------------------------------------------- |
| `components/foundit.tsx`             | Member and admin screens                          |
| `components/auth-panel.tsx`          | Supabase account flows                            |
| `app/globals.css`                    | Responsive design                                 |
| `app/api/data/route.ts`              | Server-authorized business workflows              |
| `lib/database.ts`                    | Parameterized PostgreSQL queries and transactions |
| `lib/supabase/` and `proxy.ts`       | Verified cookie-based Supabase identity           |
| `lib/storage.ts` and file API routes | Private storage behind access checks              |
| `supabase/migrations/`               | Schema, constraints, indexes and private bucket   |
| `tests/`                             | PostgreSQL, privacy and workflow regression tests |

See [implementation note](docs/IMPLEMENTATION.md) for permission boundaries and remaining operational limitations.
