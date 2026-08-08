import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { MoviesModule } from '../movies/movies.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminJobsService } from './admin-jobs.service';
import { AdminJob, AdminJobSchema } from './schemas/admin-job.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminJob.name, schema: AdminJobSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    MoviesModule,
    SystemSettingsModule,
  ],
  controllers: [AdminJobsController],
  providers: [AdminJobsService],
  exports: [AdminJobsService],
})
export class AdminJobsModule {}
