# Vercel deployment

Use the existing connected project rather than creating a second project. The application builds without any account, AI, Google or Supabase environment variables. Keep the Hobby/free configuration; no paid integration is needed for the local-demo workflow.

## Project settings

| Setting | Required value |
| --- | --- |
| Git repository / production branch | Prarth314/Elevatria-uplift-your-life / main |
| Root Directory | **Empty** (repository root), not src/frontend |
| Framework Preset | Vite |
| Node.js version | **24.x**, also pinned in root package.json |
| Install Command | pnpm install --frozen-lockfile |
| Build Command | pnpm build |
| Output Directory | src/frontend/dist |

The last three values and the framework preset are recorded in the repository-root vercel.json. Keep dashboard command overrides disabled unless a deliberate new configuration requires them. pnpm is pinned to 11.25.0 by packageManager; do not regenerate the lockfile with a different version to work around a deployment error.

The repository root is required because it contains vercel.json, api/workspace.ts, shared server modules and the workspace lockfile. Vite itself still runs in src/frontend through the root build wrapper. Selecting src/frontend as the Vercel root bypasses the intended hosting/API boundary.

## Build configuration fix — October 30, 2026

The failed deployment of commit 5795f10 stopped while loading vite.config.js:

```text
TypeError: Cannot read properties of undefined (reading '0')
```

The Vite configuration was reading vercel.json and assuming its headers array remained present in the build environment. Local builds passed, but the hosting build did not expose the expected shape. Vite now imports an application-owned security-headers.json, independently of the platform's deployment configuration. Production policies remain in vercel.json; a regression test enforces that preview and delivery headers agree.

The regression fixture recreates the exact exception with a headerless platform config. It now loads successfully with both a headerless and an absent vercel.json, without changing the real repository configuration. The project root was corrected from src/frontend to the repository root, and Node was aligned to the tested 24.x line.

## Serverless TypeScript configuration

The first corrected frontend build reached Ready, but a real API request exposed a second deployment issue: the old repository-root tsconfig.json emitted CommonJS and rejected explicit .ts imports. Vercel reported TS5097 diagnostics and the deployed function returned FUNCTION_INVOCATION_FAILED.

The root compiler configuration now extends the server's checked types, uses NodeNext ESM to match the package's module type, and rewrites relative TypeScript import extensions to JavaScript on emission. Generated local server output stays under ignored artifacts. A deployment regression compiles the full API dependency graph with this configuration, imports the emitted JavaScript, invokes the handler and verifies structured 401/no-store behavior.

## Verify a deployment

1. Push to main. Open the new Vercel deployment for that exact commit, rather than redeploying an old SHA.
2. Confirm installation and the root build command succeed, followed by a Ready production deployment.
3. Open the production domain, then /dashboard directly. The vision board and planning workflow should load without an external service.
4. Check CSP, nosniff, anti-framing and referrer headers on the served page; inspect for blocked scripts/fonts or browser errors.
5. Request /api/workspace without a token: expect structured 401 JSON with no-store. With a syntactically valid synthetic token and no cloud configuration, expect 503 CLOUD_NOT_CONFIGURED. These checks do not establish live account isolation.
6. Smoke-test goal editing, task completion and background schedule generation on the hosted frontend. Use synthetic data only. Demo data stays in that browser origin.

Optional account storage requires a separate free Supabase project, both SQL migrations and real OAuth/two-account verification in [CLOUD_SETUP.md](CLOUD_SETUP.md). Do not add placeholder Supabase environment variables to the Vercel project: incomplete public configuration deliberately fails the frontend build. Privileged keys belong only in server environment variables.

## Troubleshooting

- **Old failure still shown:** inspect the deployment commit; the screenshot/error history remains even after a newer deployment succeeds.
- **Missing output or API route:** confirm Root Directory is empty and output is src/frontend/dist. Rooting the project at src/frontend is not the supported full application deployment.
- **Config loader or Node mismatch:** use Node 24.x and the committed lockfile. The build no longer reads platform configuration as application data.
- **No cloud account controls:** expected without valid public Supabase configuration. Local planning remains available.
- **API 401/503:** expected for missing authentication/unconfigured cloud. Do not weaken authorization to make a smoke test return 200.

## Hosted verification — October 30, 2026

The connected Hobby project successfully deployed the corrected application at [elevatria-website.vercel.app](https://elevatria-website.vercel.app). The code-fix deployment of a9f831f reached Ready with clean build diagnostics, and its GitHub Actions run passed all 38 tests, frontend/server type checks, production build and audit gates.

Verified against the production domain:

- / and /dashboard return 200 with the Elevatria document title and the intended CSP, anti-framing, nosniff and referrer policies.
- /api/workspace returns structured JSON: 401 AUTH_REQUIRED without a token, 503 CLOUD_NOT_CONFIGURED for a syntactically valid synthetic token, and 403 ORIGIN_REJECTED for an untrusted origin. Responses are no-store; no authenticated provider call was needed.
- Browser goal edits survive reload. Keyboard task completion updates weighted progress. The background worker generates a proposal under production CSP, and accepted sessions survive reload. Synthetic edits were restored to the sample.
- The hosted browser console error query returned no entries.

Supabase remains unconfigured. OAuth, real cloud-user isolation, provider storage and Calendar sync are not claimed as verified. No paid integration or plan upgrade was enabled.
