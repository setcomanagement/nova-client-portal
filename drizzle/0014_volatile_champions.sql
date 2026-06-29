ALTER TABLE "leads" ADD COLUMN "pipeline_stage" text DEFAULT 'cold' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lead_type" text DEFAULT 'inbound' NOT NULL;