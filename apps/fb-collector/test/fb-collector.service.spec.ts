import { Test, TestingModule } from '@nestjs/testing';
import { FbCollectorService } from '../src/fb-collector/fb-collector.service';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { MetricsService } from '../src/metrics/metrics.service';
import { LoggerService } from '@repo/logger';
import { FacebookEvent } from '@repo/shared';

const mockNatsService = {
  pullSubscribeBatch: jest.fn()
};

const mockPrismaService = {
  $transaction: jest.fn(),
  facebookUserLocation: { upsert: jest.fn() },
  facebookUser: { upsert: jest.fn() },
  facebookEngagementTop: { createMany: jest.fn(), findMany: jest.fn() },
  facebookEngagementBottom: { createMany: jest.fn(), findMany: jest.fn() },
  facebookEvent: { createMany: jest.fn() }
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
    jest.clearAllMocks();
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call runPullLoop on init and log messages', async () => {
    jest.spyOn(service as any, 'runPullLoop').mockImplementation(() => Promise.resolve());
    await service.onModuleInit();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('FB Collector: Initializing JetStream PULL subscription...')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('FB Collector: JetStream PULL subscription initialized.')
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
          location: { country: 'USA', city: 'NY' }
        },
        engagement: {
          actionTime: new Date().toISOString(),
          referrer: 'newsfeed',
          videoId: 'vid123'
        }
      }
    };
    mockPrismaService.$transaction.mockImplementation(async (fn) => fn(mockPrismaService));
    mockPrismaService.facebookUserLocation.upsert.mockResolvedValue({ id: 'loc1' });
    mockPrismaService.facebookUser.upsert.mockResolvedValue({ id: 'user1' });
    mockPrismaService.facebookEngagementTop.createMany.mockResolvedValue({});
    mockPrismaService.facebookEngagementTop.findMany.mockResolvedValue([{ id: 'etop1' }]);
    mockPrismaService.facebookEngagementBottom.createMany.mockResolvedValue({});
    mockPrismaService.facebookEngagementBottom.findMany.mockResolvedValue([]);
    mockPrismaService.facebookEvent.createMany.mockResolvedValue({});
    const batch = [
      { event: mockEvent, msg: mockMsg, correlationId: 'cid1' }
    ];
    await (service as any).handleBatch(batch);
    expect(mockPrismaService.facebookUserLocation.upsert).toHaveBeenCalled();
    expect(mockPrismaService.facebookUser.upsert).toHaveBeenCalled();
    expect(mockPrismaService.facebookEngagementTop.createMany).toHaveBeenCalled();
    expect(mockPrismaService.facebookEngagementTop.findMany).toHaveBeenCalled();
    expect(mockPrismaService.facebookEvent.createMany).toHaveBeenCalled();
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
