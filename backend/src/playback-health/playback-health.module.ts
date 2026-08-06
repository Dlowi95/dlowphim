import { Module } from '@nestjs/common';
import { PlaybackHealthController } from './playback-health.controller';
import { PlaybackHealthService } from './playback-health.service';
import { AuthModule } from '../auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { PlaybackHealthRedisStore } from './playback-health-redis.store';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [PlaybackHealthController],
  providers: [PlaybackHealthService, PlaybackHealthRedisStore],
  exports: [PlaybackHealthService],
})
export class PlaybackHealthModule {}
