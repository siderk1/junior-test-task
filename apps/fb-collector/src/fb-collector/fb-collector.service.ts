import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsService, JsMsg } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { FacebookEvent } from '@repo/shared';
import { MetricsService } from '../metrics/metrics.service';
import { LoggerService } from '@repo/logger';

function toPrismaGender(gender: 'male' | 'female' | 'non-binary') {
  return gender === 'non-binary' ? 'non_binary' : gender;
}

const BATCH_SIZE = 100;
const FETCH_TIMEOUT_MS = 1000;

@Injectable()
export class FbCollectorService implements OnModuleInit, OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
      private readonly nats: NatsService,
      private readonly prisma: PrismaService,
      private readonly metrics: MetricsService,
      private readonly logger: LoggerService
  ) {}

  async onModuleInit() {
    this.logger.info('FB Collector: Initializing JetStream PULL subscription...');
    this.runPullLoop();
    this.logger.info('FB Collector: JetStream PULL subscription initialized.');
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
  }

  private async runPullLoop() {
    while (!this.isShuttingDown) {
      try {
        await this.nats.pullSubscribeBatch<FacebookEvent>(
            'EVENTS_FB',
            'events.facebook',
            'fb-collector',
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
                this.logger.error('Failed to process FB batch', error);
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

  private async handleBatch(batch: { event: FacebookEvent, msg: JsMsg, correlationId?: string }[]) {
    const locationMap = new Map<
        string,
        FacebookEvent['data']['user']['location']
    >();
    for (const { event } of batch) {
      const loc = event.data.user.location;
      locationMap.set(`${loc.country}__${loc.city}`, loc);
    }
    const locationKeyToDbId = new Map<string, string>();
    await this.prisma.$transaction(async (tx) => {
      const promises: Promise<unknown>[] = [];
      for (const loc of locationMap.values()) {
        promises.push(
            tx.facebookUserLocation
                .upsert({
                  where: {
                    country_city: {
                      country: loc.country,
                      city: loc.city
                    }
                  },
                  update: {},
                  create: {
                    country: loc.country,
                    city: loc.city
                  }
                })
                .then((dbLoc) => {
                  locationKeyToDbId.set(`${loc.country}__${loc.city}`, dbLoc.id);
                })
        );
      }
      await Promise.all(promises);
    });

    const userMap = new Map<string, FacebookEvent['data']['user']>();
    for (const { event } of batch) {
      userMap.set(event.data.user.userId, event.data.user);
    }
    const userIdToDbId = new Map<string, string>();
    await this.prisma.$transaction(async (tx) => {
      const promises: Promise<unknown>[] = [];
      for (const user of userMap.values()) {
        promises.push(
            tx.facebookUser
                .upsert({
                  where: { userId: user.userId },
                  update: {
                    name: user.name,
                    age: user.age,
                    gender: toPrismaGender(user.gender),
                    locationId: locationKeyToDbId.get(
                        `${user.location.country}__${user.location.city}`
                    )!
                  },
                  create: {
                    userId: user.userId,
                    name: user.name,
                    age: user.age,
                    gender: toPrismaGender(user.gender),
                    locationId: locationKeyToDbId.get(
                        `${user.location.country}__${user.location.city}`
                    )!
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
      if (
          event.funnelStage === 'top' &&
          'actionTime' in event.data.engagement
      ) {
        engagementTops.push({
          actionTime: new Date(event.data.engagement.actionTime),
          referrer: (event.data.engagement as any).referrer || null,
          videoId: (event.data.engagement as any).videoId || null
        });
        engagementTopRefs.push(event.eventId);
        engagementBottomRefs.push(null);
      } else if (event.funnelStage === 'bottom') {
        engagementBottoms.push({
          adId: (event.data.engagement as any).adId || null,
          campaignId: (event.data.engagement as any).campaignId || null,
          clickPosition: (event.data.engagement as any).clickPosition || null,
          device: (event.data.engagement as any).device || null,
          browser: (event.data.engagement as any).browser || null,
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
      await this.prisma.facebookEngagementTop.createMany({
        data: engagementTops,
        skipDuplicates: false
      });
      const foundTops = await this.prisma.facebookEngagementTop.findMany({
        where: {
          OR: engagementTops.map((et) => ({
            actionTime: et.actionTime,
            referrer: et.referrer,
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
      await this.prisma.facebookEngagementBottom.createMany({
        data: engagementBottoms,
        skipDuplicates: false
      });
      const foundBottoms = await this.prisma.facebookEngagementBottom.findMany({
        where: {
          OR: engagementBottoms.map((eb) => ({
            adId: eb.adId,
            campaignId: eb.campaignId,
            clickPosition: eb.clickPosition,
            device: eb.device,
            browser: eb.browser,
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
      await this.prisma.facebookEvent.createMany({
        data: events,
        skipDuplicates: true
      });
    }
  }
}
