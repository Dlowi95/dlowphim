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
        autoCrawlInterval: 12,
        contactEmail: 'support@dlowphim.com',
        facebookLink: 'https://facebook.com/dlowphim',
        telegramLink: 'https://t.me/dlowphim',
        adsEnabled: false,
        tmdbApiKey: '591c025bb1641315ae087330271132bc',
      });
      await settings.save();
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
    return settings.save();
  }
}
