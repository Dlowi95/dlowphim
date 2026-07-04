import { Controller, Post, Body, Get, Put, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
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
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Put('admin/users/:id/role')
  @UseGuards(AuthGuard, RolesGuard)
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
  async updateUserStatus(
    @Req() req: express.Request,
    @Param('id') userId: string,
    @Body('isActive') isActive: boolean,
  ) {
    const adminId = req['user']?.sub;
    return this.authService.updateUserStatus(adminId, userId, isActive);
  }

  @Delete('admin/users/:id')
  @UseGuards(AuthGuard, RolesGuard)
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
