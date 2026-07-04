import { Controller, Get, Put, Delete, Post, Param, Query, UseGuards, Req, Body } from '@nestjs/common';
import * as express from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── ADMIN NOTIFICATION ENDPOINTS (Reports) ───
  @Get()
  @UseGuards(RolesGuard)
  async getNotifications(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 10;
    return this.notificationsService.getNotifications(p, l);
  }

  @Put('read-all')
  @UseGuards(RolesGuard)
  async markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }

  @Put(':id/read')
  @UseGuards(RolesGuard)
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Delete('clear')
  @UseGuards(RolesGuard)
  async clearAll() {
    return this.notificationsService.clearAll();
  }

  // ─── USER NOTIFICATION ENDPOINTS ───
  @Get('user')
  async getUserNotifications(
    @Req() req: express.Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req['user']?.sub;
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 15;
    return this.notificationsService.getUserNotifications(userId, p, l);
  }

  @Put('user/read-all')
  async markAllUserNotifsAsRead(@Req() req: express.Request) {
    const userId = req['user']?.sub;
    return this.notificationsService.markAllUserNotifsAsRead(userId);
  }

  @Put('user/:id/read')
  async markUserNotifAsRead(@Req() req: express.Request, @Param('id') id: string) {
    const userId = req['user']?.sub;
    return this.notificationsService.markUserNotifAsRead(userId, id);
  }

  @Delete('user/clear')
  async clearAllUserNotifs(@Req() req: express.Request) {
    const userId = req['user']?.sub;
    return this.notificationsService.clearAllUserNotifs(userId);
  }

  // Admin route to trigger a manual movie update notification for testing or automatic flows
  @Post('admin/movie-update')
  @UseGuards(RolesGuard)
  async notifyMovieUpdate(
    @Body('movieSlug') movieSlug: string,
    @Body('movieName') movieName: string,
    @Body('episodeName') episodeName: string,
  ) {
    return this.notificationsService.notifyMovieUpdate(movieSlug, movieName, episodeName);
  }
}
