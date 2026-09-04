import { BadRequestException, HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';

function createService(config: Record<string, string>) {
  return new AuthService(
    {} as any,
    {} as any,
    {} as any,
    { get: jest.fn((key: string) => config[key]) } as any,
  );
}

describe('AuthService Turnstile verification', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('accepts a valid token only for the expected action and hostname', async () => {
    const service = createService({
      TURNSTILE_SECRET_KEY: 'test-secret',
      TURNSTILE_ALLOWED_HOSTNAMES: 'taivisao.me,www.taivisao.me',
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action: 'login', hostname: 'taivisao.me' }),
    }) as any;

    await expect((service as any).verifyTurnstile('valid-token', 'login')).resolves.toBeUndefined();
    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(String(request[1].body)).toContain('secret=test-secret');
    expect(String(request[1].body)).toContain('response=valid-token');
  });

  it.each([
    [{ success: false, action: 'login', hostname: 'taivisao.me' }, 'failed challenge'],
    [{ success: true, action: 'register', hostname: 'taivisao.me' }, 'wrong action'],
    [{ success: true, action: 'login', hostname: 'evil.example' }, 'wrong hostname'],
  ])('rejects %s (%s)', async (payload) => {
    const service = createService({
      TURNSTILE_SECRET_KEY: 'test-secret',
      TURNSTILE_ALLOWED_HOSTNAMES: 'taivisao.me,www.taivisao.me',
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payload }) as any;

    await expect((service as any).verifyTurnstile('token', 'login')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed when the backend secret is absent', async () => {
    const service = createService({});
    await expect((service as any).verifyTurnstile('token', 'login')).rejects.toBeInstanceOf(HttpException);
    expect(global.fetch).toBe(originalFetch);
  });
});
