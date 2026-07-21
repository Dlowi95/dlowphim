import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FeaturedRiderDocument = FeaturedRider & Document;

@Schema({ timestamps: true })
export class FeaturedRider {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  originName: string;

  @Prop({ required: true })
  slug: string; // OPhim slug để link đến trang phim

  @Prop({ default: '' })
  posterUrl: string; // URL ảnh poster dọc (left panel)

  @Prop({ default: '' })
  bannerUrl: string; // URL ảnh banner ngang (hero card trong grid)

  @Prop({ default: '' })
  themeColor: string; // Màu hex chủ đạo (#FFD700, #E60012, ...)

  @Prop({ default: '' })
  description: string; // Mô tả ngắn

  @Prop({ default: '' })
  year: string;

  @Prop({ default: 'HD' })
  quality: string;

  @Prop({ default: 0 })
  order: number; // Thứ tự hiển thị (0 = đầu tiên)

  @Prop({ default: true })
  isActive: boolean;
}

export const FeaturedRiderSchema = SchemaFactory.createForClass(FeaturedRider);
