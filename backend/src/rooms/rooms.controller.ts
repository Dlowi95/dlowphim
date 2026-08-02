import { Controller, Get, Post, Body, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoomsGateway } from './rooms.gateway';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomsGateway: RoomsGateway,
  ) {}

  // Tạo phòng xem chung mới
  @Post('create')
  @UseGuards(AuthGuard)
  async createRoom(
    @Req() req: any,
    @Body() createDto: {
      movieSlug: string;
      movieName: string;
      moviePoster: string;
      roomName: string;
      posterOption: string;
      isAutoStart: boolean;
      startTime?: string;
      isPrivate: boolean;
    },
  ) {
    const hostId = req.user.sub;
    const room = await this.roomsService.createRoom(hostId, createDto);
    this.roomsGateway.broadcastLobbyChanged('room_created', room.roomId);
    return room;
  }

  // Lấy danh sách các phòng xem chung công khai
  @Get('public')
  async getPublicRooms() {
    return this.roomsService.getPublicRooms();
  }

  // Lấy thông tin chi tiết phòng xem chung
  @Get(':roomId')
  async getRoomDetails(@Param('roomId') roomId: string) {
    const room: any = await this.roomsService.getRoomDetails(roomId);
    return {
      ...(typeof room.toObject === 'function' ? room.toObject() : room),
      serverTime: new Date().toISOString(),
    };
  }

  // Lấy lịch sử chat phòng xem chung
  @Get(':roomId/messages')
  async getRoomMessages(@Param('roomId') roomId: string) {
    return this.roomsService.getRoomMessages(roomId);
  }

  // Đóng phòng xem chung (chỉ dành cho host của phòng)
  @Delete(':roomId')
  @UseGuards(AuthGuard)
  async closeRoom(@Param('roomId') roomId: string, @Req() req: any) {
    const hostId = req.user.sub;
    const room = await this.roomsService.closeRoom(hostId, roomId);
    this.roomsGateway.broadcastRoomClosed(roomId, 'host_closed');
    return room;
  }

  // Nhắc nhở chủ phòng mở chiếu phim
  @Post(':roomId/notify-host')
  async notifyHost(
    @Param('roomId') roomId: string,
    @Body('guestName') guestName?: string,
  ) {
    return this.roomsService.notifyHost(roomId, guestName || 'Khán giả');
  }
}
