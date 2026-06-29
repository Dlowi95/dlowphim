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

  @Prop({ required: true })
  currentTime: number;

  @Prop({ required: true })
  duration: number;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop()
  password?: string;

  @Prop({ required: true })
  displayName: string;

  @Prop()
  googleId?: string;

  @Prop()
  avatar?: string;

  @Prop({ type: [String], default: [] })
  favorites: string[];

  @Prop({ type: [Object], default: [] })
  watchHistory: HistoryItem[];

  @Prop({ default: 'member' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
