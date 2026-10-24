import { ping } from "./functions/ping";

export { inngest } from "./client";
export * from "./events";

/** Every function the worker registers with Inngest. */
export const functions = [ping];
