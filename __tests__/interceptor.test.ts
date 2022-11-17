import axios from "axios";
import jwt from "jsonwebtoken";

import { MemoryStorage } from "@/adapters/MemoryStorage";
import { AxiosJwt as AxiosJwt } from "@/index";

const memoryStorage = new MemoryStorage();
const authTokens = new AxiosJwt(memoryStorage, async tokens => {
    const response = await axios.post(
        `http://localhost:3000/api/auth/refresh`,
        { tokens },
        {
            // interceptor config
            headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        }
    );

    return response.data;
});

beforeAll(() => {
    const token = jwt.sign(
        {
            exp: Date.now() + 3000,
            iat: Date.now(),
            data: { user: { id: 1 } },
        },
        "secret",
        {
            algorithm: "HS256",
        }
    );

    authTokens.clear();
    authTokens.tokens = {
        refreshToken: "my-refresh-token",
        accessToken: token,
    };
});

test("add the interceptor to the axios instance", () => {
    const interceptors = axios.interceptors.request as any;
    expect(interceptors.handlers).toHaveLength(0);

    axios.interceptors.request.use(authTokens.interceptor);
    expect(interceptors.handlers).toHaveLength(1);
});
