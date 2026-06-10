import { io } from "socket.io-client";
import { getToken } from "./api";

// undefined = same origin (uses Vite proxy to :5000 in dev)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: {
        token: getToken(),
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: getToken() };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function joinMatchRoom(matchId, uid) {
  const s = connectSocket();
  s.emit("join_match", { matchId, uid });
  return s;
}

export function leaveMatchRoom(matchId) {
  if (!socket) return;
  socket.emit("leave_match", { matchId });
}

export function emitChatMessage(payload) {
  const s = connectSocket();
  s.emit("send_message", payload);
}

export function onNewMessage(handler) {
  const s = getSocket();
  s.on("new_message", handler);
  return () => s.off("new_message", handler);
}

export function onChatError(handler) {
  const s = getSocket();
  s.on("chat_error", handler);
  return () => s.off("chat_error", handler);
}

export function onSocketConnect(handler) {
  const s = getSocket();
  s.on("connect", handler);
  return () => s.off("connect", handler);
}

export function getSocketConnectionStatus() {
  return socket?.connected ?? false;
}
