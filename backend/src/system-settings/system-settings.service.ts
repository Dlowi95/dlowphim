import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting, SystemSettingDocument } from './schemas/system-setting.schema';

@Injectable()
export class SystemSettingsService {
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
        movieCrawlSource: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat',
        activeMovieSourceId: 'ophim',
        movieSources: [
          {
            id: 'phimapi',
            name: 'PhimAPI / KKPhim',
            domain: 'https://phimapi.com',
            crawlUrl: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat',
          },
          {
            id: 'ophim',
            name: 'OPhim (Khuyên dùng)',
            domain: 'https://ophim1.com',
            crawlUrl: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat',
          },
        ],
        autoCrawlInterval: 12,
        contactEmail: 'support@dlowphim.com',
        facebookLink: 'https://facebook.com/dlowphim',
        telegramLink: 'https://t.me/dlowphim',
        adsEnabled: false,
        tmdbApiKey: '591c025bb1641315ae087330271132bc',
      });
      await settings.save();
    } else {
      // Check and add backward compatibility / migration to OPhim default
      let updated = false;
      
      // Khôi phục OPhim làm nguồn hoạt động mặc định theo yêu cầu của user
      if (!settings.activeMovieSourceId || settings.activeMovieSourceId === 'phimapi') {
        settings.activeMovieSourceId = 'ophim';
        settings.movieCrawlSource = 'https://ophim1.com/danh-sach/phim-moi-cap-nhat';
        updated = true;
      }
      
      if (!settings.movieSources || settings.movieSources.length === 0) {
        settings.movieSources = [
          {
            id: 'phimapi',
            name: 'PhimAPI / KKPhim',
            domain: 'https://phimapi.com',
            crawlUrl: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat',
          },
          {
            id: 'ophim',
            name: 'OPhim (Khuyên dùng)',
            domain: 'https://ophim1.com',
            crawlUrl: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat',
          },
        ];
        updated = true;
      } else {
        // Cập nhật nhãn OPhim (Khuyên dùng) trong danh sách nguồn nếu cần
        const ophimSrc = settings.movieSources.find(s => s.id === 'ophim');
        if (ophimSrc && !ophimSrc.name.includes('Khuyên dùng')) {
          ophimSrc.name = 'OPhim (Khuyên dùng)';
          updated = true;
        }
        const phimapiSrc = settings.movieSources.find(s => s.id === 'phimapi');
        if (phimapiSrc && phimapiSrc.name.includes('Khuyên dùng')) {
          phimapiSrc.name = 'PhimAPI / KKPhim';
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
      settings = new this.systemSettingModel(dto);
    } else {
      Object.assign(settings, dto);
    }

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
