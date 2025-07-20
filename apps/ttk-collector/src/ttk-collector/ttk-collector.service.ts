import { Injectable, OnModuleInit } from '@nestjs/common';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { TiktokEvent } from '@repo/shared';
import { MetricsService } from '../metrics/metrics.service';
import { LoggerService } from '@repo/logger';

@Injectable()
export class TtkCollectorService implements OnModuleInit {
  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService
  ) {}

  async onModuleInit() {
    this.logger.info('TTK Collector: Initializing NATS subscription...');
    await this.nats.subscribe<TiktokEvent>(
      'EVENTS',
      'events.tiktok',
      'ttk-collector',
      async (event, msg, correlationId) => {
        this.metrics.incAccepted();
        try {
          await this.handleEvent(event);
          this.metrics.incProcessed();
          msg.ack();
        } catch (error) {
          this.metrics.incFailed();
          this.logger.error(`Failed to process event`, error, {
            eventId: event.eventId,
            correlationId
          });
        }
      }
    );
    this.logger.info('TTK Collector: NATS subscription initialized.');
  }

  async handleEvent(event: TiktokEvent) {
    const user = await this.prisma.tiktokUser.upsert({
      where: { userId: event.data.user.userId },
      update: {
        username: event.data.user.username,
        followers: event.data.user.followers
      },
      create: {
        userId: event.data.user.userId,
        username: event.data.user.username,
        followers: event.data.user.followers
      }
    });

    let engagementTopId: string | undefined;
    let engagementBottomId: string | undefined;

    if (event.funnelStage === 'top') {
      if ('watchTime' in event.data.engagement) {
        const engagementTop = await this.prisma.tiktokEngagementTop.create({
          data: {
            watchTime: (event.data.engagement as any).watchTime,
            percentageWatched: (event.data.engagement as any).percentageWatched,
            device: (event.data.engagement as any).device,
            country: (event.data.engagement as any).country,
            videoId: (event.data.engagement as any).videoId
          }
        });
        engagementTopId = engagementTop.id;
      }
    } else if (event.funnelStage === 'bottom') {
      const engagementBottom = await this.prisma.tiktokEngagementBottom.create({
        data: {
          actionTime: new Date((event.data.engagement as any).actionTime),
          profileId: (event.data.engagement as any).profileId || null,
          purchasedItem: (event.data.engagement as any).purchasedItem || null,
          purchaseAmount: (event.data.engagement as any).purchaseAmount
            ? Number((event.data.engagement as any).purchaseAmount)
            : null
        }
      });
      engagementBottomId = engagementBottom.id;
    }

    await this.prisma.tiktokEvent.create({
      data: {
        eventId: event.eventId,
        timestamp: new Date(event.timestamp),
        funnelStage: event.funnelStage,
        eventType: event.eventType,
        userId: user.id,
        engagementTopId,
        engagementBottomId
      }
    });
  }
}
