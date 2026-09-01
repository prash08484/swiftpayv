/**
 * Payment Requests Routes Tests
 * Tests /api/v1/requests endpoints
 */
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const express = require("express");
const request = require("supertest");
const requestsRouter = require("../routes/requests");
const { User, Account } = require("../db/db");
const PaymentRequest = require("../models/paymentRequest");
const Transaction = require("../models/transaction");

let app;
let token1, token2;
let user1, user2;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.set("io", {
    to: () => ({
      emit: jest.fn()
    })
  });

  app.use("/api/v1/requests", requestsRouter);
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

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

  await Account.create({ userId: user1._id, balance: 1000 });
  await Account.create({ userId: user2._id, balance: 500 });

  token1 = jwt.sign(
    { id: user1._id.toString(), email: "john@example.com", username: "johndoe" },
    process.env.JWT_SECRET || "test_secret"
  );

  token2 = jwt.sign(
    { id: user2._id.toString(), email: "jane@example.com", username: "janesmith" },
    process.env.JWT_SECRET || "test_secret"
  );
});

describe("Payment Requests Routes", () => {
  describe("POST /", () => {
    it("should create payment request", async () => {
      const res = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          targetId: user2._id.toString(),
          amount: 250,
          note: "Lunch money"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(250);
      expect(res.body.data.status).toBe("pending");
    });

    it("should fail for invalid amount", async () => {
      const res = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          targetId: user2._id.toString(),
          amount: -100
        });

      expect(res.status).toBe(400);
    });

    it("should fail when requesting from self", async () => {
      const res = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          targetId: user1._id.toString(),
          amount: 100
        });

      expect(res.status).toBe(400);
    });

    it("should fail without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/requests")
        .send({
          targetId: user2._id.toString(),
          amount: 100
        });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /", () => {
    beforeEach(async () => {
      // Create some payment requests
      await PaymentRequest.create({
        requester: user1._id,
        target: user2._id,
        amount: 100,
        status: "pending"
      });

      await PaymentRequest.create({
        requester: user2._id,
        target: user1._id,
        amount: 50,
        status: "pending"
      });
    });

    it("should get user payment requests", async () => {
      const res = await request(app)
        .get("/api/v1/requests")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.requests).toHaveLength(2);
    });

    it("should filter incoming requests", async () => {
      const res = await request(app)
        .get("/api/v1/requests?type=incoming")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      // user1 is target for one request
      expect(res.body.data.requests.length).toBeGreaterThan(0);
    });

    it("should filter by status", async () => {
      const res = await request(app)
        .get("/api/v1/requests?status=pending")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.requests.every((r) => r.status === "pending")).toBe(true);
    });
  });

  describe("POST /:id/accept", () => {
    let requestId;

    beforeEach(async () => {
      const paymentReq = await PaymentRequest.create({
        requester: user1._id,
        target: user2._id,
        amount: 100,
        status: "pending"
      });
      requestId = paymentReq._id;
    });

    it("should accept payment request and transfer money", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request.status).toBe("accepted");
      expect(res.body.data.transaction).toBeDefined();
    });

    it("should update balances after acceptance", async () => {
      await request(app)
        .post(`/api/v1/requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${token2}`);

      const account1 = await Account.findOne({ userId: user1._id });
      const account2 = await Account.findOne({ userId: user2._id });

      expect(account2.balance).toBe(400); // 500 - 100
      expect(account1.balance).toBe(1100); // 1000 + 100
    });

    it("should fail if non-target tries to accept", async () => {
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
        .post(`/api/v1/requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${token3}`);

      expect(res.status).toBe(403);
    });

    it("should fail if insufficient funds to accept", async () => {
      // Create request for large amount
      const largeRequest = await PaymentRequest.create({
        requester: user1._id,
        target: user2._id,
        amount: 1000, // More than user2 has
        status: "pending"
      });

      const res = await request(app)
        .post(`/api/v1/requests/${largeRequest._id}/accept`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(400);
    });

    it("should fail if already responded", async () => {
      // Accept once
      await request(app)
        .post(`/api/v1/requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${token2}`);

      // Try to accept again
      const res = await request(app)
        .post(`/api/v1/requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /:id/reject", () => {
    let requestId;

    beforeEach(async () => {
      const paymentReq = await PaymentRequest.create({
        requester: user1._id,
        target: user2._id,
        amount: 100,
        status: "pending"
      });
      requestId = paymentReq._id;
    });

    it("should reject payment request", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${requestId}/reject`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("rejected");
    });

    it("should not transfer money after rejection", async () => {
      await request(app)
        .post(`/api/v1/requests/${requestId}/reject`)
        .set("Authorization", `Bearer ${token2}`);

      const account1 = await Account.findOne({ userId: user1._id });
      const account2 = await Account.findOne({ userId: user2._id });

      expect(account1.balance).toBe(1000); // Unchanged
      expect(account2.balance).toBe(500); // Unchanged
    });

    it("should fail if non-target tries to reject", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${requestId}/reject`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(403);
    });

    it("should fail if already responded", async () => {
      // Reject once
      await request(app)
        .post(`/api/v1/requests/${requestId}/reject`)
        .set("Authorization", `Bearer ${token2}`);

      // Try to reject again
      const res = await request(app)
        .post(`/api/v1/requests/${requestId}/reject`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(400);
    });
  });
});
