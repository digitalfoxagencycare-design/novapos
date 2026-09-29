CREATE TABLE "dealers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"dealer_code" text NOT NULL,
	"commission_percent" integer DEFAULT 20 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dealers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "dealers_email_unique" UNIQUE("email"),
	CONSTRAINT "dealers_dealer_code_unique" UNIQUE("dealer_code")
);
--> statement-breakpoint
CREATE TABLE "license_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"dealer_id" uuid,
	"actor_id" uuid NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"plan" text NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"commission_minor" integer DEFAULT 0 NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'SUPER_ADMIN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_email_unique" UNIQUE("email"),
	CONSTRAINT "platform_admins_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "dealer_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "dealer_code" text;--> statement-breakpoint
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Credentials have no tenant policy. Only the privileged server connection may read them.
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;
REVOKE ALL ON dealers, platform_admins FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON dealers, platform_admins, license_activations FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON dealers, platform_admins, license_activations FROM authenticated; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'novapos_admin') THEN GRANT ALL ON dealers, platform_admins, license_activations TO novapos_admin; END IF;
END $$;

