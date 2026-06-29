import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BannersService } from './banners.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  // Public endpoint for homepage
  @Get()
  async getActiveBanners() {
    return this.bannersService.findAllActive();
  }

  // Admin endpoints (protected by AuthGuard and RolesGuard)
  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  async getAdminBanners() {
    return this.bannersService.findAllForAdmin();
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  async createBanner(@Body() createBannerDto: any) {
    return this.bannersService.create(createBannerDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  async updateBanner(@Param('id') id: string, @Body() updateBannerDto: any) {
    return this.bannersService.update(id, updateBannerDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  async deleteBanner(@Param('id') id: string) {
    return this.bannersService.delete(id);
  }
}
