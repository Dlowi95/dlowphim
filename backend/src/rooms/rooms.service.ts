import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly hostReminderCooldowns = new Map<string, number>();

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      const scheduledResult = await this.roomModel.updateMany(
        {
          status: 'active',
          isAutoStart: true,
          startTime: { $exists: true },
        },
        { $set: { status: 'scheduled' } },
      ).exec();
      const liveResult = await this.roomModel.updateMany(
        { status: 'active' },
        { $set: { status: 'live' } },
      ).exec();
      console.log(
        `[Rooms] Restored legacy rooms on startup: ${scheduledResult.modifiedCount} scheduled, ${liveResult.modifiedCount} live.`,
      );
    } catch (e) {
      console.error('[Rooms] Failed to restore legacy rooms:', e.message);
    }
  }

  // Sinh ID ngẫu nhiên 6 ký tự viết hoa/số
  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Tạo phòng xem chung
  async createRoom(
    hostId: string,
    createDto: {
      movieSlug: string;
      movieName: string;
      moviePoster: string;
      roomName: string;
      posterOption: string;
      isAutoStart: boolean;
      startTime?: string;
      isPrivate: boolean;
    },
  ): Promise<Room> {
    let scheduledAt: Date | undefined;
    if (createDto.isAutoStart) {
      if (!createDto.startTime) {
        throw new BadRequestException('Vui lòng chọn thời gian công chiếu.');
      }
      const startTimeMs = Date.parse(createDto.startTime);
      if (!Number.isFinite(startTimeMs)) {
        throw new BadRequestException('Thời gian công chiếu không hợp lệ.');
      }
      if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(createDto.startTime)) {
        throw new BadRequestException('Thời gian công chiếu phải kèm múi giờ UTC.');
      }
      const now = Date.now();
      if (startTimeMs < now + 30_000) {
        throw new BadRequestException('Thời gian công chiếu phải ở tương lai.');
      }
      if (startTimeMs > now + 90 * 24 * 60 * 60 * 1000) {
        throw new BadRequestException('Chỉ có thể đặt lịch trước tối đa 90 ngày.');
      }
      scheduledAt = new Date(startTimeMs);
    }

    let roomId = this.generateRoomId();
    let isUnique = false;
    let retries = 0;

    // Đảm bảo roomId là duy nhất
    while (!isUnique && retries < 10) {
      const existing = await this.roomModel.findOne({ roomId });
      if (!existing) {
        isUnique = true;
      } else {
        roomId = this.generateRoomId();
        retries++;
      }
    }

    if (!isUnique) {
      throw new ConflictException('Không thể tạo mã phòng độc nhất lúc này. Vui lòng thử lại.');
    }

    // Tự động đóng tất cả các phòng active cũ của Host này để tránh trùng lặp
    try {
      await this.roomModel.updateMany(
        { host: hostId, status: { $in: ['active', 'scheduled', 'live'] } },
        { status: 'closed' }
      ).exec();
    } catch (e) {
      console.error('[Rooms] Failed to auto-close previous active rooms of host:', e.message);
    }

    const createdRoom = new this.roomModel({
      roomId,
      movieSlug: createDto.movieSlug,
      movieName: createDto.movieName,
      moviePoster: createDto.moviePoster,
      roomName: createDto.roomName,
      posterOption: createDto.posterOption,
      isAutoStart: createDto.isAutoStart,
      startTime: scheduledAt,
      isPrivate: createDto.isPrivate,
      host: hostId,
      status: createDto.isAutoStart && createDto.startTime ? 'scheduled' : 'live',
      startedAt: createDto.isAutoStart && createDto.startTime ? undefined : new Date(),
      startedBy: createDto.isAutoStart && createDto.startTime ? undefined : 'host',
    });

    return createdRoom.save();
  }

  // Lấy chi tiết phòng
  async getRoomDetails(roomId: string): Promise<Room> {
    const room = await this.roomModel
      .findOne({ roomId, status: { $in: ['active', 'scheduled', 'live'] } })
      .populate('host', 'displayName email avatar')
      .exec();

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng xem chung hoặc phòng đã đóng.');
    }

    return room;
  }

  // Lấy danh sách phòng công khai (cả active và closed)
  async getPublicRooms(): Promise<Room[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.roomModel
      .find({
        isPrivate: false,
        $or: [
          { status: { $in: ['active', 'scheduled', 'live'] } },
          { status: 'closed', createdAt: { $gte: sevenDaysAgo } },
        ],
      })
      .populate('host', 'displayName email avatar')
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }

  // Nhắc nhở chủ phòng mở chiếu phim
  async notifyHost(roomId: string, guestName: string): Promise<{ success: boolean }> {
    const cooldownUntil = this.hostReminderCooldowns.get(roomId) || 0;
    if (cooldownUntil > Date.now()) {
      throw new HttpException(
        'Phòng vừa gửi lời nhắc. Vui lòng chờ một phút rồi thử lại.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const room = await this.roomModel
      .findOne({ roomId, status: { $in: ['active', 'scheduled', 'live'] } })
      .populate('host')
      .exec();

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng xem chung đang mở.');
    }

    const hostId = room.host?._id || room.host;
    if (!hostId) {
      return { success: false };
    }

    const reminderExpiresAt = Date.now() + 60_000;
    this.hostReminderCooldowns.set(roomId, reminderExpiresAt);
    const cleanupTimer = setTimeout(() => {
      if (this.hostReminderCooldowns.get(roomId) === reminderExpiresAt) {
        this.hostReminderCooldowns.delete(roomId);
      }
    }, 60_000);
    cleanupTimer.unref();

    // Tạo thông báo cho chủ phòng
    await this.notificationsService.createUserNotification({
      userId: hostId,
      type: 'info',
      title: 'Nhắc nhở mở chiếu phim 🔔',
      content: `${guestName} đang chờ bạn trong phòng xem chung "${room.movieName}". Hãy vào để bắt đầu chiếu phim nhé!`,
      link: `/watch-together/room/${room.roomId}`,
    });

    return { success: true };
  }

  // Đóng phòng xem chung (chỉ host mới được quyền đóng)
  async closeRoom(hostId: string, roomId: string): Promise<Room> {
    const room = await this.roomModel.findOne({ roomId, host: hostId });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng xem chung hoặc bạn không có quyền đóng phòng này.');
    }

    room.status = 'closed';
    room.endedAt = new Date();
    const closedRoom = await room.save();

    // Tự động xóa sạch tin nhắn của phòng đó khi đóng phòng
    await this.messageModel.deleteMany({ roomId });

    return closedRoom;
  }

  // Lưu tin nhắn chat vào database
  async saveMessage(
    roomId: string,
    senderId: string | undefined,
    senderName: string,
    senderAvatar: string | undefined,
    text: string,
    isSystem = false,
  ): Promise<MessageDocument> {
    const createdMessage = new this.messageModel({
      roomId,
      sender:
        senderId && Types.ObjectId.isValid(senderId)
          ? new Types.ObjectId(senderId)
          : undefined,
      senderName,
      senderAvatar,
      text,
      isSystem,
    });
    return createdMessage.save();
  }

  // Lấy danh sách tin nhắn chat của phòng (F5 phục hồi)
  async getRoomMessages(roomId: string): Promise<MessageDocument[]> {
    return this.messageModel
      .find({ roomId })
      .sort({ createdAt: 1 })
      .limit(100)
      .exec();
  }

  // Cập nhật tập phim đang phát hiện tại
  async updateCurrentEpisode(roomId: string, episodeSlug: string): Promise<Room> {
    const room = await this.roomModel.findOne({
      roomId,
      status: { $in: ['active', 'scheduled', 'live'] },
    });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng xem chung hoặc phòng đã đóng.');
    }
    room.currentEpisode = episodeSlug;
    return room.save();
  }

  async startScheduledRoom(
    roomId: string,
    startedBy: 'schedule' | 'host',
  ): Promise<Room> {
    const startedAt = new Date();
    const room = await this.roomModel
      .findOneAndUpdate(
        { roomId, status: 'scheduled' },
        {
          $set: {
            status: 'live',
            startedAt,
            startedBy,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!room) {
      const existing = await this.roomModel.findOne({
        roomId,
        status: { $in: ['active', 'live'] },
      });
      if (existing) return existing;
      throw new NotFoundException('Phòng không tồn tại, đã đóng hoặc đã bắt đầu trước đó.');
    }

    return room;
  }

  async getDueScheduledRooms(now = new Date()): Promise<Room[]> {
    return this.roomModel
      .find({ status: 'scheduled', startTime: { $lte: now } })
      .exec();
  }

  async expireScheduledRoom(roomId: string): Promise<Room | null> {
    const room = await this.roomModel
      .findOneAndUpdate(
        { roomId, status: 'scheduled' },
        { $set: { status: 'closed', endedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();
    if (room) {
      await this.messageModel.deleteMany({ roomId });
    }
    return room;
  }
}
