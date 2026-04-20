import { WebSocket } from "ws";

const defaultPassword = "smoke-test-password";

function assertOk(response, label) {
  if (response.ok) {
    return;
  }

  throw new Error(`${label} failed with status ${response.status}`);
}

function buildJsonRequest(body) {
  return {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  };
}

function extractSessionCookie(response) {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Missing session cookie.");
  }

  return setCookie.split(";", 1)[0];
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function createSmokeAccount(baseUrl, prefix) {
  const username = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await fetch(`${baseUrl}/api/auth/signup`, buildJsonRequest({
    password: defaultPassword,
    username,
  }));

  assertOk(response, "signup");
  const payload = await response.json();

  return {
    cookie: extractSessionCookie(response),
    user: payload.user,
    username,
  };
}

export async function fetchJson(baseUrl, cookie, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Cookie: cookie,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : `${path} failed with status ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

export async function createWorkspace(baseUrl, cookie, name) {
  const payload = await fetchJson(baseUrl, cookie, "/api/workspaces", {
    body: JSON.stringify({ name }),
    method: "POST",
  });

  return payload.workspace;
}

export async function createWorkspaceMap(baseUrl, cookie, workspaceId, name) {
  const payload = await fetchJson(
    baseUrl,
    cookie,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/maps`,
    {
      body: JSON.stringify({ name }),
      method: "POST",
    },
  );

  return payload.map;
}

export async function addWorkspaceMember(baseUrl, cookie, workspaceId, username, role) {
  return fetchJson(
    baseUrl,
    cookie,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/members`,
    {
      body: JSON.stringify({ role, username }),
      method: "POST",
    },
  );
}

export async function deleteWorkspace(baseUrl, cookie, workspaceId) {
  return fetchJson(
    baseUrl,
    cookie,
    `/api/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" },
  );
}

export async function loadMap(baseUrl, cookie, mapId, role = "gm") {
  const payload = await fetchJson(
    baseUrl,
    cookie,
    `/api/maps/${encodeURIComponent(mapId)}?role=${encodeURIComponent(role)}`,
    { method: "GET" },
  );

  return payload.map;
}

export async function exportMap(baseUrl, cookie, mapId) {
  return fetchJson(
    baseUrl,
    cookie,
    `/api/maps/${encodeURIComponent(mapId)}/export`,
    { method: "GET" },
  );
}

export function connectMapSocket(baseUrl, cookie, mapId) {
  const wsUrl = `${baseUrl.replace(/^http/, "ws")}/api/maps/${encodeURIComponent(mapId)}/ws`;

  return withTimeout(
    new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl, {
        headers: { Cookie: cookie },
      });

      socket.once("open", () => resolve(socket));
      socket.once("error", reject);
    }),
    5000,
    "WebSocket connect",
  );
}

export function waitForClose(socket, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("WebSocket close timeout"));
    }, timeoutMs);

    socket.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }

  const closePromise = new Promise((resolve) => {
    socket.once("close", () => resolve());
  });

  socket.close(1000, "done");

  try {
    await withTimeout(closePromise, 1500, "socket close");
  } catch {
    socket.terminate();
  }
}