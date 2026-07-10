# Visual Identity & UX — Project Braids

**Status:** Approved (Phase 0)  
**Implements:** [Product Blueprint §6](../requirements/product-blueprint.md)

## North star

*"Your business finally has a front desk."* — Structured and trustworthy like a booking platform; warm and culturally fluent like the beauty world.

## Brand personality

| Audience | Primary feeling |
|----------|----------------|
| Stylist | Control — business runs at the chair |
| Client | Confidence — clear price and booking |
| Both | Trust, warmth |

**Voice:** British English, clear, warm, direct. No corporate jargon.

## Colour palette

| Token | Hex | Use |
|-------|-----|-----|
| `--color-ink` | `#1A1412` | Primary text |
| `--color-ink-muted` | `#5C524C` | Secondary text |
| `--color-canvas` | `#FBF8F5` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, inputs |
| `--color-surface-raised` | `#F5F0EB` | Subtle sections |
| `--color-border` | `#E8E0D8` | Dividers |
| `--color-primary` | `#B8860B` | CTAs, links |
| `--color-primary-hover` | `#9A7209` | Button hover |
| `--color-primary-subtle` | `#F5EDD8` | Tinted backgrounds |
| `--color-success` | `#2D6A4F` | Confirmed, paid |
| `--color-warning` | `#B45309` | Pending, expiring |
| `--color-error` | `#B91C1C` | Errors, cancelled |
| `--color-ai` | `#6B4C9A` | AI receptionist accent |

Light mode only for MVP. Stylist accent override: `--color-stylist-accent` (V2 client surfaces).

## Typography

- **Headings:** Fraunces (500–600)
- **UI:** DM Sans (400, 500, 600)
- **Scale:** 16px base; `text-xs` through `text-4xl` per Tailwind

## Spacing & shape

- 4px grid; gutters 16px mobile / 24px tablet / 32px desktop
- Radius: `sm` 6px, `md` 10px, `lg` 16px, `xl` 24px
- Shadows: warm-tinted (`rgba(26,20,18,…)`), subtle elevation

## Components (shadcn/ui)

- Theme shadcn to tokens above — not default zinc
- Buttons: min-height 44px; one primary CTA per viewport
- Status badges: pill + text + dot (never colour alone)
- Loading: skeletons over spinners
- Icons: Lucide, 20px default, outlined

## Mobile-first rules

1. Design mobile layout first; desktop enhances
2. Touch targets ≥ 44×44px; no hover-only on touch surfaces
3. Dashboard: bottom nav (Home, Calendar, Messages, Earnings, More)
4. Primary CTAs in thumb zone; fixed bottom on mobile forms (V2)
5. Calendar: week view default; slots as tappable pills
6. LCP < 2.5s on 4G for client pages

## Accessibility

WCAG 2.1 AA: 4.5:1 contrast, visible focus rings, `aria-live` for chat/confirmations, `prefers-reduced-motion` respected.

## Surface-specific UX

| Surface | Key rule |
|---------|----------|
| Onboarding | Checklist progress; incremental save; defaults |
| Dashboard | Escalations first; glanceable home |
| SMS booking | Under 3 minutes to confirmed booking |
| Widget (V2) | Chat bubbles; AI labelled once |
| Form page (V2) | One decision per screen; running price total |

## Design principles

1. Conversation is the product  
2. Trust before beauty  
3. Mobile is the main device  
4. Show, don't configure  
5. One primary action per screen  
6. Portfolio is identity  
7. AI is visible, not hidden  
8. Warm, not cute  
9. Progressive disclosure  
10. Consistent across channels  
