import { AgentAbortedError } from './agent-aborted.error.js';
import { AgentRecursionLimitError } from './agent-recursion-limit.error.js';
import { AgentRunError } from './agent-run.error.js';
import {
  agentRunFailed,
  recursionLimitReached,
  runAborted,
} from './messages.js';
import { unwrapMiddlewareError } from './unwrap-middleware-error.util.js';

interface FailedRun {
  agent: string;
  /** Empty for the unnamed agent, `'MATH '` otherwise. */
  prefix: string;
  signal?: AbortSignal;
  /** The run's limit, or the agent's. */
  recursionLimit?: number;
}

/**
 * The `AgentRunError` `run()` throws for what the agent's graph threw.
 *
 * @internal
 * @param thrown What the graph threw.
 * @param run The run that failed.
 * @returns The error itself when it is one already, else the subclass of its
 * kind, the original in `cause`.
 */
export const toRunError = (
  thrown: unknown,
  { agent, prefix, signal, recursionLimit }: FailedRun,
): AgentRunError => {
  const cause = unwrapMiddlewareError(thrown);

  if (cause instanceof AgentRunError) {
    return cause;
  }

  // The reason itself, which LangChain may have wrapped on its way out.
  if (signal?.aborted) {
    return new AgentAbortedError(runAborted(prefix), agent, {
      cause: signal.reason,
    });
  }

  // By name, as LangGraph tells its errors apart; it is not a dependency of
  // ours. See #194.
  if (cause instanceof Error && cause.name === 'GraphRecursionError') {
    return new AgentRecursionLimitError(
      recursionLimitReached(prefix, recursionLimit),
      agent,
      { cause },
    );
  }

  return new AgentRunError(agentRunFailed(prefix, cause), agent, { cause });
};
