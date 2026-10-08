import { ToolErrorEvent } from '../interfaces/agent-observer.interface.js';
import { messageOf, RunReporter } from './run-reporter.js';

export interface ToolCall {
  tool: string;
  callId: string;
  args: Record<string, unknown>;
}

/** Logs a failed tool call and hands it to the observer. */
export const reportToolError = (
  reporter: RunReporter,
  event: Omit<ToolErrorEvent, 'agent'>,
): void => {
  reporter.logError(`${event.tool} failed: ${messageOf(event.error)}`);
  reporter.notify((observer) =>
    observer.onToolError?.({ agent: reporter.agent, ...event }),
  );
};

/** Runs one tool call, reporting its start, then its end or its failure. */
export const observeToolCall = async (
  reporter: RunReporter,
  { tool, callId, args }: ToolCall,
  call: () => unknown,
): Promise<unknown> => {
  const { agent } = reporter;
  const startedAt = Date.now();

  reporter.notify((observer) =>
    observer.onToolStart?.({ agent, tool, callId, args }),
  );

  try {
    const output = await call();

    reporter.notify((observer) =>
      observer.onToolEnd?.({
        agent,
        tool,
        callId,
        output,
        durationMs: Date.now() - startedAt,
      }),
    );

    return output;
  } catch (error) {
    reportToolError(reporter, {
      tool,
      callId,
      reason: 'threw',
      error,
      durationMs: Date.now() - startedAt,
    });

    throw error;
  }
};
