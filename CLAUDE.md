# CLAUDE.md

Guidance for Claude Code sessions in this repository.

## What this is

ICP Lead Engine: a multi-tenant lead-gen app. A run goes client website → ICP → approved competitor
LinkedIn pages → their decision makers' recent posts → everyone who engaged → qualified against the
ICP → email finder waterfall → Reoon, then a catch-all check → lead table and CSV.

`docs/ARCHITECTURE.md` is the technical copy of the plan of record. Read the relevant section
before starting work, and follow the phase checklists and gates in its "Build plan". Costs,
compliance notes and the risk register stay in the private plan because this repository is public.

## Commands

Use pnpm 10.34.8 through Corepack (`corepack pnpm …`, or plain `pnpm` after `corepack enable`).
- `pnpm install`
- `pnpm lint` / `pnpm lint:fix` (Biome)
- `pnpm typecheck`
- `pnpm test` (Vitest; tests live next to the code as `*.test.ts`)
- `pnpm build`
- `pnpm db:start`, `pnpm db:test`, `pnpm db:types` (Supabase CLI; needs Docker)

## Layout

- `apps/web`: Next.js 16 app (UI, server actions, webhooks). Deployed as the Railway `web` service.
- `apps/worker`: Inngest Connect worker. Deployed as the Railway `worker` service.
- `packages/core`: domain logic with no I/O.
- `packages/pipeline`: Inngest client, events and functions.
- `packages/providers`: adapters for every external provider, plus fakes for tests.
- `packages/db`: generated Supabase types (`pnpm db:types`); never edit by hand.
- `supabase/`: migrations and pgTAP tests. `.railway/railway.ts`: Railway services as code.

## Rules

- **Public repo.** Never commit secrets, real lead data or `.env` files. Secrets live in Railway
  and Inngest settings; `.railway/railway.ts` uses `preserve()` for them.
- **Tenant isolation.** Every tenant table enables row-level security, with policies that check both
  `org_id` and the member's role, and ships with a pgTAP test proving one workspace can't see
  another's rows. Shared-cache tables stay closed to the `anon` and `authenticated` roles.
  `post_engagements` and `run_candidates` are partitioned by month from creation.
- **Providers.** Every external call goes through an adapter in `packages/providers`, with a timeout,
  retries for retryable errors only, zod validation of the response and per-item cost reporting.
  Never log personal data (names, emails, LinkedIn URLs); log IDs.
- **Pipeline (Inngest SDK v4).** Triggers go in the `createFunction` options; declare events with
  `eventType()`. Event payloads carry IDs only. Steps are idempotent and keyed per item, check the
  run's budget, and use per-workspace concurrency keys. Functions run in `apps/worker` over
  Inngest Connect; don't add an HTTP serve endpoint for them.
- **Claude.** Default model `claude-opus-5-5`. Moving the bulk headline-screen and fit-score stages
  to `claude-haiku-5-5` is the user's decision after the phase 3 side-by-side test. Always handle
  the `refusal` stop reason.
- **Billing.** Clients are charged once per delivered lead (qualified, with a verified email).
  Every credit-ledger entry carries an idempotency key.
- **Workflow.** Branch from `main`, open a pull request, and merge only when CI and the CodeRabbit
  review are green.
