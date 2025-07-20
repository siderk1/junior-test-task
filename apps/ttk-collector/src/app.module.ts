import { Module } from '@nestjs/common';
import { ConfigModule } from '@repo/config';
import { PrismaModule } from '@repo/prisma';
import { NatsModule } from '@repo/nats-wrapper';
import { MetricsModule } from './metrics/metrics.module';
import { AppController } from './app.controller';
import { TtkCollectorModule } from './ttk-collector/ttk-collector.module';
import { LoggerModule } from '@repo/logger';

@Module({
  imports: [
    MetricsModule,
    ConfigModule,
    NatsModule.forRoot(
      process.env.NATS_URL || 'nats://nats:4222',
      'ttk-collector-nats-client'
    ),
    PrismaModule,
    TtkCollectorModule,
    LoggerModule
  ],
  controllers: [AppController]
})
export class AppModule {}
