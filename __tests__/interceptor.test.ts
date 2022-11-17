import axios from "axios";

import MemoryStorage from "@/adapters/memory-storage";
import AxiosJwt from "@/index";

const STORAGE_KEY = "token-storage-key";
const memoryStorage = new MemoryStorage();
const tokenInterceptor = new AxiosJwt({
  storage: memoryStorage,
  requestRefresh: async tokens => tokens,
  options: {
    storageKey: STORAGE_KEY,
  },
});

beforeAll(() => {
  tokenInterceptor.clearTokens();
});

test("add the interceptor to the axios instance", () => {
  const interceptors = axios.interceptors.request as any;
  expect(interceptors.handlers).toHaveLength(0);

  tokenInterceptor.apply(axios);
  expect(interceptors.handlers).toHaveLength(1);
});

test("clear auth tokens", () => {
  memoryStorage.setItem(STORAGE_KEY, {
    accessToken: "string",
    refreshToken: "string",
  });

  expect(tokenInterceptor.tokens).toBeTruthy();
  expect(tokenInterceptor.tokens).toStrictEqual({
    accessToken: "string",
    refreshToken: "string",
  });

  tokenInterceptor.clearTokens();

  expect(memoryStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(tokenInterceptor.tokens).toBeUndefined();
});

test("set auth tokens", () => {
  tokenInterceptor.tokens = {
    accessToken: "accessToken",
    refreshToken: "refreshToken",
  };

  const tokens = JSON.parse(memoryStorage.getItem(STORAGE_KEY) ?? "null");

  expect(memoryStorage.getItem(STORAGE_KEY)).toBeTruthy();
  expect(tokens).toHaveProperty("refreshToken");
  expect(tokens).toHaveProperty("accessToken");
});

test("check if is logged in", () => {
  const result = tokenInterceptor.isLoggedIn;
  expect(result).toBe(true);
});
