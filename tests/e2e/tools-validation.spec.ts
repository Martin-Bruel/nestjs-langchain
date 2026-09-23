import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, Tool } from '../../lib/index.js';
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
});
