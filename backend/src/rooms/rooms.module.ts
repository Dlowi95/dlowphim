import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from './schemas/room.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { RoomsGateway } from './rooms.gateway';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  RoomAccessAttempt,
  RoomAccessAttemptSchema,
} from './schemas/room-access-attempt.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Message.name, schema: MessageSchema },
      { name: RoomAccessAttempt.name, schema: RoomAccessAttemptSchema },
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway],
  exports: [RoomsService],
})
export class RoomsModule {}
