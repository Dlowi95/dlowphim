import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SystemSettingsService } from './system-settings.service';
import { SystemSetting } from './schemas/system-setting.schema';

@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  async getSettings() {
    return this.systemSettingsService.getSettings();
  }

  @Put()
  @UseGuards(AuthGuard, RolesGuard)
  async updateSettings(@Body() dto: Partial<SystemSetting>) {
    return this.systemSettingsService.updateSettings(dto);
  }
}
