import { defineRailway, github, preserve, project, service } from "railway/iac";

// Railway infrastructure as code. Preview with `railway config plan`, then apply with
// `railway config apply` after `railway link` to the project. Secret values are never written
// here (this repo is public): preserve() keeps whatever is set in the Railway dashboard.
const repo = "sdsouza133/icp-lead-engine";

export default defineRailway(() => {
  const web = service("web", {
    source: github(repo, { branch: "main" }),
    build: "pnpm --filter @icp/web build",
    start: "pnpm --filter @icp/web start",
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: preserve(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: preserve(),
      SUPABASE_SECRET_KEY: preserve(),
      INNGEST_EVENT_KEY: preserve(),
      INNGEST_SIGNING_KEY: preserve(),
      SENTRY_DSN: preserve(),
    },
  });

  // Runs every pipeline function over Inngest Connect. Scale it by adding replicas.
  const worker = service("worker", {
    source: github(repo, { branch: "main" }),
    build: "pnpm --filter @icp/worker build",
    start: "pnpm --filter @icp/worker start",
    env: {
      INNGEST_EVENT_KEY: preserve(),
      INNGEST_SIGNING_KEY: preserve(),
      SUPABASE_SECRET_KEY: preserve(),
      ANTHROPIC_API_KEY: preserve(),
      APIFY_TOKEN: preserve(),
      SENTRY_DSN: preserve(),
      WORKER_MAX_CONCURRENCY: "10",
    },
  });

  return project("icp-lead-engine", { resources: [web, worker] });
});
