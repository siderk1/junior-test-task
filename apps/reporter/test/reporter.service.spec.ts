import { ReporterService } from '../src/reporter/reporter.service';

const mockPrismaService = {
  facebookEvent: {
    groupBy: jest.fn(),
    findMany: jest.fn()
  },
  tiktokEvent: {
    groupBy: jest.fn(),
    findMany: jest.fn()
  },
  facebookUser: {
    groupBy: jest.fn()
  },
  facebookUserLocation: {
    findMany: jest.fn()
  },
  tiktokUser: {
    findMany: jest.fn()
  }
};

const mockMetricsService = {
  startReportTimer: jest.fn(() => () => {})
};

describe('ReporterService', () => {
  let service: ReporterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReporterService(
      mockPrismaService as any,
      mockMetricsService as any
    );
  });

  it('getDemographicsReport: returns a correct result', async () => {
    mockPrismaService.facebookUser.groupBy.mockResolvedValue([
      { gender: 'male', _count: { _all: 2 }, _avg: { age: 25 } },
      { gender: 'female', _count: { _all: 3 }, _avg: { age: 29 } }
    ]);
    mockPrismaService.facebookUserLocation.findMany.mockResolvedValue([
      { country: 'UA', city: 'Kyiv', _count: { users: 3 } },
      { country: 'UA', city: 'Lviv', _count: { users: 2 } }
    ]);

    mockPrismaService.tiktokUser.findMany.mockResolvedValue([
      { followers: 10 },
      { followers: 200 },
      { followers: 1500 },
      { followers: 11000 }
    ]);

    const res = await service.getDemographicsReport({});

    expect(res.facebook).toBeDefined();
    expect(res.tiktok).toBeDefined();

    expect(res.facebook!.byGender).toEqual([
      { gender: 'male', count: 2, avgAge: 25 },
      { gender: 'female', count: 3, avgAge: 29 }
    ]);
    expect(res.facebook!.topCities).toHaveLength(2);

    expect(res.tiktok!.avgFollowers).toBeCloseTo((10 + 200 + 1500 + 11000) / 4);
    expect(res.tiktok!.byFollowersRange).toEqual([
      { range: '<100', count: 1 },
      { range: '100-999', count: 1 },
      { range: '1000-9999', count: 1 },
      { range: '10k+', count: 1 }
    ]);
  });
});
