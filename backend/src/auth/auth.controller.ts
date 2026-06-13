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
}
