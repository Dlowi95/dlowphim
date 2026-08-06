import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MovieReportsService } from './movie-reports.service';
import { createHash } from 'node:crypto';

@Controller('movie-reports')
export class MovieReportsController {
  constructor(
    private readonly movieReportsService: MovieReportsService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  async createReport(
    @Body()
    dto: {
      movieSlug: string;
      movieName: string;
      episodeName: string;
      episodeSlug?: string;
      errorType: string;
      description?: string;
      playbackType?: string;
      serverName?: string;
      streamOrigin?: string;
      currentTime?: number;
    },
    @Req() req: any,
  ) {
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = await this.jwtService.verifyAsync(token);
        userId = payload.sub;
      } catch (e) {
        // Hết hạn hoặc sai token thì coi như khách vãng lai gửi
      }
    }
    const identity = userId
      ? `user:${userId}`
      : `guest:${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.headers['user-agent'] || ''}`;
    const reporterKey = createHash('sha256').update(identity).digest('hex');
    return this.movieReportsService.createReport(userId, reporterKey, dto);
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  async getReportsForAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('errorType') errorType?: string,
    @Query('search') search?: string,
  ) {
    return this.movieReportsService.getReportsForAdmin({
      page: Number(page),
      limit: Number(limit),
      status,
      errorType,
      search,
    });
  }

  @Put('admin/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('resolutionNote') resolutionNote: string | undefined,
    @Req() req: any,
  ) {
    return this.movieReportsService.updateStatus(
      id,
      status,
      req.user.sub,
      resolutionNote,
    );
  }

  @Delete('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  async deleteReport(@Param('id') id: string) {
    return this.movieReportsService.deleteReport(id);
  }
}
