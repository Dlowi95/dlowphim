import { Controller, Get, Post, Body, Param, UseGuards, Req, Headers, Delete } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtService } from '@nestjs/jwt';

@Controller('comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get(':movieSlug')
  async getComments(
    @Param('movieSlug') movieSlug: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let currentUserId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = await this.jwtService.verifyAsync(token);
        currentUserId = payload.sub;
      } catch (e) {
        // Ignore invalid token when reading comments
      }
    }
    return this.commentsService.getComments(movieSlug, currentUserId);
  }

  @Post(':movieSlug')
  @UseGuards(AuthGuard)
  async createComment(
    @Param('movieSlug') movieSlug: string,
    @Req() req: any,
    @Body() createDto: { content: string; isSpoiler?: boolean; episodeLabel?: string; parentId?: string },
  ) {
    const userId = req.user.sub;
    return this.commentsService.createComment(userId, movieSlug, createDto);
  }

  @Post(':id/vote')
  @UseGuards(AuthGuard)
  async toggleVote(
    @Param('id') commentId: string,
    @Req() req: any,
    @Body('type') voteType: 'up' | 'down',
  ) {
    const userId = req.user.sub;
    return this.commentsService.toggleVote(commentId, userId, voteType);
  }

  @Post(':id/reaction')
  @UseGuards(AuthGuard)
  async toggleReaction(
    @Param('id') commentId: string,
    @Req() req: any,
    @Body('type') reactionType: string,
  ) {
    const userId = req.user.sub;
    return this.commentsService.toggleReaction(commentId, userId, reactionType);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteComment(
    @Param('id') commentId: string,
    @Req() req: any,
  ) {
    const userId = req.user.sub;
    return this.commentsService.deleteComment(commentId, userId);
  }

  @Post(':id/report')
  @UseGuards(AuthGuard)
  async reportComment(
    @Param('id') commentId: string,
    @Req() req: any,
    @Body('reason') reason?: string,
  ) {
    const userId = req.user.sub;
    return this.commentsService.reportComment(commentId, userId, reason);
  }

  @Get('admin/reports')
  @UseGuards(AuthGuard, RolesGuard)
  async getReportedComments() {
    return this.commentsService.getReportedComments();
  }

  @Get('admin/all')
  @UseGuards(AuthGuard, RolesGuard)
  async getAllComments() {
    return this.commentsService.getAllComments();
  }

  @Delete('admin/reports/:id/dismiss')
  @UseGuards(AuthGuard, RolesGuard)
  async dismissReport(@Param('id') reportId: string) {
    return this.commentsService.dismissReport(reportId);
  }

  @Get('admin/stats')
  @UseGuards(AuthGuard, RolesGuard)
  async getAdminStats() {
    return this.commentsService.getAdminStats();
  }
}
