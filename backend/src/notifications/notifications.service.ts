import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
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
}
