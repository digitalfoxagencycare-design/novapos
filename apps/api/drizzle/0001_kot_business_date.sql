-- KOT numbers restart each business day, so uniqueness has to be scoped to the
-- day rather than to the tenant. Without this, today's K0001 collides with one
-- from last week and firing an order fails with a constraint violation.
--
-- The generated form of this migration added the column as NOT NULL with no
-- default, which cannot work on a table that already has rows. Backfill first,
-- then tighten.

ALTER TABLE "kots" ADD COLUMN IF NOT EXISTS "business_date" text;
--> statement-breakpoint

-- Existing tickets take the UTC date they were created on, which is what the
-- old daily-reset numbering was implicitly keyed to.
UPDATE "kots" SET "business_date" = to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
 WHERE "business_date" IS NULL;
--> statement-breakpoint

-- Historic rows could already hold duplicates under the old constraint, since
-- nothing prevented them. Disambiguate before adding the unique index rather
-- than letting the migration fail halfway.
WITH dupes AS (
  SELECT id, row_number() OVER (
           PARTITION BY "tenant_id", "business_date", "kot_number"
           ORDER BY "created_at"
         ) AS n
  FROM "kots"
)
UPDATE "kots" k
   SET "kot_number" = k."kot_number" || '-' || d.n
  FROM dupes d
 WHERE k.id = d.id AND d.n > 1;
--> statement-breakpoint

ALTER TABLE "kots" ALTER COLUMN "business_date" SET NOT NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS "kots_tenant_number_key";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "kots_tenant_day_number_key"
    ON "kots" USING btree ("tenant_id", "business_date", "kot_number");
