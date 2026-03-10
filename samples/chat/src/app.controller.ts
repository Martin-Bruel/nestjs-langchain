import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  writeAPoemOn(@Body() body: { topic: string }): Promise<string> {
    return this.appService.writeAPoemOn(body.topic);
  }
}
