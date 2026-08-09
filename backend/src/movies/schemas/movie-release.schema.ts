import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MovieReleaseDocument = MovieRelease & Document;

@Schema({ timestamps: true, versionKey: false })
export class MovieRelease {
  @Prop({ required: true, unique: true, index: true })
  tmdbId: string;

  @Prop({ default: 'movie' })
  tmdbType: string;

  @Prop({ required: true, index: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  originName: string;

  @Prop({ default: '' })
  overview: string;

  @Prop({ default: '' })
  posterUrl: string;

  @Prop({ default: '' })
  backdropUrl: string;

  @Prop({ default: '', index: true })
  releaseDate: string;

  @Prop({ index: true })
  year?: number;

  @Prop({ type: Array, default: [] })
  genres: Array<{ id?: number; name: string; slug: string }>;

  @Prop({ default: 0 })
  voteAverage: number;

  @Prop({ enum: ['scheduled', 'released'], default: 'scheduled', index: true })
  releaseStatus: string;

  @Prop({ enum: ['unavailable', 'available'], default: 'unavailable', index: true })
  playbackStatus: string;

  @Prop({ enum: ['phimapi', 'ophim', ''], default: '' })
  providerSource: string;

  @Prop({ default: '', index: true })
  providerSlug: string;

  @Prop({ enum: ['tmdb_id', 'title_year', ''], default: '' })
  matchMethod: string;

  @Prop({ type: Date, default: null })
  matchedAt: Date | null;

  @Prop({ type: Date, default: null, index: true })
  lastCheckedAt: Date | null;

  @Prop({ type: Date, default: Date.now, index: true })
  nextCheckAt: Date;

  @Prop({ default: 0 })
  checkAttempts: number;

  @Prop({ type: Date, default: Date.now })
  metadataUpdatedAt: Date;
}

export const MovieReleaseSchema = SchemaFactory.createForClass(MovieRelease);
MovieReleaseSchema.index({ playbackStatus: 1, nextCheckAt: 1, releaseDate: 1 });
MovieReleaseSchema.index({ releaseStatus: 1, releaseDate: 1 });
