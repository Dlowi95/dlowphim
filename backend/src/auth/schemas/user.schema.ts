import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class HistoryItem {
  @Prop({ required: true })
  movieSlug: string;

  @Prop({ required: true })
  movieName: string;

  @Prop({ required: true })
  episodeName: string;

  @Prop()
  episodeKey?: string;

  @Prop({ required: true })
  currentTime: number;

  @Prop({ required: true })
  duration: number;

  @Prop({ enum: ['exact', 'embed'], default: 'exact' })
  progressMode?: 'exact' | 'embed';

  @Prop({ default: Date.now })
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email: string;

  @Prop()
  password?: string;

  @Prop({ required: true })
  displayName: string;

  @Prop()
  googleId?: string;

  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop({ select: false, index: true })
  passwordResetTokenHash?: string;

  @Prop({ select: false })
  passwordResetExpiresAt?: Date;

  @Prop({ select: false })
  passwordResetRequestedAt?: Date;

  @Prop()
  avatar?: string;

  @Prop({ default: 'other' })
  gender: string;

  @Prop({ type: [String], default: [] })
  favorites: string[];

  @Prop({ type: [Object], default: [] })
  watchHistory: HistoryItem[];

  @Prop({ type: [Object], default: [] })
  playlists: { id: string; name: string; movies: string[] }[];

  @Prop({ type: [Object], default: [] })
  upcomingReminders: {
    tmdbId: string;
    slug: string;
    movieName: string;
    originName?: string;
    releaseDate?: string;
    year?: number;
    createdAt: Date;
    releaseNotifiedAt?: Date;
    availableNotifiedAt?: Date;
    resolvedSlug?: string;
  }[];

  @Prop({ default: 'member' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
