import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  // Public endpoint for homepage
  @Get()
  async getActiveBanners() {
    return this.bannersService.findAllActive();
  }

  @Get('hero')
  async getResolvedHero() {
    return this.bannersService.getResolvedHero(false);
  }

  @Get('hero/admin')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('banners.manage')
  async getResolvedHeroForAdmin() {
    return this.bannersService.getResolvedHero(true);
  }

  // Admin endpoints (protected by AuthGuard and RolesGuard)
  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('banners.manage')
  async getAdminBanners() {
    return this.bannersService.findAllForAdmin();
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('banners.manage')
  async createBanner(@Body() createBannerDto: any) {
    return this.bannersService.create(createBannerDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('banners.manage')
  async updateBanner(@Param('id') id: string, @Body() updateBannerDto: any) {
    return this.bannersService.update(id, updateBannerDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermissions('banners.manage')
  async deleteBanner(@Param('id') id: string) {
    return this.bannersService.delete(id);
  }
}
