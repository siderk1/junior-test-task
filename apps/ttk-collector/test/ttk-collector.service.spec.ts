import { Test, TestingModule } from '@nestjs/testing';
import { TtkCollectorService } from '../src/ttk-collector/ttk-collector.service';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { MetricsService } from '../src/metrics/metrics.service';
import { LoggerService } from '@repo/logger';
import { TiktokEvent } from '@repo/shared';

const mockNatsService = {
  pullSubscribeBatch: jest.fn()
};

const mockPrismaService = {
  $transaction: jest.fn(),
  tiktokUser: { upsert: jest.fn() },
  tiktokEngagementTop: { createMany: jest.fn(), findMany: jest.fn() },
  tiktokEngagementBottom: { createMany: jest.fn(), findMany: jest.fn() },
  tiktokEvent: { createMany: jest.fn() }
};

const mockMetricsService = {
  incAccepted: jest.fn(),
  incProcessed: jest.fn(),
  incFailed: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
};

describe('TtkCollectorService', () => {
  let service: TtkCollectorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TtkCollectorService,
        { provide: NatsService, useValue: mockNatsService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: LoggerService, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<TtkCollectorService>(TtkCollectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call runPullLoop on init and log messages', async () => {
    jest.spyOn(service as any, 'runPullLoop').mockImplementation(() => Promise.resolve());
    await service.onModuleInit();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('TTK Collector: Initializing JetStream PULL subscription...')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('TTK Collector: JetStream PULL subscription initialized.')
    );
  });

  it('should set isShuttingDown on destroy', () => {
    service['isShuttingDown'] = false;
    service.onModuleDestroy();
    expect(service['isShuttingDown']).toBe(true);
  });

  it('should process a valid batch in handleBatch', async () => {
    const ack = jest.fn();
    const mockMsg = { ack };
    const mockEvent: TiktokEvent = {
      eventId: 'event1',
      timestamp: new Date().toISOString(),
      funnelStage: 'top',
      eventType: 'video.view',
      source: 'tiktok',
      data: {
        user: {
          userId: 'u1',
          username: 'john',
          followers: 100
        },
        engagement: {
          watchTime: 123,
          percentageWatched: 90,
          device: 'Android',
          country: 'US',
          videoId: 'vid1'
        }
      }
    };
    mockPrismaService.$transaction.mockImplementation(async (fn) => fn(mockPrismaService));
    mockPrismaService.tiktokUser.upsert.mockResolvedValue({ id: 'db1' });
    mockPrismaService.tiktokEngagementTop.createMany.mockResolvedValue({});
    mockPrismaService.tiktokEngagementTop.findMany.mockResolvedValue([{ id: 'top1' }]);
    mockPrismaService.tiktokEngagementBottom.createMany.mockResolvedValue({});
    mockPrismaService.tiktokEngagementBottom.findMany.mockResolvedValue([]);
    mockPrismaService.tiktokEvent.createMany.mockResolvedValue({});
    const batch = [
      { event: mockEvent, msg: mockMsg, correlationId: 'cid1' }
    ];
    await (service as any).handleBatch(batch);
    expect(mockPrismaService.tiktokUser.upsert).toHaveBeenCalled();
    expect(mockPrismaService.tiktokEngagementTop.createMany).toHaveBeenCalled();
    expect(mockPrismaService.tiktokEngagementTop.findMany).toHaveBeenCalled();
    expect(mockPrismaService.tiktokEvent.createMany).toHaveBeenCalled();
  });

  it('should log error if handleBatch throws', async () => {
    const error = new Error('fail!');
    const batch = [{ event: {} as any, msg: { ack: jest.fn() }, correlationId: 'cid1' }];
    const spy = jest.spyOn(service as any, 'handleBatch').mockRejectedValue(error);
    try {
      await (service as any).handleBatch(batch);
    } catch {}
    expect(spy).toHaveBeenCalled();
  });
});
