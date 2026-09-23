// Structural rather than `BaseMessage`. See #52.
interface MessageLike {
  usage_metadata?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
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

  return {
    tools,
    tokens: reported.reduce(
      (total, usage) => ({
        input: total.input + (usage.input_tokens ?? 0),
        output: total.output + (usage.output_tokens ?? 0),
        total: total.total + (usage.total_tokens ?? 0),
      }),
      { input: 0, output: 0, total: 0 },
    ),
  };
};
