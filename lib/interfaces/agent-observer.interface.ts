import type { RunSummary } from '../logging/run-summary.util.js';

interface ToolEvent {
  /** `'default'` when the agent was registered without a name. */
  agent: string;
  tool: string;
}

export interface ToolStartEvent extends ToolEvent {
  /** The arguments the model produced, as LangChain serialises them. */
  input: string;
}

export interface ToolEndEvent extends ToolEvent {
  output: unknown;
}

export interface ToolErrorEvent extends ToolEvent {
  error: unknown;
}

export interface ModelErrorEvent {
  agent: string;
  error: unknown;
}

export interface RunFinishEvent extends RunSummary {
  agent: string;
  durationMs: number;
}

/**
 * Called as a run goes. Every method is optional and may be async. A throw or
 * a rejection is logged and swallowed, never propagated into the run.
 */
export interface AgentObserver {
  onToolStart?(event: ToolStartEvent): void | Promise<void>;
  onToolEnd?(event: ToolEndEvent): void | Promise<void>;
  onToolError?(event: ToolErrorEvent): void | Promise<void>;
  onModelError?(event: ModelErrorEvent): void | Promise<void>;
  onRunFinish?(event: RunFinishEvent): void | Promise<void>;
}
