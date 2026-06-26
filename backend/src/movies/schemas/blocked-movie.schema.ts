import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BlockedMovieDocument = BlockedMovie & Document;

@Schema({ timestamps: true })
export class BlockedMovie {
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop()
  title: string;

  @Prop()
  reason: string;
}

export const BlockedMovieSchema = SchemaFactory.createForClass(BlockedMovie);
