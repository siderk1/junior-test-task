import {
  Controller,
  Get,
  HttpCode,
  ServiceUnavailableException
} from '@nestjs/common';
import { PrismaService } from '@repo/prisma';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('healthcheck')
  @HttpCode(200)
  healthcheck() {
    return 'OK';
  }

  @Get('readiness')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'OK';
    } catch (err) {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
