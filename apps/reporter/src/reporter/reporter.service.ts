import { Injectable } from '@nestjs/common';
import { PrismaService } from '@repo/prisma';
import {
  DemographicsStat,
  EventStat,
  FunnelStageType,
  RevenueStat
} from './reporter.types';
import { MetricsService } from '../metrics/metrics.service';
import {
  DemographicsReportQuery,
  EventsReportQuery,
  RevenueReportQuery
} from './schemas';

@Injectable()
export class ReporterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService
  ) {}

  async getEventsReport(filters: EventsReportQuery): Promise<{
    facebook?: EventStat[];
    tiktok?: EventStat[];
  }> {
    const endTimer = this.metrics.startReportTimer('events');
    try {
      const { from, to, source, funnelStage, eventType } = filters;
      const baseWhere: any = {};
      if (from || to) baseWhere.timestamp = {};
      if (from) baseWhere.timestamp.gte = from;
      if (to) baseWhere.timestamp.lte = to;
      if (funnelStage) baseWhere.funnelStage = funnelStage;
      if (eventType) baseWhere.eventType = eventType;

      const results: { facebook?: EventStat[]; tiktok?: EventStat[] } = {};

      if (!source || source === 'facebook') {
        const fbEvents = await this.prisma.facebookEvent.groupBy({
          by: ['eventType', 'funnelStage'],
          where: baseWhere,
          _count: { _all: true },
          orderBy: [{ eventType: 'asc' }]
        });
        results.facebook = fbEvents.map((ev) => ({
          eventType: ev.eventType,
          funnelStage: ev.funnelStage as FunnelStageType,
          count: ev._count._all
        }));
      }

      if (!source || source === 'tiktok') {
        const tkEvents = await this.prisma.tiktokEvent.groupBy({
          by: ['eventType', 'funnelStage'],
          where: baseWhere,
          _count: { _all: true },
          orderBy: [{ eventType: 'asc' }]
        });
        results.tiktok = tkEvents.map((ev) => ({
          eventType: ev.eventType,
          funnelStage: ev.funnelStage as FunnelStageType,
          count: ev._count._all
        }));
      }

      return results;
    } finally {
      endTimer();
    }
  }

  async getRevenueReport(filters: RevenueReportQuery): Promise<RevenueStat> {
    const endTimer = this.metrics.startReportTimer('revenue');
    try {
      const { from, to, source, campaignId } = filters;

      let fbWhere: any = {
        eventType: 'checkout.complete'
      };
      let tkWhere: any = {
        eventType: 'purchase'
      };

      if (from || to) {
        fbWhere.timestamp = {};
        tkWhere.timestamp = {};
        if (from) {
          fbWhere.timestamp.gte = from;
          tkWhere.timestamp.gte = from;
        }
        if (to) {
          fbWhere.timestamp.lte = to;
          tkWhere.timestamp.lte = to;
        }
      }
      if (campaignId) {
        fbWhere.engagementBottom = { campaignId };
      }

      let facebookRevenue = 0;
      let tiktokRevenue = 0;

      if (!source || source === 'facebook') {
        const fbRows = await this.prisma.facebookEvent.findMany({
          where: fbWhere,
          include: { engagementBottom: true }
        });
        facebookRevenue = fbRows.reduce(
          (sum, ev) => sum + Number(ev.engagementBottom?.purchaseAmount ?? 0),
          0
        );
      }
      if (!source || source === 'tiktok') {
        const tkRows = await this.prisma.tiktokEvent.findMany({
          where: tkWhere,
          include: { engagementBottom: true }
        });
        tiktokRevenue = tkRows.reduce(
          (sum, ev) => sum + Number(ev.engagementBottom?.purchaseAmount ?? 0),
          0
        );
      }

      return {
        facebook: facebookRevenue,
        tiktok: tiktokRevenue,
        total: facebookRevenue + tiktokRevenue
      };
    } finally {
      endTimer();
    }
  }

  async getDemographicsReport(
    filters: DemographicsReportQuery
  ): Promise<DemographicsStat> {
    const endTimer = this.metrics.startReportTimer('demographics');
    try {
      const { from, to, source } = filters;
      const result: DemographicsStat = {};

      if (!source || source === 'facebook') {
        const eventWhere: any = {};
        if (from || to) {
          eventWhere.timestamp = {};
          if (from) eventWhere.timestamp.gte = from;
          if (to) eventWhere.timestamp.lte = to;
        }

        const byGender = await this.prisma.facebookUser.groupBy({
          by: ['gender'],
          where: {
            events: { some: eventWhere }
          },
          _count: { _all: true },
          _avg: { age: true }
        });

        const allLocations = await this.prisma.facebookUserLocation.findMany({
          select: {
            country: true,
            city: true,
            _count: { select: { users: true } }
          }
        });

        const topCities = allLocations
          .map((loc) => ({
            country: loc.country,
            city: loc.city,
            users: loc._count.users
          }))
          .sort((a, b) => b.users - a.users)
          .slice(0, 5);

        result.facebook = {
          byGender: byGender.map((g) => ({
            gender: g.gender,
            count: g._count._all,
            avgAge: g._avg.age ?? 0
          })),
          topCities
        };
      }

      if (!source || source === 'tiktok') {
        const eventWhere: any = {};
        if (from || to) {
          eventWhere.timestamp = {};
          if (from) eventWhere.timestamp.gte = from;
          if (to) eventWhere.timestamp.lte = to;
        }

        const users = await this.prisma.tiktokUser.findMany({
          where: {
            events: { some: eventWhere }
          }
        });

        const buckets = [
          { label: '<100', min: 0, max: 99 },
          { label: '100-999', min: 100, max: 999 },
          { label: '1000-9999', min: 1000, max: 9999 },
          { label: '10k+', min: 10000, max: Number.MAX_SAFE_INTEGER }
        ];
        const followersAgg = buckets.map((bucket) => ({
          range: bucket.label,
          count: users.filter(
            (u) => u.followers >= bucket.min && u.followers <= bucket.max
          ).length
        }));

        const avgFollowers = users.length
          ? users.reduce((sum, u) => sum + u.followers, 0) / users.length
          : 0;

        result.tiktok = {
          avgFollowers,
          byFollowersRange: followersAgg
        };
      }

      return result;
    } finally {
      endTimer();
    }
  }
}
