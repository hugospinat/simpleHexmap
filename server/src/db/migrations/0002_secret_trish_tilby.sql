CREATE TABLE "map_notes" (
	"map_id" uuid NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"markdown" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "map_notes_map_id_q_r_pk" PRIMARY KEY("map_id","q","r")
);
--> statement-breakpoint
ALTER TABLE "map_notes" ADD CONSTRAINT "map_notes_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "map_notes_map_id_idx" ON "map_notes" USING btree ("map_id");
