const express = require("express");
const crypto = require("crypto");
const otpGenerator = require("otp-generator");
const { z } = require("zod");
const { User, OTP } = require("../db/db");
const mailSender = require("../utils/mailSender");
const config = require("../config");

const router = express.Router();
const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(6);

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

router.post("/send-otp", async (req, res) => {
  const result = emailSchema.safeParse(req.body?.username);
  if (!result.success) {
    return res.status(400).json({ success: false, message: "Invalid email address" });
  }

  const passResult = passwordSchema.safeParse(req.body?.password);
  if (!passResult.success) {
    return res.status(400).json({ success: false, message: "Password should be at least 6 characters" });
  }

  const email = result.data;
  try {
    const existingUser = await User.findOne({ username: email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    const recentOtp = await OTP.findOne({ email, used: false }).sort({ createdAt: -1 });
    if (recentOtp && new Date(recentOtp.expiresAt) > new Date()) {
      return res.status(429).json({ success: false, message: "OTP already sent recently. Please wait before requesting another." });
    }

    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY * 1000);

    await OTP.create({
      email,
      otpHash,
      expiresAt,
      used: false,
      attemptCount: 0,
    });

    try {
      await mailSender(
        email,
        "SwiftPay Verification OTP",
        `<h1>Welcome to SwiftPay</h1><p>Your OTP is: <strong>${otp}</strong></p><p>Valid for ${config.OTP_EXPIRY} seconds.</p>`
      );
    } catch (mailError) {
      console.error("OTP email failed:", mailError.message);
      return res.status(500).json({ success: false, message: "Unable to send OTP right now. Please try again later." });
    }

    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP send error:", error.message);
    return res.status(500).json({ success: false, message: "Please try again after sometime" });
  }
});

module.exports = router;
