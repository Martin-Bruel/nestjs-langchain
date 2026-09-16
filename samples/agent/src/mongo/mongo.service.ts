import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Tool, ToolParam } from 'nestjs-langchain';
import { z } from 'zod';

const readCommand = z.object({
  find: z.string().describe('The collection to read from.'),
  filter: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().optional(),
});

@Injectable()
export class MongoService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Tool({ description: 'Runs a read-only MongoDB command.' })
  async executeMongoCommand(
    @ToolParam({
      name: 'command',
      description: 'The command to run.',
      schema: readCommand,
    })
    command: z.infer<typeof readCommand>,
  ): Promise<unknown> {
    const db = this.connection.db;

    if (!db) {
      throw new Error('Connection to MongoDB failed.');
    }

    return db.command(command);
  }
}
