import {
  Controller,
  Get,
  HttpCode,
  ServiceUnavailableException
} from '@nestjs/common';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';

@Controller()
export class AppController {
  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService
  ) {}

  @Get('healthcheck')
  @HttpCode(200)
  healthcheck() {
    return 'OK';
  }

  @Get('readiness')
  async readiness() {
    if (!this.nats.isReady()) {
      throw new ServiceUnavailableException('NATS was not connected');
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      throw new ServiceUnavailableException('Database was not connected');
    }

    return 'OK';
  }
}
