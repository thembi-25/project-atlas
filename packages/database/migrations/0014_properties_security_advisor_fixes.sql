-- Sprint 3 post-migration security/performance advisor fixes.
-- mcp__Supabase__get_advisors (type: performance) flagged
-- properties.assets.asset_type_id as a foreign key with no covering
-- index. All other advisor findings after Sprint 3's migrations were
-- pre-existing platform infrastructure (partitioned audit_events
-- tables, the Sprint 1 rls_auto_enable() function) or expected
-- "unused index" noise on brand-new, traffic-free tables — not
-- addressed here.

CREATE INDEX "idx_assets_asset_type_id" ON "properties"."assets" ("asset_type_id");
