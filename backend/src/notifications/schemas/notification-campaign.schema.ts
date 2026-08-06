import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationCampaignDocument = NotificationCampaign & Document;

@Schema({ timestamps: true })
export class NotificationCampaign {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop()
  link?: string;

  @Prop({ enum: ['queued', 'sending', 'sent', 'failed'], default: 'queued', index: true })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: 0 })
  recipientCount: number;

  @Prop({ default: 0 })
  deliveredCount: number;

  @Prop()
  sentAt?: Date;

  @Prop()
  processingStartedAt?: Date;

  @Prop()
  errorMessage?: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const NotificationCampaignSchema = SchemaFactory.createForClass(NotificationCampaign);

NotificationCampaignSchema.index({ createdAt: -1 });
NotificationCampaignSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
