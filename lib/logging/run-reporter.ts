import { LoggerService } from '@nestjs/common';
import { AgentObserver } from '../interfaces/agent-observer.interface.js';

export const LOG_CONTEXT = 'LangChainAgent';

export interface RunReporterInput {
  logger: LoggerService;
  agent: string;
  /** Empty for the unnamed agent, `'MATH '` otherwise. */
  prefix: string;
  observer?: AgentObserver;
}

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** One agent's error log lines and its observer. */
export class RunReporter {
  constructor(private readonly input: RunReporterInput) {}

  get agent(): string {
    return this.input.agent;
  }

  logError(message: string): void {
    this.input.logger.error(`${this.input.prefix}${message}`, LOG_CONTEXT);
  }

  /**
   * Hands an event to the observer, if any. Never awaited: a throw or a
   * rejection is logged and swallowed, never propagated into the run.
   */
  notify(call: (observer: AgentObserver) => void | Promise<void>): void {
    const { observer } = this.input;

    if (!observer) {
      return;
    }

    const onFailure = (error: unknown) =>
      this.logError(`the observer failed: ${messageOf(error)}`);

    try {
      void Promise.resolve(call(observer)).catch(onFailure);
    } catch (error) {
      onFailure(error);
    }
  }
}
