import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemSettingDocument = SystemSetting & Document;

@Schema({ timestamps: true })
export class SystemSetting {
  // General SEO Settings
  @Prop({ required: true, default: 'DlowPhim' })
  websiteName: string;

  @Prop({ default: 'Trải Nghiệm Điện Ảnh Premium' })
  websiteDescription?: string;

  @Prop({ default: false })
  maintenanceMode: boolean;

  // Movie Crawling config
  @Prop({ default: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat' })
  movieCrawlSource?: string;

  @Prop({ type: Number, default: 12 })
  autoCrawlInterval?: number; // hours

  // Contact / Footer
  @Prop({ default: 'support@dlowphim.com' })
  contactEmail?: string;

  @Prop({ default: 'https://facebook.com/dlowphim' })
  facebookLink?: string;

  @Prop({ default: 'https://t.me/dlowphim' })
  telegramLink?: string;

  // Monetization / Ads
  @Prop({ default: false })
  adsEnabled: boolean;
}

export const SystemSettingSchema = SchemaFactory.createForClass(SystemSetting);
