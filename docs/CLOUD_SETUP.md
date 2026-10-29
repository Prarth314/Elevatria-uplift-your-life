# Optional account storage — zero-paid-service setup

The local planner requires no account, API key, or backend. This integration adds an optional account board. Do not upgrade a service or add billing to follow this guide.

## Status and verification boundary

Implemented: GitHub OAuth/PKCE client flow using the official Supabase SDK; authenticated API; owner-derived access; PostgreSQL migration and row security; atomic revision checks; explicit load/save/delete controls; separate local/account state. The SDK keeps the tab's Auth session in sessionStorage. Application documents loaded from an account remain in memory and are not copied into the local demo store. Sign-out restores the separate local board.

Verified locally: TypeScript, service-level authorization tests, adapter contract tests, and execution of the migration/row-security tests against embedded PostgreSQL (PGlite). This does not verify a live Supabase project's gateway, OAuth configuration, email/identity settings, or a deployed Vercel function. No live project has been provisioned or connected by this change.

## 1. Prepare a free development project

Create/select a Supabase **Free** project in your own account. Review current free-plan limits. Free projects may pause; the independent local demo remains available. Do not use keep-alive jobs or paid upgrades as a prerequisite.

In a new, dedicated development database, apply `database/migrations/001_workspace_storage.sql` once using the SQL editor. It creates `public.workspaces`, a read policy, and two server-only RPC functions. It does not touch unrelated tables. Inspect it before execution. Applying it again is expected to fail rather than overwrite existing tables.

The first cloud adapter stores one validated JSON workspace per account, capped at 1 MB by the API. That preserves the existing versioned local format and permits atomic replacement/import and optimistic concurrency. PostgreSQL stores ownership, revision and update time as columns. Tasks/assets are not yet normalized into separate tables. Base64 images consume document capacity; reduce images/history or keep a local backup when the cap is reached.

## 2. Configure GitHub OAuth

Enable GitHub under Supabase Authentication providers. Register a GitHub OAuth application with the callback URL shown by Supabase. Enter its credentials only in the provider configuration, never in source or browser storage.

Add the local application URL (for example `http://127.0.0.1:5174/`) to Supabase's allowed redirect URLs. Add an exact hosted URL only when deployment is separately authorized. OAuth returns to the application root; the SDK uses PKCE and handles the session exchange.

Official guide: [Supabase GitHub sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-github).

## 3. Configure local environment

Copy `.env.example` to `.env` in the repository root. Uncomment and supply:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

The first two values are intentionally public. The secret key must remain server-only. The build rejects recognizable privileged keys in `VITE_SUPABASE_PUBLISHABLE_KEY`; this is a guard, not a substitute for checking environment configuration. `.env` is ignored by Git.

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

1. Sign in with GitHub. Signing in does not upload the local board.
2. To start, choose **Copy this board to cloud** and confirm. This creates revision 1 only when no account board exists.
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

Errors: 400 malformed input, 401 invalid session, 403 origin mismatch, 409 revision conflict, 413 size limit, 422 domain validation, 503 unavailable/unconfigured infrastructure. Errors include a request ID and never return tokens or provider errors verbatim.

Database browser roles can read only their own row and cannot write or execute mutation RPCs. Server writes use the verified owner and privileged credentials. Changes to this boundary require corresponding SQL and two-user tests.

## Remaining work before opening account access publicly

- Verify real OAuth callback, refresh, expiration, and sign-out on the configured project.
- Exercise gateway/RPC behavior with two actual accounts and parallel requests.
- Add shared rate limiting and operational usage limits appropriate to the selected free plan.
- Implement account deletion, a fuller offline/cache policy, and optional normalized asset storage.
- Validate Vercel function routing and environment separation in a separately authorized deployment.

There is no guarantee of unlimited free operation, continuous service availability, or production readiness.
