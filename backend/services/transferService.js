const mongoose = require("mongoose");
const { User, Account } = require("../db/db");
const Transaction = require("../models/transaction");

/**
 * Atomic transfer service using MongoDB sessions
 * Ensures data consistency: balance updates and ledger creation happen together
 */

/**
 * Core transfer logic with atomic operations
 * @param {string} fromId - Sender user ID
 * @param {string} toId - Receiver user ID  
 * @param {number} amount - Amount to transfer
 * @param {object} meta - Additional metadata (note, requestId)
 * @returns {Promise<{ok: boolean, reason?: string, transaction?: object}>}
 */
async function canUseTransactions() {
  try {
   const status = await mongoose.connection.db.admin().serverStatus();
   return Boolean(status?.repl && status.repl.setName);
  } catch (error) {
   return false;
  }
}

let transferQueue = Promise.resolve();

function queueTransferOperation(operation) {
  const run = () => operation();
  const previous = transferQueue;
  transferQueue = previous.then(run, run);
  return transferQueue;
}

async function transfer({ fromId, toId, amount, meta = {} }) {
  if (!fromId || !toId || !mongoose.Types.ObjectId.isValid(fromId) || !mongoose.Types.ObjectId.isValid(toId)) {
   return { ok: false, reason: "invalid_user_ids" };
  }

  if (fromId === toId) {
   return { ok: false, reason: "cannot_transfer_to_self" };
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000000) {
   return { ok: false, reason: "invalid_amount" };
  }

  const supportsTxn = await canUseTransactions();

  if (!supportsTxn) {
   return queueTransferOperation(async () => {
     const [fromAcct, toAcct] = await Promise.all([
       Account.findOne({ userId: fromId }),
       Account.findOne({ userId: toId }),
     ]);

     if (!fromAcct || !toAcct) {
       return { ok: false, reason: "account_not_found" };
     }

     if (fromAcct.balance < numericAmount) {
       return { ok: false, reason: "insufficient_funds" };
     }

     fromAcct.balance -= numericAmount;
     toAcct.balance += numericAmount;

     await fromAcct.save();
     await toAcct.save();

     const relatedRequestId = meta.requestId && mongoose.Types.ObjectId.isValid(meta.requestId) ? meta.requestId : undefined;
     const tx = await Transaction.create({
       type: "transfer",
       amount: numericAmount,
       sender: fromId,
       receiver: toId,
       status: "success",
       description: meta.note || "Transfer",
       currency: "INR",
       relatedRequestId,
       meta,
     });

     return {
       ok: true,
       transaction: {
         id: tx._id,
         type: tx.type,
         amount: tx.amount,
         sender: tx.sender,
         receiver: tx.receiver,
         status: tx.status,
         createdAt: tx.createdAt,
       },
     };
   });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
   const [fromAcct, toAcct] = await Promise.all([
     Account.findOne({ userId: fromId }).session(session),
     Account.findOne({ userId: toId }).session(session),
   ]);

   if (!fromAcct || !toAcct) {
     await session.abortTransaction();
     session.endSession();
     return { ok: false, reason: "account_not_found" };
   }

   if (fromAcct.balance < numericAmount) {
     await session.abortTransaction();
     session.endSession();
     return { ok: false, reason: "insufficient_funds" };
   }

   fromAcct.balance -= numericAmount;
   toAcct.balance += numericAmount;

   await fromAcct.save({ session });
   await toAcct.save({ session });

   const relatedRequestId = meta.requestId && mongoose.Types.ObjectId.isValid(meta.requestId) ? meta.requestId : undefined;

   const tx = await Transaction.create(
     [{
       type: "transfer",
       amount: numericAmount,
       sender: fromId,
       receiver: toId,
       status: "success",
       description: meta.note || "Transfer",
       currency: "INR",
       relatedRequestId,
       meta,
     }],
     { session }
   );

   await session.commitTransaction();
   session.endSession();

   return {
     ok: true,
     transaction: {
       id: tx[0]._id,
       type: tx[0].type,
       amount: tx[0].amount,
       sender: tx[0].sender,
       receiver: tx[0].receiver,
       status: tx[0].status,
       createdAt: tx[0].createdAt,
     },
   };
  } catch (error) {
   await session.abortTransaction();
   session.endSession();
   console.error("Transfer error:", error);
   throw error;
  }
}

/**
 * Get paginated transactions for a user
 * @param {string} userId - User ID
 * @param {number} limit - Limit per page (default 20)
 * @param {number} page - Page number (1-indexed, default 1)
 * @returns {Promise<{transactions: array, total: number, pages: number}>}
 */
async function getTransactions({ userId, limit = 20, page = 1 }) {
  try {
    const skip = (page - 1) * limit;

    // Find all transactions where user is sender or receiver
    const transactions = await Transaction.find({
      $or: [{ sender: userId }, { receiver: userId }]
    })
      .populate("sender", "username firstName lastName")
      .populate("receiver", "username firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }]
    });

    return {
      transactions,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error("Get transactions error:", error);
    throw error;
  }
}

/**
 * Get transaction summary/statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<{totalSent: number, totalReceived: number, transactionCount: number}>}
 */
async function getTransactionStats(userId) {
  try {
    const objectUserId = new mongoose.Types.ObjectId(userId);
    const stats = await Transaction.aggregate([
      {
        $facet: {
          sent: [
            { $match: { sender: objectUserId, status: "success" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          received: [
            { $match: { receiver: objectUserId, status: "success" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          count: [
            {
              $match: {
                $or: [{ sender: objectUserId }, { receiver: objectUserId }]
              }
            },
            { $count: "total" }
          ]
        }
      }
    ]);

    return {
      totalSent: stats[0].sent[0]?.total || 0,
      totalReceived: stats[0].received[0]?.total || 0,
      transactionCount: stats[0].count[0]?.total || 0
    };
  } catch (error) {
    console.error("Get transaction stats error:", error);
    throw error;
  }
}

/**
 * Get monthly transaction breakdown
 * @param {string} userId - User ID
 * @param {number} months - Number of months to look back (default 6)
 * @returns {Promise<array>}
 */
async function getMonthlyStats(userId, months = 6) {
  try {
    const data = await Transaction.aggregate([
      {
        $match: {
          $or: [{ sender: mongoose.Types.ObjectId(userId) }, { receiver: mongoose.Types.ObjectId(userId) }],
          status: "success",
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - months))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          sent: {
            $sum: {
              $cond: [{ $eq: ["$sender", mongoose.Types.ObjectId(userId)] }, "$amount", 0]
            }
          },
          received: {
            $sum: {
              $cond: [{ $eq: ["$receiver", mongoose.Types.ObjectId(userId)] }, "$amount", 0]
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    return data.map((item) => ({
      month: `${item._id.month}/${item._id.year}`,
      sent: item.sent,
      received: item.received,
      count: item.count
    }));
  } catch (error) {
    console.error("Get monthly stats error:", error);
    throw error;
  }
}

module.exports = {
  transfer,
  getTransactions,
  getTransactionStats,
  getMonthlyStats
};
