import type { ManagerOptions, SocketOptions } from "socket.io-client";

/**
 * Render Free can take tens of seconds to wake. WebSocket-first avoids
 * depending on a temporary cross-origin polling response, while polling
 * remains available for networks that block WebSockets.
 */
export function getResilientSocketOptions(): Partial<
  ManagerOptions & SocketOptions
> {
  return {
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 750,
    reconnectionDelayMax: 5000,
    timeout: 60000,
  };
}
