import { Controller, Get, Post, Body, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

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
    return this.roomsService.createRoom(hostId, createDto);
  }

  // Lấy danh sách các phòng xem chung công khai
  @Get('public')
  async getPublicRooms() {
    return this.roomsService.getPublicRooms();
  }

  // Lấy thông tin chi tiết phòng xem chung
  @Get(':roomId')
  async getRoomDetails(@Param('roomId') roomId: string) {
    return this.roomsService.getRoomDetails(roomId);
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
    return this.roomsService.closeRoom(hostId, roomId);
  }
}
