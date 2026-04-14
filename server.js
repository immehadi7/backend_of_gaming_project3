import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";

import { setIO } from "./socket.js";
import { handleAIResponse } from "./services/aiService.js";

dotenv.config();

// ── Connect MongoDB ──────────────────────────────────────────────────────────
connectDB();

const app = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      process.env.CLIENT_URL,
    ].filter(Boolean),
    credentials: true,
  },
});

setIO(io);

io.on("connection", (socket) => {
  console.log("⚡ Socket connected:", socket.id);

  socket.on("user_message", async (data) => {
    try {
      const { message } = data;
      socket.emit("ai_typing");
      const reply = await handleAIResponse(message);
      socket.emit("ai_reply", { message: reply, timestamp: new Date() });
    } catch (error) {
      console.error("AI error:", error);
      socket.emit("ai_reply", { message: "⚠️ 系统繁忙，请稍后再试" });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.startsWith("http://localhost")) return callback(null, true);
      if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL)
        return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("凌速平台 API running ✅"));

app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/employee", employeeRoutes);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
