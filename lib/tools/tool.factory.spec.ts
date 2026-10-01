import { ToolStartEvent } from '../interfaces/agent-observer.interface.js';
import { Recorder, reporter } from '../../tests/fixtures/logging.js';
import { buildTool } from './tool.factory.js';
import { ToolMethod } from './tool-method.util.js';

const method = (overrides: Partial<ToolMethod> = {}): ToolMethod => ({
  where: 'MathService.add',
  method: 'add',
  options: { description: 'Adds two numbers.' },
  params: [
    { name: 'a', index: 0 },
    { name: 'b', index: 1 },
  ],
  paramTypes: [Number, Number],
  call: ([a, b]) => (a as number) + (b as number),
  ...overrides,
});

describe('buildTool', () => {
  it('names the tool after the method when @Tool() gives no name', () => {
    expect(buildTool(method(), reporter(new Recorder())).name).toBe('add');
  });

  it('calls the method with the arguments by position', async () => {
    const tool = buildTool(method(), reporter(new Recorder()));

    await expect(tool.invoke({ b: 2, a: 1 })).resolves.toBe(3);
  });

  it('leaves a hole for an omitted optional rather than shifting', async () => {
    const seen: unknown[][] = [];
    const tool = buildTool(
      method({
        params: [
          { name: 'a', index: 0, optional: true },
          { name: 'b', index: 1 },
        ],
        call: (args) => {
          seen.push(args);
          return 'ok';
        },
      }),
      reporter(new Recorder()),
    );

    await tool.invoke({ b: 2 });

    expect(seen).toEqual([[undefined, 2]]);
  });

  it('reports the call under the id the model gave it', async () => {
    const starts: ToolStartEvent[] = [];
    const tool = buildTool(
      method(),
      reporter(new Recorder(), {
        onToolStart: (event) => void starts.push(event),
      }),
    );

    await tool.invoke({
      type: 'tool_call',
      id: 'call_A',
      name: 'add',
      args: { a: 1, b: 2 },
    });

    expect(starts).toEqual([
      { agent: 'default', tool: 'add', callId: 'call_A', args: { a: 1, b: 2 } },
    ]);
  });

  it('throws on a name providers reject', () => {
    expect(() =>
      buildTool(
        method({ options: { name: 'a b', description: 'x' } }),
        reporter(new Recorder()),
      ),
    ).toThrow('MathService.add: "a b" is not a valid tool name');
  });
});
