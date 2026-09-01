const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, FRONTEND_URL } = require("./config");

function initSocket(server) {
  const io = new Server(server, {
    cors: {
     origin: FRONTEND_URL,
     methods: ["GET", "POST"],
     credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
     const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
     if (!token) {
       return next(new Error("Authentication error: No token provided"));
     }

     const decoded = jwt.verify(token, JWT_SECRET);
     socket.user = {
       id: decoded.userId,
     };
     next();
    } catch (err) {
     next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userRoom = `user:${socket.user.id}`;
    socket.join(userRoom);

    socket.on("disconnect", () => {
     console.log(`Socket disconnected for user ${socket.user.id}`);
    });
  });

  return io;
}

function emitPaymentReceived(io, receiverId, data) {
  io.to(`user:${receiverId}`).emit("payment_received", data);
}

function emitPaymentRequest(io, targetId, data) {
  io.to(`user:${targetId}`).emit("payment_request", data);
}

function emitRequestAccepted(io, requesterId, data) {
  io.to(`user:${requesterId}`).emit("payment_request_accepted", data);
}

function emitRequestRejected(io, requesterId, data) {
  io.to(`user:${requesterId}`).emit("payment_request_rejected", data);
}

module.exports = {
  initSocket,
  emitPaymentReceived,
  emitPaymentRequest,
  emitRequestAccepted,
  emitRequestRejected,
};
