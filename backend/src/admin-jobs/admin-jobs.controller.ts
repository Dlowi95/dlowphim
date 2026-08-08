import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { AdminJobsService } from './admin-jobs.service';

@Controller('admin/jobs')
@UseGuards(AuthGuard, RolesGuard)
@RequirePermissions('jobs.manage')
export class AdminJobsController {
  constructor(private readonly jobsService: AdminJobsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('status') status?: string) {
    return this.jobsService.list(page, limit, status);
  }

  @Post()
  enqueue(@Req() request: Request, @Body('type') type: string) {
    return this.jobsService.enqueue(type, {}, request['user']?.sub);
  }

  @Post(':id/retry')
  retry(@Req() request: Request, @Param('id') id: string) {
    return this.jobsService.retry(id, request['user']?.sub);
  }
}
