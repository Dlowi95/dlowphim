import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { normalizeAdminRole } from '../auth/admin-permissions';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const rawToken = String(
        client.handshake.auth?.token ||
          client.handshake.headers.authorization ||
          '',
      );
      const token = rawToken.replace(/^Bearer\s+/i, '');
      if (!token) throw new Error('Missing token');

      const payload = await this.jwtService.verifyAsync(token);
      const sessionUser = await this.authService.getValidSessionUser(
        payload.sub,
        payload.tokenVersion,
      );
      if (!sessionUser) throw new Error('Invalid session');

      client.data.userId = String(payload.sub);
      await client.join(this.userRoom(payload.sub));
      await client.join('notifications:users');
      if (normalizeAdminRole(sessionUser.role)) await client.join('notifications:admins');
      client.emit('notifications:ready');
    } catch {
      client.emit('notifications:error', {
        message: 'Phiên thông báo không hợp lệ',
      });
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  emitToAdmins(event: string, payload: unknown) {
    this.server?.to('notifications:admins').emit(event, payload);
  }

  emitToAllUsers(event: string, payload: unknown) {
    this.server?.to('notifications:users').emit(event, payload);
  }

  isReady() {
    return Boolean(this.server);
  }

  getConnectedClients() {
    return this.server?.sockets?.size || 0;
  }

  private userRoom(userId: string) {
    return `notifications:user:${String(userId)}`;
  }
}
