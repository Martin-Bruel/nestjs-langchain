import { Injectable } from '@nestjs/common';
import { Tool, ToolParam } from '../../../lib/decorators/tool.decorator';

@Injectable()
export class MongoService {
  @Tool({ description: 'Call mongo command.' })
  command(
    @ToolParam({
      name: 'query',
      description: 'The mongo query to execute.',
      type: 'string',
    })
    query: string,
  ): number {
    return query.length;
  }
}
