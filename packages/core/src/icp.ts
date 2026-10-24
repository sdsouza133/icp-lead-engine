import { z } from "zod";

export const SeniorityLevel = z.enum([
  "owner",
  "founder",
  "c_level",
  "vp",
  "head",
  "director",
  "manager",
  "senior_ic",
  "entry",
]);

export const BuyerPersona = z.object({
  titles: z.array(z.string().min(1)).min(1),
  seniorities: z.array(SeniorityLevel),
  functions: z.array(z.string().min(1)),
  /** Relative importance of this persona, from 0 to 1. */
  weight: z.number().min(0).max(1),
});

/** Ties a claim in the ICP to the page and words it came from. */
export const Evidence = z.object({
  claim: z.string().min(1),
  sourceUrl: z.url(),
  quote: z.string().min(1),
});

/** The ICP Claude extracts from a client's website. Every edit is stored as a new version. */
export const IcpSchema = z.object({
  summary: z.string().min(1),
  industries: z
    .array(z.object({ name: z.string().min(1), weight: z.number().min(0).max(1) }))
    .min(1),
  companySize: z
    .object({
      minEmployees: z.number().int().min(1),
      maxEmployees: z.number().int().min(1).nullable(),
    })
    .refine((size) => size.maxEmployees === null || size.maxEmployees >= size.minEmployees, {
      error: "maxEmployees must be at least minEmployees",
    }),
  regions: z.array(z.string().min(1)).min(1),
  businessModel: z.enum(["b2b", "b2c", "b2b2c", "marketplace", "other"]),
  personas: z.array(BuyerPersona).min(1),
  exclusions: z.object({
    titles: z.array(z.string()),
    industries: z.array(z.string()),
    companies: z.array(z.string()),
  }),
  pains: z.array(z.string()),
  buyingTriggers: z.array(z.string()),
  evidence: z.array(Evidence),
});

export type Icp = z.infer<typeof IcpSchema>;
