import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
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

  @Get('logo/:slug')
  async getMovieLogo(
    @Param('slug') slug: string,
    @Query('title') title?: string,
    @Query('tmdbId') tmdbId?: string,
    @Query('tmdbType') tmdbType?: string,
    @Query('originTitle') originTitle?: string,
  ) {
    return this.moviesService.getMovieLogo(slug, title, tmdbId, tmdbType, originTitle);
  }

  @Get('credits/:slug')
  async getMovieCredits(
    @Param('slug') slug: string,
    @Query('title') title?: string,
    @Query('tmdbId') tmdbId?: string,
    @Query('tmdbType') tmdbType?: string,
  ) {
    return this.moviesService.getMovieCredits(slug, title, tmdbId, tmdbType);
  }

  @Get('schedule/:slug')
  async getMovieSchedule(
    @Param('slug') slug: string,
    @Query('title') title?: string,
    @Query('originTitle') originTitle?: string,
    @Query('tmdbId') tmdbId?: string,
    @Query('tmdbType') tmdbType?: string,
    @Query('movieType') movieType?: string,
    @Query('movieStatus') movieStatus?: string,
    @Query('episodeCurrent') episodeCurrent?: string,
    @Query('episodeTotal') episodeTotal?: string,
    @Query('releaseDate') releaseDate?: string,
  ) {
    return this.moviesService.getMovieSchedule({
      slug,
      title,
      originTitle,
      tmdbId,
      tmdbType,
      movieType,
      movieStatus,
      episodeCurrent,
      episodeTotal,
      releaseDate,
    });
  }

  @Get('upcoming')
  async getUpcomingMovies(@Query('page') page = '1') {
    return this.moviesService.getUpcomingMovies(Math.max(1, Number(page) || 1));
  }

  @Get('upcoming/:tmdbId')
  async getUpcomingMovieDetail(@Param('tmdbId') tmdbId: string) {
    return this.moviesService.getUpcomingMovieDetail(tmdbId);
  }

  @Get('upcoming/:tmdbId/reminder')
  @UseGuards(AuthGuard)
  async getUpcomingReminder(
    @Req() request: Request,
    @Param('tmdbId') tmdbId: string,
  ) {
    return this.moviesService.getUpcomingReminderStatus(request['user'].sub, tmdbId);
  }

  @Post('upcoming/:tmdbId/reminder')
  @UseGuards(AuthGuard)
  async toggleUpcomingReminder(
    @Req() request: Request,
    @Param('tmdbId') tmdbId: string,
    @Body() body: { slug?: string; movieName?: string; originName?: string; releaseDate?: string; year?: number },
  ) {
    return this.moviesService.toggleUpcomingReminder(request['user'].sub, tmdbId, body);
  }

  @Get('ophim-proxy')
  async fetchOphimProxy(
    @Query('path') path: string,
    @Query('source') source = 'active',
  ) {
    return this.moviesService.fetchOphimProxy(path, source);
  }

  @Get('resolved-detail/:slug')
  async getResolvedMovieDetail(
    @Param('slug') slug: string,
    @Query('source') source = 'fallback',
    @Query('title') title?: string,
    @Query('originTitle') originTitle?: string,
    @Query('year') year?: string,
    @Query('tmdbId') tmdbId?: string,
  ) {
    return this.moviesService.resolveMovieDetailAcrossSources(
      slug,
      source,
      title,
      originTitle,
      year ? Number(year) : undefined,
      tmdbId,
    );
  }

  @Get('override/:slug')
  async getOverrideBySlug(@Param('slug') slug: string) {
    const override = await this.moviesService.getOverrideBySlug(slug);
    return override || { slug, customContent: '', customName: '' };
  }

  @Post('override')
  @UseGuards(AuthGuard, RolesGuard)
  async createOrUpdateOverride(
    @Body('slug') slug: string,
    @Body('customContent') customContent: string,
    @Body('customName') customName?: string,
  ) {
    return this.moviesService.createOrUpdateOverride(slug, { customContent, customName });
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
