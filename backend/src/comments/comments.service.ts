import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Report, ReportDocument } from './schemas/report.schema';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly notificationsService: NotificationsService,
  ) {}

  async getComments(movieSlug: string, currentUserId?: string) {
    const comments = await this.commentModel
      .find({ movieSlug })
      .populate('userId', 'displayName avatar role')
      .sort({ createdAt: -1 })
      .exec();

    return comments.map((c) => {
      const userObj = c.userId as any;
      const finalDisplayName = userObj?.displayName || c.displayName;
      const finalAvatarUrl = userObj?.avatar || c.avatar;
      const finalRole = userObj?.role || c.role || 'member';

      const summaryMap: Record<string, number> = {};
      c.reactions?.forEach((r) => {
        summaryMap[r.type] = (summaryMap[r.type] || 0) + 1;
      });
      const reactionsSummary = Object.keys(summaryMap).map((type) => ({
        type,
        count: summaryMap[type],
      }));
      const userReaction = currentUserId
        ? c.reactions?.find((r) => r.userId.toString() === currentUserId.toString())?.type || null
        : null;

      return {
        id: c._id.toString(),
        userId: userObj?._id?.toString() || c.userId.toString(),
        name: finalDisplayName,
        avatar: finalDisplayName ? finalDisplayName[0].toUpperCase() : 'U',
        avatarUrl: finalAvatarUrl || undefined,
        role: finalRole,
        content: c.content,
        time: getFormattedDate((c as any).createdAt || new Date()),
        isSpoiler: c.isSpoiler,
        episodeLabel: c.episodeLabel,
        parentId: c.parentId ? c.parentId.toString() : null,
        reactionsSummary,
        userReaction,
      };
    });
  }

  async createComment(
    userId: string,
    movieSlug: string,
    createDto: { content: string; isSpoiler?: boolean; episodeLabel?: string; parentId?: string; replyToUserId?: string },
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
    });

    const saved = await newComment.save();

    // Tự động tạo thông báo cho người viết bình luận cha hoặc người được reply khi có người reply
    if (createDto.parentId) {
      try {
        const parentComment = await this.commentModel.findById(createDto.parentId).exec();
        if (parentComment) {
          // Ưu tiên targetUserId gửi từ Frontend, nếu không có thì fallback về chủ bình luận cha
          const targetUserIdStr = createDto.replyToUserId || parentComment.userId?.toString();

          if (targetUserIdStr && targetUserIdStr !== userId) {
            await this.notificationsService.createUserNotification({
              userId: new Types.ObjectId(targetUserIdStr),
              type: 'reply',
              title: 'Phản hồi bình luận mới',
              content: `${user.displayName} đã trả lời bình luận của bạn.`,
              link: `/movie/${movieSlug}#movie-comments`,
            });
          }
        }
      } catch (err) {
        console.error('Lỗi tạo thông báo khi reply comment:', err);
      }
    }

    return {
      id: saved._id.toString(),
      userId: saved.userId.toString(),
      name: saved.displayName,
      avatar: saved.displayName ? saved.displayName[0].toUpperCase() : 'U',
      avatarUrl: saved.avatar || undefined,
      role: saved.role,
      content: saved.content,
      time: getFormattedDate((saved as any).createdAt || new Date()),
      isSpoiler: saved.isSpoiler,
      episodeLabel: saved.episodeLabel,
      parentId: saved.parentId ? saved.parentId.toString() : null,
      reactionsSummary: [],
      userReaction: null,
    };
  }
  async toggleReaction(commentId: string, userId: string, reactionType: string) {
    const comment = await this.commentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    const userIdObj = new Types.ObjectId(userId);
    if (!comment.reactions) {
      comment.reactions = [];
    }

    const existingIndex = comment.reactions.findIndex((r) => r.userId.toString() === userId);

    if (existingIndex > -1) {
      const existingReaction = comment.reactions[existingIndex];
      if (existingReaction.type === reactionType) {
        // Hủy react nếu cùng loại
        comment.reactions.splice(existingIndex, 1);
      } else {
        // Thay thế bằng loại mới
        comment.reactions[existingIndex].type = reactionType;
      }
    } else {
      // Thêm react mới
      comment.reactions.push({ userId: userIdObj, type: reactionType });
    }

    const saved = await comment.save();

    const summaryMap: Record<string, number> = {};
    saved.reactions.forEach((r) => {
      summaryMap[r.type] = (summaryMap[r.type] || 0) + 1;
    });

    const reactionsSummary = Object.keys(summaryMap).map((type) => ({
      type,
      count: summaryMap[type],
    }));

    const userReaction = saved.reactions.find((r) => r.userId.toString() === userId)?.type || null;

    return {
      reactionsSummary,
      userReaction,
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

    console.log('--- DEBUG DELETE COMMENT ---', {
      commentId,
      commentUserId: comment.userId.toString(),
      requestUserId: userId,
      userRole,
      isOwner: comment.userId.toString() === userId,
      isAdmin: userRole === 'admin',
      willAllow: comment.userId.toString() === userId || userRole === 'admin'
    });

    // Kiểm tra quyền xóa: người tạo hoặc admin
    if (comment.userId.toString() !== userId && userRole !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    // Xóa cascade: Nếu là bình luận gốc, xóa tất cả các câu trả lời con
    if (!comment.parentId) {
      await this.commentModel.deleteMany({ parentId: new Types.ObjectId(commentId) }).exec();
    }

    // Lấy danh sách báo cáo liên quan đến bình luận này để xóa thông báo tương ứng
    const relatedReports = await this.reportModel.find({ commentId: new Types.ObjectId(commentId) }).exec();
    for (const r of relatedReports) {
      await this.notificationsService.deleteByTargetId(r._id);
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

    const savedReport = await report.save();

    const reporter = await this.userModel.findById(reporterId).select('displayName').exec();

    // Tạo thông báo cho Admin
    await this.notificationsService.createNotification({
      type: 'comment_report',
      title: `${reporter?.displayName || 'Thành viên'} báo xấu bình luận`,
      subtitle: `Lý do: ${savedReport.reason}`,
      content: `"${comment.content || ''}"`,
      targetId: savedReport._id.toString(),
      targetTab: 'comments',
    });

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
    // Xóa thông báo liên quan
    await this.notificationsService.deleteByTargetId(reportId);
    return { success: true, message: 'Đã bỏ qua báo cáo vi phạm thành công' };
  }

  async getAllComments() {
    const comments = await this.commentModel
      .find()
      .populate('userId', 'displayName email avatar')
      .sort({ createdAt: -1 })
      .exec();

    return comments.map((c: any) => {
      return {
        id: c._id.toString(),
        userId: c.userId?._id?.toString() || c.userId?.toString() || '',
        name: c.userId?.displayName || c.displayName || 'Thành viên',
        avatar: c.userId?.avatar || c.avatar || '',
        role: c.role || 'member',
        content: c.content,
        time: getFormattedDate((c as any).createdAt || new Date()),
        isSpoiler: c.isSpoiler,
        episodeLabel: c.episodeLabel,
        parentId: c.parentId ? c.parentId.toString() : null,
        movieSlug: c.movieSlug,
        author: {
          id: c.userId?._id?.toString() || c.userId?.toString() || '',
          name: c.userId?.displayName || c.displayName || 'Thành viên',
          email: c.userId?.email || '',
          avatar: c.userId?.avatar || c.avatar || '',
        }
      };
    });
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
