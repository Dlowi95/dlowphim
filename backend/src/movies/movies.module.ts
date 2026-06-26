import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { BlockedMovie, BlockedMovieSchema } from './schemas/blocked-movie.schema';
import { CustomMovie, CustomMovieSchema } from './schemas/custom-movie.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlockedMovie.name, schema: BlockedMovieSchema },
      { name: CustomMovie.name, schema: CustomMovieSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [MoviesController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
