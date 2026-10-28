import {
  AIMessage,
  BaseMessage,
  ToolCall,
  ToolMessage,
} from '@langchain/core/messages';
import {
  createMiddleware,
  toolErrorMiddleware,
  ToolInvocationError,
} from 'langchain';
import { OUTPUT_TOOL, STRUCTURED_OUTPUT_PREFIX } from '../constants.js';
import { invalidTool, unknownTool } from '../errors/messages.js';
import { reportToolError, RunReporter } from '../logging/index.js';
import { UsageAside } from '../run/index.js';

// The default of LangChain's own retry middlewares. See #151.
const MAX_REASKS = 2;

// LangChain routes every `extract-` call to structured output, never to the
// tools: one the model invents, which is not the run's output, neither runs
// nor gets an answer. See #264.
const invented = (calls: readonly ToolCall[]): ToolCall[] =>
  calls.filter(
    ({ name }) =>
      name.startsWith(STRUCTURED_OUTPUT_PREFIX) && name !== OUTPUT_TOOL,
  );

const answered = (messages: readonly BaseMessage[]): Set<string> =>
  new Set(
    messages
      .filter((m): m is ToolMessage => ToolMessage.isInstance(m))
      .map((m) => m.tool_call_id),
  );

/**
 * Turns a failed tool call into the text the model receives, LangChain's own,
 * without the stack (and its server paths) LangChain puts in a schema failure.
 * Every error is answered: past a middleware, LangChain's tool node rethrows
 * any error left unhandled and fails the run. See #176.
 *
 * Also the only place that sees arguments the schema rejects, which never
 * reach the `@Tool` wrapper: they are reported here. See #177.
 *
 * Once langchain-ai/langchainjs#11830 ships, LangChain's own text has no stack
 * and `tool-errors.middleware.spec.ts` fails: the schema text can be left to
 * LangChain, the reporting stays.
 */
export const toolErrors = (reporter: RunReporter) =>
  toolErrorMiddleware({
    onError: (error) => {
      if (!ToolInvocationError.isInstance(error)) {
        // LangChain's default for a method that throws.
        return `${String(error)}\n Please fix your mistakes.`;
      }

      const { toolCall, toolError } = error;

      reportToolError(reporter, {
        tool: toolCall.name,
        callId: toolCall.id ?? '',
        reason: 'invalid-arguments',
        error: toolError,
        durationMs: 0,
      });

      return (
        `Error invoking tool '${toolCall.name}' with kwargs ` +
        `${JSON.stringify(toolCall.args)} with error: ${String(toolError)}\n` +
        ' Please fix the error and try again.'
      );
    },
  });

/**
 * Reports a call to a tool the agent does not have. LangChain's tool node
 * answers the model itself, without throwing, so `toolErrors` never sees it.
 * One the model invents with the `extract-` prefix never reaches the tool
 * node: it is answered here, as the tool node answers any other.
 *
 * @param reporter The agent's reporter.
 * @param tools The names of the agent's tools, which the answer lists.
 */
export const unknownTools = (reporter: RunReporter, tools: string[]) => {
  const report = ({ name, id }: ToolCall) =>
    reportToolError(reporter, {
      tool: name,
      callId: id ?? '',
      reason: 'unknown-tool',
      error: new Error(unknownTool()),
      durationMs: 0,
    });

  const answer = ({ name, id }: ToolCall) =>
    new ToolMessage({
      content: invalidTool(name, tools),
      tool_call_id: id ?? '',
      name,
      status: 'error',
    });

  return createMiddleware({
    name: 'unknownTools',
    // Next to other calls, which run: answered in the state before the model
    // is called again. See #264.
    beforeModel: ({ messages }) => {
      const reply = messages.findLast((m) => AIMessage.isInstance(m));
      const done = answered(messages);
      const left = invented(
        AIMessage.isInstance(reply) ? (reply.tool_calls ?? []) : [],
      ).filter(({ id }) => id !== undefined && !done.has(id));

      left.forEach(report);

      return left.length > 0 ? { messages: left.map(answer) } : undefined;
    },
    // Alone, LangChain would end the run: answered, and the model asked again,
    // as `modelRetryMiddleware` asks it again. See #264.
    wrapModelCall: async (request, handler) => {
      let current = request;

      for (let asked = 0; ; asked += 1) {
        const reply = await handler(current);
        const calls = AIMessage.isInstance(reply)
          ? (reply.tool_calls ?? [])
          : [];
        const left = invented(calls);

        if (calls.length === 0 || left.length < calls.length) {
          return reply;
        }

        left.forEach(report);

        if (asked === MAX_REASKS) {
          return reply;
        }

        // Left out of the run's messages, but paid for. See #296.
        UsageAside.of(request.runtime.configurable)?.add(
          AIMessage.isInstance(reply) ? reply.usage_metadata : undefined,
        );

        current = {
          ...current,
          messages: [...current.messages, reply, ...left.map(answer)],
        };
      }
    },
    wrapToolCall: (request, handler) => {
      if (!request.tool) {
        report(request.toolCall);
      }

      return handler(request);
    },
  });
};
