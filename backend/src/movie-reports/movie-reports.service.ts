import { Injectable, NotFoundException } from '@nestjs/common';
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
    dto: {
      movieSlug: string;
      movieName: string;
      episodeName: string;
      errorType: string;
      description?: string;
    },
  ) {
    const newReport = new this.movieReportModel({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      movieSlug: dto.movieSlug,
      movieName: dto.movieName,
      episodeName: dto.episodeName,
      errorType: dto.errorType,
      description: dto.description,
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

    return saved;
  }

  async getReportsForAdmin() {
    return this.movieReportModel
      .find()
      .sort({ createdAt: -1 })
      .populate('userId', 'email displayName')
      .exec();
  }

  async updateStatus(id: string, status: string) {
    const report = await this.movieReportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo lỗi');
    }
    report.status = status;

    // Khi cập nhật sang trạng thái khác pending (resolved hoặc ignored), ta xóa thông báo đi
    if (status !== 'pending') {
      await this.notificationsService.deleteByTargetId(id);
    }
    
    return report.save();
  }

  async deleteReport(id: string) {
    const result = await this.movieReportModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy báo cáo lỗi để xóa');
    }
    // Xóa thông báo đi kèm
    await this.notificationsService.deleteByTargetId(id);
    return { success: true, message: 'Xóa báo cáo lỗi thành công' };
  }
}
