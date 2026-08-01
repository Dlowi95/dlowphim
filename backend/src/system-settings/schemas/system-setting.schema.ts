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
  @Prop({ default: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat' })
  movieCrawlSource?: string;

  @Prop({ default: 'phimapi' })
  activeMovieSourceId: string;

  // One-time migration marker. Admin selections must not be overwritten on read.
  @Prop({ type: Number, default: 0 })
  movieSourceConfigVersion: number;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        domain: { type: String, required: true },
        crawlUrl: { type: String, required: true },
      },
    ],
    default: [
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
    ],
  })
  movieSources: Array<{
    id: string;
    name: string;
    domain: string;
    crawlUrl: string;
  }>;

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

  // TMDB API Config
  @Prop({ default: '591c025bb1641315ae087330271132bc' })
  tmdbApiKey?: string;
}

export const SystemSettingSchema = SchemaFactory.createForClass(SystemSetting);
