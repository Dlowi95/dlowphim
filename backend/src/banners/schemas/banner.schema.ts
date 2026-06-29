import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BannerDocument = Banner & Document;

@Schema({ timestamps: true })
export class Banner {
  @Prop({ required: true })
  title: string;

  @Prop()
  originName?: string;

  @Prop({ required: true, index: true })
  movieSlug: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop()
  description?: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
