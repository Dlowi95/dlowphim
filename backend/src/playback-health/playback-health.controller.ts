import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PlaybackHealthEvent, PlaybackHealthService } from './playback-health.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('playback-health')
export class PlaybackHealthController {
  constructor(private readonly playbackHealthService: PlaybackHealthService) {}

  @Post('events')
  recordEvents(
    @Body() body: { events?: PlaybackHealthEvent[]; sessionId?: string },
    @Req() request: any,
  ) {
    const sessionId = String(body?.sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const reporterId = `${request.ip || 'unknown'}:${sessionId || 'anonymous'}`;
    return this.playbackHealthService.recordBatch(
      Array.isArray(body?.events) ? body.events : [],
      reporterId,
    );
  }

  @Get('reputation')
  getReputation() {
    return this.playbackHealthService.getReputation();
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  getAdminDashboard() {
    return this.playbackHealthService.getAdminDashboard();
  }
}
