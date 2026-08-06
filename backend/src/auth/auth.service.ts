import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { UserNotification, UserNotificationDocument } from '../notifications/schemas/user-notification.schema';

function normalizeEpisodeKey(name = ''): string {
  const normalized = String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  if (!normalized) return '';
  if (/\b(full|tron bo|complete)\b/.test(normalized)) return 'full';
  const numberTokens = normalized.match(/\d+(?:\.\d+)?/g);
  if (numberTokens?.length) {
    return numberTokens
      .map((token) => {
        const value = Number(token);
        return Number.isFinite(value) ? String(value) : token;
      })
      .join('-');
  }
  return normalized
    .replace(/\b(tap|episode|ep)\b/g, '')
    .replace(/[^a-z0-9]+/g, '') || normalized.replace(/\s+/g, '-');
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserNotification.name) private userNotificationModel: Model<UserNotificationDocument>,
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

    // Tự động tạo thông báo chào mừng thành viên mới
    try {
      const welcomeNotif = new this.userNotificationModel({
        userId: newUser._id,
        type: 'system',
        title: 'Chào mừng thành viên mới!',
        content: `Chào mừng bạn đến với DlowPhim! Hãy cập nhật avatar và tạo danh sách phát đầu tiên để bắt đầu trải nghiệm nhé.`,
        link: '/user/account',
        isRead: false,
      });
      await welcomeNotif.save();
    } catch (err) {
      console.error('Lỗi tạo thông báo chào mừng:', err);
    }

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
      gender: user.gender || 'other',
      favorites: user.favorites || [],
      watchHistory: user.watchHistory || [],
      playlists: user.playlists || [],
      role: user.role || 'member',
    };
  }

  async updateProfile(userId: string, updateDto: { displayName?: string; gender?: string; avatar?: string }) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (updateDto.displayName !== undefined) {
      user.displayName = updateDto.displayName.trim();
    }
    if (updateDto.gender !== undefined) {
      user.gender = updateDto.gender;
    }
    if (updateDto.avatar !== undefined) {
      user.avatar = updateDto.avatar;
    }

    await user.save();
    return {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      gender: user.gender,
      role: user.role,
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
    const newItem = {
      movieSlug: historyItem.movieSlug,
      movieName: historyItem.movieName,
      episodeName: historyItem.episodeName,
      episodeKey: normalizeEpisodeKey(historyItem.episodeName),
      currentTime: historyItem.currentTime,
      duration: historyItem.duration,
      progressMode: historyItem.progressMode === 'embed' ? 'embed' : 'exact',
      updatedAt: new Date(),
    };

    // Keep only the latest episode and resume point for each movie.
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { watchHistory: { movieSlug: historyItem.movieSlug } } }
    );

    // Atomic push new entry at start ($position: 0) and slice to max 50 ($slice: 50)
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $push: {
          watchHistory: {
            $each: [newItem],
            $position: 0,
            $slice: 50,
          },
        },
      },
      { new: true },
    );

    return { watchHistory: updatedUser?.watchHistory || [] };
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
          episodeKey: normalizeEpisodeKey(item.episodeName),
          currentTime: item.currentTime,
          duration: item.duration,
          progressMode: item.progressMode === 'embed' ? 'embed' : 'exact',
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

  async createPlaylist(userId: string, name: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    if (!user.playlists) {
      user.playlists = [];
    }
    const normalizedName = String(name || '').trim();
    if (normalizedName.length < 1 || normalizedName.length > 40) {
      throw new BadRequestException('Tên danh sách cần từ 1 đến 40 ký tự');
    }
    if (user.playlists.length >= 30) {
      throw new BadRequestException('Bạn chỉ có thể tạo tối đa 30 danh sách');
    }
    if (user.playlists.some((playlist) => playlist.name.trim().toLocaleLowerCase('vi') === normalizedName.toLocaleLowerCase('vi'))) {
      throw new BadRequestException('Tên danh sách này đã tồn tại');
    }
    const newPlaylist = {
      id: new Types.ObjectId().toString(),
      name: normalizedName,
      movies: [],
    };
    user.playlists.push(newPlaylist);
    user.markModified('playlists');
    await user.save();
    return user.playlists;
  }

  async deletePlaylist(userId: string, playlistId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    if (!user.playlists) {
      user.playlists = [];
    }
    user.playlists = user.playlists.filter((p) => p.id !== playlistId);
    user.markModified('playlists');
    await user.save();
    return user.playlists;
  }

  async updatePlaylistName(userId: string, playlistId: string, name: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    if (!user.playlists) {
      user.playlists = [];
    }
    const playlist = user.playlists.find((p) => p.id === playlistId);
    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách phát');
    }
    const normalizedName = String(name || '').trim();
    if (normalizedName.length < 1 || normalizedName.length > 40) {
      throw new BadRequestException('Tên danh sách cần từ 1 đến 40 ký tự');
    }
    if (user.playlists.some((item) => item.id !== playlistId && item.name.trim().toLocaleLowerCase('vi') === normalizedName.toLocaleLowerCase('vi'))) {
      throw new BadRequestException('Tên danh sách này đã tồn tại');
    }
    playlist.name = normalizedName;
    user.markModified('playlists');
    await user.save();
    return user.playlists;
  }

  async toggleMovieInPlaylist(userId: string, playlistId: string, movieSlug: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    if (!user.playlists) {
      user.playlists = [];
    }
    const playlist = user.playlists.find((p) => p.id === playlistId);
    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách phát');
    }
    const normalizedSlug = String(movieSlug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(normalizedSlug)) {
      throw new BadRequestException('Mã phim không hợp lệ');
    }
    const movieIndex = playlist.movies.indexOf(normalizedSlug);
    if (movieIndex > -1) {
      playlist.movies.splice(movieIndex, 1);
    } else {
      if (playlist.movies.length >= 200) {
        throw new BadRequestException('Mỗi danh sách chỉ có thể chứa tối đa 200 phim');
      }
      playlist.movies.push(normalizedSlug);
    }
    user.markModified('playlists');
    await user.save();
    return user.playlists;
  }

  async clearHistoryItem(userId: string, movieSlug: string) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { watchHistory: { movieSlug } } },
      { new: true },
    );
    return { watchHistory: updatedUser?.watchHistory || [] };
  }

  async clearAllHistory(userId: string) {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { watchHistory: [] } },
    );
    return { watchHistory: [] };
  }
}
