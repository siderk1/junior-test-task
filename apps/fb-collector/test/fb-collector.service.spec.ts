import { Test, TestingModule } from '@nestjs/testing';
import { FbCollectorService } from '../src/fb-collector/fb-collector.service';
import { NatsService } from '@repo/nats-wrapper';
import { PrismaService } from '@repo/prisma';
import { MetricsService } from '../src/metrics/metrics.service';
import { LoggerService } from '@repo/logger';

const mockNatsService = { subscribe: jest.fn() };
const mockPrismaService = {
    facebookUserLocation: { upsert: jest.fn() },
    facebookUser: { upsert: jest.fn() },
    facebookEngagementTop: { create: jest.fn() },
    facebookEngagementBottom: { create: jest.fn() },
    facebookEvent: { create: jest.fn() },
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

describe('FbCollectorService', () => {
    let service: FbCollectorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FbCollectorService,
                { provide: NatsService, useValue: mockNatsService },
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: LoggerService, useValue: mockLoggerService },
            ],
        }).compile();

        service = module.get<FbCollectorService>(FbCollectorService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleEvent', () => {
        it('should upsert location, user, and create event (top funnel)', async () => {
            const fakeEvent: any = {
                eventId: 'evt1',
                timestamp: Date.now().toString(),
                funnelStage: 'top',
                eventType: 'ad.view',
                data: {
                    user: {
                        userId: 'user1',
                        name: 'Nick',
                        age: 22,
                        gender: 'male',
                        location: { country: 'UA', city: 'Kyiv' },
                    },
                    engagement: { actionTime: Date.now(), referrer: 'newsfeed', videoId: null },
                },
            };

            mockPrismaService.facebookUserLocation.upsert.mockResolvedValue({ id: 1 });
            mockPrismaService.facebookUser.upsert.mockResolvedValue({ id: 2 });
            mockPrismaService.facebookEngagementTop.create.mockResolvedValue({ id: 3 });
            mockPrismaService.facebookEvent.create.mockResolvedValue({});

            await service.handleEvent(fakeEvent);

            expect(mockPrismaService.facebookUserLocation.upsert).toHaveBeenCalled();
            expect(mockPrismaService.facebookUser.upsert).toHaveBeenCalled();
            expect(mockPrismaService.facebookEngagementTop.create).toHaveBeenCalled();
            expect(mockPrismaService.facebookEvent.create).toHaveBeenCalled();
        });

        it('should correctly handle bottom funnel', async () => {
            const fakeEvent: any = {
                eventId: 'evt2',
                timestamp: Date.now().toString(),
                funnelStage: 'bottom',
                eventType: 'checkout.complete',
                data: {
                    user: {
                        userId: 'user2',
                        name: 'Olga',
                        age: 28,
                        gender: 'female',
                        location: { country: 'UA', city: 'Lviv' },
                    },
                    engagement: { adId: 'ad123', campaignId: 'c123', purchaseAmount: "99" },
                },
            };
            mockPrismaService.facebookUserLocation.upsert.mockResolvedValue({ id: 10 });
            mockPrismaService.facebookUser.upsert.mockResolvedValue({ id: 11 });
            mockPrismaService.facebookEngagementBottom.create.mockResolvedValue({ id: 12 });
            mockPrismaService.facebookEvent.create.mockResolvedValue({});

            await service.handleEvent(fakeEvent);

            expect(mockPrismaService.facebookEngagementBottom.create).toHaveBeenCalled();
            expect(mockPrismaService.facebookEngagementTop.create).not.toHaveBeenCalled();
            expect(mockPrismaService.facebookEvent.create).toHaveBeenCalled();
        });
    });
});
