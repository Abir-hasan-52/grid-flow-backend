import rateLimit from "express-rate-limit";
import httpStatus from "http-status";

// Applied globally on /api/v1 -- generous, just to stop obvious abuse/scraping.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: httpStatus.TOO_MANY_REQUESTS,
    message: "Too many requests. Please try again later.",
    errors: "Too many requests from this IP, please try again after 15 minutes",
  },
});

// Stricter limiter for sensitive auth endpoints (login, register, forgot-password,
// verify-email) -- these are the classic brute-force / OTP-spam targets.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: httpStatus.TOO_MANY_REQUESTS,
    message: "Too many attempts. Please try again later.",
    errors: "Too many attempts from this IP, please try again after 15 minutes",
  },
});

// Payment-initiation limiter -- prevents someone from hammering the bKash
// create-payment endpoint (which calls a real third-party API each time).
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: httpStatus.TOO_MANY_REQUESTS,
    message: "Too many payment attempts. Please try again later.",
    errors: "Too many payment initiation attempts from this IP, please try again after an hour",
  },
});