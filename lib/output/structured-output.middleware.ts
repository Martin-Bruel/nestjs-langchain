import { AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { createMiddleware } from 'langchain';
import { toolNotRun } from '../errors/messages.js';
import { RunOutput } from './run-output.js';

// The run's output travels under our own key in `configurable`, which
// LangGraph keeps out of the trace metadata and checkpoints. See #151.
const OUTPUT_KEY = 'nestjs-langchain:output';

// LangChain answers the output call alone, and leaves the reply's other calls
// unanswered, which providers refuse in the next request. Each gets an error
// right after its message, as LangChain's own middlewares answer the calls
// they do not run. See #290.
const answerLeftCalls = (messages: BaseMessage[]): BaseMessage[] => {
  const answered = new Set(
    messages
      .filter((m): m is ToolMessage => ToolMessage.isInstance(m))
      .map((m) => m.tool_call_id),
  );

  return messages.flatMap((message) => {
    if (!AIMessage.isInstance(message)) {
      return [message];
    }

    const left = (message.tool_calls ?? []).flatMap(({ id, name }) =>
      id && !answered.has(id)
        ? [
            new ToolMessage({
              content: toolNotRun(name),
              tool_call_id: id,
              name,
              status: 'error',
            }),
          ]
        : [],
    );

    return [message, ...left];
  });
};

/**
 * The `invoke` configuration that hands a run's output to the middleware.
 * A text run sets it to `null`, or it would inherit the output of the run it
 * is nested in, which LangChain hands down. See #295.
 *
 * @internal
 * @param output The run's output, if it asked for one.
 * @returns The `configurable` to pass.
 */
export const outputConfig = (output: RunOutput | undefined) => ({
  configurable: { [OUTPUT_KEY]: output ?? null },
});

/**
 * Sets the `responseFormat` of each model call of a run that asked for an
 * `output`, so that one compiled agent serves text and structured runs, and
 * answers the calls LangChain leaves unanswered next to the output.
 * LangChain's parsing failures come out as a `StructuredOutputError`.
 *
 * @internal
 */
export const structuredOutput = () =>
  createMiddleware({
    name: 'structuredOutput',
    wrapModelCall: async (request, handler) => {
      const output = request.runtime.configurable?.[OUTPUT_KEY];

      if (!(output instanceof RunOutput)) {
        return handler(request);
      }

      try {
        return await handler({
          ...request,
          messages: answerLeftCalls(request.messages),
          responseFormat: output.strategy,
        });
      } catch (error) {
        throw output.failure(error);
      }
    },
  });
