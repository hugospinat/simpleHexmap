CREATE TABLE "faction_territories" (
	"map_id" uuid NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"faction_id" text NOT NULL,
	CONSTRAINT "faction_territories_map_id_q_r_pk" PRIMARY KEY("map_id","q","r")
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" text PRIMARY KEY NOT NULL,
	"map_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" text PRIMARY KEY NOT NULL,
	"map_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"visibility" text NOT NULL,
	"override_terrain_tile" integer NOT NULL,
	"gm_label" text,
	"player_label" text,
	"label_revealed" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hex_cells" (
	"map_id" uuid NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"terrain" text NOT NULL,
	"hidden" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "hex_cells_map_id_q_r_pk" PRIMARY KEY("map_id","q","r")
);
--> statement-breakpoint
CREATE TABLE "map_members" (
	"map_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "map_members_map_id_user_id_pk" PRIMARY KEY("map_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "map_tokens" (
	"map_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	CONSTRAINT "map_tokens_map_id_user_id_pk" PRIMARY KEY("map_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid,
	"legacy_id" text,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"next_sequence" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "op_log" (
	"map_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"operation_id" text NOT NULL,
	"source_client_id" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"operation" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "op_log_map_id_sequence_pk" PRIMARY KEY("map_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "rivers" (
	"map_id" uuid NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"edge" integer NOT NULL,
	CONSTRAINT "rivers_map_id_q_r_edge_pk" PRIMARY KEY("map_id","q","r","edge")
);
--> statement-breakpoint
CREATE TABLE "roads" (
	"map_id" uuid NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"edges" integer[] NOT NULL,
	CONSTRAINT "roads_map_id_q_r_pk" PRIMARY KEY("map_id","q","r")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"username" text NOT NULL,
	"username_normalized" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_member_tokens" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"color" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workspace_member_tokens_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faction_territories" ADD CONSTRAINT "faction_territories_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_territories" ADD CONSTRAINT "faction_territories_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hex_cells" ADD CONSTRAINT "hex_cells_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_members" ADD CONSTRAINT "map_members_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_members" ADD CONSTRAINT "map_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_tokens" ADD CONSTRAINT "map_tokens_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_tokens" ADD CONSTRAINT "map_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "op_log" ADD CONSTRAINT "op_log_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "op_log" ADD CONSTRAINT "op_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivers" ADD CONSTRAINT "rivers_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roads" ADD CONSTRAINT "roads_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member_tokens" ADD CONSTRAINT "workspace_member_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member_tokens" ADD CONSTRAINT "workspace_member_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faction_territories_faction_id_idx" ON "faction_territories" USING btree ("faction_id");--> statement-breakpoint
CREATE INDEX "factions_map_id_idx" ON "factions" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "features_map_hex_idx" ON "features" USING btree ("map_id","q","r");--> statement-breakpoint
CREATE INDEX "features_map_id_idx" ON "features" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "hex_cells_map_hex_idx" ON "hex_cells" USING btree ("map_id","q","r");--> statement-breakpoint
CREATE INDEX "map_members_user_id_idx" ON "map_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "map_tokens_map_id_idx" ON "map_tokens" USING btree ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX "maps_legacy_id_unique" ON "maps" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "maps_owner_user_id_idx" ON "maps" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "maps_workspace_id_idx" ON "maps" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "op_log_map_operation_id_unique" ON "op_log" USING btree ("map_id","operation_id");--> statement-breakpoint
CREATE INDEX "op_log_map_sequence_idx" ON "op_log" USING btree ("map_id","sequence");--> statement-breakpoint
CREATE INDEX "rivers_map_hex_idx" ON "rivers" USING btree ("map_id","q","r");--> statement-breakpoint
CREATE INDEX "roads_map_hex_idx" ON "roads" USING btree ("map_id","q","r");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_normalized_unique" ON "users" USING btree ("username_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "users_legacy_id_unique" ON "users" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "workspace_member_tokens_user_id_idx" ON "workspace_member_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_owner_user_id_idx" ON "workspaces" USING btree ("owner_user_id");