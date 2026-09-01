const mongoose = require("mongoose");

/**
 * PaymentRequest Model - Track payment requests between users
 * Workflow: pending -> accepted/rejected
 * When accepted, automatically performs transfer and creates Transaction entry
 */
const PaymentRequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
    description: "User requesting the payment"
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
    description: "User being asked to pay"
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
    description: "Amount requested"
  },
  note: {
    type: String,
    maxlength: 500,
    description: "Optional note/reason for request"
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "cancelled"],
    default: "pending",
    required: true,
    index: true,
    description: "Request status"
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    description: "Reference to Transaction if accepted"
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  respondedAt: {
    type: Date,
    description: "When request was accepted/rejected"
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient querying
PaymentRequestSchema.index({ requester: 1, createdAt: -1 });
PaymentRequestSchema.index({ target: 1, status: 1, createdAt: -1 });

// Pre-save middleware
PaymentRequestSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  if (this.status !== "pending" && !this.respondedAt) {
    this.respondedAt = Date.now();
  }
  next();
});

const PaymentRequest = mongoose.model("PaymentRequest", PaymentRequestSchema);

module.exports = PaymentRequest;
