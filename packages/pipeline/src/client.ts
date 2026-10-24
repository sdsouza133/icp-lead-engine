import { Inngest } from "inngest";

// Inngest SDK v4 defaults to cloud mode. Set INNGEST_DEV=1 locally to use the dev server.
export const inngest = new Inngest({ id: "icp-lead-engine" });
