# Mobile layout audit (Chapter 24.1)

**Date:** 2026-07-10  
**Viewports tested:** 375×812 (iPhone SE class), 428×926 (iPhone 14 Pro Max class)  
**Scope:** MVP prompt 24.1 only — 24.2–24.4 deferred per Back Matter

## Summary

Responsive layout pass across core `apps/web` flows. Issues found at 375px content width (~343px inside `PageShell`) were fixed. Chat widget (Ch.11.4) is **not built** — audit item documented as N/A until V2.

## Flows audited

| Flow                   | Routes / components                                                    | Status       |
| ---------------------- | ---------------------------------------------------------------------- | ------------ |
| Stylist onboarding     | `/register/stylist`, `/stylist/profile`, `/stylist/services`           | Fixed        |
| Stylist dashboard      | `/stylist`, `/stylist/bookings`, `week-calendar.tsx`                   | Fixed        |
| Escalation inbox       | `/stylist/inbox`, `/stylist/inbox/[id]`                                | Fixed        |
| Public directory       | `/directory`, `/directory/[stylistId]`                                 | Fixed        |
| Client booking         | `/book`, `/client/*`                                                   | Fixed        |
| Auth                   | `/login`, `/login/team`, `/login/client`, `/verify`, `/invite/[token]` | Fixed        |
| Embeddable chat widget | Ch.11.4                                                                | **N/A — V2** |

## Issues found and fixes

### P0 — Bottom navigation overcrowding (375px)

**Issue:** Six stylist tabs (~57px each) caused label truncation and uneven wrapping.  
**Fix:** Consolidated to five tabs per `visual-identity-and-ux.md`: Home, Calendar, Inbox, Pay, **More**. Services and Profile moved to `/stylist/more`.  
**Files:** `bottom-nav.tsx`, new `stylist/more/page.tsx`

### P0 — Inbox reply composer vs keyboard

**Issue:** Fixed bottom nav + on-screen keyboard could obscure reply textarea on conversation detail.  
**Fix:** Extra bottom padding on conversation page; `scrollIntoView` on textarea focus; composer `id="reply-composer"`.  
**Files:** `stylist/inbox/[id]/page.tsx`, `page-shell.tsx` (safe-area-aware padding)

### P1 — Week calendar cramped at 375px

**Issue:** Seven-column grid with full weekday labels (~46px per cell).  
**Fix:** Single-letter weekday on mobile (`M`/`T`/…); tighter `gap-0.5`; prev/next week navigation; `min-h-14` day pills retained.  
**Files:** `week-calendar.tsx`, `week-dates.ts`, `stylist/bookings/page.tsx`

### P1 — Touch targets below 44px

**Issue:** Text links (`text-sm` only) on dashboard, client home, auth footers, back links.  
**Fix:** Shared `TOUCH_LINK_CLASS` (`min-h-11`) via `touch-target.ts`; applied across core flows.  
**Files:** `touch-target.ts`, `page-shell.tsx`, `stylist/page.tsx`, `client/page.tsx`, auth pages

### P1 — Horizontal overflow in flex rows

**Issue:** Long datetime strings and business names pushed badges/price off-screen.  
**Fix:** `min-w-0` on flexible columns; `shrink-0` on badges; `truncate` on phone numbers.  
**Files:** `booking-card.tsx`, `directory/page.tsx`, `status-badge.tsx`, inbox rows

### P2 — iOS safe area

**Issue:** Fixed nav ignored home-indicator inset.  
**Fix:** `pb-[env(safe-area-inset-bottom)]` on nav; `PageShell` uses `pb-[calc(6rem+env(safe-area-inset-bottom))]`.  
**Files:** `bottom-nav.tsx`, `page-shell.tsx`

### P2 — Hover-only affordances

**Issue:** Cards/links relied on `hover:` with no touch equivalent.  
**Fix:** Added `active:` states on cards, links, and buttons.  
**Files:** `button.tsx`, `booking-card.tsx`, `directory/page.tsx`, `inbox/page.tsx`

### P2 — Services action button wrap

**Issue:** Two-column action grid cramped button labels on narrow screens.  
**Fix:** `grid-cols-1 sm:grid-cols-2` for Copy/Activate actions.  
**Files:** `stylist/services/page.tsx`

### P2 — Booking detail actions

**Issue:** Wrapped action buttons not thumb-friendly on mobile.  
**Fix:** Full-width stacked buttons below `sm` breakpoint.  
**Files:** `stylist/bookings/[id]/page.tsx`

### P3 — Global horizontal scroll guard

**Issue:** Long URLs/code strings could cause page-level `overflow-x`.  
**Fix:** `overflow-x-hidden` on `html`/`body`; `break-all` on booking URL hints.  
**Files:** `layout.tsx`, `globals.css`, `book/page.tsx`

### P3 — Directory checkbox hit area

**Issue:** 16×16px checkbox in profile settings.  
**Fix:** 20×20px checkbox inside full-row `min-h-11` label.  
**Files:** `stylist/profile/page.tsx`

## Chat widget (Ch.11.4) — deferred

No embeddable web chat widget exists in MVP (SMS-only per Blueprint). When 11.4 ships, re-audit:

- Fixed-position overlap with page content
- Dismiss/expand touch gestures
- Keyboard-safe message composer
- Safe-area insets

## Regression tests added

| Test                   | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `touch-target.test.ts` | Documents 44px minimum; asserts `TOUCH_LINK_CLASS` includes `min-h-11`       |
| `week-dates.test.ts`   | `weekdayInitial` for compact calendar; `shiftWeekAnchor` for week navigation |

## Manual verification checklist

- [x] Stylist bottom nav: five tabs readable at 375px
- [x] Calendar: tap each day pill; prev/next week controls
- [x] Inbox list: escalated + all sections scroll without horizontal overflow
- [x] Inbox detail: focus reply field — composer scrolls into view above nav
- [x] Directory search + results: no horizontal scroll on long names
- [x] `/book` slot picker: full-width tappable slots
- [ ] Chat widget with on-screen keyboard — **blocked until Ch.11.4**

## Deferred to V2 (24.2–24.4)

| Prompt | Reason                                                                                  |
| ------ | --------------------------------------------------------------------------------------- |
| 24.2   | Touch polish beyond layout (input `inputMode`, gesture audit) — Optional in Back Matter |
| 24.3   | Mobile-network performance — requires Ch.21 `PERFORMANCE_AUDIT.md`                      |
| 24.4   | PWA / installability — Optional in Back Matter                                          |
