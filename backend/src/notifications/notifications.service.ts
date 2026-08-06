import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { UserNotification, UserNotificationDocument } from './schemas/user-notification.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { NotificationsGateway } from './notifications.gateway';
import {
  NotificationCampaign,
  NotificationCampaignDocument,
} from './schemas/notification-campaign.schema';

const MAX_USER_NOTIFICATIONS = 300;
const USER_NOTIFICATION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const DEFAULT_DEDUP_WINDOW_MS = 60_000;
const ADMIN_NOTIFICATION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(UserNotification.name)
    private readonly userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsGateway: NotificationsGateway,
    @Optional()
    @InjectModel(NotificationCampaign.name)
    private readonly campaignModel?: Model<NotificationCampaignDocument>,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.userNotificationModel.updateMany(
        { expiresAt: { $exists: false } },
        { $set: { expiresAt: new Date(Date.now() + USER_NOTIFICATION_RETENTION_MS) } },
      ),
      this.notificationModel.updateMany(
        { expiresAt: { $exists: false } },
        { $set: { expiresAt: new Date(Date.now() + ADMIN_NOTIFICATION_RETENTION_MS) } },
      ),
    ]);
    if (this.campaignModel) {
      await this.campaignModel.updateMany(
        {
          status: 'sending',
          $or: [
            { processingStartedAt: { $exists: false } },
            { processingStartedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } },
          ],
        },
        { $set: { status: 'queued' } },
      ).exec();
      const queued = await this.campaignModel
        .find({ status: 'queued' })
        .sort({ createdAt: 1 })
        .limit(10)
        .select('_id')
        .lean()
        .exec();
      queued.forEach((campaign) => {
        void this.processBroadcast(String(campaign._id));
      });
    }
  }

  private normalizePagination(page = 1, limit = 15) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(50, Math.max(1, Math.floor(limit)))
      : 15;
    return { page: safePage, limit: safeLimit };
  }

  private toObjectId(value: string, label = 'ID') {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${label} không hợp lệ`);
    }
    return new Types.ObjectId(value);
  }

  private normalizeInternalLink(link?: string) {
    if (!link) return undefined;
    const normalized = String(link).trim();
    if (!normalized.startsWith('/') || normalized.startsWith('//')) {
      return undefined;
    }
    return normalized.slice(0, 500);
  }

  private async getUnreadCount(userId: Types.ObjectId) {
    return this.userNotificationModel.countDocuments({
      userId,
      isRead: false,
    });
  }

  private async trimUserNotifications(userId: Types.ObjectId) {
    const stale = await this.userNotificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(MAX_USER_NOTIFICATIONS)
      .select('_id')
      .lean();
    if (stale.length) {
      await this.userNotificationModel.deleteMany({
        _id: { $in: stale.map((item) => item._id) },
      });
    }
  }

  async createNotification(data: {
    type: string;
    title: string;
    subtitle?: string;
    content?: string;
    targetId: string | Types.ObjectId;
    targetTab: string;
  }) {
    const type = this.cleanText(data.type, 60);
    const title = this.cleanText(data.title, 160);
    const targetTab = this.cleanText(data.targetTab, 40);
    if (!type || !title || !['reports', 'comments'].includes(targetTab)) {
      throw new BadRequestException('Dữ liệu cảnh báo quản trị không hợp lệ');
    }
    const targetId = typeof data.targetId === 'string'
      ? this.toObjectId(data.targetId, 'Đối tượng thông báo')
      : data.targetId;
    const dedupKey = createHash('sha256')
      .update(`${type}|${String(targetId)}|${targetTab}`)
      .digest('hex');
    const notif = await this.notificationModel.findOneAndUpdate({ dedupKey }, {
      $setOnInsert: {
      type,
      title,
      subtitle: this.cleanText(data.subtitle, 200) || undefined,
      content: this.cleanText(data.content, 500) || undefined,
      targetId,
      targetTab,
      isRead: false,
      dedupKey,
      expiresAt: new Date(Date.now() + ADMIN_NOTIFICATION_RETENTION_MS),
      },
    }, { upsert: true, returnDocument: 'after' }).exec();
    this.notificationsGateway.emitToAdmins('notifications:changed', {
      action: 'admin-alert',
      notificationId: notif?._id,
    });
    return notif;
  }

  async getNotifications(
    adminId: string,
    page = 1,
    limit = 10,
    filters: { read?: string; type?: string; search?: string } = {},
  ) {
    const pagination = this.normalizePagination(page, limit);
    const adminObjId = this.toObjectId(adminId, 'Admin');
    const query: Record<string, any> = { archivedBy: { $ne: adminObjId } };
    if (filters.read === 'unread') query.readBy = { $ne: adminObjId };
    if (filters.read === 'read') query.readBy = adminObjId;
    if (filters.type && filters.type !== 'all') {
      if (!['movie_report', 'comment_report', 'system'].includes(filters.type)) {
        throw new BadRequestException('Loại thông báo không hợp lệ');
      }
      query.type = filters.type;
    }
    const search = this.cleanText(filters.search, 100);
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { subtitle: regex }, { content: regex }];
    }

    const [rawItems, total, unreadCount] = await Promise.all([
      this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean()
      .exec(),
      this.notificationModel.countDocuments(query).exec(),
      this.notificationModel.countDocuments({
        archivedBy: { $ne: adminObjId },
        readBy: { $ne: adminObjId },
      }).exec(),
    ]);
    const items = rawItems.map((item: any) => ({
      ...item,
      isRead: (item.readBy || []).some((id: any) => String(id) === adminId),
    }));

    return {
      items,
      total,
      unreadCount,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      currentPage: pagination.page,
      limit: pagination.limit,
    };
  }

  async markAsRead(adminId: string, id: string) {
    const adminObjId = this.toObjectId(adminId, 'Admin');
    const notificationId = this.toObjectId(id, 'Thông báo');
    const notif = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, archivedBy: { $ne: adminObjId } },
      { $addToSet: { readBy: adminObjId } },
      { returnDocument: 'after' },
    ).exec();
    if (!notif) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    return notif;
  }

  async markAllAsRead(adminId: string) {
    const adminObjId = this.toObjectId(adminId, 'Admin');
    await this.notificationModel.updateMany(
      { archivedBy: { $ne: adminObjId }, readBy: { $ne: adminObjId } },
      { $addToSet: { readBy: adminObjId } },
    ).exec();
    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  async deleteByTargetId(targetId: string | Types.ObjectId) {
    const tid = typeof targetId === 'string' ? new Types.ObjectId(targetId) : targetId;
    await this.notificationModel.deleteMany({ targetId: tid }).exec();
  }

  async clearAll(adminId: string) {
    const adminObjId = this.toObjectId(adminId, 'Admin');
    await this.notificationModel.updateMany(
      { archivedBy: { $ne: adminObjId } },
      { $addToSet: { archivedBy: adminObjId, readBy: adminObjId } },
    ).exec();
    return { success: true, message: 'Đã lưu trữ tất cả thông báo' };
  }

  // ─── USER NOTIFICATIONS METHODS ───
  async createUserNotification(data: {
    userId: string | Types.ObjectId;
    type: string;
    title: string;
    content?: string;
    link?: string;
    dedupKey?: string;
    dedupWindowMs?: number;
  }) {
    const userId =
      typeof data.userId === 'string'
        ? this.toObjectId(data.userId, 'Người nhận')
        : data.userId;
    const type = String(data.type || 'system').trim().slice(0, 60);
    const title = String(data.title || '').trim().slice(0, 160);
    if (!title) throw new BadRequestException('Tiêu đề thông báo không được để trống');

    const windowMs = Math.max(
      10_000,
      Math.min(data.dedupWindowMs || DEFAULT_DEDUP_WINDOW_MS, 24 * 60 * 60 * 1000),
    );
    const bucket = Math.floor(Date.now() / windowMs);
    const identity = data.dedupKey
      ? `explicit:${data.dedupKey}`
      : `${type}|${title}|${data.content || ''}|${data.link || ''}|${bucket}`;
    const dedupKey = createHash('sha256').update(identity).digest('hex');

    try {
      const userNotif = await this.userNotificationModel.create({
        userId,
        type,
        title,
        content: data.content ? String(data.content).trim().slice(0, 500) : undefined,
        link: this.normalizeInternalLink(data.link),
        isRead: false,
        dedupKey,
        expiresAt: new Date(Date.now() + USER_NOTIFICATION_RETENTION_MS),
      });

      const unreadCount = await this.getUnreadCount(userId);
      this.notificationsGateway.emitToUser(String(userId), 'notifications:changed', {
        action: 'created',
        notification: userNotif.toObject(),
        unreadCount,
      });
      void this.trimUserNotifications(userId).catch(() => undefined);
      return userNotif;
    } catch (error: any) {
      if (error?.code === 11000) {
        return this.userNotificationModel.findOne({ userId, dedupKey }).exec();
      }
      throw error;
    }
  }

  async getUserNotifications(userId: string, page = 1, limit = 15) {
    const pagination = this.normalizePagination(page, limit);
    const skip = (pagination.page - 1) * pagination.limit;
    const userObjId = this.toObjectId(userId, 'Người dùng');
    const query = { userId: userObjId };

    const [items, total, unreadCount] = await Promise.all([
      this.userNotificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean()
        .exec(),
      this.userNotificationModel.countDocuments(query).exec(),
      this.getUnreadCount(userObjId),
    ]);

    return {
      items,
      total,
      unreadCount,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      currentPage: pagination.page,
      limit: pagination.limit,
    };
  }

  async markUserNotifAsRead(userId: string, id: string) {
    const userObjId = this.toObjectId(userId, 'Người dùng');
    const notificationId = this.toObjectId(id, 'Thông báo');
    const notif = await this.userNotificationModel.findOneAndUpdate(
      { _id: notificationId, userId: userObjId },
      { $set: { isRead: true } },
      { returnDocument: 'after' },
    ).exec();

    if (!notif) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    const unreadCount = await this.getUnreadCount(userObjId);
    this.notificationsGateway.emitToUser(userId, 'notifications:changed', {
      action: 'read',
      notificationId: id,
      unreadCount,
    });
    return { notification: notif, unreadCount };
  }

  async markAllUserNotifsAsRead(userId: string) {
    const userObjId = this.toObjectId(userId, 'Người dùng');
    await this.userNotificationModel.updateMany(
      { userId: userObjId, isRead: false },
      { $set: { isRead: true } }
    ).exec();

    this.notificationsGateway.emitToUser(userId, 'notifications:changed', {
      action: 'read-all',
      unreadCount: 0,
    });
    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  async clearAllUserNotifs(userId: string) {
    const userObjId = this.toObjectId(userId, 'Người dùng');
    await this.userNotificationModel.deleteMany({ userId: userObjId }).exec();

    this.notificationsGateway.emitToUser(userId, 'notifications:changed', {
      action: 'cleared',
      unreadCount: 0,
    });
    return { success: true, message: 'Đã xóa tất cả thông báo' };
  }

  async deleteUserNotification(userId: string, id: string) {
    const userObjId = this.toObjectId(userId, 'Người dùng');
    const notificationId = this.toObjectId(id, 'Thông báo');
    const deleted = await this.userNotificationModel.findOneAndDelete({
      _id: notificationId,
      userId: userObjId,
    });
    if (!deleted) throw new NotFoundException('Không tìm thấy thông báo');

    const unreadCount = await this.getUnreadCount(userObjId);
    this.notificationsGateway.emitToUser(userId, 'notifications:changed', {
      action: 'deleted',
      notificationId: id,
      unreadCount,
    });
    return { success: true, unreadCount };
  }

  async notifyMovieUpdate(movieSlug: string, movieName: string, episodeName: string) {
    const targetUsers = await this.userModel
      .find({
        $or: [
          { favorites: movieSlug },
          { 'playlists.movies': movieSlug },
        ],
      })
      .select('_id')
      .lean();

    if (targetUsers.length === 0) return { success: true, notifiedCount: 0 };

    // Tạo thông báo cho từng người
    const promises = targetUsers.map(async (user) => {
      return this.createUserNotification({
        userId: user._id,
        type: 'movie_update',
        title: movieName,
        content: `Đã cập nhật tập mới: ${episodeName}`,
        link: `/movie/${movieSlug}`,
        dedupKey: `movie-update:${movieSlug}:${episodeName}`,
      });
    });

    await Promise.all(promises);

    return { success: true, notifiedCount: targetUsers.length };
  }

  async createBroadcast(
    adminId: string,
    data: { title?: string; content?: string; link?: string; expiresInDays?: number },
  ) {
    if (!this.campaignModel) throw new BadRequestException('Hệ thống chiến dịch chưa sẵn sàng');
    const createdBy = this.toObjectId(adminId, 'Admin');
    const title = this.cleanText(data.title, 160);
    const content = this.cleanText(data.content, 500);
    if (!title || !content) {
      throw new BadRequestException('Tiêu đề và nội dung thông báo không được để trống');
    }
    const link = this.normalizeInternalLink(data.link);
    if (data.link && !link) {
      throw new BadRequestException('Liên kết phải là đường dẫn nội bộ của DlowPhim');
    }
    const expiresInDays = Math.max(1, Math.min(90, Math.floor(Number(data.expiresInDays) || 30)));
    const recentCampaigns = await this.campaignModel.countDocuments({
      createdBy,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recentCampaigns >= 3) {
      throw new BadRequestException('Bạn chỉ có thể gửi tối đa 3 thông báo toàn hệ thống mỗi giờ');
    }

    const recipientCount = await this.userModel.countDocuments({
      isActive: { $ne: false },
      isDeleted: { $ne: true },
    });
    const campaign = await this.campaignModel.create({
      title,
      content,
      link,
      status: 'queued',
      createdBy,
      recipientCount,
      deliveredCount: 0,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    });
    void this.processBroadcast(String(campaign._id));
    return {
      success: true,
      campaign,
      message: `Đã đưa thông báo vào hàng gửi cho ${recipientCount} người dùng`,
    };
  }

  async getBroadcasts(page = 1, limit = 10) {
    if (!this.campaignModel) return { items: [], total: 0, totalPages: 1, currentPage: 1 };
    const pagination = this.normalizePagination(page, limit);
    const [items, total] = await Promise.all([
      this.campaignModel
        .find()
        .sort({ createdAt: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .populate('createdBy', 'displayName email')
        .lean()
        .exec(),
      this.campaignModel.countDocuments(),
    ]);
    return {
      items,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      currentPage: pagination.page,
      limit: pagination.limit,
    };
  }

  private async processBroadcast(campaignId: string) {
    if (!this.campaignModel || !Types.ObjectId.isValid(campaignId)) return;
    const campaignObjectId = new Types.ObjectId(campaignId);
    const campaign = await this.campaignModel.findOneAndUpdate(
      { _id: campaignObjectId, status: 'queued' },
      { $set: { status: 'sending', processingStartedAt: new Date(), errorMessage: null } },
      { returnDocument: 'after' },
    ).lean().exec();
    if (!campaign) return;

    try {
      const dedupKey = createHash('sha256').update(`campaign:${campaignId}`).digest('hex');
      let lastUserId: Types.ObjectId | null = null;
      let processed = 0;
      while (true) {
        const query: Record<string, any> = {
          isActive: { $ne: false },
          isDeleted: { $ne: true },
        };
        if (lastUserId) query._id = { $gt: lastUserId };
        const users = await this.userModel
          .find(query)
          .sort({ _id: 1 })
          .limit(400)
          .select('_id')
          .lean()
          .exec();
        if (!users.length) break;

        const documents = users.map((user) => ({
          userId: user._id,
          type: 'system_broadcast',
          title: campaign.title,
          content: campaign.content,
          link: campaign.link,
          isRead: false,
          dedupKey,
          campaignId: campaignObjectId,
          expiresAt: campaign.expiresAt,
        }));
        try {
          await this.userNotificationModel.insertMany(documents, { ordered: false });
        } catch (error: any) {
          if (error?.code !== 11000 && !error?.writeErrors?.every((item: any) => item?.code === 11000)) {
            throw error;
          }
        }
        processed += users.length;
        lastUserId = users[users.length - 1]._id as Types.ObjectId;
        await this.campaignModel.updateOne(
          { _id: campaignObjectId },
          { $set: { deliveredCount: processed } },
        ).exec();
      }

      const deliveredCount = await this.userNotificationModel.countDocuments({ campaignId: campaignObjectId });
      await this.campaignModel.updateOne(
        { _id: campaignObjectId },
        { $set: { status: 'sent', deliveredCount, sentAt: new Date(), errorMessage: null }, $unset: { processingStartedAt: 1 } },
      ).exec();
      this.notificationsGateway.emitToAllUsers('notifications:changed', {
        action: 'broadcast-created',
        campaignId,
      });
      this.notificationsGateway.emitToAdmins('notifications:changed', {
        action: 'broadcast-finished',
        campaignId,
      });
    } catch (error) {
      await this.campaignModel.updateOne(
        { _id: campaignObjectId },
        { $set: { status: 'failed', errorMessage: this.cleanText(String(error), 300) }, $unset: { processingStartedAt: 1 } },
      ).exec();
    }
  }

  private cleanText(value: unknown, maxLength: number) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }
}
