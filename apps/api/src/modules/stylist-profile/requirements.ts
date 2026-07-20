import type { Prisma } from '@prisma/client';
import type { ServiceRequirementItem } from '@project-braids/shared-types/api';

/** Normalize DB JSON (legacy string[] or structured items) to structured requirements. */
export function parseRequirements(
  value: Prisma.JsonValue | string[] | null | undefined,
): ServiceRequirementItem[] {
  if (!value || !Array.isArray(value)) return [];
  const result: ServiceRequirementItem[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const text = item.trim();
      if (text) result.push({ text });
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      if (!text) continue;
      const catalogKey =
        typeof record.catalogKey === 'string' && record.catalogKey.trim()
          ? record.catalogKey.trim()
          : undefined;
      result.push(catalogKey ? { text, catalogKey } : { text });
    }
  }
  return result;
}

/** Persist requirements as structured JSON array. Accepts strings or items. */
export function serializeRequirements(
  items: Array<string | ServiceRequirementItem> | undefined,
): Prisma.InputJsonValue {
  if (!items || items.length === 0) return [];
  return items.map((item) => {
    if (typeof item === 'string') return { text: item.trim() };
    return item.catalogKey
      ? { text: item.text.trim(), catalogKey: item.catalogKey }
      : { text: item.text.trim() };
  });
}

/** Plain text list for ack / AI prompts. */
export function requirementTexts(items: ServiceRequirementItem[]): string[] {
  return items.map((item) => item.text);
}
