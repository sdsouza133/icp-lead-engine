# ICP Lead Engine

Finds ICP-qualified leads among the people who engage with your competitors' leaders on
LinkedIn, then finds and verifies their emails. Multi-tenant: your team plus client workspaces.

"ICP Lead Engine" is a working name. The architecture and phased build plan live in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

- **Railway** hosts two services from this repo: the Next.js web app and a worker.
- **Supabase**: Postgres with row-level security, Auth, Realtime and Storage.
- **Inngest** runs every lead run as a durable workflow; the worker connects with Inngest Connect.
- **Providers** (Apify, Claude, Findymail, Icypeas, Reoon, BounceBan) sit behind adapters.

## Repository layout

| Path                  | Holds                                                    |
| --------------------- | -------------------------------------------------------- |
| `apps/web`            | Next.js app: UI, server actions and webhooks             |
| `apps/worker`         | Inngest Connect worker that runs every pipeline function |
| `packages/core`       | Domain logic: ICP schema, scoring rules, credits         |
| `packages/pipeline`   | Inngest client, events and functions                     |
| `packages/providers`  | Provider adapter interface and fakes                     |
| `packages/db`         | Generated Supabase types                                 |
| `supabase/`           | Migrations, config and pgTAP tests                       |
| `.railway/railway.ts` | Railway services as code                                 |

## Getting started

You need Node 22.12 or later (24 recommended), Corepack (ships with Node) and Docker for the
local Supabase stack.

```bash
corepack pnpm install
cp .env.example apps/web/.env.local
cp .env.example apps/worker/.env
corepack pnpm db:start          # local Supabase in Docker
npx inngest-cli@latest dev      # local Inngest dev server, in a second terminal
corepack pnpm dev               # web on http://localhost:3000, plus the worker
```

Run `corepack enable` once (it may need an administrator shell on Windows) to drop the
`corepack` prefix.

## Scripts

| Command                                  | Does                                             |
| ---------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                               | Runs the web app and the worker                  |
| `pnpm lint` / `pnpm lint:fix`            | Lints and formats with Biome                     |
| `pnpm typecheck`                         | Type-checks every package and the Railway config |
| `pnpm test`                              | Runs the Vitest suites                           |
| `pnpm build`                             | Builds the web app and checks the worker         |
| `pnpm db:start` / `db:test` / `db:types` | Local Supabase, pgTAP tests, generated types     |

## Deploying to Railway

`.railway/railway.ts` declares two services:
- `web` runs `pnpm --filter @icp/web start` behind the `/api/health` healthcheck.
- `worker` runs `pnpm --filter @icp/worker start` and needs no public port.

```bash
railway login
railway link            # choose the project and environment
railway config plan     # review the changes
railway config apply
```

Set secret values in the Railway dashboard. The config uses `preserve()`, so they never live in
this repository. In each service's settings, have deploys wait for GitHub checks so a red build
never ships.

## Contributing

Every change goes through a pull request. CI (lint, typecheck, tests, build and database tests)
and the CodeRabbit review must pass before merging. This repository is public: never commit
secrets, real lead data or `.env` files.
