import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Tool, ToolParam } from 'nestjs-langchain';

@Injectable()
export class MongoService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Tool({
    description:
      'Executes a MongoDB command provided in JSON format. Use this tool for read-only operations only. Ensure all property names are enclosed in double quotes.',
  })
  async executeMongoCommand(
    @ToolParam({
      name: 'command',
      description:
        'A valid MongoDB command in JSON format as a string. Example: \'{"find": "collectionName", "filter": {"field": "value"}}\'',
      type: 'string',
    })
    command: string,
  ): Promise<any> {
    try {
      const parsedCommand = JSON.parse(command);
      const db = this.connection.db;
      if (!db) {
        throw new Error('Connection to MongoDB failed.');
      }
      const result = await db.command(parsedCommand);
      return result;
    } catch (error) {
      return `Error: ${error?.message}`;
    }
  }
}
