'use client';

import { useState } from 'react';
import type { ServiceAddon } from '@project-braids/shared-types/api';
import { ADDONS_CATALOG } from '@project-braids/shared-types/api';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

type Props = {
  existingAddons: Array<
    Pick<ServiceAddon, 'id' | 'name' | 'price' | 'active' | 'description' | 'displayOrder'> & {
      catalogKey?: string | null;
    }
  >;
  onEnableCatalog: (input: {
    catalogKey: string;
    name: string;
    price: number;
  }) => Promise<void> | void;
  onUpdatePrice: (addonId: string, price: number) => Promise<void> | void;
  onToggleActive: (addonId: string, active: boolean) => Promise<void> | void;
  onCreateCustom: (input: {
    name: string;
    price: number;
    description: string | null;
  }) => Promise<void> | void;
  busy?: boolean;
};

export function AddonsCatalogPicker({
  existingAddons,
  onEnableCatalog,
  onUpdatePrice,
  onToggleActive,
  onCreateCustom,
  busy,
}: Props) {
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const entry of ADDONS_CATALOG) {
      const existing = existingAddons.find((a) => a.catalogKey === entry.key);
      initial[entry.key] = existing ? String(Number(existing.price)) : String(entry.defaultPrice);
    }
    return initial;
  });
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const byCatalogKey = new Map(
    existingAddons
      .filter((addon) => addon.catalogKey)
      .map((addon) => [addon.catalogKey as string, addon]),
  );
  const customAddons = existingAddons.filter((addon) => !addon.catalogKey);

  async function enable(key: string, name: string) {
    setError(null);
    const price = Number(prices[key]);
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price for the add-on.');
      return;
    }
    try {
      await onEnableCatalog({ catalogKey: key, name, price });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable add-on');
    }
  }

  async function saveCustom() {
    setError(null);
    const price = Number(customPrice);
    if (!customName.trim() || !Number.isFinite(price) || price < 0) {
      setError('Custom add-on needs a name and price.');
      return;
    }
    try {
      await onCreateCustom({
        name: customName.trim(),
        price,
        description: customDescription.trim() || null,
      });
      setCustomName('');
      setCustomPrice('');
      setCustomDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create add-on');
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-ink">Add-ons</h4>
      <p className="text-sm text-ink-muted">
        Enable catalog add-ons with your price, or create a custom add-on. Clients see live totals
        when booking.
      </p>

      <ul className="space-y-2">
        {ADDONS_CATALOG.map((entry) => {
          const existing = byCatalogKey.get(entry.key);
          return (
            <li
              key={entry.key}
              className="space-y-2 rounded-md border border-border bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-ink">{entry.name}</p>
                {existing ? (
                  <span className="text-xs text-ink-muted">
                    {existing.active ? 'Enabled' : 'Off'}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[7rem] flex-1">
                  <Input
                    label="Price (£)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={prices[entry.key] ?? String(entry.defaultPrice)}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [entry.key]: e.target.value }))
                    }
                  />
                </div>
                {existing ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        const price = Number(prices[entry.key]);
                        if (!Number.isFinite(price) || price < 0) {
                          setError('Enter a valid price.');
                          return;
                        }
                        void onUpdatePrice(existing.id, price);
                      }}
                    >
                      Update price
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onToggleActive(existing.id, !existing.active)}
                    >
                      {existing.active ? 'Disable' : 'Enable'}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void enable(entry.key, entry.name)}
                  >
                    Enable
                  </Button>
                )}
              </div>
              {existing ? (
                <p className="text-xs text-ink-muted">Current: {formatMoney(existing.price)}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {customAddons.length > 0 ? (
        <ul className="space-y-2">
          {customAddons.map((addon) => (
            <li
              key={addon.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface p-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{addon.name}</p>
                <p className="text-sm text-ink-muted">{formatMoney(addon.price)}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onToggleActive(addon.id, !addon.active)}
              >
                {addon.active ? 'Disable' : 'Enable'}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm font-medium text-ink">Custom add-on</p>
        <Input
          label="Name"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="e.g. Colour rinse"
        />
        <Input
          label="Price (£)"
          type="number"
          min="0"
          step="0.01"
          value={customPrice}
          onChange={(e) => setCustomPrice(e.target.value)}
        />
        <Input
          label="Description (optional)"
          value={customDescription}
          onChange={(e) => setCustomDescription(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={busy}
          onClick={() => void saveCustom()}
        >
          Add custom add-on
        </Button>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
