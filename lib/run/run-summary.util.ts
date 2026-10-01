import { mergeUsageMetadata, UsageMetadata } from '@langchain/core/messages';

// Structural rather than `BaseMessage`. See #52.
interface MessageLike {
  usage_metadata?: UsageMetadata;
  tool_calls?: { name: string }[];
}

export interface RunSummary {
  tools: string[];
  tokens?: { input: number; output: number; total: number };
}

/** What a finished run cost, read off the messages it returned. */
export const summariseRun = (messages: readonly MessageLike[]): RunSummary => {
  const tools = messages.flatMap((message) =>
    (message.tool_calls ?? []).map((call) => call.name),
  );

  const reported = messages
    .map((message) => message.usage_metadata)
    .filter((usage) => usage !== undefined);

  if (reported.length === 0) {
    return { tools };
  }

  // Seeded with zeros, so a field a provider left out counts as zero.
  const usage = reported.reduce(mergeUsageMetadata, mergeUsageMetadata());

  return {
    tools,
    tokens: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      total: usage.total_tokens,
    },
  };
};
