import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RatingDocument = Rating & Document;

@Schema({ timestamps: true })
export class Rating {
  @Prop({ required: true, index: true })
  movieSlug: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 10 })
  score: number;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
// Ensure one rating per user per movie
RatingSchema.index({ movieSlug: 1, userId: 1 }, { unique: true });
