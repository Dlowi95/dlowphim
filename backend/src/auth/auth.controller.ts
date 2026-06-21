import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
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
}
