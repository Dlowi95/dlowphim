import { MoviesService } from './movies.service';

function createService(cached: any = null) {
  const movieLogoModel = {
    findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(cached) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
  const settingsService = {
    getSettings: jest.fn().mockResolvedValue({ tmdbApiKey: 'test-key' }),
  };
  return {
    service: new MoviesService(
      {} as any,
      {} as any,
      movieLogoModel as any,
      {} as any,
      settingsService as any,
    ),
    movieLogoModel,
  };
}

describe('MoviesService release schedule', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses a fresh cached TMDB schedule without another network request', async () => {
    const { service } = createService({
      tmdbStatus: 'Returning Series',
      tmdbType: 'tv',
      nextEpisodeToAir: { episodeNumber: 9, airDate: '2026-08-08' },
      scheduleUpdatedAt: new Date(),
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.getMovieSchedule({
      slug: 'series-a',
      movieType: 'series',
      episodeCurrent: 'Tập 8',
      episodeTotal: '12',
    });

    expect(result.state).toBe('airing');
    expect(result.nextEpisode.episodeNumber).toBe(9);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the confirmed next episode from TMDB and caches it', async () => {
    const { service, movieLogoModel } = createService({
      tmdbId: '123',
      tmdbType: 'tv',
      scheduleUpdatedAt: null,
    });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 123,
        status: 'Returning Series',
        first_air_date: '2026-01-10',
        next_episode_to_air: {
          episode_number: 9,
          season_number: 1,
          name: 'Tập mới',
          air_date: '2026-08-08',
        },
      }),
    } as Response);

    const result = await service.getMovieSchedule({
      slug: 'series-a',
      movieType: 'series',
      episodeCurrent: 'Tập 8',
      episodeTotal: '12',
    });

    expect(result).toEqual(expect.objectContaining({
      state: 'airing',
      source: 'tmdb',
      releaseDate: '2026-01-10',
      nextEpisode: expect.objectContaining({ episodeNumber: 9, airDate: '2026-08-08' }),
    }));
    expect(movieLogoModel.findOneAndUpdate).toHaveBeenCalledWith(
      { slug: 'series-a' },
      expect.objectContaining({ tmdbStatus: 'Returning Series' }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('falls back to provider completion state when TMDB is unavailable', async () => {
    const { service } = createService(null);
    jest.spyOn(service, 'getMovieLogo').mockResolvedValue({ tmdbId: '', tmdbType: 'movie' });

    const result = await service.getMovieSchedule({
      slug: 'finished-movie',
      movieType: 'single',
      episodeCurrent: 'Full',
      episodeTotal: '1',
    });

    expect(result).toEqual(expect.objectContaining({ state: 'completed', source: 'provider' }));
  });

  it('keeps a movie upcoming when its regional release date is still in the future', async () => {
    const { service } = createService({
      tmdbStatus: 'Released',
      tmdbType: 'movie',
      releaseDate: '2099-12-31',
      scheduleUpdatedAt: new Date(),
    });

    const result = await service.getMovieSchedule({
      slug: 'future-movie',
      movieType: 'single',
      movieStatus: 'trailer',
      episodeCurrent: 'Trailer',
    });

    expect(result).toEqual(expect.objectContaining({ state: 'upcoming', releaseDate: '2099-12-31' }));
  });
});
