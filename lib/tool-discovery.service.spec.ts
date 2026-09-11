import { Injectable, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ZodObject } from 'zod';
import { Tool, ToolParam } from './decorators/tool.decorator';
import { ToolDiscoveryService } from './tool-discovery.service';

@Injectable()
class MathService {
  @Tool({ description: 'Adds two numbers together.' })
  add(
    @ToolParam({ name: 'a', description: 'First number.', type: 'number' })
    a: number,
    @ToolParam({ name: 'b', description: 'Second number.', type: 'number' })
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule, MathModule, MongoModule, Alpha, Beta],
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

  describe('schema generation', () => {
    it('builds a zod schema from the @ToolParam metadata', () => {
      const [tool] = discovery.getToolsFromModules([MathModule]);

      expect((tool.schema as ZodObject).safeParse({ a: 1, b: 2 }).success).toBe(
        true,
      );
    });

    it('calls through to the Nest instance', async () => {
      const [tool] = discovery.getToolsFromModules([MathModule]);

      await expect(tool.invoke({ a: 1, b: 2 })).resolves.toBe(3);
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
