import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, HttpException, HttpStatus, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
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
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;
  private readonly loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
  private readonly forgotPasswordAttempts = new Map<string, { count: number; resetAt: number }>();
  private readonly verificationAttempts = new Map<string, { count: number; resetAt: number }>();

  private async verifyTurnstile(token: unknown, expectedAction: 'login' | 'register') {
    const secret = String(this.configService.get<string>('TURNSTILE_SECRET_KEY') || '').trim();
    if (!secret) {
      this.logger.error('TURNSTILE_SECRET_KEY is missing; password authentication is disabled.');
      throw new HttpException(
        'Xác minh bảo mật đang được bảo trì. Vui lòng thử lại sau.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const responseToken = String(token || '').trim();
    if (!responseToken || responseToken.length > 2048) {
      throw new BadRequestException('Vui lòng hoàn tất xác minh bảo mật Cloudflare.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: responseToken }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Turnstile Siteverify returned ${response.status}`);

      const result = await response.json() as {
        success?: boolean;
        hostname?: string;
        action?: string;
        'error-codes'?: string[];
      };
      const allowedHostnames = String(this.configService.get<string>('TURNSTILE_ALLOWED_HOSTNAMES') || '')
        .split(',')
        .map((hostname) => hostname.trim().toLowerCase())
        .filter(Boolean);
      const hostname = String(result.hostname || '').toLowerCase();
      const hostnameAllowed = allowedHostnames.length === 0 || allowedHostnames.includes(hostname);

      if (!result.success || result.action !== expectedAction || !hostnameAllowed) {
        this.logger.warn(`Turnstile rejected ${expectedAction}: ${result['error-codes']?.join(',') || 'invalid-context'}`);
        throw new BadRequestException('Xác minh bảo mật không hợp lệ hoặc đã hết hạn.');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Turnstile Siteverify unavailable', error instanceof Error ? error.message : error);
      throw new HttpException(
        'Chưa thể kết nối dịch vụ xác minh bảo mật. Vui lòng thử lại.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

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

  async onModuleInit() {
    await this.ensureSingleSuperAdmin();
  }

  private async ensureSingleSuperAdmin() {
    const configuredEmail = String(this.configService.get<string>('SUPER_ADMIN_EMAIL') || '').trim().toLowerCase();
    const current = await this.userModel.findOne({ role: 'super_admin', isDeleted: { $ne: true } }).sort({ createdAt: 1 });

    // SUPER_ADMIN_EMAIL is the only supported ownership-transfer mechanism.
    // Validate the target before touching the current owner so a typo can never leave the system ownerless.
    if (current && configuredEmail && current.email !== configuredEmail) {
      const candidate = await this.userModel.findOne({ email: configuredEmail, isDeleted: { $ne: true } });
      if (!candidate) {
        this.logger.error(`SUPER_ADMIN_EMAIL=${configuredEmail} does not match an active account; keeping ${current.email} as owner.`);
      } else {
        const previousTokenVersion = current.tokenVersion || 0;
        current.role = 'content_admin';
        current.tokenVersion = previousTokenVersion + 1;
        await current.save();
        try {
          candidate.role = 'super_admin';
          candidate.isActive = true;
          candidate.tokenVersion = (candidate.tokenVersion || 0) + 1;
          await candidate.save();
          this.logger.log(`Super Admin ownership transferred from ${current.email} to ${candidate.email}`);
        } catch (error) {
          current.role = 'super_admin';
          current.tokenVersion = previousTokenVersion + 2;
          await current.save();
          this.logger.error('Super Admin transfer failed and previous ownership was restored.', error);
          throw error;
        }
      }
    } else if (!current) {
      const candidate = configuredEmail
        ? await this.userModel.findOne({ email: configuredEmail, isDeleted: { $ne: true } })
        : await this.userModel.findOne({ role: 'admin', isDeleted: { $ne: true } }).sort({ createdAt: 1 });
      if (candidate) {
        candidate.role = 'super_admin';
        candidate.isActive = true;
        candidate.tokenVersion = (candidate.tokenVersion || 0) + 1;
        await candidate.save();
        this.logger.log(`Super Admin owner initialized: ${candidate.email}`);
      } else {
        this.logger.warn('No Super Admin owner found. Set SUPER_ADMIN_EMAIL or keep one legacy admin account.');
      }
    }

    // Migrate any remaining legacy 'admin' roles to content_admin
    await this.userModel.updateMany(
      { role: 'admin' },
      { $set: { role: 'content_admin' }, $inc: { tokenVersion: 1 } },
    );
  }

  async signToken(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        gender: user.gender || 'other',
        favorites: user.favorites || [],
        watchHistory: user.watchHistory || [],
        playlists: user.playlists || [],
        role: user.role || 'member',
        authProvider: user.password
          ? user.googleId
            ? 'hybrid'
            : 'password'
          : 'google',
      },
    };
  }

  async validateSession(userId: string, tokenVersion = 0): Promise<boolean> {
    return Boolean(await this.getValidSessionUser(userId, tokenVersion));
  }

  async getValidSessionUser(userId: string, tokenVersion = 0) {
    if (!Types.ObjectId.isValid(userId)) return false;

    const user = await this.userModel
      .findById(userId)
      .select('_id tokenVersion isActive role')
      .lean();

    if (!user || user.isActive === false || (user.tokenVersion || 0) !== (tokenVersion || 0)) {
      return null;
    }
    return user;
  }

  private validatePassword(password: string) {
    if (password.length < 8 || password.length > 72) {
      throw new BadRequestException('Mật khẩu cần từ 8 đến 72 ký tự');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException('Mật khẩu cần có ít nhất một chữ cái và một chữ số');
    }
  }

  validateDisplayName(displayName: unknown): string {
    if (typeof displayName !== 'string') {
      throw new BadRequestException('Tên hiển thị không hợp lệ');
    }
    const trimmed = displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      throw new BadRequestException('Tên hiển thị cần từ 2 đến 80 ký tự');
    }
    return trimmed;
  }

  validateGender(gender: unknown): string {
    if (typeof gender !== 'string') {
      throw new BadRequestException('Giới tính không hợp lệ');
    }
    const normalized = gender.trim().toLowerCase();
    const validGenders = ['male', 'female', 'other'];
    if (!validGenders.includes(normalized)) {
      throw new BadRequestException('Giới tính không hợp lệ. Chỉ chấp nhận male, female hoặc other');
    }
    return normalized;
  }

  private isAllowedLocalAvatarPath(path: string): boolean {
    if (path === '/images/avatars/default.png') return true;
    if (/^\/images\/avatars\/hoathinh\/(?:[1-9]|1[0-9]|2[0-6])\.webp$/.test(path)) return true;
    return false;
  }

  private verifyImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
    if (buffer.byteLength < 12) return false;

    if (mimeType === 'png') {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }

    if (mimeType === 'jpeg' || mimeType === 'jpg') {
      // JPEG SOI marker: FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (mimeType === 'gif') {
      // GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
      const isGif87 =
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        buffer[4] === 0x37 &&
        buffer[5] === 0x61;
      const isGif89 =
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        buffer[4] === 0x39 &&
        buffer[5] === 0x61;
      return isGif87 || isGif89;
    }

    if (mimeType === 'webp') {
      // RIFF header (52 49 46 46) ... WEBP (57 45 42 50)
      const isRiff =
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46;
      const isWebp =
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50;
      return isRiff && isWebp;
    }

    return false;
  }

  validateAvatar(avatar: unknown): string {
    if (avatar === null || avatar === undefined || avatar === '') {
      return '';
    }
    if (typeof avatar !== 'string') {
      throw new BadRequestException('Ảnh đại diện không hợp lệ');
    }

    const trimmed = avatar.trim();
    if (!trimmed) return '';

    // Reject dangerous schemes
    if (/^(javascript|vbscript|file):/i.test(trimmed)) {
      throw new BadRequestException('Định dạng ảnh đại diện không an toàn');
    }

    // Reject encoded traversal or illegal control characters
    if (/[\x00-\x1f\x7f]|%2e|%2f|%5c|\.\.|\\/i.test(trimmed)) {
      throw new BadRequestException('Đường dẫn ảnh đại diện không hợp lệ');
    }

    // Special recognized badge / local token
    if (trimmed === 'vietnam-flag') {
      return trimmed;
    }

    // 1. Data URLs (Base64 raster image uploads only: png, jpeg, webp, gif)
    if (trimmed.startsWith('data:')) {
      const match = trimmed.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i);
      if (!match) {
        throw new BadRequestException('Chỉ chấp nhận ảnh tải lên định dạng PNG, JPEG, WebP hoặc GIF');
      }
      const mimeType = match[1].toLowerCase();
      const base64Data = match[2];

      if (base64Data.length % 4 !== 0) {
        throw new BadRequestException('Dữ liệu base64 của ảnh không hợp lệ');
      }

      try {
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.toString('base64') !== base64Data) {
          throw new BadRequestException('Dữ liệu base64 của ảnh không hợp lệ');
        }

        const maxBytes = 5 * 1024 * 1024; // 5MB decoded size limit
        if (buffer.byteLength > maxBytes) {
          throw new BadRequestException('Kích thước ảnh đại diện không được vượt quá 5MB');
        }
        if (buffer.byteLength < 12) {
          throw new BadRequestException('Dữ liệu ảnh đại diện quá ngắn hoặc bị rỗng');
        }

        if (!this.verifyImageMagicBytes(buffer, mimeType)) {
          throw new BadRequestException('Nội dung ảnh không khớp với định dạng khai báo');
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Dữ liệu base64 của ảnh không hợp lệ');
      }
      return trimmed;
    }

    // 2. Relative / Public avatar paths (Strict allowlist only)
    if (trimmed.startsWith('/')) {
      if (!this.isAllowedLocalAvatarPath(trimmed)) {
        throw new BadRequestException('Đường dẫn ảnh đại diện không nằm trong danh mục cho phép');
      }
      return trimmed;
    }

    // 3. Remote HTTP/HTTPS URLs
    try {
      const parsedUrl = new URL(trimmed);
      const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      if (parsedUrl.protocol === 'https:' || (isLocalhost && parsedUrl.protocol === 'http:')) {
        return trimmed;
      }
      throw new BadRequestException('Chỉ chấp nhận đường dẫn ảnh đại diện bảo mật (HTTPS)');
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Đường dẫn ảnh đại diện không hợp lệ');
    }
  }

  private async createWelcomeNotification(userId: Types.ObjectId) {
    try {
      await this.userNotificationModel.create({
        userId,
        type: 'system',
        title: 'Chào mừng thành viên mới!',
        content: 'Chào mừng bạn đến với DlowPhim! Hãy cập nhật avatar và tạo danh sách phát đầu tiên để bắt đầu trải nghiệm nhé.',
        link: '/user/account',
        isRead: false,
        dedupKey: 'welcome',
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      console.error('Lỗi tạo thông báo chào mừng:', error);
    }
  }

  async register(registerDto: any) {
    await this.verifyTurnstile(registerDto?.turnstileToken, 'register');
    const email = String(registerDto?.email || '').trim().toLowerCase();
    const password = String(registerDto?.password || '');
    const displayName = String(registerDto?.displayName || '').trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Email không đúng định dạng');
    }
    if (displayName.length < 2 || displayName.length > 40) {
      throw new BadRequestException('Tên hiển thị cần từ 2 đến 40 ký tự');
    }
    this.validatePassword(password);

    // Check if user exists
    const existingUser = await this.userModel
      .findOne({ email })
      .collation({ locale: 'en', strength: 2 });
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const rawVerificationToken = randomBytes(32).toString('hex');
    const verificationTokenHash = createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Tài khoản đăng ký tay chỉ được kích hoạt sau khi xác minh email.
    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      displayName,
      emailVerificationTokenHash: verificationTokenHash,
      emailVerificationRequestedAt: new Date(),
      emailVerificationExpiresAt: verificationExpiresAt,
    });

    await newUser.save();
    const frontendUrl = this.getPrimaryFrontendUrl();
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawVerificationToken}`;
    try {
      await this.sendVerificationEmail(email, displayName, verificationUrl, verificationTokenHash);
    } catch (error) {
      await this.userModel.deleteOne({ _id: newUser._id, emailVerifiedAt: { $exists: false } });
      console.error('[Auth] Không gửi được email xác minh:', error instanceof Error ? error.message : error);
      throw new HttpException('Chưa thể gửi email xác minh. Vui lòng thử đăng ký lại sau.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      requiresEmailVerification: true,
      email,
      message: 'Đăng ký thành công. Hãy kiểm tra email để kích hoạt tài khoản trong 72 giờ.',
    };
  }

  async login(loginDto: any) {
    await this.verifyTurnstile(loginDto?.turnstileToken, 'login');
    const email = String(loginDto?.email || '').trim().toLowerCase();
    const password = String(loginDto?.password || '');

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Email không đúng định dạng');
    }

    const attempt = this.loginAttempts.get(email);
    if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((attempt.lockedUntil - Date.now()) / 60_000));
      throw new UnauthorizedException(`Bạn đã nhập sai quá nhiều lần. Hãy thử lại sau ${remainingMinutes} phút.`);
    }
    if (attempt?.lockedUntil && attempt.lockedUntil <= Date.now()) {
      this.loginAttempts.delete(email);
    }

    const user = await this.userModel
      .findOne({ email })
      .select('+emailVerificationExpiresAt')
      .collation({ locale: 'en', strength: 2 });
    if (!user) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa bởi quản trị viên');
    }

    if (!user.emailVerifiedAt && user.emailVerificationExpiresAt) {
      throw new UnauthorizedException('Email chưa được xác minh. Hãy kiểm tra hộp thư hoặc yêu cầu gửi lại liên kết.');
    }

    if (!user.password) {
      throw new BadRequestException(
        'Tài khoản này được đăng ký bằng Google. Hãy chọn đăng nhập bằng Google.',
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    this.loginAttempts.delete(email);
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    await user.save();
    return this.signToken(user);
  }

  private recordFailedLogin(email: string) {
    const previous = this.loginAttempts.get(email);
    const count = (previous?.count || 0) + 1;
    this.loginAttempts.set(email, {
      count,
      lockedUntil: count >= 5 ? Date.now() + 15 * 60_000 : 0,
    });
    if (this.loginAttempts.size > 5_000) {
      const now = Date.now();
      for (const [key, value] of this.loginAttempts) {
        if (!value.lockedUntil || value.lockedUntil <= now) this.loginAttempts.delete(key);
        if (this.loginAttempts.size <= 4_000) break;
      }
    }
  }

  private assertForgotPasswordAllowed(clientKey: string) {
    const now = Date.now();
    const previous = this.forgotPasswordAttempts.get(clientKey);
    if (!previous || previous.resetAt <= now) {
      this.forgotPasswordAttempts.set(clientKey, {
        count: 1,
        resetAt: now + 15 * 60_000,
      });
      return;
    }
    if (previous.count >= 5) {
      const remainingMinutes = Math.max(1, Math.ceil((previous.resetAt - now) / 60_000));
      throw new HttpException(
        `Bạn đã yêu cầu quá nhiều lần. Hãy thử lại sau ${remainingMinutes} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    previous.count += 1;
    this.forgotPasswordAttempts.set(clientKey, previous);
    if (this.forgotPasswordAttempts.size > 5_000) {
      for (const [key, value] of this.forgotPasswordAttempts) {
        if (value.resetAt <= now) this.forgotPasswordAttempts.delete(key);
        if (this.forgotPasswordAttempts.size <= 4_000) break;
      }
    }
  }

  private getPrimaryFrontendUrl(): string {
    const raw = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;',
    })[character] || character);
  }

  private async sendPasswordResetEmail(email: string, displayName: string, resetUrl: string, idempotencyKey: string) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('RESEND_FROM_EMAIL');
    if (!apiKey || !from) {
      throw new Error('Thiếu RESEND_API_KEY hoặc RESEND_FROM_EMAIL');
    }

    const safeName = this.escapeHtml(displayName || 'bạn');
    const safeUrl = this.escapeHtml(resetUrl);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Đặt lại mật khẩu DlowPhim',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">
            <h2 style="color:#ec4899">Đặt lại mật khẩu DlowPhim</h2>
            <p>Xin chào ${safeName},</p>
            <p>Bạn vừa yêu cầu đặt lại mật khẩu. Liên kết bên dưới chỉ dùng được một lần và sẽ hết hạn sau 15 phút.</p>
            <p style="margin:28px 0">
              <a href="${safeUrl}" style="background:#ec4899;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Đặt lại mật khẩu</a>
            </p>
            <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
          </div>
        `,
        text: `Đặt lại mật khẩu DlowPhim: ${resetUrl}\nLiên kết chỉ dùng được một lần và hết hạn sau 15 phút.`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend trả về HTTP ${response.status}`);
    }
  }

  private async sendVerificationEmail(email: string, displayName: string, verificationUrl: string, idempotencyKey: string) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('RESEND_FROM_EMAIL');
    if (!apiKey || !from) throw new Error('Thiếu cấu hình Resend');

    const safeName = this.escapeHtml(displayName || 'bạn');
    const safeUrl = this.escapeHtml(verificationUrl);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `verify-${idempotencyKey}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Xác minh tài khoản DlowPhim',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">
            <h2 style="color:#ec4899">Xác minh tài khoản DlowPhim</h2>
            <p>Xin chào ${safeName},</p>
            <p>Hãy xác minh email để hoàn tất đăng ký. Liên kết có hiệu lực trong 72 giờ.</p>
            <p style="margin:28px 0"><a href="${safeUrl}" style="background:#ec4899;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Xác minh email</a></p>
            <p>Nếu bạn không đăng ký DlowPhim, hãy bỏ qua email này.</p>
          </div>
        `,
        text: `Xác minh tài khoản DlowPhim: ${verificationUrl}\nLiên kết có hiệu lực trong 72 giờ.`,
      }),
    });
    if (!response.ok) throw new Error(`Resend trả về HTTP ${response.status}`);
  }

  private assertVerificationAllowed(clientKey: string) {
    const now = Date.now();
    const previous = this.verificationAttempts.get(clientKey);
    if (!previous || previous.resetAt <= now) {
      this.verificationAttempts.set(clientKey, { count: 1, resetAt: now + 15 * 60_000 });
      return;
    }
    if (previous.count >= 5) {
      throw new HttpException('Bạn đã yêu cầu quá nhiều lần. Hãy thử lại sau 15 phút.', HttpStatus.TOO_MANY_REQUESTS);
    }
    previous.count += 1;
  }

  async verifyEmail(tokenValue: unknown) {
    const token = String(tokenValue || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new BadRequestException('Liên kết xác minh không hợp lệ');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await this.userModel.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: new Date() },
      isDeleted: { $ne: true },
    }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!user) throw new BadRequestException('Liên kết xác minh không hợp lệ hoặc đã hết hạn');

    user.emailVerifiedAt = new Date();
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerificationRequestedAt = undefined;
    await user.save();
    await this.createWelcomeNotification(user._id);
    return { message: 'Xác minh email thành công. Bạn có thể đăng nhập DlowPhim.' };
  }

  async resendVerification(emailValue: unknown, clientKey: string) {
    this.assertVerificationAllowed(clientKey || 'unknown');
    const email = String(emailValue || '').trim().toLowerCase();
    const genericMessage = 'Nếu tài khoản đang chờ xác minh, DlowPhim đã gửi một liên kết mới.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email không đúng định dạng');
    const user = await this.userModel.findOne({ email, emailVerifiedAt: { $exists: false }, isDeleted: { $ne: true } });
    if (!user || user.googleId || !user.password) return { message: genericMessage };

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationRequestedAt = new Date();
    user.emailVerificationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await user.save();
    const frontendUrl = this.getPrimaryFrontendUrl();
    try {
      await this.sendVerificationEmail(email, user.displayName, `${frontendUrl}/verify-email?token=${rawToken}`, tokenHash);
    } catch (error) {
      console.error('[Auth] Không gửi lại được email xác minh:', error instanceof Error ? error.message : error);
    }
    return { message: genericMessage };
  }

  async forgotPassword(emailValue: unknown, clientKey: string) {
    this.assertForgotPasswordAllowed(clientKey || 'unknown');
    const email = String(emailValue || '').trim().toLowerCase();
    const genericMessage = 'Nếu email hỗ trợ khôi phục mật khẩu, DlowPhim đã gửi hướng dẫn đến hộp thư của bạn.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Email không đúng định dạng');
    }

    const user = await this.userModel
      .findOne({ email })
      .select('+passwordResetRequestedAt')
      .collation({ locale: 'en', strength: 2 });

    // Luôn trả cùng một nội dung cho email không tồn tại và tài khoản Google-only.
    if (!user?.password) return { message: genericMessage };

    const requestedAt = user.passwordResetRequestedAt?.getTime?.() || 0;
    if (Date.now() - requestedAt < 60_000) return { message: genericMessage };

    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('RESEND_FROM_EMAIL');
    if (!apiKey || !from) {
      console.error('[Auth] Resend chưa được cấu hình; không thể gửi email đặt lại mật khẩu.');
      return { message: genericMessage };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    user.passwordResetRequestedAt = new Date();
    await user.save();

    const frontendUrl = this.getPrimaryFrontendUrl();
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    try {
      await this.sendPasswordResetEmail(email, user.displayName, resetUrl, tokenHash);
    } catch (error) {
      await this.userModel.updateOne(
        { _id: user._id, passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
      );
      console.error('[Auth] Không gửi được email đặt lại mật khẩu:', error instanceof Error ? error.message : error);
    }

    return { message: genericMessage };
  }

  async resetPassword(tokenValue: unknown, passwordValue: unknown) {
    const token = String(tokenValue || '').trim();
    const password = String(passwordValue || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    this.validatePassword(password);

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userModel.findOneAndUpdate(
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
        password: { $exists: true, $ne: null },
      },
      {
        $set: { password: hashedPassword },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
          passwordResetRequestedAt: 1,
        },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!user) {
      throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    this.loginAttempts.delete(user.email.toLowerCase());
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
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
        if (!data.email || data.email_verified !== true) {
          throw new BadRequestException('Email Google chưa được xác minh');
        }
        email = String(data.email).trim().toLowerCase();
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

        if (!payload.email || payload.email_verified !== true) {
          throw new BadRequestException('Email Google chưa được xác minh');
        }
        email = payload.email.trim().toLowerCase();
        name = payload.name || 'Google User';
        picture = payload.picture;
        sub = payload.sub;
      } else {
        throw new BadRequestException('Thiếu Token xác thực Google');
      }

      let user = await this.userModel
        .findOne({ email })
        .collation({ locale: 'en', strength: 2 });

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
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        });
        await user.save();
        await this.createWelcomeNotification(user._id);
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
        if (!user.emailVerifiedAt) {
          user.emailVerifiedAt = new Date();
          hasChanges = true;
        }
        if (hasChanges) {
          await user.save();
          await this.userModel.updateOne(
            { _id: user._id },
            { $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1, emailVerificationRequestedAt: 1 } },
          );
        }
      }

      user.lastLoginAt = new Date();
      user.lastActiveAt = new Date();
      await user.save();
      return this.signToken(user);
    } catch (error) {
      console.error('Lỗi xác thực Google Token:', error);
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
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
    const lastActiveTime = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    if (Date.now() - lastActiveTime > 15 * 60 * 1000) {
      user.lastActiveAt = new Date();
      await user.save();
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
      authProvider: user.password
        ? user.googleId
          ? 'hybrid'
          : 'password'
        : 'google',
    };
  }

  async updateProfile(userId: string, updateDto: { displayName?: string; gender?: string; avatar?: string }) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (updateDto.displayName !== undefined) {
      user.displayName = this.validateDisplayName(updateDto.displayName);
    }
    if (updateDto.gender !== undefined) {
      user.gender = this.validateGender(updateDto.gender);
    }
    if (updateDto.avatar !== undefined) {
      user.avatar = this.validateAvatar(updateDto.avatar);
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
    const movieSlug = String(historyItem?.movieSlug || '').trim();
    if (!movieSlug) {
      throw new BadRequestException('Thiếu mã phim trong lịch sử xem');
    }

    const parsedUpdatedAt = new Date(historyItem?.updatedAt || Date.now());
    const updatedAt = Number.isNaN(parsedUpdatedAt.getTime())
      ? new Date()
      : parsedUpdatedAt;
    const currentTime = Number(historyItem?.currentTime);
    const duration = Number(historyItem?.duration);
    const newItem = {
      movieSlug,
      movieName: String(historyItem?.movieName || ''),
      episodeName: String(historyItem?.episodeName || ''),
      episodeKey: normalizeEpisodeKey(historyItem?.episodeName),
      currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
      progressMode: historyItem.progressMode === 'embed' ? 'embed' : 'exact',
      updatedAt,
    };

    // Update the latest resume point in one atomic operation. The timestamp guard
    // prevents a slower, older request from overwriting a newer pause/pagehide sync.
    await this.userModel.updateOne(
      {
        _id: userId,
        watchHistory: {
          $not: {
            $elemMatch: {
              movieSlug,
              updatedAt: { $gt: updatedAt },
            },
          },
        },
      },
      [
        {
          $set: {
            watchHistory: {
              $slice: [
                {
                  $concatArrays: [
                    [newItem],
                    {
                      $filter: {
                        input: { $ifNull: ['$watchHistory', []] },
                        as: 'historyItem',
                        cond: { $ne: ['$$historyItem.movieSlug', movieSlug] },
                      },
                    },
                  ],
                },
                50,
              ],
            },
          },
        },
      ],
    );

    const updatedUser = await this.userModel.findById(userId).select('watchHistory');
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

  async getAllUsers(filters: {
    search?: string;
    page?: string;
    limit?: string;
    role?: string;
    status?: string;
    activity?: string;
    provider?: string;
    verification?: string;
  } = {}) {
    const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
    const limit = Math.min(50, Math.max(5, Number.parseInt(filters.limit || '10', 10) || 10));
    const query: Record<string, any> = { isDeleted: { $ne: true } };
    const search = String(filters.search || '').trim().slice(0, 100);

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { displayName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (['member', 'super_admin', 'content_admin', 'moderator', 'support'].includes(String(filters.role))) {
      query.role = filters.role;
    }
    if (filters.status === 'active') query.isActive = { $ne: false };
    if (filters.status === 'blocked') query.isActive = false;
    if (filters.provider === 'google') query.googleId = { $exists: true, $ne: '' };
    if (filters.provider === 'password') {
      query.password = { $exists: true, $ne: '' };
      query.googleId = { $in: [null, ''] };
    }
    if (filters.provider === 'hybrid') {
      query.password = { $exists: true, $ne: '' };
      query.googleId = { $exists: true, $ne: '' };
    }
    if (filters.verification === 'pending') {
      query.emailVerifiedAt = { $exists: false };
      query.emailVerificationExpiresAt = { $exists: true };
    }
    if (filters.verification === 'verified') {
      query.$nor = [{ emailVerifiedAt: { $exists: false }, emailVerificationExpiresAt: { $exists: true } }];
    }

    const inactiveCutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const activityQuery = this.buildUserActivityQuery(filters.activity, inactiveCutoff);
    if (activityQuery) {
      if (query.$or) {
        query.$and = [{ $or: query.$or }, activityQuery];
        delete query.$or;
      } else {
        Object.assign(query, activityQuery);
      }
    }

    const [items, totalItems, totalUsers, activeUsers, blockedUsers, inactiveUsers, newUsers, admins, pendingVerification] = await Promise.all([
      this.userModel
        .find(query)
        .select('email displayName avatar role isActive createdAt lastLoginAt lastActiveAt suspendedAt suspensionReason password googleId emailVerifiedAt +emailVerificationExpiresAt')
        .sort({ lastActiveAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
      this.userModel.countDocuments({ isDeleted: { $ne: true } }),
      this.userModel.countDocuments({ isDeleted: { $ne: true }, isActive: { $ne: false } }),
      this.userModel.countDocuments({ isDeleted: { $ne: true }, isActive: false }),
      this.userModel.countDocuments({ isDeleted: { $ne: true }, ...(this.buildUserActivityQuery('inactive', inactiveCutoff) || {}) }),
      this.userModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      this.userModel.countDocuments({ isDeleted: { $ne: true }, role: { $in: ['super_admin', 'content_admin', 'moderator', 'support'] }, isActive: { $ne: false } }),
      this.userModel.countDocuments({ isDeleted: { $ne: true }, emailVerifiedAt: { $exists: false }, emailVerificationExpiresAt: { $exists: true } }),
    ]);

    return {
      items: items.map((user: any) => ({
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role || 'member',
        isActive: user.isActive !== false,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        lastActiveAt: user.lastActiveAt,
        suspendedAt: user.suspendedAt,
        suspensionReason: user.suspensionReason,
        authProvider: user.password ? (user.googleId ? 'hybrid' : 'password') : 'google',
        verificationStatus: user.emailVerifiedAt || user.googleId || !user.emailVerificationExpiresAt ? 'verified' : 'pending',
        verificationExpiresAt: user.emailVerificationExpiresAt,
      })),
      pagination: { page, limit, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / limit)) },
      summary: { totalUsers, activeUsers, blockedUsers, inactiveUsers, newUsers, admins, pendingVerification },
      policy: { inactiveAfterDays: 15, pendingVerificationHours: 72, autoDeleteInactiveUsers: false },
    };
  }

  async updateUserRole(adminId: string, userId: string, newRole: string) {
    this.assertValidUserId(userId);
    if (adminId === userId) {
      throw new BadRequestException('Bạn không thể tự thay đổi vai trò của chính mình');
    }

    if (!['member', 'content_admin', 'moderator', 'support'].includes(newRole)) {
      throw new BadRequestException('Vai trò không hợp lệ');
    }
    const actor = await this.requireSuperAdmin(adminId);
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    if (user.role === 'super_admin') {
      throw new ForbiddenException('Không thể thay đổi vai trò của chủ sở hữu Super Admin');
    }
    user.role = newRole;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return { message: 'Cập nhật vai trò thành công', user: { id: user._id, role: user.role }, changedBy: actor.email };
  }

  async updateUserStatus(adminId: string, userId: string, isActive: boolean, reason?: string) {
    this.assertValidUserId(userId);
    if (adminId === userId) {
      throw new BadRequestException('Bạn không thể tự khóa tài khoản của chính mình');
    }

    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('Trạng thái tài khoản không hợp lệ');
    }
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    await this.assertCanManageTarget(adminId, user);
    const normalizedReason = String(reason || '').trim().slice(0, 200);
    user.isActive = isActive;
    user.suspendedAt = isActive ? undefined : new Date();
    user.suspensionReason = isActive ? undefined : normalizedReason || 'Khóa bởi quản trị viên';
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return {
      message: isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
      user: { id: user._id, isActive: user.isActive },
    };
  }

  async deleteUser(adminId: string, userId: string) {
    this.assertValidUserId(userId);
    if (adminId === userId) {
      throw new BadRequestException('Bạn không thể tự xóa tài khoản của chính mình');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    await this.assertCanManageTarget(adminId, user);
    if (user.isActive !== false) {
      throw new BadRequestException('Hãy khóa tài khoản trước khi xóa vĩnh viễn');
    }
    user.email = `deleted-${userId}@deleted.local`;
    user.displayName = 'Tài khoản đã xóa';
    user.password = undefined;
    user.googleId = undefined;
    user.avatar = undefined;
    user.favorites = [];
    user.watchHistory = [];
    user.playlists = [];
    user.upcomingReminders = [];
    user.role = 'member';
    user.isActive = false;
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await Promise.all([
      user.save(),
      this.userNotificationModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec(),
    ]);
    return { message: 'Đã xóa người dùng thành công' };
  }

  private buildUserActivityQuery(activity: string | undefined, cutoff: Date): Record<string, any> | null {
    if (activity === 'recent') {
      return {
        $or: [
          { lastActiveAt: { $gte: cutoff } },
          { lastActiveAt: { $exists: false }, lastLoginAt: { $gte: cutoff } },
          { lastActiveAt: { $exists: false }, lastLoginAt: { $exists: false }, createdAt: { $gte: cutoff } },
        ],
      };
    }
    if (activity === 'inactive') {
      return {
        $or: [
          { lastActiveAt: { $lt: cutoff } },
          { lastActiveAt: { $exists: false }, lastLoginAt: { $lt: cutoff } },
          { lastActiveAt: { $exists: false }, lastLoginAt: { $exists: false }, createdAt: { $lt: cutoff } },
        ],
      };
    }
    if (activity === 'never') {
      return { lastActiveAt: { $exists: false }, lastLoginAt: { $exists: false } };
    }
    return null;
  }

  private assertValidUserId(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('ID người dùng không hợp lệ');
  }

  private async requireSuperAdmin(adminId: string) {
    const actor = await this.userModel.findById(adminId);
    if (!actor || actor.role !== 'super_admin' || actor.isActive === false || actor.isDeleted === true) {
      throw new ForbiddenException('Chỉ Super Admin mới được thay đổi vai trò quản trị');
    }
    return actor;
  }

  private async assertCanManageTarget(adminId: string, target: UserDocument) {
    const actor = await this.userModel.findById(adminId);
    if (!actor || !['super_admin', 'moderator'].includes(actor.role) || actor.isActive === false || actor.isDeleted === true) {
      throw new ForbiddenException('Tài khoản quản trị không hợp lệ');
    }
    if (target.role === 'super_admin') {
      throw new ForbiddenException('Không thể khóa hoặc xóa tài khoản Super Admin');
    }
    if (target.role !== 'member' && actor.role !== 'super_admin') {
      throw new ForbiddenException('Chỉ Super Admin mới được quản lý tài khoản nhân sự');
    }
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
