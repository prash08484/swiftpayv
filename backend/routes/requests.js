const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const router = express.Router();
const auth = require("../middlewares/middleware");
const PaymentRequest = require("../models/paymentRequest");
const Transaction = require("../models/transaction");
const { Account, User } = require("../db/db");

/**
 * Validation schemas
 */
const createRequestSchema = z.object({
  targetId: z.string().min(1, "Target user ID required"),
  amount: z.number().positive("Amount must be positive"),
  note: z.string().max(500, "Note too long").optional()
});

const updateRequestSchema = z.object({
  status: z.enum(["accepted", "rejected", "cancelled"])
});

/**
 * POST /api/v1/requests
 * Create a new payment request
 */
router.post("/", auth, async (req, res) => {
  try {
    // Validate input
    const validation = createRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: validation.error.errors
      });
    }

    const { targetId, amount, note } = validation.data;
    const requesterId = req.user.id;

    // Prevent requesting from self
    if (requesterId === targetId) {
      return res.status(400).json({
        success: false,
        error: "Cannot request payment from yourself"
      });
    }

    // Verify target user exists
    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "Target user not found"
      });
    }

    // Create payment request
    const paymentRequest = new PaymentRequest({
      requester: requesterId,
      target: targetId,
      amount,
      note,
      status: "pending"
    });

    await paymentRequest.save();

    // Populate and prepare response
    await paymentRequest.populate({
      path: "requester",
      select: "username firstName lastName"
    });

    // Emit socket event to target user
    const io = req.app.get("io");
    if (io) {
      const requester = await User.findById(requesterId);
      io.to(`user:${targetId}`).emit("payment_request", {
        requestId: paymentRequest._id,
        requesterId: paymentRequest.requester._id,
        requesterName: `${requester.firstName} ${requester.lastName}`,
        amount: paymentRequest.amount,
        note: paymentRequest.note,
        createdAt: paymentRequest.createdAt
      });
    }

    res.status(201).json({
      success: true,
      message: "Payment request created successfully",
      data: paymentRequest
    });
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create payment request",
      message: error.message
    });
  }
});

/**
 * GET /api/v1/requests
 * Get all payment requests for authenticated user (incoming + outgoing)
 */
router.get("/", auth, async (req, res) => {
  try {
    const { status, type = "all", limit = 20, page = 1 } = req.query;

    let query = {};

    // Filter by type
    if (type === "incoming" || type === "all") {
      query.$or = query.$or || [];
      let incomingQuery = { target: req.user.id };
      if (status) incomingQuery.status = status;
      query.$or.push(incomingQuery);
    }

    if (type === "outgoing" || type === "all") {
      query.$or = query.$or || [];
      let outgoingQuery = { requester: req.user.id };
      if (status) outgoingQuery.status = status;
      query.$or.push(outgoingQuery);
    }

    if (type !== "all") {
      query = type === "incoming" ? { target: req.user.id } : { requester: req.user.id };
      if (status) query.status = status;
    }

    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * Math.min(parseInt(limit) || 20, 100);

    const requests = await PaymentRequest.find(query)
      .populate("requester", "username firstName lastName")
      .populate("target", "username firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(parseInt(limit) || 20, 100));

    const total = await PaymentRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        requests,
        total,
        pages: Math.ceil(total / (Math.min(parseInt(limit) || 20, 100))),
        currentPage: Math.max(parseInt(page) || 1, 1)
      }
    });
  } catch (error) {
    console.error("Get requests error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch payment requests",
      message: error.message
    });
  }
});

/**
 * GET /api/v1/requests/:id
 * Get specific payment request details
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id)
      .populate("requester", "username firstName lastName")
      .populate("target", "username firstName lastName")
      .populate("transactionId");

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        error: "Payment request not found"
      });
    }

    // Verify user has access to this request
    if (
      paymentRequest.requester._id.toString() !== req.user.id &&
      paymentRequest.target._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized"
      });
    }

    res.status(200).json({
      success: true,
      data: paymentRequest
    });
  } catch (error) {
    console.error("Get request error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch payment request",
      message: error.message
    });
  }
});

/**
 * POST /api/v1/requests/:id/accept
 * Accept a payment request and perform the transfer
 */
router.post("/:id/accept", auth, async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id);

    if (!paymentRequest) {
      return res.status(404).json({ success: false, error: "Payment request not found" });
    }

    if (paymentRequest.target.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Unauthorized - only target user can accept" });
    }

    if (paymentRequest.status !== "pending") {
      return res.status(400).json({ success: false, error: `Request already ${paymentRequest.status}` });
    }

    const [fromAccount, toAccount] = await Promise.all([
      Account.findOne({ userId: paymentRequest.target }),
      Account.findOne({ userId: paymentRequest.requester }),
    ]);

    if (!fromAccount || !toAccount) {
      return res.status(400).json({ success: false, error: "Account not found" });
    }

    if (fromAccount.balance < paymentRequest.amount) {
      return res.status(400).json({ success: false, error: "insufficient_funds" });
    }

    fromAccount.balance -= paymentRequest.amount;
    toAccount.balance += paymentRequest.amount;
    await fromAccount.save();
    await toAccount.save();

    const tx = await Transaction.create({
      type: "transfer",
      amount: paymentRequest.amount,
      sender: paymentRequest.target,
      receiver: paymentRequest.requester,
      status: "success",
      description: paymentRequest.note || "Payment request accepted",
      relatedRequestId: paymentRequest._id,
      currency: "INR",
      meta: { requestId: paymentRequest._id.toString(), note: paymentRequest.note || "Payment request accepted" },
    });

    paymentRequest.status = "accepted";
    paymentRequest.respondedAt = new Date();
    paymentRequest.transactionId = tx._id;
    await paymentRequest.save();

    const populatedRequest = await PaymentRequest.findById(req.params.id)
      .populate("requester", "username firstName lastName")
      .populate("target", "username firstName lastName");

    const io = req.app.get("io");
    if (io) {
      const acceptor = await User.findById(paymentRequest.target);
      io.to(`user:${paymentRequest.requester}`).emit("payment_request_accepted", {
        requestId: paymentRequest._id,
        amount: paymentRequest.amount,
        acceptedBy: `${acceptor.firstName} ${acceptor.lastName}`,
        transactionId: tx._id,
        timestamp: new Date(),
      });
      io.to(`user:${paymentRequest.target}`).emit("payment_completed", {
        requestId: paymentRequest._id,
        amount: paymentRequest.amount,
        status: "accepted",
        transactionId: tx._id,
        timestamp: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment request accepted and transfer completed",
      data: { request: populatedRequest, transaction: { id: tx._id, amount: tx.amount, sender: tx.sender, receiver: tx.receiver, status: tx.status, createdAt: tx.createdAt } },
    });
  } catch (error) {
    console.error("Accept request error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to accept payment request" });
  }
});

/**
 * POST /api/v1/requests/:id/reject
 * Reject a payment request
 */
router.post("/:id/reject", auth, async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id);

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        error: "Payment request not found"
      });
    }

    // Verify only target user can reject
    if (paymentRequest.target.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - only target user can reject"
      });
    }

    // Check if already responded
    if (paymentRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Request already ${paymentRequest.status}`
      });
    }

    // Update request status
    paymentRequest.status = "rejected";
    paymentRequest.respondedAt = new Date();
    await paymentRequest.save();

    await paymentRequest.populate({
      path: "requester",
      select: "username firstName lastName"
    });

    // Emit socket event to requester
    const io = req.app.get("io");
    if (io) {
      const rejector = await User.findById(paymentRequest.target);

      io.to(`user:${paymentRequest.requester}`).emit("payment_request_rejected", {
        requestId: paymentRequest._id,
        amount: paymentRequest.amount,
        rejectedBy: `${rejector.firstName} ${rejector.lastName}`,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment request rejected",
      data: paymentRequest
    });
  } catch (error) {
    console.error("Reject request error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject payment request",
      message: error.message
    });
  }
});

module.exports = router;
