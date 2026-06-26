import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomMovieDocument = CustomMovie & Document;

@Schema({ timestamps: true })
export class CustomMovie {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  origin_name: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true })
  thumb_url: string;

  @Prop({ required: true })
  poster_url: string;

  @Prop({ default: 2026 })
  year: number;

  @Prop({ default: '120 phút' })
  time: string;

  @Prop({ default: 'FHD' })
  quality: string;

  @Prop({ default: 'Vietsub' })
  lang: string;

  @Prop({ default: '' })
  content: string;

  @Prop({ type: [Object], default: [] })
  category: { name: string; slug: string }[];

  @Prop({ type: [Object], default: [] })
  country: { name: string; slug: string }[];

  @Prop({ required: true })
  link_m3u8: string;

  @Prop({ default: true })
  isCustom: boolean;
}

export const CustomMovieSchema = SchemaFactory.createForClass(CustomMovie);
