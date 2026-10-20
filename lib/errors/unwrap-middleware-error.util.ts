import { MiddlewareError } from 'langchain';

/**
 * The error as thrown, without the `MiddlewareError` LangChain wraps it in at
 * each `wrapModelCall` middleware it crosses, a provider error included.
 *
 * @internal
 * @param error What the agent's graph threw.
 * @returns The innermost error.
 */
export const unwrapMiddlewareError = (error: unknown): unknown => {
  let unwrapped = error;

  while (MiddlewareError.isInstance(unwrapped) && unwrapped.cause) {
    unwrapped = unwrapped.cause;
  }

  return unwrapped;
};
