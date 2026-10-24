import { describe, expect, it } from "vitest";
import { createFakeAdapter } from "./fake";

describe("createFakeAdapter", () => {
  it("returns items and charges each input item once", async () => {
    const adapter = createFakeAdapter({
      provider: "fake:linkedin-posts",
      costPerItemUsd: 0.0015,
      keyOf: (url: string) => url,
      produce: (url: string) => [{ url, reactions: 3 }],
    });

    const result = await adapter.run(["https://example.com/p/1", "https://example.com/p/2"], {
      orgId: "org_1",
      runId: "run_1",
      stage: "posts",
    });

    expect(result.items).toHaveLength(2);
    expect(result.costs).toEqual([
      { itemKey: "https://example.com/p/1", costUsd: 0.0015 },
      { itemKey: "https://example.com/p/2", costUsd: 0.0015 },
    ]);
    expect(adapter.calls).toHaveLength(1);
  });
});
