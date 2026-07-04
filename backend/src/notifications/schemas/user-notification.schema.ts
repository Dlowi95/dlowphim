import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserNotificationDocument = UserNotification & Document;

@Schema({ timestamps: true })
export class UserNotification {
  @Prop({ type: Types.ObjectId, required: false, index: true })
  userId: Types.ObjectId; // null nếu là thông báo hệ thống chung gửi tất cả mọi người

  @Prop({ required: true, index: true })
  type: string; // 'reply' | 'movie_update' | 'system'

  @Prop({ required: true })
  title: string;

  @Prop()
  content?: string;

  @Prop()
  link?: string; // Ví dụ: /movie/naruto#comment-123 hoặc /movie/naruto

  @Prop({ default: false, index: true })
  isRead: boolean;
}

export const UserNotificationSchema = SchemaFactory.createForClass(UserNotification);
