import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import ms from "ms";

import { Queue } from "./lib/request-queue";
import { isExpired } from "./lib/token";
import { Token, RequestRefresh, Tokens } from "./lib/types";

interface ITokenOptions {
    header?: string;
    headerPrefix?: string;
    leeway?: string | number;
    storageKey?: string;
}

export interface ITokenInterceptorConfig {
    storage: Storage;
    requestRefresh: RequestRefresh;
    options?: ITokenOptions;
}

export default class TokenInterceptor {
    private is_refreshing = false;
    queue: Queue<Token | undefined> = new Queue();

    private storage: Storage;
    private requestRefresh: RequestRefresh;
    private config: Required<ITokenOptions> = {
        header: "Authorization",
        headerPrefix: "Bearer ",
        leeway: ms("10s"),
        storageKey: `auth-tokens-${process.env.NODE_ENV}`,
    };

    constructor(config: ITokenInterceptorConfig) {
        this.storage = config.storage;
        this.requestRefresh = config.requestRefresh;
        this.config = { ...this.config, ...config.options };
    }

    get isRefreshing(): boolean {
        return this.is_refreshing;
    }

    get tokens(): Tokens | undefined {
        const data = this.storage.getItem(this.config.storageKey);
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
            this.storage.removeItem(this.config.storageKey);
            return;
        }

        this.storage.setItem(this.config.storageKey, JSON.stringify(tokens));
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

    clearTokens() {
        this.tokens = undefined;
    }

    apply(instance: AxiosInstance) {
        instance.interceptors.request.use(this.interceptor);
    }

    interceptor = async (
        requestConfig: AxiosRequestConfig
    ): Promise<AxiosRequestConfig> => {
        if (!this.refreshToken) return requestConfig;

        if (this.is_refreshing) {
            return new Promise<string | undefined>((resolve, reject) =>
                this.queue.enqueue({ resolve, reject })
            )
                .then(token => {
                    if (requestConfig.headers) {
                        requestConfig.headers[
                            this.config?.header ?? "Authorization"
                        ] = `${this.config?.headerPrefix ?? "Bearer "}${token}`;
                    }

                    return requestConfig;
                })
                .catch(Promise.reject);
        }

        let accessToken: string | undefined;

        try {
            accessToken = await this.refreshTokenIfNeeded();
            this.queue.resolve(accessToken);
        } catch (e: unknown) {
            if (e instanceof Error) {
                this.queue.decline(e);
                throw new Error(
                    `Unable to refresh acces token due to token request error: ${e.message}`
                );
            }
        }

        if (requestConfig.headers) {
            requestConfig.headers[this.config?.header ?? "Authorization"] = `${
                this.config?.headerPrefix ?? "Bearer "
            }${accessToken}`;
        }

        return requestConfig;
    };

    async refreshTokenIfNeeded(): Promise<Token | undefined> {
        let accessToken = this.accessToken;
        const leeway = ms(this.config.leeway as string);

        if (!accessToken || isExpired(accessToken, leeway)) {
            accessToken = await this.doRefresh();
            this.accessToken = accessToken;
        }

        return accessToken;
    }

    private async doRefresh() {
        if (!this.tokens || !this.refreshToken) {
            throw new Error(
                "Unable to refresh tokens. No refresh token available."
            );
        }

        try {
            this.is_refreshing = true;
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
                    this.storage.removeItem(this.config.storageKey);
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
            this.is_refreshing = false;
        }
    }
}