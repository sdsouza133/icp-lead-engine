import type { CallContext, ProviderAdapter, ProviderResult } from "./types";

export interface FakeAdapterOptions<TInput, TOutput> {
  provider: string;
  costPerItemUsd: number;
  keyOf: (input: TInput) => string;
  produce: (input: TInput) => TOutput[];
}

export type FakeAdapter<TInput, TOutput> = ProviderAdapter<TInput, TOutput> & {
  /** Every call made, for assertions in tests. */
  readonly calls: Array<{ inputs: TInput[]; context: CallContext }>;
};

/** In-memory adapter for tests and local runs. Charges a fixed price per input item. */
export function createFakeAdapter<TInput, TOutput>(
  options: FakeAdapterOptions<TInput, TOutput>,
): FakeAdapter<TInput, TOutput> {
  const calls: Array<{ inputs: TInput[]; context: CallContext }> = [];

  return {
    provider: options.provider,
    calls,
    run(inputs, context): Promise<ProviderResult<TOutput>> {
      calls.push({ inputs, context });
      return Promise.resolve({
        items: inputs.flatMap(options.produce),
        costs: inputs.map((input) => ({
          itemKey: options.keyOf(input),
          costUsd: options.costPerItemUsd,
        })),
      });
    },
  };
}
