import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting, SystemSettingDocument } from './schemas/system-setting.schema';

@Injectable()
export class SystemSettingsService {
  private readonly defaultMovieSources = [
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

  constructor(
    @InjectModel(SystemSetting.name)
    private readonly systemSettingModel: Model<SystemSettingDocument>,
  ) {}

  async getSettings(): Promise<SystemSettingDocument> {
    let settings = await this.systemSettingModel.findOne().exec();
    if (!settings) {
      // Create default settings if not exists
      settings = new this.systemSettingModel({
        websiteName: 'DlowPhim',
        websiteDescription: 'Trải Nghiệm Điện Ảnh Premium',
        maintenanceMode: false,
        movieCrawlSource: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat',
        activeMovieSourceId: 'phimapi',
        movieSourceConfigVersion: 1,
        movieSources: this.defaultMovieSources,
        autoCrawlInterval: 12,
        contactEmail: 'support@dlowphim.com',
        facebookLink: 'https://facebook.com/dlowphim',
        telegramLink: 'https://t.me/dlowphim',
        adsEnabled: false,
        tmdbApiKey: '591c025bb1641315ae087330271132bc',
      });
      await settings.save();
    } else {
      // Migrate old databases once. After this, preserve the source selected
      // by the administrator instead of changing it whenever settings are read.
      let updated = false;

      if (!settings.movieSourceConfigVersion) {
        settings.activeMovieSourceId = 'phimapi';
        settings.movieCrawlSource = 'https://phimapi.com/danh-sach/phim-moi-cap-nhat';
        settings.movieSourceConfigVersion = 1;
        updated = true;
      }

      if (!settings.movieSources || settings.movieSources.length === 0) {
        settings.movieSources = this.defaultMovieSources;
        updated = true;
      } else {
        const phimapiSrc = settings.movieSources.find(s => s.id === 'phimapi');
        if (phimapiSrc && !phimapiSrc.name.includes('Khuyên dùng')) {
          phimapiSrc.name = 'PhimAPI / KKPhim (Khuyên dùng)';
          updated = true;
        }
        const ophimSrc = settings.movieSources.find(s => s.id === 'ophim');
        if (ophimSrc && ophimSrc.name.includes('Khuyên dùng')) {
          ophimSrc.name = 'OPhim';
          updated = true;
        }
      }
      
      if (updated) {
        await settings.save();
      }
    }
    return settings;
  }

  async getPublicSettings() {
    const settings = await this.getSettings();
    return {
      websiteName: settings.websiteName,
      websiteDescription: settings.websiteDescription || '',
      maintenanceMode: Boolean(settings.maintenanceMode),
      contactEmail: settings.contactEmail || '',
      facebookLink: settings.facebookLink || '',
      telegramLink: settings.telegramLink || '',
    };
  }

  async getAdminSettings() {
    const settings = await this.getSettings();
    return this.toAdminResponse(settings);
  }

  async updateSection(section: string, dto: Partial<SystemSetting>, adminId?: string) {
    const allowedSections = ['general', 'sources', 'contact'];
    if (!allowedSections.includes(section)) {
      throw new BadRequestException('Nhóm cấu hình không hợp lệ');
    }

    const settings = await this.getSettings();
    if (section === 'general') {
      const websiteName = String(dto.websiteName || '').trim();
      const websiteDescription = String(dto.websiteDescription || '').trim();
      if (websiteName.length < 2 || websiteName.length > 60) {
        throw new BadRequestException('Tên website phải có từ 2 đến 60 ký tự');
      }
      if (websiteDescription.length > 180) {
        throw new BadRequestException('Mô tả SEO không được vượt quá 180 ký tự');
      }
      settings.websiteName = websiteName;
      settings.websiteDescription = websiteDescription;
      settings.maintenanceMode = Boolean(dto.maintenanceMode);
    }

    if (section === 'sources') {
      const sources = Array.isArray(dto.movieSources) ? dto.movieSources : [];
      if (sources.length !== 2) {
        throw new BadRequestException('Phải cấu hình đủ hai nguồn PhimAPI và OPhim');
      }
      const normalized = sources.map((source) => ({
        id: String(source.id || '').trim().toLowerCase(),
        name: String(source.name || '').trim(),
        domain: this.normalizeRemoteUrl(source.domain, 'Tên miền nguồn'),
        crawlUrl: this.normalizeRemoteUrl(source.crawlUrl, 'Đường dẫn lấy phim'),
      }));
      if (new Set(normalized.map((source) => source.id)).size !== normalized.length) {
        throw new BadRequestException('Mã nguồn phim không được trùng nhau');
      }
      const sourceIds = normalized.map((source) => source.id).sort();
      if (sourceIds.join(',') !== 'ophim,phimapi') {
        throw new BadRequestException('Chỉ được cấu hình hai nguồn PhimAPI và OPhim');
      }
      const activeId = String(dto.activeMovieSourceId || '').trim().toLowerCase();
      if (!normalized.some((source) => source.id === activeId)) {
        throw new BadRequestException('Nguồn phim mặc định không hợp lệ');
      }
      settings.movieSources = normalized;
      settings.activeMovieSourceId = activeId;
      settings.movieCrawlSource = normalized.find((source) => source.id === activeId)!.crawlUrl;

      const key = typeof dto.tmdbApiKey === 'string' ? dto.tmdbApiKey.trim() : '';
      if (key) {
        if (!/^[a-fA-F0-9]{32}$/.test(key)) {
          throw new BadRequestException('TMDB API key phải gồm đúng 32 ký tự hexadecimal');
        }
        settings.tmdbApiKey = key;
      }
    }

    if (section === 'contact') {
      settings.contactEmail = String(dto.contactEmail || '').trim();
      settings.facebookLink = dto.facebookLink
        ? this.normalizeRemoteUrl(String(dto.facebookLink), 'Facebook')
        : '';
      settings.telegramLink = dto.telegramLink
        ? this.normalizeRemoteUrl(String(dto.telegramLink), 'Telegram')
        : '';
    }

    settings.movieSourceConfigVersion = 1;
    settings.lastUpdatedBy = String(adminId || 'admin');
    const saved = await settings.save();
    return this.toAdminResponse(saved);
  }

  async testMovieSource(sourceId: string) {
    const settings = await this.getSettings();
    const source = settings.movieSources?.find((item) => item.id === String(sourceId || '').trim());
    if (!source) throw new NotFoundException('Không tìm thấy nguồn phim');

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(source.crawlUrl || source.domain, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      void response.body?.cancel().catch(() => undefined);
      return {
        sourceId: source.id,
        ok: response.ok,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        sourceId: source.id,
        ok: false,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async testTmdb() {
    const settings = await this.getSettings();
    if (!settings.tmdbApiKey) throw new BadRequestException('TMDB API key chưa được cấu hình');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const startedAt = Date.now();
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(settings.tmdbApiKey)}`,
        { signal: controller.signal },
      );
      void response.body?.cancel().catch(() => undefined);
      return { ok: response.ok, statusCode: response.status, latencyMs: Date.now() - startedAt };
    } catch {
      return { ok: false, statusCode: null, latencyMs: Date.now() - startedAt };
    } finally {
      clearTimeout(timeout);
    }
  }

  async updateSettings(dto: Partial<SystemSetting>): Promise<SystemSettingDocument> {
    let settings = await this.systemSettingModel.findOne().exec();
    if (!settings) {
      settings = new this.systemSettingModel({
        activeMovieSourceId: 'phimapi',
        movieCrawlSource: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat',
        movieSourceConfigVersion: 1,
        movieSources: this.defaultMovieSources,
        ...dto,
      });
    } else {
      Object.assign(settings, dto);
    }

    settings.movieSourceConfigVersion = 1;

    // Sync crawl source with the active source if it was changed
    if (settings.activeMovieSourceId && settings.movieSources) {
      const activeSrc = settings.movieSources.find(s => s.id === settings.activeMovieSourceId);
      if (activeSrc) {
        settings.movieCrawlSource = activeSrc.crawlUrl;
      }
    }

    return settings.save();
  }

  private toAdminResponse(settings: SystemSettingDocument) {
    const raw = typeof (settings as any).toObject === 'function' ? (settings as any).toObject() : settings;
    const { tmdbApiKey, ...safe } = raw as any;
    return {
      ...safe,
      tmdbApiKeyConfigured: Boolean(tmdbApiKey && String(tmdbApiKey).trim()),
      tmdbApiKeyLast4: tmdbApiKey ? String(tmdbApiKey).slice(-4) : '',
    };
  }

  private normalizeRemoteUrl(value: string, label: string) {
    try {
      const url = new URL(String(value || '').trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      const hostname = url.hostname.toLowerCase();
      const privateHost = hostname === 'localhost'
        || hostname === '0.0.0.0'
        || hostname === '::1'
        || hostname.startsWith('127.')
        || hostname.startsWith('10.')
        || hostname.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
      if (privateHost) throw new Error();
      return url.toString().replace(/\/$/, '');
    } catch {
      throw new BadRequestException(`${label} phải là URL HTTP(S) công khai hợp lệ`);
    }
  }
}
