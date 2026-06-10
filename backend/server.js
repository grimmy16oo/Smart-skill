import http from "http";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import matchRoutes from "./routes/matches.js";
import messageRoutes from "./routes/messages.js";
import uploadRoutes from "./routes/uploads.js";
import userRoutes from "./routes/users.js";
import { registerChatSocket } from "./socket/chatSocket.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const allowedOrigins = [CLIENT_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
registerChatSocket(io);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    socket: true,
    mongo:
      mongoose.connection.readyState === 1
        ? "connected"
        : process.env.MONGODB_URI
          ? "connecting"
          : "not_configured",
  });
});

app.use("/api", (req, res, next) => {
  if (!process.env.MONGODB_URI) {
    return res.status(503).json({
      message: "MongoDB is not configured. Add MONGODB_URI to backend/.env.",
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "MongoDB is not connected yet." });
  }

  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/uploads", uploadRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  void next;
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

connectDB()
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`);
  })
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`API + Socket.IO running on http://localhost:${PORT}`);
      console.log(`CORS origin: ${CLIENT_ORIGIN}`);
      if (!process.env.JWT_SECRET) {
        console.warn("JWT_SECRET is not set. Using a development fallback secret.");
      }
    });
  });
