'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  ServiceAddon,
  ServiceOffering,
  StyleCategory,
} from '@project-braids/shared-types/api';
import { ServicePortfolioManager } from '@/features/stylist/service-portfolio-manager';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
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
  const [duration, setDuration] = useState(String(service.estimatedDurationMinutes));
  const [sizeTier, setSizeTier] = useState(service.sizeTier ?? '');
  const [lengthTier, setLengthTier] = useState(service.lengthTier ?? '');
  const [hairIncluded, setHairIncluded] = useState(service.hairIncluded);
  const [requirements, setRequirements] = useState<string[]>(service.requirements ?? []);
  const [newRequirement, setNewRequirement] = useState('');
  const [depositMode, setDepositMode] = useState<'inherit' | 'flat' | 'percentage'>(
    service.depositType ?? 'inherit',
  );
  const [depositValue, setDepositValue] = useState(
    service.depositValue != null ? String(service.depositValue) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonDescription, setAddonDescription] = useState('');
  const [addonError, setAddonError] = useState<string | null>(null);

  useEffect(() => {
    setStyleName(service.styleName);
    setStyleCategoryId(service.styleCategoryId ?? '');
    setDescription(service.description ?? '');
    setBasePrice(service.basePrice);
    setDuration(String(service.estimatedDurationMinutes));
    setSizeTier(service.sizeTier ?? '');
    setLengthTier(service.lengthTier ?? '');
    setHairIncluded(service.hairIncluded);
    setRequirements(service.requirements ?? []);
    setDepositMode(service.depositType ?? 'inherit');
    setDepositValue(service.depositValue != null ? String(service.depositValue) : '');
  }, [service]);

  const selectedCategory = categories.find((c) => c.id === styleCategoryId);

  const saveMutation = useMutation({
    mutationFn: () => {
      const price = Number(basePrice);
      const durationMinutes = Number(duration);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Enter a valid base price greater than 0.');
      }
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        throw new Error('Enter a valid duration in minutes.');
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
        requirements: requirements.map((r) => r.trim()).filter(Boolean),
      };

      if (styleCategoryId) {
        payload.styleCategoryId = styleCategoryId;
      } else {
        payload.customStyleName = trimmedName;
        // Clear a previous taxonomy link when switching to a custom name.
        if (service.styleCategoryId) {
          payload.styleCategoryId = null;
        }
      }

      if (depositMode === 'inherit') {
        // Clear a previous per-service override when returning to business default.
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
    mutationFn: () =>
      apiFetchData<ServiceAddon>(`/businesses/me/services/${service.id}/addons`, {
        method: 'POST',
        json: {
          name: addonName.trim(),
          description: addonDescription.trim() || null,
          price: Number(addonPrice),
        },
      }),
    onSuccess: () => {
      setAddonName('');
      setAddonPrice('');
      setAddonDescription('');
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

  const deleteAddonMutation = useMutation({
    mutationFn: (addonId: string) =>
      apiFetchData(`/businesses/me/services/${service.id}/addons/${addonId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'services'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetchData<ServiceAddon[]>(`/businesses/me/services/${service.id}/addons/reorder`, {
        method: 'PUT',
        json: { orderedIds },
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

  async function handleAddAddon(event: React.FormEvent) {
    event.preventDefault();
    setAddonError(null);
    if (!addonName.trim() || !(Number(addonPrice) >= 0)) {
      setAddonError('Add-on needs a name and price.');
      return;
    }
    try {
      await createAddonMutation.mutateAsync();
    } catch (err) {
      setAddonError(getApiErrorMessage(err));
    }
  }

  function moveAddon(index: number, direction: -1 | 1) {
    const addons = [...(service.addons ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
    const next = index + direction;
    if (next < 0 || next >= addons.length) return;
    const ordered = [...addons];
    const tmp = ordered[index]!;
    ordered[index] = ordered[next]!;
    ordered[next] = tmp;
    reorderMutation.mutate(ordered.map((a) => a.id));
  }

  const addons = [...(service.addons ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Button variant="secondary" fullWidth onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide editor' : 'Edit service'}
      </Button>

      {open ? (
        <div className="space-y-4">
          {/*
            Keep service save and add-on create as sibling forms — browsers discard
            nested <form> tags, so "Add add-on" previously submitted "Save changes".
          */}
          <form className="space-y-4" onSubmit={handleSave}>
            <Input
              label="Service name"
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
              required
            />
            <label className="block text-sm font-medium text-ink">
              Style category
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={styleCategoryId}
                onChange={(e) => setStyleCategoryId(e.target.value)}
              >
                <option value="">Custom style</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
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
            <Input
              label="Duration (minutes)"
              type="number"
              min="15"
              step="15"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={hairIncluded}
                onChange={(e) => setHairIncluded(e.target.checked)}
              />
              Hair included in price
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Requirements (bullet points)</p>
              <ul className="space-y-2">
                {requirements.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <p className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                      {item}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setRequirements((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  label="Add requirement"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  placeholder="e.g. Hair must be washed and blow-dried"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  const next = newRequirement.trim();
                  if (!next) return;
                  setRequirements((prev) => [...prev, next]);
                  setNewRequirement('');
                }}
              >
                Add requirement
              </Button>
            </div>

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

          <div className="space-y-3 border-t border-border pt-3">
            <h4 className="font-medium text-ink">Add-ons</h4>
            <p className="text-sm text-ink-muted">
              Add-ons are saved immediately — you don’t need “Save changes” above.
            </p>
            {addons.length === 0 ? (
              <p className="text-sm text-ink-muted">No add-ons yet.</p>
            ) : (
              <ul className="space-y-2">
                {addons.map((addon, index) => (
                  <li
                    key={addon.id}
                    className="space-y-2 rounded-md border border-border bg-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-ink">{addon.name}</p>
                        <p className="text-sm text-ink-muted">{formatMoney(addon.price)}</p>
                        {addon.description ? (
                          <p className="mt-1 text-xs text-ink-muted">{addon.description}</p>
                        ) : null}
                      </div>
                      <span className="text-xs text-ink-muted">
                        {addon.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => moveAddon(index, -1)}
                        disabled={index === 0 || reorderMutation.isPending}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => moveAddon(index, 1)}
                        disabled={index === addons.length - 1 || reorderMutation.isPending}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          updateAddonMutation.mutate({
                            addonId: addon.id,
                            patch: { active: !addon.active },
                          })
                        }
                      >
                        {addon.active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          if (confirm(`Delete add-on “${addon.name}”?`)) {
                            deleteAddonMutation.mutate(addon.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form className="space-y-2" onSubmit={handleAddAddon}>
              <Input
                label="Add-on name"
                value={addonName}
                onChange={(e) => setAddonName(e.target.value)}
                placeholder="Hair Wash"
              />
              <Input
                label="Price (£)"
                type="number"
                min="0"
                step="0.01"
                value={addonPrice}
                onChange={(e) => setAddonPrice(e.target.value)}
              />
              <Input
                label="Description (optional)"
                value={addonDescription}
                onChange={(e) => setAddonDescription(e.target.value)}
              />
              {addonError ? <p className="text-sm text-error">{addonError}</p> : null}
              <Button type="submit" fullWidth disabled={createAddonMutation.isPending}>
                {createAddonMutation.isPending ? 'Adding…' : 'Add add-on'}
              </Button>
            </form>
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
