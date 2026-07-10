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

Seeded reference categories live in `style_categories` (see `STYLE_TAXONOMY_SEED` in shared-types). Stylists pick from this list during onboarding; custom styles can still be created.

## Policies & hours

- `depositPolicy`: `{ type: 'flat' | 'percent', value: number }`
- `cancellationPolicy`: `{ windowHours, feeType, feeAmount, noShowFeeAmount }`
- `workingHours`: per-weekday `{ enabled, start, end }` (HH:MM, UK local for MVP)
- `bufferMinutes`: gap between appointments (consumed by Ch.8 availability)

## Storage

Portfolio images upload through `StorageProvider`. Local dev saves to `uploads/` and serves at `/uploads/*`. Production will use Supabase Storage behind the same interface.
