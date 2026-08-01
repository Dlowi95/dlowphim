import { MoviesService } from './movies.service';

const movieSources = [
  {
    id: 'phimapi',
    name: 'PhimAPI',
    domain: 'https://phimapi.com',
    crawlUrl: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat',
  },
  {
    id: 'ophim',
    name: 'OPhim',
    domain: 'https://ophim1.com',
    crawlUrl: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat',
  },
];

describe('MoviesService dynamic source proxy', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses PhimAPI as active source and OPhim as fallback', async () => {
    const settingsService = {
      getSettings: jest.fn().mockResolvedValue({
        activeMovieSourceId: 'phimapi',
        movieSources,
      }),
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: true }),
    } as Response);

    const service = new MoviesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      settingsService as any,
    );

    const active = await service.fetchOphimProxy('/phim/test-movie');
    const fallback = await service.fetchOphimProxy('/phim/test-movie', 'fallback');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://phimapi.com/phim/test-movie',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://ophim1.com/v1/api/phim/test-movie',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(active._sourceId).toBe('phimapi');
    expect(fallback._sourceId).toBe('ophim');
  });

  it('always routes the upcoming category to OPhim when explicitly requested', async () => {
    const settingsService = {
      getSettings: jest.fn().mockResolvedValue({
        activeMovieSourceId: 'phimapi',
        movieSources,
      }),
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', data: { items: [] } }),
    } as Response);
    const service = new MoviesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      settingsService as any,
    );

    const result = await service.fetchOphimProxy(
      '/v1/api/danh-sach/phim-sap-chieu?page=1',
      'ophim',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ophim1.com/v1/api/danh-sach/phim-sap-chieu?page=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result._sourceId).toBe('ophim');
  });
});
