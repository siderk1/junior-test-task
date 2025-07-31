import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsService, JsMsg } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { TiktokEvent } from '@repo/shared';
import { MetricsService } from '../metrics/metrics.service';
import { LoggerService } from '@repo/logger';

const BATCH_SIZE = 100;
const FETCH_TIMEOUT_MS = 1000;

@Injectable()
export class TtkCollectorService implements OnModuleInit, OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
      private readonly nats: NatsService,
      private readonly prisma: PrismaService,
      private readonly metrics: MetricsService,
      private readonly logger: LoggerService
  ) {}

  async onModuleInit() {
    this.logger.info('TTK Collector: Initializing JetStream PULL subscription...');
    this.runPullLoop();
    this.logger.info('TTK Collector: JetStream PULL subscription initialized.');
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
  }

  private async runPullLoop() {
    while (!this.isShuttingDown) {
      try {
        await this.nats.pullSubscribeBatch<TiktokEvent>(
            'EVENTS_TTK',
            'events.tiktok',
            'ttk-collector',
            BATCH_SIZE,
            async (batch) => {
              this.metrics.incAccepted(batch.length);
              try {
                await this.handleBatch(
                    batch.map(({ data, msg, correlationId }) => ({
                      event: data,
                      msg,
                      correlationId,
                    }))
                );
                this.metrics.incProcessed(batch.length);
                batch.forEach(({ msg }) => msg.ack());
              } catch (error) {
                this.metrics.incFailed(batch.length);
                this.logger.error('Failed to process TTK batch', error);
              }
            },
            { expires: FETCH_TIMEOUT_MS }
        );
      } catch (error) {
        this.logger.error('NATS PULL fetch error', error);
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  }

  private async handleBatch(batch: { event: TiktokEvent, msg: JsMsg, correlationId?: string }[]) {
    const userMap = new Map<string, TiktokEvent['data']['user']>();
    for (const { event } of batch) {
      userMap.set(event.data.user.userId, event.data.user);
    }
    const userIdToDbId = new Map<string, string>();
    await this.prisma.$transaction(async (tx) => {
      const promises: Promise<unknown>[] = [];
      for (const user of userMap.values()) {
        promises.push(
            tx.tiktokUser
                .upsert({
                  where: { userId: user.userId },
                  update: {
                    username: user.username,
                    followers: user.followers
                  },
                  create: {
                    userId: user.userId,
                    username: user.username,
                    followers: user.followers
                  }
                })
                .then((dbUser) => {
                  userIdToDbId.set(user.userId, dbUser.id);
                })
        );
      }
      await Promise.all(promises);
    });

    const engagementTops: any[] = [];
    const engagementBottoms: any[] = [];
    const events: any[] = [];
    const engagementTopRefs: (string | null)[] = [];
    const engagementBottomRefs: (string | null)[] = [];

    for (const { event } of batch) {
      if (event.funnelStage === 'top' && 'watchTime' in event.data.engagement) {
        engagementTops.push({
          watchTime: (event.data.engagement as any).watchTime,
          percentageWatched: (event.data.engagement as any).percentageWatched,
          device: (event.data.engagement as any).device,
          country: (event.data.engagement as any).country,
          videoId: (event.data.engagement as any).videoId
        });
        engagementTopRefs.push(event.eventId);
        engagementBottomRefs.push(null);
      } else if (event.funnelStage === 'bottom') {
        engagementBottoms.push({
          actionTime: new Date((event.data.engagement as any).actionTime),
          profileId: (event.data.engagement as any).profileId || null,
          purchasedItem: (event.data.engagement as any).purchasedItem || null,
          purchaseAmount: (event.data.engagement as any).purchaseAmount
              ? Number((event.data.engagement as any).purchaseAmount)
              : null
        });
        engagementTopRefs.push(null);
        engagementBottomRefs.push(event.eventId);
      } else {
        engagementTopRefs.push(null);
        engagementBottomRefs.push(null);
      }
    }

    const engagementTopIds: (string | null)[] = [];
    const engagementBottomIds: (string | null)[] = [];
    if (engagementTops.length > 0) {
      await this.prisma.tiktokEngagementTop.createMany({
        data: engagementTops,
        skipDuplicates: false
      });
      const foundTops = await this.prisma.tiktokEngagementTop.findMany({
        where: {
          OR: engagementTops.map((et) => ({
            watchTime: et.watchTime,
            percentageWatched: et.percentageWatched,
            device: et.device,
            country: et.country,
            videoId: et.videoId
          }))
        }
      });
      let i = 0;
      for (const ref of engagementTopRefs) {
        if (ref && foundTops[i]) {
          engagementTopIds.push(foundTops[i].id);
          i++;
        } else {
          engagementTopIds.push(null);
        }
      }
    } else {
      for (let i = 0; i < batch.length; i++) engagementTopIds.push(null);
    }
    if (engagementBottoms.length > 0) {
      await this.prisma.tiktokEngagementBottom.createMany({
        data: engagementBottoms,
        skipDuplicates: false
      });
      const foundBottoms = await this.prisma.tiktokEngagementBottom.findMany({
        where: {
          OR: engagementBottoms.map((eb) => ({
            actionTime: eb.actionTime,
            profileId: eb.profileId,
            purchasedItem: eb.purchasedItem,
            purchaseAmount: eb.purchaseAmount
          }))
        }
      });
      let i = 0;
      for (const ref of engagementBottomRefs) {
        if (ref && foundBottoms[i]) {
          engagementBottomIds.push(foundBottoms[i].id);
          i++;
        } else {
          engagementBottomIds.push(null);
        }
      }
    } else {
      for (let i = 0; i < batch.length; i++) engagementBottomIds.push(null);
    }

    for (let i = 0; i < batch.length; i++) {
      const { event } = batch[i];
      events.push({
        eventId: event.eventId,
        timestamp: new Date(event.timestamp),
        funnelStage: event.funnelStage,
        eventType: event.eventType,
        userId: userIdToDbId.get(event.data.user.userId),
        engagementTopId: engagementTopIds[i],
        engagementBottomId: engagementBottomIds[i]
      });
    }
    if (events.length > 0) {
      await this.prisma.tiktokEvent.createMany({
        data: events,
        skipDuplicates: true
      });
    }
  }
}
