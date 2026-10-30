# Optional account storage — zero-paid-service setup

The local planner requires no account, API key, or backend. This integration adds an optional account board. Do not upgrade a service or add billing to follow this guide.

## Status and verification boundary

Implemented: Google/GitHub OAuth/PKCE client flow using the official Supabase SDK; authenticated API; owner-derived access; PostgreSQL migration and row security; atomic revision checks; explicit load/save/delete controls; separate local/account state. The SDK keeps the tab's Auth session in sessionStorage. Application documents loaded from an account remain in memory and are not copied into the local demo store. Sign-out restores the separate local board.

Verified locally: TypeScript, service-level authorization tests, adapter contract tests, and execution of the migration/row-security tests against embedded PostgreSQL (PGlite). This does not verify a live Supabase project's gateway, OAuth configuration, email/identity settings, or a deployed Vercel function. No live project has been provisioned or connected by this change.

## 1. Prepare a free development project

Create/select a Supabase **Free** project in your own account. Review current free-plan limits. Free projects may pause; the independent local demo remains available. Do not use keep-alive jobs or paid upgrades as a prerequisite.

In a new, dedicated development database, inspect and apply these migrations **in order**, once each, using the SQL editor:

1. `database/migrations/001_workspace_storage.sql` creates the workspace table and initial access rules.
2. `database/migrations/002_security_limits.sql` is required by the current adapter. It denies all direct browser table access, adds server-only read/write/delete RPCs, enforces a shared per-account request limit, and issues non-reused revisions.

Do not stop after migration 001. Neither migration should be run against an unrelated database. Reapplying them is expected to fail rather than reset existing data.

The first cloud adapter stores one validated JSON workspace per account, capped at 1 MB by the API. That preserves the existing versioned local format and permits atomic replacement/import and optimistic concurrency. PostgreSQL stores ownership, revision and update time as columns. Tasks/assets are not yet normalized into separate tables. Base64 images consume document capacity; reduce images/history or keep a local backup when the cap is reached.

## 2. Configure Google authentication

1. In Google Cloud Console, select/create a project and configure the OAuth consent screen for this app. If the consent screen remains in Testing, add the Google accounts that will test it. No paid Google API, billing upgrade or Calendar scope is required for sign-in.
2. Create an OAuth client of type **Web application**. Add the appropriate application origins, including https://elevatria-website.vercel.app and the local origin you actually use.
3. In Supabase Authentication → Sign In / Providers → Google, copy the callback URL shown by your project. Add that exact URL to Google's **Authorized redirect URIs**, typically https://YOUR-PROJECT.supabase.co/auth/v1/callback. This is the Google-to-Supabase callback; it is different from your application's return URL.
4. Enter the Google client ID and client secret **only in Supabase's provider settings**, and enable Google. They do not belong in the frontend, Vercel public variables or this repository.
5. In Supabase Authentication → URL Configuration, set Site URL to https://elevatria-website.vercel.app. Add exact return URLs: https://elevatria-website.vercel.app/ and http://127.0.0.1:5174/ for the documented local command. Add other local ports or preview URLs only if deliberately used; avoid broad production wildcards.
6. Keep anonymous sign-in disabled. Enable only intended providers. GitHub is optional: its existing button requires enabling the GitHub provider separately; Google users do not need GitHub.

The SDK performs the browser redirect, PKCE exchange and tab session refresh, returning to the application root. Google sign-in requests account selection and uses the provider's basic identity scopes; it does not request Calendar permissions. Provider initialization/redirect failures show retryable UI errors. Sign-out returns to the separate local demo.

Official instructions: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 3. Configure local environment

Copy `.env.example` to `.env` in the repository root. Uncomment and supply:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

The first two values are intentionally public. An anon key does not authorize arbitrary document access: both migrations keep browser roles denied, and the API verifies identity before server-only RPCs. The secret key must remain server-only. The build rejects recognizable privileged credentials in every `VITE_` variable and requires a valid public Supabase key; this is a guard, not a substitute for checking environment configuration. `.env` is ignored by Git.

You may alternatively use VITE_SUPABASE_PUBLISHABLE_KEY and SUPABASE_PUBLISHABLE_KEY for new publishable keys. Use one public-key family; conflicting anon/publishable values are rejected. SUPABASE_SERVICE_ROLE_KEY is supported as a legacy server-only alias for SUPABASE_SECRET_KEY. Public URL/key configuration enables sign-in; cloud document operations also need the server secret and both migrations. An anon key alone is insufficient for this server-mediated storage architecture.

New Supabase secret keys use `sb_secret_`; the adapter also supports legacy service-role JWTs. Live gateway behavior must be verified on the configured project before relying on the integration. Read [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

## 4. Run both processes

In one terminal:

```sh
npm run dev:api
```

In another:

```sh
npm run dev -- --port 5174
```

The API listens on `127.0.0.1:5176`; Vite proxies `/api` there. Restart both after changing `.env`. Visiting the planner requires neither process to have valid cloud credentials when using the local demo; the API reports a structured unavailable response if unconfigured.

## 5. Review the account workflow

1. Continue with Google (or optional GitHub). Signing in does not upload the local board.
2. To start, choose **Copy this board to cloud** and confirm. This creates a new revision only when no account board exists. Revision numbers are global and may contain gaps; do not assume the first account revision is 1.
3. On another tab/device, choose **Load cloud board**, review, then open it.
4. Edits to an account board stay in memory until **Save cloud board** is confirmed. Export unsaved work before leaving.
5. If another tab saved a newer revision, the API returns 409 and preserves the newer cloud record. Export your changes, load the current cloud version, and reconcile manually. Automatic merging is not implemented.
6. Sign out of the tab to restore the separate local demo. SDK tab sessions are not an account-wide logout.
7. **Delete cloud board** requires confirmation and the latest loaded revision. It deletes the document, not the identity account. Account deletion is not implemented in this release.

## API contract

All responses use `Cache-Control: no-store`. Mutations accept only the documented fields; owner IDs never come from request data. Requests use a bearer access token, verified against Supabase Auth on the server.

| Method | `/api/workspace` request | Result |
| --- | --- | --- |
| GET | Authorization header | `{ revision, workspace }` or 404 |
| PUT | `{ expectedRevision, workspace }` | New revision; use 0 only for creation |
| DELETE | `{ expectedRevision }` | `{ deleted: true }` |

Errors: 400 malformed input, 401 invalid session, 403 origin mismatch, 409 revision conflict, 413 size limit, 415 unsupported body format, 422 domain validation, 429 rate limit, 502 invalid upstream data, 503 unavailable/unconfigured infrastructure. Errors include a request ID and never return tokens or provider errors verbatim.

After migration 002, browser roles cannot read or write workspace tables or execute any workspace RPC. All access passes through the same-origin API. The server verifies a non-anonymous Google- or GitHub-backed identity with Supabase Auth and derives the owner from that response. Service credentials are never sent to the browser. Changes to this boundary require corresponding SQL and two-user tests.

The database enforces 60 valid workspace operations per account per minute across API instances. A bounded process-local throttle also limits requests to 120 per observed IP per minute; this is supplementary and does not provide global denial-of-service protection. Provider Auth traffic and invalid requests still require platform/free-plan quota review before hosting.

Requests and provider replies have byte limits, timeouts and sanitized errors. Provider redirects are rejected to prevent forwarding credentials. Production service URLs must be canonical HTTPS Supabase project origins; loopback HTTP is allowed only for development. Custom Supabase domains require a deliberate allowlist/CSP change and tests.

The SDK uses tab-scoped sessionStorage, which is readable by same-origin JavaScript; it is not an HttpOnly cookie. The local board is also unencrypted browser storage. Avoid sensitive data on shared devices. Signing out clears the account view but an already authorized request can finish, and access tokens follow the provider's expiry/revocation behavior. Do not promise immediate account-wide token revocation.

## Security configuration

Use exact allowed OAuth redirect URLs, disable anonymous registration, enable only intended providers, and keep the Supabase and Vercel projects separate from unrelated applications. Review provider abuse controls, session lifetimes and free-plan quotas. Do not add paid services. Read [the security audit](SECURITY_AUDIT.md) before enabling account access.

## Remaining work before opening account access publicly

- Verify real OAuth callback, refresh, expiration, and sign-out on the configured project.
- Exercise gateway/RPC behavior with two actual accounts and parallel requests.
- Verify the shared database limit with parallel real requests; configure available platform traffic controls and operational usage limits appropriate to the selected free plan.
- Implement account deletion, a fuller offline/cache policy, and optional normalized asset storage.
- Validate Vercel function routing and environment separation in a separately authorized deployment.

There is no guarantee of unlimited free operation, continuous service availability, or production readiness.

## Activation checklist — wait for your project values

The framework is prepared; no project has been connected and real Google consent/refresh/storage behavior has not been verified. Add the URL/public key and server secret directly to your ignored local .env or Vercel project settings, never chat. For Vercel, select the intended environment and redeploy after saving values because VITE_ variables are embedded at build time.

After setup, test Google login and denial/cancellation, reload, refresh/expiry, sign-out, two real accounts, save/load/delete, revision conflicts and account switching. Verify that local demo data remains separate. Export unsaved account work before leaving. Do not treat passing synthetic identity tests as proof of a live provider configuration.
