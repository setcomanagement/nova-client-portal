ALTER TABLE "bookings" ADD COLUMN "invitee_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "invitee_email" text;--> statement-breakpoint
ALTER TABLE "calendly_tracked_events" ADD COLUMN "category" text DEFAULT 'sales_call' NOT NULL;