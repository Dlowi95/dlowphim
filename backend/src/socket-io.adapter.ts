import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

export function normalizeOrigin(origin: string) {
  return String(origin || '').trim().replace(/\/$/, '');
}

export function getAllowedBrowserOrigins() {
  const localOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];
  const productionOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  return new Set([...localOrigins, ...productionOrigins]);
}

export function isAllowedBrowserOrigin(
  origin: string | undefined,
  allowedOrigins: Set<string>,
) {
  return !origin || allowedOrigins.has(normalizeOrigin(origin));
}

/** Applies one production CORS policy to every Socket.IO namespace. */
export class AppSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: Set<string>,
  ) {
    super(app);
  }

  createIOServer(port: number, options: Record<string, any> = {}) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        ...(options.cors || {}),
        origin: (
          origin: string | undefined,
          callback: (error: Error | null, allowed?: boolean) => void,
        ) => {
          if (isAllowedBrowserOrigin(origin, this.allowedOrigins)) {
            callback(null, true);
            return;
          }
          callback(
            new Error(`Origin ${origin} is not allowed by Socket.IO CORS`),
            false,
          );
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
    });
  }
}
