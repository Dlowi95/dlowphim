import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MovieLogoDocument = MovieLogo & Document;

@Schema({ timestamps: true })
export class MovieLogo {
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ default: '' })
  logoUrl: string; // link logo không nền từ TMDB, trống nếu không tìm thấy

  @Prop({ default: '' })
  backdropUrl: string; // link ảnh nền ngang nét căng từ TMDB

  @Prop({ default: '' })
  posterUrl: string; // link ảnh poster dọc nét căng từ TMDB

  @Prop({ default: '' })
  tmdbTitle: string;

  @Prop({ default: '' })
  tmdbOriginalTitle: string;

  @Prop({ default: '' })
  tmdbId: string;

  @Prop({ default: 'movie' })
  tmdbType: string;

  @Prop({ type: Array, default: [] })
  credits: any[]; // danh sách dàn diễn viên nét từ TMDB [{ id, name, character, profileUrl }]
}

export const MovieLogoSchema = SchemaFactory.createForClass(MovieLogo);
