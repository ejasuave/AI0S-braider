/**
 * Curated UK braiding style taxonomy for guided onboarding (Ch.6.4).
 * Seeded into `style_categories` via prisma/seed.ts.
 * Hierarchical: parent groups (Braids, Twists, …) with leaf style rows.
 */

export type StyleTaxonomySeedItem = {
  name: string;
  slug: string;
  /** Parent group slug; omit for top-level group rows. */
  parentSlug?: string;
  sizeTiers: readonly string[];
  lengthTiers: readonly string[];
  sortOrder: number;
  /** True for group-only rows (no leaf offerings attach here). */
  isGroup?: boolean;
};

const LENGTH_FULL = ['Shoulder', 'Mid-back', 'Waist-length', 'Hip-length', 'Bum Length'] as const;
const LENGTH_MID = ['Shoulder', 'Mid-back', 'Waist-length', 'Bum Length'] as const;
const SIZE_SML = ['Small', 'Medium', 'Large'] as const;

export const STYLE_TAXONOMY_SEED: readonly StyleTaxonomySeedItem[] = [
  // Parent groups
  {
    name: 'Braids',
    slug: 'braids',
    sizeTiers: [],
    lengthTiers: [],
    sortOrder: 1,
    isGroup: true,
  },
  {
    name: 'Twists',
    slug: 'twists',
    sizeTiers: [],
    lengthTiers: [],
    sortOrder: 2,
    isGroup: true,
  },
  {
    name: 'Locs',
    slug: 'locs',
    sizeTiers: [],
    lengthTiers: [],
    sortOrder: 3,
    isGroup: true,
  },
  {
    name: 'Cornrows',
    slug: 'cornrows-group',
    sizeTiers: [],
    lengthTiers: [],
    sortOrder: 4,
    isGroup: true,
  },
  {
    name: 'Wigs',
    slug: 'wigs',
    sizeTiers: [],
    lengthTiers: [],
    sortOrder: 5,
    isGroup: true,
  },
  // Leaf styles
  {
    name: 'Knotless Braids',
    slug: 'knotless-braids',
    parentSlug: 'braids',
    sizeTiers: SIZE_SML,
    lengthTiers: LENGTH_FULL,
    sortOrder: 10,
  },
  {
    name: 'Box Braids',
    slug: 'box-braids',
    parentSlug: 'braids',
    sizeTiers: SIZE_SML,
    lengthTiers: LENGTH_FULL,
    sortOrder: 20,
  },
  {
    name: 'Feed-in Braids',
    slug: 'feed-in-braids',
    parentSlug: 'braids',
    sizeTiers: SIZE_SML,
    lengthTiers: LENGTH_MID,
    sortOrder: 30,
  },
  {
    name: 'Boho Braids',
    slug: 'boho-braids',
    parentSlug: 'braids',
    sizeTiers: SIZE_SML,
    lengthTiers: LENGTH_MID,
    sortOrder: 35,
  },
  {
    name: 'Traditional Cornrows',
    slug: 'cornrows',
    parentSlug: 'cornrows-group',
    sizeTiers: ['Small', 'Medium'],
    lengthTiers: ['Short', 'Mid-back', 'Bum Length'],
    sortOrder: 40,
  },
  {
    name: 'Passion Twists',
    slug: 'passion-twists',
    parentSlug: 'twists',
    sizeTiers: SIZE_SML,
    lengthTiers: LENGTH_MID,
    sortOrder: 55,
  },
  {
    name: 'Senegalese Twists',
    slug: 'senegalese-twists',
    parentSlug: 'twists',
    sizeTiers: SIZE_SML,
    lengthTiers: LENGTH_MID,
    sortOrder: 56,
  },
  {
    name: 'Locs / Retwist',
    slug: 'locs-retwist',
    parentSlug: 'locs',
    sizeTiers: ['Standard'],
    lengthTiers: ['Short', 'Mid-back', 'Waist-length', 'Bum Length'],
    sortOrder: 60,
  },
  {
    name: 'Wig Install',
    slug: 'wig-install',
    parentSlug: 'wigs',
    sizeTiers: ['Standard'],
    lengthTiers: ['Shoulder', 'Mid-back', 'Waist-length', 'Bum Length'],
    sortOrder: 70,
  },
] as const;
