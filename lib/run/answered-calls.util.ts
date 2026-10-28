/**
 * The ids of the tool calls the messages answer: the tool node answers every
 * call it runs. Structural rather than `BaseMessage`. See #52.
 *
 * @internal
 * @param messages A run's messages.
 * @returns The ids their `tool_call_id`s answer.
 */
export const answeredCalls = (messages: readonly object[]): Set<string> =>
  new Set(
    messages.flatMap((message) =>
      'tool_call_id' in message && typeof message.tool_call_id === 'string'
        ? [message.tool_call_id]
        : [],
    ),
  );
