import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';
import { Report, ReportDocument } from '../comments/schemas/report.schema';
import {
  MovieReport,
  MovieReportDocument,
} from '../movie-reports/schemas/movie-report.schema';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PlaybackHealthService } from '../playback-health/playback-health.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

type PeriodCounts = { current: number; previous: number };
type SourceHealth = {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number | null;
  statusCode: number | null;
  checkedAt: string;
};

@Injectable()
export class AdminDashboardService {
  private sourceHealthCache: { expiresAt: number; value: SourceHealth[] } | null = null;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Report.name)
    private readonly commentReportModel: Model<ReportDocument>,
    @InjectModel(MovieReport.name)
    private readonly movieReportModel: Model<MovieReportDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly playbackHealthService: PlaybackHealthService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async getDashboard() {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalUsers,
      totalComments,
      commentReports,
      pendingMovieReports,
      totalViewsResult,
      userPeriods,
      commentPeriods,
      viewPeriods,
      commentMonths,
      viewMonths,
      pendingReportItems,
      playbackHealth,
      movieSourceHealth,
    ] = await Promise.all([
      this.userModel.countDocuments({}),
      this.commentModel.countDocuments({}),
      this.commentReportModel.countDocuments({}),
      this.movieReportModel.countDocuments({ status: 'pending' }),
      this.userModel.aggregate([
        { $project: { count: { $size: { $ifNull: ['$watchHistory', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]),
      this.countDocumentPeriods(this.userModel, previousStart, currentStart),
      this.countDocumentPeriods(this.commentModel, previousStart, currentStart),
      this.countWatchPeriods(previousStart, currentStart),
      this.aggregateMonths(this.commentModel, sixMonthsAgo),
      this.aggregateWatchMonths(sixMonthsAgo),
      this.movieReportModel
        .find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean(),
      this.playbackHealthService.getAdminDashboard(),
      this.getMovieSourceHealth(),
    ]);

    const chartData = this.createMonthSeries(now, commentMonths, viewMonths);
    const totalViews = Number(totalViewsResult?.[0]?.total || 0);

    return {
      generatedAt: now.toISOString(),
      totals: {
        users: totalUsers,
        views: totalViews,
        comments: totalComments,
        activeReports: commentReports + pendingMovieReports,
      },
      trends: {
        users: this.toTrend(userPeriods),
        views: this.toTrend(viewPeriods),
        comments: this.toTrend(commentPeriods),
      },
      chartData,
      moderationQueue: {
        total: commentReports + pendingMovieReports,
        commentReports,
        movieReports: pendingMovieReports,
        latestMovieReports: pendingReportItems,
      },
      movieSources: movieSourceHealth,
      playbackHealth: {
        summary: playbackHealth.summary,
        problems: playbackHealth.origins
          .filter((origin) => origin.status !== 'healthy')
          .slice(0, 5),
      },
      systemStatus: {
        api: true,
        database: this.connection.readyState === 1,
        socket: this.notificationsGateway.isReady(),
        socketClients: this.notificationsGateway.getConnectedClients(),
      },
    };
  }

  async getMovieSourceHealth(): Promise<SourceHealth[]> {
    const now = Date.now();
    if (this.sourceHealthCache && this.sourceHealthCache.expiresAt > now) {
      return this.sourceHealthCache.value;
    }

    const settings = await this.systemSettingsService.getSettings();
    const sources = (settings.movieSources || []).slice(0, 6);
    const results = await Promise.all(
      sources.map(async (source) => {
        const startedAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        let statusCode: number | null = null;

        try {
          const response = await fetch(source.crawlUrl || source.domain, {
            method: 'GET',
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          statusCode = response.status;
          const latencyMs = Date.now() - startedAt;
          void response.body?.cancel().catch(() => undefined);
          return {
            id: source.id,
            name: source.name,
            domain: source.domain,
            active: settings.activeMovieSourceId === source.id,
            status: response.ok
              ? latencyMs >= 2500
                ? ('degraded' as const)
                : ('healthy' as const)
              : ('offline' as const),
            latencyMs,
            statusCode,
            checkedAt: new Date().toISOString(),
          };
        } catch {
          return {
            id: source.id,
            name: source.name,
            domain: source.domain,
            active: settings.activeMovieSourceId === source.id,
            status: 'offline' as const,
            latencyMs: null,
            statusCode,
            checkedAt: new Date().toISOString(),
          };
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    this.sourceHealthCache = { expiresAt: now + 60_000, value: results };
    return results;
  }

  private async countDocumentPeriods(
    model: Model<any>,
    previousStart: Date,
    currentStart: Date,
  ): Promise<PeriodCounts> {
    const [result] = await model.aggregate([
      { $match: { createdAt: { $gte: previousStart } } },
      {
        $group: {
          _id: null,
          current: {
            $sum: { $cond: [{ $gte: ['$createdAt', currentStart] }, 1, 0] },
          },
          previous: {
            $sum: { $cond: [{ $lt: ['$createdAt', currentStart] }, 1, 0] },
          },
        },
      },
    ]);
    return { current: result?.current || 0, previous: result?.previous || 0 };
  }

  private async countWatchPeriods(
    previousStart: Date,
    currentStart: Date,
  ): Promise<PeriodCounts> {
    const [result] = await this.userModel.aggregate([
      { $unwind: '$watchHistory' },
      { $match: { 'watchHistory.updatedAt': { $gte: previousStart } } },
      {
        $group: {
          _id: null,
          current: {
            $sum: {
              $cond: [{ $gte: ['$watchHistory.updatedAt', currentStart] }, 1, 0],
            },
          },
          previous: {
            $sum: {
              $cond: [{ $lt: ['$watchHistory.updatedAt', currentStart] }, 1, 0],
            },
          },
        },
      },
    ]);
    return { current: result?.current || 0, previous: result?.previous || 0 };
  }

  private aggregateMonths(model: Model<any>, from: Date) {
    return model.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$createdAt',
              format: '%Y-%m',
              timezone: 'Asia/Ho_Chi_Minh',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  private aggregateWatchMonths(from: Date) {
    return this.userModel.aggregate([
      { $unwind: '$watchHistory' },
      { $match: { 'watchHistory.updatedAt': { $gte: from } } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$watchHistory.updatedAt',
              format: '%Y-%m',
              timezone: 'Asia/Ho_Chi_Minh',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  private createMonthSeries(
    now: Date,
    commentMonths: Array<{ _id: string; count: number }>,
    viewMonths: Array<{ _id: string; count: number }>,
  ) {
    const comments = new Map(commentMonths.map((item) => [item._id, item.count]));
    const views = new Map(viewMonths.map((item) => [item._id, item.count]));
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        month: `T${date.getMonth() + 1}`,
        LuotXem: views.get(key) || 0,
        BinhLuan: comments.get(key) || 0,
      };
    });
  }

  private toTrend(period: PeriodCounts) {
    if (period.previous === 0) {
      return {
        percent: period.current === 0 ? 0 : 100,
        current: period.current,
        previous: period.previous,
      };
    }
    return {
      percent: Number(
        (((period.current - period.previous) / period.previous) * 100).toFixed(1),
      ),
      current: period.current,
      previous: period.previous,
    };
  }
}
