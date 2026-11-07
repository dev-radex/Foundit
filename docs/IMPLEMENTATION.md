# Implementation notes

## Scope and design

This is a fresh rebuild of the University of Ilorin FoundIt app. The public design, dashboard, reporting, browsing, item detail, claim form and report-management screens were inspected. Inaccessible admin and verification screens were reconstructed using the documented functions and the same design language. They are not claimed as pixel-verified copies of hidden screens. No original user records were imported.

The previous Cloudflare/ChatGPT-hosted preview is a separate earlier artifact. **This repository is the independent Vercel/Supabase implementation.**

## Architecture and trust boundaries

- Standard Next.js App Router, React 19, TypeScript and responsive CSS.
- Supabase Auth with `@supabase/ssr` cookie sessions and PKCE callbacks. Identity is verified with `auth.getUser()` on server requests. Client-supplied identity headers are never trusted.
- PostgreSQL in the private `foundit` schema. All tables have RLS enabled, with no grants/policies for direct anonymous or authenticated Data API access.
- Server handlers authorize all reads/writes. A server-only PostgreSQL schema-owner connection executes parameterized queries and transactions. This role bypasses RLS by design; **server authorization is the application access-control boundary**, while schema grants/RLS prevent alternate browser access.
- Supabase Storage bucket `foundit-private` is private. Server-only service-role access occurs only after file authorization. The browser receives files from a no-store application route; raw bucket access is not granted.
- No production development-identity fallback. Test identity/storage mocks are confined to the Node test loader and never imported by the application.

## Permissions

Visitors receive only public report summary fields and aggregate counts. Signed-in members can browse visible reports, manage their own open reports and submit ownership claims. Private identifying notes are reporter/admin-only. Claim evidence is visible to the claimant and finder, plus dispute administrators for escalated cases. ID documents are owner/verification-admin-only. Admin document reads and investigation transcript access are audited.

Ordinary administrators cannot assign roles or adjudicate their own claims. The configured owner becomes super-admin; only super-admins can promote/demote other members. Suspended accounts cannot use data/file endpoints. Public registration always creates a member.

## Data integrity

One claim per member/report and one approved/recovered claim per report are enforced by unique/partial indexes. Claim status transitions are explicit. Recovery and rejection of competing unresolved claims execute in one transaction. Report edits require ownership, an open status and the expected version. Profile identity changes invalidate pending/verified affiliation status.

Matching is deterministic: category 35 points, keyword overlap up to 35, location 20 and date proximity up to 10. Creation generates notifications at 50 points or above; dashboard suggestions recalculate from current open reports. A score is a lead, not proof of ownership.

## Verification

The suite runs the PostgreSQL migration and real route handlers against PGlite, with identity and storage transport mocked. Tests cover anonymous write rejection, privilege escalation, full claim/recovery, competing claims, blocking, verification, report ownership/version validation, exact owner provisioning, cross-origin writes, safe redirects, private ID access and anonymous/authenticated schema denial.

The standard Next.js production build and TypeScript checks run without live credentials. Live Supabase email/Google flows, SMTP, Vercel connectivity and the storage provider require a configured project and are not established by these local tests.

## Current operational limits

- Pilot scope is University of Ilorin. Institution/department taxonomy is manageable, but cross-institution tenancy is not implemented.
- Browsing loads permitted reports and paginates client-side. Large volumes need server-side pagination, targeted queries and performance testing.
- In-app messaging polls the open conversation every ten seconds; it is not a WebSocket implementation.
- Notifications are in-app only. No push, SMS or transactional report-alert emails.
- Audit UI shows the latest 200 events; notifications show the latest 150. Large announcement fan-out should move to a queue.
- Images are limited to 3 MB, JPEG/PNG/WebP. No PDF evidence upload or antivirus service is included.
- Deployment-specific abuse/rate controls, retention jobs, operator contact details and legal review remain launch operations.

These are documented limitations, not hidden mock behaviours. No sample reports or real credentials are present in production migrations.
