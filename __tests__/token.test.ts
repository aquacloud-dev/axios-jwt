import jwt from "jsonwebtoken";
import { test, expect } from "vitest";

import { isExpired } from "@/lib/token";

const token = jwt.sign({}, "my-super-secret-token-is-not-safe", {
  expiresIn: 1200,
});

const expiredToken = jwt.sign({}, "my-super-secret-token-is-not-safe", {
  expiresIn: 0,
});

const LEEWAY = 300;

test("token should not be expired", () => {
  const result = isExpired(token, LEEWAY);
  expect(result).toBe(false);
});

test("token should be expired", () => {
  const result = isExpired(expiredToken, LEEWAY);
  expect(result).toBe(true);
});
