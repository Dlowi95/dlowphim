import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { hasAdminPermission, normalizeAdminRole, permissionsForRole, type AdminPermission } from '../admin-permissions';
import { ADMIN_PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userPayload = request.user;
    if (!userPayload || !userPayload.sub) {
      throw new ForbiddenException('Không tìm thấy thông tin xác thực');
    }

    const user = await this.userModel.findById(userPayload.sub).exec();
    const role = normalizeAdminRole(user?.role);
    if (!user || !role || user.isActive === false || user.isDeleted === true) {
      throw new ForbiddenException('Bạn không có quyền quản trị viên');
    }
    const required = this.reflector.getAllAndOverride<AdminPermission[]>(ADMIN_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || [];
    if (required.some((permission) => !hasAdminPermission(role, permission))) {
      throw new ForbiddenException('Vai trò của bạn không có quyền thực hiện thao tác này');
    }
    request.adminUser = {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      role,
      permissions: permissionsForRole(role),
    };
    return true;
  }
}
