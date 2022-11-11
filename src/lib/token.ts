import decode, { JwtPayload } from "jwt-decode";
import ms from "ms";

import { type Token } from "./types";

export const DEFAULT_LEEWAY = ms("10s");

export const getTimestamp = (token: Token): number | undefined => {
    const decoded = decode<JwtPayload>(token);
    return decoded.exp;
};

export const getExpiresIn = (token: Token): number => {
    const expiration = getTimestamp(token);
    if (!expiration) return -1;
    return expiration - Date.now() / 1000;
};

export const isExpired = (
    token: Token,
    leeway: number = DEFAULT_LEEWAY
): boolean => {
    if (!token) return true;
    const expiresIn = getExpiresIn(token);

    return !expiresIn || expiresIn <= leeway;
};
