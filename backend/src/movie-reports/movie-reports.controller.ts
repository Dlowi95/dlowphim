import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MovieReportsService } from './movie-reports.service';

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
      errorType: string;
      description?: string;
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
    return this.movieReportsService.createReport(userId, dto);
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  async getReportsForAdmin() {
    return this.movieReportsService.getReportsForAdmin();
  }

  @Put('admin/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.movieReportsService.updateStatus(id, status);
  }

  @Delete('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  async deleteReport(@Param('id') id: string) {
    return this.movieReportsService.deleteReport(id);
  }
}
