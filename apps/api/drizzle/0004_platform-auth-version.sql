ALTER TABLE "dealers" ADD COLUMN "auth_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "auth_version" integer DEFAULT 0 NOT NULL;