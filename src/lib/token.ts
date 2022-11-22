import decode, { JwtPayload } from "jwt-decode";

import { type Token } from "./types";

export const getTimestamp = (token: Token): number | undefined => {
  const decoded = decode<JwtPayload>(token);
  return decoded.exp;
};

export const getExpiresIn = (token: Token): number => {
  const expiration = getTimestamp(token);
  if (!expiration) return -1;
  return expiration - Date.now() / 1000;
};

/**
 *
 * @param token the accessToken
 * @param leeway must be in seconds (default: 1200s (20 minutes))
 */
export const isExpired = (token: Token, leeway = 1200): boolean => {
  if (!token) return true;
  const expiresIn = getExpiresIn(token);

  return !expiresIn || expiresIn <= leeway;
};
