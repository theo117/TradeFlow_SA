ALTER TABLE "invoices" ADD COLUMN "recurring_template_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recurring_period" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_template_id_recurring_invoice_templates_id_fk" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."recurring_invoice_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_recurring_template_period_idx" ON "invoices" USING btree ("recurring_template_id","recurring_period");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_identity_check" CHECK (("invoices"."recurring_template_id" is null) = ("invoices"."recurring_period" is null));