import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const COMMENT_ROOM_PREFIX = 'comments:';

@WebSocketGateway({
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
export class CommentsGateway {
  @WebSocketServer()
  private server: Server;

  @SubscribeMessage('watch_comments')
  async watchComments(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { movieSlug?: string },
  ) {
    const movieSlug = this.normalizeSlug(payload?.movieSlug);
    if (!movieSlug) return { success: false };

    for (const room of client.rooms) {
      if (room.startsWith(COMMENT_ROOM_PREFIX)) {
        await client.leave(room);
      }
    }
    await client.join(this.getRoom(movieSlug));
    return { success: true, movieSlug };
  }

  notifyChanged(movieSlug: string) {
    const normalizedSlug = this.normalizeSlug(movieSlug);
    if (!normalizedSlug || !this.server) return;
    this.server.to(this.getRoom(normalizedSlug)).emit('comments_changed', {
      movieSlug: normalizedSlug,
    });
  }

  private getRoom(movieSlug: string) {
    return `${COMMENT_ROOM_PREFIX}${movieSlug}`;
  }

  private normalizeSlug(movieSlug?: string) {
    const normalized = String(movieSlug || '').trim().toLowerCase();
    return /^[a-z0-9-]{1,180}$/.test(normalized) ? normalized : '';
  }
}
