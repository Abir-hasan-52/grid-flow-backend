import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";
import { Prisma } from "../../../generated/prisma/client";

export const globalErrorHandler = async (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (config.node_env === "development") {
    console.log("Error from Global Error Handler", err);
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage = err.message || "Internal Server Error";
  let errorName = err.name || "Error";

  // fix: "isOperational" marks errors that are deliberate/expected -- their
  // message is safe to show the client in ANY environment (dev or prod).
  // Only truly unexpected errors (bugs, unhandled exceptions) get masked
  // behind a generic message in production.
  let isOperational = false;

  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage = "You have provided incorrect field type or missing fields";
    errorName = "PrismaClientValidationError";
    isOperational = true;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "PrismaClientKnownRequestError";
    isOperational = true;

    if (err.code === "P2002") {
      errorMessage = "Duplicate Key Error";
    } else if (err.code === "P2003") {
      errorMessage = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      errorMessage =
        "An operation failed because it depends on one or more records that were required but not found.";
    } else {
      errorMessage = "Database request error";
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    errorName = "PrismaClientInitializationError";
    isOperational = true;

    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      errorMessage =
        "Authentication failed against database server. Please check your credentials";
    } else if (err.errorCode === "P1001") {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage = "Can't reach database server";
    } else {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = "Database connection error";
    }
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorMessage = "Error occurred during query execution";
    errorName = "PrismaClientUnknownRequestError";
    // not operational -- this is genuinely unexpected, mask in production
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    errorName = "AppError";
    isOperational = true; // AppError is always a deliberate, client-facing message
  } else if (err instanceof Error) {
    errorMessage = err.message;
    errorName = err.name;
    // not operational -- unrecognized Error subtype, treat as unexpected
  }

  // fix: previously this masked the message in production for EVERY error,
  // including deliberate/safe ones like AppError("Invalid credentials").
  // Now only non-operational (truly unexpected) errors get masked in prod.
  const responseMessage =
    isOperational || config.node_env === "development"
      ? errorMessage
      : "Internal Server Error";

  const responseName =
    isOperational || config.node_env === "development" ? errorName : "Error";

  // fix: production shows a fixed generic "message", with the actual
  // detail placed in "errors" (per the exact shape requested).
  const GENERIC_MESSAGE = "Something went wrong";
  const isDev = config.node_env === "development";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message: isDev ? responseMessage : GENERIC_MESSAGE,
    errors: responseMessage,
    ...(isDev && {
      name: responseName,
      error: err,
      stack: err.stack,
    }),
  });
};