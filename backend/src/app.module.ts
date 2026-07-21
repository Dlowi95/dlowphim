import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { RatingsModule } from './ratings/ratings.module';
import { MoviesModule } from './movies/movies.module';
import { BannersModule } from './banners/banners.module';
import { MovieReportsModule } from './movie-reports/movie-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { FeaturedRidersModule } from './featured-riders/featured-riders.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    CommentsModule,
    RatingsModule,
    MoviesModule,
    BannersModule,
    MovieReportsModule,
    NotificationsModule,
    SystemSettingsModule,
    RoomsModule,
    FeaturedRidersModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
