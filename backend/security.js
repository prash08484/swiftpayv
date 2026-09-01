const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

/**
 * Helmet security middleware
 * Adds various HTTP headers for security
 */
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  });
}

/**
 * Rate limiting middleware
 * Includes configs for different endpoints
 */

// General API rate limit: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication endpoints: 20 requests per 15 minutes (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts, please try again later",
  skip: (req, res) => req.method === "GET",
  standardHeaders: true,
  legacyHeaders: false
});

// Transfer endpoints: 10 requests per minute (very strict)
const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many transfer requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

// Payment request endpoints: 50 requests per 15 minutes
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many payment requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

// OTP endpoints: 5 requests per minute (very strict - prevent email spam)
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many OTP requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  securityHeaders,
  generalLimiter,
  authLimiter,
  transferLimiter,
  requestLimiter,
  otpLimiter
};
