'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  ServiceAddon,
  ServiceOffering,
  ServiceRequirementItem,
  StyleCategory,
} from '@project-braids/shared-types/api';
import { ServicePortfolioManager } from '@/features/stylist/service-portfolio-manager';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { AddonsCatalogPicker } from '@/shared/ui/addons-catalog-picker';
import { Button } from '@/shared/ui/button';
import { DurationPicker } from '@/shared/ui/duration-picker';
import { HierarchicalCategorySelect } from '@/shared/ui/hierarchical-category-select';
import { Input } from '@/shared/ui/input';
import {
  RequirementsCatalogPicker,
  toRequirementItems,
} from '@/shared/ui/requirements-catalog-picker';
import { Textarea } from '@/shared/ui/textarea';

type Props = {
  service: ServiceOffering;
  categories: StyleCategory[];
};

export function ServiceEditorPanel({ service, categories }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [styleName, setStyleName] = useState(service.styleName);
  const [styleCategoryId, setStyleCategoryId] = useState(service.styleCategoryId ?? '');
  const [description, setDescription] = useState(service.description ?? '');
  const [basePrice, setBasePrice] = useState(service.basePrice);
  const [durationMinutes, setDurationMinutes] = useState(service.estimatedDurationMinutes);
  const [sizeTier, setSizeTier] = useState(service.sizeTier ?? '');
  const [lengthTier, setLengthTier] = useState(service.lengthTier ?? '');
  const [hairIncluded, setHairIncluded] = useState(service.hairIncluded);
  const [requirements, setRequirements] = useState<ServiceRequirementItem[]>(
    toRequirementItems(service.requirements),
  );
  const [depositMode, setDepositMode] = useState<'inherit' | 'flat' | 'percentage'>(
    service.depositType ?? 'inherit',
  );
  const [depositValue, setDepositValue] = useState(
    service.depositValue != null ? String(service.depositValue) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStyleName(service.styleName);
    setStyleCategoryId(service.styleCategoryId ?? '');
    setDescription(service.description ?? '');
    setBasePrice(service.basePrice);
    setDurationMinutes(service.estimatedDurationMinutes);
    setSizeTier(service.sizeTier ?? '');
    setLengthTier(service.lengthTier ?? '');
    setHairIncluded(service.hairIncluded);
    setRequirements(toRequirementItems(service.requirements));
    setDepositMode(service.depositType ?? 'inherit');
    setDepositValue(service.depositValue != null ? String(service.depositValue) : '');
  }, [service]);

  const selectedCategory = categories.find((c) => c.id === styleCategoryId);

  const saveMutation = useMutation({
    mutationFn: () => {
      const price = Number(basePrice);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Enter a valid base price greater than 0.');
      }
      if (durationMinutes <= 0) {
        throw new Error('Enter a valid duration.');
      }
      if (depositMode !== 'inherit') {
        const deposit = Number(depositValue);
        if (!Number.isFinite(deposit) || deposit <= 0) {
          throw new Error('Enter a valid deposit value, or use the business default.');
        }
        if (depositMode === 'percentage' && (deposit < 1 || deposit > 100)) {
          throw new Error('Percentage deposit must be between 1 and 100.');
        }
      }

      const trimmedName = styleName.trim();
      if (!trimmedName) {
        throw new Error('Service name is required.');
      }

      const payload: Record<string, unknown> = {
        styleName: trimmedName,
        sizeTier: sizeTier.trim() ? sizeTier.trim() : null,
        lengthTier: lengthTier.trim() ? lengthTier.trim() : null,
        basePrice: price,
        estimatedDurationMinutes: durationMinutes,
        hairIncluded,
        description: description.trim() || null,
        requirements,
      };

      if (styleCategoryId) {
        payload.styleCategoryId = styleCategoryId;
      } else {
        payload.customStyleName = trimmedName;
        if (service.styleCategoryId) {
          payload.styleCategoryId = null;
        }
      }

      if (depositMode === 'inherit') {
        if (service.depositType) {
          payload.depositType = null;
          payload.depositValue = null;
        }
      } else {
        payload.depositType = depositMode;
        payload.depositValue = Number(depositValue);
      }

      return apiFetchData<ServiceOffering>(`/businesses/me/services/${service.id}`, {
        method: 'PATCH',
        json: payload,
      });
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['business', 'services'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const createAddonMutation = useMutation({
    mutationFn: (body: {
      name: string;
      description?: string | null;
      price: number;
      catalogKey?: string | null;
    }) =>
      apiFetchData<ServiceAddon>(`/businesses/me/services/${service.id}/addons`, {
        method: 'POST',
        json: body,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'services'] });
    },
  });

  const updateAddonMutation = useMutation({
    mutationFn: ({
      addonId,
      patch,
    }: {
      addonId: string;
      patch: { active?: boolean; name?: string; price?: number };
    }) =>
      apiFetchData<ServiceAddon>(`/businesses/me/services/${service.id}/addons/${addonId}`, {
        method: 'PATCH',
        json: patch,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'services'] });
    },
  });

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await saveMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save service. Check the form and try again.'));
    }
  }

  const addons = [...(service.addons ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const addonBusy = createAddonMutation.isPending || updateAddonMutation.isPending;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Button variant="secondary" fullWidth onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide editor' : 'Edit service'}
      </Button>

      {open ? (
        <div className="space-y-4">
          <form className="space-y-4" onSubmit={handleSave}>
            <Input
              label="Service name"
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
              required
            />
            <HierarchicalCategorySelect
              categories={categories}
              value={styleCategoryId}
              customLabel="Custom style"
              onChange={(id) => {
                setStyleCategoryId(id);
                setSizeTier('');
                setLengthTier('');
              }}
            />
            {selectedCategory ? (
              <>
                <label className="block text-sm font-medium text-ink">
                  Size tier
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    value={sizeTier}
                    onChange={(e) => setSizeTier(e.target.value)}
                  >
                    <option value="">Any</option>
                    {selectedCategory.sizeTiers.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Length tier
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    value={lengthTier}
                    onChange={(e) => setLengthTier(e.target.value)}
                  >
                    <option value="">Any</option>
                    {selectedCategory.lengthTiers.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What clients should know about this service"
            />
            <Input
              label="Base price (£)"
              type="number"
              min="1"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
            />
            <DurationPicker valueMinutes={durationMinutes} onChange={setDurationMinutes} required />
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={hairIncluded}
                onChange={(e) => setHairIncluded(e.target.checked)}
              />
              Hair included in price
            </label>

            <RequirementsCatalogPicker value={requirements} onChange={setRequirements} />

            <label className="block text-sm font-medium text-ink">
              Deposit override
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={depositMode}
                onChange={(e) =>
                  setDepositMode(e.target.value as 'inherit' | 'flat' | 'percentage')
                }
              >
                <option value="inherit">Use business default</option>
                <option value="percentage">Percentage of total</option>
                <option value="flat">Flat amount (£)</option>
              </select>
            </label>
            {depositMode !== 'inherit' ? (
              <Input
                label={depositMode === 'percentage' ? 'Deposit (%)' : 'Deposit (£)'}
                type="number"
                min="1"
                step="0.01"
                value={depositValue}
                onChange={(e) => setDepositValue(e.target.value)}
                required
              />
            ) : null}

            {error ? <p className="text-sm text-error">{error}</p> : null}
            {saved ? <p className="text-sm text-success">Service saved.</p> : null}
            <Button type="submit" fullWidth disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>

          <div className="border-t border-border pt-3">
            <AddonsCatalogPicker
              existingAddons={addons}
              busy={addonBusy}
              onEnableCatalog={async ({ catalogKey, name, price }) => {
                try {
                  await createAddonMutation.mutateAsync({
                    name,
                    price,
                    catalogKey,
                    description: null,
                  });
                } catch (err) {
                  throw new Error(getApiErrorMessage(err));
                }
              }}
              onUpdatePrice={async (addonId, price) => {
                await updateAddonMutation.mutateAsync({ addonId, patch: { price } });
              }}
              onToggleActive={async (addonId, active) => {
                await updateAddonMutation.mutateAsync({ addonId, patch: { active } });
              }}
              onCreateCustom={async ({ name, price, description: desc }) => {
                try {
                  await createAddonMutation.mutateAsync({
                    name,
                    price,
                    description: desc,
                    catalogKey: null,
                  });
                } catch (err) {
                  throw new Error(getApiErrorMessage(err));
                }
              }}
            />
          </div>

          <ServicePortfolioManager
            serviceId={service.id}
            serviceName={service.styleName}
            items={service.portfolio ?? []}
          />
        </div>
      ) : null}
    </div>
  );
}
