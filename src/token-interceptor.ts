import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import ms from "ms";

import { Queue } from "./lib/request-queue";
import { isExpired } from "./lib/token";
import { Token, RequestRefresh, Tokens } from "./lib/types";

interface ITokenOptions {
  /**
   *
   * Header name (default: `Authorization`)
   */
  header?: string;
  /**
   *
   * Header prefix (default: `Bearer `)
   */
  headerPrefix?: string;
  /**
   *
   * defines the leeway for the JWT expiry validation.
   * defined in seconds.
   */
  leeway?: string | number;
  /**
   *
   * The name given to the storage slot.
   */
  storageKey?: string;
}

export interface ITokenInterceptorConfig {
  storage: Storage;
  requestRefresh: RequestRefresh;
  options?: ITokenOptions;
  debug?: boolean;
}

export default class TokenInterceptor {
  private is_refreshing = false;
  queue: Queue<Token | undefined> = new Queue();

  private debug = false;
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
    this.debug = config.debug ?? false;
  }

  log(message?: any, ...args: any[]): void {
    if (!this.debug) return;
    console.debug(`[@aquacloud/axios-jwt]`, message, ...args);
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

  get leeway(): number {
    if (typeof this.config.leeway === "string") {
      return ms(this.config.leeway) / 1000;
    }

    return this.config.leeway;
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
    return (
      typeof this.refreshToken === "string" && this.refreshToken.length > 0
    );
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
      this.log(
        `token is refreshing, enqueue the request: [${requestConfig.method}] ${requestConfig.url}`
      );
      return new Promise<string | undefined>((resolve, reject) =>
        this.queue.enqueue({ resolve, reject })
      )
        .then(token => {
          if (requestConfig.headers) {
            requestConfig.headers[this.config?.header ?? "Authorization"] = `${
              this.config?.headerPrefix ?? "Bearer "
            }${token}`;
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
    const accessToken = this.accessToken;

    if (!accessToken || isExpired(accessToken, this.leeway)) {
      this.log({
        accessToken,
        leeway: this.leeway,
        isExpired: isExpired(accessToken ?? "", this.leeway),
      });
      this.log("Invalid access token or expired token. Refreshing...");
      const newToken = await this.doRefresh();
      this.accessToken = accessToken;
      return newToken;
    }

    return accessToken;
  }

  private async doRefresh() {
    if (!this.tokens || !this.refreshToken) {
      this.log("unable to refresh. no refresh token available");
      throw new Error("Unable to refresh tokens. No refresh token available.");
    }

    try {
      this.is_refreshing = true;
      this.log("refresh started.");
      const newTokens = await this.requestRefresh(this.tokens);

      if (newTokens === null) {
        this.clearTokens();
        return;
      }

      if (typeof newTokens === "object" && newTokens.accessToken) {
        this.tokens = newTokens;
        this.log("refresh completed");
        return newTokens.accessToken;
      } else if (typeof newTokens === "string") {
        this.accessToken = newTokens;
        this.log("refresh completed");
        return newTokens;
      }

      this.is_refreshing = false;
      this.log("refresh failed");
      throw new Error(
        `"requestRefresh" must either return a string or an object with an "accessToken"`
      );
    } catch (error) {
      this.is_refreshing = false;
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        this.log("refresh error with status code: ", status);

        if (status === 401 || status === 422) {
          this.storage.removeItem(this.config.storageKey);
          throw new Error(
            `Got ${status} on token refresh; clearing both tokens`
          );
        }
      }

      if (error instanceof Error) {
        this.log("refresh failed: ", error.message);
        throw new Error(`Failed to refresh auth token: ${error.message}`);
      }

      throw new Error(`Failed to refresh auth token and failed to parse error`);
    } finally {
      this.log("refresh completed");
      this.is_refreshing = false;
    }
  }
}
