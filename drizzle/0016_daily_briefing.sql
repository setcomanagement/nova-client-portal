CREATE TABLE "daily_briefing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"briefing_date" date NOT NULL,
	"sections" jsonb NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_briefing_briefing_date_unique" UNIQUE("briefing_date")
);
