export type TokenAccumulator = {
  inputTokens: number;
  outputTokens: number;
};

export type UsageInput =
  | {
      inputTokens?: number | null;
      outputTokens?: number | null;
    }
  | undefined;

export function createTokenAccumulator(): TokenAccumulator {
  return { inputTokens: 0, outputTokens: 0 };
}

export function addUsage(
  accumulator: TokenAccumulator,
  usage: UsageInput,
): void {
  if (!usage) return;
  accumulator.inputTokens += usage.inputTokens ?? 0;
  accumulator.outputTokens += usage.outputTokens ?? 0;
}
