import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminJobDocument = AdminJob & Document;

@Schema({ timestamps: true, versionKey: false })
export class AdminJob {
  @Prop({ required: true, enum: ['upcoming_reminder_scan', 'source_health_check'], index: true })
  type: string;

  @Prop({ enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true })
  status: string;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ type: Object })
  result?: Record<string, unknown>;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: 3 })
  maxAttempts: number;

  @Prop({ index: true, default: Date.now })
  runAt: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop({ maxlength: 1000 })
  errorMessage?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: Types.ObjectId;

  @Prop({ index: true })
  dedupeKey?: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;
}

export const AdminJobSchema = SchemaFactory.createForClass(AdminJob);
AdminJobSchema.index({ status: 1, runAt: 1, createdAt: 1 });
AdminJobSchema.index({ createdAt: -1 });
AdminJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
