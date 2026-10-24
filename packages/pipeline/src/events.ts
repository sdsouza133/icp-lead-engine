import { eventType } from "inngest";
import { z } from "zod";

// Events carry IDs only, never personal data, so deletion requests never have to reach Inngest.

/** Round trip check that a worker is connected and running functions. */
export const systemPing = eventType("system/ping", {
  schema: z.object({ requestedBy: z.string().min(1) }),
});
