type SameSite = "strict" | "lax";

interface CookieOptions {
  /**
   *
   * @see https://javascript.info/cookie#expires-max-age
   */
  maxAge?: number;
  /**
   *
   * Determines where to allow this cookie to exists.
   * @see https://javascript.info/cookie#path
   * */
  path?: string;

  sameSite?: SameSite;
  /**
   *
   * A domain defines where the cookie is accessible.
   * In practice though, there are limitations.
   * We can’t set any domain.
   *
   * @see https://javascript.info/cookie#domain
   */
  domain?: string;
  /**
   *
   * set `true` to make this cookie accessible only over HTTPS
   *
   * @see https://javascript.info/cookie#secure
   */
  secure?: boolean;
}

const optionsNames: Partial<Record<keyof CookieOptions, string>> = {
  maxAge: "max-age",
  sameSite: "same-site",
};

const parseOptionName = (name: keyof CookieOptions): string =>
  optionsNames[name] || name;

class CookieStorage implements Storage {
  get length(): number {
    return Object.keys(this.cookies).length;
  }

  clear(): void {
    throw new Error("Method not implemented.");
  }

  getItem(key: string): string | null {
    return this.cookies[key];
  }

  key(index: number): string | null {
    return this.getItem(Object.keys(this.cookies)[index]);
  }

  removeItem(key: string): void {
    this.setItem(key, "", {
      maxAge: -1,
    });
  }

  setItem(key: string, value: string, options?: CookieOptions): void {
    const k = encodeURIComponent(key);
    const v = encodeURIComponent(value);

    const opts: CookieOptions = { path: "/", ...options };

    const baseCookie = `${k}=${v}`;
    let cookie = `${baseCookie}`;

    for (const k in opts) {
      cookie += `; ${parseOptionName(k as keyof CookieOptions)}`;
      const value = opts[k as keyof CookieOptions];

      if (value !== true) {
        cookie += `=${value}`;
      }
    }

    document.cookie = cookie;
  }

  get cookies(): Record<string, string | null> {
    return document.cookie
      .split(";")
      .map(v => v.split("="))
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [decodeURIComponent(key.trim())]: decodeURIComponent(value.trim()),
        }),
        {} as Record<string, string>
      );
  }
}

export default CookieStorage;
