import { Injectable, Module, Scope, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, Tool } from '../../lib/index.js';

@Injectable()
class Dep {
  readonly v = 'dep';
}

@Injectable({ scope: Scope.REQUEST })
class RequestDep {
  readonly v = 'request';
}

@Injectable({ scope: Scope.REQUEST })
class RequestScoped {
  constructor(private readonly dep: Dep) {}

  @Tool({ description: 'Hello.' })
  hello(): string {
    return this.dep.v;
  }
}

@Injectable({ scope: Scope.TRANSIENT })
class Transient {
  constructor(private readonly dep: Dep) {}

  @Tool({ description: 'Hello.' })
  hello(): string {
    return this.dep.v;
  }
}

@Injectable()
class DependsOnRequest {
  constructor(private readonly dep: RequestDep) {}

  @Tool({ description: 'Hello.' })
  hello(): string {
    return this.dep.v;
  }
}

@Injectable({ scope: Scope.REQUEST })
class RequestScopedWithoutTool {
  constructor(private readonly dep: Dep) {}

  hello(): string {
    return this.dep.v;
  }
}

@Injectable()
class Plain {
  @Tool({ description: 'Adds.' })
  add(): number {
    return 3;
  }
}

const toolModule = (...providers: Type[]) => {
  @Module({ providers: [Dep, RequestDep, ...providers] })
  class ToolsModule {}

  return ToolsModule;
};

const boot = async (tools: Type) => {
  const app = await Test.createTestingModule({
    imports: [
      tools,
      LangChainModule.register({
        model: new FakeListChatModel({ responses: ['42'] }),
        tools: [tools],
      }),
    ],
  }).compile();
  await app.init();
  return app;
};

// #127: an agent is a singleton, so a tool whose provider is built per
// request (or per consumer) was discovered on an unconstructed placeholder.
describe('tools on a provider that is not a singleton', () => {
  it.each([
    ['a request-scoped', RequestScoped, 'RequestScoped is request-scoped'],
    ['a transient', Transient, 'Transient is transient'],
    [
      'a request-scoped dependency of a',
      DependsOnRequest,
      'DependsOnRequest depends on a request-scoped provider',
    ],
  ])('fails the bootstrap for %s provider', async (_label, provider, scope) => {
    await expect(boot(toolModule(provider))).rejects.toThrow(
      `${scope}, so its @Tool methods (hello) cannot be called by an agent, ` +
        'which is a singleton. Make it a default-scoped provider.',
    );
  });

  it('ignores a request-scoped provider without @Tool', async () => {
    const app = await boot(toolModule(RequestScopedWithoutTool, Plain));

    await app.close();
  });
});
