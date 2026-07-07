import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

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

    const createdRoom = new this.roomModel({
      roomId,
      movieSlug: createDto.movieSlug,
      movieName: createDto.movieName,
      moviePoster: createDto.moviePoster,
      roomName: createDto.roomName,
      posterOption: createDto.posterOption,
      isAutoStart: createDto.isAutoStart,
      startTime: createDto.startTime ? new Date(createDto.startTime) : undefined,
      isPrivate: createDto.isPrivate,
      host: hostId,
      status: 'active',
    });

    return createdRoom.save();
  }

  // Lấy chi tiết phòng
  async getRoomDetails(roomId: string): Promise<Room> {
    const room = await this.roomModel
      .findOne({ roomId, status: 'active' })
      .populate('host', 'name email avatar')
      .exec();

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng xem chung hoặc phòng đã đóng.');
    }

    return room;
  }

  // Lấy danh sách phòng công khai
  async getPublicRooms(): Promise<Room[]> {
    return this.roomModel
      .find({ isPrivate: false, status: 'active' })
      .populate('host', 'name email avatar')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Đóng phòng xem chung (chỉ host mới được quyền đóng)
  async closeRoom(hostId: string, roomId: string): Promise<Room> {
    const room = await this.roomModel.findOne({ roomId, host: hostId });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng xem chung hoặc bạn không có quyền đóng phòng này.');
    }

    room.status = 'closed';
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
      sender: senderId ? new Types.ObjectId(senderId) : undefined,
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
    const room = await this.roomModel.findOne({ roomId, status: 'active' });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng xem chung hoặc phòng đã đóng.');
    }
    room.currentEpisode = episodeSlug;
    return room.save();
  }
}
