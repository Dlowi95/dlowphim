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

  describe('testMovieSource', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('returns healthy status when provider returns 200 with items schema', async () => {
      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: true, items: [{ slug: 'movie-1' }] }),
      } as any);

      const result = await service.testMovieSource('phimapi');
      expect(result.ok).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.errorType).toBe('none');
      expect(result.testedEndpoint).toBe('https://phimapi.com/danh-sach/phim-moi-cap-nhat');
      expect(result.message).toContain('HTTP 200');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('classifies 404 responses accurately as http_error with testedEndpoint', async () => {
      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);
      const cancelMock = jest.fn().mockResolvedValue(undefined);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        body: { cancel: cancelMock },
      } as any);

      const result = await service.testMovieSource('ophim');
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.errorType).toBe('http_error');
      expect(result.testedEndpoint).toBe('https://ophim1.com/danh-sach/phim-moi-cap-nhat');
      expect(result.message).toContain('404 Not Found');
      expect(cancelMock).toHaveBeenCalled();
    });

    it('classifies 500 server errors as http_error', async () => {
      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);
      const cancelMock = jest.fn().mockResolvedValue(undefined);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: { cancel: cancelMock },
      } as any);

      const result = await service.testMovieSource('phimapi');
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.errorType).toBe('http_error');
      expect(result.message).toContain('máy chủ (HTTP 500)');
      expect(cancelMock).toHaveBeenCalled();
    });

    it('classifies network and DNS errors accurately as network_error', async () => {
      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);

      global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND ophim1.com'));

      const result = await service.testMovieSource('ophim');
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBeNull();
      expect(result.errorType).toBe('network_error');
      expect(result.message).toContain('ENOTFOUND');
    });

    it('classifies unparseable non-JSON responses as invalid_schema', async () => {
      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON at position 0')),
      } as any);

      const result = await service.testMovieSource('phimapi');
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(200);
      expect(result.errorType).toBe('invalid_schema');
      expect(result.message).toContain('không phải dữ liệu JSON hợp lệ');
    });

    it('classifies HTTP 200 responses missing expected items/status as invalid_schema', async () => {
      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ message: 'Welcome to proxy root' }),
      } as any);

      const result = await service.testMovieSource('phimapi');
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(200);
      expect(result.errorType).toBe('invalid_schema');
      expect(result.message).toContain('không chứa danh sách phim');
    });

    it('aborts slow fetch after 5000ms using controlled fake timers and cleans up timer', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        return new Promise((resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const testPromise = service.testMovieSource('ophim');

      // Flush microtasks so getSettings() resolves and setTimeout is registered
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Fast forward time past 5000ms
      jest.advanceTimersByTime(5001);

      const result = await testPromise;
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBeNull();
      expect(result.errorType).toBe('timeout');
      expect(result.message).toContain('Quá thời gian kết nối (> 5000ms)');
      expect(clearTimeoutSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('aborts slow body/JSON parsing when signal triggers after 5000ms', async () => {
      jest.useFakeTimers();

      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => new Promise((resolve, reject) => {
            if (init?.signal) {
              init.signal.addEventListener('abort', () => {
                const abortErr = new Error('The operation was aborted');
                abortErr.name = 'AbortError';
                reject(abortErr);
              });
            }
          }),
        } as any);
      });

      const testPromise = service.testMovieSource('phimapi');

      // Flush microtasks so getSettings() and fetch resolve, registering json listener
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Advance timers by 5001ms to trigger abort during JSON parse
      jest.advanceTimersByTime(5001);

      const result = await testPromise;
      expect(result.ok).toBe(false);
      expect(result.errorType).toBe('timeout');
      expect(result.message).toContain('Quá thời gian kết nối (> 5000ms)');

      jest.useRealTimers();
    });

    it('cleans up timeout immediately on fast successful response', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const settings = {
        movieSources,
        movieSourceConfigVersion: 1,
        save: jest.fn(),
      };
      const service = createService(settings);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: true, items: [{ slug: 'fast-movie' }] }),
      } as any);

      const result = await service.testMovieSource('phimapi');
      expect(result.ok).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
