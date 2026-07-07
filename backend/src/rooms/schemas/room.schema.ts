import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, unique: true, index: true })
  roomId: string; // ID ngắn gọn gồm 6 ký tự viết hoa/số để dễ share link

  @Prop({ required: true })
  movieSlug: string;

  @Prop({ required: true })
  movieName: string;

  @Prop({ required: true })
  moviePoster: string;

  @Prop({ required: true })
  roomName: string;

  @Prop({ required: true })
  posterOption: string; // Link ảnh làm poster đại diện phòng

  @Prop({ default: false })
  isAutoStart: boolean;

  @Prop({ type: Date })
  startTime?: Date;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  host: Types.ObjectId;

  @Prop({ default: 'active' })
  status: string; // active, closed

  @Prop({ default: '' })
  currentEpisode: string; // Lưu slug của tập phim đang phát (ví dụ: 'tap-1', 'tap-2')
}

export const RoomSchema = SchemaFactory.createForClass(Room);
