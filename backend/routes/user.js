const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { User, Account, OTP } = require("../db/db");
const authMiddleware = require("../middlewares/middleware");
const config = require("../config");

const router = express.Router();

const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(40),
  lastName: z.string().trim().min(1).max(40),
  username: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  otp: z.string().length(6),
});

const signinSchema = z.object({
  username: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(40).optional(),
  lastName: z.string().trim().min(1).max(40).optional(),
  password: z.string().min(6).optional(),
}).strict();

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function toUserResponse(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
  };
}

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid signup payload" });
  }

  const { firstName, lastName, username, password, otp } = parsed.data;

  try {
    const latestOtp = await OTP.findOne({ email: username }).sort({ createdAt: -1 });
    const validOtp = latestOtp && !latestOtp.used && new Date(latestOtp.expiresAt) > new Date() && latestOtp.otpHash === hashOtp(otp);

    if (!validOtp) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    const newUser = new User({
      username,
      firstName,
      lastName,
    });

    newUser.password = await newUser.createHash(password);
    const user = await newUser.save();

    await Account.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: { userId: user._id, balance: config.INITIAL_SIMULATED_BALANCE } },
      { upsert: true, new: true }
    );

    await OTP.updateOne({ _id: latestOtp._id }, { $set: { used: true } });

    const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      token,
      user: toUserResponse(user),
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create account" });
  }
});

router.post("/signin", async (req, res) => {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Invalid login payload" });
  }

  const { username, password } = parsed.data;
  const user = await User.findOne({ username });

  if (!user) {
    return res.status(400).json({ success: false, message: "User not found" });
  }

  if (!(await user.validatePassword(password))) {
    return res.status(400).json({ success: false, message: "Incorrect password" });
  }

  const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

  return res.status(200).json({
    success: true,
    message: "User successfully logged in",
    token,
    user: toUserResponse(user),
  });
});

router.put("/update", authMiddleware, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid update payload" });
  }

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const changes = { ...parsed.data };
  if (changes.password) {
    changes.password = await user.createHash(changes.password);
  }

  Object.keys(changes).forEach((key) => {
    user[key] = changes[key];
  });

  await user.save();

  return res.status(200).json({ success: true, message: "Update successful", user: toUserResponse(user) });
});

router.get("/bulk", authMiddleware, async (req, res) => {
  const search = String(req.query.filter || "").trim();
  const query = search
    ? {
        $or: [
          { firstName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
          { lastName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        ],
      }
    : {};

  const users = await User.find(query)
    .select("firstName lastName username")
    .limit(25)
    .lean();

  return res.status(200).json({
    success: true,
    users: users.map((user) => ({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
    })),
  });
});

router.delete("/delete", authMiddleware, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  await user.deleteOne();
  await Account.deleteOne({ userId: req.userId });
  return res.status(200).json({ success: true, message: "User deleted successfully" });
});

module.exports = router;
