import { LoggerService } from '@nestjs/common';
import { AgentObserver } from '../../lib/index.js';
import { RunReporter } from '../../lib/logging/index.js';

// A logger and a reporter for the unit tests of `lib/logging`.
export class Recorder implements LoggerService {
  readonly lines: { level: string; message: string }[] = [];

  private record(level: string, message: unknown) {
    this.lines.push({ level, message: String(message) });
  }

  log(message: unknown) {
    this.record('log', message);
  }
  error(message: unknown) {
    this.record('error', message);
  }
  warn(message: unknown) {
    this.record('warn', message);
  }
  debug(message: unknown) {
    this.record('debug', message);
  }

  last(): string | undefined {
    return this.lines[this.lines.length - 1]?.message;
  }
}

export const reporter = (
  logger: LoggerService,
  observer?: AgentObserver,
  prefix = '',
) => new RunReporter({ logger, agent: 'default', prefix, observer });

// Lets a rejected observer promise settle.
export const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
