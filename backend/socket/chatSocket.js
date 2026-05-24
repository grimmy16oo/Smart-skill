/**
 * Socket.IO chat - real-time message relay per match room.
 * Rooms: match:{matchId}
 * Persistence: REST API writes to MongoDB; sockets broadcast saved messages instantly.
 */

export function registerChatSocket(io) {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join_match", ({ matchId, uid }) => {
      if (!matchId || !uid) {
        socket.emit("chat_error", { message: "matchId and uid are required" });
        return;
      }

      const room = `match:${matchId}`;
      socket.join(room);
      socket.data.uid = uid;
      socket.data.matchId = matchId;

      socket.emit("joined_match", { matchId });
    });

    socket.on("leave_match", ({ matchId }) => {
      if (matchId) {
        socket.leave(`match:${matchId}`);
      }
    });

    socket.on("send_message", (payload) => {
      const { matchId, senderId, text, id, timestamp } = payload || {};

      if (!matchId || !senderId || !text?.trim()) {
        socket.emit("chat_error", { message: "Invalid message payload" });
        return;
      }

      const message = {
        id: id || `socket_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        matchId,
        senderId,
        text: text.trim(),
        timestamp: timestamp || new Date().toISOString(),
      };

      io.to(`match:${matchId}`).emit("new_message", message);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
