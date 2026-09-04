import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminAuditLogDocument = AdminAuditLog & Document;

@Schema({ timestamps: true, versionKey: false })
export class AdminAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actorId: Types.ObjectId;

  @Prop({ required: true })
  actorEmail: string;

  @Prop({ required: true })
  actorName: string;

  @Prop({ required: true, index: true })
  actorRole: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true })
  method: string;

  @Prop({ required: true, index: true })
  path: string;

  @Prop({ enum: ['success', 'failed'], required: true, index: true })
  status: 'success' | 'failed';

  @Prop()
  statusCode?: number;

  @Prop({ type: Object })
  context?: Record<string, unknown>;

  @Prop({ maxlength: 500 })
  errorMessage?: string;

  @Prop()
  ip?: string;

  @Prop({ maxlength: 300 })
  userAgent?: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);
AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ actorId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ action: 1, status: 1, createdAt: -1 });
AdminAuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
