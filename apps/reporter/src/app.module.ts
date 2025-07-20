import { Module } from '@nestjs/common';
import { ConfigModule } from '@repo/config';
import { PrismaModule } from '@repo/prisma';
import { MetricsModule } from './metrics/metrics.module';
import { ReporterModule } from './reporter/reporter.module';
import { AppController } from './app.controller';

@Module({
  imports: [ConfigModule, MetricsModule, PrismaModule, ReporterModule],
  controllers: [AppController]
})
export class AppModule {}
