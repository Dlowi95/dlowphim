import { Controller, Get, Post, Body, Param, UseGuards, Req, Headers } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthGuard } from '../auth/guards/auth.guard';
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
    @Body() createDto: { content: string; isSpoiler?: boolean; episodeLabel?: string },
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
}
