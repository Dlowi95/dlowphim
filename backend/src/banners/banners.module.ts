import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Banner.name, schema: BannerSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
