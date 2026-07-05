import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MovieOverrideDocument = MovieOverride & Document;

@Schema({ timestamps: true })
export class MovieOverride {
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ default: '' })
  customContent: string;

  @Prop({ default: '' })
  customName: string;
}

export const MovieOverrideSchema = SchemaFactory.createForClass(MovieOverride);
