'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  ServiceAddon,
  ServiceOffering,
  ServiceRequirementItem,
  StyleCategory,
  StylistProfile,
} from '@project-braids/shared-types/api';
import { formatDurationLabel } from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { ServiceEditorPanel } from '@/features/stylist/service-editor-panel';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import {
  absoluteShareUrl,
  buildServiceSharePathFromOffering,
  serviceBookingUrl,
  stylistBookingUrl,
} from '@/shared/lib/booking-links';
import { formatMoney } from '@/shared/lib/format';
import { AddonsCatalogPicker } from '@/shared/ui/addons-catalog-picker';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { DurationPicker } from '@/shared/ui/duration-picker';
import { EmptyState } from '@/shared/ui/empty-state';
import { HierarchicalCategorySelect } from '@/shared/ui/hierarchical-category-select';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell, SectionTitle } from '@/shared/ui/page-shell';
import { RequirementsCatalogPicker } from '@/shared/ui/requirements-catalog-picker';
import { StatusBadge } from '@/shared/ui/status-badge';

type DraftAddon = {
  id: string;
  name: string;
  price: string;
  active: boolean;
  description: string | null;
  displayOrder: number;
  catalogKey: string | null;
};

function emptyFormState() {
  return {
    styleCategoryId: '',
    customStyleName: '',
    sizeTier: '',
    lengthTier: '',
    basePrice: '',
    durationMinutes: 120,
    requirements: [] as ServiceRequirementItem[],
    draftAddons: [] as DraftAddon[],
  };
}

export default function StylistServicesPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [styleCategoryId, setStyleCategoryId] = useState('');
  const [customStyleName, setCustomStyleName] = useState('');
  const [sizeTier, setSizeTier] = useState('');
  const [lengthTier, setLengthTier] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [requirements, setRequirements] = useState<ServiceRequirementItem[]>([]);
  const [draftAddons, setDraftAddons] = useState<DraftAddon[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMainLink, setCopiedMainLink] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ['style-categories'],
    queryFn: () => apiFetchData<StyleCategory[]>('/style-categories'),
  });

  const servicesQuery = useQuery({
    queryKey: ['business', 'services'],
    queryFn: () => apiFetchData<ServiceOffering[]>('/businesses/me/services'),
  });

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiFetchData<StylistProfile>('/profile/me'),
  });

  const selectedCategory = categoriesQuery.data?.find((c) => c.id === styleCategoryId);
  const stylistId = auth.stylistId ?? servicesQuery.data?.[0]?.stylistId ?? '';
  const publicSlug = profileQuery.data?.publicSlug ?? null;

  function resetForm() {
    const next = emptyFormState();
    setStyleCategoryId(next.styleCategoryId);
    setCustomStyleName(next.customStyleName);
    setSizeTier(next.sizeTier);
    setLengthTier(next.lengthTier);
    setBasePrice(next.basePrice);
    setDurationMinutes(next.durationMinutes);
    setRequirements(next.requirements);
    setDraftAddons(next.draftAddons);
    setFormError(null);
  }

  function mainBookingLink(): string {
    return stylistId ? stylistBookingUrl(stylistId) : '';
  }

  function perServiceBookingLink(service: ServiceOffering): string {
    if (publicSlug) {
      const category = categoriesQuery.data?.find((c) => c.id === service.styleCategoryId);
      return absoluteShareUrl(
        buildServiceSharePathFromOffering({
          stylistSlug: publicSlug,
          styleName: service.styleName,
          styleCategorySlug: category?.slug,
          sizeTier: service.sizeTier,
          lengthTier: service.lengthTier,
        }),
      );
    }
    return serviceBookingUrl(service.stylistId, service.id);
  }

  async function copyMainBookingLink() {
    const url = mainBookingLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedMainLink(true);
      setTimeout(() => setCopiedMainLink(false), 2000);
    } catch {
      setCopiedMainLink(false);
    }
  }

  async function copyBookingLink(service: ServiceOffering) {
    try {
      await navigator.clipboard.writeText(perServiceBookingLink(service));
      setCopiedId(service.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetchData<ServiceOffering>(`/businesses/me/services/${id}`, {
        method: 'PATCH',
        json: { active },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'services'] });
    },
  });

  const services = servicesQuery.data ?? [];

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!styleCategoryId && !customStyleName.trim()) {
      setFormError('Choose a style category or enter a custom style name.');
      return;
    }
    if (durationMinutes <= 0) {
      setFormError('Duration must be greater than zero.');
      return;
    }
    const price = Number(basePrice);
    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Enter a valid base price greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const offering = await apiFetchData<ServiceOffering>('/businesses/me/services', {
        method: 'POST',
        json: {
          ...(styleCategoryId ? { styleCategoryId } : { customStyleName: customStyleName.trim() }),
          sizeTier: sizeTier || null,
          lengthTier: lengthTier || null,
          basePrice: price,
          estimatedDurationMinutes: durationMinutes,
          requirements,
        },
      });

      for (const addon of draftAddons.filter((item) => item.active)) {
        await apiFetchData<ServiceAddon>(`/businesses/me/services/${offering.id}/addons`, {
          method: 'POST',
          json: {
            name: addon.name,
            price: Number(addon.price),
            description: addon.description,
            catalogKey: addon.catalogKey,
          },
        });
      }

      setShowForm(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['business', 'services'] });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Services"
        subtitle="Price each style and add work photos clients see under that service."
      />

      <div className="mt-6 space-y-4">
        {stylistId && services.length > 0 ? (
          <Card className="space-y-3">
            <div>
              <h2 className="font-medium text-ink">Client booking link</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Share one link — clients choose from all your active services, then pick a time.
              </p>
            </div>
            <p className="break-all text-xs text-ink-muted">{mainBookingLink()}</p>
            <Button variant="secondary" fullWidth onClick={() => void copyMainBookingLink()}>
              {copiedMainLink ? 'Copied!' : 'Copy booking link'}
            </Button>
          </Card>
        ) : null}

        <Button
          fullWidth
          onClick={() => {
            if (showForm) resetForm();
            setShowForm((v) => !v);
          }}
        >
          {showForm ? 'Cancel' : 'Add service'}
        </Button>

        {showForm ? (
          <Card>
            <form className="space-y-4" onSubmit={handleCreate}>
              <SectionTitle>New service</SectionTitle>
              <HierarchicalCategorySelect
                categories={categoriesQuery.data ?? []}
                value={styleCategoryId}
                onChange={(id) => {
                  setStyleCategoryId(id);
                  setCustomStyleName('');
                  setSizeTier('');
                  setLengthTier('');
                }}
              />
              {!styleCategoryId ? (
                <Input
                  label="Custom style name"
                  value={customStyleName}
                  onChange={(e) => setCustomStyleName(e.target.value)}
                  hint="Custom styles are lower-confidence for AI quotes."
                />
              ) : null}
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
              <Input
                label="Base price (£)"
                type="number"
                min="1"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
              />
              <DurationPicker
                valueMinutes={durationMinutes}
                onChange={setDurationMinutes}
                required
              />

              <div className="border-t border-border pt-4">
                <RequirementsCatalogPicker value={requirements} onChange={setRequirements} />
              </div>

              <div className="border-t border-border pt-4">
                <AddonsCatalogPicker
                  existingAddons={draftAddons}
                  busy={saving}
                  onEnableCatalog={({ catalogKey, name, price }) => {
                    setDraftAddons((prev) => {
                      if (prev.some((addon) => addon.catalogKey === catalogKey)) return prev;
                      return [
                        ...prev,
                        {
                          id: `draft-catalog-${catalogKey}`,
                          name,
                          price: String(price),
                          active: true,
                          description: null,
                          displayOrder: prev.length,
                          catalogKey,
                        },
                      ];
                    });
                  }}
                  onUpdatePrice={(addonId, price) => {
                    setDraftAddons((prev) =>
                      prev.map((addon) =>
                        addon.id === addonId ? { ...addon, price: String(price) } : addon,
                      ),
                    );
                  }}
                  onToggleActive={(addonId, active) => {
                    if (!active) {
                      setDraftAddons((prev) => prev.filter((addon) => addon.id !== addonId));
                      return;
                    }
                    setDraftAddons((prev) =>
                      prev.map((addon) => (addon.id === addonId ? { ...addon, active } : addon)),
                    );
                  }}
                  onCreateCustom={({ name, price, description }) => {
                    const id = `draft-custom-${Date.now()}`;
                    setDraftAddons((prev) => [
                      ...prev,
                      {
                        id,
                        name,
                        price: String(price),
                        active: true,
                        description,
                        displayOrder: prev.length,
                        catalogKey: null,
                      },
                    ]);
                  }}
                />
              </div>

              {formError ? <p className="text-sm text-error">{formError}</p> : null}
              <Button type="submit" fullWidth disabled={saving}>
                {saving ? 'Saving…' : 'Save service'}
              </Button>
            </form>
          </Card>
        ) : null}

        {servicesQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading services…</p>
        ) : services.length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Add your first style so clients can book and pay a deposit."
          />
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Card key={service.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-ink">{service.styleName}</h3>
                    <p className="text-sm text-ink-muted">
                      {formatMoney(service.basePrice)} ·{' '}
                      {formatDurationLabel(service.estimatedDurationMinutes)}
                      {service.sizeTier || service.lengthTier
                        ? ` · ${[service.sizeTier, service.lengthTier].filter(Boolean).join(' · ')}`
                        : ''}
                      {service.isCustomStyle ? ' · custom' : ''}
                    </p>
                  </div>
                  <StatusBadge
                    label={service.active ? 'Active' : 'Inactive'}
                    tone={service.active ? 'success' : 'neutral'}
                  />
                </div>
                <p className="break-all text-xs text-ink-muted">{perServiceBookingLink(service)}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => void copyBookingLink(service)}
                  >
                    {copiedId === service.id ? 'Copied!' : 'Copy share link'}
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() =>
                      toggleMutation.mutate({ id: service.id, active: !service.active })
                    }
                    disabled={toggleMutation.isPending}
                  >
                    {service.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
                <ServiceEditorPanel service={service} categories={categoriesQuery.data ?? []} />
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
