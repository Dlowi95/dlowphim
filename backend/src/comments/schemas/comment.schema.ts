import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ required: true, index: true })
  movieSlug: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  displayName: string;

  @Prop()
  avatar?: string;

  @Prop({ default: 'member' })
  role: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: false })
  isSpoiler: boolean;

  @Prop()
  episodeLabel?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  upvotes: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  downvotes: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null, index: true })
  parentId?: Types.ObjectId | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
