import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MovieReport, MovieReportDocument } from './schemas/movie-report.schema';

@Injectable()
export class MovieReportsService {
  constructor(
    @InjectModel(MovieReport.name)
    private readonly movieReportModel: Model<MovieReportDocument>,
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
    return newReport.save();
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
    return report.save();
  }

  async deleteReport(id: string) {
    const result = await this.movieReportModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy báo cáo lỗi để xóa');
    }
    return { success: true, message: 'Xóa báo cáo lỗi thành công' };
  }
}
