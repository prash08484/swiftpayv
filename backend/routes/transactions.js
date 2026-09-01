const express = require("express");
const { z } = require("zod");
const router = express.Router();
const auth = require("../middlewares/middleware");
const {
  transfer,
  getTransactions,
  getTransactionStats,
  getMonthlyStats
} = require("../services/transferService");
const { User, Account } = require("../db/db");
const Transaction = require("../models/transaction");

/**
 * Validation schemas
 */
const transferSchema = z.object({
 toUserId: z.string().min(1, "Recipient ID required"),
 amount: z.coerce.number().finite().positive("Amount must be positive"),
 note: z.string().max(500, "Note too long").optional(),
});

/**
 * POST /api/v1/transactions/transfer
 * Transfer money from authenticated user to another user
 * Emits socket event to receiver
 */
router.post("/transfer", auth, async (req, res) => {
  try {
    // Validate input
    const validation = transferSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: validation.error.errors
      });
    }

    const { toUserId, amount, note } = validation.data;
    const fromUserId = req.user.id;

    // Prevent self-transfer
    if (fromUserId === toUserId) {
      return res.status(400).json({
        success: false,
        error: "Cannot transfer to yourself"
      });
    }

    // Verify recipient exists
    const recipient = await User.findById(toUserId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: "Recipient not found"
      });
    }

    // Perform atomic transfer
    const result = await transfer({
      fromId: fromUserId,
      toId: toUserId,
      amount,
      meta: { note }
    });

    if (!result.ok) {
      const statusCode = result.reason === "insufficient_funds" ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.reason
      });
    }

    // Emit socket event to receiver (if connected)
    const io = req.app.get("io");
    if (io) {
      const sender = await User.findById(fromUserId);
      io.to(`user:${toUserId}`).emit("payment_received", {
        transactionId: result.transaction.id,
        amount: result.transaction.amount,
        senderId: result.transaction.sender,
        senderName: `${sender.firstName} ${sender.lastName}`,
        createdAt: result.transaction.createdAt,
        description: note || "Transfer"
      });
    }

    res.status(200).json({
      success: true,
      message: "Transfer successful",
      transaction: result.transaction
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({
      success: false,
      error: "Transfer failed",
      message: error.message
    });
  }
});

/**
 * GET /api/v1/transactions
 * Get paginated transactions for authenticated user
 */
router.get("/", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;

    const result = await getTransactions({
      userId: req.user.id,
      limit: Math.min(parseInt(limit) || 20, 100),
      page: Math.max(parseInt(page) || 1, 1)
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch transactions",
      message: error.message
    });
  }
});

/**
 * GET /api/v1/transactions/stats
 * Get transaction statistics for authenticated user
 */
router.get("/stats", auth, async (req, res) => {
  try {
    const stats = await getTransactionStats(req.user.id);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
      message: error.message
    });
  }
});

/**
 * GET /api/v1/transactions/monthly
 * Get monthly transaction breakdown for authenticated user
 */
router.get("/monthly", auth, async (req, res) => {
  try {
    const { months = 6 } = req.query;

    const monthlyData = await getMonthlyStats(req.user.id, Math.min(parseInt(months) || 6, 24));

    res.status(200).json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    console.error("Get monthly stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly data",
      message: error.message
    });
  }
});

/**
 * GET /api/v1/transactions/:id
 * Get specific transaction details
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("sender", "username firstName lastName")
      .populate("receiver", "username firstName lastName");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found"
      });
    }

    const currentUserId = String(req.user.id ?? req.user.userId ?? "");
    const senderId = String(transaction.sender?._id ?? transaction.sender);
    const receiverId = String(transaction.receiver?._id ?? transaction.receiver);

    if (senderId !== currentUserId && receiverId !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized"
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch transaction",
      message: error.message
    });
  }
});

module.exports = router;
