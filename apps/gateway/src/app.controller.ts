import {
  Controller,
  Get,
  HttpCode,
  ServiceUnavailableException
} from '@nestjs/common';
import { NatsService } from '@repo/nats-wrapper';

@Controller()
export class AppController {
  constructor(private readonly nats: NatsService) {}

  @Get('healthcheck')
  @HttpCode(200)
  healthcheck() {
    return 'OK';
  }

  @Get('readiness')
  readiness() {
    if (this.nats.isReady()) {
      return 'OK';
    } else {
      throw new ServiceUnavailableException('NATS was not connected');
    }
  }
}
