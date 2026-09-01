const express = require("express");
const { z } = require("zod");
const authMiddleware = require("../middlewares/middleware");
const { Account } = require("../db/db");
const { transfer } = require("../services/transferService");
const router = express.Router();

const transferSchema = z.object({
  to: z.string().min(1),
  amount: z.number().positive().finite(),
  note: z.string().max(500).optional(),
});

router.get("/balance", authMiddleware, async (req, res) => {
  const accountInfo = await Account.findOne({ userId: req.userId });
  if (!accountInfo) {
    return res.status(404).json({ success: false, error: "Account not found" });
  }
  return res.json({ success: true, balance: accountInfo.balance });
});

router.post("/transfer", authMiddleware, async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid transfer payload" });
  }

  const { to, amount, note } = parsed.data;
  const result = await transfer({
    fromId: req.userId,
    toId: to,
    amount,
    meta: { note },
  });

  if (!result.ok) {
    return res.status(result.reason === "insufficient_funds" ? 400 : 409).json({ success: false, error: result.reason });
  }

  return res.status(200).json({ success: true, message: "Transfer successful", transaction: result.transaction });
});

module.exports = router;
