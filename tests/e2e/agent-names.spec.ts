import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { Agent, InjectAgent, LangChainModule } from '../../lib/index.js';

const agent = (name: string | undefined, answer = name ?? 'unnamed') =>
  LangChainModule.register({
    name,
    model: new FakeListChatModel({ responses: [answer] }),
  });

describe('agent names', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('case', () => {
    it('keeps two names differing only by case apart', async () => {
      @Injectable()
      class Consumer {
        constructor(
          @InjectAgent('math') readonly lower: Agent,
          @InjectAgent('MATH') readonly upper: Agent,
        ) {}
      }

      app = await Test.createTestingModule({
        imports: [agent('math'), agent('MATH')],
        providers: [Consumer],
      }).compile();
      await app.init();

      const { lower, upper } = app.get(Consumer);

      await expect(lower.run('?')).resolves.toBe('math');
      await expect(upper.run('?')).resolves.toBe('MATH');
    });

    it('does not resolve a name written with another case', async () => {
      @Injectable()
      class Consumer {
        constructor(@InjectAgent('math') readonly math: Agent) {}
      }

      await expect(
        Test.createTestingModule({
          imports: [agent('MATH')],
          providers: [Consumer],
        }).compile(),
      ).rejects.toThrow(/can't resolve dependencies of the Consumer/);
    });
  });

  describe('duplicates', () => {
    it('fails the bootstrap when two agents share a name', async () => {
      const failing = await Test.createTestingModule({
        imports: [agent('MATH', 'first'), agent('MATH', 'second')],
      }).compile();

      await expect(failing.init()).rejects.toThrow(
        'Two agents are registered as "MATH". ' +
          'Give each LangChainModule registration its own `name`.',
      );
    });

    it('fails the bootstrap when two agents have no name', async () => {
      const failing = await Test.createTestingModule({
        imports: [agent(undefined, 'first'), agent(undefined, 'second')],
      }).compile();

      await expect(failing.init()).rejects.toThrow(
        'Two agents are registered without a name. ' +
          'Give all but one a `name` and inject them with @InjectAgent().',
      );
    });

    it('catches a duplicate between register and registerAsync', async () => {
      const failing = await Test.createTestingModule({
        imports: [
          agent('MATH'),
          LangChainModule.registerAsync({
            name: 'MATH',
            useFactory: () => ({
              model: new FakeListChatModel({ responses: ['async'] }),
            }),
          }),
        ],
      }).compile();

      await expect(failing.init()).rejects.toThrow(
        'Two agents are registered as "MATH".',
      );
    });

    it('boots one unnamed agent next to named ones', async () => {
      app = await Test.createTestingModule({
        imports: [agent('A'), agent(undefined), agent('B')],
      }).compile();

      await expect(app.init()).resolves.toBeDefined();
    });
  });

  describe('reserved names', () => {
    it('rejects "default", which stands for the unnamed agent', () => {
      expect(() => agent('default')).toThrow(
        '"default" cannot be an agent\'s `name`: it stands for the agent ' +
          'registered without one. Pick another name.',
      );
    });

    it('rejects an empty name', () => {
      expect(() => agent('')).toThrow(
        "An agent's `name` cannot be empty. " +
          'Omit it to register the unnamed agent.',
      );
    });

    it('applies the same rule to registerAsync', () => {
      expect(() =>
        LangChainModule.registerAsync({
          name: 'default',
          useFactory: () => ({
            model: new FakeListChatModel({ responses: ['x'] }),
          }),
        }),
      ).toThrow('"default" cannot be an agent\'s `name`');
    });
  });
});
