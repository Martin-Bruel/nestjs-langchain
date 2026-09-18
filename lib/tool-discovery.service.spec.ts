import { Injectable, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import z, { ZodType } from 'zod';
import { Tool, ToolParam } from './decorators/tool.decorator.js';
import { ToolDiscoveryService } from './tool-discovery.service.js';

@Injectable()
class MathService {
  @Tool({ description: 'Adds two numbers together.' })
  add(
    @ToolParam({ name: 'a', description: 'First number.' })
    a: number,
    @ToolParam({ name: 'b', description: 'Second number.' })
    b: number,
  ): number {
    return a + b;
  }

  notATool(): string {
    return 'ignored';
  }
}

@Module({ providers: [MathService] })
class MathModule {}

@Injectable()
class MongoService {
  @Tool({ description: 'Call mongo command.' })
  command(): string {
    return 'ok';
  }
}

@Module({ providers: [MongoService] })
class MongoModule {}

const filter = z.object({ field: z.string(), value: z.string() });

@Injectable()
class SignatureService {
  @Tool({ description: 'Every inferable primitive.' })
  primitives(
    @ToolParam({ name: 'text', description: 'A string.' }) text: string,
    @ToolParam({ name: 'count', description: 'A number.' }) count: number,
    @ToolParam({ name: 'flag', description: 'A boolean.' }) flag: boolean,
  ): string {
    return `${text}${count}${flag}`;
  }

  @Tool({ description: 'Takes an object.' })
  search(
    @ToolParam({ name: 'filter', description: 'The filter.', schema: filter })
    value: z.infer<typeof filter>,
  ): string {
    return `${value.field}=${value.value}`;
  }

  @Tool({ description: 'Narrows a string.' })
  operate(
    @ToolParam({
      name: 'op',
      description: 'The operation.',
      schema: z.enum(['+', '-']),
    })
    op: '+' | '-',
  ): string {
    return op;
  }

  // `limit?: number` is not legal before a required parameter, and
  // `number | undefined` erases to Object, so the schema is explicit.
  @Tool({ description: 'Has an optional parameter before a required one.' })
  paginate(
    @ToolParam({
      name: 'limit',
      description: 'A limit.',
      schema: z.number(),
      optional: true,
    })
    limit: number | undefined,
    @ToolParam({ name: 'query', description: 'A query.' })
    query: string,
  ): string {
    return `${String(limit)}:${query}`;
  }

  @Tool({ description: 'Falls back to a TypeScript default.' })
  page(
    @ToolParam({ name: 'query', description: 'A query.' })
    query: string,
    @ToolParam({ name: 'size', description: 'A size.', optional: true })
    size: number = 10,
  ): string {
    return `${query}:${size}`;
  }

  @Tool({ description: 'Has a trailing optional parameter.' })
  trim(
    @ToolParam({ name: 'text', description: 'The text.' })
    text: string,
    @ToolParam({ name: 'max', description: 'A maximum.', optional: true })
    max?: number,
  ): string {
    return text.slice(0, max);
  }

  @Tool({ description: 'Skips an undecorated parameter.' })
  offset(
    @ToolParam({ name: 'first', description: 'First.' })
    first: number,
    ignored: unknown,
    @ToolParam({ name: 'last', description: 'Last.' })
    last: number,
  ): string {
    return `${first}|${String(ignored)}|${last}`;
  }
}

@Module({ providers: [SignatureService] })
class SignatureModule {}

@Injectable()
class NamedService {
  @Tool({ name: 'add_numbers', description: 'Adds two numbers together.' })
  addTwoNumbersTogether(
    @ToolParam({ name: 'a' }) a: number,
    @ToolParam({ name: 'b' }) b: number,
  ): number {
    return a + b;
  }

  @Tool({ description: 'Subtracts two numbers.' })
  subtract(
    @ToolParam({ name: 'a' }) a: number,
    @ToolParam({ name: 'b' }) b: number,
  ): number {
    return a - b;
  }

  @Tool({ name: 'a'.repeat(64), description: 'At the length limit.' })
  atTheLimit(): string {
    return 'ok';
  }
}

@Module({ providers: [NamedService] })
class NamedModule {}

@Injectable()
class SpacedNameService {
  @Tool({ name: 'add numbers', description: 'Declares a name with a space.' })
  add(): number {
    return 0;
  }
}

@Module({ providers: [SpacedNameService] })
class SpacedNameModule {}

@Injectable()
class LongNameService {
  @Tool({ name: 'a'.repeat(65), description: 'Declares a name too long.' })
  add(): number {
    return 0;
  }
}

@Module({ providers: [LongNameService] })
class LongNameModule {}

@Injectable()
class DollarService {
  @Tool({ description: 'Has a method name providers reject.' })
  $find(): string {
    return 'found';
  }
}

@Module({ providers: [DollarService] })
class DollarModule {}

@Injectable()
class MismatchService {
  @Tool({ description: 'Declares a schema that contradicts the signature.' })
  lie(
    @ToolParam({ name: 'n', description: 'A number.', schema: z.string() })
    n: number,
  ): string {
    return n.toFixed(2);
  }
}

@Module({ providers: [MismatchService] })
class MismatchModule {}

@Injectable()
class UndescribedService {
  @Tool({ description: 'Multiplies a width by a height.' })
  area(
    @ToolParam({ name: 'width' }) width: number,
    @ToolParam({ name: 'height', description: 'The height.' }) height: number,
  ): number {
    return width * height;
  }
}

@Module({ providers: [UndescribedService] })
class UndescribedModule {}

@Injectable()
class UninferableService {
  @Tool({ description: 'Takes an object without declaring a schema.' })
  broken(
    @ToolParam({ name: 'payload', description: 'A payload.' })
    payload: {
      field: string;
    },
  ): string {
    return payload.field;
  }
}

@Module({ providers: [UninferableService] })
class UninferableModule {}

@Injectable()
class WidenedService {
  @Tool({ description: 'Takes a union that erases to Object.' })
  widened(
    @ToolParam({ name: 'value', description: 'A value.' })
    value: number | undefined,
  ): string {
    return String(value);
  }
}

@Module({ providers: [WidenedService] })
class WidenedModule {}

// Both factories return a module class literally named `ToolsModule`, the way
// two features of one application each name theirs after their own folder.
function alphaModule() {
  @Injectable()
  class AlphaService {
    @Tool({ description: 'Alpha.' })
    alpha(): string {
      return 'alpha';
    }
  }

  @Module({ providers: [AlphaService] })
  class ToolsModule {}

  return ToolsModule;
}

function betaModule() {
  @Injectable()
  class BetaService {
    @Tool({ description: 'Beta.' })
    beta(): string {
      return 'beta';
    }
  }

  @Module({ providers: [BetaService] })
  class ToolsModule {}

  return ToolsModule;
}

describe('ToolDiscoveryService', () => {
  const Alpha = alphaModule();
  const Beta = betaModule();

  let discovery: ToolDiscoveryService;

  // What the model is handed, rather than the zod object that produced it.
  const jsonSchemaOf = (name: string) => {
    const tool = discovery
      .getToolsFromModules([SignatureModule])
      .find((t) => t.name === name);

    return z.toJSONSchema(tool!.schema as ZodType) as Record<string, any>;
  };

  const toolNamed = (name: string) =>
    discovery
      .getToolsFromModules([SignatureModule])
      .find((t) => t.name === name)!;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        MathModule,
        MongoModule,
        SignatureModule,
        NamedModule,
        SpacedNameModule,
        LongNameModule,
        DollarModule,
        MismatchModule,
        UndescribedModule,
        UninferableModule,
        WidenedModule,
        Alpha,
        Beta,
      ],
      providers: [ToolDiscoveryService],
    }).compile();

    discovery = moduleRef.get(ToolDiscoveryService);
  });

  describe('discovery', () => {
    it('returns only the tools of the listed module', () => {
      const tools = discovery.getToolsFromModules([MathModule]);

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('add');
      expect(tools[0].description).toBe('Adds two numbers together.');
    });

    it('collects tools across several modules', () => {
      const tools = discovery.getToolsFromModules([MathModule, MongoModule]);

      expect(tools.map((t) => t.name)).toEqual(['add', 'command']);
    });

    it('returns nothing when no module is listed', () => {
      expect(discovery.getToolsFromModules([])).toEqual([]);
    });
  });

  describe('tool names', () => {
    const names = () =>
      discovery.getToolsFromModules([NamedModule]).map((t) => t.name);

    it('uses the declared name rather than the method name', () => {
      expect(names()).toContain('add_numbers');
      expect(names()).not.toContain('addTwoNumbersTogether');
    });

    it('falls back to the method name', () => {
      expect(names()).toContain('subtract');
    });

    it('calls the method the declared name points at', async () => {
      const [tool] = discovery
        .getToolsFromModules([NamedModule])
        .filter((t) => t.name === 'add_numbers');

      await expect(tool.invoke({ a: 1, b: 2 })).resolves.toBe(3);
    });

    it('accepts a name at the length limit', () => {
      expect(names()).toContain('a'.repeat(64));
    });

    it('rejects a declared name providers would not accept', () => {
      expect(() => discovery.getToolsFromModules([SpacedNameModule])).toThrow(
        /SpacedNameService\.add: "add numbers" is not a valid tool name/,
      );
    });

    it('rejects a declared name past the length limit', () => {
      expect(() => discovery.getToolsFromModules([LongNameModule])).toThrow(
        /is not a valid tool name/,
      );
    });

    it('rejects a method name providers would not accept, pointing at the option', () => {
      expect(() => discovery.getToolsFromModules([DollarModule])).toThrow(
        /DollarService\.\$find: "\$find" is not a valid tool name.*Pass a `name` to @Tool\(\)/s,
      );
    });
  });

  describe('type inference', () => {
    it('maps string, number and boolean to their zod primitive', () => {
      expect(jsonSchemaOf('primitives').properties).toEqual({
        text: { type: 'string', description: 'A string.' },
        count: { type: 'number', description: 'A number.' },
        flag: { type: 'boolean', description: 'A boolean.' },
      });
    });

    it('marks every inferred parameter required', () => {
      expect(jsonSchemaOf('primitives').required).toEqual([
        'text',
        'count',
        'flag',
      ]);
    });

    it('infers a trailing optional primitive from its signature', () => {
      expect(jsonSchemaOf('trim').properties.max).toMatchObject({
        type: 'number',
        description: 'A maximum.',
      });
    });

    it('rejects a parameter it cannot infer, naming the location', () => {
      expect(() => discovery.getToolsFromModules([UninferableModule])).toThrow(
        /UninferableService\.broken.*"payload".*Object/s,
      );
    });

    it('rejects a union that erases to Object rather than guessing', () => {
      expect(() => discovery.getToolsFromModules([WidenedModule])).toThrow(
        /WidenedService\.widened.*"value".*Object/s,
      );
    });
  });

  describe('explicit schemas', () => {
    it('uses the declared schema for an object parameter', () => {
      expect(jsonSchemaOf('search').properties.filter).toMatchObject({
        type: 'object',
        description: 'The filter.',
        properties: {
          field: { type: 'string' },
          value: { type: 'string' },
        },
      });
    });

    it('narrows a string parameter to the declared enum', () => {
      expect(jsonSchemaOf('operate').properties.op).toMatchObject({
        enum: ['+', '-'],
        description: 'The operation.',
      });
    });

    it('rejects a schema that contradicts a primitive signature', () => {
      expect(() => discovery.getToolsFromModules([MismatchModule])).toThrow(
        /MismatchService\.lie.*"n" describes string.*declares number/s,
      );
    });

    it('passes an object argument through to the instance', async () => {
      await expect(
        toolNamed('search').invoke({ filter: { field: 'a', value: 'b' } }),
      ).resolves.toBe('a=b');
    });
  });

  describe('optional parameters', () => {
    it('keeps an optional parameter out of `required`', () => {
      const schema = jsonSchemaOf('paginate');

      expect(schema.required).toEqual(['query']);
      expect(Object.keys(schema.properties)).toEqual(['limit', 'query']);
    });

    it('keeps the description of an optional parameter', () => {
      expect(jsonSchemaOf('paginate').properties.limit).toMatchObject({
        description: 'A limit.',
      });
    });

    it('does not shift the arguments that follow an omitted optional', async () => {
      await expect(toolNamed('paginate').invoke({ query: 'q' })).resolves.toBe(
        'undefined:q',
      );
    });

    it('falls back to the TypeScript default when the model omits it', async () => {
      await expect(toolNamed('page').invoke({ query: 'q' })).resolves.toBe(
        'q:10',
      );
    });

    it('fills the optional when it is provided', async () => {
      await expect(
        toolNamed('paginate').invoke({ limit: 10, query: 'q' }),
      ).resolves.toBe('10:q');
    });
  });

  describe('argument placement', () => {
    // An undecorated parameter is not exposed to the model. The method stays
    // callable from elsewhere with its full signature.
    it('leaves an undecorated parameter undefined without shifting the rest', async () => {
      await expect(
        toolNamed('offset').invoke({ first: 1, last: 2 }),
      ).resolves.toBe('1|undefined|2');
    });

    it('calls through to the Nest instance', async () => {
      const [tool] = discovery.getToolsFromModules([MathModule]);

      await expect(tool.invoke({ a: 1, b: 2 })).resolves.toBe(3);
    });
  });

  describe('optional descriptions', () => {
    const schemaOf = () => {
      const [tool] = discovery.getToolsFromModules([UndescribedModule]);

      return z.toJSONSchema(tool.schema as ZodType) as Record<string, any>;
    };

    it('omits the description when none is given', () => {
      expect(schemaOf().properties.width).toEqual({ type: 'number' });
    });

    it('keeps the description of the parameters that carry one', () => {
      expect(schemaOf().properties.height).toEqual({
        type: 'number',
        description: 'The height.',
      });
    });

    it('calls through either way', async () => {
      const [tool] = discovery.getToolsFromModules([UndescribedModule]);

      await expect(tool.invoke({ width: 3, height: 4 })).resolves.toBe(12);
    });
  });

  describe('module identity', () => {
    it('gives the two fixture modules the same class name', () => {
      // Guards the premise: if this stopped holding, the test below would
      // pass for the wrong reason.
      expect(Alpha.name).toBe('ToolsModule');
      expect(Beta.name).toBe('ToolsModule');
      expect(Alpha).not.toBe(Beta);
    });

    it('keeps homonymous modules isolated', () => {
      expect(discovery.getToolsFromModules([Alpha]).map((t) => t.name)).toEqual(
        ['alpha'],
      );
      expect(discovery.getToolsFromModules([Beta]).map((t) => t.name)).toEqual([
        'beta',
      ]);
    });
  });
});
