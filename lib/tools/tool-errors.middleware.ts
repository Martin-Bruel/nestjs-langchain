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
import { invalidTool, toolNotRun, unknownTool } from '../errors/messages.js';
import { reportToolError, RunReporter } from '../logging/index.js';
import { answeredCalls, UsageAside } from '../run/index.js';

// The default of LangChain's own retry middlewares. See #151.
const MAX_REASKS = 2;

// LangChain routes every `extract-` call to structured output, never to the
// tools: one the model invents, which is not the run's output, neither runs
// nor gets an answer. See #264.
const isInvented = ({ name }: ToolCall): boolean =>
  name.startsWith(STRUCTURED_OUTPUT_PREFIX) && name !== OUTPUT_TOOL;

const invented = (calls: readonly ToolCall[]): ToolCall[] =>
  calls.filter(isInvented);

const callsOf = (message: BaseMessage | undefined): ToolCall[] =>
  AIMessage.isInstance(message) ? (message.tool_calls ?? []) : [];

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
 * node: it is answered here, as the tool node answers any other, and so is
 * any call LangChain leaves unanswered.
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

  const answer = (call: ToolCall) =>
    new ToolMessage({
      content: isInvented(call)
        ? invalidTool(call.name, tools)
        : toolNotRun(call.name),
      tool_call_id: call.id ?? '',
      name: call.name,
      status: 'error',
    });

  // Every call without an answer gets one right after its message, which
  // providers require: an invented one (see #264), or one LangChain left out
  // next to the output (see #290). In the request, which the output's retry
  // reaches without `beforeModel`; rebuilt on every model call, so only the
  // reply just made is reported. See #297.
  const answerLeft = (messages: BaseMessage[]): BaseMessage[] => {
    const done = answeredCalls(messages);
    const left = (message: BaseMessage | undefined) =>
      callsOf(message).filter(({ id }) => id !== undefined && !done.has(id));

    invented(left(messages.findLast((m) => AIMessage.isInstance(m)))).forEach(
      report,
    );

    return messages.flatMap((message) => [
      message,
      ...left(message).map(answer),
    ]);
  };

  return createMiddleware({
    name: 'unknownTools',
    // Alone, LangChain would end the run: answered, and the model asked again,
    // as `modelRetryMiddleware` asks it again. See #264.
    wrapModelCall: async (request, handler) => {
      let current = { ...request, messages: answerLeft(request.messages) };

      for (let asked = 0; ; asked += 1) {
        const reply = await handler(current);
        const calls = callsOf(reply);
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
