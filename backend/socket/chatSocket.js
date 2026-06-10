import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Match from "../models/Match.js";
import Message from "../models/Message.js";
import { serializeMessage } from "../utils/serializers.js";

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret-change-me";
const roomForMatch = (matchId) => `match:${matchId}`;

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function findAuthorizedMatch(matchId, userId) {
  if (!isObjectId(matchId)) return null;
  return Match.findOne({ _id: matchId, users: userId });
}

/* ----------------------------
   SAVE MESSAGE
---------------------------- */
async function saveMessage(match, senderId, text) {
  const message = await Message.create({
    match: match._id,
    sender: senderId,
    text,
  });

  await Match.findByIdAndUpdate(match._id, {
    lastMessageText: message.text,
    lastMessageSender: message.sender,
    lastMessageAt: message.createdAt,
  });

  return serializeMessage(message);
}

/* ----------------------------
   UNSEND MESSAGE
---------------------------- */
async function unsendMessage(messageId, userId) {
  if (!isObjectId(messageId)) return null;

  const message = await Message.findById(messageId);
  if (!message) return null;

  if (message.sender.toString() !== userId) {
    throw new Error("Not allowed to unsend this message");
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.text = "";

  await message.save();

  return serializeMessage(message);
}

/* =========================================================
   SOCKET
========================================================= */
export function registerChatSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, getJwtSecret());
      socket.data.userId = decoded.id;

      return next();
    } catch {
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    /* ----------------------------
       JOIN MATCH
    ---------------------------- */
    socket.on("join_match", async ({ matchId }) => {
      try {
        const match = await findAuthorizedMatch(matchId, userId);

        if (!match) {
          socket.emit("chat_error", { message: "Match not found" });
          return;
        }

        socket.join(roomForMatch(matchId));
        socket.data.matchId = matchId;

        socket.emit("joined_match", { matchId });

        // 🔥 IMPORTANT: mark delivered (simple baseline)
        socket.to(roomForMatch(matchId)).emit("message_status", {
          type: "delivered",
          matchId,
          userId,
        });

      } catch (error) {
        socket.emit("chat_error", {
          message: error.message || "Could not join chat",
        });
      }
    });

    /* ----------------------------
       LEAVE MATCH
    ---------------------------- */
    socket.on("leave_match", ({ matchId }) => {
      if (matchId) {
        socket.leave(roomForMatch(matchId));
      }
    });

    /* ----------------------------
       SEND MESSAGE
    ---------------------------- */
    socket.on("send_message", async ({ matchId, text } = {}) => {
      try {
        const trimmed = text?.trim();

        if (!matchId || !trimmed) {
          socket.emit("chat_error", {
            message: "Message text is required",
          });
          return;
        }

        const match = await findAuthorizedMatch(matchId, userId);

        if (!match) {
          socket.emit("chat_error", { message: "Match not found" });
          return;
        }

        const message = await saveMessage(match, userId, trimmed);

        io.to(roomForMatch(matchId)).emit("new_message", message);

        // 🔥 delivered immediately to sender
        socket.emit("message_status", {
          type: "sent",
          messageId: message.id,
          matchId,
        });

      } catch (error) {
        socket.emit("chat_error", {
          message: error.message || "Failed to send message",
        });
      }
    });

    /* ----------------------------
       UNSEND MESSAGE
    ---------------------------- */
    socket.on("unsend_message", async ({ messageId, matchId }) => {
      try {
        const match = await findAuthorizedMatch(matchId, userId);

        if (!match) {
          socket.emit("chat_error", { message: "Match not found" });
          return;
        }

        const updated = await unsendMessage(messageId, userId);

        if (!updated) {
          socket.emit("chat_error", { message: "Message not found" });
          return;
        }

        io.to(roomForMatch(matchId)).emit(
          "message_unsent",
          updated
        );

      } catch (error) {
        socket.emit("chat_error", {
          message: error.message || "Failed to unsend message",
        });
      }
    });

    /* ======================================================
       ⭐ NEW: TYPING INDICATOR (REAL TIME)
    ====================================================== */
    socket.on("typing", ({ matchId, isTyping }) => {
      if (!matchId) return;

      socket.to(roomForMatch(matchId)).emit("typing", {
        matchId,
        userId,
        isTyping,
      });
    });

    /* ======================================================
       ⭐ NEW: READ RECEIPTS (SEEN)
    ====================================================== */
    socket.on("message_seen", ({ matchId }) => {
      if (!matchId) return;

      io.to(roomForMatch(matchId)).emit("message_seen", {
        matchId,
        userId,
        status: "seen",
      });
    });

    /* ----------------------------
       CLEAN EXIT
    ---------------------------- */
    socket.on("disconnect", () => {
      const matchId = socket.data.matchId;

      if (matchId) {
        socket.to(roomForMatch(matchId)).emit("typing", {
          matchId,
          userId,
          isTyping: false,
        });
      }
    });
  });
}