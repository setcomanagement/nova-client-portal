CREATE TYPE "public"."social_platform" AS ENUM('youtube', 'instagram');--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"handle" text,
	"channel_id" text,
	"uploads_playlist_id" text,
	"display_name" text,
	"meta" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_client_platform" UNIQUE("client_id","platform")
);
--> statement-breakpoint
CREATE TABLE "social_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"external_id" text,
	"title" text,
	"url" text,
	"published_at" timestamp with time zone,
	"views" bigint DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"leads_gained" integer DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_content_client_external" UNIQUE("client_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "social_follower_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"captured_on" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follower_snap_client_platform_day" UNIQUE("client_id","platform","captured_on")
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_content" ADD CONSTRAINT "social_content_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_follower_snapshots" ADD CONSTRAINT "social_follower_snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_content_client_platform_idx" ON "social_content" USING btree ("client_id","platform");--> statement-breakpoint
CREATE INDEX "follower_snap_client_platform_idx" ON "social_follower_snapshots" USING btree ("client_id","platform");