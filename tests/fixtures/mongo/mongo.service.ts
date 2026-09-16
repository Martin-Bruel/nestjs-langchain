import { Injectable } from '@nestjs/common';
import { Tool, ToolParam } from '../../../lib/index.js';

@Injectable()
export class MongoService {
  @Tool({ description: 'Call mongo command.' })
  command(
    @ToolParam({
      name: 'query',
      description: 'The mongo query to execute.',
    })
    query: string,
  ): number {
    return query.length;
  }
}
