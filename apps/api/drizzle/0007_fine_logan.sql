ALTER TABLE "dealers" ADD COLUMN "commission_rate" numeric(5, 4) DEFAULT '0.2000' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealers" ADD COLUMN "tier" "dealer_tier" DEFAULT 'silver' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealers" ADD COLUMN "territory" text;--> statement-breakpoint
ALTER TABLE "dealers" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "dealers" ADD COLUMN "country" text DEFAULT 'IN' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealers" ADD COLUMN "onboarding_date" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "dealers" ADD COLUMN "bank_account_mask" text;--> statement-breakpoint
UPDATE "dealers" SET "commission_rate" = ("commission_percent"::numeric / 100)::numeric(5,4);