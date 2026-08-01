import { Injectable } from '@nestjs/common';
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
}
