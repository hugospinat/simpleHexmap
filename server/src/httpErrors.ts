import { ZodError } from "zod";
import { AppError } from "./errors.js";

const errorStatusMap: Record<string, number> = {
  "Authentication required.": 401,
  "Invalid username or password.": 401,
  "Username is already taken.": 409,
  "Workspace not found.": 404,
  "Map not found.": 404,
  "GM access denied.": 403,
  "Owner access denied.": 403,
  "Cannot remove the workspace owner.": 409,
  "Cannot change the workspace owner role.": 409,
  "Workspace member not found.": 404,
  "User not found.": 404,
  "User is already in this workspace.": 409,
  "Invalid workspace role.": 400,
  "Invalid workspace invite role.": 400,
  "Invalid workspace invite max uses.": 400,
  "Invalid workspace invite expiration.": 400,
  "Username is required.": 400,
  "Invite link not found.": 404,
  "Invite link has expired.": 409,
  "Invite link has been revoked.": 409,
  "Invite link has reached its usage limit.": 409,
  "Workspace invite not found.": 404,
  "Invalid JSON body.": 400,
  "Request body too large.": 413,
  "Request origin denied.": 403,
  "Too many requests.": 429,
};

export function resolveHttpErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (error instanceof AppError) {
    return error.statusCode;
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    Number.isInteger((error as { statusCode?: number }).statusCode)
  ) {
    return Number((error as { statusCode: number }).statusCode);
  }

  const message = error instanceof Error ? error.message : "";
  return errorStatusMap[message] ?? 500;
}

export function resolveHttpErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  return error instanceof Error ? error.message : "Unexpected error.";
}
