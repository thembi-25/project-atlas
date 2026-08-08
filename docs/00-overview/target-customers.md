# Target Customers

## Primary segment (launch)

Independent, owner-operated plumbing, HVAC, and electrical service businesses in the United States with:

- **2–50 technicians** (field-facing staff who perform jobs).
- **1–5 office/administrative staff** (owner, dispatcher, bookkeeper — often overlapping roles in smaller businesses).
- Annual revenue roughly **$500K–$15M**.
- Currently using a mix of a basic scheduling tool (or none), spreadsheets, paper invoices/estimates, and phone/text for dispatch.
- Serving a mix of residential and light-commercial service and repair work (not new-construction/project-based contracting, which has different workflow needs — see [Product Scope](../01-product/product-scope.md) for explicit exclusions).

## Why this segment first

1. **Acute, unaddressed pain.** This segment is large, underserved by modern software, and the cost of fragmented tools (missed follow-ups, lost paperwork, delayed invoicing) is directly felt by the owner every week.
2. **Fast sales cycle, single decision-maker.** The owner is typically the buyer, user, and economic decision-maker, which shortens the sales cycle relative to enterprise or franchise buyers.
3. **High data density per organization relative to team size.** A 20-technician HVAC company generates enough job/property/asset volume to make Property Intelligence valuable quickly, without needing hundreds of organizations before the data model proves its worth.
4. **Natural expansion path to the platform pillars.** These businesses buy parts from suppliers and install manufacturer equipment constantly — they are the natural first participants in the [Supplier Marketplace](../06-modules/marketplace-prd.md) and [Manufacturer Integrations](../06-modules/manufacturers-prd.md) once Core Operations is proven.

## Secondary segment (future, not launch scope)

- Larger regional multi-location trades businesses (50–200 technicians) — the architecture (multi-tenant organizations, teams, RBAC) does not block this segment, but the product is not tuned for their franchise/multi-branch reporting needs at launch.
- Adjacent trades beyond plumbing/HVAC/electrical (e.g., appliance repair, garage door, pool service) — the trade-aware configuration model (see [ADR-009](../11-adr/ADR-009-domain-modules.md)) is designed to support this expansion without an architecture change, but no such trade is in scope for launch.

## Explicitly out of scope customers

- New-construction general contractors and project-based construction firms — different workflow (bids, change orders, draws) not modeled by Atlas's job/property structure.
- Enterprise franchise networks requiring complex multi-brand, multi-royalty-structure billing.
- Businesses outside the United States at launch (currency, tax, and compliance frameworks are U.S.-first; see [Compliance](../03-domain/compliance.md) for what is and isn't modeled).

## Buyer and user roles inside a target customer

See [User Personas](./user-personas.md) for the specific roles (Owner, Dispatcher, Technician, Bookkeeper, Customer) and how each interacts with the platform.
