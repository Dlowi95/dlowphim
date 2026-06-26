import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userPayload = request.user;
    if (!userPayload || !userPayload.sub) {
      throw new ForbiddenException('Không tìm thấy thông tin xác thực');
    }

    const user = await this.userModel.findById(userPayload.sub).exec();
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền quản trị viên');
    }
    return true;
  }
}
