CREATE TYPE "public"."user_role" AS ENUM('admin', 'client', 'sales_rep', 'team_member');--> statement-breakpoint
CREATE TABLE "call_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"fathom_url" text,
	"title" text NOT NULL,
	"tldr" text,
	"decisions_locked" jsonb,
	"action_items" jsonb,
	"call_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand_color" text DEFAULT '#A0703C' NOT NULL,
	"notion_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "eod_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setter_user_id" uuid NOT NULL,
	"submission_date" date NOT NULL,
	"outbound" integer DEFAULT 0 NOT NULL,
	"inbound" integer DEFAULT 0 NOT NULL,
	"follow_ups" integer DEFAULT 0 NOT NULL,
	"total_convos" integer DEFAULT 0 NOT NULL,
	"calls_pitched" integer DEFAULT 0 NOT NULL,
	"calls_booked" integer DEFAULT 0 NOT NULL,
	"qualified_booked" integer DEFAULT 0 NOT NULL,
	"calls_declined" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cash_collected" numeric(12, 2) DEFAULT '0' NOT NULL,
	"performance_rating" integer,
	"skill_rating" integer,
	"went_well" text,
	"gone_better" text,
	"tomorrow_different" text,
	"lead_quality" text,
	"bottleneck" text,
	"top_objection" text,
	"objection_other" text,
	"missed_anything" text,
	"manager_request" text,
	"accuracy_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_weekly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"targets" jsonb,
	"actuals" jsonb
);
--> statement-breakpoint
CREATE TABLE "module_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"video_url" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "call_recaps" ADD CONSTRAINT "call_recaps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eod_submissions" ADD CONSTRAINT "eod_submissions_setter_user_id_users_id_fk" FOREIGN KEY ("setter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_weekly" ADD CONSTRAINT "kpi_weekly_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_recaps_client_date_idx" ON "call_recaps" USING btree ("client_id","call_date");--> statement-breakpoint
CREATE INDEX "eod_setter_date_idx" ON "eod_submissions" USING btree ("setter_user_id","submission_date");--> statement-breakpoint
CREATE INDEX "users_client_id_idx" ON "users" USING btree ("client_id");