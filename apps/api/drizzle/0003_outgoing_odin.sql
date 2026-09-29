CREATE INDEX "license_activations_dealer_month_idx" ON "license_activations" USING btree ("dealer_id","created_at");--> statement-breakpoint
CREATE INDEX "tenants_dealer_code_idx" ON "tenants" USING btree ("dealer_code");--> statement-breakpoint
CREATE INDEX "tenants_dealer_id_idx" ON "tenants" USING btree ("dealer_id");--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_commission_range" CHECK ("dealers"."commission_percent" between 0 and 100);--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_status_valid" CHECK ("dealers"."status" in ('ACTIVE','SUSPENDED'));--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admin_role" CHECK ("platform_admins"."role" = 'SUPER_ADMIN');