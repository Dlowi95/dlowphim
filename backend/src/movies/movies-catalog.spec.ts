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
        items: [{ slug: 'phim-a', status: 'completed', episode_current: 'Hoàn tất (12/12)' }],
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
});

