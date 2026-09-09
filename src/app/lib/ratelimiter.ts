import rateLimit from "express-rate-limit";
import httpStatus from "http-status";

 
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