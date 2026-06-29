import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  type: string; // 'movie_report' | 'comment_report' | 'system'

  @Prop({ required: true })
  title: string;

  @Prop()
  subtitle?: string;

  @Prop()
  content?: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  targetId: Types.ObjectId; // Link to the original MovieReport or CommentReport

  @Prop({ required: true })
  targetTab: string; // 'reports' | 'comments'

  @Prop({ default: false, index: true })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
