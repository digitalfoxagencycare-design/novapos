CREATE TYPE "public"."discount_type" AS ENUM('PERCENT', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."kot_kind" AS ENUM('NEW', 'MODIFIED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."kot_line_change" AS ENUM('NEW', 'ADDED', 'VOIDED', 'QTY_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."kot_status" AS ENUM('PLACED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QUICK_BILL');--> statement-breakpoint
CREATE TYPE "public"."order_line_status" AS ENUM('PENDING', 'FIRED', 'READY', 'SERVED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'OPEN', 'BILLED', 'PAID', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'CREDIT', 'VOUCHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."print_job_status" AS ENUM('QUEUED', 'PRINTING', 'DONE', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."print_job_type" AS ENUM('RECEIPT', 'KOT', 'KOT_CANCEL', 'REPORT', 'DRAWER_KICK');--> statement-breakpoint
CREATE TYPE "public"."printer_connection" AS ENUM('NETWORK', 'BLUETOOTH', 'USB', 'BROWSER');--> statement-breakpoint
CREATE TYPE "public"."printer_role" AS ENUM('RECEIPT', 'KOT', 'REPORT', 'LABEL');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN');--> statement-breakpoint
CREATE TYPE "public"."station_mode" AS ENUM('PRINT', 'SCREEN', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_reason" AS ENUM('SALE', 'VOID_RESTOCK', 'PURCHASE', 'WASTAGE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('FREE', 'OCCUPIED', 'RESERVED', 'BILLED', 'CLEANING');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('ACTIVE', 'SUSPENDED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid,
	"staff_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"colour" text,
	"station_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"tax_id" text,
	"is_business" boolean DEFAULT false NOT NULL,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"address_lines" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"city" text,
	"region" text,
	"country" text,
	"postal_code" text,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"consent" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"anonymised_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_body" jsonb NOT NULL,
	"status_code" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit" text DEFAULT 'unit' NOT NULL,
	"reorder_level" numeric(12, 3) DEFAULT '0' NOT NULL,
	"cost_minor" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"period" text NOT NULL,
	"prefix" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kot_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kot_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"previous_quantity" numeric(10, 3),
	"modifiers_snapshot" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notes" text,
	"change" "kot_line_change" DEFAULT 'NEW' NOT NULL,
	"status" "kot_status" DEFAULT 'PLACED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"kot_number" text NOT NULL,
	"kind" "kot_kind" DEFAULT 'NEW' NOT NULL,
	"status" "kot_status" DEFAULT 'PLACED' NOT NULL,
	"pushed_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"preparing_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"served_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"reprint_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifier_groups" (
	"item_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "menu_item_modifier_groups_item_id_group_id_pk" PRIMARY KEY("item_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "menu_item_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_minor" integer,
	"price_delta_minor" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"code" text,
	"price_minor" integer NOT NULL,
	"channel_prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tax_slab_id" text NOT NULL,
	"hsn_sac" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"station_id" uuid,
	"tracks_stock" boolean DEFAULT false NOT NULL,
	"is_veg" boolean,
	"prep_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_line_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"modifier_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"price_minor" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"client_line_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"variant_id" uuid,
	"name_snapshot" text NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"modifiers_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(12, 4),
	"line_total_minor" integer NOT NULL,
	"tax_slab_id" text NOT NULL,
	"hsn_sac" text,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"tax_snapshot" jsonb,
	"notes" text,
	"station_id" uuid,
	"status" "order_line_status" DEFAULT 'PENDING' NOT NULL,
	"fired_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_tables" (
	"order_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	CONSTRAINT "order_tables_order_id_table_id_pk" PRIMARY KEY("order_id","table_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"client_order_id" text NOT NULL,
	"order_number" text NOT NULL,
	"channel" "order_channel" NOT NULL,
	"status" "order_status" DEFAULT 'DRAFT' NOT NULL,
	"staff_id" uuid,
	"customer_id" uuid,
	"shift_id" uuid,
	"guest_count" integer,
	"notes" text,
	"currency" text NOT NULL,
	"subtotal_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"service_charge_minor" integer DEFAULT 0 NOT NULL,
	"delivery_charge_minor" integer DEFAULT 0 NOT NULL,
	"tip_minor" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"rounding_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"paid_minor" integer DEFAULT 0 NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(12, 4),
	"discount_reason" text,
	"tax_snapshot" jsonb,
	"tax_rule_set_key" text,
	"invoice_number" text,
	"billed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_writer_id" uuid
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address_lines" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"city" text,
	"region" text,
	"country" text DEFAULT 'IN' NOT NULL,
	"postal_code" text,
	"phone" text,
	"tax_id" text,
	"extra_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"locale" text,
	"currency" text,
	"timezone" text,
	"tax_rule_set_key" text,
	"receipt_template_id" text DEFAULT 'in-gst' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"service_charge_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"client_payment_id" text NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'CAPTURED' NOT NULL,
	"amount_minor" integer NOT NULL,
	"tendered_minor" integer,
	"change_minor" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"gateway" text DEFAULT 'cash' NOT NULL,
	"gateway_ref" text,
	"reference" text,
	"gateway_payload" jsonb,
	"refunded_minor" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"captured_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"printer_id" uuid,
	"order_id" uuid,
	"kot_id" uuid,
	"type" "print_job_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "print_job_status" DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"station_id" uuid,
	"name" text NOT NULL,
	"profile_id" text DEFAULT 'generic-80' NOT NULL,
	"connection" "printer_connection" NOT NULL,
	"address" text,
	"port" integer DEFAULT 9100 NOT NULL,
	"role" "printer_role" DEFAULT 'RECEIPT' NOT NULL,
	"copies" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(12, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"section_id" uuid,
	"label" text NOT NULL,
	"seats" integer DEFAULT 4 NOT NULL,
	"status" "table_status" DEFAULT 'FREE' NOT NULL,
	"pos_x" integer DEFAULT 0 NOT NULL,
	"pos_y" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 1 NOT NULL,
	"height" integer DEFAULT 1 NOT NULL,
	"shape" text DEFAULT 'rect' NOT NULL,
	"merged_into_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opening_float_minor" integer DEFAULT 0 NOT NULL,
	"counted_cash_minor" integer,
	"expected_cash_minor" integer,
	"variance_minor" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid,
	"email" text,
	"phone" text,
	"name" text NOT NULL,
	"password_hash" text,
	"pin_hash" text,
	"role" "staff_role" NOT NULL,
	"extra_permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"mode" "station_mode" DEFAULT 'BOTH' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"reason" "stock_movement_reason" NOT NULL,
	"reference_id" uuid,
	"note" text,
	"staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"country" text NOT NULL,
	"definition" jsonb NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tax_id" text,
	"country" text DEFAULT 'IN' NOT NULL,
	"default_locale" text DEFAULT 'en-IN' NOT NULL,
	"default_currency" text DEFAULT 'INR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"tax_rule_set_key" text DEFAULT 'IN-GST' NOT NULL,
	"status" "tenant_status" DEFAULT 'ACTIVE' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kot_lines" ADD CONSTRAINT "kot_lines_kot_id_kots_id_fk" FOREIGN KEY ("kot_id") REFERENCES "public"."kots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kot_lines" ADD CONSTRAINT "kot_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kots" ADD CONSTRAINT "kots_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kots" ADD CONSTRAINT "kots_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_modifiers" ADD CONSTRAINT "order_line_modifiers_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_modifiers" ADD CONSTRAINT "order_line_modifiers_modifier_id_modifiers_id_fk" FOREIGN KEY ("modifier_id") REFERENCES "public"."modifiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_menu_item_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."menu_item_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tables" ADD CONSTRAINT "order_tables_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tables" ADD CONSTRAINT "order_tables_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_kot_id_kots_id_fk" FOREIGN KEY ("kot_id") REFERENCES "public"."kots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_section_id_table_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."table_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sections" ADD CONSTRAINT "table_sections_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rule_sets" ADD CONSTRAINT "tax_rule_sets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_entity_idx" ON "audit_logs" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_code_key" ON "categories" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "categories_tenant_idx" ON "categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_phone_key" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_tenant_key_key" ON "idempotency_records" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "idempotency_records_expiry_idx" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_tenant_sku_key" ON "inventory_items" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "inventory_items_tenant_idx" ON "inventory_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_sequences_outlet_period_prefix_key" ON "invoice_sequences" USING btree ("outlet_id","period","prefix");--> statement-breakpoint
CREATE INDEX "kot_lines_kot_idx" ON "kot_lines" USING btree ("kot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kots_tenant_number_key" ON "kots" USING btree ("tenant_id","kot_number");--> statement-breakpoint
CREATE INDEX "kots_tenant_station_status_idx" ON "kots" USING btree ("tenant_id","station_id","status");--> statement-breakpoint
CREATE INDEX "kots_order_idx" ON "kots" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "menu_item_variants_item_idx" ON "menu_item_variants" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_tenant_code_key" ON "menu_items" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "menu_items_tenant_category_idx" ON "menu_items" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_tenant_idx" ON "modifier_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "modifiers_group_idx" ON "modifiers" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "order_line_modifiers_line_idx" ON "order_line_modifiers" USING btree ("order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_lines_order_client_line_key" ON "order_lines" USING btree ("order_id","client_line_id");--> statement-breakpoint
CREATE INDEX "order_lines_tenant_order_idx" ON "order_lines" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_client_order_key" ON "orders" USING btree ("tenant_id","client_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_outlet_order_number_key" ON "orders" USING btree ("outlet_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_invoice_key" ON "orders" USING btree ("tenant_id","invoice_number");--> statement-breakpoint
CREATE INDEX "orders_tenant_outlet_status_idx" ON "orders" USING btree ("tenant_id","outlet_id","status");--> statement-breakpoint
CREATE INDEX "orders_tenant_outlet_created_idx" ON "orders" USING btree ("tenant_id","outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_outlet_updated_idx" ON "orders" USING btree ("outlet_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_tenant_code_key" ON "outlets" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "outlets_tenant_idx" ON "outlets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tenant_client_payment_key" ON "payments" USING btree ("tenant_id","client_payment_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_order_idx" ON "payments" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "payments_gateway_ref_idx" ON "payments" USING btree ("gateway_ref");--> statement-breakpoint
CREATE INDEX "print_jobs_tenant_status_next_idx" ON "print_jobs" USING btree ("tenant_id","status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "print_jobs_outlet_status_idx" ON "print_jobs" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "printers_tenant_outlet_idx" ON "printers" USING btree ("tenant_id","outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_components_item_inventory_key" ON "recipe_components" USING btree ("item_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_staff_idx" ON "refresh_tokens" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_tables_outlet_label_key" ON "restaurant_tables" USING btree ("outlet_id","label");--> statement-breakpoint
CREATE INDEX "restaurant_tables_tenant_outlet_idx" ON "restaurant_tables" USING btree ("tenant_id","outlet_id");--> statement-breakpoint
CREATE INDEX "shifts_tenant_outlet_opened_idx" ON "shifts" USING btree ("tenant_id","outlet_id","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_tenant_email_key" ON "staff" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "staff_tenant_outlet_idx" ON "staff" USING btree ("tenant_id","outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_outlet_code_key" ON "stations" USING btree ("outlet_id","code");--> statement-breakpoint
CREATE INDEX "stations_tenant_outlet_idx" ON "stations" USING btree ("tenant_id","outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_levels_outlet_item_key" ON "stock_levels" USING btree ("outlet_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "stock_levels_tenant_idx" ON "stock_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_outlet_created_idx" ON "stock_movements" USING btree ("tenant_id","outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "table_sections_outlet_idx" ON "table_sections" USING btree ("outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rule_sets_tenant_key_from_key" ON "tax_rule_sets" USING btree ("tenant_id","key","effective_from");--> statement-breakpoint
CREATE INDEX "tax_rule_sets_tenant_idx" ON "tax_rule_sets" USING btree ("tenant_id");