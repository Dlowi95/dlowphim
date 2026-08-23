import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

function createAuthService() {
  const save = jest.fn().mockResolvedValue(true);
  const userRecord = {
    _id: 'user-id-123',
    email: 'test@taivisao.me',
    displayName: 'Test User',
    avatar: '/images/avatars/default.png',
    gender: 'other',
    role: 'member',
    save,
  };
  const userModel = {
    findById: jest.fn().mockResolvedValue(userRecord),
  };
  const service = new AuthService(
    userModel as any,
    {} as any,
    {} as any,
    { get: jest.fn() } as any,
  );
  return { service, userRecord, save, userModel };
}

describe('AuthService Avatar, Gender and Profile Validation (Correction)', () => {
  let service: AuthService;

  beforeEach(() => {
    service = createAuthService().service;
  });

  describe('Local Avatar Allowlist and Traversal Hardening', () => {
    it('accepts only strictly allowed local avatar paths and vietnam-flag badge', () => {
      expect(service.validateAvatar('/images/avatars/default.png')).toBe('/images/avatars/default.png');
      expect(service.validateAvatar('/images/avatars/hoathinh/1.webp')).toBe('/images/avatars/hoathinh/1.webp');
      expect(service.validateAvatar('/images/avatars/hoathinh/26.webp')).toBe('/images/avatars/hoathinh/26.webp');
      expect(service.validateAvatar('vietnam-flag')).toBe('vietnam-flag');
    });

    it('rejects arbitrary same-origin paths not in avatar allowlist', () => {
      expect(() => service.validateAvatar('/api/users')).toThrow('Đường dẫn ảnh đại diện không nằm trong danh mục cho phép');
      expect(() => service.validateAvatar('/admin/secret.png')).toThrow('Đường dẫn ảnh đại diện không nằm trong danh mục cho phép');
      expect(() => service.validateAvatar('/auth/login')).toThrow('Đường dẫn ảnh đại diện không nằm trong danh mục cho phép');
      expect(() => service.validateAvatar('/images/logo.png')).toThrow('Đường dẫn ảnh đại diện không nằm trong danh mục cho phép');
      expect(() => service.validateAvatar('/images/avatars/hoathinh/999.webp')).toThrow(
        'Đường dẫn ảnh đại diện không nằm trong danh mục cho phép',
      );
    });

    it('rejects path traversal, backslashes, and encoded traversal in local paths', () => {
      expect(() => service.validateAvatar('/images/avatars/../../etc/passwd')).toThrow('Đường dẫn ảnh đại diện không hợp lệ');
      expect(() => service.validateAvatar('/images/avatars/\\..\\secret.png')).toThrow('Đường dẫn ảnh đại diện không hợp lệ');
      expect(() => service.validateAvatar('/images/avatars/%2e%2e/hoathinh/1.webp')).toThrow(
        'Đường dẫn ảnh đại diện không hợp lệ',
      );
      expect(() => service.validateAvatar('/images/avatars/%2fhoathinh%2f1.webp')).toThrow(
        'Đường dẫn ảnh đại diện không hợp lệ',
      );
      expect(() => service.validateAvatar('/images/avatars/%5choathinh%5c1.webp')).toThrow(
        'Đường dẫn ảnh đại diện không hợp lệ',
      );
      expect(() => service.validateAvatar('/images/avatars/hoathinh/1.webp\0.png')).toThrow(
        'Đường dẫn ảnh đại diện không hợp lệ',
      );
    });

    it('rejects dangerous URI schemes (javascript:, vbscript:, file:)', () => {
      expect(() => service.validateAvatar('javascript:alert(1)')).toThrow('Định dạng ảnh đại diện không an toàn');
      expect(() => service.validateAvatar('vbscript:msgbox(1)')).toThrow('Định dạng ảnh đại diện không an toàn');
      expect(() => service.validateAvatar('file:///etc/passwd')).toThrow('Định dạng ảnh đại diện không an toàn');
    });

    it('accepts valid HTTPS remote avatar URLs', () => {
      const googleUrl = 'https://lh3.googleusercontent.com/a/ACg8ocL_123456';
      expect(service.validateAvatar(googleUrl)).toBe(googleUrl);
      expect(service.validateAvatar('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(
        'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      );
    });
  });

  describe('Data URI and Magic Bytes Verification', () => {
    it('accepts genuine PNG, JPEG, GIF, and WebP data URIs with matching magic bytes', () => {
      // Valid 1x1 PNG
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const validPng = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      expect(service.validateAvatar(validPng)).toBe(validPng);

      // Valid JPEG header
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const validJpg = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
      expect(service.validateAvatar(validJpg)).toBe(validJpg);

      // Valid GIF89a header
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
      const validGif = `data:image/gif;base64,${gifBuffer.toString('base64')}`;
      expect(service.validateAvatar(validGif)).toBe(validGif);

      // Valid WebP (RIFF....WEBP)
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      const validWebp = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
      expect(service.validateAvatar(validWebp)).toBe(validWebp);
    });

    it('rejects MIME spoofing (e.g. text or JPEG labeled as image/png)', () => {
      // Plain text labeled as PNG
      const textBuffer = Buffer.from('hello world this is plain text 123456');
      const spoofedPng = `data:image/png;base64,${textBuffer.toString('base64')}`;
      expect(() => service.validateAvatar(spoofedPng)).toThrow('Nội dung ảnh không khớp với định dạng khai báo');

      // JPEG bytes labeled as PNG
      const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const jpegAsPng = `data:image/png;base64,${jpegBytes.toString('base64')}`;
      expect(() => service.validateAvatar(jpegAsPng)).toThrow('Nội dung ảnh không khớp với định dạng khai báo');

      // PNG bytes labeled as JPEG
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const pngAsJpg = `data:image/jpeg;base64,${pngBytes.toString('base64')}`;
      expect(() => service.validateAvatar(pngAsJpg)).toThrow('Nội dung ảnh không khớp với định dạng khai báo');
    });

    it('rejects SVG images labeled as data:image/svg+xml', () => {
      expect(() => service.validateAvatar('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toThrow(
        'Chỉ chấp nhận ảnh tải lên định dạng PNG, JPEG, WebP hoặc GIF',
      );
    });

    it('rejects corrupted base64, invalid base64 padding, and non-canonical base64', () => {
      expect(() => service.validateAvatar('data:image/png;base64,invalid!@#base64&&&')).toThrow(
        'Chỉ chấp nhận ảnh tải lên định dạng PNG, JPEG, WebP hoặc GIF',
      );
      // Non-canonical base64 padding / length not multiple of 4
      expect(() => service.validateAvatar('data:image/png;base64,abcde')).toThrow(
        'Dữ liệu base64 của ảnh không hợp lệ',
      );
    });

    it('rejects empty or truncated image payload (< 12 bytes)', () => {
      const shortBuffer = Buffer.from([0x89, 0x50, 0x4e]);
      const shortData = `data:image/png;base64,${shortBuffer.toString('base64')}`;
      expect(() => service.validateAvatar(shortData)).toThrow('Dữ liệu ảnh đại diện quá ngắn hoặc bị rỗng');
    });

    it('rejects payload exceeding 5MB decoded size limit', () => {
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x89);
      // Set valid PNG header on oversized buffer
      largeBuffer[0] = 0x89;
      largeBuffer[1] = 0x50;
      largeBuffer[2] = 0x4e;
      largeBuffer[3] = 0x47;
      largeBuffer[4] = 0x0d;
      largeBuffer[5] = 0x0a;
      largeBuffer[6] = 0x1a;
      largeBuffer[7] = 0x0a;
      const largeDataUrl = `data:image/png;base64,${largeBuffer.toString('base64')}`;
      expect(() => service.validateAvatar(largeDataUrl)).toThrow('Kích thước ảnh đại diện không được vượt quá 5MB');
    });
  });

  describe('Gender Validation', () => {
    it('accepts valid gender values: male, female, other (case-insensitive & trimmed)', () => {
      expect(service.validateGender('male')).toBe('male');
      expect(service.validateGender('female')).toBe('female');
      expect(service.validateGender('other')).toBe('other');
      expect(service.validateGender('  MALE  ')).toBe('male');
      expect(service.validateGender('Female')).toBe('female');
    });

    it('throws BadRequestException for invalid gender values instead of silent fallback', () => {
      expect(() => service.validateGender('unknown')).toThrow(BadRequestException);
      expect(() => service.validateGender('robot')).toThrow('Giới tính không hợp lệ. Chỉ chấp nhận male, female hoặc other');
      expect(() => service.validateGender('')).toThrow(BadRequestException);
      expect(() => service.validateGender(123)).toThrow(BadRequestException);
      expect(() => service.validateGender(null)).toThrow(BadRequestException);
    });

    it('updates profile with valid gender and rejects invalid gender on updateProfile', async () => {
      const { service: authSvc, userRecord, save } = createAuthService();
      const updated = await authSvc.updateProfile('user-id-123', { gender: 'female' });
      expect(save).toHaveBeenCalled();
      expect(updated.gender).toBe('female');

      await expect(authSvc.updateProfile('user-id-123', { gender: 'alien' as any })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('DisplayName Validation', () => {
    it('validates displayName length between 2 and 80 characters', () => {
      expect(service.validateDisplayName('  John Doe  ')).toBe('John Doe');
      expect(() => service.validateDisplayName('A')).toThrow('Tên hiển thị cần từ 2 đến 80 ký tự');
      expect(() => service.validateDisplayName('A'.repeat(85))).toThrow('Tên hiển thị cần từ 2 đến 80 ký tự');
      expect(() => service.validateDisplayName(123 as any)).toThrow('Tên hiển thị không hợp lệ');
    });
  });
});
