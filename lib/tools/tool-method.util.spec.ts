import { SetMetadata } from '@nestjs/common';
import { ToolContext } from '../decorators/tool-context.decorator.js';
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

  forgotTool(@ToolParam({ name: 'a' }) a: number): number {
    return a;
  }

  // Another library marking its own "tools" with a generic key.
  @SetMetadata('TOOL_METADATA', { description: 'Not ours.' })
  foreignTool(): string {
    return 'foreign';
  }
}

class BaseMath {
  @Tool({ description: 'Adds.' })
  add(
    @ToolParam({ name: 'a' }) a: number,
    @ToolParam({ name: 'b' }) b: number,
  ): number {
    return a + b;
  }
}

class Inherits extends BaseMath {}

class Overrides extends BaseMath {
  override add(a: number, b: number): number {
    return super.add(a, b) * 10;
  }
}

class Redecorates extends BaseMath {
  @Tool({ description: 'Adds, then one more.' })
  override add(
    @ToolParam({ name: 'x' }) x: number,
    @ToolParam({ name: 'y' }) y: number,
  ): number {
    return x + y + 1;
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

  // #135: almost always a forgotten @Tool.
  it('rejects a @ToolParam on a method without @Tool()', () => {
    expect(() => readToolMethod(new MathService(), 'forgotTool')).toThrow(
      'MathService.forgotTool has @ToolParam but no @Tool, so the model ' +
        'never sees it. Add @Tool({ description }) to expose it, or remove ' +
        'the @ToolParam.',
    );
  });

  // #132: the keys are namespaced, so another library's marks are not ours.
  it('skips a method another library marked with a generic key', () => {
    expect(readToolMethod(new MathService(), 'foreignTool')).toBeUndefined();
  });

  it('skips a method without @Tool()', () => {
    expect(readToolMethod(new MathService(), 'notATool')).toBeUndefined();
  });

  // #189: a subclass overriding a tool method failed the bootstrap.
  describe('inheritance', () => {
    it("reads an inherited tool from its parent's declaration", () => {
      const tool = readToolMethod(new Inherits(), 'add');

      expect(tool).toMatchObject({
        where: 'Inherits.add',
        options: { description: 'Adds.' },
        params: [
          { name: 'a', index: 0 },
          { name: 'b', index: 1 },
        ],
        paramTypes: [Number, Number],
      });
      expect(tool?.call([1, 2])).toBe(3);
    });

    it('reads the tool a subclass declares again, with its own parameters only', () => {
      const tool = readToolMethod(new Redecorates(), 'add');

      expect(tool).toMatchObject({
        options: { description: 'Adds, then one more.' },
        paramTypes: [Number, Number],
      });
      expect(tool?.params).toEqual([
        { name: 'x', index: 0 },
        { name: 'y', index: 1 },
      ]);
      expect(tool?.call([1, 2])).toBe(4);
    });

    it('treats a method overridden without decorators as a plain method', () => {
      expect(readToolMethod(new Overrides(), 'add')).toBeUndefined();
    });
  });
});

// #148
describe('readToolMethod with @ToolContext', () => {
  class Orders {
    @Tool({ description: 'Lists the orders of the current user.' })
    list(
      @ToolParam({ name: 'status' }) status: string,
      @ToolContext() ctx: { userId: string },
    ): string {
      return `${ctx.userId} ${status}`;
    }

    forgotTool(@ToolContext() ctx: unknown): unknown {
      return ctx;
    }

    @Tool({ description: 'Both on one parameter.' })
    both(@ToolParam({ name: 'user' }) @ToolContext() user: string): string {
      return user;
    }
  }

  it('reads the context parameters apart from the arguments', () => {
    const read = readToolMethod(new Orders(), 'list');

    expect(read?.params.map(({ name }) => name)).toEqual(['status']);
    expect(read?.contextParams).toEqual([1]);
  });

  it('throws on a @ToolContext without @Tool', () => {
    expect(() => readToolMethod(new Orders(), 'forgotTool')).toThrow(
      'Orders.forgotTool has @ToolContext but no @Tool, so it is never ' +
        'called. Add @Tool({ description }) to expose it, or remove the ' +
        '@ToolContext.',
    );
  });

  it('throws on a parameter with both @ToolParam and @ToolContext', () => {
    expect(() => readToolMethod(new Orders(), 'both')).toThrow(
      'Orders.both: parameter 1 has both @ToolParam and @ToolContext. Keep ' +
        '@ToolParam for what the model writes, @ToolContext for what the ' +
        'caller passes.',
    );
  });
});
