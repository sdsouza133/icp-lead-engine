import { inngest } from "../client";
import { systemPing } from "../events";

export const ping = inngest.createFunction(
  { id: "system-ping", triggers: [systemPing] },
  async ({ event, step }) => {
    const receivedAt = await step.run("record-receipt", () => new Date().toISOString());
    return { ok: true, requestedBy: event.data.requestedBy, receivedAt };
  },
);
