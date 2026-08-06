import { BannersService } from './banners.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('BannersService resolved Hero batch', () => {
  it('merges admin slots and applies the same TMDB filters server-side', async () => {
    const activeBanners = [
      {
        _id: 'banner-1',
        title: 'Banner do admin chọn',
        originName: 'Admin Pick',
        movieSlug: 'admin-pick',
        imageUrl: 'https://cdn.example.com/admin-backdrop.jpg',
        description: 'Mô tả tùy biến',
        order: 1,
        isActive: true,
      },
    ];
    const bannerModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(activeBanners),
        }),
      }),
    };

    const details: Record<string, any> = {
      'admin-pick': {
        name: 'Tên nguồn',
        category: [],
        episode_current: 'Full',
      },
      'valid-movie': { name: 'Tên API', category: [], episode_current: 'Full' },
      trailer: { name: 'Trailer', category: [], episode_current: 'Trailer' },
      anime: {
        name: 'Anime',
        category: [{ slug: 'hoat-hinh' }],
        episode_current: 'Tập 1',
      },
    };
    const moviesService = {
      fetchOphimProxy: jest.fn().mockImplementation(async (path: string) => {
        if (path.startsWith('/danh-sach/')) {
          return {
            status: true,
            _sourceId: 'phimapi',
            items: [
              { slug: 'trailer', name: 'Trailer' },
              { slug: 'anime', name: 'Anime' },
              { slug: 'valid-movie', name: 'Tên API' },
            ],
          };
        }
        const slug = path.split('/').pop() as string;
        return { status: true, movie: { slug, ...details[slug] } };
      }),
      getMovieLogo: jest.fn().mockImplementation(async (slug: string) => ({
        logoUrl: `https://image.tmdb.org/${slug}-logo.png`,
        backdropUrl: `https://image.tmdb.org/${slug}-backdrop.jpg`,
        posterUrl: '',
        tmdbTitle: slug === 'valid-movie' ? 'Tên TMDB' : 'Admin Pick',
        tmdbOriginalTitle:
          slug === 'valid-movie' ? 'TMDB Original' : 'Admin Pick',
      })),
    };

    const service = new BannersService(
      bannerModel as any,
      moviesService as any,
    );
    const result = await service.getResolvedHero(false);

    expect(result.sourceId).toBe('phimapi');
    expect(result.slots).toHaveLength(2);
    expect(result.slots[0].movie).toEqual(
      expect.objectContaining({
        name: 'Banner do admin chọn',
        poster_url: 'https://cdn.example.com/admin-backdrop.jpg',
        isCustomBanner: true,
      }),
    );
    expect(result.slots[1].movie).toEqual(
      expect.objectContaining({
        name: 'Tên TMDB',
        poster_url: 'https://image.tmdb.org/valid-movie-backdrop.jpg',
        isCustomBanner: false,
      }),
    );
    expect(
      result.slots.some((slot: any) => slot.movie.slug === 'trailer'),
    ).toBe(false);
    expect(result.slots.some((slot: any) => slot.movie.slug === 'anime')).toBe(
      false,
    );
  });

  it('rejects invalid slots and duplicate hero positions', async () => {
    const BannerModel: any = jest.fn((payload: any) => ({
      save: jest.fn().mockResolvedValue(payload),
    }));
    BannerModel.exists = jest.fn().mockResolvedValue({ _id: 'occupied' });
    const service = new BannersService(BannerModel, {} as any);

    await expect(
      service.create({
        title: 'Banner lỗi',
        movieSlug: 'banner-loi',
        imageUrl: 'https://image.tmdb.org/banner.jpg',
        order: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create({
        title: 'Banner hợp lệ',
        movieSlug: 'banner-hop-le',
        imageUrl: 'https://image.tmdb.org/banner.jpg',
        order: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sanitizes banner content before saving', async () => {
    const save = jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    });
    const BannerModel: any = jest.fn(function (this: any, payload: any) {
      Object.assign(this, payload);
      this.save = save;
    });
    BannerModel.exists = jest.fn().mockResolvedValue(null);
    const service = new BannersService(BannerModel, {} as any);

    const result: any = await service.create({
      title: '  Phim   nổi bật  ',
      originName: '  Featured Movie ',
      movieSlug: 'PHIM-NOI-BAT',
      imageUrl: 'https://image.tmdb.org/t/p/w1280/banner.jpg',
      description: '<b>Mô tả</b>   an toàn',
      order: 2,
      isActive: true,
      ignoredField: 'không được lưu',
    });

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Phim nổi bật',
        movieSlug: 'phim-noi-bat',
        description: 'Mô tả an toàn',
        order: 2,
      }),
    );
    expect(result.ignoredField).toBeUndefined();
  });
});
