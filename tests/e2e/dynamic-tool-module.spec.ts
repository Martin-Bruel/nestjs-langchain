import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, LangChainService, Tool } from '../../lib/index.js';

const UNIT = 'WEATHER_UNIT';

@Injectable()
class WeatherService {
  constructor(@Inject(UNIT) private readonly unit: string) {}

  @Tool({ description: 'Reads the current temperature.' })
  temperature(): string {
    return `20${this.unit}`;
  }
}

// A tool provider that needs configuration, which is the case #51 exists for.
@Module({})
class WeatherModule {
  static forRoot(unit: string): DynamicModule {
    return {
      module: WeatherModule,
      providers: [WeatherService, { provide: UNIT, useValue: unit }],
    };
  }
}

describe('a tool module registered through forRoot', () => {
  it('is discovered and keeps the configuration it was given', async () => {
    const weather = WeatherModule.forRoot('C');

    const app = await Test.createTestingModule({
      imports: [
        weather,
        LangChainModule.register({
          model: new FakeListChatModel({ responses: ['42'] }),
          tools: [weather],
        }),
      ],
    }).compile();

    await app.init();

    // The agent booted, so the entry resolved to its class and matched. The
    // injected unit proves the configured instance is the one behind the tool.
    expect(app.get(LangChainService)).toBeInstanceOf(LangChainService);
    expect(app.get(WeatherService).temperature()).toBe('20C');

    await app.close();
  });

  it('refuses to boot when the dynamic module was never imported', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          LangChainModule.register({
            model: new FakeListChatModel({ responses: ['42'] }),
            tools: [WeatherModule.forRoot('C')],
          }),
        ],
      })
        .compile()
        .then((app) => app.init()),
    ).rejects.toThrow(
      /WeatherModule is listed in `tools` but is not imported into the Nest context/,
    );
  });
});
