import { Module } from '@nestjs/common';
import { ConfigModule } from '@repo/config';
import { PrismaModule } from '@repo/prisma';
import { NatsModule } from '@repo/nats-wrapper';
import { FbCollectorService } from './fb-collector/fb-collector.service';
import { MetricsModule } from './metrics/metrics.module';
import { FbCollectorModule } from './fb-collector/fb-collector.module';
import { AppController } from './app.controller';
import { LoggerModule } from '@repo/logger';

@Module({
  imports: [
    MetricsModule,
    ConfigModule,
    NatsModule.forRoot(
      process.env.NATS_URL || 'nats://nats:4222',
      'fb-collector-nats-client'
    ),
    PrismaModule,
    FbCollectorModule,
    LoggerModule
  ],
  providers: [FbCollectorService],
  controllers: [AppController]
})
export class AppModule {}
