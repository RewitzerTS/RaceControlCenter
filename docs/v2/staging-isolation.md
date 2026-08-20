# V2 staging isolation

## Objective

V2 is developed and verified without changing the Production website or Production Supabase project. Production project reference `kjccstcbqygxuqkvdaqw` is a protected identifier and is rejected by the V2 runtime.

## Required external topology

| Concern | Production V1 | V2 staging |
|---|---|---|
| Git | `main` | `v2-development` and short-lived feature branches |
| Cloudflare Pages | Existing project and domains | New, dedicated Pages project |
| Supabase | Existing `Race Control Center` project | New, separate project in the same organization |
| Secrets | Existing Production values | New staging-only URL and publishable key |
| Public URL | Existing live domains | Pages preview/branch URL until cutover approval |

Supabase database branching is not used for the initial staging environment because persistent branches require a paid plan. A separate project gives V2 distinct credentials and a hard blast-radius boundary.

## Cloudflare Pages settings

- Repository: the same repository, with a new Pages project.
- Production branch for the staging project: `v2-development`.
- Root directory: `v2`.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Environment variables: `VITE_APP_ENV=staging`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` using only the staging project.
- Preview deployments remain enabled. The included `_headers` file prevents indexing.

Do not attach an existing Production custom domain to this project.

## Supabase staging setup

1. Create a second project after cost confirmation.
2. Set allowed redirect URLs only to the V2 Pages staging and preview origins.
3. reconstruct the schema from a reviewed, complete migration baseline; do not copy browser credentials from Production.
4. Seed only synthetic or explicitly approved test data.
5. Deploy only V2-reviewed Edge Functions and secrets.
6. Verify RLS and RPC grants before enabling authenticated testing.

The repository currently does not contain a complete migration history for the live database. Creating a migration baseline is therefore a separate reviewed step, not an automatic inference from partial files.

## Local setup

```bash
cd v2
cp .env.example .env.local
npm install
npm run dev
```

Replace placeholders with staging-only values. The application fails closed if values are missing, malformed, or point at Production.

## Verification gates

- `npm run check` passes TypeScript checks.
- `npm test` verifies environment rejection and role mapping.
- `npm run build` produces an isolated static bundle.
- `npm run isolation` confirms the Production project reference occurs only in the runtime deny-list and that no service-role credential is present.
- V1 protected files remain unchanged in the branch diff.
