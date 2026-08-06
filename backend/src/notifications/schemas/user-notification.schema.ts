import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserNotificationDocument = UserNotification & Document;

@Schema({ timestamps: true })
export class UserNotification {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

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

  @Prop({ required: true })
  dedupKey: string;

  @Prop({ type: Types.ObjectId, ref: 'NotificationCampaign', index: true })
  campaignId?: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const UserNotificationSchema = SchemaFactory.createForClass(UserNotification);

UserNotificationSchema.index({ userId: 1, createdAt: -1 });
UserNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
UserNotificationSchema.index(
  { userId: 1, dedupKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupKey: { $type: 'string' } },
  },
);
UserNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
