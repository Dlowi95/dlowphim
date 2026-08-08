import { Controller, Post, Body, Get, Put, Delete, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RequirePermissions } from './guards/require-permissions.decorator';
import * as express from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: any) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: any) {
    return this.authService.login(loginDto);
  }

  @Post('google')
  async googleLogin(@Body() googleDto: { idToken?: string; accessToken?: string }) {
    return this.authService.googleLogin(googleDto);
  }

  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(@Req() req: express.Request, @Body('email') email: string) {
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.resendVerification(email, clientKey);
  }

  @Post('forgot-password')
  async forgotPassword(@Req() req: express.Request, @Body('email') email: string) {
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.forgotPassword(email, clientKey);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token?: string; password?: string }) {
    return this.authService.resetPassword(body?.token, body?.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: express.Request) {
    const userId = req['user']?.sub;
    return this.authService.getMe(userId);
  }

  @Put('me/update')
  @UseGuards(AuthGuard)
  async updateProfile(
    @Req() req: express.Request,
    @Body() updateDto: { displayName?: string; gender?: string; avatar?: string }
  ) {
    const userId = req['user']?.sub;
    return this.authService.updateProfile(userId, updateDto);
  }

  @Post('favorites/toggle')
  @UseGuards(AuthGuard)
  async toggleFavorite(@Req() req: express.Request, @Body('movieSlug') movieSlug: string) {
    const userId = req['user']?.sub;
    return this.authService.toggleFavorite(userId, movieSlug);
  }

  @Post('favorites/sync')
  @UseGuards(AuthGuard)
  async syncFavorites(@Req() req: express.Request, @Body('localFavorites') localFavorites: string[]) {
    const userId = req['user']?.sub;
    return this.authService.syncFavorites(userId, localFavorites || []);
  }

  @Post('history/update')
  @UseGuards(AuthGuard)
  async updateHistory(@Req() req: express.Request, @Body() historyItem: any) {
    const userId = req['user']?.sub;
    return this.authService.updateHistory(userId, historyItem);
  }

  @Post('history/sync')
  @UseGuards(AuthGuard)
  async syncHistory(@Req() req: express.Request, @Body('localHistory') localHistory: any[]) {
    const userId = req['user']?.sub;
    return this.authService.syncHistory(userId, localHistory || []);
  }

  @Get('admin/users')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('users.read')
  async getAllUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('activity') activity?: string,
    @Query('provider') provider?: string,
    @Query('verification') verification?: string,
  ) {
    return this.authService.getAllUsers({ search, page, limit, role, status, activity, provider, verification });
  }

  @Put('admin/users/:id/role')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('roles.manage')
  async updateUserRole(
    @Req() req: express.Request,
    @Param('id') userId: string,
    @Body('role') role: string,
  ) {
    const adminId = req['user']?.sub;
    return this.authService.updateUserRole(adminId, userId, role);
  }

  @Put('admin/users/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('users.manage')
  async updateUserStatus(
    @Req() req: express.Request,
    @Param('id') userId: string,
    @Body('isActive') isActive: boolean,
    @Body('reason') reason?: string,
  ) {
    const adminId = req['user']?.sub;
    return this.authService.updateUserStatus(adminId, userId, isActive, reason);
  }

  @Delete('admin/users/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('users.manage')
  async deleteUser(@Req() req: express.Request, @Param('id') userId: string) {
    const adminId = req['user']?.sub;
    return this.authService.deleteUser(adminId, userId);
  }

  @Post('playlists')
  @UseGuards(AuthGuard)
  async createPlaylist(@Req() req: express.Request, @Body('name') name: string) {
    const userId = req['user']?.sub;
    return this.authService.createPlaylist(userId, name);
  }

  @Delete('playlists/:id')
  @UseGuards(AuthGuard)
  async deletePlaylist(@Req() req: express.Request, @Param('id') playlistId: string) {
    const userId = req['user']?.sub;
    return this.authService.deletePlaylist(userId, playlistId);
  }

  @Put('playlists/:id')
  @UseGuards(AuthGuard)
  async updatePlaylistName(
    @Req() req: express.Request,
    @Param('id') playlistId: string,
    @Body('name') name: string,
  ) {
    const userId = req['user']?.sub;
    return this.authService.updatePlaylistName(userId, playlistId, name);
  }

  @Post('playlists/:id/toggle')
  @UseGuards(AuthGuard)
  async toggleMovieInPlaylist(
    @Req() req: express.Request,
    @Param('id') playlistId: string,
    @Body('movieSlug') movieSlug: string,
  ) {
    const userId = req['user']?.sub;
    return this.authService.toggleMovieInPlaylist(userId, playlistId, movieSlug);
  }

  @Delete('history/clear/:slug')
  @UseGuards(AuthGuard)
  async clearHistoryItem(@Req() req: express.Request, @Param('slug') movieSlug: string) {
    const userId = req['user']?.sub;
    return this.authService.clearHistoryItem(userId, movieSlug);
  }

  @Delete('history/clear-all')
  @UseGuards(AuthGuard)
  async clearAllHistory(@Req() req: express.Request) {
    const userId = req['user']?.sub;
    return this.authService.clearAllHistory(userId);
  }
}
