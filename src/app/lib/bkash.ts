import config from "../config";
import { AppError } from "../utils/AppError";
import { redisClient } from "./redis";
import httpStatus from "http-status";

export const getBkashIdToken = async () => {
  try {
    const idTokenKey = "bkash:idToken";
    const refreshTokenKey = "bkash:refreshToken";
    let bkashIdToken = await redisClient.get(idTokenKey);
    const bkashRefreshToken = await redisClient.get(refreshTokenKey);
    const bkashIdTokenTTL = await redisClient.ttl(idTokenKey);
    const bkashRefreshTokenTTL = await redisClient.ttl(refreshTokenKey);

    if (bkashIdTokenTTL > 600) {
      return bkashIdToken;
    }

    if (bkashRefreshToken && bkashRefreshTokenTTL > 600) {
      const refreshTokenResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },
          body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        },
      );

      // fix: this check was missing -- a failed refresh call would silently
      // continue with an undefined/garbage token
      if (!refreshTokenResponse.ok) {
        throw new Error(`Failed to refresh bKash token: ${refreshTokenResponse.statusText}`);
      }

      const bkashRefreshTokenResult = await refreshTokenResponse.json();
      bkashIdToken = bkashRefreshTokenResult.id_token as string;

      await redisClient.set(idTokenKey, bkashIdToken, {
        expiration: { type: "EX", value: 60 * 60 },
      });

      // fix: bKash may rotate the refresh_token on refresh -- re-store it if present,
      // otherwise the old one could expire sooner than expected
      if (bkashRefreshTokenResult.refresh_token) {
        await redisClient.set(refreshTokenKey, bkashRefreshTokenResult.refresh_token, {
          expiration: { type: "EX", value: 60 * 60 * 24 * 7 },
        });
      }

      return bkashIdToken;
    }

    const response = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },
        body: JSON.stringify({
          app_key: config.bkash_app_key,
          app_secret: config.bkash_app_secret,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get bKash ID token: ${response.statusText}`);
    }

    const result = await response.json();

    await redisClient.set(idTokenKey, result.id_token, {
      expiration: { type: "EX", value: 60 * 60 },
    });
    await redisClient.set(refreshTokenKey, result.refresh_token, {
      expiration: { type: "EX", value: 60 * 60 * 24 * 7 },
    });

    bkashIdToken = result.id_token;
    return bkashIdToken;
  } catch (error) {
    // fix: was swallowing the real error entirely -- at least log it in dev
    console.error("getBkashIdToken failed:", error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to get bKash ID token",
    );
  }
};