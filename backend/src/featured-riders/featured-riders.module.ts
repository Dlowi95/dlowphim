import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { FeaturedRidersController } from './featured-riders.controller';
import { FeaturedRidersService } from './featured-riders.service';
import { FeaturedRider, FeaturedRiderSchema } from './schemas/featured-rider.schema';

import { User, UserSchema } from '../auth/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeaturedRider.name, schema: FeaturedRiderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MulterModule.register({ dest: 'uploads/riders' }),
    AuthModule,
  ],
  controllers: [FeaturedRidersController],
  providers: [FeaturedRidersService],
  exports: [FeaturedRidersService],
})
export class FeaturedRidersModule {}
