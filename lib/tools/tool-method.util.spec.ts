import { Tool, ToolParam } from '../decorators/tool.decorator.js';
import { readToolMethod } from './tool-method.util.js';

class MathService {
  constructor(private readonly offset = 0) {}

  @Tool({ name: 'add_numbers', description: 'Adds two numbers.' })
  add(
    @ToolParam({ name: 'a' }) a: number,
    @ToolParam({ name: 'b' }) b: number,
  ): number {
    return a + b + this.offset;
  }

  notATool(): string {
    return 'ignored';
  }
}

describe('readToolMethod', () => {
  it('reads what the decorators recorded, parameters in declaration order', () => {
    const tool = readToolMethod(new MathService(), 'add');

    expect(tool).toMatchObject({
      where: 'MathService.add',
      method: 'add',
      options: { name: 'add_numbers', description: 'Adds two numbers.' },
      params: [
        { name: 'a', index: 0 },
        { name: 'b', index: 1 },
      ],
      paramTypes: [Number, Number],
    });
  });

  it('calls the method on its own instance', () => {
    expect(readToolMethod(new MathService(10), 'add')?.call([1, 2])).toBe(13);
  });

  it('skips a method without @Tool()', () => {
    expect(readToolMethod(new MathService(), 'notATool')).toBeUndefined();
  });
});
