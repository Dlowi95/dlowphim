import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MovieReportDocument = MovieReport & Document;

@Schema({ timestamps: true })
export class MovieReport {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  movieSlug: string;

  @Prop({ required: true })
  movieName: string;

  @Prop({ required: true })
  episodeName: string;

  @Prop({ required: true })
  errorType: string; // 'video_broken' | 'audio_issue' | 'subtitle_issue' | 'other'

  @Prop()
  description?: string;

  @Prop({ default: 'pending', index: true })
  status: string; // 'pending' | 'resolved' | 'ignored'
}

export const MovieReportSchema = SchemaFactory.createForClass(MovieReport);
