import { z } from "zod";

export const signupBodySchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

export const loginBodySchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

const nameSchema = z.string().transform((v) => {
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
});

export const createWorkspaceBodySchema = z.object({
  name: nameSchema.optional(),
});

export const renameWorkspaceBodySchema = z.object({
  name: nameSchema.optional(),
});

export const workspaceMemberRoleSchema = z.enum(["gm", "player"]);

export const addWorkspaceMemberBodySchema = z.object({
  role: workspaceMemberRoleSchema.optional().default("player"),
  username: z.unknown(),
});

export const updateWorkspaceMemberRoleBodySchema = z.object({
  role: workspaceMemberRoleSchema,
});

export const createMapBodySchema = z.object({
  content: z.unknown().optional(),
  name: nameSchema.optional(),
});

export const renameMapBodySchema = z.object({
  name: nameSchema.optional(),
});

export const wsMapOperationMessageSchema = z.object({
  type: z.literal("map_operation"),
  clientId: z.string().min(1),
  operation: z.record(z.string(), z.unknown()),
  operationId: z.string().min(1),
});

export const wsTokenUpdateMessageSchema = z.object({
  type: z.literal("map_token_update"),
  operation: z.record(z.string(), z.unknown()),
});
