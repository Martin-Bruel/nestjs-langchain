import { createMiddleware } from 'langchain';
import { RunOutput } from './run-output.js';

// The run's output travels under our own key in `configurable`, which
// LangGraph keeps out of the trace metadata and checkpoints. See #151.
const OUTPUT_KEY = 'nestjs-langchain:output';

/**
 * The `invoke` configuration that hands a run's output to the middleware.
 *
 * @internal
 * @param output The run's output, if it asked for one.
 * @returns The `configurable` to pass, empty for a text run.
 */
export const outputConfig = (output: RunOutput | undefined) =>
  output ? { configurable: { [OUTPUT_KEY]: output } } : {};

/**
 * Sets the `responseFormat` of each model call of a run that asked for an
 * `output`, so that one compiled agent serves text and structured runs.
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
          responseFormat: output.strategyFor(request.model),
        });
      } catch (error) {
        throw output.failure(error);
      }
    },
  });
