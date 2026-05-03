import { sendJson } from "./routes/httpHelpers.js";
import { handleRegisteredHttpRoute } from "./routes/httpRouteRegistry.js";
import {
  applySecurityHeaders,
  assertRequestOriginAllowed,
  isCorsPreflightAllowed,
  setCors,
} from "./security/requestSecurity.js";
import { resolveHttpErrorMessage, resolveHttpErrorStatus } from "./httpErrors.js";

export function createHttpHandler() {
  return async (request, response) => {
    applySecurityHeaders(response);
    setCors(request, response);

    if (request.method === "OPTIONS") {
      if (!isCorsPreflightAllowed(request)) {
        sendJson(response, 403, { error: "Request origin denied." });
        return;
      }

      response.statusCode = 204;
      response.end();
      return;
    }

    if (!request.url) {
      sendJson(response, 400, { error: "Missing request URL." });
      return;
    }

    const url = new URL(request.url, "http://localhost");

    try {
      assertRequestOriginAllowed(request);

      if (await handleRegisteredHttpRoute(request, response, url)) {
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      sendJson(response, resolveHttpErrorStatus(error), {
        error: resolveHttpErrorMessage(error),
      });
    }
  };
}
