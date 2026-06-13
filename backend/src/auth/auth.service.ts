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
      },
    };
  }

  async register(registerDto: any) {
    const { email, password, displayName } = registerDto;

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

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
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
    return {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
    };
  }
}
