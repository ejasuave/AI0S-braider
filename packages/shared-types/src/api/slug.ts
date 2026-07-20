/**
 * URL-safe slug helpers for vanity stylist / service share paths.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

export type ServiceShareSegments = {
  stylistSlug: string;
  styleSlug: string;
  sizeSlug: string;
  lengthSlug: string;
};

/** Build `/stylist/{stylist}/{style}/{size}/{length}` path segments. */
export function servicePathSegments(input: {
  stylistSlug: string;
  styleName: string;
  styleCategorySlug?: string | null;
  sizeTier?: string | null;
  lengthTier?: string | null;
}): ServiceShareSegments {
  return {
    stylistSlug: slugify(input.stylistSlug),
    styleSlug: slugify(input.styleCategorySlug || input.styleName || 'service'),
    sizeSlug: slugify(input.sizeTier || 'standard'),
    lengthSlug: slugify(input.lengthTier || 'standard'),
  };
}

export function buildServiceSharePath(segments: ServiceShareSegments): string {
  return `/stylist/${segments.stylistSlug}/${segments.styleSlug}/${segments.sizeSlug}/${segments.lengthSlug}`;
}

export function buildServiceSharePathFromOffering(input: {
  stylistSlug: string;
  styleName: string;
  styleCategorySlug?: string | null;
  sizeTier?: string | null;
  lengthTier?: string | null;
}): string {
  return buildServiceSharePath(servicePathSegments(input));
}
