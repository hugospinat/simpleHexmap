import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getServerHealthSnapshot,
  getServerMetricsSnapshot,
} from "../services/serverTelemetry.js";
import { sendJson } from "./httpHelpers.js";

export async function handleMonitoringRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (url.pathname === "/healthz" && request.method === "GET") {
    sendJson(response, 200, getServerHealthSnapshot());
    return true;
  }

  if (url.pathname === "/metrics" && request.method === "GET") {
    sendJson(response, 200, getServerMetricsSnapshot());
    return true;
  }

  return false;
}
