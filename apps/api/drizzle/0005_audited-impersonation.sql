CREATE TABLE "impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_admin_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"target_staff_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_id" uuid,
	"impersonation_session_id" uuid,
	"tenant_id" uuid,
	"action" text NOT NULL,
	"request_id" text,
	"method" text,
	"path" text,
	"reason" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_staff_id_staff_id_fk" FOREIGN KEY ("target_staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_admin_id_platform_admins_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_impersonation_session_id_impersonation_sessions_id_fk" FOREIGN KEY ("impersonation_session_id") REFERENCES "public"."impersonation_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impersonation_sessions_admin_idx" ON "impersonation_sessions" USING btree ("platform_admin_id","created_at");--> statement-breakpoint
CREATE INDEX "impersonation_sessions_tenant_idx" ON "impersonation_sessions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "platform_audit_logs_admin_idx" ON "platform_audit_logs" USING btree ("actor_admin_id","created_at");--> statement-breakpoint
CREATE INDEX "platform_audit_logs_tenant_idx" ON "platform_audit_logs" USING btree ("tenant_id","created_at");