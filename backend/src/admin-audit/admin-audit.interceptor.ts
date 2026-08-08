import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Types } from 'mongoose';
import { AdminAuditService } from './admin-audit.service';

const SENSITIVE_KEYS = new Set(['password', 'token', 'pin', 'tmdbApiKey', 'authorization', 'secret']);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key) ? '[redacted]' : sanitize(item, depth + 1),
    ]));
  }
  return typeof value === 'string' ? value.slice(0, 500) : value;
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const actor = request.adminUser;
    const method = String(request.method || '').toUpperCase();
    if (!actor || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const path = String(request.originalUrl || request.url || '').split('?')[0];
    const base = {
      actorId: new Types.ObjectId(actor.id),
      actorEmail: actor.email,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: `${method} ${path}`,
      method,
      path,
      context: sanitize({ params: request.params, query: request.query, body: request.body }) as Record<string, unknown>,
      ip: String(request.ip || request.socket?.remoteAddress || '').slice(0, 100),
      userAgent: String(request.headers?.['user-agent'] || '').slice(0, 300),
    };

    return next.handle().pipe(
      tap(() => void this.auditService.record({ ...base, status: 'success', statusCode: context.switchToHttp().getResponse().statusCode })),
      catchError((error) => {
        void this.auditService.record({
          ...base,
          status: 'failed',
          statusCode: Number(error?.status || error?.statusCode || 500),
          errorMessage: String(error?.message || 'Unknown admin action error').slice(0, 500),
        });
        return throwError(() => error);
      }),
    );
  }
}
