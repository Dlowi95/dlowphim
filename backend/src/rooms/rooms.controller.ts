import { Controller, Get, Post, Body, Param, UseGuards, Req, Delete, Headers } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { RoomsService } from './rooms.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoomsGateway } from './rooms.gateway';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomsGateway: RoomsGateway,
    private readonly jwtService: JwtService,
  ) {}

  private getOptionalUserId(req: any): string | undefined {
    const authorization = String(req.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return undefined;
    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token);
      return payload.sub ? String(payload.sub) : undefined;
    } catch {
      return undefined;
    }
  }

  private getAccessIdentities(req: any): string[] {
    const userId = this.getOptionalUserId(req);
    const remoteAddress = String(
      req.ip || req.socket?.remoteAddress || 'unknown',
    );
    const guestDeviceId = String(req.headers?.['x-guest-device-id'] || '')
      .trim()
      .slice(0, 120);
    const sources = [
      `ip:${remoteAddress}`,
      userId ? `user:${userId}` : '',
      guestDeviceId ? `device:${guestDeviceId}` : '',
    ].filter(Boolean);
    return sources.map((source) =>
      createHash('sha256').update(source).digest('hex'),
    );
  }

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
      privatePin?: string;
    },
  ) {
    const hostId = req.user.sub;
    const room: any = await this.roomsService.createRoom(hostId, createDto);
    this.roomsGateway.broadcastLobbyChanged('room_created', room.roomId);
    const response = typeof room.toObject === 'function' ? room.toObject() : { ...room };
    delete response.privatePinHash;
    delete response.privateAccessVersion;
    return response;
  }

  // Lấy danh sách các phòng xem chung công khai
  @Get('public')
  async getPublicRooms() {
    return this.roomsService.getPublicRooms();
  }

  // Lấy thông tin chi tiết phòng xem chung
  @Get(':roomId')
  async getRoomDetails(
    @Param('roomId') roomId: string,
    @Req() req: any,
    @Headers('x-room-access-token') accessToken?: string,
  ) {
    const room: any = await this.roomsService.getAuthorizedRoomDetails(
      roomId,
      this.getOptionalUserId(req),
      accessToken,
    );
    return {
      ...(typeof room.toObject === 'function' ? room.toObject() : room),
      serverTime: new Date().toISOString(),
    };
  }

  @Post(':roomId/access')
  async accessPrivateRoom(
    @Param('roomId') roomId: string,
    @Body('pin') pin: string,
    @Req() req: any,
  ) {
    return this.roomsService.verifyPrivatePin(
      roomId,
      pin,
      this.getAccessIdentities(req),
    );
  }

  @Get(':roomId/access-status')
  async getPrivateAccessStatus(
    @Param('roomId') roomId: string,
    @Req() req: any,
  ) {
    return this.roomsService.getPrivateAccessStatus(
      roomId,
      this.getAccessIdentities(req),
    );
  }

  // Lấy lịch sử chat phòng xem chung
  @Get(':roomId/messages')
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @Req() req: any,
    @Headers('x-room-access-token') accessToken?: string,
  ) {
    await this.roomsService.getAuthorizedRoomDetails(
      roomId,
      this.getOptionalUserId(req),
      accessToken,
    );
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
