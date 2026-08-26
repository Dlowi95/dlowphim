import { BannersService } from './banners.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('BannersService — Strict TMDB Logo Policy & Progressive Candidate Expansion', () => {
  it('finds valid candidates located after index 16 through progressive batch expansion', async () => {
    const bannerModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const latestMovies = Array.from({ length: 24 }, (_, index) => ({
      slug: `movie-${index}`,
      name: `Movie ${index}`,
    }));
    const moviesService = {
      fetchOphimProxy: jest.fn().mockImplementation(async (path: string) => {
        if (path.startsWith('/danh-sach/')) {
          return {
            status: true,
            _sourceId: 'phimapi',
            items: latestMovies,
          };
        }
        const slug = path.split('/').pop() as string;
        return {
          status: true,
          movie: {
            slug,
            name: slug,
            category: [],
            episode_current: 'Full',
          },
        };
      }),
      getMovieLogo: jest.fn().mockImplementation(async (slug: string) => {
        const index = Number(slug.split('-').pop());
        // Valid matches are located beyond index 16 (indices 17, 18, 19, 20, 21)
        const hasValidTmdbMatch = index >= 17 && index <= 21;
        return {
          logoUrl: hasValidTmdbMatch ? `https://image.tmdb.org/${slug}-logo.png` : '',
          backdropUrl: hasValidTmdbMatch ? `https://image.tmdb.org/${slug}-backdrop.jpg` : '',
          posterUrl: '',
          tmdbTitle: hasValidTmdbMatch ? `TMDB ${slug}` : '',
          tmdbOriginalTitle: hasValidTmdbMatch ? `Original ${slug}` : '',
        };
      }),
    };

    const service = new BannersService(bannerModel as any, moviesService as any);
    const result = await service.getResolvedHero(false);

    expect(result.slots).toHaveLength(5);
    expect(result.slots.map((slot: any) => slot.movie.slug)).toEqual([
      'movie-17',
      'movie-18',
      'movie-19',
      'movie-20',
      'movie-21',
    ]);
    expect(moviesService.getMovieLogo).toHaveBeenCalledTimes(24);
  });

  it('stops scanning early as soon as 5 valid banners with TMDB logos are found', async () => {
    const bannerModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const latestMovies = Array.from({ length: 24 }, (_, index) => ({
      slug: `movie-${index}`,
      name: `Movie ${index}`,
    }));
    const moviesService = {
      fetchOphimProxy: jest.fn().mockImplementation(async (path: string) => {
        if (path.startsWith('/danh-sach/')) {
          return {
            status: true,
            _sourceId: 'phimapi',
            items: latestMovies,
          };
        }
        const slug = path.split('/').pop() as string;
        return {
          status: true,
          movie: {
            slug,
            name: slug,
            category: [],
            episode_current: 'Full',
          },
        };
      }),
      getMovieLogo: jest.fn().mockImplementation(async (slug: string) => {
        const index = Number(slug.split('-').pop());
        // First 5 candidates in initial batch of 8 already have valid logos
        const hasValidTmdbMatch = index < 5;
        return {
          logoUrl: hasValidTmdbMatch ? `https://image.tmdb.org/${slug}-logo.png` : '',
          backdropUrl: hasValidTmdbMatch ? `https://image.tmdb.org/${slug}-backdrop.jpg` : '',
          posterUrl: '',
          tmdbTitle: hasValidTmdbMatch ? `TMDB ${slug}` : '',
          tmdbOriginalTitle: hasValidTmdbMatch ? `Original ${slug}` : '',
        };
      }),
    };

    const service = new BannersService(bannerModel as any, moviesService as any);
    const result = await service.getResolvedHero(false);

    expect(result.slots).toHaveLength(5);
    expect(result.slots.map((slot: any) => slot.movie.slug)).toEqual([
      'movie-0',
      'movie-1',
      'movie-2',
      'movie-3',
      'movie-4',
    ]);
    // Stopped early after initial batch of 8, did NOT query all 24!
    expect(moviesService.getMovieLogo).toHaveBeenCalledTimes(8);
  });

  it('returns exactly 3 banners when scanning all 24 candidates only yields 3 valid logos', async () => {
    const bannerModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const latestMovies = Array.from({ length: 24 }, (_, index) => ({
      slug: `movie-${index}`,
      name: `Movie ${index}`,
    }));
    const moviesService = {
      fetchOphimProxy: jest.fn().mockImplementation(async (path: string) => {
        if (path.startsWith('/danh-sach/')) {
          return {
            status: true,
            _sourceId: 'phimapi',
            items: latestMovies,
          };
        }
        const slug = path.split('/').pop() as string;
        return {
          status: true,
          movie: {
            slug,
            name: slug,
            category: [],
            episode_current: 'Full',
          },
        };
      }),
      getMovieLogo: jest.fn().mockImplementation(async (slug: string) => {
        const index = Number(slug.split('-').pop());
        // Only 3 candidates in total have valid logos: 2, 7, and 20
        const hasValidTmdbMatch = index === 2 || index === 7 || index === 20;
        return {
          logoUrl: hasValidTmdbMatch ? `https://image.tmdb.org/${slug}-logo.png` : '',
          backdropUrl: hasValidTmdbMatch ? `https://image.tmdb.org/${slug}-backdrop.jpg` : '',
          posterUrl: '',
          tmdbTitle: hasValidTmdbMatch ? `TMDB ${slug}` : '',
          tmdbOriginalTitle: hasValidTmdbMatch ? `Original ${slug}` : '',
        };
      }),
    };

    const service = new BannersService(bannerModel as any, moviesService as any);
    const result = await service.getResolvedHero(false);

    // Strictly returns only 3 valid slots, does NOT relax logo rules to fill 5 slots
    expect(result.slots).toHaveLength(3);
    expect(result.slots.map((slot: any) => slot.movie.slug)).toEqual([
      'movie-2',
      'movie-7',
      'movie-20',
    ]);
    expect(moviesService.getMovieLogo).toHaveBeenCalledTimes(24);
  });

  it('strictly excludes candidates without TMDB logos from public hero slots', async () => {
    const bannerModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const latestMovies = [
      { slug: 'no-logo-1', name: 'No Logo 1' },
      { slug: 'no-logo-2', name: 'No Logo 2' },
      { slug: 'valid-logo-1', name: 'Valid Logo 1' },
    ];
    const moviesService = {
      fetchOphimProxy: jest.fn().mockImplementation(async (path: string) => {
        if (path.startsWith('/danh-sach/')) {
          return { status: true, _sourceId: 'phimapi', items: latestMovies };
        }
        const slug = path.split('/').pop() as string;
        return {
          status: true,
          movie: { slug, name: slug, category: [], episode_current: 'Full' },
        };
      }),
      getMovieLogo: jest.fn().mockImplementation(async (slug: string) => {
        if (slug === 'valid-logo-1') {
          return {
            logoUrl: 'https://image.tmdb.org/valid-logo-1.png',
            backdropUrl: 'https://image.tmdb.org/valid-backdrop-1.jpg',
            posterUrl: '',
            tmdbTitle: 'Valid Logo Title 1',
            tmdbOriginalTitle: 'Valid Original Title 1',
          };
        }
        return {
          logoUrl: '', // Missing logo
          backdropUrl: 'https://image.tmdb.org/backdrop.jpg',
          posterUrl: '',
          tmdbTitle: 'No Logo Title',
          tmdbOriginalTitle: 'No Logo Original',
        };
      }),
    };

    const service = new BannersService(bannerModel as any, moviesService as any);
    const result = await service.getResolvedHero(false);

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].movie.slug).toBe('valid-logo-1');
    expect(result.slots.some((slot: any) => slot.movie.slug === 'no-logo-1')).toBe(false);
    expect(result.slots.some((slot: any) => slot.movie.slug === 'no-logo-2')).toBe(false);
  });

  it('allows admin to manually pin anime with valid TMDB logo and backdrop', async () => {
    const adminAnimeBanner = [
      {
        _id: 'anime-banner',
        title: 'Your Name (Admin Pinned)',
        originName: 'Kimi no Na wa',
        movieSlug: 'your-name',
        imageUrl: 'https://cdn.example.com/your-name-backdrop.jpg',
        description: 'Anime ghim thủ công',
        order: 1,
        isActive: true,
      },
    ];
    const bannerModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(adminAnimeBanner),
        }),
      }),
    };

    const moviesService = {
      fetchOphimProxy: jest.fn().mockImplementation(async (path: string) => {
        if (path.startsWith('/danh-sach/')) {
          return { status: true, items: [] };
        }
        return {
          status: true,
          movie: {
            slug: 'your-name',
            name: 'Your Name',
            type: 'hoathinh',
            category: [{ slug: 'hoat-hinh' }],
          },
        };
      }),
      getMovieLogo: jest.fn().mockResolvedValue({
        logoUrl: 'https://image.tmdb.org/your-name-logo.png',
        backdropUrl: 'https://image.tmdb.org/your-name-backdrop.jpg',
        posterUrl: '',
        tmdbTitle: 'Your Name',
        tmdbOriginalTitle: 'Kimi no Na wa',
      }),
    };

    const service = new BannersService(bannerModel as any, moviesService as any);
    const result = await service.getResolvedHero(false);

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].movie.slug).toBe('your-name');
    expect(result.slots[0].isCustomBanner).toBe(true);
    expect(result.slots[0].tmdbData?.logoUrl).toBe('https://image.tmdb.org/your-name-logo.png');
  });

  it('validates movieSlug existence and rejects non-existent slugs', async () => {
    const BannerModel: any = jest.fn();
    BannerModel.exists = jest.fn().mockResolvedValue(null);
    const moviesService = {
      fetchOphimProxy: jest.fn().mockResolvedValue({ status: false, data: null }),
      getCustomMovieBySlug: jest.fn().mockResolvedValue(null),
    };
    const service = new BannersService(BannerModel, moviesService as any);

    await expect(
      service.create({
        title: 'Phim ảo',
        movieSlug: 'phim-khong-ton-tai',
        imageUrl: 'https://image.tmdb.org/banner.jpg',
        order: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces effective duplicate active slug checks in all 3 update scenarios', async () => {
    const existingBanner = {
      _id: new Types.ObjectId('65d000000000000000000001'),
      title: 'Banner gốc',
      movieSlug: 'slug-a',
      order: 1,
      isActive: false,
    };

    const BannerModel: any = jest.fn();
    BannerModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(existingBanner),
    });
    BannerModel.exists = jest.fn().mockImplementation(async (query: any) => {
      if (query.movieSlug === 'slug-b' && query.isActive) return { _id: 'other-banner' };
      if (query.movieSlug === 'slug-a' && query.isActive) return { _id: 'active-slug-a-banner' };
      return null;
    });

    const moviesService = {
      fetchOphimProxy: jest.fn().mockResolvedValue({
        status: true,
        movie: { name: 'Test Movie', slug: 'slug-b' },
      }),
    };
    const service = new BannersService(BannerModel, moviesService as any);

    // a) Change movieSlug of an active banner to an already active slug
    existingBanner.isActive = true;
    await expect(
      service.update('65d000000000000000000001', {
        movieSlug: 'slug-b',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // b) Toggle isActive from false to true without sending movieSlug when existing slug is already active
    existingBanner.isActive = false;
    await expect(
      service.update('65d000000000000000000001', {
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // c) Update both movieSlug and isActive concurrently to an active duplicate
    await expect(
      service.update('65d000000000000000000001', {
        movieSlug: 'slug-b',
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('handles Mongo duplicate key 11000 on concurrent race and throws ConflictException', async () => {
    const save = jest.fn().mockRejectedValue({ code: 11000 });
    const BannerModel: any = jest.fn(function (this: any, payload: any) {
      Object.assign(this, payload);
      this.save = save;
    });
    BannerModel.exists = jest.fn().mockResolvedValue(null);

    const moviesService = {
      fetchOphimProxy: jest.fn().mockResolvedValue({
        status: true,
        movie: { name: 'Race Movie', slug: 'race-movie' },
      }),
    };
    const service = new BannersService(BannerModel, moviesService as any);

    await expect(
      service.create({
        title: 'Banner cạnh tranh',
        movieSlug: 'race-movie',
        imageUrl: 'https://image.tmdb.org/banner.jpg',
        order: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
