import { LoggerService } from '@nestjs/common';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { Serialized } from '@langchain/core/load/serializable';
import { AgentObserver } from '../interfaces/agent-observer.interface.js';
import { notify } from './notify.util.js';

export const LOG_CONTEXT = 'LangChainAgent';

export interface AgentLoggerInput {
  logger: LoggerService;
  agent: string;
  /** Empty for the unnamed agent, `'MATH '` otherwise. */
  prefix: string;
  observer?: AgentObserver;
}

const named = (serialized: Serialized | undefined, runName?: string): string =>
  runName ?? serialized?.id[serialized.id.length - 1] ?? 'unknown';

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class AgentLoggerHandler extends BaseCallbackHandler {
  name = 'nestjs-langchain';

  // The end and error hooks are not told which tool ran.
  private readonly running = new Map<string, string>();

  constructor(private readonly input: AgentLoggerInput) {
    super();
  }

  private report(error: unknown): void {
    this.input.logger.error(
      `${this.input.prefix}the observer failed: ${messageOf(error)}`,
      LOG_CONTEXT,
    );
  }

  private hand(call: (observer: AgentObserver) => void | Promise<void>): void {
    const { observer } = this.input;

    if (observer) {
      notify(
        () => call(observer),
        (error) => this.report(error),
      );
    }
  }

  handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
    runName?: string,
  ): void {
    const name = named(tool, runName);
    this.running.set(runId, name);

    this.hand((observer) =>
      observer.onToolStart?.({ agent: this.input.agent, tool: name, input }),
    );
  }

  handleToolEnd(output: unknown, runId: string): void {
    const tool = this.running.get(runId) ?? 'a tool';
    this.running.delete(runId);

    this.hand((observer) =>
      observer.onToolEnd?.({
        agent: this.input.agent,
        tool,
        // LangChain hands back a serialized message, not the tool's return.
        output:
          (output as { text?: unknown } | null | undefined)?.text ?? output,
      }),
    );
  }

  handleToolError(error: unknown, runId: string): void {
    const tool = this.running.get(runId) ?? 'a tool';
    this.running.delete(runId);

    this.input.logger.error(
      `${this.input.prefix}${tool} failed: ${messageOf(error)}`,
      LOG_CONTEXT,
    );

    this.hand((observer) =>
      observer.onToolError?.({ agent: this.input.agent, tool, error }),
    );
  }

  handleLLMError(error: unknown): void {
    this.input.logger.error(
      `${this.input.prefix}the model failed: ${messageOf(error)}`,
      LOG_CONTEXT,
    );

    this.hand((observer) =>
      observer.onModelError?.({ agent: this.input.agent, error }),
    );
  }
}
