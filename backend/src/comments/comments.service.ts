import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Report, ReportDocument } from './schemas/report.schema';

function getFormattedDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
  ) {}

  async getComments(movieSlug: string, currentUserId?: string) {
    const comments = await this.commentModel
      .find({ movieSlug })
      .sort({ createdAt: -1 })
      .exec();

    const userIdObj = currentUserId ? new Types.ObjectId(currentUserId) : null;

    return comments.map((c) => {
      const upvotesCount = c.upvotes ? c.upvotes.length : 0;
      const downvotesCount = c.downvotes ? c.downvotes.length : 0;

      let userVote: 'up' | 'down' | null = null;
      if (userIdObj) {
        if (c.upvotes?.some((id) => id.toString() === userIdObj.toString())) {
          userVote = 'up';
        } else if (c.downvotes?.some((id) => id.toString() === userIdObj.toString())) {
          userVote = 'down';
        }
      }

      return {
        id: c._id.toString(),
        userId: c.userId.toString(),
        name: c.displayName,
        avatar: c.displayName ? c.displayName[0].toUpperCase() : 'U',
        avatarUrl: c.avatar || undefined,
        role: c.role || 'member',
        content: c.content,
        time: getFormattedDate((c as any).createdAt || new Date()),
        likes: upvotesCount - downvotesCount,
        liked: userVote === 'up',
        userVote,
        isSpoiler: c.isSpoiler,
        episodeLabel: c.episodeLabel,
        parentId: c.parentId ? c.parentId.toString() : null,
      };
    });
  }

  async createComment(
    userId: string,
    movieSlug: string,
    createDto: { content: string; isSpoiler?: boolean; episodeLabel?: string; parentId?: string },
  ) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const newComment = new this.commentModel({
      movieSlug,
      userId: new Types.ObjectId(userId),
      displayName: user.displayName,
      avatar: user.avatar,
      role: 'member', // Default to member role
      content: createDto.content,
      isSpoiler: !!createDto.isSpoiler,
      episodeLabel: createDto.episodeLabel,
      parentId: createDto.parentId ? new Types.ObjectId(createDto.parentId) : null,
      upvotes: [],
      downvotes: [],
    });

    const saved = await newComment.save();
    return {
      id: saved._id.toString(),
      userId: saved.userId.toString(),
      name: saved.displayName,
      avatar: saved.displayName ? saved.displayName[0].toUpperCase() : 'U',
      avatarUrl: saved.avatar || undefined,
      role: saved.role,
      content: saved.content,
      time: getFormattedDate((saved as any).createdAt || new Date()),
      likes: 0,
      liked: false,
      userVote: null,
      isSpoiler: saved.isSpoiler,
      episodeLabel: saved.episodeLabel,
      parentId: saved.parentId ? saved.parentId.toString() : null,
    };
  }

  async toggleVote(commentId: string, userId: string, voteType: 'up' | 'down') {
    const comment = await this.commentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    const userIdObj = new Types.ObjectId(userId);

    const hasUpvoted = comment.upvotes?.some((id) => id.toString() === userId);
    const hasDownvoted = comment.downvotes?.some((id) => id.toString() === userId);

    if (voteType === 'up') {
      if (hasUpvoted) {
        // Toggle off
        comment.upvotes = comment.upvotes.filter((id) => id.toString() !== userId);
      } else {
        // Toggle on upvote, remove from downvote
        comment.upvotes = [...(comment.upvotes || []), userIdObj];
        comment.downvotes = (comment.downvotes || []).filter((id) => id.toString() !== userId);
      }
    } else {
      if (hasDownvoted) {
        // Toggle off
        comment.downvotes = comment.downvotes.filter((id) => id.toString() !== userId);
      } else {
        // Toggle on downvote, remove from upvote
        comment.downvotes = [...(comment.downvotes || []), userIdObj];
        comment.upvotes = (comment.upvotes || []).filter((id) => id.toString() !== userId);
      }
    }

    const saved = await comment.save();

    const upvotesCount = saved.upvotes ? saved.upvotes.length : 0;
    const downvotesCount = saved.downvotes ? saved.downvotes.length : 0;

    let userVote: 'up' | 'down' | null = null;
    if (saved.upvotes?.some((id) => id.toString() === userId)) {
      userVote = 'up';
    } else if (saved.downvotes?.some((id) => id.toString() === userId)) {
      userVote = 'down';
    }

    return {
      likes: upvotesCount - downvotesCount,
      liked: userVote === 'up',
      userVote,
    };
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.commentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    // Lấy thông tin user hiện tại để kiểm tra role
    const user = await this.userModel.findById(userId).exec();
    const userRole = user?.role || 'member';

    // Kiểm tra quyền xóa: người tạo hoặc admin
    if (comment.userId.toString() !== userId && userRole !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    // Xóa cascade: Nếu là bình luận gốc, xóa tất cả các câu trả lời con
    if (!comment.parentId) {
      await this.commentModel.deleteMany({ parentId: new Types.ObjectId(commentId) }).exec();
    }

    // Xóa các báo cáo liên quan đến bình luận này
    await this.reportModel.deleteMany({ commentId: new Types.ObjectId(commentId) }).exec();

    // Thực hiện xóa chính bình luận
    await this.commentModel.findByIdAndDelete(commentId).exec();
    return { success: true, message: 'Xóa bình luận thành công' };
  }

  async reportComment(commentId: string, reporterId: string, reason?: string) {
    const comment = await this.commentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận để báo cáo');
    }

    // Kiểm tra xem đã báo cáo chưa để tránh spam duplicate
    const existing = await this.reportModel.findOne({
      commentId: new Types.ObjectId(commentId),
      reporterId: new Types.ObjectId(reporterId),
    }).exec();

    if (existing) {
      return { success: true, message: 'Bạn đã báo cáo bình luận này trước đó' };
    }

    const report = new this.reportModel({
      commentId: new Types.ObjectId(commentId),
      reporterId: new Types.ObjectId(reporterId),
      reason: reason || 'Nội dung không phù hợp / Spam',
    });

    await report.save();
    return { success: true, message: 'Gửi báo cáo vi phạm thành công' };
  }

  async getReportedComments() {
    const reports = await this.reportModel
      .find()
      .populate('commentId')
      .populate('reporterId', 'displayName email avatar')
      .sort({ createdAt: -1 })
      .exec();

    const results: any[] = [];
    for (const r of reports) {
      if (!r.commentId) continue;
      
      const c = r.commentId as any;
      const author = await this.userModel.findById(c.userId).select('displayName email avatar').exec();

      results.push({
        id: r._id.toString(),
        reason: r.reason,
        createdAt: (r as any).createdAt,
        comment: {
          id: c._id.toString(),
          content: c.content,
          movieSlug: c.movieSlug,
          time: getFormattedDate(c.createdAt || new Date()),
          author: {
            id: c.userId.toString(),
            name: author?.displayName || 'Thành viên',
            email: author?.email || '',
            avatar: author?.avatar || '',
          }
        },
        reporter: {
          id: (r.reporterId as any)?._id?.toString() || '',
          name: (r.reporterId as any)?.displayName || 'Thành viên',
          email: (r.reporterId as any)?.email || '',
          avatar: (r.reporterId as any)?.avatar || '',
        }
      });
    }
    return results;
  }

  async dismissReport(reportId: string) {
    const report = await this.reportModel.findByIdAndDelete(reportId).exec();
    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo vi phạm');
    }
    return { success: true, message: 'Đã bỏ qua báo cáo vi phạm thành công' };
  }

  async getAdminStats() {
    const totalUsers = await this.userModel.countDocuments({}).exec();
    const totalComments = await this.commentModel.countDocuments({}).exec();
    const activeReports = await this.reportModel.countDocuments({}).exec();

    const users = await this.userModel.find({}, 'watchHistory').exec();
    let totalViews = 0;
    users.forEach((u) => {
      totalViews += u.watchHistory ? u.watchHistory.length : 0;
    });

    const chartData: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthLabel = `T${monthIndex + 1}`;
      chartData.push({
        year,
        monthIndex,
        month: monthLabel,
        LuotXem: 0,
        BinhLuan: 0,
      });
    }

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const comments = await this.commentModel.find({
      createdAt: { $gte: sixMonthsAgo }
    }).exec();

    comments.forEach((c: any) => {
      const cDate = new Date(c.createdAt || new Date());
      const match = chartData.find(
        (m) => m.year === cDate.getFullYear() && m.monthIndex === cDate.getMonth()
      );
      if (match) {
        match.BinhLuan += 1;
      }
    });

    users.forEach((u) => {
      if (u.watchHistory) {
        u.watchHistory.forEach((item) => {
          const vDate = new Date(item.updatedAt || new Date());
          if (vDate >= sixMonthsAgo) {
            const match = chartData.find(
              (m) => m.year === vDate.getFullYear() && m.monthIndex === vDate.getMonth()
            );
            if (match) {
              match.LuotXem += 1;
            }
          }
        });
      }
    });

    return {
      totalUsers,
      totalComments,
      activeReports,
      totalViews,
      chartData: chartData.map((d) => ({
        month: d.month,
        LuotXem: d.LuotXem,
        BinhLuan: d.BinhLuan,
      })),
    };
  }
}
