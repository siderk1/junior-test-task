import { Test, TestingModule } from '@nestjs/testing';
import { FbCollectorService } from '../src/fb-collector/fb-collector.service';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { MetricsService } from '../src/metrics/metrics.service';
import { LoggerService } from '@repo/logger';
import { FacebookEvent } from '@repo/shared';

jest.useFakeTimers();

const mockNatsService = {
  subscribe: jest.fn()
};

const mockPrismaService = {
  $transaction: jest.fn(),
  facebookUserLocation: {
    upsert: jest.fn()
  },
  facebookUser: {
    upsert: jest.fn()
  },
  facebookEngagementTop: {
    createMany: jest.fn(),
    findMany: jest.fn()
  },
  facebookEngagementBottom: {
    createMany: jest.fn(),
    findMany: jest.fn()
  },
  facebookEvent: {
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

describe('FbCollectorService', () => {
  let service: FbCollectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FbCollectorService,
        { provide: NatsService, useValue: mockNatsService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: LoggerService, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<FbCollectorService>(FbCollectorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should subscribe on init and start timer', async () => {
    await service.onModuleInit();
    expect(mockNatsService.subscribe).toHaveBeenCalledWith(
      'EVENTS_FB',
      'events.facebook',
      'fb-collector',
      expect.any(Function)
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('FB Collector: NATS subscription initialized')
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

    const mockEvent: FacebookEvent = {
      eventId: 'e1',
      timestamp: new Date().toISOString(),
      source: 'facebook',
      funnelStage: 'top',
      eventType: 'ad.view',
      data: {
        user: {
          userId: 'u1',
          name: 'John Doe',
          age: 30,
          gender: 'male',
          location: {
            country: 'USA',
            city: 'NY'
          }
        },
        engagement: {
          actionTime: new Date().toISOString(),
          referrer: 'newsfeed',
          videoId: 'vid123'
        }
      }
    };

    service['eventQueue'] = [
      { event: mockEvent, msg: { ack }, correlationId: 'cid1' }
    ];

    mockPrismaService.$transaction.mockImplementation((fn) =>
      fn(mockPrismaService)
    );

    mockPrismaService.facebookUserLocation.upsert.mockResolvedValue({
      id: 'loc1'
    });
    mockPrismaService.facebookUser.upsert.mockResolvedValue({ id: 'user1' });
    mockPrismaService.facebookEngagementTop.createMany.mockResolvedValue({});
    mockPrismaService.facebookEngagementTop.findMany.mockResolvedValue([
      { id: 'etop1' }
    ]);
    mockPrismaService.facebookEngagementBottom.createMany.mockResolvedValue({});
    mockPrismaService.facebookEngagementBottom.findMany.mockResolvedValue([]);
    mockPrismaService.facebookEvent.createMany.mockResolvedValue({});

    await (service as any).flushBatch();

    expect(mockMetricsService.incProcessed).toHaveBeenCalledWith(1);
    expect(ack).toHaveBeenCalled();

    expect(mockPrismaService.facebookUserLocation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { country_city: { country: 'USA', city: 'NY' } },
        create: { country: 'USA', city: 'NY' }
      })
    );

    expect(mockPrismaService.facebookUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        update: expect.objectContaining({
          name: 'John Doe',
          age: 30,
          gender: 'male',
          locationId: 'loc1'
        }),
        create: expect.objectContaining({
          userId: 'u1',
          name: 'John Doe',
          age: 30,
          gender: 'male',
          locationId: 'loc1'
        })
      })
    );

    expect(mockPrismaService.facebookEvent.createMany).toHaveBeenCalled();
  });

  it('should catch error in flushBatch and increase failure metric', async () => {
    const ack = jest.fn();
    const event: FacebookEvent = {
      eventId: 'e1',
      timestamp: new Date().toISOString(),
      source: 'facebook',
      funnelStage: 'bottom',
      eventType: 'ad.click',
      data: {
        user: {
          userId: 'u2',
          name: 'Jane Doe',
          age: 25,
          gender: 'female',
          location: {
            country: 'USA',
            city: 'LA'
          }
        },
        engagement: {
          adId: 'ad123',
          campaignId: 'camp123',
          clickPosition: 'top_left',
          device: 'mobile',
          browser: 'Chrome',
          purchaseAmount: '100.50'
        }
      }
    };

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
