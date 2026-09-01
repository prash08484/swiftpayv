/**
 * Backfill Transactions Script
 * Backfill transaction ledger entries from account history
 * Run this once if migrating from old schema without transaction tracking
 * 
 * Usage: node scripts/backfill-transactions.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { User, Account } = require("../db/db");
const Transaction = require("../models/transaction");

async function backfillTransactions() {
  try {
    console.log("Starting transaction backfill...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB");

    // Get all accounts
    const accounts = await Account.find();
    console.log(`Found ${accounts.length} accounts`);

    let created = 0;

    // For each account, check if we need to create initial balance transaction
    for (const account of accounts) {
      // Check if transaction exists for this account
      const existingTx = await Transaction.findOne({
        receiver: account.userId,
        type: "system_credit"
      });

      if (!existingTx && account.balance > 0) {
        // Create initial account credit transaction
        const tx = await Transaction.create({
          type: "system_credit",
          amount: account.balance,
          receiver: account.userId,
          status: "success",
          description: "Initial account balance",
          createdAt: account.createdAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        });
        created++;
        console.log(
          `✓ Created transaction for user ${account.userId}: ₹${account.balance}`
        );
      }
    }

    console.log(`\n✓ Backfill complete! Created ${created} transactions`);

    // Show statistics
    const totalTransactions = await Transaction.countDocuments();
    console.log(`Total transactions in system: ${totalTransactions}`);

    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  } catch (error) {
    console.error("Backfill error:", error);
    process.exit(1);
  }
}

/**
 * Alternative: Verify existing data integrity
 */
async function verifyTransactions() {
  try {
    console.log("Verifying transaction data integrity...");

    await mongoose.connect(process.env.MONGODB_URI);

    const transactions = await Transaction.countDocuments();
    const accounts = await Account.countDocuments();
    const users = await User.countDocuments();

    console.log(`\n📊 Current Data State:`);
    console.log(`   Users: ${users}`);
    console.log(`   Accounts: ${accounts}`);
    console.log(`   Transactions: ${transactions}`);

    // Check for orphaned transactions
    const orphanedTransactions = await Transaction.find({
      $or: [
        { sender: { $exists: true }, receiver: null },
        { receiver: { $exists: true }, sender: null }
      ]
    });

    if (orphanedTransactions.length > 0) {
      console.warn(`\n⚠️  Found ${orphanedTransactions.length} orphaned transactions`);
    }

    // Check for balance mismatches
    const mismatches = [];
    const allUsers = await User.find();

    for (const user of allUsers) {
      const account = await Account.findOne({ userId: user._id });
      if (!account) {
        mismatches.push({
          user: user.username,
          issue: "No account found"
        });
      }
    }

    if (mismatches.length > 0) {
      console.warn(`\n⚠️  Found ${mismatches.length} data mismatches:`);
      mismatches.forEach((m) => console.warn(`   - ${m.user}: ${m.issue}`));
    } else {
      console.log("\n✓ All data integrity checks passed!");
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("Verification error:", error);
    process.exit(1);
  }
}

// Run backfill if not called with --verify flag
if (process.argv.includes("--verify")) {
  verifyTransactions();
} else {
  backfillTransactions();
}

module.exports = { backfillTransactions, verifyTransactions };
