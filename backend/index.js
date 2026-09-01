const express = require("express");
const cors = require("cors");
const http = require("http");
const morgan = require("morgan");
require("express-async-errors");
const { connectDatabase } = require("./db/db");
const config = require("./config");
const mainRouter = require("./routes/index");
const transactionsRouter = require("./routes/transactions");
const requestsRouter = require("./routes/requests");
const { securityHeaders, generalLimiter, authLimiter, transferLimiter, requestLimiter, otpLimiter } = require("./security");
const { initSocket } = require("./socket");

const app = express();
const port = config.PORT;
const server = http.createServer(app);
const allowedOrigins = (config.FRONTEND_URL || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);

async function startServer() {
  try {
    await connectDatabase();
    const io = initSocket(server);
    app.set("io", io);

    app.use(securityHeaders());
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }));

    app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev"));
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ limit: "1mb", extended: true }));

    app.use("/api", generalLimiter);
    app.use("/api/v1/user", authLimiter);
    app.use("/api/v1/otp", otpLimiter);
    app.use("/api/v1/transactions/transfer", transferLimiter);
    app.use("/api/v1/requests", requestLimiter);

    app.use("/api/v1", mainRouter);
    app.use("/api/v1/transactions", transactionsRouter);
    app.use("/api/v1/requests", requestsRouter);

    app.get("/health", (req, res) => {
      res.status(200).json({ success: true, status: "ok", timestamp: new Date().toISOString() });
    });

    app.use((req, res) => {
      res.status(404).json({ success: false, error: "Endpoint not found" });
    });

    app.use((err, req, res, next) => {
      if (err && err.status === 429) {
        return res.status(429).json({ success: false, error: err.message || "Too many requests" });
      }
      console.error("Unhandled error:", err);
      res.status(err && err.status ? err.status : 500).json({
        success: false,
        error: err && err.message ? "Request failed" : "Internal server error",
      });
    });

    server.listen(port, () => {
      console.log(`SwiftPay server running on port ${port}`);
      console.log(`Environment: ${config.NODE_ENV}`);
    });

    const shutdown = async () => {
      console.log("Shutting down gracefully...");
      server.close(() => {
        setTimeout(() => process.exit(0), 250);
      });
      if (io) {
        io.close();
      }
      await (await import("mongoose")).default.connection.close();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
