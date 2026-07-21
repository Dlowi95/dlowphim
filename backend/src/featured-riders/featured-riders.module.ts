import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { FeaturedRidersController } from './featured-riders.controller';
import { FeaturedRidersService } from './featured-riders.service';
import { FeaturedRider, FeaturedRiderSchema } from './schemas/featured-rider.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeaturedRider.name, schema: FeaturedRiderSchema },
    ]),
    MulterModule.register({ dest: 'uploads/riders' }),
  ],
  controllers: [FeaturedRidersController],
  providers: [FeaturedRidersService],
  exports: [FeaturedRidersService],
})
export class FeaturedRidersModule {}
