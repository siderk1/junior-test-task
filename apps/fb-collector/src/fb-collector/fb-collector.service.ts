import { Injectable, OnModuleInit } from '@nestjs/common';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { FacebookEvent } from '@repo/shared';
import { MetricsService } from '../metrics/metrics.service';
import { LoggerService } from '@repo/logger';

function toPrismaGender(gender: 'male' | 'female' | 'non-binary') {
  return gender === 'non-binary' ? 'non_binary' : gender;
}

@Injectable()
export class FbCollectorService implements OnModuleInit {
  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService
  ) {}

  async onModuleInit() {
    this.logger.info('FB Collector: Initializing NATS subscription...');
    await this.nats.subscribe<FacebookEvent>(
      'EVENTS',
      'events.facebook',
      'fb-collector',
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
    this.logger.info('FB Collector: NATS subscription initialized.');
  }

  async handleEvent(event: FacebookEvent) {
    const location = await this.prisma.facebookUserLocation.upsert({
      where: {
        country_city: {
          country: event.data.user.location.country,
          city: event.data.user.location.city
        }
      },
      update: {},
      create: {
        country: event.data.user.location.country,
        city: event.data.user.location.city
      }
    });

    const user = await this.prisma.facebookUser.upsert({
      where: { userId: event.data.user.userId },
      update: {
        name: event.data.user.name,
        age: event.data.user.age,
        gender: toPrismaGender(event.data.user.gender),
        locationId: location.id
      },
      create: {
        userId: event.data.user.userId,
        name: event.data.user.name,
        age: event.data.user.age,
        gender: toPrismaGender(event.data.user.gender),
        locationId: location.id
      }
    });

    let engagementTopId: string | undefined;
    let engagementBottomId: string | undefined;

    if (event.funnelStage === 'top') {
      if ('actionTime' in event.data.engagement) {
        const engagementTop = await this.prisma.facebookEngagementTop.create({
          data: {
            actionTime: new Date(event.data.engagement.actionTime),
            referrer: (event.data.engagement as any).referrer || null,
            videoId: (event.data.engagement as any).videoId || null
          }
        });
        engagementTopId = engagementTop.id;
      }
    } else if (event.funnelStage === 'bottom') {
      const engagementBottom =
        await this.prisma.facebookEngagementBottom.create({
          data: {
            adId: (event.data.engagement as any).adId || null,
            campaignId: (event.data.engagement as any).campaignId || null,
            clickPosition: (event.data.engagement as any).clickPosition || null,
            device: (event.data.engagement as any).device || null,
            browser: (event.data.engagement as any).browser || null,
            purchaseAmount: (event.data.engagement as any).purchaseAmount
              ? Number((event.data.engagement as any).purchaseAmount)
              : null
          }
        });
      engagementBottomId = engagementBottom.id;
    }

    await this.prisma.facebookEvent.create({
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
