import { Injectable, Module, Type } from '@nestjs/common';
import { resolveToolModules } from './tool-modules.util.js';

@Module({ providers: [] })
class ImportedModule {}

@Module({ providers: [] })
class DeclaredButNotImported {}

@Module({})
class EmptyModule {}

@Injectable()
class NotAModule {}

describe('resolveToolModules', () => {
  const inContext = new Set<Type>([ImportedModule, EmptyModule]);
  const resolve = (entries: Type[]) => resolveToolModules(entries, inContext);

  describe('entries it accepts', () => {
    it('keeps a module class Nest instantiated', () => {
      const { modules, problems } = resolve([ImportedModule]);

      expect([...modules]).toEqual([ImportedModule]);
      expect(problems).toEqual([]);
    });

    it('keeps a module carrying no metadata when it is in the context', () => {
      // `@Module({})` writes nothing, so only the container can vouch for it.
      const { modules, problems } = resolve([EmptyModule]);

      expect([...modules]).toEqual([EmptyModule]);
      expect(problems).toEqual([]);
    });
  });

  describe('entries it reports', () => {
    it('reports a module that was never imported', () => {
      const { modules, problems } = resolve([DeclaredButNotImported]);

      expect([...modules]).toEqual([]);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(
        /DeclaredButNotImported is listed in `tools` but is not imported into the Nest context/,
      );
    });

    it('reports an entry that is not a module', () => {
      const { problems } = resolve([NotAModule]);

      expect(problems[0]).toMatch(
        /NotAModule is listed in `tools` but is not a module in the Nest context/,
      );
      expect(problems[0]).toMatch(/decorated with @Module/);
    });

    it('reports an entry a circular import left undefined', () => {
      const { problems } = resolve([undefined as unknown as Type]);

      expect(problems[0]).toMatch(/undefined is listed in `tools`/);
    });

    it('reports every bad entry and keeps the good ones', () => {
      const { modules, problems } = resolve([
        ImportedModule,
        NotAModule,
        DeclaredButNotImported,
      ]);

      expect([...modules]).toEqual([ImportedModule]);
      expect(problems).toHaveLength(2);
    });
  });

  it('accepts an empty list', () => {
    expect(resolve([])).toEqual({ modules: new Set(), problems: [] });
  });
});
