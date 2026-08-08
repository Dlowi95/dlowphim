import { BadRequestException } from '@nestjs/common';
import { MoviesService } from './movies.service';

function createService() {
  return new MoviesService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { getSettings: jest.fn().mockResolvedValue({ tmdbApiKey: 'test-key' }) } as any,
  );
}

describe('MoviesService people discovery', () => {
  afterEach(() => jest.restoreAllMocks());

  it('searches real people on TMDB and caches the result', async () => {
    const service = createService();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        page: 1,
        total_pages: 2,
        total_results: 21,
        results: [{
          id: 10,
          name: 'Nguyễn Văn A',
          original_name: 'Nguyen Van A',
          profile_path: '/actor.jpg',
          known_for_department: 'Acting',
          known_for: [{ title: 'Phim A' }],
        }],
      }),
    } as Response);

    const first = await service.searchPeople('Nguyễn Văn A', 1);
    const second = await service.searchPeople('Nguyễn Văn A', 1);

    expect(first.items[0]).toEqual(expect.objectContaining({
      id: '10',
      profileUrl: 'https://image.tmdb.org/t/p/w342/actor.jpg',
      knownFor: ['Phim A'],
    }));
    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns a stable TMDB filmography page without querying every movie provider', async () => {
    const service = createService();
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 10, name: 'Actor A', profile_path: '/actor.jpg' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cast: [{
            id: 99,
            media_type: 'movie',
            title: 'Tên phim',
            original_title: 'Movie Name',
            release_date: '2025-01-01',
            popularity: 20,
          }],
        }),
      } as Response);
    const providerSpy = jest.spyOn(service, 'fetchOphimProxy');

    const result = await service.getPersonMovies('10', 1);

    expect(result.person.name).toBe('Actor A');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      slug: 'tmdb-99-movie-name',
      name: 'Tên phim',
      year: 2025,
      tmdb: { id: '99', type: 'movie' },
    }));
    expect(providerSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid person ids before calling external services', async () => {
    const service = createService();
    await expect(service.getPersonMovies('abc')).rejects.toBeInstanceOf(BadRequestException);
  });
});
