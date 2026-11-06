import { Injectable, Module } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import {
  Agent,
  getAgentToken,
  InjectAgent,
  LangChainModule,
} from '../../lib/index.js';
import { MODULE_OPTIONS_TOKEN } from '../../lib/langchain.module-definition.js';

const model = (answer: string) =>
  new FakeListChatModel({ responses: [answer] });

// A feature module that never imports `LangChainModule`: whatever it injects
// has to come from the global scope.
@Injectable()
class SupportService {
  constructor(@InjectAgent('SUPPORT_AGENT') readonly agent: Agent) {}
}

@Module({ providers: [SupportService], exports: [SupportService] })
class SupportModule {}

@Injectable()
class MathService {
  constructor(@InjectAgent('MATH_AGENT') readonly agent: Agent) {}
}

@Module({ providers: [MathService] })
class MathFeatureModule {}

@Injectable()
class MongoService {
  constructor(@InjectAgent('MONGO_AGENT') readonly agent: Agent) {}
}

@Module({ providers: [MongoService] })
class MongoFeatureModule {}

@Injectable()
class DefaultService {
  constructor(readonly agent: Agent) {}
}

@Module({ providers: [DefaultService] })
class DefaultFeatureModule {}

const agentProviders = (app: TestingModule, token: unknown) =>
  app
    .get(DiscoveryService, { strict: false })
    .getProviders()
    .filter((provider) => provider.token === token);

describe('global agents', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('register', () => {
    it('injects a named agent into a module that does not import LangChainModule', async () => {
      app = await Test.createTestingModule({
        imports: [
          SupportModule,
          LangChainModule.register({
            name: 'SUPPORT_AGENT',
            isGlobal: true,
            model: model('hello'),
          }),
        ],
      }).compile();
      await app.init();

      const { agent } = app.get(SupportService);

      expect(agent).toBeInstanceOf(Agent);
      await expect(agent.run('?')).resolves.toMatchObject({ output: 'hello' });
    });

    it('hands the feature module the registered instance, not a copy', async () => {
      app = await Test.createTestingModule({
        imports: [
          SupportModule,
          LangChainModule.register({
            name: 'SUPPORT_AGENT',
            isGlobal: true,
            model: model('hello'),
          }),
        ],
      }).compile();
      await app.init();

      const token = getAgentToken('SUPPORT_AGENT');

      expect(app.get(SupportService).agent).toBe(
        app.get<Agent>(token, { strict: false }),
      );
      expect(agentProviders(app, token)).toHaveLength(1);
    });

    // The unnamed agent is the `Agent` class token, not a named token.
    it('injects the unnamed agent as `Agent` into a module that does not import LangChainModule', async () => {
      app = await Test.createTestingModule({
        imports: [
          DefaultFeatureModule,
          LangChainModule.register({
            isGlobal: true,
            model: model('default'),
          }),
        ],
      }).compile();
      await app.init();

      const { agent } = app.get(DefaultService);

      expect(agent).toBe(app.get(Agent, { strict: false }));
      await expect(agent.run('?')).resolves.toMatchObject({
        output: 'default',
      });
    });

    it('keeps two global named agents apart', async () => {
      app = await Test.createTestingModule({
        imports: [
          MathFeatureModule,
          MongoFeatureModule,
          LangChainModule.register({
            name: 'MATH_AGENT',
            isGlobal: true,
            model: model('math'),
          }),
          LangChainModule.register({
            name: 'MONGO_AGENT',
            isGlobal: true,
            model: model('mongo'),
          }),
        ],
      }).compile();
      await app.init();

      const { agent: math } = app.get(MathService);
      const { agent: mongo } = app.get(MongoService);

      expect(getAgentToken('MATH_AGENT')).not.toBe(
        getAgentToken('MONGO_AGENT'),
      );
      expect(math).not.toBe(mongo);
      await expect(math.run('?')).resolves.toMatchObject({ output: 'math' });
      await expect(mongo.run('?')).resolves.toMatchObject({ output: 'mongo' });
    });

    it('keeps `isGlobal` out of the options the agent receives', async () => {
      app = await Test.createTestingModule({
        imports: [
          LangChainModule.register({
            name: 'SUPPORT_AGENT',
            isGlobal: true,
            model: model('hello'),
          }),
        ],
      }).compile();

      expect(
        app.get(MODULE_OPTIONS_TOKEN, { strict: false }),
      ).not.toHaveProperty('isGlobal');
    });
  });

  describe('registerAsync', () => {
    it('injects a named agent into a module that does not import LangChainModule', async () => {
      app = await Test.createTestingModule({
        imports: [
          SupportModule,
          LangChainModule.registerAsync({
            name: 'SUPPORT_AGENT',
            isGlobal: true,
            useFactory: () => ({ model: model('async') }),
          }),
        ],
      }).compile();
      await app.init();

      const { agent } = app.get(SupportService);

      expect(agent).toBe(
        app.get<Agent>(getAgentToken('SUPPORT_AGENT'), { strict: false }),
      );
      await expect(agent.run('?')).resolves.toMatchObject({ output: 'async' });
    });
  });

  describe('without isGlobal', () => {
    const cantResolve = /can't resolve dependencies of the SupportService/;

    it('stays scoped to its module by default', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            SupportModule,
            LangChainModule.register({
              name: 'SUPPORT_AGENT',
              model: model('hello'),
            }),
          ],
        }).compile(),
      ).rejects.toThrow(cantResolve);
    });

    it('stays scoped to its module by default in registerAsync', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            SupportModule,
            LangChainModule.registerAsync({
              name: 'SUPPORT_AGENT',
              useFactory: () => ({ model: model('hello') }),
            }),
          ],
        }).compile(),
      ).rejects.toThrow(cantResolve);
    });

    it('stays scoped to its module with `isGlobal: false`', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            SupportModule,
            LangChainModule.register({
              name: 'SUPPORT_AGENT',
              isGlobal: false,
              model: model('hello'),
            }),
          ],
        }).compile(),
      ).rejects.toThrow(cantResolve);
    });

    it('stays scoped to its module with `isGlobal: false` in registerAsync', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            SupportModule,
            LangChainModule.registerAsync({
              name: 'SUPPORT_AGENT',
              isGlobal: false,
              useFactory: () => ({ model: model('hello') }),
            }),
          ],
        }).compile(),
      ).rejects.toThrow(cantResolve);
    });
  });
});
