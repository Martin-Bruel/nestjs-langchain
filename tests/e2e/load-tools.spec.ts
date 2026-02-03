import { Test } from '@nestjs/testing';
import { ToolDiscoveryService } from '../../lib/tool-discovery.service';
import { DiscoveryModule } from '@nestjs/core';
import { MathModule } from '../src/math/math.module';
import { MongoModule } from '../src/mongo/mongo.module';
import { ZodObject } from 'zod';

describe('ToolDiscovery Integration', () => {
  let toolDiscoveryService: ToolDiscoveryService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule, MathModule, MongoModule], // Import real NestJS discovery
      providers: [ToolDiscoveryService],
    }).compile();

    toolDiscoveryService =
      moduleRef.get<ToolDiscoveryService>(ToolDiscoveryService);
  });

  it('should discover tools function decorator (only the specified one)', () => {
    // Execute discovery on the real MathModule class
    const tools = toolDiscoveryService.getToolsFromModules([MathModule]);

    // Assert structure
    expect(tools).toHaveLength(1);
    const mathTool = tools[0];
    expect(mathTool.name).toBe('add');
    expect(mathTool.description).toBe('Adds two numbers together.');
  });

  it('should discover tools from multiple modules', () => {
    // Execute discovery on the real MathModule and MongoModule classes
    const tools = toolDiscoveryService.getToolsFromModules([
      MathModule,
      MongoModule,
    ]);

    // Assert structure
    expect(tools).toHaveLength(2);
    const mathTool = tools[0];
    expect(mathTool.name).toBe('add');
    expect(mathTool.description).toBe('Adds two numbers together.');
    const mongoTool = tools[1];
    expect(mongoTool.name).toBe('command');
    expect(mongoTool.description).toBe('Call mongo command.');
  });

  it('should discover tool param schema from decorator and generate proper Zod schema', () => {
    // Execute discovery on the real MathModule class
    const tools = toolDiscoveryService.getToolsFromModules([MathModule]);
    const mathTool = tools[0];

    // Assert Zod Schema generation
    const schemaDescription = (mathTool.schema as ZodObject).safeParse({
      a: 1,
      b: 2,
    });
    expect(schemaDescription.success).toBe(true);
  });

  it('should allocate call', async () => {
    // Execute discovery on the real MathModule class
    const tools = toolDiscoveryService.getToolsFromModules([MathModule]);
    const mathTool = tools[0];

    // Assert Execution: Does it actually call the NestJS instance?
    const result = await mathTool.invoke({ a: 1, b: 2 });
    expect(result).toBe(3);
  });
});
