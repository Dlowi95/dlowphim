import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async signToken(user: any) {
    const payload = { sub: user._id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        favorites: user.favorites || [],
        watchHistory: user.watchHistory || [],
        role: user.role || 'member',
      },
    };
  }

  async register(registerDto: any) {
    const { email, password, displayName } = registerDto;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Email không đúng định dạng');
    }

    // Check if user exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      displayName,
    });

    await newUser.save();
    return { message: 'Đăng ký thành công' };
  }

  async login(loginDto: any) {
    const { email, password } = loginDto;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Email không đúng định dạng');
    }

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa bởi quản trị viên');
    }

    if (!user.password) {
      throw new BadRequestException(
        'Tài khoản này được đăng ký bằng Google. Hãy chọn đăng nhập bằng Google.',
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.signToken(user);
  }

  async googleLogin(googleDto: { idToken?: string; accessToken?: string }) {
    const { idToken, accessToken } = googleDto;

    try {
      let email: string;
      let name: string;
      let picture: string | undefined;
      let sub: string;

      if (accessToken) {
        // Verify via UserInfo endpoint
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          throw new BadRequestException('Access Token Google không hợp lệ');
        }
        const data = await res.json();
        email = data.email;
        name = data.name || data.given_name || 'Google User';
        picture = data.picture;
        sub = data.sub;
      } else if (idToken) {
        // Verify via OAuth2Client
        const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
        const ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: clientId,
        });

        const payload = ticket.getPayload();
        if (!payload) {
          throw new BadRequestException('ID Token không hợp lệ');
        }

        email = payload.email!;
        name = payload.name || 'Google User';
        picture = payload.picture;
        sub = payload.sub;
      } else {
        throw new BadRequestException('Thiếu Token xác thực Google');
      }

      let user = await this.userModel.findOne({ email });

      if (user && user.isActive === false) {
        throw new UnauthorizedException('Tài khoản của bạn đã bị khóa bởi quản trị viên');
      }

      if (!user) {
        // Create new user if not exists
        user = new this.userModel({
          email,
          displayName: name,
          avatar: picture,
          googleId: sub,
        });
        await user.save();
      } else {
        // If user exists but googleId or avatar not linked/updated
        let hasChanges = false;
        if (!user.googleId) {
          user.googleId = sub;
          hasChanges = true;
        }
        if (!user.avatar && picture) {
          user.avatar = picture;
          hasChanges = true;
        }
        if (hasChanges) {
          await user.save();
        }
      }

      return this.signToken(user);
    } catch (error) {
      console.error('Lỗi xác thực Google Token:', error);
      throw new UnauthorizedException('Xác thực tài khoản Google thất bại');
    }
  }

  async getMe(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    if (user.isActive === false) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa bởi quản trị viên');
    }
    return {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      favorites: user.favorites || [],
      watchHistory: user.watchHistory || [],
      role: user.role || 'member',
    };
  }

  async toggleFavorite(userId: string, movieSlug: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (!user.favorites) {
      user.favorites = [];
    }

    const index = user.favorites.indexOf(movieSlug);
    if (index > -1) {
      user.favorites.splice(index, 1);
    } else {
      user.favorites.push(movieSlug);
    }

    await user.save();
    return { favorites: user.favorites };
  }

  async syncFavorites(userId: string, localFavorites: string[]) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (!user.favorites) {
      user.favorites = [];
    }

    const merged = Array.from(new Set([...user.favorites, ...localFavorites]));
    user.favorites = merged;

    await user.save();
    return { favorites: user.favorites };
  }

  async updateHistory(userId: string, historyItem: any) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (!user.watchHistory) {
      user.watchHistory = [];
    }

    user.watchHistory = user.watchHistory.filter(
      (item) => item.movieSlug !== historyItem.movieSlug,
    );

    user.watchHistory.unshift({
      movieSlug: historyItem.movieSlug,
      movieName: historyItem.movieName,
      episodeName: historyItem.episodeName,
      currentTime: historyItem.currentTime,
      duration: historyItem.duration,
      updatedAt: new Date(),
    });

    if (user.watchHistory.length > 50) {
      user.watchHistory = user.watchHistory.slice(0, 50);
    }

    user.markModified('watchHistory');
    await user.save();

    return { watchHistory: user.watchHistory };
  }

  async syncHistory(userId: string, localHistory: any[]) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (!user.watchHistory) {
      user.watchHistory = [];
    }

    const historyMap = new Map<string, any>();
    
    user.watchHistory.forEach(item => {
      historyMap.set(item.movieSlug, item);
    });

    localHistory.forEach(item => {
      const existing = historyMap.get(item.movieSlug);
      if (!existing || new Date(item.updatedAt || new Date()) > new Date(existing.updatedAt)) {
        historyMap.set(item.movieSlug, {
          movieSlug: item.movieSlug,
          movieName: item.movieName,
          episodeName: item.episodeName,
          currentTime: item.currentTime,
          duration: item.duration,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        });
      }
    });

    const merged = Array.from(historyMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    user.watchHistory = merged.slice(0, 50);
    user.markModified('watchHistory');
    await user.save();

    return { watchHistory: user.watchHistory };
  }

  async getAllUsers() {
    return this.userModel
      .find({}, 'email displayName avatar role isActive createdAt')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateUserRole(adminId: string, userId: string, newRole: string) {
    if (adminId === userId) {
      throw new BadRequestException('Bạn không thể tự thay đổi vai trò của chính mình');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    user.role = newRole;
    await user.save();
    return { message: 'Cập nhật vai trò thành công', user: { id: user._id, role: user.role } };
  }

  async updateUserStatus(adminId: string, userId: string, isActive: boolean) {
    if (adminId === userId) {
      throw new BadRequestException('Bạn không thể tự khóa tài khoản của chính mình');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    user.isActive = isActive;
    await user.save();
    return {
      message: isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
      user: { id: user._id, isActive: user.isActive },
    };
  }

  async deleteUser(adminId: string, userId: string) {
    if (adminId === userId) {
      throw new BadRequestException('Bạn không thể tự xóa tài khoản của chính mình');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    await this.userModel.findByIdAndDelete(userId).exec();
    return { message: 'Đã xóa người dùng thành công' };
  }
}
