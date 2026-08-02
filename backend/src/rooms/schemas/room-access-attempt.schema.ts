import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomAccessAttemptDocument = RoomAccessAttempt & Document;

@Schema({ timestamps: true })
export class RoomAccessAttempt {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  roomId: string;

  @Prop({ default: 0 })
  failures: number;

  @Prop({ type: Date })
  lockedUntil?: Date;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const RoomAccessAttemptSchema =
  SchemaFactory.createForClass(RoomAccessAttempt);
RoomAccessAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
