import { Body, Controller, Get, Header, Post, Req, UseGuards } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PlaybackHealthEvent, PlaybackHealthService } from './playback-health.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';

@Controller('playback-health')
export class PlaybackHealthController {
  constructor(private readonly playbackHealthService: PlaybackHealthService) {}

  @Post('events')
  recordEvents(
    @Body() body: { events?: PlaybackHealthEvent[]; sessionId?: string },
    @Req() request: any,
  ) {
    // Stable per browser/network: opening tabs or rotating a client session cannot
    // impersonate several viewers and globally block a healthy CDN.
    const identity = `${request.ip || request.socket?.remoteAddress || 'unknown'}:${request.headers['user-agent'] || ''}`;
    const reporterId = createHash('sha256').update(identity).digest('hex');
    return this.playbackHealthService.recordBatch(
      Array.isArray(body?.events) ? body.events : [],
      reporterId,
    );
  }

  @Get('reputation')
  @Header('Cache-Control', 'public, max-age=20, stale-while-revalidate=40')
  getReputation() {
    return this.playbackHealthService.getReputation();
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('playback.read')
  getAdminDashboard() {
    return this.playbackHealthService.getAdminDashboard();
  }
}
