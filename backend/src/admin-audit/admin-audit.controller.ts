import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator';
import { AdminAuditService } from './admin-audit.service';

@Controller('admin/audit-logs')
@UseGuards(AuthGuard, RolesGuard)
@RequirePermissions('audit.read')
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.list({ page, limit, search, status, action });
  }
}
