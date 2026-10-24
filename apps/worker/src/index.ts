import { functions, inngest } from "@icp/pipeline";
import { connect } from "inngest/connect";

// The worker opens an outbound connection to Inngest (Inngest Connect), so it needs
// no public endpoint and its steps are not bound by HTTP request timeouts.
const maxWorkerConcurrency = Number(process.env.WORKER_MAX_CONCURRENCY ?? "10");

await connect({
  apps: [{ client: inngest, functions }],
  instanceId: process.env.RAILWAY_REPLICA_ID ?? "local-worker",
  maxWorkerConcurrency,
});

console.info(`[worker] connected to Inngest with ${functions.length} function(s)`);
