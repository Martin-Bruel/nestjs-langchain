import type { AgentRunError } from '../errors/agent-run.error.js';
import type { RunSummary } from '../run/index.js';

interface ToolEvent {
  /** `'default'` when the agent was registered without a name. */
  agent: string;
  /** The tool's name, as the model called it. */
  tool: string;
  /**
   * The id the model gave this call. Pairs a start with its end or error. A
   * call that never reached the tool has an error and no start.
   */
  callId: string;
}

/** A tool call about to run, its arguments validated. */
export interface ToolStartEvent extends ToolEvent {
  /** The arguments, parsed and validated against the tool's schema. */
  args: Record<string, unknown>;
}

/** A tool call that returned. */
export interface ToolEndEvent extends ToolEvent {
  /** What the method returned, before it is serialised for the model. */
  output: unknown;
  /** How long the method took. */
  durationMs: number;
}

/** A tool call that failed, or never reached its tool. */
export interface ToolErrorEvent extends ToolEvent {
  /**
   * Why the call failed: the agent has no such tool, the schema rejected the
   * arguments, or the tool threw. Only `'threw'` follows an `onToolStart`.
   * May gain values in a minor release: keep a `default` branch when
   * switching on it.
   */
  reason: 'unknown-tool' | 'invalid-arguments' | 'threw';
  /** What the tool threw, or why the call never reached it. */
  error: unknown;
  /** `0` when the tool never ran. */
  durationMs: number;
}

/** A model call that failed. The run may still retry or fail. */
export interface ModelErrorEvent {
  /** `'default'` when the agent was registered without a name. */
  agent: string;
  /** What the provider threw. */
  error: unknown;
}

/** A run that returned, with what it cost. */
export interface RunFinishEvent extends RunSummary {
  /** `'default'` when the agent was registered without a name. */
  agent: string;
  /** How long the run took. */
  durationMs: number;
}

/** A run that threw. */
export interface RunErrorEvent {
  /** `'default'` when the agent was registered without a name. */
  agent: string;
  /** How long the run took before it failed. */
  durationMs: number;
  /** The same error the caller of `run()` receives. */
  error: AgentRunError;
}

/**
 * Called as a run goes. Every method is optional and may be async. It is
 * never awaited, and a throw or a rejection is logged and swallowed, never
 * propagated into the run.
 */
export interface AgentObserver {
  /**
   * Before a tool runs, once its arguments are validated.
   *
   * @param event The call and its arguments.
   */
  onToolStart?(event: ToolStartEvent): void | Promise<void>;
  /**
   * After a tool returns.
   *
   * @param event The call, its output and its duration.
   */
  onToolEnd?(event: ToolEndEvent): void | Promise<void>;
  /**
   * After a tool call fails: the tool threw, or the call never reached it.
   *
   * @param event The call, why it failed and the error.
   */
  onToolError?(event: ToolErrorEvent): void | Promise<void>;
  /**
   * After a model call fails.
   *
   * @param event The error the provider threw.
   */
  onModelError?(event: ModelErrorEvent): void | Promise<void>;
  /**
   * Only for a run that returns.
   *
   * @param event The run's duration, tools and tokens.
   */
  onRunFinish?(event: RunFinishEvent): void | Promise<void>;
  /**
   * For every run that throws, whatever the cause.
   *
   * @param event The run's duration and the error its caller receives.
   */
  onRunError?(event: RunErrorEvent): void | Promise<void>;
}
