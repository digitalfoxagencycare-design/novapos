CREATE TYPE "public"."dealer_allocation_status" AS ENUM('active', 'exhausted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."dealer_commission_status" AS ENUM('accrued', 'settled', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."dealer_payout_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."dealer_tier" AS ENUM('silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."store_health_status" AS ENUM('healthy', 'idle', 'at_risk', 'churned');--> statement-breakpoint
CREATE TYPE "public"."telemetry_event_type" AS ENUM('landing_visit', 'pricing_view', 'trial_signup', 'trial_converted', 'pos_activated', 'store_churned');--> statement-breakpoint
CREATE TABLE "dealer_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"granted_seats" integer NOT NULL,
	"consumed_seats" integer DEFAULT 0 NOT NULL,
	"remaining_seats" integer GENERATED ALWAYS AS (granted_seats - consumed_seats) STORED,
	"status" "dealer_allocation_status" DEFAULT 'active' NOT NULL,
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "dealer_commission_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"activation_id" uuid NOT NULL,
	"gross_amount_minor" integer NOT NULL,
	"commission_rate" numeric(5, 4) NOT NULL,
	"commission_amount_minor" integer NOT NULL,
	"period_month" text NOT NULL,
	"status" "dealer_commission_status" DEFAULT 'accrued' NOT NULL,
	"payout_id" uuid,
	"accrued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text
);
--> statement-breakpoint
CREATE TABLE "dealer_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"gross_commission_minor" integer NOT NULL,
	"adjustments_minor" integer DEFAULT 0 NOT NULL,
	"net_payable_minor" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "dealer_payout_status" DEFAULT 'pending' NOT NULL,
	"utr_reference" text,
	"bank_account_mask" text,
	"settled_at" timestamp with time zone,
	"settled_by" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_store_attribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid,
	"onboarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"is_active_paid" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "telemetry_event_type" NOT NULL,
	"session_id" text,
	"visitor_id" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"country" text,
	"city" text,
	"referrer" text,
	"device_type" text,
	"path" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_health_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"last_bill_at" timestamp with time zone,
	"bills_last_24h" integer DEFAULT 0 NOT NULL,
	"bills_last_72h" integer DEFAULT 0 NOT NULL,
	"health_status" "store_health_status" DEFAULT 'healthy' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dealer_allocations" ADD CONSTRAINT "dealer_allocations_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_commission_entries" ADD CONSTRAINT "dealer_commission_entries_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_commission_entries" ADD CONSTRAINT "dealer_commission_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_commission_entries" ADD CONSTRAINT "dealer_commission_entries_activation_id_license_activations_id_fk" FOREIGN KEY ("activation_id") REFERENCES "public"."license_activations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_commission_entries" ADD CONSTRAINT "dealer_commission_entries_payout_id_dealer_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."dealer_payouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_payouts" ADD CONSTRAINT "dealer_payouts_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_store_attribution" ADD CONSTRAINT "dealer_store_attribution_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_store_attribution" ADD CONSTRAINT "dealer_store_attribution_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_store_attribution" ADD CONSTRAINT "dealer_store_attribution_allocation_id_dealer_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."dealer_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_health_snapshots" ADD CONSTRAINT "store_health_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dealer_allocations_dealer_idx" ON "dealer_allocations" USING btree ("dealer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_commission_activation_uq" ON "dealer_commission_entries" USING btree ("activation_id");--> statement-breakpoint
CREATE INDEX "dealer_commission_dealer_period_idx" ON "dealer_commission_entries" USING btree ("dealer_id","period_month");--> statement-breakpoint
CREATE INDEX "dealer_commission_payout_idx" ON "dealer_commission_entries" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_payouts_dealer_period_uq" ON "dealer_payouts" USING btree ("dealer_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "dealer_payouts_status_idx" ON "dealer_payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_payouts_utr_uq" ON "dealer_payouts" USING btree ("utr_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_store_attribution_tenant_uq" ON "dealer_store_attribution" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dealer_store_attribution_cohort_idx" ON "dealer_store_attribution" USING btree ("dealer_id","onboarded_at");--> statement-breakpoint
CREATE INDEX "platform_telemetry_event_idx" ON "platform_telemetry" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "platform_telemetry_source_idx" ON "platform_telemetry" USING btree ("utm_source");--> statement-breakpoint
CREATE UNIQUE INDEX "store_health_snapshots_tenant_uq" ON "store_health_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "store_health_snapshots_status_idx" ON "store_health_snapshots" USING btree ("health_status");--> statement-breakpoint
INSERT INTO "dealer_store_attribution" ("dealer_id", "tenant_id", "trial_ends_at", "converted_at", "is_active_paid")
SELECT t.dealer_id, t.id,
  CASE WHEN t.settings #>> '{subscription,status}' = 'TRIAL'
    THEN NULLIF(t.settings #>> '{subscription,validUntil}', '')::timestamptz ELSE NULL END,
  (SELECT min(a.created_at) FROM license_activations a WHERE a.tenant_id = t.id AND a.action = 'ACTIVATE'),
  COALESCE(t.settings #>> '{subscription,status}' = 'ACTIVE', false)
    AND COALESCE(NULLIF(t.settings #>> '{subscription,validUntil}', '')::timestamptz > now(), false)
FROM tenants t
WHERE t.dealer_id IS NOT NULL AND t.deleted_at IS NULL
ON CONFLICT (tenant_id) DO NOTHING;--> statement-breakpoint
INSERT INTO "dealer_commission_entries"
  ("dealer_id", "tenant_id", "activation_id", "gross_amount_minor", "commission_rate", "commission_amount_minor", "period_month")
SELECT a.dealer_id, a.tenant_id, a.id, a.amount_minor,
  CASE WHEN a.amount_minor > 0 THEN round(a.commission_minor::numeric / a.amount_minor, 4) ELSE 0 END,
  a.commission_minor, to_char(a.created_at, 'YYYY-MM')
FROM license_activations a
WHERE a.dealer_id IS NOT NULL AND a.action = 'ACTIVATE'
ON CONFLICT (activation_id) DO NOTHING;