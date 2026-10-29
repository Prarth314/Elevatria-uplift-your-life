# Security

Elevatria is a portfolio application with a local demo and an optional cloud integration. It has not undergone an independent penetration test or a live hosted/OAuth security assessment.

## Report a vulnerability

Use the repository's **Security → Report a vulnerability** option when available. Please do not post keys, tokens, personal boards, screenshots containing private data, or exploit details in a public issue. Describe the affected revision and reproduction steps using synthetic data.

## Current boundaries

- Local demo data lives in this browser origin and is not an authenticated or encrypted account store.
- Account documents remain in memory until explicitly saved. All active demo writes reject account-mode data.
- Server credentials belong only in server environment variables. Only publishable/anon configuration is browser-visible.
- Cloud access must remain disabled until the documented migrations, OAuth configuration, and live two-account checks are complete.
- API ownership is derived from verified identity. Direct browser database access is denied by migration 002.
- Hosted service quotas, token lifetime/revocation behavior, and platform-level traffic controls must be reviewed before deployment.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run audit -- --history --dist
pnpm audit --audit-level low
```

The source scanner emits categories, paths, counts and blob IDs, never matched credential values. Email matches require context review; the tool cannot establish the absence of every PII or secret format. Build artifacts and local env files must remain untracked.

See [the audit and remediation record](docs/SECURITY_AUDIT.md) for findings, tests, and remaining operational checks.
