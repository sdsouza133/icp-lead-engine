import { describe, expect, it } from "vitest";
import { type Icp, IcpSchema } from "./icp";

const validIcp: Icp = {
  summary: "Mid-market B2B SaaS companies that sell to revenue teams in North America.",
  industries: [{ name: "Software Development", weight: 1 }],
  companySize: { minEmployees: 50, maxEmployees: 1000 },
  regions: ["United States", "Canada"],
  businessModel: "b2b",
  personas: [
    {
      titles: ["VP Sales", "Head of Revenue Operations"],
      seniorities: ["vp", "head"],
      functions: ["Sales"],
      weight: 1,
    },
  ],
  exclusions: { titles: ["Recruiter"], industries: [], companies: [] },
  pains: ["Pipeline coverage below target"],
  buyingTriggers: ["New CRO hired"],
  evidence: [
    {
      claim: "Sells to revenue teams",
      sourceUrl: "https://example.com/solutions/revenue",
      quote: "Built for modern revenue teams",
    },
  ],
};

describe("IcpSchema", () => {
  it("accepts a complete ICP", () => {
    expect(IcpSchema.parse(validIcp)).toEqual(validIcp);
  });

  it("rejects an ICP without buyer personas", () => {
    expect(IcpSchema.safeParse({ ...validIcp, personas: [] }).success).toBe(false);
  });

  it("rejects a company size range that runs backwards", () => {
    const backwards = { ...validIcp, companySize: { minEmployees: 500, maxEmployees: 50 } };
    expect(IcpSchema.safeParse(backwards).success).toBe(false);
  });

  it("rejects evidence without a valid source URL", () => {
    const badEvidence = {
      ...validIcp,
      evidence: [{ claim: "x", sourceUrl: "not a url", quote: "y" }],
    };
    expect(IcpSchema.safeParse(badEvidence).success).toBe(false);
  });
});
