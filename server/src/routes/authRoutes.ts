import {
  getAuthContext,
  loginUserFromRequest,
  logoutUser,
  signupUserFromRequest,
} from "../services/authService.js";
import { readBody, sendJson } from "./httpHelpers.js";

export async function handleAuthRequest(request, response, url): Promise<boolean> {
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const context = await getAuthContext(request);

    if (!context) {
      sendJson(response, 401, { error: "Authentication required." });
      return true;
    }

    sendJson(response, 200, {
      user: {
        id: context.user.id,
        username: context.user.username,
        createdAt: context.user.createdAt.toISOString(),
        updatedAt: context.user.updatedAt.toISOString(),
      },
    });
    return true;
  }

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    const user = await signupUserFromRequest(request, await readBody(request), response);
    sendJson(response, 201, { user });
    return true;
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const user = await loginUserFromRequest(request, await readBody(request), response);
    sendJson(response, 200, { user });
    return true;
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    await logoutUser(request, response);
    sendJson(response, 200, { ok: true });
    return true;
  }

  return false;
}
