const mongoose = require("mongoose");

/**
 * Transaction Model - Immutable ledger of all financial transactions
 * Tracks all money movements (transfer, refund, request_payment, request_accept)
 */
const TransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["transfer", "refund", "request_payment", "request_accept"],
    required: true,
    description: "Type of transaction"
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    description: "Amount transferred"
  },
  currency: {
    type: String,
    default: "INR",
    description: "Currency of transaction"
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    description: "User sending money (nullable for system credits)"
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    description: "User receiving money (nullable for system debits)"
  },
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "success",
    required: true,
    description: "Transaction status"
  },
  description: {
    type: String,
    maxlength: 500,
    description: "Optional description/note for transaction"
  },
  relatedRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PaymentRequest",
    description: "Reference to PaymentRequest if applicable"
  },
  meta: {
    type: Object,
    description: "Extra metadata (requestId, note, etc)"
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient querying
TransactionSchema.index({ sender: 1, createdAt: -1 });
TransactionSchema.index({ receiver: 1, createdAt: -1 });
TransactionSchema.index({ status: 1, createdAt: -1 });

// Virtual for full transaction details
TransactionSchema.virtual("fullDetails").get(function() {
  return {
    id: this._id,
    type: this.type,
    amount: this.amount,
    sender: this.sender,
    receiver: this.receiver,
    status: this.status,
    createdAt: this.createdAt
  };
});

const Transaction = mongoose.model("Transaction", TransactionSchema);

module.exports = Transaction;
