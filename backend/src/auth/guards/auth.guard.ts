import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Không có quyền truy cập');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const sessionIsValid = await this.authService.validateSession(
        payload.sub,
        payload.tokenVersion,
      );
      if (!sessionIsValid) {
        throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
      }
      // Gán payload vào request để controller lấy thông tin
      request['user'] = payload;
    } catch (err) {
      throw new UnauthorizedException('Token đã hết hạn hoặc không hợp lệ');
    }
    
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
