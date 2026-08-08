import { MoviesService } from './movies.service';

function createService() {
  return new MoviesService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { getSettings: jest.fn() } as any,
  );
}

describe('MoviesService catalog', () => {
  it('normalizes filters, keeps pagination and caches identical lists', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(service, 'fetchOphimProxy').mockResolvedValue({
      status: 'success',
      _sourceId: 'phimapi',
      data: {
        titlePage: 'Phim bộ',
        APP_DOMAIN_CDN_IMAGE: 'https://phimimg.com',
        items: [{ slug: 'phim-a', name: 'Phim A', thumb_url: 'upload/phim-a.jpg', status: 'completed', episode_current: 'Hoàn tất (12/12)' }],
        params: {
          pagination: { currentPage: 2, totalItems: 240, totalItemsPerPage: 24 },
        },
      },
    });

    const input = {
      type: 'phim-bo',
      page: 2,
      limit: 24,
      year: '2025',
      genre: 'hanh-dong',
      status: 'completed',
      sort: 'year-desc',
    };
    const first = await service.getMovieCatalog(input);
    const second = await service.getMovieCatalog(input);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/api/danh-sach/phim-bo?'),
      'active',
    );
    expect(fetchSpy.mock.calls[0][0]).toContain('category=hanh-dong');
    expect(fetchSpy.mock.calls[0][0]).toContain('status=completed');
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toEqual(expect.objectContaining({
      name: 'Phim A',
      thumb_url: 'https://phimimg.com/upload/phim-a.jpg',
      quality: 'HD',
      lang: 'Vietsub',
    }));
    expect(first.pagination.totalItems).toBe(240);
    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('drops unsupported filter values before calling the provider', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(service, 'fetchOphimProxy').mockResolvedValue({
      status: true,
      data: { items: [] },
    });

    const result = await service.getMovieCatalog({
      type: 'invalid',
      page: -20,
      limit: 999,
      year: '1800',
      genre: '../bad',
      status: 'deleted',
      sort: 'random',
    });

    const path = fetchSpy.mock.calls[0][0];
    expect(path).toContain('/phim-le?');
    expect(path).toContain('page=1');
    expect(path).toContain('limit=48');
    expect(path).not.toContain('category=');
    expect(path).not.toContain('status=');
    expect(result.filters).toEqual(expect.objectContaining({
      type: 'phim-le',
      year: '',
      genre: '',
      status: '',
      sort: 'updated',
    }));
  });

  it('falls back and normalizes a flat OPhim catalog when the active source fails', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(service, 'fetchOphimProxy')
      .mockResolvedValueOnce({ status: false, _sourceId: 'phimapi', message: 'timeout' })
      .mockResolvedValueOnce({
        status: true,
        _sourceId: 'ophim',
        items: [{
          id: 'legacy-id',
          slug: 'phim-du-phong',
          name: 'Phim Dự Phòng',
          original_name: 'Fallback Movie',
          thumb_url: 'phim-du-phong-thumb.jpg',
          poster_url: 'phim-du-phong-poster.jpg',
          categories: [{ name: 'Hành Động', slug: 'hanh-dong' }],
        }],
        pagination: { current_page: 1, total: 1, limit: 24 },
      });

    const result = await service.getMovieCatalog({ type: 'phim-le', page: 1 });

    expect(fetchSpy).toHaveBeenNthCalledWith(1, expect.any(String), 'active');
    expect(fetchSpy).toHaveBeenNthCalledWith(2, expect.any(String), 'fallback');
    expect(result.availability).toBe('ready');
    expect(result.fallback).toEqual({ used: true, reason: 'source-error' });
    expect(result.items[0]).toEqual(expect.objectContaining({
      _id: 'legacy-id',
      origin_name: 'Fallback Movie',
      thumb_url: 'https://img.ophim.live/uploads/movies/phim-du-phong-thumb.jpg',
      poster_url: 'https://img.ophim.live/uploads/movies/phim-du-phong-poster.jpg',
    }));
    expect(result.pagination).toEqual({ currentPage: 1, totalItems: 1, totalItemsPerPage: 24, totalPages: 1 });
  });

  it('returns a short-lived empty state only after checking both sources', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(service, 'fetchOphimProxy')
      .mockResolvedValueOnce({ status: true, _sourceId: 'phimapi', data: { items: [] } })
      .mockResolvedValueOnce({ status: true, _sourceId: 'ophim', items: [] });

    const result = await service.getMovieCatalog({ type: 'phim-bo', page: 1 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.availability).toBe('empty');
    expect(result.items).toEqual([]);
    expect(result.cache.ttlSeconds).toBe(60);
  });

  it('reports an unavailable catalog when both sources fail', async () => {
    const service = createService();
    jest.spyOn(service, 'fetchOphimProxy')
      .mockResolvedValueOnce({ status: false, _sourceId: 'phimapi' })
      .mockRejectedValueOnce(new Error('network down'));

    await expect(service.getMovieCatalog({ type: 'phim-le', page: 1 }))
      .rejects.toThrow('Cả hai máy chủ phim đang tạm gián đoạn');
  });

  it('opens the active-source circuit after repeated failures and skips its timeout', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(service, 'fetchOphimProxy').mockImplementation(async (_path, preference) => {
      if (preference === 'active') return { status: false, _sourceId: 'phimapi' };
      return {
        status: true,
        _sourceId: 'ophim',
        items: [{ slug: `fallback-${fetchSpy.mock.calls.length}`, name: 'Fallback Movie' }],
      };
    });

    await service.getMovieDiscovery({ kind: 'country', slug: 'han-quoc', page: 1 });
    await service.getMovieDiscovery({ kind: 'country', slug: 'han-quoc', page: 2 });
    await service.getMovieDiscovery({ kind: 'country', slug: 'han-quoc', page: 3 });

    const activeCalls = fetchSpy.mock.calls.filter((call) => call[1] === 'active');
    const fallbackCalls = fetchSpy.mock.calls.filter((call) => call[1] === 'fallback');
    expect(activeCalls).toHaveLength(2);
    expect(fallbackCalls).toHaveLength(3);
  });

  it('does not open a global circuit for an unsupported 404 path', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(service, 'fetchOphimProxy').mockImplementation(async (_path, preference) => {
      if (preference === 'active') return { status: false, _sourceId: 'phimapi', message: 'Nguồn phản hồi lỗi 404' };
      return { status: true, _sourceId: 'ophim', items: [{ slug: 'fallback-movie', name: 'Fallback Movie' }] };
    });

    await service.getMovieDiscovery({ kind: 'genre', slug: 'hanh-dong', page: 1 });
    await service.getMovieDiscovery({ kind: 'genre', slug: 'hanh-dong', page: 2 });
    await service.getMovieDiscovery({ kind: 'genre', slug: 'hanh-dong', page: 3 });

    expect(fetchSpy.mock.calls.filter((call) => call[1] === 'active')).toHaveLength(3);
  });

  it('serves the last successful discovery result when both sources become unavailable', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(service, 'fetchOphimProxy').mockResolvedValue({
      status: true,
      _sourceId: 'phimapi',
      data: { items: [{ slug: 'phim-gan-nhat', name: 'Phim Gần Nhất' }] },
    });

    const first = await service.getMovieDiscovery({ kind: 'genre', slug: 'hanh-dong', page: 1 });
    expect(first.stale.used).toBe(false);
    (service as any).catalogCache.clear();
    fetchSpy.mockReset();
    fetchSpy
      .mockResolvedValueOnce({ status: false, _sourceId: 'phimapi' })
      .mockRejectedValueOnce(new Error('fallback down'));

    const stale = await service.getMovieDiscovery({ kind: 'genre', slug: 'hanh-dong', page: 1 });

    expect(stale.items[0].slug).toBe('phim-gan-nhat');
    expect(stale.stale.used).toBe(true);
    expect(stale.stale.savedAt).toEqual(expect.any(String));
  });

  it('exposes fallback and circuit metrics for the admin source-health view', async () => {
    const service = createService();
    jest.spyOn(service, 'fetchOphimProxy').mockImplementation(async (_path, preference) => {
      if (preference === 'active') return { status: false, _sourceId: 'phimapi', message: 'timeout' };
      return { status: true, _sourceId: 'ophim', items: [{ slug: 'fallback-movie', name: 'Fallback Movie' }] };
    });

    await service.getMovieDiscovery({ kind: 'genre', slug: 'hanh-dong', page: 1 });
    await service.getMovieDiscovery({ kind: 'genre', slug: 'tam-ly', page: 1 });

    const health = await service.getDiscoveryHealth();
    expect(health.storageScope).toBe('instance');
    expect(health.summary).toEqual(expect.objectContaining({
      resolutions: 2,
      fallbackResponses: 2,
      fallbackRate: 100,
      circuitTrips: 1,
      openCircuits: 1,
    }));
    expect(health.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'phimapi', failures: 2, circuitOpen: true }),
    ]));
  });
});
