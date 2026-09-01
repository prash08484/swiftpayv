/**
 * Transfer Service Tests
 * Tests atomic transfer logic, insufficient funds, etc.
 */
const mongoose = require("mongoose");
const { transfer, getTransactions, getTransactionStats } = require("../services/transferService");
const { User, Account } = require("../db/db");
const Transaction = require("../models/transaction");

describe("Transfer Service", () => {
  let user1, user2, account1, account2;

  beforeEach(async () => {
    // Create test users
    user1 = await User.create({
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
      password: "hashedpassword123"
    });

    user2 = await User.create({
      firstName: "Jane",
      lastName: "Smith",
      username: "janesmith",
      password: "hashedpassword456"
    });

    // Create accounts with initial balances
    account1 = await Account.create({
      userId: user1._id,
      balance: 1000
    });

    account2 = await Account.create({
      userId: user2._id,
      balance: 500
    });
  });

  describe("Successful Transfer", () => {
    it("should transfer money from sender to receiver", async () => {
      const amount = 100;
      const result = await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount,
        meta: { note: "Payment for lunch" }
      });

      expect(result.ok).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.amount).toBe(amount);
      expect(result.transaction.sender).toEqual(user1._id);
      expect(result.transaction.receiver).toEqual(user2._id);
    });

    it("should update balances correctly after transfer", async () => {
      const amount = 200;
      await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount
      });

      const updatedAccount1 = await Account.findOne({ userId: user1._id });
      const updatedAccount2 = await Account.findOne({ userId: user2._id });

      expect(updatedAccount1.balance).toBe(1000 - amount);
      expect(updatedAccount2.balance).toBe(500 + amount);
    });

    it("should create transaction ledger entry", async () => {
      const amount = 150;
      const result = await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount,
        meta: { note: "Test payment" }
      });

      const transaction = await Transaction.findById(result.transaction.id);
      expect(transaction).toBeDefined();
      expect(transaction.type).toBe("transfer");
      expect(transaction.status).toBe("success");
      expect(transaction.amount).toBe(amount);
    });
  });

  describe("Transfer Validation", () => {
    it("should fail with insufficient funds", async () => {
      const result = await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: 2000 // More than balance
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("insufficient_funds");
    });

    it("should fail for self-transfer", async () => {
      const result = await transfer({
        fromId: user1._id.toString(),
        toId: user1._id.toString(),
        amount: 100
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("cannot_transfer_to_self");
    });

    it("should fail with invalid amount", async () => {
      const result = await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: -100
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("invalid_amount");
    });

    it("should fail if account not found", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const result = await transfer({
        fromId: user1._id.toString(),
        toId: fakeId.toString(),
        amount: 100
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("account_not_found");
    });
  });

  describe("Transaction History", () => {
    it("should retrieve transactions for a user", async () => {
      // Create multiple transactions
      await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: 100
      });

      await transfer({
        fromId: user2._id.toString(),
        toId: user1._id.toString(),
        amount: 50
      });

      const result = await getTransactions({
        userId: user1._id.toString(),
        limit: 20,
        page: 1
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should paginate transactions correctly", async () => {
      // Create 25 transactions
      for (let i = 0; i < 25; i++) {
        await transfer({
          fromId: user1._id.toString(),
          toId: user2._id.toString(),
          amount: 10
        });
      }

      const page1 = await getTransactions({
        userId: user1._id.toString(),
        limit: 20,
        page: 1
      });

      const page2 = await getTransactions({
        userId: user1._id.toString(),
        limit: 20,
        page: 2
      });

      expect(page1.transactions).toHaveLength(20);
      expect(page2.transactions).toHaveLength(5);
      expect(page1.total).toBe(25);
      expect(page1.pages).toBe(2);
    });

    it("should sort transactions by date descending", async () => {
      await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: 100
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: 50
      });

      const result = await getTransactions({
        userId: user1._id.toString(),
        limit: 20,
        page: 1
      });

      expect(result.transactions[0].amount).toBe(50); // Most recent first
      expect(result.transactions[1].amount).toBe(100);
    });
  });

  describe("Transaction Statistics", () => {
    it("should calculate total sent amount", async () => {
      await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: 100
      });

      await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: 50
      });

      const stats = await getTransactionStats(user1._id.toString());

      expect(stats.totalSent).toBe(150);
    });

    it("should calculate total received amount", async () => {
      await transfer({
        fromId: user1._id.toString(),
        toId: user2._id.toString(),
        amount: 200
      });

      const stats = await getTransactionStats(user2._id.toString());

      expect(stats.totalReceived).toBe(200);
    });
  });

  describe("Atomicity", () => {
    it("should maintain consistency on concurrent transfers", async () => {
      // Simulate concurrent transfers
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          transfer({
            fromId: user1._id.toString(),
            toId: user2._id.toString(),
            amount: 100
          })
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.ok).toBe(true);
      });

      // Final balance should be correct
      const finalAccount1 = await Account.findOne({ userId: user1._id });
      expect(finalAccount1.balance).toBe(1000 - 500);
    });
  });
});
