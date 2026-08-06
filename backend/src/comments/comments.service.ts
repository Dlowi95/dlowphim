import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Report, ReportDocument } from './schemas/report.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { createHash } from 'node:crypto';

const COMMENT_COOLDOWN_MS = 8_000;
const COMMENT_BURST_WINDOW_MS = 60_000;
const COMMENT_BURST_LIMIT = 5;
const COMMENT_HOURLY_LIMIT = 30;
const COMMENT_DUPLICATE_WINDOW_MS = 10 * 60_000;
const MAX_PUBLIC_THREADS = 100;
const MAX_PUBLIC_REPLIES = 1_000;
const MAX_ADMIN_COMMENTS = 2_000;
const MAX_ADMIN_REPORTS = 500;

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
    const roots = await this.commentModel
      .find({ movieSlug, parentId: null })
      .populate('userId', 'displayName avatar role')
      .sort({ createdAt: -1 })
      .limit(MAX_PUBLIC_THREADS)
      .exec();
    const rootIds = roots.map((comment) => comment._id);
    const replies = rootIds.length > 0
      ? await this.commentModel
        .find({ movieSlug, parentId: { $in: rootIds } })
        .populate('userId', 'displayName avatar role')
        .sort({ createdAt: 1 })
        .limit(MAX_PUBLIC_REPLIES)
        .exec()
      : [];
    const comments = [...roots, ...replies];

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
    const normalizedMovieSlug = String(movieSlug || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{1,180}$/.test(normalizedMovieSlug)) {
      throw new BadRequestException('Đường dẫn phim không hợp lệ');
    }

    const content = this.normalizeContent(createDto.content);
    this.validateContent(content);

    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel
      .findById(userObjectId)
      .select('displayName avatar role')
      .exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    let parentComment: CommentDocument | null = null;
    let threadRootId: Types.ObjectId | null = null;
    if (createDto.parentId) {
      if (!Types.ObjectId.isValid(createDto.parentId)) {
        throw new BadRequestException('Bình luận gốc không hợp lệ');
      }
      parentComment = await this.commentModel.findOne({
        _id: new Types.ObjectId(createDto.parentId),
        movieSlug: normalizedMovieSlug,
      }).exec();
      if (!parentComment) {
        throw new BadRequestException('Bình luận gốc không tồn tại trong phim này');
      }
      threadRootId = parentComment.parentId || parentComment._id;
    }

    const contentFingerprint = this.getContentFingerprint(content);
    await this.assertNotSpamming(userObjectId, contentFingerprint);

    const newComment = new this.commentModel({
      movieSlug: normalizedMovieSlug,
      userId: userObjectId,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role || 'member',
      content,
      contentFingerprint,
      rateLimitBucket: Math.floor(Date.now() / COMMENT_COOLDOWN_MS),
      isSpoiler: !!createDto.isSpoiler,
      episodeLabel: this.normalizeEpisodeLabel(createDto.episodeLabel),
      parentId: threadRootId,
    });

    let saved: CommentDocument;
    try {
      saved = await newComment.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        this.throwRateLimit('Bạn gửi bình luận quá nhanh. Vui lòng chờ 8 giây.', 8);
      }
      throw error;
    }

    // Tự động tạo thông báo cho người viết bình luận cha hoặc người được reply khi có người reply
    if (parentComment && threadRootId) {
      try {
        let targetUserId = parentComment.userId;
        if (createDto.replyToUserId && Types.ObjectId.isValid(createDto.replyToUserId)) {
          const requestedTargetId = new Types.ObjectId(createDto.replyToUserId);
          const targetParticipatedInThread = await this.commentModel.exists({
            movieSlug: normalizedMovieSlug,
            userId: requestedTargetId,
            $or: [{ _id: threadRootId }, { parentId: threadRootId }],
          });
          if (targetParticipatedInThread) targetUserId = requestedTargetId;
        }

        if (targetUserId.toString() !== userId) {
          await this.notificationsService.createUserNotification({
            userId: targetUserId,
            type: 'reply',
            title: 'Phản hồi bình luận mới',
            content: `${user.displayName} đã trả lời bình luận của bạn.`,
            link: `/movie/${normalizedMovieSlug}#movie-comments`,
            dedupKey: `comment-reply:${saved._id}`,
          });
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
      movieSlug: comment.movieSlug,
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
    return {
      success: true,
      message: 'Xóa bình luận thành công',
      movieSlug: comment.movieSlug,
    };
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

    let savedReport: ReportDocument;
    try {
      savedReport = await report.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        return { success: true, message: 'Bạn đã báo cáo bình luận này trước đó' };
      }
      throw error;
    }

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
      .populate({
        path: 'commentId',
        populate: { path: 'userId', select: 'displayName email avatar' },
      })
      .populate('reporterId', 'displayName email avatar')
      .sort({ createdAt: -1 })
      .limit(MAX_ADMIN_REPORTS)
      .exec();

    const results: any[] = [];
    for (const r of reports) {
      if (!r.commentId) continue;
      
      const c = r.commentId as any;
      const author = c.userId as any;

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
            id: author?._id?.toString() || c.userId?.toString() || '',
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
      .select('-reactions -contentFingerprint -rateLimitBucket')
      .populate('userId', 'displayName email avatar role')
      .sort({ createdAt: -1 })
      .limit(MAX_ADMIN_COMMENTS)
      .exec();

    return comments.map((c: any) => {
      return {
        id: c._id.toString(),
        userId: c.userId?._id?.toString() || c.userId?.toString() || '',
        name: c.userId?.displayName || c.displayName || 'Thành viên',
        avatar: c.userId?.avatar || c.avatar || '',
        role: c.userId?.role || c.role || 'member',
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

  private normalizeContent(value?: string) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private normalizeEpisodeLabel(value?: string) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized ? normalized.slice(0, 80) : undefined;
  }

  private validateContent(content: string) {
    if (content.length < 2) {
      throw new BadRequestException('Bình luận cần có ít nhất 2 ký tự');
    }
    if (content.length > 1_000) {
      throw new BadRequestException('Bình luận không được vượt quá 1000 ký tự');
    }
    const links = content.match(/(?:https?:\/\/|www\.)/gi) || [];
    if (links.length > 2) {
      throw new BadRequestException('Bình luận chứa quá nhiều liên kết');
    }
    if (/(.)\1{14,}/iu.test(content.replace(/\s/g, ''))) {
      throw new BadRequestException('Bình luận có quá nhiều ký tự lặp lại');
    }
  }

  private getContentFingerprint(content: string) {
    return createHash('sha256')
      .update(content.toLocaleLowerCase('vi-VN'))
      .digest('hex');
  }

  private async assertNotSpamming(userId: Types.ObjectId, contentFingerprint: string) {
    const now = Date.now();
    const recentComments = await this.commentModel
      .find({
        userId,
        createdAt: { $gte: new Date(now - 60 * 60_000) },
      })
      .select('content contentFingerprint createdAt')
      .sort({ createdAt: -1 })
      .limit(COMMENT_HOURLY_LIMIT + 1)
      .lean()
      .exec();

    const latestCreatedAt = recentComments[0]
      ? new Date((recentComments[0] as any).createdAt).getTime()
      : 0;
    const elapsedSinceLatest = now - latestCreatedAt;
    if (latestCreatedAt && elapsedSinceLatest < COMMENT_COOLDOWN_MS) {
      const retryAfter = Math.ceil((COMMENT_COOLDOWN_MS - elapsedSinceLatest) / 1_000);
      this.throwRateLimit(`Bạn gửi bình luận quá nhanh. Vui lòng chờ ${retryAfter} giây.`, retryAfter);
    }

    const burstCount = recentComments.filter((comment: any) => (
      now - new Date(comment.createdAt).getTime() < COMMENT_BURST_WINDOW_MS
    )).length;
    if (burstCount >= COMMENT_BURST_LIMIT) {
      this.throwRateLimit('Bạn đã gửi quá nhiều bình luận trong một phút. Vui lòng thử lại sau.', 60);
    }
    if (recentComments.length >= COMMENT_HOURLY_LIMIT) {
      this.throwRateLimit('Bạn đã đạt giới hạn bình luận trong một giờ. Vui lòng quay lại sau.', 300);
    }

    const hasDuplicate = recentComments.some((comment: any) => {
      const createdAt = new Date(comment.createdAt).getTime();
      if (now - createdAt > COMMENT_DUPLICATE_WINDOW_MS) return false;
      const fingerprint = comment.contentFingerprint
        || this.getContentFingerprint(this.normalizeContent(comment.content));
      return fingerprint === contentFingerprint;
    });
    if (hasDuplicate) {
      throw new BadRequestException('Bạn đã gửi nội dung giống hệt trong 10 phút gần đây');
    }
  }

  private throwRateLimit(message: string, retryAfter: number): never {
    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message, retryAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
