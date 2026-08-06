import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';
import { Report, ReportSchema } from '../comments/schemas/report.schema';
import {
  MovieReport,
  MovieReportSchema,
} from '../movie-reports/schemas/movie-report.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlaybackHealthModule } from '../playback-health/playback-health.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Report.name, schema: ReportSchema },
      { name: MovieReport.name, schema: MovieReportSchema },
    ]),
    AuthModule,
    NotificationsModule,
    PlaybackHealthModule,
    SystemSettingsModule,
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
