import { toolErrorMiddleware, ToolInvocationError } from 'langchain';

/**
 * Turns a failed tool call into the text the model receives, LangChain's own,
 * without the stack (and its server paths) LangChain puts in a schema failure.
 * Every error is answered: past a middleware, LangChain's tool node rethrows
 * any error left unhandled and fails the run. See #176.
 *
 * Once langchain-ai/langchainjs#11830 ships, LangChain's own text has no stack
 * and `tool-errors.middleware.spec.ts` fails: the schema branch can go.
 */
export const toolErrorsWithoutStack = () =>
  toolErrorMiddleware({
    onError: (error) => {
      if (!ToolInvocationError.isInstance(error)) {
        // LangChain's default for a method that throws.
        return `${String(error)}\n Please fix your mistakes.`;
      }

      const { toolCall, toolError } = error;

      return (
        `Error invoking tool '${toolCall.name}' with kwargs ` +
        `${JSON.stringify(toolCall.args)} with error: ${String(toolError)}\n` +
        ' Please fix the error and try again.'
      );
    },
  });
