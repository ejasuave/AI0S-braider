'use client';

import type { StyleCategory } from '@project-braids/shared-types/api';

type Props = {
  categories: StyleCategory[];
  value: string;
  onChange: (categoryId: string) => void;
  allowCustom?: boolean;
  customLabel?: string;
};

/** Leaf-only category picker showing "Group · Style" labels. */
export function HierarchicalCategorySelect({
  categories,
  value,
  onChange,
  allowCustom = true,
  customLabel = 'Custom style…',
}: Props) {
  const leaves = categories
    .filter((category) => !category.isGroup)
    .slice()
    .sort((a, b) => {
      const aLabel = `${a.parentName ?? ''}${a.name}`;
      const bLabel = `${b.parentName ?? ''}${b.name}`;
      return aLabel.localeCompare(bLabel);
    });

  return (
    <label className="block text-sm font-medium text-ink">
      Style category
      <select
        className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowCustom ? <option value="">{customLabel}</option> : null}
        {leaves.map((category) => (
          <option key={category.id} value={category.id}>
            {category.parentName ? `${category.parentName} · ${category.name}` : category.name}
          </option>
        ))}
      </select>
    </label>
  );
}
