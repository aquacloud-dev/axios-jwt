# Axios JWT

> A porting of the original `jetbridge/axios-jwt` with support to custom storage and ssr.

## Installation

```sh
  npm install @aquacloud/axios-jwt
```

## Usage

```ts
import AxiosJwt from "@aquacloud/axios-jwt";
import CookieStorage from "@aquacloud/axios-jwt/adapters/cookie-storage";
import axios from "axios";

// Create an axios instance
const api = axios.create({ baseURL: "http://localhost:8080/api" });

// Initialize the class
const tokenInterceptor = new AxiosJwt({
    requestRefresh,
    storage: new CookieStorage(),
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
