import { BadRequestException } from '@nestjs/common';
import { MoviesService } from './movies.service';

function createService() {
  const settingsService = {
    getSettings: jest.fn().mockResolvedValue({ tmdbApiKey: 'test-key' }),
  };
  return new MoviesService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    settingsService as any,
  );
}

describe('MoviesService upcoming movies', () => {
  afterEach(() => jest.restoreAllMocks());

  it('maps the TMDB upcoming feed and reuses its cache', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        page: 1,
        total_pages: 4,
        total_results: 80,
        results: [{
          id: 42,
          title: 'Phim Sắp Chiếu',
          original_title: 'Coming Soon',
          poster_path: '/poster.jpg',
          backdrop_path: '/backdrop.jpg',
          release_date: '2026-10-02',
          vote_average: 7.4,
        }],
      }),
    } as Response);

    const first = await service.getUpcomingMovies(1);
    const second = await service.getUpcomingMovies(1);

    expect(first).toEqual(expect.objectContaining({
      status: true,
      source: 'tmdb',
      totalPages: 4,
      items: [expect.objectContaining({
        slug: 'tmdb-42-coming-soon',
        release_date: '2026-10-02',
        thumb_url: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      })],
    }));
    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('builds a trailer-only detail when no provider has a playable copy', async () => {
    const service = createService();
    jest.spyOn(service, 'resolveMovieDetailAcrossSources').mockResolvedValue({ episodes: [] });
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => String(url).includes('/videos?') ? ({ results: [] }) : ({
        id: 77,
        title: 'Tên Việt',
        original_title: 'Original Name',
        overview: 'Nội dung',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        release_date: '2026-12-18',
        runtime: 123,
        vote_average: 8.1,
        genres: [{ name: 'Phiêu Lưu' }],
        production_countries: [{ name: 'Nhật Bản', iso_3166_1: 'JP' }],
        videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abc123' }] },
      }),
    } as Response));

    const result = await service.getUpcomingMovieDetail('77');

    expect(result).toEqual(expect.objectContaining({
      status: true,
      source: 'tmdb',
      episodes: [],
      movie: expect.objectContaining({
        slug: 'tmdb-77-original-name',
        status: 'trailer',
        release_date: '2026-12-18',
        trailer_url: 'https://www.youtube.com/embed/abc123',
      }),
    }));
  });

  it('rejects malformed TMDB ids', async () => {
    const service = createService();
    await expect(service.getUpcomingMovieDetail('abc')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores and removes a reminder on the signed-in user', async () => {
    const save = jest.fn().mockResolvedValue({});
    const user: any = { upcomingReminders: [], save };
    const userModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(user) }),
    };
    const service = new MoviesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getSettings: jest.fn() } as any,
      userModel as any,
      undefined,
    );

    const added = await service.toggleUpcomingReminder('user-1', '77', {
      slug: 'tmdb-77-original-name',
      movieName: 'Tên Việt',
      releaseDate: '2026-12-18',
    });
    const removed = await service.toggleUpcomingReminder('user-1', '77', {
      movieName: 'Tên Việt',
    });

    expect(added).toEqual({ active: true });
    expect(removed).toEqual({ active: false });
    expect(user.upcomingReminders).toHaveLength(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('notifies once for release day and once when a playable source appears', async () => {
    const users = [{
      _id: '507f1f77bcf86cd799439011',
      upcomingReminders: [{
        tmdbId: '77',
        slug: 'tmdb-77-original-name',
        movieName: 'Tên Việt',
        originName: 'Original Name',
        releaseDate: '2020-01-01',
      }],
    }];
    const updateOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });
    const userModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(users) }),
          }),
        }),
      }),
      updateOne,
    };
    const notificationsService = { createUserNotification: jest.fn().mockResolvedValue({}) };
    const service = new MoviesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getSettings: jest.fn() } as any,
      userModel as any,
      notificationsService as any,
    );
    jest.spyOn(service, 'resolveMovieDetailAcrossSources').mockResolvedValue({
      _resolvedSlug: 'ten-viet',
      episodes: [{ server_data: [{ link_m3u8: 'https://cdn.test/index.m3u8' }] }],
    });

    const result = await service.scanUpcomingReminders();

    expect(result).toEqual({ checked: 1, available: 1 });
    expect(notificationsService.createUserNotification).toHaveBeenCalledTimes(2);
    expect(notificationsService.createUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'movie_available', link: '/movie/ten-viet' }),
    );
  });
});
