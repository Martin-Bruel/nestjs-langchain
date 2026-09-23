import { LoggerService } from '@nestjs/common';
import { Serialized } from '@langchain/core/load/serializable';
import { AgentObserver } from '../interfaces/agent-observer.interface.js';
import { AgentLoggerHandler } from './agent-logger.handler.js';

class Recorder implements LoggerService {
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

  last(): string {
    return this.lines[this.lines.length - 1].message;
  }
}

const serialized = (name: string) =>
  ({ id: ['langchain', name] }) as unknown as Serialized;

const build = (logger: LoggerService, prefix = '', observer?: AgentObserver) =>
  new AgentLoggerHandler({ logger, agent: 'default', prefix, observer });

describe('AgentLoggerHandler', () => {
  describe('tool calls', () => {
    it('hands the tool and its arguments over, and logs nothing', () => {
      const logger = new Recorder();
      const seen: unknown[] = [];

      build(logger, '', {
        onToolStart: (event) => void seen.push(event),
      }).handleToolStart(serialized('add'), '{"a":1,"b":2}', 'run');

      expect(seen).toEqual([
        { agent: 'default', tool: 'add', input: '{"a":1,"b":2}' },
      ]);
      expect(logger.lines).toEqual([]);
    });

    it('hands the result over, unwrapped from its message', () => {
      const seen: unknown[] = [];
      const handler = build(new Recorder(), '', {
        onToolEnd: (event) => void seen.push(event),
      });

      handler.handleToolStart(serialized('add'), '{}', 'run');
      handler.handleToolEnd({ text: '3' }, 'run');

      expect(seen).toEqual([{ agent: 'default', tool: 'add', output: '3' }]);
    });

    it('hands a plain result over as it is', () => {
      const seen: unknown[] = [];
      const handler = build(new Recorder(), '', {
        onToolEnd: (event) => void seen.push(event.output),
      });

      handler.handleToolStart(serialized('add'), '{}', 'run');
      handler.handleToolEnd('3', 'run');

      expect(seen).toEqual(['3']);
    });

    it('prefers the run name over the serialized id', () => {
      const seen: string[] = [];

      build(new Recorder(), '', {
        onToolStart: ({ tool }) => void seen.push(tool),
      }).handleToolStart(
        serialized('DynamicStructuredTool'),
        '{}',
        'run',
        undefined,
        undefined,
        undefined,
        'add',
      );

      expect(seen).toEqual(['add']);
    });

    it('does nothing at all without an observer', () => {
      const logger = new Recorder();

      build(logger).handleToolStart(serialized('add'), '{"a":1}', 'run');

      expect(logger.lines).toEqual([]);
    });
  });

  describe('failures', () => {
    it('names the tool that threw, which the hook is not told', () => {
      const logger = new Recorder();
      const handler = build(logger);

      handler.handleToolStart(serialized('add'), '{}', 'run');
      handler.handleToolError(new Error('exploded'), 'run');

      expect(logger.last()).toBe('add failed: exploded');
    });

    it('keeps two tool calls in flight apart', () => {
      const logger = new Recorder();
      const handler = build(logger);

      handler.handleToolStart(serialized('add'), '{}', 'one');
      handler.handleToolStart(serialized('divide'), '{}', 'two');
      handler.handleToolError(new Error('by zero'), 'two');

      expect(logger.last()).toBe('divide failed: by zero');
    });

    it('stays sane when the start was never seen', () => {
      const logger = new Recorder();

      build(logger).handleToolError(new Error('exploded'), 'unknown');

      expect(logger.last()).toBe('a tool failed: exploded');
    });

    it('forgets a tool once it has finished', () => {
      const logger = new Recorder();
      const handler = build(logger);

      handler.handleToolStart(serialized('add'), '{}', 'run');
      handler.handleToolEnd('3', 'run');
      handler.handleToolError(new Error('late'), 'run');

      expect(logger.last()).toBe('a tool failed: late');
    });

    it('reports a model failure', () => {
      const logger = new Recorder();

      build(logger).handleLLMError(new Error('rate limited'));

      expect(logger.last()).toBe('the model failed: rate limited');
    });

    it('reports a thrown value that is not an Error', () => {
      const logger = new Recorder();

      build(logger).handleToolError('plain string', 'run');

      expect(logger.last()).toBe('a tool failed: plain string');
    });
  });

  describe('an observer that fails', () => {
    it('is reported and does not reach the caller', () => {
      const logger = new Recorder();

      expect(() =>
        build(logger, '', {
          onToolStart: () => {
            throw new Error('metrics down');
          },
        }).handleToolStart(serialized('add'), '{}', 'run'),
      ).not.toThrow();

      expect(logger.last()).toBe('the observer failed: metrics down');
    });

    it('is reported when it rejects rather than throws', async () => {
      const logger = new Recorder();

      build(logger, '', {
        onToolStart: () => Promise.reject(new Error('db down')),
      }).handleToolStart(serialized('add'), '{}', 'run');

      await Promise.resolve();
      await Promise.resolve();

      expect(logger.last()).toBe('the observer failed: db down');
    });
  });

  it('names the agent on every event it hands over', () => {
    const agents: string[] = [];
    const handler = build(new Recorder(), 'MATH ', {
      onToolStart: ({ agent }) => void agents.push(agent),
      onToolError: ({ agent }) => void agents.push(agent),
      onModelError: ({ agent }) => void agents.push(agent),
    });

    handler.handleToolStart(serialized('add'), '{}', 'run');
    handler.handleToolError(new Error('boom'), 'run');
    handler.handleLLMError(new Error('boom'));

    expect(agents).toEqual(['default', 'default', 'default']);
  });
});
