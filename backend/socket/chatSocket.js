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

export function registerChatSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, getJwtSecret());
      socket.data.userId = decoded.id;
      return next();
    } catch {
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_match", async ({ matchId }) => {
      try {
        const match = await findAuthorizedMatch(matchId, socket.data.userId);

        if (!match) {
          socket.emit("chat_error", { message: "Match not found" });
          return;
        }

        socket.join(roomForMatch(matchId));
        socket.data.matchId = matchId;
        socket.emit("joined_match", { matchId });
      } catch (error) {
        socket.emit("chat_error", { message: error.message || "Could not join chat" });
      }
    });

    socket.on("leave_match", ({ matchId }) => {
      if (matchId) {
        socket.leave(roomForMatch(matchId));
      }
    });

    socket.on("send_message", async ({ matchId, text } = {}) => {
      try {
        const trimmed = text?.trim();

        if (!matchId || !trimmed) {
          socket.emit("chat_error", { message: "Message text is required" });
          return;
        }

        const match = await findAuthorizedMatch(matchId, socket.data.userId);

        if (!match) {
          socket.emit("chat_error", { message: "Match not found" });
          return;
        }

        const message = await saveMessage(match, socket.data.userId, trimmed);
        io.to(roomForMatch(matchId)).emit("new_message", message);
      } catch (error) {
        socket.emit("chat_error", { message: error.message || "Failed to send message" });
      }
    });
  });
}
