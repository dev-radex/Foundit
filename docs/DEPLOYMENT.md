# Deploy FoundIt on Vercel and Supabase

## 1. Create a dedicated Supabase project

Create a new project called **foundit-campus** in your own Supabase organisation. Keep it separate from the Fazky Farm projects. Choose an appropriate region and securely save the database password. No existing records need migration.

Apply these migrations, once each, in order through the Supabase SQL editor or Supabase CLI:

1. `supabase/migrations/202611070001_foundit.sql`
2. `supabase/migrations/202611070002_private_storage.sql`

The first creates the private `foundit` schema, tables, indexes, constraints and RLS protection. The second creates the private `foundit-private` storage bucket. **Do not expose the `foundit` schema through the Data API. Do not make the bucket public.** There are no direct browser data policies: authorized Next.js handlers perform database queries and file operations on the server.

## 2. Collect environment settings

| Variable                               | Source                                                   | Scope                     |
| -------------------------------------- | -------------------------------------------------------- | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                     | Public                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (legacy anon key also accepted) | Public                    |
| `DATABASE_URL`                         | Connect → Transaction pooler → PostgreSQL URI            | Secret, server-only       |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase server/service-role API key                     | Secret, server-only       |
| `FOUNDIT_OWNER_ID`                     | Intended owner's Supabase Auth user UUID, after signup   | Server-only configuration |

Copy the exact pooler host, project-qualified username and port from **Connect**; do not guess a hostname from the region. URL-encode special characters in the database password. Use the Supabase `postgres` role/schema owner for this application backend. The server uses parameterized unnamed queries and a one-connection pool suitable for transaction pooling. Database TLS certificate validation remains enabled.

Never prefix database or service-role secrets with `NEXT_PUBLIC_`. Never commit real keys, passwords or `.env.local` files. Do not set `DATABASE_SSL=disable` in Supabase/Vercel; that option is only for disposable local databases without TLS.

## 3. Import the repository into Vercel

1. Add New → Project → import `olaniyanbasirat06-creator/foundit-campus`.
2. Framework preset: **Next.js**. Root directory: repository root.
3. Node version: **24.x**. Install: `npm ci`. Build: `npm run build`.
4. Add the environment variables above. Initially omit `FOUNDIT_OWNER_ID` until the owner signs up.
5. Deploy. The build does not require a live database, but application features require valid runtime settings and the migrations.
6. Prefer separate Supabase projects for production and preview environments. Do not let unreviewed preview deployments operate on production data.

## 4. Configure Supabase authentication URLs

After Vercel returns the final URL:

- Supabase Authentication → URL Configuration → **Site URL**: your final HTTPS origin.
- Add the exact redirect URL `https://YOUR-APP.vercel.app/auth/callback` to the allowed redirects. Add the custom domain equivalent when applicable.
- For local development only, add `http://localhost:3000/auth/callback`.
- Enable email/password login and email confirmation. Configure production SMTP for reliable delivery before public launch.
- Use the Supabase PKCE confirmation flow. The supplied callback exchanges the code for a cookie session. Ensure confirmation and recovery email templates preserve the configured redirect (`{{ .ConfirmationURL }}` in the default template).
- For Google sign-in, enable the Google provider in Supabase and configure a Google OAuth client. Copy the exact Supabase callback URI displayed by that provider into Google's authorized redirect URIs. This is the Supabase provider callback, not the app's `/auth/callback` URL.
- Copy the Google client ID/secret into Supabase provider settings. Do not put the client secret into the application source or a public environment variable.

Password reset emails return through `/auth/callback?next=/reset-password`; external `next` destinations are rejected. Google login remains unavailable until its provider is configured; the button surfaces Supabase's error rather than pretending success.

## 5. Provision the application owner

1. Sign up and confirm the intended owner's account.
2. Copy that account's exact UUID from Supabase Authentication → Users.
3. Set `FOUNDIT_OWNER_ID` to the UUID in Vercel, then redeploy.
4. Sign in again. Only that exact verified identity is provisioned as `super-admin`; the action is audited.
5. Use Administration → Members to promote other accounts to admin as needed.

The first registrant is **not** automatically admin. User metadata does not determine roles. Protect the owner account with the authentication protections available in your provider.

## 6. Acceptance checks before public use

Use two disposable member accounts and an administrator:

- Register, confirm email, sign in/out, reset password and sign in with Google.
- Create a lost report and a matching found report; verify suggestions and notifications.
- Submit a claim with evidence. Confirm an unrelated account cannot read evidence or messages.
- Approve, coordinate in messages, confirm handover and verify recovery status.
- Submit university verification; review it as admin. Confirm the document is private.
- Block messaging; moderate a report; resolve a dispute; verify audit entries.
- Test photo uploads up to 3 MB (the lower limit keeps requests within Vercel function payload limits).
- Complete operator/contact information, data-retention choices and legal-copy review.

The automated suite tests database and API behaviour locally. Live OAuth, email delivery, deployed environment variables and provider connectivity must also be tested against the configured project.
