import { mergeUsageMetadata, UsageMetadata } from '@langchain/core/messages';

// Structural rather than `BaseMessage`. See #52.
interface MessageLike {
  usage_metadata?: UsageMetadata;
  tool_calls?: { name: string; id?: string }[];
  tool_call_id?: string;
}

/** What a run did and cost. */
export interface RunSummary {
  /**
   * Every tool call that reached the agent's tools, failed and unknown ones
   * included, but not the one returning a structured output.
   */
  tools: string[];
  /**
   * Summed over the run's model calls; absent when the provider reports no
   * usage.
   */
  tokens?: { input: number; output: number; total: number };
}

/**
 * What a finished run cost, read off the messages it returned.
 *
 * @internal
 * @param messages The messages of the finished run.
 * @param outputTool The tool the model returned a structured output through.
 * @param aside The usage of the replies the run left out of its messages.
 * @returns The tool calls that reached the tools, and the tokens if reported.
 */
export const summariseRun = (
  messages: readonly MessageLike[],
  outputTool?: string,
  aside: readonly UsageMetadata[] = [],
): RunSummary => {
  // The tool node answers every call it runs; one that did not run has no
  // answer (see #290). One with no id cannot be told, and counts (see #295).
  const answered = new Set(
    messages.flatMap(({ tool_call_id }) =>
      tool_call_id === undefined ? [] : [tool_call_id],
    ),
  );

  const tools = messages
    .flatMap((message) => message.tool_calls ?? [])
    .filter(
      ({ name, id }) =>
        name !== outputTool && (id === undefined || answered.has(id)),
    )
    .map((call) => call.name);

  const reported = [
    ...messages
      .map((message) => message.usage_metadata)
      .filter((usage) => usage !== undefined),
    ...aside,
  ];

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
