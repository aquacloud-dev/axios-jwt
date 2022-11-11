import axios from "axios";
import ms from "ms";
import { isExpired } from "./lib/token";

import { Token } from "./lib/types";

export const STORAGE_KEY = `auth-tokens-${process.env.NODE_ENV}`;

// try to refresh a little before expiration (in ms)
export const EXPIRE_FUDGE = ms("10s");

export interface Tokens {
    accessToken: Token;
    refreshToken: Token;
}

export type RequestRefresh = (tokens: Tokens) => Promise<Tokens | string>;

export class TokenStorage {
    isRefreshing = false;

    constructor(
        private storage: Storage,
        private requestRefresh: RequestRefresh
    ) {}

    get tokens(): Tokens | undefined {
        const data = this.storage.getItem(STORAGE_KEY);
        if (!data) return;

        try {
            return JSON.parse(data);
        } catch (error: unknown) {
            if (error instanceof SyntaxError) {
                error.message = `Failed to parse tokens: ${data}`;
                throw error;
            }
        }
    }

    set tokens(tokens: Tokens | undefined) {
        if (!tokens) {
            this.storage.removeItem(STORAGE_KEY);
            return;
        }

        this.storage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }

    get accessToken(): Token | undefined {
        return this.tokens?.accessToken;
    }
    set accessToken(token: Token | undefined) {
        if (!token) return;
        const tokens = this.tokens;

        if (!tokens) {
            throw new Error(
                "Unable to update refreshToken since there are no tokens currently stored"
            );
        }

        tokens.accessToken = token;
        this.tokens = tokens;
    }

    get refreshToken(): Token | undefined {
        return this.tokens?.refreshToken;
    }

    set refreshToken(token: Token | undefined) {
        if (!token) return;
        const tokens = this.tokens;

        if (!tokens) {
            throw new Error(
                "Unable to update refreshToken since there are no tokens currently stored"
            );
        }

        tokens.refreshToken = token;
        this.tokens = tokens;
    }

    get isLoggedIn(): boolean {
        return !!this.refreshToken;
    }

    clear() {
        this.tokens = undefined;
    }

    async refreshTokenIfNeeded(): Promise<Token | undefined> {
        let accessToken = this.accessToken;

        if (!accessToken || isExpired(accessToken)) {
            accessToken = await this.refreshTokens();
            this.accessToken = accessToken;
        }

        return accessToken;
    }

    private async refreshTokens() {
        if (!this.tokens || !this.refreshToken) {
            throw new Error(
                "Unable to refresh tokens. No refresh token available."
            );
        }

        try {
            this.isRefreshing = true;
            const newTokens = await this.requestRefresh(this.tokens);

            if (typeof newTokens === "object" && newTokens.accessToken) {
                this.tokens = newTokens;
                return newTokens.accessToken;
            } else if (typeof newTokens === "string") {
                this.accessToken = newTokens;
                return newTokens;
            }

            throw new Error(
                `"requestRefresh" must either return a string or an object with an "accessToken"`
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;

                if (status === 401 || status === 422) {
                    this.storage.removeItem(STORAGE_KEY);
                    throw new Error(
                        `Got ${status} on token refresh; clearing both tokens`
                    );
                }
            }

            if (error instanceof Error) {
                throw new Error(
                    `Failed to refresh auth token: ${error.message}`
                );
            }

            throw new Error(
                `Failed to refrehs auth token and failed to parse error`
            );
        } finally {
            this.isRefreshing = false;
        }
    }
}
