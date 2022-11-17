# Axios JWT

> A porting of the original `jetbridge/axios-jwt` with support to custom storage and ssr.

## Installation

```sh
  npm install @aquacloud/axios-jwt
```

## Usage

```ts
// api.ts

import AxiosJwt from "@aquacloud/axios-jwt";
import CookieStorage from "@aquacloud/axios-jwt/adapters/cookie-storage";
import axios from "axios";

// Create an axios instance
export const api = axios.create({ baseURL: "http://localhost:8080/api" });

// Initialize the class
export const tokenInterceptor = new AxiosJwt({
    requestRefresh,
    // just an object that implements the web Storage interface
    storage: new CookieStorage(), // or window.localStorage, window.sessionStorage
    options: {
        header: "Authorization",
        headerPrefix: "Bearer ", // NOTE: must include the space
        // Value can be number (milliseconds) or string (see more at https://github.com/vercel/ms)
        leeway: "10s",
    },
});

// Apply the interceptor
tokenInterceptor.apply(api);

// or apply manually
api.interceptors.request.use(tokenInterceptor.interceptor);
```

## Login / Logout

```ts
// auth.ts

import { tokenInterceptor, api } from "./api";

const login = async (username: string, password: string) => {
    const response = await api.post("/auth/sign-in", { username, password });

    tokenInterceptor.accessToken = response.data.accessToken;
    tokenInterceptor.refreshToken = response.data.refreshToken;

    // or
    tokenInterceptor.tokens = response.data;
};
```

The following example is a simple react implementation. It can be used with any framework.

```tsx
// Profile.tsx
import { useState } from "react";
import { api } from "./api";

function Profile() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        api.get("/users/me").then(response => setUser(response.data));
    }, []);

    if (!tokenInterceptor.isLoggedIn || !user) return null;

    return (
        <div>
            {user.firstName} {user.lastName}
        </div>
    );
}
```

## Utilities

```ts
import { tokenInterceptor } from "./api";

tokenInterceptor.isLoggedIn; // check if is logged in
tokenInterceptor.accessToken; // read-write accessToken
tokenInterceptor.refreshToken; // read-write refreshToken
tokenInterceptor.clearTokens(); // sets `accessToken` and `refreshToken` to undefined
```
