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
import calendarRoutes from "./routes/googleCalendar.js";
import matchRoutes from "./routes/matches.js";
import messageRoutes from "./routes/messages.js";
import sessionRoutes from "./routes/sessions.js";
import swapRequestRoutes from "./routes/swapRequests.js";
import uploadRoutes from "./routes/uploads.js";
import userRoutes from "./routes/users.js";
import profileRoutes from "./routes/mongoRoutes.js";

import { registerChatSocket } from "./socket/chatSocket.js";

dotenv.config();

// ---------------- APP INIT ----------------
const app = express();
const server = http.createServer(app);

// ---------------- PATHS ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- ENV ----------------
const PORT = process.env.PORT || 5000;

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";

const allowedOrigins = (process.env.CLIENT_ORIGINS || CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins =
  process.env.NODE_ENV === "production"
    ? allowedOrigins
    : allowedOrigins;

function isLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === "production" || !origin) return false;

  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin) {
  return !origin || corsOrigins.includes(origin) || isLocalDevOrigin(origin);
}

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

// ---------------- CORS (MUST BE FIRST MIDDLEWARE) ----------------
app.use(
  cors({
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// IMPORTANT: handle preflight
app.options(
  "*",
  cors({
    origin: function (origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  })
);

// ---------------- BASIC MIDDLEWARE ----------------
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------- HEALTH CHECK ----------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    socket: true,
    mongo:
      mongoose.connection.readyState === 1 ? "connected" : "not connected",
  });
});

// ---------------- ROUTES ----------------
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/users", userRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/swap-requests", swapRequestRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api", profileRoutes); // IMPORTANT: must come after /api/* routes

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

app.set("io", io);
registerChatSocket(io);

// ---------------- 404 HANDLER ----------------
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ---------------- ERROR HANDLER ----------------
app.use((err, req, res, _next) => {
  void _next;
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

// ---------------- DB + SERVER START ----------------
connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  })
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);

      if (!process.env.JWT_SECRET) {
        console.warn("JWT_SECRET missing (dev mode fallback active)");
      }
    });
  });
