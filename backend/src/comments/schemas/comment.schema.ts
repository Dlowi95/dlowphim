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

  @Prop({ index: true })
  contentFingerprint?: string;

  @Prop()
  rateLimitBucket?: number;

  @Prop({ default: false })
  isSpoiler: boolean;

  @Prop()
  episodeLabel?: string;

  @Prop({
    type: [{
      userId: { type: Types.ObjectId, ref: 'User', required: true },
      type: { type: String, required: true }
    }],
    default: []
  })
  reactions: { userId: Types.ObjectId; type: string }[];

  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null, index: true })
  parentId?: Types.ObjectId | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ movieSlug: 1, parentId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1, contentFingerprint: 1, createdAt: -1 });
CommentSchema.index(
  { userId: 1, rateLimitBucket: 1 },
  {
    unique: true,
    partialFilterExpression: { rateLimitBucket: { $type: 'number' } },
  },
);
