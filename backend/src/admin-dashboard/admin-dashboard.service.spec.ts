import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  it('returns one consistent dashboard snapshot with real report and health totals', async () => {
    const recentReports = [{ _id: 'report-1', status: 'pending' }];
    const userModel = {
      countDocuments: jest.fn().mockResolvedValue(6),
      aggregate: jest.fn().mockResolvedValue([{ total: 24 }]),
    };
    const commentModel = { countDocuments: jest.fn().mockResolvedValue(23) };
    const commentReportModel = { countDocuments: jest.fn().mockResolvedValue(2) };
    const movieReportModel = {
      countDocuments: jest.fn().mockResolvedValue(3),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(recentReports),
          }),
        }),
      }),
    };
    const gateway = {
      isReady: jest.fn().mockReturnValue(true),
      getConnectedClients: jest.fn().mockReturnValue(4),
    };
    const playbackHealth = {
      getAdminDashboard: jest.fn().mockResolvedValue({
        summary: {
          activeOrigins: 2,
          healthyOrigins: 1,
          degradedOrigins: 1,
          blockedOrigins: 0,
          totalStarts: 10,
          totalFailures: 2,
          totalBuffers: 1,
        },
        origins: [
          { origin: 'https://slow.example.com', status: 'degraded' },
          { origin: 'https://fast.example.com', status: 'healthy' },
        ],
      }),
    };
    const systemSettings = { getSettings: jest.fn() };
    const service = new AdminDashboardService(
      userModel as any,
      commentModel as any,
      commentReportModel as any,
      movieReportModel as any,
      { readyState: 1 } as any,
      gateway as any,
      playbackHealth as any,
      systemSettings as any,
    );

    jest.spyOn(service as any, 'countDocumentPeriods')
      .mockResolvedValueOnce({ current: 4, previous: 2 })
      .mockResolvedValueOnce({ current: 3, previous: 6 });
    jest.spyOn(service as any, 'countWatchPeriods')
      .mockResolvedValue({ current: 8, previous: 4 });
    jest.spyOn(service as any, 'aggregateMonths').mockResolvedValue([]);
    jest.spyOn(service as any, 'aggregateWatchMonths').mockResolvedValue([]);
    jest.spyOn(service as any, 'getMovieSourceHealth').mockResolvedValue([
      { id: 'phimapi', active: true, status: 'healthy', latencyMs: 120 },
      { id: 'ophim', active: false, status: 'degraded', latencyMs: 2800 },
    ]);

    const dashboard = await service.getDashboard();

    expect(dashboard.totals).toEqual({
      users: 6,
      views: 24,
      comments: 23,
      activeReports: 5,
    });
    expect(dashboard.trends.users.percent).toBe(100);
    expect(dashboard.trends.comments.percent).toBe(-50);
    expect(dashboard.chartData).toHaveLength(6);
    expect(dashboard.moderationQueue).toEqual({
      total: 5,
      commentReports: 2,
      movieReports: 3,
      latestMovieReports: recentReports,
    });
    expect(dashboard.movieSources).toHaveLength(2);
    expect(dashboard.playbackHealth.problems).toEqual([
      expect.objectContaining({ origin: 'https://slow.example.com' }),
    ]);
    expect(dashboard.systemStatus).toEqual({
      api: true,
      database: true,
      socket: true,
      socketClients: 4,
    });
  });

  it('checks configured movie sources once and reuses the short health cache', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: { cancel: jest.fn().mockResolvedValue(undefined) },
    } as any);
    const settings = {
      activeMovieSourceId: 'phimapi',
      movieSources: [
        { id: 'phimapi', name: 'PhimAPI', domain: 'https://phimapi.com', crawlUrl: 'https://phimapi.com/list' },
        { id: 'ophim', name: 'OPhim', domain: 'https://ophim1.com', crawlUrl: 'https://ophim1.com/list' },
      ],
    };
    const service = new AdminDashboardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getSettings: jest.fn().mockResolvedValue(settings) } as any,
    );

    const first = await (service as any).getMovieSourceHealth();
    const second = await (service as any).getMovieSourceHealth();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
    expect(first).toEqual([
      expect.objectContaining({ id: 'phimapi', active: true, status: 'healthy' }),
      expect.objectContaining({ id: 'ophim', active: false, status: 'healthy' }),
    ]);
    fetchMock.mockRestore();
  });
});
