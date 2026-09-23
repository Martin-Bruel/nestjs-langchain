import {
  DynamicModule,
  forwardRef,
  Injectable,
  Module,
  Type,
} from '@nestjs/common';
import { ToolModule } from '../interfaces/langchain-module-options.interface.js';
import { resolveToolModules } from './tool-modules.util.js';

@Module({ providers: [] })
class ImportedModule {
  static forRoot(): DynamicModule {
    return { module: ImportedModule, providers: [] };
  }

  static forRootAsync(): Promise<DynamicModule> {
    return Promise.resolve({ module: ImportedModule, providers: [] });
  }
}

@Module({ providers: [] })
class DeclaredButNotImported {}

@Module({})
class EmptyModule {}

// The standard dynamic-module shape: everything lives in `forRoot`, so the
// class itself carries no metadata.
@Module({})
class EmptyHost {
  static forRoot(): DynamicModule {
    return { module: EmptyHost, providers: [] };
  }
}

@Injectable()
class NotAModule {}

describe('resolveToolModules', () => {
  const inContext = new Set<Type>([ImportedModule, EmptyModule]);
  const resolve = (entries: ToolModule[]) =>
    resolveToolModules(entries, inContext);

  describe('entries it accepts', () => {
    it('keeps a module class Nest instantiated', async () => {
      const { modules, problems } = await resolve([ImportedModule]);

      expect([...modules]).toEqual([ImportedModule]);
      expect(problems).toEqual([]);
    });

    it('keeps a module carrying no metadata when it is in the context', async () => {
      // `@Module({})` writes nothing, so only the container can vouch for it.
      const { modules, problems } = await resolve([EmptyModule]);

      expect([...modules]).toEqual([EmptyModule]);
      expect(problems).toEqual([]);
    });

    it('resolves a dynamic module to its class', async () => {
      const { modules, problems } = await resolve([ImportedModule.forRoot()]);

      expect([...modules]).toEqual([ImportedModule]);
      expect(problems).toEqual([]);
    });

    it('awaits a promise of a dynamic module', async () => {
      const { modules, problems } = await resolve([
        ImportedModule.forRootAsync(),
      ]);

      expect([...modules]).toEqual([ImportedModule]);
      expect(problems).toEqual([]);
    });

    it('calls a forward reference', async () => {
      const { modules, problems } = await resolve([
        forwardRef(() => ImportedModule),
      ]);

      expect([...modules]).toEqual([ImportedModule]);
      expect(problems).toEqual([]);
    });

    it('unwraps a forward reference around a dynamic module', async () => {
      const { modules } = await resolve([
        forwardRef(() => ImportedModule.forRoot()),
      ]);

      expect([...modules]).toEqual([ImportedModule]);
    });

    it('collapses two registrations of the same module', async () => {
      // `forRoot()` called twice gives two objects and one class.
      const { modules } = await resolve([
        ImportedModule.forRoot(),
        ImportedModule.forRoot(),
      ]);

      expect([...modules]).toEqual([ImportedModule]);
    });
  });

  describe('entries it reports', () => {
    it('reports a module that was never imported', async () => {
      const { modules, problems } = await resolve([DeclaredButNotImported]);

      expect([...modules]).toEqual([]);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(
        /DeclaredButNotImported is listed in `tools` but is not imported into the Nest context/,
      );
    });

    it('reports a dynamic module whose class was never imported', async () => {
      const { problems } = await resolve([
        { module: DeclaredButNotImported, providers: [] },
      ]);

      expect(problems[0]).toMatch(/DeclaredButNotImported is listed in/);
    });

    it('reports an unimported `@Module({})` host as unimported, not as a non-module', async () => {
      // Its metadata is empty, so only the `{ module }` shape identifies it.
      const { problems } = await resolve([EmptyHost.forRoot()]);

      expect(problems[0]).toMatch(
        /EmptyHost is listed in `tools` but is not imported into the Nest context/,
      );
    });

    it('reports an entry that is not a module', async () => {
      const { problems } = await resolve([NotAModule]);

      expect(problems[0]).toMatch(
        /NotAModule is listed in `tools` but is not a module in the Nest context/,
      );
      expect(problems[0]).toMatch(/decorated with @Module/);
    });

    it('reports an entry a circular import left undefined', async () => {
      const { problems } = await resolve([undefined as unknown as ToolModule]);

      expect(problems[0]).toMatch(/undefined is listed in `tools`/);
    });

    it('reports every bad entry and keeps the good ones', async () => {
      const { modules, problems } = await resolve([
        ImportedModule,
        NotAModule,
        DeclaredButNotImported,
      ]);

      expect([...modules]).toEqual([ImportedModule]);
      expect(problems).toHaveLength(2);
    });
  });

  it('accepts an empty list', async () => {
    await expect(resolve([])).resolves.toEqual({
      modules: new Set(),
      problems: [],
    });
  });
});
