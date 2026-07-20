'use client';

import { useMemo, useState } from 'react';
import type { ServiceRequirementItem } from '@project-braids/shared-types/api';
import { REQUIREMENTS_CATALOG } from '@project-braids/shared-types/api';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

type Props = {
  value: ServiceRequirementItem[];
  onChange: (next: ServiceRequirementItem[]) => void;
};

function normalizeItems(
  items: Array<string | ServiceRequirementItem>,
): ServiceRequirementItem[] {
  return items.map((item) => (typeof item === 'string' ? { text: item } : item));
}

export function RequirementsCatalogPicker({ value, onChange }: Props) {
  const items = useMemo(() => normalizeItems(value), [value]);
  const [customText, setCustomText] = useState('');

  const selectedKeys = new Set(
    items.map((item) => item.catalogKey).filter((key): key is string => Boolean(key)),
  );

  function toggleCatalog(key: string, text: string) {
    if (selectedKeys.has(key)) {
      onChange(items.filter((item) => item.catalogKey !== key));
      return;
    }
    onChange([...items, { text, catalogKey: key }]);
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addCustom() {
    const text = customText.trim();
    if (!text) return;
    onChange([...items, { text }]);
    setCustomText('');
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink">Requirements</p>
      <p className="text-sm text-ink-muted">
        Select from the catalog or add a custom requirement. Clients must acknowledge these before
        booking.
      </p>
      <ul className="space-y-2">
        {REQUIREMENTS_CATALOG.map((entry) => {
          const checked = selectedKeys.has(entry.key);
          return (
            <li key={entry.key}>
              <label className="flex min-h-11 items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() => toggleCatalog(entry.key, entry.text)}
                />
                <span>{entry.text}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {items.filter((item) => !item.catalogKey).length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) =>
            item.catalogKey ? null : (
              <li key={`custom-${item.text}-${index}`} className="flex gap-2">
                <p className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                  {item.text}
                </p>
                <Button type="button" variant="secondary" onClick={() => removeAt(index)}>
                  Remove
                </Button>
              </li>
            ),
          )}
        </ul>
      ) : null}

      <div className="space-y-2">
        <Input
          label="Custom requirement"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="e.g. Bring a wide-tooth comb"
        />
        <Button type="button" variant="secondary" fullWidth onClick={addCustom}>
          Add custom requirement
        </Button>
      </div>
    </div>
  );
}

export function toRequirementItems(
  value: Array<string | ServiceRequirementItem> | undefined | null,
): ServiceRequirementItem[] {
  if (!value) return [];
  return normalizeItems(value);
}
