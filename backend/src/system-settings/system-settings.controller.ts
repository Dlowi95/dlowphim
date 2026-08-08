import { Controller, Get, Put, Post, Body, UseGuards, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { SystemSettingsService } from './system-settings.service';
import { SystemSetting } from './schemas/system-setting.schema';

@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  async getSettings() {
    return this.systemSettingsService.getPublicSettings();
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('settings.manage')
  async getAdminSettings() {
    return this.systemSettingsService.getAdminSettings();
  }

  @Put('admin/:section')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('settings.manage')
  async updateSettingsSection(
    @Param('section') section: string,
    @Body() dto: Partial<SystemSetting> & { tmdbApiKey?: string },
    @Req() request: Request,
  ) {
    return this.systemSettingsService.updateSection(section, dto, request['user']?.sub);
  }

  @Post('admin/test-source')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('settings.manage')
  async testSource(@Body('sourceId') sourceId: string) {
    return this.systemSettingsService.testMovieSource(sourceId);
  }

  @Post('admin/test-tmdb')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('settings.manage')
  async testTmdb() {
    return this.systemSettingsService.testTmdb();
  }
}
