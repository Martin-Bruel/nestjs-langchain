import { Module } from '@nestjs/common';
import { MongoService } from './mongo.service.js';

@Module({
  providers: [MongoService],
  exports: [MongoService],
})
export class MongoModule {}
