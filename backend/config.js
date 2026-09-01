const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env") });

function requireEnv(name, value, { allowEmpty = false } = {}) {
  if (typeof value !== "string") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  const normalized = value.trim();
  if (!allowEmpty && normalized === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return normalized;
}

const isTestEnv = process.env.NODE_ENV === "test";
const defaultTestMongoUri = "mongodb://127.0.0.1:27017/swifpay_test";
const defaultTestJwtSecret = "test_secret_key_123";

function normalizeOrigin(value) {
  if (!value) return "http://localhost:5173,http://localhost:3000";
  return String(value)
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .join(",");
}

const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 8080),
  MONGODB_URI: requireEnv(
    "MONGODB_URI",
    process.env.MONGODB_URI || (isTestEnv ? defaultTestMongoUri : undefined),
    { allowEmpty: isTestEnv }
  ),
  JWT_SECRET: requireEnv(
    "JWT_SECRET",
    process.env.JWT_SECRET || (isTestEnv ? defaultTestJwtSecret : undefined),
    { allowEmpty: isTestEnv }
  ),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || "gmail",
  EMAIL_USER: process.env.EMAIL_USER || "",
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || "",
  FRONTEND_URL: normalizeOrigin(process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:3000"),
  OTP_EXPIRY: Number(process.env.OTP_EXPIRY || 120),
  INITIAL_SIMULATED_BALANCE: Number(process.env.INITIAL_SIMULATED_BALANCE || 500),
};

module.exports = config;

