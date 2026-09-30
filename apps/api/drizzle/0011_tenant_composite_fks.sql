-- Cross-tenant references.
--
-- Row-level security hides other tenants' rows from queries, but a FOREIGN KEY check runs with the table
-- owner's rights and therefore SEES them. Verified in review: a tenant-A session could insert a row whose
-- parent belongs to tenant B. Every tenant-scoped child now references its parent by (tenant_id, id),
-- so the database itself refuses a parent from another tenant, whatever the application forgets to check.
--
-- Existing single-column FKs stay (they keep their ON DELETE behaviour); these add the tenant guarantee.
-- NO ACTION / SET NULL (col) mirror the existing rules so deletes behave exactly as before.
-- Constraints are added NOT VALID then validated, which avoids a long exclusive lock on big tables.
-- ON DELETE SET NULL (column list) needs PostgreSQL 15+ (Supabase and CI both satisfy this).

CREATE UNIQUE INDEX IF NOT EXISTS "categories_tenant_id_id_key" ON "categories" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_id_id_key" ON "customers" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_id_id_key" ON "inventory_items" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "kots_tenant_id_id_key" ON "kots" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "menu_item_variants_tenant_id_id_key" ON "menu_item_variants" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "menu_items_tenant_id_id_key" ON "menu_items" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "modifier_groups_tenant_id_id_key" ON "modifier_groups" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "modifiers_tenant_id_id_key" ON "modifiers" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "order_lines_tenant_id_id_key" ON "order_lines" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenant_id_id_key" ON "orders" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "outlets_tenant_id_id_key" ON "outlets" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "printers_tenant_id_id_key" ON "printers" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_tables_tenant_id_id_key" ON "restaurant_tables" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_tenant_id_id_key" ON "shifts" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_tenant_id_id_key" ON "staff" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "stations_tenant_id_id_key" ON "stations" (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS "table_sections_tenant_id_id_key" ON "table_sections" (tenant_id, id);

ALTER TABLE "categories" ADD CONSTRAINT "categories_station_id_tenant_fk" FOREIGN KEY (tenant_id, "station_id") REFERENCES "stations" (tenant_id, id) ON DELETE SET NULL ("station_id") NOT VALID;
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "kot_lines" ADD CONSTRAINT "kot_lines_kot_id_tenant_fk" FOREIGN KEY (tenant_id, "kot_id") REFERENCES "kots" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "kot_lines" ADD CONSTRAINT "kot_lines_order_line_id_tenant_fk" FOREIGN KEY (tenant_id, "order_line_id") REFERENCES "order_lines" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "kots" ADD CONSTRAINT "kots_order_id_tenant_fk" FOREIGN KEY (tenant_id, "order_id") REFERENCES "orders" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "kots" ADD CONSTRAINT "kots_station_id_tenant_fk" FOREIGN KEY (tenant_id, "station_id") REFERENCES "stations" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_group_id_tenant_fk" FOREIGN KEY (tenant_id, "group_id") REFERENCES "modifier_groups" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_item_id_tenant_fk" FOREIGN KEY (tenant_id, "item_id") REFERENCES "menu_items" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_item_id_tenant_fk" FOREIGN KEY (tenant_id, "item_id") REFERENCES "menu_items" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_tenant_fk" FOREIGN KEY (tenant_id, "category_id") REFERENCES "categories" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_station_id_tenant_fk" FOREIGN KEY (tenant_id, "station_id") REFERENCES "stations" (tenant_id, id) ON DELETE SET NULL ("station_id") NOT VALID;
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_group_id_tenant_fk" FOREIGN KEY (tenant_id, "group_id") REFERENCES "modifier_groups" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "order_line_modifiers" ADD CONSTRAINT "order_line_modifiers_modifier_id_tenant_fk" FOREIGN KEY (tenant_id, "modifier_id") REFERENCES "modifiers" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "order_line_modifiers" ADD CONSTRAINT "order_line_modifiers_order_line_id_tenant_fk" FOREIGN KEY (tenant_id, "order_line_id") REFERENCES "order_lines" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_tenant_fk" FOREIGN KEY (tenant_id, "item_id") REFERENCES "menu_items" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_tenant_fk" FOREIGN KEY (tenant_id, "order_id") REFERENCES "orders" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_tenant_fk" FOREIGN KEY (tenant_id, "variant_id") REFERENCES "menu_item_variants" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "order_tables" ADD CONSTRAINT "order_tables_order_id_tenant_fk" FOREIGN KEY (tenant_id, "order_id") REFERENCES "orders" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "order_tables" ADD CONSTRAINT "order_tables_table_id_tenant_fk" FOREIGN KEY (tenant_id, "table_id") REFERENCES "restaurant_tables" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_tenant_fk" FOREIGN KEY (tenant_id, "customer_id") REFERENCES "customers" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_shift_id_tenant_fk" FOREIGN KEY (tenant_id, "shift_id") REFERENCES "shifts" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_tenant_fk" FOREIGN KEY (tenant_id, "staff_id") REFERENCES "staff" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_tenant_fk" FOREIGN KEY (tenant_id, "order_id") REFERENCES "orders" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_kot_id_tenant_fk" FOREIGN KEY (tenant_id, "kot_id") REFERENCES "kots" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_tenant_fk" FOREIGN KEY (tenant_id, "order_id") REFERENCES "orders" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_tenant_fk" FOREIGN KEY (tenant_id, "printer_id") REFERENCES "printers" (tenant_id, id) ON DELETE SET NULL ("printer_id") NOT VALID;
ALTER TABLE "printers" ADD CONSTRAINT "printers_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "printers" ADD CONSTRAINT "printers_station_id_tenant_fk" FOREIGN KEY (tenant_id, "station_id") REFERENCES "stations" (tenant_id, id) ON DELETE SET NULL ("station_id") NOT VALID;
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_inventory_item_id_tenant_fk" FOREIGN KEY (tenant_id, "inventory_item_id") REFERENCES "inventory_items" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_item_id_tenant_fk" FOREIGN KEY (tenant_id, "item_id") REFERENCES "menu_items" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_staff_id_tenant_fk" FOREIGN KEY (tenant_id, "staff_id") REFERENCES "staff" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_section_id_tenant_fk" FOREIGN KEY (tenant_id, "section_id") REFERENCES "table_sections" (tenant_id, id) ON DELETE SET NULL ("section_id") NOT VALID;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_tenant_fk" FOREIGN KEY (tenant_id, "staff_id") REFERENCES "staff" (tenant_id, id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE "staff" ADD CONSTRAINT "staff_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE SET NULL ("outlet_id") NOT VALID;
ALTER TABLE "stations" ADD CONSTRAINT "stations_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_inventory_item_id_tenant_fk" FOREIGN KEY (tenant_id, "inventory_item_id") REFERENCES "inventory_items" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_tenant_fk" FOREIGN KEY (tenant_id, "inventory_item_id") REFERENCES "inventory_items" (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "table_sections" ADD CONSTRAINT "table_sections_outlet_id_tenant_fk" FOREIGN KEY (tenant_id, "outlet_id") REFERENCES "outlets" (tenant_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE "categories" VALIDATE CONSTRAINT "categories_station_id_tenant_fk";
ALTER TABLE "invoice_sequences" VALIDATE CONSTRAINT "invoice_sequences_outlet_id_tenant_fk";
ALTER TABLE "kot_lines" VALIDATE CONSTRAINT "kot_lines_kot_id_tenant_fk";
ALTER TABLE "kot_lines" VALIDATE CONSTRAINT "kot_lines_order_line_id_tenant_fk";
ALTER TABLE "kots" VALIDATE CONSTRAINT "kots_order_id_tenant_fk";
ALTER TABLE "kots" VALIDATE CONSTRAINT "kots_station_id_tenant_fk";
ALTER TABLE "menu_item_modifier_groups" VALIDATE CONSTRAINT "menu_item_modifier_groups_group_id_tenant_fk";
ALTER TABLE "menu_item_modifier_groups" VALIDATE CONSTRAINT "menu_item_modifier_groups_item_id_tenant_fk";
ALTER TABLE "menu_item_variants" VALIDATE CONSTRAINT "menu_item_variants_item_id_tenant_fk";
ALTER TABLE "menu_items" VALIDATE CONSTRAINT "menu_items_category_id_tenant_fk";
ALTER TABLE "menu_items" VALIDATE CONSTRAINT "menu_items_station_id_tenant_fk";
ALTER TABLE "modifiers" VALIDATE CONSTRAINT "modifiers_group_id_tenant_fk";
ALTER TABLE "order_line_modifiers" VALIDATE CONSTRAINT "order_line_modifiers_modifier_id_tenant_fk";
ALTER TABLE "order_line_modifiers" VALIDATE CONSTRAINT "order_line_modifiers_order_line_id_tenant_fk";
ALTER TABLE "order_lines" VALIDATE CONSTRAINT "order_lines_item_id_tenant_fk";
ALTER TABLE "order_lines" VALIDATE CONSTRAINT "order_lines_order_id_tenant_fk";
ALTER TABLE "order_lines" VALIDATE CONSTRAINT "order_lines_variant_id_tenant_fk";
ALTER TABLE "order_tables" VALIDATE CONSTRAINT "order_tables_order_id_tenant_fk";
ALTER TABLE "order_tables" VALIDATE CONSTRAINT "order_tables_table_id_tenant_fk";
ALTER TABLE "orders" VALIDATE CONSTRAINT "orders_customer_id_tenant_fk";
ALTER TABLE "orders" VALIDATE CONSTRAINT "orders_outlet_id_tenant_fk";
ALTER TABLE "orders" VALIDATE CONSTRAINT "orders_shift_id_tenant_fk";
ALTER TABLE "orders" VALIDATE CONSTRAINT "orders_staff_id_tenant_fk";
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_order_id_tenant_fk";
ALTER TABLE "print_jobs" VALIDATE CONSTRAINT "print_jobs_kot_id_tenant_fk";
ALTER TABLE "print_jobs" VALIDATE CONSTRAINT "print_jobs_order_id_tenant_fk";
ALTER TABLE "print_jobs" VALIDATE CONSTRAINT "print_jobs_printer_id_tenant_fk";
ALTER TABLE "printers" VALIDATE CONSTRAINT "printers_outlet_id_tenant_fk";
ALTER TABLE "printers" VALIDATE CONSTRAINT "printers_station_id_tenant_fk";
ALTER TABLE "recipe_components" VALIDATE CONSTRAINT "recipe_components_inventory_item_id_tenant_fk";
ALTER TABLE "recipe_components" VALIDATE CONSTRAINT "recipe_components_item_id_tenant_fk";
ALTER TABLE "refresh_tokens" VALIDATE CONSTRAINT "refresh_tokens_staff_id_tenant_fk";
ALTER TABLE "restaurant_tables" VALIDATE CONSTRAINT "restaurant_tables_outlet_id_tenant_fk";
ALTER TABLE "restaurant_tables" VALIDATE CONSTRAINT "restaurant_tables_section_id_tenant_fk";
ALTER TABLE "shifts" VALIDATE CONSTRAINT "shifts_outlet_id_tenant_fk";
ALTER TABLE "shifts" VALIDATE CONSTRAINT "shifts_staff_id_tenant_fk";
ALTER TABLE "staff" VALIDATE CONSTRAINT "staff_outlet_id_tenant_fk";
ALTER TABLE "stations" VALIDATE CONSTRAINT "stations_outlet_id_tenant_fk";
ALTER TABLE "stock_levels" VALIDATE CONSTRAINT "stock_levels_inventory_item_id_tenant_fk";
ALTER TABLE "stock_levels" VALIDATE CONSTRAINT "stock_levels_outlet_id_tenant_fk";
ALTER TABLE "stock_movements" VALIDATE CONSTRAINT "stock_movements_inventory_item_id_tenant_fk";
ALTER TABLE "table_sections" VALIDATE CONSTRAINT "table_sections_outlet_id_tenant_fk";
