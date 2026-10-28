import { createMiddleware } from 'langchain';
import { RunOutput } from './run-output.js';

// The run's output travels under our own key in `configurable`, which
// LangGraph keeps out of the trace metadata and checkpoints. See #151.
const OUTPUT_KEY = 'nestjs-langchain:output';

/**
 * The `configurable` entry that hands a run's output to the middleware. A
 * text run sets it to `null`, or it would inherit the output of the run it is
 * nested in, which LangChain hands down. See #295.
 *
 * @internal
 * @param output The run's output, if it asked for one.
 * @returns The entry to put in `configurable`.
 */
export const outputConfig = (output: RunOutput | undefined) => ({
  [OUTPUT_KEY]: output ?? null,
});

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
        return await handler({ ...request, responseFormat: output.strategy });
      } catch (error) {
        throw output.failure(error);
      }
    },
  });
