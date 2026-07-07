import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sender?: Types.ObjectId;

  @Prop({ required: true })
  senderName: string;

  @Prop()
  senderAvatar?: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: false })
  isSystem: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
