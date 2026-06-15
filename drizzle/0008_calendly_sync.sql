ALTER TABLE "bookings" ADD COLUMN "calendly_event_uri" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "calendly_invitee_uri" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_calendly_invitee_uri_unique" UNIQUE("calendly_invitee_uri");