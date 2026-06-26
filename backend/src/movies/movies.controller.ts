import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  // ─── PUBLIC ENDPOINTS ───
  @Get('blocked')
  async getBlockedMovies() {
    return this.moviesService.getBlockedMovies();
  }

  @Get('check-blocked/:slug')
  async isMovieBlocked(@Param('slug') slug: string) {
    const isBlocked = await this.moviesService.isMovieBlocked(slug);
    return { isBlocked };
  }

  @Get('custom')
  async getCustomMovies(@Query('search') search?: string) {
    return this.moviesService.getCustomMovies(search);
  }

  @Get('custom/:slug')
  async getCustomMovieBySlug(@Param('slug') slug: string) {
    return this.moviesService.getCustomMovieBySlug(slug);
  }

  // ─── ADMIN ENDPOINTS (REQUIRES ADMIN ROLE) ───
  @Post('blocked')
  @UseGuards(AuthGuard, RolesGuard)
  async blockMovie(
    @Body('slug') slug: string,
    @Body('title') title?: string,
    @Body('reason') reason?: string,
  ) {
    return this.moviesService.blockMovie(slug, title, reason);
  }

  @Delete('blocked/:slug')
  @UseGuards(AuthGuard, RolesGuard)
  async unblockMovie(@Param('slug') slug: string) {
    return this.moviesService.unblockMovie(slug);
  }

  @Post('custom')
  @UseGuards(AuthGuard, RolesGuard)
  async createCustomMovie(@Body() dto: any) {
    return this.moviesService.createCustomMovie(dto);
  }

  @Put('custom/:id')
  @UseGuards(AuthGuard, RolesGuard)
  async updateCustomMovie(@Param('id') id: string, @Body() dto: any) {
    return this.moviesService.updateCustomMovie(id, dto);
  }

  @Delete('custom/:id')
  @UseGuards(AuthGuard, RolesGuard)
  async deleteCustomMovie(@Param('id') id: string) {
    return this.moviesService.deleteCustomMovie(id);
  }
}
