import { PlaybackHealthService } from './playback-health.service';

describe('PlaybackHealthService', () => {
  let service: PlaybackHealthService;

  beforeEach(() => {
    service = new PlaybackHealthService();
  });

  it('aggregates playback events without storing individual sessions', async () => {
    service.recordBatch([
      { origin: 'https://cdn.example.com/a/index.m3u8', kind: 'start', durationMs: 800 },
      { origin: 'https://cdn.example.com/b/index.m3u8', kind: 'buffer', durationMs: 1200 },
      { origin: 'https://cdn.example.com/c/index.m3u8', kind: 'success' },
    ], 'viewer-1');

    expect(await service.getReputation()).toEqual([
      expect.objectContaining({
        origin: 'https://cdn.example.com',
        samples: 1,
        blockedUntil: 0,
      }),
    ]);
  });

  it('temporarily blocks a failing CDN only after three distinct reporters', async () => {
    for (const reporter of ['viewer-1', 'viewer-2', 'viewer-3']) {
      service.recordBatch([
        {
          origin: 'https://bad-cdn.example.com/video/index.m3u8',
          kind: 'failure',
          failureType: 'networkError:manifestLoadError',
        },
      ], reporter);
    }

    const reputation = await service.getReputation();
    expect(reputation[0]).toEqual(
      expect.objectContaining({
        origin: 'https://bad-cdn.example.com',
        blockedUntil: expect.any(Number),
      }),
    );
    expect(reputation[0].blockedUntil).toBeGreaterThan(Date.now());
  });

  it('ignores invalid origins and limits each batch', async () => {
    const events = Array.from({ length: 30 }, (_, index) => ({
      origin: index === 0 ? 'not-a-url' : `https://cdn-${index}.example.com/video.m3u8`,
      kind: 'success' as const,
    }));

    expect(service.recordBatch(events, 'viewer-1')).toEqual({ accepted: 19, rejected: 11 });
    expect(await service.getReputation()).toHaveLength(19);
  });

  it('uses starts as attempts so sampled successes do not inflate the failure rate', async () => {
    service.recordBatch([
      ...Array.from({ length: 4 }, () => ({
        origin: 'https://sampled.example.com/video.m3u8',
        kind: 'start' as const,
        durationMs: 900,
      })),
      {
        origin: 'https://sampled.example.com/video.m3u8',
        kind: 'failure' as const,
        failureType: 'mediaError',
      },
    ], 'viewer-1');

    const dashboard = await service.getAdminDashboard();
    expect(dashboard.origins[0].failureRate).toBe(25);
  });

  it('bounds telemetry writes from one reporter', async () => {
    const events = Array.from({ length: 20 }, () => ({
      origin: 'https://rate-limit.example.com/video.m3u8',
      kind: 'buffer' as const,
      durationMs: 500,
    }));

    expect(service.recordBatch(events, 'viewer-1').accepted).toBe(20);
    expect(service.recordBatch(events, 'viewer-1').accepted).toBe(20);
    expect(service.recordBatch(events, 'viewer-1').accepted).toBe(20);
    expect(service.recordBatch(events, 'viewer-1')).toEqual({ accepted: 0, rejected: 20 });
  });

  it('builds a bounded admin summary with degraded sources first', async () => {
    service.recordBatch([
      { origin: 'https://healthy.example.com/video.m3u8', kind: 'success' },
      { origin: 'https://slow.example.com/video.m3u8', kind: 'buffer', durationMs: 4000 },
      { origin: 'https://slow.example.com/video.m3u8', kind: 'failure', failureType: 'mediaError' },
    ], 'viewer-1');

    const dashboard = await service.getAdminDashboard();
    expect(dashboard.summary.activeOrigins).toBe(2);
    expect(dashboard.summary.degradedOrigins).toBe(1);
    expect(dashboard.origins[0]).toEqual(expect.objectContaining({
      origin: 'https://slow.example.com',
      status: 'degraded',
      averageBufferMs: 4000,
    }));
  });
});
