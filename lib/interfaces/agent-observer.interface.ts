import type { AgentRunError } from '../errors/agent-run.error.js';
import type { RunSummary } from '../run/index.js';

interface ToolEvent {
  /** `'default'` when the agent was registered without a name. */
  agent: string;
  tool: string;
  /**
   * The id the model gave this call. Pairs a start with its end or error. A
   * call that never reached the tool has an error and no start.
   */
  callId: string;
}

export interface ToolStartEvent extends ToolEvent {
  /** The arguments, parsed and validated against the tool's schema. */
  args: Record<string, unknown>;
}

export interface ToolEndEvent extends ToolEvent {
  /** What the method returned, before it is serialised for the model. */
  output: unknown;
  durationMs: number;
}

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

export interface ModelErrorEvent {
  agent: string;
  error: unknown;
}

export interface RunFinishEvent extends RunSummary {
  agent: string;
  durationMs: number;
}

export interface RunErrorEvent {
  agent: string;
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
  onToolStart?(event: ToolStartEvent): void | Promise<void>;
  onToolEnd?(event: ToolEndEvent): void | Promise<void>;
  onToolError?(event: ToolErrorEvent): void | Promise<void>;
  onModelError?(event: ModelErrorEvent): void | Promise<void>;
  /** Only for a run that returns. */
  onRunFinish?(event: RunFinishEvent): void | Promise<void>;
  /** For every run that throws, whatever the cause. */
  onRunError?(event: RunErrorEvent): void | Promise<void>;
}
