import { Injectable, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import z, { ZodType } from 'zod';
import { Tool, ToolParam } from '../decorators/tool.decorator.js';
import { ToolDiscoveryService } from './tool-discovery.service.js';

// Schema shapes are covered in `tool-schema.factory.spec.ts` and naming in
// `tool-name.util.spec.ts`, without a container. What is left here needs one:
// walking the providers, matching modules, and calling through the instance.

@Injectable()
class MathService {
  @Tool({ description: 'Adds two numbers together.' })
  add(
    @ToolParam({ name: 'a' }) a: number,
    @ToolParam({ name: 'b' }) b: number,
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

@Injectable()
class SampleService {
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

  @Tool({ description: 'Falls back to a TypeScript default.' })
  page(
    @ToolParam({ name: 'query' }) query: string,
    @ToolParam({ name: 'size', optional: true }) size: number = 10,
  ): string {
    return `${query}:${size}`;
  }

  // `limit?: number` is not legal before a required parameter, and
  // `number | undefined` erases to Object, so the schema is explicit.
  @Tool({ description: 'Has an optional parameter before a required one.' })
  paginate(
    @ToolParam({ name: 'limit', schema: z.number(), optional: true })
    limit: number | undefined,
    @ToolParam({ name: 'query' }) query: string,
  ): string {
    return `${String(limit)}:${query}`;
  }

  @Tool({ description: 'Skips an undecorated parameter.' })
  offset(
    @ToolParam({ name: 'first' }) first: number,
    ignored: unknown,
    @ToolParam({ name: 'last' }) last: number,
  ): string {
    return `${first}|${String(ignored)}|${last}`;
  }
}

@Module({ providers: [SampleService] })
class SampleModule {}

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
class UninferableService {
  @Tool({ description: 'Takes an object without declaring a schema.' })
  broken(@ToolParam({ name: 'payload' }) payload: { field: string }): string {
    return payload.field;
  }
}

@Module({ providers: [UninferableService] })
class UninferableModule {}

@Injectable()
class CatalogService {
  @Tool({ description: 'Searches the catalogue.' })
  search(): string {
    return 'catalogue';
  }
}

@Module({ providers: [CatalogService] })
class CatalogModule {}

@Injectable()
class PeopleService {
  @Tool({ description: 'Searches people.' })
  search(): string {
    return 'people';
  }
}

@Module({ providers: [PeopleService] })
class PeopleModule {}

@Injectable()
class RenamedService {
  @Tool({ name: 'search_people', description: 'Searches people.' })
  search(): string {
    return 'people';
  }
}

@Module({ providers: [RenamedService] })
class RenamedModule {}

@Injectable()
class LooseService {}

@Module({ providers: [] })
class NeverImportedModule {}

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

  const sample = async (name: string) =>
    (await discovery.getToolsFromModules([SampleModule])).find(
      (t) => t.name === name,
    )!;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        MathModule,
        MongoModule,
        SampleModule,
        DollarModule,
        UninferableModule,
        CatalogModule,
        PeopleModule,
        RenamedModule,
        Alpha,
        Beta,
      ],
      providers: [ToolDiscoveryService],
    }).compile();

    discovery = moduleRef.get(ToolDiscoveryService);
  });

  describe('discovery', () => {
    it('returns only the tools of the listed module', async () => {
      const tools = await discovery.getToolsFromModules([MathModule]);

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('add');
      expect(tools[0].description).toBe('Adds two numbers together.');
    });

    it('collects tools across several modules', async () => {
      const tools = await discovery.getToolsFromModules([
        MathModule,
        MongoModule,
      ]);

      expect(tools.map((t) => t.name)).toEqual(['add', 'command']);
    });

    it('returns nothing when no module is listed', async () => {
      await expect(discovery.getToolsFromModules([])).resolves.toEqual([]);
    });
  });

  describe('naming', () => {
    it('exposes the declared name rather than the method name', async () => {
      const names = (await discovery.getToolsFromModules([SampleModule])).map(
        (t) => t.name,
      );

      expect(names).toContain('add_numbers');
      expect(names).not.toContain('addTwoNumbersTogether');
    });

    it('falls back to the method name', async () => {
      await expect(sample('subtract')).resolves.toBeDefined();
    });

    it('surfaces a rejected name at bootstrap', async () => {
      await expect(
        discovery.getToolsFromModules([DollarModule]),
      ).rejects.toThrow(/DollarService\.\$find.*Pass a `name` to @Tool\(\)/s);
    });
  });

  describe('schema assembly', () => {
    it('lists the parameters in declaration order', async () => {
      // Parameter decorators run right to left, so this is the sort.
      const page = await sample('page');
      const schema = z.toJSONSchema(page.schema as ZodType) as {
        properties: Record<string, unknown>;
      };

      expect(Object.keys(schema.properties)).toEqual(['query', 'size']);
    });

    it('surfaces an unresolvable parameter at bootstrap', async () => {
      await expect(
        discovery.getToolsFromModules([UninferableModule]),
      ).rejects.toThrow(/UninferableService\.broken.*"payload".*Object/s);
    });
  });

  describe('argument placement', () => {
    it('calls through to the Nest instance', async () => {
      const [tool] = await discovery.getToolsFromModules([MathModule]);

      await expect(tool.invoke({ a: 1, b: 2 })).resolves.toBe(3);
    });

    it('calls the method the declared name points at', async () => {
      await expect(
        (await sample('add_numbers')).invoke({ a: 1, b: 2 }),
      ).resolves.toBe(3);
    });

    it('does not shift the arguments that follow an omitted optional', async () => {
      await expect(
        (await sample('paginate')).invoke({ query: 'q' }),
      ).resolves.toBe('undefined:q');
    });

    it('fills the optional when it is provided', async () => {
      await expect(
        (await sample('paginate')).invoke({ limit: 10, query: 'q' }),
      ).resolves.toBe('10:q');
    });

    it('falls back to the TypeScript default when the model omits it', async () => {
      await expect((await sample('page')).invoke({ query: 'q' })).resolves.toBe(
        'q:10',
      );
    });

    // An undecorated parameter is not exposed to the model. The method stays
    // callable from elsewhere with its full signature.
    it('leaves an undecorated parameter undefined without shifting the rest', async () => {
      await expect(
        (await sample('offset')).invoke({ first: 1, last: 2 }),
      ).resolves.toBe('1|undefined|2');
    });
  });

  describe('duplicate names', () => {
    it('rejects two tools sharing a name, naming both and the fix', async () => {
      await expect(
        discovery.getToolsFromModules([CatalogModule, PeopleModule]),
      ).rejects.toThrow(
        /Two tools are named "search": CatalogService\.search and PeopleService\.search.*Give one of them a `name` in @Tool\(\)/s,
      );
    });

    it('accepts the same name in two different agents', async () => {
      // One call is one agent. The collision above only exists within a call.
      const catalog = await discovery.getToolsFromModules([CatalogModule]);
      const people = await discovery.getToolsFromModules([PeopleModule]);

      expect(catalog.map((t) => t.name)).toEqual(['search']);
      expect(people.map((t) => t.name)).toEqual(['search']);
    });

    it('accepts a collision resolved through the `name` option', async () => {
      const tools = await discovery.getToolsFromModules([
        CatalogModule,
        RenamedModule,
      ]);

      expect(tools.map((t) => t.name)).toEqual(['search', 'search_people']);
    });
  });

  describe('invalid entries', () => {
    it('rejects an entry that is not a module', async () => {
      await expect(
        discovery.getToolsFromModules([LooseService]),
      ).rejects.toThrow(
        /LooseService is listed in `tools` but is not a module in the Nest context/,
      );
    });

    it('rejects a module that was never imported', async () => {
      await expect(
        discovery.getToolsFromModules([NeverImportedModule]),
      ).rejects.toThrow(
        /NeverImportedModule is listed in `tools` but is not imported into the Nest context/,
      );
    });
  });

  describe('reporting', () => {
    it('reports every problem rather than the first', async () => {
      let message = '';

      try {
        await discovery.getToolsFromModules([LooseService, UninferableModule]);
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).toMatch(/found 2 problems with the tools/);
      expect(message).toMatch(/LooseService is listed in `tools`/);
      expect(message).toMatch(/UninferableService\.broken/);
    });

    it('reports a valid configuration as no problem at all', async () => {
      await expect(
        discovery.getToolsFromModules([MathModule]),
      ).resolves.toHaveLength(1);
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

    it('keeps homonymous modules isolated', async () => {
      const alpha = await discovery.getToolsFromModules([Alpha]);
      const beta = await discovery.getToolsFromModules([Beta]);

      expect(alpha.map((t) => t.name)).toEqual(['alpha']);
      expect(beta.map((t) => t.name)).toEqual(['beta']);
    });
  });
});
