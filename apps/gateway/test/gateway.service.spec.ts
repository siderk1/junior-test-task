import { Test, TestingModule } from '@nestjs/testing';
import { GatewayService } from '../src/gateway/gateway.service';
import { NatsService } from '@repo/nats-wrapper';
import { MetricsService } from '../src/metrics/metrics.service';
import { LoggerService } from '@repo/logger';

const mockNatsService = {
  ensureStream: jest.fn(),
  publish: jest.fn(),
};
const mockMetricsService = {
  incAccepted: jest.fn(),
  incProcessed: jest.fn(),
  incFailed: jest.fn(),
};
const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
};

describe('GatewayService', () => {
  let service: GatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        { provide: NatsService, useValue: mockNatsService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<GatewayService>(GatewayService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should call ensureStream', async () => {
      mockNatsService.ensureStream.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockNatsService.ensureStream).toHaveBeenCalledWith({
        name: 'EVENTS',
        subjects: ['events.*'],
      });
      expect(mockLoggerService.error).not.toHaveBeenCalled();
    });

    it('should log error if ensureStream throws', async () => {
      mockNatsService.ensureStream.mockRejectedValue(new Error('fail!'));

      await service.onModuleInit();

      expect(mockLoggerService.error).toHaveBeenCalledWith(
          'GATEWAY Can not ensure EVENTS stream',
          expect.any(Error)
      );
    });
  });

  describe('publishEvents', () => {
    it('should publish events for facebook and tiktok and increment metrics', async () => {
      mockNatsService.publish.mockResolvedValue(undefined);

      const events = [
        { source: 'facebook', eventId: 'e1' },
        { source: 'tiktok', eventId: 'e2' },
      ];

      await service.publishEvents(events as any, 'corr-123');

      expect(mockMetricsService.incAccepted).toHaveBeenCalledWith(2);
      expect(mockNatsService.publish).toHaveBeenCalledTimes(2);
      expect(mockNatsService.publish).toHaveBeenCalledWith('events.facebook', events[0], 'corr-123');
      expect(mockNatsService.publish).toHaveBeenCalledWith('events.tiktok', events[1], 'corr-123');
      expect(mockMetricsService.incProcessed).toHaveBeenCalledTimes(2);
      expect(mockMetricsService.incFailed).not.toHaveBeenCalled();
      expect(mockLoggerService.error).not.toHaveBeenCalled();
    });

    it('should increment failed and not call publish for unknown source', async () => {
      mockNatsService.publish.mockResolvedValue(undefined);

      const events = [
        { source: 'facebook', eventId: 'e1' },
        { source: 'unknown', eventId: 'e2' },
      ];

      await service.publishEvents(events as any, 'corr-xxx');

      expect(mockNatsService.publish).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.incFailed).toHaveBeenCalledWith(1);
    });

    it('should log error if publish throws', async () => {
      mockNatsService.publish.mockImplementation((subj) => {
        if (subj === 'events.facebook') return Promise.resolve();
        throw new Error('fail-publish');
      });

      const events = [
        { source: 'facebook', eventId: 'a' },
        { source: 'tiktok', eventId: 'b' },
      ];

      await service.publishEvents(events as any, 'corr-qwe');

      expect(mockMetricsService.incProcessed).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.incFailed).toHaveBeenCalledWith(1);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
          'GATEWAY Failed to publish event',
          expect.any(Error),
          expect.objectContaining({
            eventId: 'b',
            correlationId: 'corr-qwe',
          }),
      );
    });
  });
});
