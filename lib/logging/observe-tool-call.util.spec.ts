import {
  AgentObserver,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from '../interfaces/agent-observer.interface.js';
import { observeToolCall } from './observe-tool-call.util.js';
import { Recorder, reporter } from '../../tests/fixtures/logging.js';

const call = { tool: 'add', callId: 'call_A', args: { a: 1, b: 2 } };

describe('observeToolCall', () => {
  let events: (ToolStartEvent | ToolEndEvent | ToolErrorEvent)[];
  let observer: AgentObserver;

  beforeEach(() => {
    events = [];
    observer = {
      onToolStart: (event) => void events.push(event),
      onToolEnd: (event) => void events.push(event),
      onToolError: (event) => void events.push(event),
    };
  });

  it('hands over the arguments, then what the method returned', async () => {
    await expect(
      observeToolCall(reporter(new Recorder(), observer), call, () => 3),
    ).resolves.toBe(3);

    expect(events).toEqual([
      { agent: 'default', tool: 'add', callId: 'call_A', args: { a: 1, b: 2 } },
      {
        agent: 'default',
        tool: 'add',
        callId: 'call_A',
        output: 3,
        durationMs: expect.any(Number),
      },
    ]);
  });

  it('hands over the resolved value of an async method', async () => {
    await observeToolCall(reporter(new Recorder(), observer), call, () =>
      Promise.resolve({ sum: 3 }),
    );

    expect(events[1]).toMatchObject({ output: { sum: 3 } });
  });

  it('logs and hands over a failure, then rethrows it', async () => {
    const logger = new Recorder();
    const error = new Error('exploded');

    await expect(
      observeToolCall(reporter(logger, observer), call, () => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(logger.last()).toBe('add failed: exploded');
    expect(events[1]).toEqual({
      agent: 'default',
      tool: 'add',
      callId: 'call_A',
      reason: 'threw',
      error,
      durationMs: expect.any(Number),
    });
  });

  it('logs a failure even without an observer', async () => {
    const logger = new Recorder();

    await expect(
      observeToolCall(reporter(logger), call, () =>
        Promise.reject(new Error('later')),
      ),
    ).rejects.toThrow('later');

    expect(logger.last()).toBe('add failed: later');
  });

  it('returns the result when the observer throws', async () => {
    const logger = new Recorder();

    await expect(
      observeToolCall(
        reporter(logger, {
          onToolEnd: () => {
            throw new Error('metrics down');
          },
        }),
        call,
        () => 3,
      ),
    ).resolves.toBe(3);

    expect(logger.last()).toBe('the observer failed: metrics down');
  });
});
