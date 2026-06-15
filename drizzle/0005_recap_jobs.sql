CREATE TABLE "recap_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"fathom_ref" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid,
	"recap_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recap_jobs" ADD CONSTRAINT "recap_jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recap_jobs" ADD CONSTRAINT "recap_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recap_jobs" ADD CONSTRAINT "recap_jobs_recap_id_call_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."call_recaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recap_jobs_status_idx" ON "recap_jobs" USING btree ("status","created_at");