import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Room, RoomDocument } from './schemas/room.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RoomAccessAttempt,
  RoomAccessAttemptDocument,
} from './schemas/room-access-attempt.schema';

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly hostReminderCooldowns = new Map<string, number>();

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    @InjectModel(RoomAccessAttempt.name)
    private readonly accessAttemptModel: Model<RoomAccessAttemptDocument>,
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
      privatePin?: string;
    },
  ): Promise<Room> {
    let privatePinHash: string | undefined;
    let privateAccessVersion: string | undefined;
    if (createDto.isPrivate) {
      const privatePin = String(createDto.privatePin || '').trim();
      if (!/^\d{4}$/.test(privatePin)) {
        throw new BadRequestException('Mã PIN phòng riêng phải gồm đúng 4 chữ số.');
      }
      privatePinHash = await bcrypt.hash(privatePin, 10);
      privateAccessVersion = randomBytes(16).toString('hex');
    }

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
      privatePinHash,
      privateAccessVersion,
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

  async getAuthorizedRoomDetails(
    roomId: string,
    userId?: string,
    accessToken?: string,
  ): Promise<Room> {
    const room = await this.getRoomDetails(roomId);
    await this.assertRoomAccess(roomId, room, userId, accessToken);
    return room;
  }

  async assertRoomAccess(
    roomId: string,
    room: any,
    userId?: string,
    accessToken?: string,
  ): Promise<void> {
    if (!room.isPrivate) return;
    const hostId = String(room.host?._id || room.host || '');
    if (userId && hostId === String(userId)) return;

    const securedRoom = await this.roomModel
      .findOne({ roomId })
      .select('+privateAccessVersion')
      .lean()
      .exec();
    if (!securedRoom || !accessToken) {
      throw new ForbiddenException({
        message: 'Phòng riêng tư yêu cầu mã PIN.',
        requiresPin: true,
      });
    }

    try {
      const payload = this.jwtService.verify<{
        purpose?: string;
        roomId?: string;
        version?: string;
      }>(accessToken);
      if (
        payload.purpose !== 'private-room' ||
        payload.roomId !== roomId ||
        payload.version !== securedRoom.privateAccessVersion
      ) {
        throw new Error('Invalid room access token');
      }
    } catch {
      throw new ForbiddenException({
        message: 'Quyền truy cập phòng đã hết hạn. Vui lòng nhập lại mã PIN.',
        requiresPin: true,
      });
    }
  }

  async verifyPrivatePin(
    roomId: string,
    pin: string,
    identity: string | string[],
  ): Promise<{ accessToken: string }> {
    const room: any = await this.roomModel
      .findOne({
        roomId,
        status: { $in: ['active', 'scheduled', 'live'] },
      })
      .select('+privatePinHash +privateAccessVersion')
      .exec();
    if (!room) {
      throw new NotFoundException('Phòng không tồn tại hoặc đã đóng.');
    }
    if (!room.isPrivate || !room.privatePinHash) {
      throw new BadRequestException('Phòng này không yêu cầu mã PIN.');
    }

    const identities = (Array.isArray(identity) ? identity : [identity])
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index);
    const attemptKeys = identities.map((value) => `${roomId}:${value}`);
    const now = new Date();
    const attempts = await Promise.all(
      attemptKeys.map((key) => this.accessAttemptModel.findOne({ key }).exec()),
    );
    const expiredKeys = attempts
      .filter((attempt) => attempt?.expiresAt && attempt.expiresAt.getTime() <= now.getTime())
      .map((attempt) => attempt!.key);
    if (expiredKeys.length) {
      await this.accessAttemptModel.deleteMany({ key: { $in: expiredKeys } }).exec();
    }
    const activeAttempts = attempts.map((attempt) =>
      attempt && !expiredKeys.includes(attempt.key) ? attempt : null,
    );
    const lockedAttempt = activeAttempts.find(
      (attempt) => attempt?.lockedUntil && attempt.lockedUntil.getTime() > now.getTime(),
    );
    if (lockedAttempt?.lockedUntil) {
      throw new HttpException(
        {
          message: 'Bạn đã nhập sai mã PIN 3 lần. Vui lòng thử lại sau 15 phút.',
          lockedUntil: lockedAttempt.lockedUntil.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isValid = await bcrypt.compare(String(pin || ''), room.privatePinHash);
    if (!isValid) {
      const results = await Promise.all(
        attemptKeys.map((attemptKey, index) => {
          const failures = (activeAttempts[index]?.failures || 0) + 1;
          const lockedUntil = failures >= 3
            ? new Date(now.getTime() + 15 * 60 * 1000)
            : undefined;
          return this.accessAttemptModel.findOneAndUpdate(
            { key: attemptKey },
            {
              $set: {
                roomId,
                failures,
                lockedUntil,
                expiresAt: lockedUntil || new Date(now.getTime() + 15 * 60 * 1000),
              },
            },
            { upsert: true, returnDocument: 'after' },
          ).exec().then(() => ({ failures, lockedUntil }));
        }),
      );
      const lockedResult = results.find((result) => result.lockedUntil);

      if (lockedResult?.lockedUntil) {
        throw new HttpException(
          {
            message: 'Bạn đã nhập sai mã PIN 3 lần. Vui lòng thử lại sau 15 phút.',
            lockedUntil: lockedResult.lockedUntil.toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const attemptsRemaining = Math.min(
        ...results.map((result) => Math.max(0, 3 - result.failures)),
      );
      throw new ForbiddenException({
        message: 'Mã PIN không đúng.',
        requiresPin: true,
        attemptsRemaining,
      });
    }

    if (activeAttempts.some(Boolean)) {
      await this.accessAttemptModel.deleteMany({ key: { $in: attemptKeys } }).exec();
    }
    return {
      accessToken: this.jwtService.sign(
        {
          purpose: 'private-room',
          roomId,
          version: room.privateAccessVersion,
        },
        { expiresIn: '12h' },
      ),
    };
  }

  async getPrivateAccessStatus(
    roomId: string,
    identities: string[],
  ): Promise<{ locked: boolean; lockedUntil?: string }> {
    const attemptKeys = identities
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .map((value) => `${roomId}:${value}`);
    if (!attemptKeys.length) return { locked: false };

    const attempts = await this.accessAttemptModel
      .find({ key: { $in: attemptKeys } })
      .lean()
      .exec();
    const now = Date.now();
    const lockedAttempt = attempts.find(
      (attempt) =>
        attempt.lockedUntil && new Date(attempt.lockedUntil).getTime() > now,
    );
    return lockedAttempt?.lockedUntil
      ? {
          locked: true,
          lockedUntil: new Date(lockedAttempt.lockedUntil).toISOString(),
        }
      : { locked: false };
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
