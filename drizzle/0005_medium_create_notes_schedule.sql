CREATE TABLE "create_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"submission_key" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "recurring_invoice_templates" ADD COLUMN "schedule_anchor_date" date;--> statement-breakpoint
ALTER TABLE "create_submissions" ADD CONSTRAINT "create_submissions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "create_submissions_identity_idx" ON "create_submissions" USING btree ("business_id","operation","submission_key");