import { Injectable, OnModuleInit } from '@nestjs/common';
import { NatsService } from '@repo/nats-wrapper';
import { FacebookEvent, TiktokEvent } from '@repo/shared';
import { randomUUID } from 'crypto';
import { MetricsService } from '../metrics/metrics.service';
import { LoggerService } from '@repo/logger';

@Injectable()
export class GatewayService implements OnModuleInit {
  private readonly BATCH_SIZE = 1000;

  constructor(
    private readonly nats: NatsService,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService
  ) {}

  async onModuleInit() {
    try {
      await this.nats.ensureStream({
        name: 'EVENTS',
        subjects: ['events.*']
      });
    } catch (error) {
      this.logger.error('GATEWAY Can not ensure EVENTS stream', error);
    }
  }

  async publishEvents(
    events: (FacebookEvent | TiktokEvent)[],
    correlationId?: string
  ) {
    if (!correlationId) {
      correlationId = randomUUID();
    }

    this.metrics.incAccepted(events.length);

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < events.length; i += this.BATCH_SIZE) {
      const batch = events.slice(i, i + this.BATCH_SIZE);

      await Promise.all(
        batch.map(async (event) => {
          let subject: string;
          if (event.source === 'facebook') {
            subject = 'events.facebook';
          } else if (event.source === 'tiktok') {
            subject = 'events.tiktok';
          } else {
            failed += 1;
            this.metrics.incFailed(1);
            return;
          }
          try {
            await this.nats.publish(subject, event, correlationId);
            processed += 1;
            this.metrics.incProcessed(1);
          } catch (err) {
            failed += 1;
            this.metrics.incFailed(1);
            this.logger.error('GATEWAY Failed to publish event', err, {
              eventId: event.eventId,
              correlationId
            });
          }
        })
      );
    }
  }
}
