import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, Headers } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtService } from '@nestjs/jwt';

@Controller('ratings')
export class RatingsController {
  constructor(
    private readonly ratingsService: RatingsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('admin/stats')
  @UseGuards(AuthGuard, RolesGuard)
  async getAdminStats() {
    return this.ratingsService.getAdminRatingsStats();
  }

  @Delete('admin/movie/:movieSlug')
  @UseGuards(AuthGuard, RolesGuard)
  async deleteMovieRatings(@Param('movieSlug') movieSlug: string) {
    return this.ratingsService.deleteMovieRatings(movieSlug);
  }

  @Get(':movieSlug')
  async getRating(
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
        // Ignore token errors for public read
      }
    }
    return this.ratingsService.getMovieRating(movieSlug, currentUserId);
  }

  @Post(':movieSlug')
  @UseGuards(AuthGuard)
  async rate(
    @Param('movieSlug') movieSlug: string,
    @Req() req: any,
    @Body('score') score: number,
  ) {
    const userId = req.user.sub;
    return this.ratingsService.rateMovie(movieSlug, userId, score);
  }
}
