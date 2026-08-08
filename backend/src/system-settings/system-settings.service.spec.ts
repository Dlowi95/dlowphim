import { SystemSettingsService } from './system-settings.service';

const movieSources = [
  {
    id: 'phimapi',
    name: 'PhimAPI / KKPhim (Khuyên dùng)',
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

function createService(settings: any) {
  const model = {
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(settings),
    }),
  };
  return new SystemSettingsService(model as any);
}

describe('SystemSettingsService movie source configuration', () => {
  it('preserves OPhim after an administrator selects it', async () => {
    const settings = {
      activeMovieSourceId: 'ophim',
      movieCrawlSource: movieSources[1].crawlUrl,
      movieSourceConfigVersion: 1,
      movieSources,
      save: jest.fn(),
    };

    await createService(settings).getSettings();

    expect(settings.activeMovieSourceId).toBe('ophim');
    expect(settings.save).not.toHaveBeenCalled();
  });

  it('migrates a legacy database to PhimAPI exactly once', async () => {
    const settings = {
      activeMovieSourceId: 'ophim',
      movieCrawlSource: movieSources[1].crawlUrl,
      movieSourceConfigVersion: 0,
      movieSources,
      save: jest.fn().mockResolvedValue(undefined),
    };

    await createService(settings).getSettings();

    expect(settings.activeMovieSourceId).toBe('phimapi');
    expect(settings.movieCrawlSource).toBe(movieSources[0].crawlUrl);
    expect(settings.movieSourceConfigVersion).toBe(1);
    expect(settings.save).toHaveBeenCalledTimes(1);
  });

  it('syncs the crawl URL when admin switches to OPhim', async () => {
    const settings = {
      activeMovieSourceId: 'phimapi',
      movieCrawlSource: movieSources[0].crawlUrl,
      movieSourceConfigVersion: 1,
      movieSources,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    const result = await createService(settings).updateSettings({
      activeMovieSourceId: 'ophim',
    });

    expect(result.activeMovieSourceId).toBe('ophim');
    expect(result.movieCrawlSource).toBe(movieSources[1].crawlUrl);
  });

  it('never exposes the TMDB key through public settings', async () => {
    const settings = {
      websiteName: 'DlowPhim',
      websiteDescription: 'Movie website',
      maintenanceMode: false,
      contactEmail: 'support@example.com',
      facebookLink: '',
      telegramLink: '',
      tmdbApiKey: '0123456789abcdef0123456789abcdef',
      activeMovieSourceId: 'phimapi',
      movieSourceConfigVersion: 1,
      movieSources,
      save: jest.fn(),
    };

    const result = await createService(settings).getPublicSettings();

    expect(result).not.toHaveProperty('tmdbApiKey');
    expect(result).not.toHaveProperty('movieSources');
    expect(result.websiteName).toBe('DlowPhim');
  });

  it('returns only masked TMDB metadata to an administrator', async () => {
    const settings = {
      websiteName: 'DlowPhim',
      maintenanceMode: false,
      tmdbApiKey: '0123456789abcdef0123456789abcdef',
      activeMovieSourceId: 'phimapi',
      movieSourceConfigVersion: 1,
      movieSources,
      save: jest.fn(),
    };

    const result = await createService(settings).getAdminSettings();

    expect(result).not.toHaveProperty('tmdbApiKey');
    expect(result.tmdbApiKeyConfigured).toBe(true);
    expect(result.tmdbApiKeyLast4).toBe('cdef');
  });

  it('updates one settings section without overwriting unrelated fields', async () => {
    const settings = {
      websiteName: 'Old name',
      websiteDescription: 'Old description',
      maintenanceMode: false,
      contactEmail: 'keep@example.com',
      tmdbApiKey: '0123456789abcdef0123456789abcdef',
      activeMovieSourceId: 'phimapi',
      movieSourceConfigVersion: 1,
      movieSources,
      save: jest.fn().mockImplementation(async function (this: any) { return this; }),
    };

    await createService(settings).updateSection('general', {
      websiteName: 'DlowPhim',
      websiteDescription: 'New description',
      maintenanceMode: true,
    }, 'admin-id');

    expect(settings.websiteName).toBe('DlowPhim');
    expect(settings.maintenanceMode).toBe(true);
    expect(settings.contactEmail).toBe('keep@example.com');
    expect(settings.tmdbApiKey).toBe('0123456789abcdef0123456789abcdef');
    expect((settings as any).lastUpdatedBy).toBe('admin-id');
  });
});
