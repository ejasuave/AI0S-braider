# Directory module (beta)

Read-mostly public discovery layer over `profile` data. Full Ch.16 search index deferred to Phase 2.

- **Routes:** `GET /directory/stylists`, `GET /directory/stylists/:id`
- **Opt-in:** `stylist_profiles.directory_visible` (default false)
- **Booking:** links to existing `/book` flow — same path as direct stylist links

Does not own profile writes; delegates listing logic to `profileService`.
