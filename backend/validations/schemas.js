const { z } = require("zod");

// User Registration Validation
const userRegistrationSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .min(2, "First name must be at least 2 characters")
    .trim(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .min(2, "Last name must be at least 2 characters")
    .trim(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must not exceed 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores")
    .trim(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .min(1, "Password is required"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// User Login Validation
const userLoginSchema = z.object({
  username: z
    .string()
    .min(3, "Username is required")
    .trim(),
  password: z
    .string()
    .min(1, "Password is required"),
});

// Email Validation
const emailSchema = z.object({
  email: z
    .string()
    .email("Invalid email address"),
});

// OTP Validation
const otpSchema = z.object({
  email: z
    .string()
    .email("Invalid email address"),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});

// Transaction Validation
const transactionSchema = z.object({
  senderId: z
    .string()
    .min(1, "Sender ID is required"),
  recipientId: z
    .string()
    .min(1, "Recipient ID is required"),
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .min(1, "Minimum transaction amount is 1"),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .optional(),
});

// Account Update Validation
const accountUpdateSchema = z.object({
  balance: z
    .number()
    .nonnegative("Balance cannot be negative"),
});

module.exports = {
  userRegistrationSchema,
  userLoginSchema,
  emailSchema,
  otpSchema,
  transactionSchema,
  accountUpdateSchema,
};
