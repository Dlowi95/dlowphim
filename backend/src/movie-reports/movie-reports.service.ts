import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MovieReport, MovieReportDocument } from './schemas/movie-report.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MovieReportsService {
  constructor(
    @InjectModel(MovieReport.name)
    private readonly movieReportModel: Model<MovieReportDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReport(
    userId: string | null,
    reporterKey: string,
    dto: {
      movieSlug: string;
      movieName: string;
      episodeName: string;
      episodeSlug?: string;
      errorType: string;
      description?: string;
      playbackType?: string;
      serverName?: string;
      streamOrigin?: string;
      currentTime?: number;
    },
  ) {
    const input = this.normalizeReportInput(dto);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentCount = await this.movieReportModel.countDocuments({
      reporterKey,
      createdAt: { $gte: hourAgo },
    });
    if (recentCount >= 6) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Bạn đã gửi nhiều báo cáo trong một giờ. Vui lòng thử lại sau.',
          retryAfter: 3600,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const duplicateSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const duplicate = await this.movieReportModel.findOne({
      reporterKey,
      movieSlug: input.movieSlug,
      episodeName: input.episodeName,
      errorType: input.errorType,
      status: 'pending',
      lastReportedAt: { $gte: duplicateSince },
    });
    if (duplicate) {
      const lastWriteAt = new Date(duplicate.lastReportedAt).getTime();
      if (Number.isFinite(lastWriteAt) && now.getTime() - lastWriteAt < 30_000) {
        return {
          success: true,
          deduplicated: true,
          reportId: duplicate._id.toString(),
          message: 'Báo cáo đã được ghi nhận, bạn không cần gửi lại liên tục.',
        };
      }
      duplicate.occurrenceCount = Math.min(Number(duplicate.occurrenceCount || 1) + 1, 999);
      duplicate.lastReportedAt = now;
      if (input.description) duplicate.description = input.description;
      if (input.serverName) duplicate.serverName = input.serverName;
      if (input.streamOrigin) duplicate.streamOrigin = input.streamOrigin;
      if (input.currentTime !== undefined) duplicate.currentTime = input.currentTime;
      await duplicate.save();
      return {
        success: true,
        deduplicated: true,
        reportId: duplicate._id.toString(),
        message: 'Báo cáo này đã được ghi nhận và cập nhật thêm thông tin.',
      };
    }

    const newReport = new this.movieReportModel({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      reporterKey,
      ...input,
      occurrenceCount: 1,
      lastReportedAt: now,
      expiresAt: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
    });
    const saved = await newReport.save();

    const getErrorLabel = (t: string) => {
      if (t === 'video_broken') return 'Link hỏng / Không phát được';
      if (t === 'audio_issue') return 'Lỗi âm thanh';
      if (t === 'subtitle_issue') return 'Lỗi phụ đề';
      return 'Lỗi khác';
    };

    // Tạo thông báo tương ứng
    await this.notificationsService.createNotification({
      type: 'movie_report',
      title: `Báo lỗi phim: ${saved.movieName}`,
      subtitle: `Sự cố: ${getErrorLabel(saved.errorType)} (${saved.episodeName})`,
      content: saved.description ? `"${saved.description}"` : 'Không có ghi chú chi tiết',
      targetId: saved._id.toString(),
      targetTab: 'reports',
    });

    return {
      success: true,
      deduplicated: false,
      reportId: saved._id.toString(),
      message: 'Gửi báo cáo lỗi thành công. Admin sẽ sớm kiểm tra.',
    };
  }

  async getReportsForAdmin(filters: {
    page?: number;
    limit?: number;
    status?: string;
    errorType?: string;
    search?: string;
  } = {}) {
    const page = Number.isFinite(filters.page) && Number(filters.page) > 0
      ? Math.floor(Number(filters.page))
      : 1;
    const limit = Number.isFinite(filters.limit) && Number(filters.limit) > 0
      ? Math.min(50, Math.floor(Number(filters.limit)))
      : 20;
    const query: Record<string, any> = {};
    const statuses = ['pending', 'resolved', 'ignored'];
    const errorTypes = ['video_broken', 'audio_issue', 'subtitle_issue', 'other'];
    if (filters.status && filters.status !== 'all') {
      if (!statuses.includes(filters.status)) throw new BadRequestException('Trạng thái báo cáo không hợp lệ');
      query.status = filters.status;
    }
    if (filters.errorType && filters.errorType !== 'all') {
      if (!errorTypes.includes(filters.errorType)) throw new BadRequestException('Loại lỗi không hợp lệ');
      query.errorType = filters.errorType;
    }
    const search = String(filters.search || '').trim().slice(0, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { movieName: regex },
        { movieSlug: regex },
        { episodeName: regex },
        { description: regex },
      ];
    }

    const [items, total, pending, resolved, ignored] = await Promise.all([
      this.movieReportModel
        .find(query)
        .sort({ lastReportedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'email displayName avatar')
        .populate('handledBy', 'displayName')
        .lean()
        .exec(),
      this.movieReportModel.countDocuments(query),
      this.movieReportModel.countDocuments({ status: 'pending' }),
      this.movieReportModel.countDocuments({ status: 'resolved' }),
      this.movieReportModel.countDocuments({ status: 'ignored' }),
    ]);
    return {
      items,
      total,
      counts: { pending, resolved, ignored, all: pending + resolved + ignored },
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
    };
  }

  async updateStatus(id: string, status: string, adminId: string, resolutionNote?: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã báo cáo không hợp lệ');
    if (!['pending', 'resolved', 'ignored'].includes(status)) {
      throw new BadRequestException('Trạng thái báo cáo không hợp lệ');
    }
    const report = await this.movieReportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo lỗi');
    }
    const previousStatus = report.status;
    report.status = status;
    report.resolutionNote = this.cleanText(resolutionNote, 300) || undefined;
    report.handledBy = new Types.ObjectId(adminId);
    report.handledAt = status === 'pending' ? undefined : new Date();
    report.expiresAt = new Date(
      Date.now() + (status === 'pending' ? 180 : 90) * 24 * 60 * 60 * 1000,
    );

    // Khi cập nhật sang trạng thái khác pending (resolved hoặc ignored), ta xóa thông báo đi
    if (status !== 'pending') {
      await this.notificationsService.deleteByTargetId(id);
    }
    
    const saved = await report.save();
    if (report.userId && previousStatus !== status && status !== 'pending') {
      await this.notificationsService.createUserNotification({
        userId: report.userId,
        type: 'movie_report_status',
        title: status === 'resolved' ? 'Báo cáo lỗi đã được xử lý' : 'Báo cáo lỗi đã được kiểm tra',
        content: status === 'resolved'
          ? `Sự cố ${report.episodeName} của “${report.movieName}” đã được đánh dấu khắc phục.`
          : `Báo cáo ${report.episodeName} của “${report.movieName}” đã được kiểm tra và chưa ghi nhận lỗi.`,
        link: `/watch/${report.movieSlug}`,
        dedupKey: `movie-report-status:${report._id}:${status}`,
      });
    }
    return saved;
  }

  async deleteReport(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã báo cáo không hợp lệ');
    const result = await this.movieReportModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy báo cáo lỗi để xóa');
    }
    // Xóa thông báo đi kèm
    await this.notificationsService.deleteByTargetId(id);
    return { success: true, message: 'Xóa báo cáo lỗi thành công' };
  }

  private normalizeReportInput(dto: any) {
    const movieSlug = String(dto?.movieSlug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(movieSlug)) {
      throw new BadRequestException('Slug phim không hợp lệ');
    }
    const movieName = this.cleanText(dto?.movieName, 200);
    const episodeName = this.cleanText(dto?.episodeName, 80);
    if (!movieName || !episodeName) {
      throw new BadRequestException('Thiếu thông tin phim hoặc tập phim');
    }
    const errorTypes = ['video_broken', 'audio_issue', 'subtitle_issue', 'other'];
    const errorType = String(dto?.errorType || '');
    if (!errorTypes.includes(errorType)) {
      throw new BadRequestException('Loại lỗi không hợp lệ');
    }
    const playbackType = ['hls', 'embed'].includes(dto?.playbackType)
      ? dto.playbackType
      : 'unknown';
    let streamOrigin = '';
    if (dto?.streamOrigin) {
      try {
        streamOrigin = new URL(String(dto.streamOrigin)).origin.slice(0, 300);
      } catch {
        streamOrigin = '';
      }
    }
    const currentTime = Number(dto?.currentTime);
    return {
      movieSlug,
      movieName,
      episodeName,
      episodeSlug: this.cleanText(dto?.episodeSlug, 100) || undefined,
      errorType,
      description: this.cleanText(dto?.description, 500) || undefined,
      playbackType,
      serverName: this.cleanText(dto?.serverName, 120) || undefined,
      streamOrigin: streamOrigin || undefined,
      currentTime: Number.isFinite(currentTime)
        ? Math.max(0, Math.min(Math.floor(currentTime), 24 * 60 * 60))
        : undefined,
    };
  }

  private cleanText(value: any, maxLength: number) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }
}
