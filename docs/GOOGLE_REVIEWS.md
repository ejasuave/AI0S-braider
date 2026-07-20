# Google Reviews (Phase 2)

**Status:** Placeholder only — **not implemented**  
**Trigger:** Pilot stylists request directory/social proof from Google Business Profile; OAuth + Place API access approved.

## What exists today (Phase 1)

Nullable columns on `StylistProfile` (no sync/import code):

| Column                     | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `googlePlaceId`            | Google Place ID for the business              |
| `googleBusinessProfileUrl` | Public GBP / Maps URL                         |
| `googleReviewsLinkedAt`    | When the stylist linked / consented to import |

These fields are exposed on stylist profile DTOs for future UI. Saving a Place ID does **not** fetch or display reviews.

## Phase 2 plan (when trigger is met)

1. **Link flow** — stylist pastes GBP URL or searches Place; store `googlePlaceId` + URL; set `googleReviewsLinkedAt`.
2. **OAuth / API** — Google Business Profile or Places API credentials; respect ToS (no scraping).
3. **Import job** — idempotent worker pulls star rating + recent review snippets; store in a dedicated `google_reviews` (or similar) table keyed by stylist.
4. **Display** — directory detail + optional booking page badge; never invent ratings.
5. **Refresh** — scheduled re-sync with rate limits; clear cache on unlink.

## Out of scope until Phase 2

- Importing, caching, or ranking by Google ratings
- Reply-to-review tooling
- Showing fake / placeholder star counts in UI

See also [FUTURE_FEATURES.md](./FUTURE_FEATURES.md) registry entry.
