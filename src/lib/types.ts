export interface Tokens {
  accessToken: Token;
  refreshToken: Token;
}

export type RequestRefresh = (
  tokens: Tokens
) => Promise<Tokens | string | null>;

export type Token = string;

export interface IInterceptorConfig {
  header?: string;
  headerPrefix?: string;
}
