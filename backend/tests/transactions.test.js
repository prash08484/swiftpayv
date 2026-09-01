/**
 * Transaction Routes Tests
 * Tests /api/v1/transactions endpoints
 */
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const express = require("express");
const request = require("supertest");
const transactionsRouter = require("../routes/transactions");
const { User, Account } = require("../db/db");
const Transaction = require("../models/transaction");
const auth = require("../middlewares/middleware");

let app;
let token1, token2;
let user1, user2;

beforeAll(async () => {
  // Setup express app
  app = express();
  app.use(express.json());
  app.set("io", {
    to: () => ({
      emit: jest.fn()
    })
  });

  // Mount router
  app.use("/api/v1/transactions", transactionsRouter);
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Create test users
  user1 = await User.create({
    firstName: "John",
    lastName: "Doe",
    username: "johndoe",
    password: "hashed"
  });

  user2 = await User.create({
    firstName: "Jane",
    lastName: "Smith",
    username: "janesmith",
    password: "hashed"
  });

  // Create accounts
  await Account.create({ userId: user1._id, balance: 1000 });
  await Account.create({ userId: user2._id, balance: 500 });

  // Create JWT tokens
  token1 = jwt.sign(
    {
      id: user1._id.toString(),
      email: "john@example.com",
      username: "johndoe"
    },
    process.env.JWT_SECRET || "test_secret"
  );

  token2 = jwt.sign(
    {
      id: user2._id.toString(),
      email: "jane@example.com",
      username: "janesmith"
    },
    process.env.JWT_SECRET || "test_secret"
  );
});

describe("Transaction Routes", () => {
  describe("POST /transfer", () => {
    it("should transfer money successfully", async () => {
      const res = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          toUserId: user2._id.toString(),
          amount: 100,
          note: "Payment for coffee"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.transaction).toBeDefined();
      expect(res.body.transaction.amount).toBe(100);
    });

    it("should fail with invalid amount", async () => {
      const res = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          toUserId: user2._id.toString(),
          amount: -100
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should fail when insufficient funds", async () => {
      const res = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          toUserId: user2._id.toString(),
          amount: 2000
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("insufficient_funds");
    });

    it("should fail without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/transactions/transfer")
        .send({
          toUserId: user2._id.toString(),
          amount: 100
        });

      expect(res.status).toBe(401);
    });

    it("should fail for self-transfer", async () => {
      const res = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          toUserId: user1._id.toString(),
          amount: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot transfer to yourself");
    });
  });

  describe("GET /", () => {
    beforeEach(async () => {
      // Create some transactions
      await Transaction.create({
        type: "transfer",
        amount: 100,
        sender: user1._id,
        receiver: user2._id,
        status: "success"
      });

      await Transaction.create({
        type: "transfer",
        amount: 50,
        sender: user2._id,
        receiver: user1._id,
        status: "success"
      });
    });

    it("should get user transactions", async () => {
      const res = await request(app)
        .get("/api/v1/transactions")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toHaveLength(2);
    });

    it("should paginate transactions", async () => {
      const res = await request(app)
        .get("/api/v1/transactions?limit=1&page=1")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(1);
      expect(res.body.data.currentPage).toBe(1);
    });

    it("should fail without authentication", async () => {
      const res = await request(app).get("/api/v1/transactions");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /stats", () => {
    beforeEach(async () => {
      await Transaction.create({
        type: "transfer",
        amount: 200,
        sender: user1._id,
        receiver: user2._id,
        status: "success"
      });

      await Transaction.create({
        type: "transfer",
        amount: 150,
        sender: user2._id,
        receiver: user1._id,
        status: "success"
      });
    });

    it("should get transaction statistics", async () => {
      const res = await request(app)
        .get("/api/v1/transactions/stats")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalSent).toBe(200);
      expect(res.body.data.totalReceived).toBe(150);
    });
  });

  describe("GET /:id", () => {
    let transactionId;

    beforeEach(async () => {
      const tx = await Transaction.create({
        type: "transfer",
        amount: 100,
        sender: user1._id,
        receiver: user2._id,
        status: "success"
      });
      transactionId = tx._id;
    });

    it("should get specific transaction", async () => {
      const res = await request(app)
        .get(`/api/v1/transactions/${transactionId}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toEqual(transactionId.toString());
    });

    it("should fail for non-existent transaction", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/transactions/${fakeId}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(404);
    });

    it("should fail if user not involved in transaction", async () => {
      const user3 = await User.create({
        firstName: "Bob",
        lastName: "Brown",
        username: "bob",
        password: "hashed"
      });

      const token3 = jwt.sign(
        { id: user3._id.toString(), email: "bob@example.com", username: "bob" },
        process.env.JWT_SECRET || "test_secret"
      );

      const res = await request(app)
        .get(`/api/v1/transactions/${transactionId}`)
        .set("Authorization", `Bearer ${token3}`);

      expect(res.status).toBe(403);
    });
  });
});
