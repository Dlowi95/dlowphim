import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditLog, AdminAuditLogSchema } from './schemas/admin-audit-log.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [AdminAuditController],
  providers: [AdminAuditService, { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor }],
  exports: [AdminAuditService],
})
export class AdminAuditModule {}
