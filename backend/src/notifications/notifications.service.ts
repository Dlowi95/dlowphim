import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { UserNotification, UserNotificationDocument } from './schemas/user-notification.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(UserNotification.name)
    private readonly userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

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
    userId?: string | Types.ObjectId;
    type: string;
    title: string;
    content?: string;
    link?: string;
  }) {
    const userNotif = new this.userNotificationModel({
      userId: data.userId ? (typeof data.userId === 'string' ? new Types.ObjectId(data.userId) : data.userId) : null,
      type: data.type,
      title: data.title,
      content: data.content,
      link: data.link,
      isRead: false,
    });
    return userNotif.save();
  }

  async getUserNotifications(userId: string, page = 1, limit = 15) {
    const skip = (page - 1) * limit;
    const userObjId = new Types.ObjectId(userId);

    // Lấy thông báo cá nhân của user HOẶC thông báo hệ thống chung (userId === null)
    const query = {
      $or: [
        { userId: userObjId },
        { userId: null },
      ],
    };

    const items = await this.userNotificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.userNotificationModel.countDocuments(query).exec();
    const unreadCount = await this.userNotificationModel.countDocuments({
      ...query,
      isRead: false,
    }).exec();

    return {
      items,
      total,
      unreadCount,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };
  }

  async markUserNotifAsRead(userId: string, id: string) {
    const userObjId = new Types.ObjectId(userId);
    const notif = await this.userNotificationModel.findOne({
      _id: new Types.ObjectId(id),
      $or: [
        { userId: userObjId },
        { userId: null },
      ],
    }).exec();

    if (!notif) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    notif.isRead = true;
    return notif.save();
  }

  async markAllUserNotifsAsRead(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    await this.userNotificationModel.updateMany(
      {
        isRead: false,
        $or: [
          { userId: userObjId },
          { userId: null },
        ],
      },
      { $set: { isRead: true } }
    ).exec();

    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  async clearAllUserNotifs(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    await this.userNotificationModel.deleteMany({
      $or: [
        { userId: userObjId },
        { userId: null },
      ],
    }).exec();

    return { success: true, message: 'Đã xóa tất cả thông báo' };
  }

  async notifyMovieUpdate(movieSlug: string, movieName: string, episodeName: string) {
    // Quét toàn bộ User trong DB để tìm những người theo dõi bộ phim này
    const users = await this.userModel.find().exec();
    const targetUsers: UserDocument[] = [];

    users.forEach(user => {
      // 1. Kiểm tra trong danh sách Yêu thích
      const inFavorites = user.favorites?.includes(movieSlug);
      
      // 2. Kiểm tra trong các danh sách phát (Playlists)
      const inPlaylists = user.playlists?.some(p => p.movies?.includes(movieSlug));

      if (inFavorites || inPlaylists) {
        targetUsers.push(user);
      }
    });

    if (targetUsers.length === 0) return { success: true, notifiedCount: 0 };

    // Tạo thông báo cho từng người
    const promises = targetUsers.map(async (user) => {
      return this.createUserNotification({
        userId: user._id,
        type: 'movie_update',
        title: movieName,
        content: `Đã cập nhật tập mới: ${episodeName}`,
        link: `/movie/${movieSlug}`,
      });
    });

    await Promise.all(promises);

    return { success: true, notifiedCount: targetUsers.length };
  }
}
