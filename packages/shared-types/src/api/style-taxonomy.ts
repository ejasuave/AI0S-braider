/**
 * Curated UK braiding style taxonomy for guided onboarding (Ch.6.4).
 * Seeded into `style_categories` via prisma/seed.ts.
 */
export const STYLE_TAXONOMY_SEED = [
  {
    name: 'Knotless Braids',
    slug: 'knotless-braids',
    sizeTiers: ['Small', 'Medium', 'Large'],
    lengthTiers: ['Shoulder', 'Mid-back', 'Waist-length', 'Hip-length'],
    sortOrder: 10,
  },
  {
    name: 'Box Braids',
    slug: 'box-braids',
    sizeTiers: ['Small', 'Medium', 'Large'],
    lengthTiers: ['Shoulder', 'Mid-back', 'Waist-length', 'Hip-length'],
    sortOrder: 20,
  },
  {
    name: 'Feed-in Braids',
    slug: 'feed-in-braids',
    sizeTiers: ['Small', 'Medium', 'Large'],
    lengthTiers: ['Shoulder', 'Mid-back', 'Waist-length'],
    sortOrder: 30,
  },
  {
    name: 'Cornrows',
    slug: 'cornrows',
    sizeTiers: ['Small', 'Medium'],
    lengthTiers: ['Short', 'Mid-back'],
    sortOrder: 40,
  },
  {
    name: 'Twists',
    slug: 'twists',
    sizeTiers: ['Small', 'Medium', 'Large'],
    lengthTiers: ['Shoulder', 'Mid-back', 'Waist-length'],
    sortOrder: 50,
  },
  {
    name: 'Locs / Retwist',
    slug: 'locs-retwist',
    sizeTiers: ['Standard'],
    lengthTiers: ['Short', 'Mid-back', 'Waist-length'],
    sortOrder: 60,
  },
  {
    name: 'Wig Install',
    slug: 'wig-install',
    sizeTiers: ['Standard'],
    lengthTiers: ['Shoulder', 'Mid-back', 'Waist-length'],
    sortOrder: 70,
  },
] as const;
