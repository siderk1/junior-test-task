import { Module } from '@nestjs/common';
import { PrismaModule } from '@repo/prisma';
import { MetricsModule } from '../metrics/metrics.module';
import { ReporterController } from './reporter.controller';
import { ReporterService } from './reporter.service';

@Module({
  imports: [MetricsModule, PrismaModule],
  controllers: [ReporterController],
  providers: [ReporterService],
  exports: [ReporterService]
})
export class ReporterModule {}
