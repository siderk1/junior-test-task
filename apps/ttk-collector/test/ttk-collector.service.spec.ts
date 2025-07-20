import { Test, TestingModule } from '@nestjs/testing';
import { TtkCollectorService } from '../src/ttk-collector/ttk-collector.service';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { MetricsService } from '../src/metrics/metrics.service';
import { LoggerService } from '@repo/logger';

const mockNatsService = { subscribe: jest.fn() };
const mockPrismaService = {
    tiktokUser: { upsert: jest.fn() },
    tiktokEngagementTop: { create: jest.fn() },
    tiktokEngagementBottom: { create: jest.fn() },
    tiktokEvent: { create: jest.fn() },
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

describe('TtkCollectorService', () => {
    let service: TtkCollectorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TtkCollectorService,
                { provide: NatsService, useValue: mockNatsService },
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: LoggerService, useValue: mockLoggerService },
            ],
        }).compile();

        service = module.get<TtkCollectorService>(TtkCollectorService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleEvent', () => {
        it('should upsert user, create engagementTop and event (top funnel)', async () => {
            const fakeEvent: any = {
                eventId: 'evt1',
                timestamp: Date.now().toString(),
                funnelStage: 'top',
                eventType: 'view',
                data: {
                    user: {
                        userId: 'user1',
                        username: 'nick',
                        followers: 100,
                    },
                    engagement: {
                        watchTime: 100,
                        percentageWatched: 50,
                        device: 'android',
                        country: 'US',
                        videoId: 'vid1',
                    },
                },
            };

            mockPrismaService.tiktokUser.upsert.mockResolvedValue({ id: 1 });
            mockPrismaService.tiktokEngagementTop.create.mockResolvedValue({ id: 2 });
            mockPrismaService.tiktokEvent.create.mockResolvedValue({});

            await service.handleEvent(fakeEvent);

            expect(mockPrismaService.tiktokUser.upsert).toHaveBeenCalled();
            expect(mockPrismaService.tiktokEngagementTop.create).toHaveBeenCalled();
            expect(mockPrismaService.tiktokEngagementBottom.create).not.toHaveBeenCalled();
            expect(mockPrismaService.tiktokEvent.create).toHaveBeenCalled();
        });

        it('should upsert user, create engagementBottom and event (bottom funnel)', async () => {
            const fakeEvent: any = {
                eventId: 'evt2',
                timestamp: Date.now().toString(),
                funnelStage: 'bottom',
                eventType: 'purchase',
                data: {
                    user: {
                        userId: 'user2',
                        username: 'olga',
                        followers: 250,
                    },
                    engagement: {
                        actionTime: Date.now(),
                        profileId: 'p1',
                        purchasedItem: 't-shirt',
                        purchaseAmount: "200",
                    },
                },
            };

            mockPrismaService.tiktokUser.upsert.mockResolvedValue({ id: 10 });
            mockPrismaService.tiktokEngagementBottom.create.mockResolvedValue({ id: 20 });
            mockPrismaService.tiktokEvent.create.mockResolvedValue({});

            await service.handleEvent(fakeEvent);

            expect(mockPrismaService.tiktokUser.upsert).toHaveBeenCalled();
            expect(mockPrismaService.tiktokEngagementBottom.create).toHaveBeenCalled();
            expect(mockPrismaService.tiktokEngagementTop.create).not.toHaveBeenCalled();
            expect(mockPrismaService.tiktokEvent.create).toHaveBeenCalled();
        });
    });
});
