-- Properties & Assets (Sprint 3): platform-default Asset Types, per
-- docs/03-domain/domain-overview.md#the-trade-agnostic-configuration-pattern
-- and ADR-009. A small, representative set per launch Trade Type — not
-- "an extensive equipment database" (explicitly out of scope), just
-- enough for the Asset-creation flow to be usable. organization_id is
-- left NULL: these are platform defaults visible to every Organization
-- (see properties.asset_types_select policy). Organization-authored
-- custom Asset Types are not implemented this sprint — see
-- SPRINT-3-COMPLETION-REPORT.md, "Known Limitations."
INSERT INTO properties.asset_types (organization_id, trade_type_id, name)
SELECT NULL, t.id, v.name
FROM reference.trade_types t
JOIN (VALUES
  ('plumbing', 'Water Heater'),
  ('plumbing', 'Sump Pump'),
  ('plumbing', 'Well Pump'),
  ('hvac', 'Split System Condenser'),
  ('hvac', 'Furnace'),
  ('hvac', 'Air Handler'),
  ('electrical', 'Electrical Panel'),
  ('electrical', 'Generator'),
  ('electrical', 'EV Charger')
) AS v(slug, name) ON v.slug = t.slug;
