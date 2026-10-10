import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import {
  LangChainModule,
  Tool,
  ToolConfigurationError,
  ToolParam,
} from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';

@Injectable()
class SearchService {
  @Tool({ description: 'Searches.' })
  search(): string {
    return 'found';
  }
}

@Module({ providers: [SearchService] })
class SearchModule {}

@Injectable()
class OtherSearchService {
  @Tool({ description: 'Searches elsewhere.' })
  search(): string {
    return 'found too';
  }
}

@Module({ providers: [OtherSearchService] })
class OtherSearchModule {}

@Injectable()
class LooseService {}

@Module({ imports: [MathModule], exports: [MathModule] })
class MathToolsModule {}

@Module({})
class EmptyModule {}

@Injectable()
class BadNameService {
  @Tool({ name: 'not a name', description: 'Has a name providers reject.' })
  search(): string {
    return 'found';
  }
}

@Module({ providers: [BadNameService] })
class BadNameModule {}

@Injectable()
class InvoiceService {
  @Tool({ name: 'extract-total', description: 'Reads the total.' })
  total(): number {
    return 42;
  }
}

@Module({ providers: [InvoiceService] })
class InvoiceModule {}

@Injectable()
class ExtractService {
  @Tool({ description: 'Reads the total.' })
  extractTotal(): number {
    return 42;
  }
}

@Module({ providers: [ExtractService] })
class ExtractModule {}

@Injectable()
class ForgetfulService {
  forgot(@ToolParam({ name: 'query' }) query: string): string {
    return query;
  }
}

@Module({ providers: [ForgetfulService] })
class ForgetfulModule {}

const boot = (
  tools: Parameters<typeof LangChainModule.register>[0]['tools'],
  imports: Parameters<typeof Test.createTestingModule>[0]['imports'] = [],
) =>
  Test.createTestingModule({
    imports: [
      ...imports,
      LangChainModule.register({
        model: new FakeListChatModel({ responses: ['42'] }),
        tools,
      }),
    ],
  })
    .compile()
    .then((app) => app.init());

// The whole point of #59: these used to boot cleanly and answer as though the
// tools had never been declared.
describe('tools validation at bootstrap', () => {
  it('boots a valid configuration', async () => {
    const app = await boot([MathModule], [MathModule]);

    await app.close();
  });

  it('refuses to boot on an entry that is not a module', async () => {
    await expect(boot([LooseService])).rejects.toThrow(
      /LooseService is listed in `tools` but is not a module in the Nest context/,
    );
  });

  it('refuses to boot on a module absent from the context', async () => {
    await expect(boot([MathModule])).rejects.toThrow(
      /MathModule is listed in `tools` but is not imported into the Nest context/,
    );
  });

  it('refuses to boot on two tools sharing a name', async () => {
    await expect(
      boot(
        [SearchModule, OtherSearchModule],
        [SearchModule, OtherSearchModule],
      ),
    ).rejects.toThrow(/Two tools are named "search"/);
  });

  // #191: imported, listed, and contributing nothing.
  it.each([
    ['only imports the module that declares the tools', MathToolsModule],
    ['declares nothing', EmptyModule],
  ])('refuses to boot on a module that %s', async (_label, module) => {
    await expect(boot([module], [module])).rejects.toThrow(
      `${module.name} is listed in \`tools\` but declares no @Tool method. ` +
        'Tools are read from the providers a module declares, not from the ' +
        'modules it imports.',
    );
  });

  // #213: it booted, and the agent never ran it.
  it('refuses to boot on a tool named with the prefix LangChain reserves', async () => {
    await expect(boot([InvoiceModule], [InvoiceModule])).rejects.toThrow(
      'InvoiceService.total: "extract-total" starts with "extract-"',
    );
  });

  it('boots a method whose name only starts with "extract"', async () => {
    const app = await boot([ExtractModule], [ExtractModule]);

    await app.close();
  });

  // #236: with several agents, the error did not say which one failed.
  it('throws a ToolConfigurationError naming the agent and its problems', async () => {
    const failure = Test.createTestingModule({
      imports: [
        EmptyModule,
        LangChainModule.register({
          name: 'MATH',
          model: new FakeListChatModel({ responses: ['42'] }),
          tools: [EmptyModule],
        }),
      ],
    })
      .compile()
      .then((app) => app.init());

    await expect(failure).rejects.toBeInstanceOf(ToolConfigurationError);
    await expect(failure).rejects.toMatchObject({
      agent: 'MATH',
      problems: [expect.stringMatching(/^EmptyModule is listed in `tools`/)],
      message: expect.stringMatching(
        /^nestjs-langchain found 1 problem with the tools of the MATH agent:\n/,
      ),
    });
  });

  it.each([
    ['an invalid name', BadNameModule],
    ['a @ToolParam without @Tool', ForgetfulModule],
  ])(
    'reports a module whose tools are rejected for %s only once',
    async (_label, module) => {
      await expect(boot([module], [module])).rejects.toThrow(
        /found 1 problem with/,
      );
    },
  );
});
