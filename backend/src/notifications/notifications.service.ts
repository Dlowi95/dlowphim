import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { UserNotification, UserNotificationDocument } from './schemas/user-notification.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { NotificationsGateway } from './notifications.gateway';

const MAX_USER_NOTIFICATIONS = 300;
const USER_NOTIFICATION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const DEFAULT_DEDUP_WINDOW_MS = 60_000;

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
  ) {}

  async onModuleInit() {
    await this.userNotificationModel.updateMany(
      { expiresAt: { $exists: false } },
      { $set: { expiresAt: new Date(Date.now() + USER_NOTIFICATION_RETENTION_MS) } },
    );
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
    const notif = new this.notificationModel({
      type: data.type,
      title: data.title,
      subtitle: data.subtitle,
      content: data.content,
      targetId: typeof data.targetId === 'string' ? new Types.ObjectId(data.targetId) : data.targetId,
      targetTab: data.targetTab,
      isRead: false,
    });
    return notif.save();
  }

  async getNotifications(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const items = await this.notificationModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.notificationModel.countDocuments().exec();
    const unreadCount = await this.notificationModel.countDocuments({ isRead: false }).exec();

    return {
      items,
      total,
      unreadCount,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };
  }

  async markAsRead(id: string) {
    const notif = await this.notificationModel.findById(id).exec();
    if (!notif) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    notif.isRead = true;
    return notif.save();
  }

  async markAllAsRead() {
    await this.notificationModel.updateMany({ isRead: false }, { $set: { isRead: true } }).exec();
    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  async deleteByTargetId(targetId: string | Types.ObjectId) {
    const tid = typeof targetId === 'string' ? new Types.ObjectId(targetId) : targetId;
    await this.notificationModel.deleteMany({ targetId: tid }).exec();
  }

  async clearAll() {
    await this.notificationModel.deleteMany({}).exec();
    return { success: true, message: 'Đã xóa tất cả thông báo' };
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
}
