import z from 'zod';
import { AgentAbortedError } from './agent-aborted.error.js';
import { AgentContextError } from './agent-context.error.js';
import { AgentRecursionLimitError } from './agent-recursion-limit.error.js';
import { AgentRunError } from './agent-run.error.js';
import {
  agentRunFailed,
  contextInvalid,
  contextRequired,
  oneLine,
  recursionLimitReached,
  runAborted,
} from './messages.js';
import { unwrapMiddlewareError } from './unwrap-middleware-error.util.js';

interface FailedRun {
  agent: string;
  /** Empty for the unnamed agent, `'MATH '` otherwise. */
  prefix: string;
  /** What can stop the run, its own signal or its caller's. */
  signal?: AbortSignal;
  /** The limit the run was given. */
  recursionLimit: number;
  /** Whether the agent has a `contextSchema`, which LangChain validates. */
  validatesContext: boolean;
  /** Whether the run had a context, its own or its caller's. */
  hasContext: boolean;
  /** Whether the graph started, after LangChain's check of the context. */
  started: boolean;
}

// By its issues: LangChain throws the schema's own error, from the Zod copy
// that built it.
const isZodError = (error: unknown): error is z.core.$ZodError =>
  error instanceof Error && 'issues' in error && Array.isArray(error.issues);

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
  {
    agent,
    prefix,
    signal,
    recursionLimit,
    validatesContext,
    hasContext,
    started,
  }: FailedRun,
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

  // LangChain checks the context before the graph starts; a Zod error from
  // the model, a tool or the output comes after. See #336, #369.
  if (validatesContext && !started && isZodError(cause)) {
    const message = hasContext
      ? contextInvalid(prefix, oneLine(z.prettifyError(cause)))
      : contextRequired(prefix);

    return new AgentContextError(message, agent, { cause });
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
