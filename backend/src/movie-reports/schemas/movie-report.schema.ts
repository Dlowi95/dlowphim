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

  @Prop()
  episodeSlug?: string;

  @Prop({ required: true })
  errorType: string; // 'video_broken' | 'audio_issue' | 'subtitle_issue' | 'other'

  @Prop()
  description?: string;

  @Prop({ enum: ['pending', 'resolved', 'ignored'], default: 'pending', index: true })
  status: string; // 'pending' | 'resolved' | 'ignored'

  @Prop({ select: false, index: true })
  reporterKey?: string;

  @Prop({ enum: ['hls', 'embed', 'unknown'], default: 'unknown' })
  playbackType?: string;

  @Prop()
  serverName?: string;

  @Prop()
  streamOrigin?: string;

  @Prop({ min: 0 })
  currentTime?: number;

  @Prop({ default: 1, min: 1 })
  occurrenceCount: number;

  @Prop({ default: Date.now, index: true })
  lastReportedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  handledBy?: Types.ObjectId;

  @Prop()
  handledAt?: Date;

  @Prop()
  resolutionNote?: string;

  @Prop()
  expiresAt: Date;
}

export const MovieReportSchema = SchemaFactory.createForClass(MovieReport);

MovieReportSchema.index({ status: 1, createdAt: -1 });
MovieReportSchema.index({ movieSlug: 1, episodeName: 1, status: 1, createdAt: -1 });
MovieReportSchema.index({ reporterKey: 1, createdAt: -1 });
MovieReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
