import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { BlockedMovie, BlockedMovieSchema } from './schemas/blocked-movie.schema';
import { CustomMovie, CustomMovieSchema } from './schemas/custom-movie.schema';
import { MovieLogo, MovieLogoSchema } from './schemas/movie-logo.schema';
import { MovieOverride, MovieOverrideSchema } from './schemas/movie-override.schema';
import { MovieRelease, MovieReleaseSchema } from './schemas/movie-release.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlockedMovie.name, schema: BlockedMovieSchema },
      { name: CustomMovie.name, schema: CustomMovieSchema },
      { name: MovieLogo.name, schema: MovieLogoSchema },
      { name: MovieOverride.name, schema: MovieOverrideSchema },
      { name: MovieRelease.name, schema: MovieReleaseSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    SystemSettingsModule,
    NotificationsModule,
  ],
  controllers: [MoviesController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
