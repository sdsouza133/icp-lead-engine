/** Where a paid call came from. Used for the per-item cost ledger and for idempotency. */
export interface CallContext {
  orgId: string;
  runId: string;
  stage: string;
}

/** Cost attributed to one input item, so a batch shared by several runs can be split fairly. */
export interface ItemCost {
  itemKey: string;
  costUsd: number;
}

export interface ProviderResult<TOutput> {
  items: TOutput[];
  costs: ItemCost[];
}

/**
 * Every external provider (Apify actor, Claude, email finder, verifier) sits behind one of
 * these, so a broken provider can be swapped without touching the pipeline.
 */
export interface ProviderAdapter<TInput, TOutput> {
  /** Stable identifier, e.g. "apify:harvestapi/linkedin-post-reactions". */
  readonly provider: string;
  run(inputs: TInput[], context: CallContext): Promise<ProviderResult<TOutput>>;
}
