ALTER TABLE "map_notes" ALTER COLUMN "markdown" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "map_notes" ADD COLUMN "gm_title" text;--> statement-breakpoint
ALTER TABLE "map_notes" ADD COLUMN "player_title" text;