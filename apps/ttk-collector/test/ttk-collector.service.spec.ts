import { Test, TestingModule } from '@nestjs/testing';
import { TtkCollectorService } from '../src/ttk-collector/ttk-collector.service';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { MetricsService } from '../src/metrics/metrics.service';
import { LoggerService } from '@repo/logger';
import { TiktokEvent } from '@repo/shared';

jest.useFakeTimers();

const mockNatsService = {
  subscribe: jest.fn()
};

const mockPrismaService = {
  $transaction: jest.fn(),
  tiktokUser: {
    upsert: jest.fn()
  },
  tiktokEngagementTop: {
    createMany: jest.fn(),
    findMany: jest.fn()
  },
  tiktokEngagementBottom: {
    createMany: jest.fn(),
    findMany: jest.fn()
  },
  tiktokEvent: {
    createMany: jest.fn()
  }
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

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should subscribe on init and start timer', async () => {
    await service.onModuleInit();
    expect(mockNatsService.subscribe).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('TTK Collector: NATS subscription initialized')
    );
  });

  it('should clear interval on destroy', () => {
    jest.spyOn(global, 'clearInterval');
    service['batchTimer'] = setInterval(() => {}, 2000);
    service.onModuleDestroy();
    expect(clearInterval).toHaveBeenCalled();
  });

  it('should enqueue event and flush if batch size met', async () => {
    const flushSpy = jest
      .spyOn(service as any, 'flushBatch')
      .mockImplementation(() => Promise.resolve());
    for (let i = 0; i < 2000; i++) {
      service['enqueueEvent']({} as any, { ack: jest.fn() }, 'cid');
    }
    expect(mockMetricsService.incAccepted).toHaveBeenCalledTimes(2000);
    expect(flushSpy).toHaveBeenCalled();
  });

  it('should process a valid batch', async () => {
    const ack = jest.fn();
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

    service['eventQueue'] = [
      { event: mockEvent, msg: { ack }, correlationId: 'cid1' }
    ];

    mockPrismaService.$transaction.mockImplementation((fn) =>
      fn(mockPrismaService)
    );
    mockPrismaService.tiktokUser.upsert.mockResolvedValue({ id: 'db1' });
    mockPrismaService.tiktokEngagementTop.createMany.mockResolvedValue({});
    mockPrismaService.tiktokEngagementTop.findMany.mockResolvedValue([
      { id: 'top1' }
    ]);
    mockPrismaService.tiktokEngagementBottom.createMany.mockResolvedValue({});
    mockPrismaService.tiktokEngagementBottom.findMany.mockResolvedValue([]);
    mockPrismaService.tiktokEvent.createMany.mockResolvedValue({});

    await (service as any).flushBatch();

    expect(mockMetricsService.incProcessed).toHaveBeenCalledWith(1);
    expect(ack).toHaveBeenCalled();
    expect(mockPrismaService.tiktokUser.upsert).toHaveBeenCalled();
    expect(mockPrismaService.tiktokEvent.createMany).toHaveBeenCalled();
  });

  it('should catch error in flushBatch and increase failure metric', async () => {
    const ack = jest.fn();
    const event = {
      eventId: 'event1',
      timestamp: new Date().toISOString(),
      funnelStage: 'top',
      eventType: 'video.view',
      source: 'tiktok',
      data: {
        user: { userId: 'u1', username: 'jane', followers: 100 },
        engagement: {
          watchTime: 123,
          percentageWatched: 90,
          device: 'Android',
          country: 'US',
          videoId: 'vid1'
        }
      }
    } as TiktokEvent;

    service['eventQueue'] = [{ event, msg: { ack }, correlationId: 'cid' }];
    jest
      .spyOn(service as any, 'handleBatch')
      .mockRejectedValue(new Error('fail'));

    await (service as any).flushBatch();

    expect(mockMetricsService.incFailed).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to process batch',
      expect.any(Error)
    );
  });
});
