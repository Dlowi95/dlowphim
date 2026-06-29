import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MovieReportsController } from './movie-reports.controller';
import { MovieReportsService } from './movie-reports.service';
import { MovieReport, MovieReportSchema } from './schemas/movie-report.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MovieReport.name, schema: MovieReportSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [MovieReportsController],
  providers: [MovieReportsService],
  exports: [MovieReportsService],
})
export class MovieReportsModule {}
