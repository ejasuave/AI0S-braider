# Profile & pricing (Chapter 6)

## Pricing integrity

The AI Receptionist (Ch.13) must **never invent prices**. All quotes flow through deterministic lookup against `service_offerings`:

1. Client intent → structured slots (`styleName`, `sizeTier`, `lengthTier`)
2. `GET /api/v1/profile/services/lookup` (or internal `resolvePricingLookup`)
3. Return matched offering with confidence score
4. Below **0.8** confidence → escalate (Ch.13.6)

### Match types

| Type            | Confidence (seeded) | Confidence (custom) |
| --------------- | ------------------- | ------------------- |
| `exact`         | 1.0                 | 0.85                |
| `partial_size`  | 0.9                 | 0.75                |
| `partial_style` | 0.8                 | 0.7                 |
| `none`          | 0                   | 0                   |

Custom styles (`isCustomStyle: true`) are allowed but flagged lower-confidence per Playbook §3.6.

## Style taxonomy

Seeded reference categories live in `style_categories` (see `STYLE_TAXONOMY_SEED` in shared-types). Categories may be hierarchical via `parentId` (group → leaf). Length tiers include **Bum Length** where configured. Stylists pick from this list during onboarding; custom styles can still be created.

## Catalogs & share links

- Shared catalogs: `REQUIREMENTS_CATALOG` / `ADDONS_CATALOG` in `packages/shared-types` (`GET /api/v1/service-catalogs`)
- Stylist `publicSlug` enables vanity share paths (`/stylist/{slug}/…`); UUID `/book?…` links remain valid
- Google Reviews placeholders are documented in [GOOGLE_REVIEWS.md](./GOOGLE_REVIEWS.md)

## Policies & hours

Canonical policy lives on `business_policies` (not legacy JSON on stylist profiles):

- **Enforced fields:** `depositType` / `depositValue`, `cancellationWindowHours`, `noShowFeeType` / `noShowFeeValue`
- **Client-facing text:** cancellation, rescheduling, late arrival, no-show, refund, children, guest, deposit notes
- **Remaining balance method:** `cash` | `card` | `bank_transfer` | `cash_or_card` | `cash_or_bank_transfer` | `card_or_bank_transfer` | `any`

Legacy `depositPolicy` / `cancellationPolicy` JSON on `stylist_profiles` is still mirrored for older consumers.

### Service offerings (extended)

Each `service_offerings` row may include:

- `description`, ordered structured `requirements` (`{ text, catalogKey? }`)
- optional per-service `depositType` / `depositValue` (null = inherit business policy)
- related `service_addons` (name, optional description, price, active, displayOrder, optional `catalogKey`)

Stylist UI: requirements and add-ons can be set on **Add service** (one save) as well as when editing an existing service.

Booking holds snapshot selected add-ons into `bookings.addons_snapshot` and require policy acknowledgement (`client_direct`). Existing bookings keep their agreed price; later service edits do not rewrite history.

## Storage

Portfolio images upload through `StorageProvider`. Local dev saves to `uploads/` and serves at `/uploads/*`. Production will use Supabase Storage behind the same interface.
