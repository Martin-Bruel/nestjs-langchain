import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LangChainModule } from 'nestjs-langchain';
import { MongoModule } from './mongo/mongo.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MathModule } from './math/math.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    LangChainModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        model: {
          model: 'openai:gpt-5.2',
          apiKey: configService.get<string>('OPENAI_API_KEY') || '',
        },
        systemPrompt: `
          You are a careful MongoDB assistant.

          Rules:
          - Think step-by-step
          - When you need data call the tool 'executeMongoCommand' with a valid MongoDB command in JSON format.
          - Read-only operations only.
          - If the tool return 'Error:', fix the command and try again.
          - All property names in mongo commands must be enclosed in double quotes.
          - Do not use any internal id or fields in your final responses.
        `,
        tools: [MongoModule],
      }),
      inject: [ConfigService],
      name: 'MONGO',
    }),
    MongoModule,
    LangChainModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        model: {
          model: 'openai:gpt-5.2',
          apiKey: configService.get<string>('OPENAI_API_KEY') || '',
        },
        systemPrompt: `
          You are a careful Math assistant.

          Rules:
          - When you need calculation call the tool 'calculate' with the valid format.
          - Do not try to do any calculation by yourself, always use the tool.
          - If the result return by the calculator seems wrong for you, do not fix, return as it is.
          - Operations allowed: addition (a + b), subtraction (a - b), multiplication (a * b), division (a / b).
        `,
        tools: [MathModule],
      }),
      inject: [ConfigService],
      name: 'MATH',
    }),
    MathModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
