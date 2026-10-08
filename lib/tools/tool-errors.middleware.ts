import {
  createMiddleware,
  toolErrorMiddleware,
  ToolInvocationError,
} from 'langchain';
import { unknownTool } from '../errors/messages.js';
import { reportToolError, RunReporter } from '../logging/index.js';

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
 */
export const unknownTools = (reporter: RunReporter) =>
  createMiddleware({
    name: 'unknownTools',
    wrapToolCall: (request, handler) => {
      if (!request.tool) {
        reportToolError(reporter, {
          tool: request.toolCall.name,
          callId: request.toolCall.id ?? '',
          reason: 'unknown-tool',
          error: new Error(unknownTool()),
          durationMs: 0,
        });
      }

      return handler(request);
    },
  });
