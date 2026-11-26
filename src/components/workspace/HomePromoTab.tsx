import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  Loader2,
  Plus,
  Save,
  Smartphone,
  Star,
  Trash2,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { CityDoc, PlaceDoc, PromoTargetRoute } from '../../types.ts';
import { PROMO_TARGET_ROUTES } from '../../types.ts';
import { ConfirmDialog } from '../ConfirmDialog.tsx';
import { SafeImage } from '../SafeImage.tsx';

interface HomePromoTabProps {
  city: CityDoc;
  places: PlaceDoc[];
  onCitiesRefresh: () => Promise<void>;
  onPlacesChanged: (places: PlaceDoc[]) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

export function HomePromoTab({
  city,
  places,
  onCitiesRefresh,
  onPlacesChanged,
  onToast,
}: HomePromoTabProps) {
  const [cityName, setCityName] = useState(city.name || '');
  const [heroImageUrl, setHeroImageUrl] = useState(city.heroImageUrl || '');
  const [heroSubtitle, setHeroSubtitle] = useState(city.heroSubtitle || '');

  const [hasPromo, setHasPromo] = useState(Boolean(city.promoBanner));
  const [badgeText, setBadgeText] = useState(city.promoBanner?.badgeText || '');
  const [title, setTitle] = useState(city.promoBanner?.title || '');
  const [subtitle, setSubtitle] = useState(city.promoBanner?.subtitle || '');
  const [ctaLabel, setCtaLabel] = useState(city.promoBanner?.ctaLabel || '');
  const [promoImageUrl, setPromoImageUrl] = useState(city.promoBanner?.imageUrl || '');
  const [targetRoute, setTargetRoute] = useState<PromoTargetRoute>(
    city.promoBanner?.targetRoute || 'explore'
  );

  const [saving, setSaving] = useState(false);
  const [deletingPromoOpen, setDeletingPromoOpen] = useState(false);
  const [deletingPromoBusy, setDeletingPromoBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    setCityName(city.name || '');
    setHeroImageUrl(city.heroImageUrl || '');
    setHeroSubtitle(city.heroSubtitle || '');
    setHasPromo(Boolean(city.promoBanner));
    setBadgeText(city.promoBanner?.badgeText || '');
    setTitle(city.promoBanner?.title || '');
    setSubtitle(city.promoBanner?.subtitle || '');
    setCtaLabel(city.promoBanner?.ctaLabel || '');
    setPromoImageUrl(city.promoBanner?.imageUrl || '');
    setTargetRoute(city.promoBanner?.targetRoute || 'explore');
  }, [city]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!cityName.trim()) {
      onToast('error', 'City name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateCity(city.id, {
        name: cityName.trim(),
        heroImageUrl: heroImageUrl.trim(),
        heroSubtitle: heroSubtitle.trim(),
        promoBanner: hasPromo
          ? {
              id: city.promoBanner?.id || `${city.id}_promo`,
              badgeText: badgeText.trim(),
              title: title.trim(),
              subtitle: subtitle.trim(),
              ctaLabel: ctaLabel.trim() || 'Explore',
              imageUrl: promoImageUrl.trim(),
              targetRoute,
            }
          : null,
      });
      await onCitiesRefresh();
      onToast('success', `${res.city.name} Home & Promo — Saved & synced live to app`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeletePromo = async () => {
    setDeletingPromoBusy(true);
    try {
      await api.updateCity(city.id, { promoBanner: null });
      await onCitiesRefresh();
      setHasPromo(false);
      setBadgeText('');
      setTitle('');
      setSubtitle('');
      setCtaLabel('');
      setPromoImageUrl('');
      setTargetRoute('explore');
      setDeletingPromoOpen(false);
      onToast('success', `Deleted promoBanner for ${city.name} — Saved & synced live to app`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingPromoBusy(false);
    }
  };

  const handleTogglePopular = async (place: PlaceDoc) => {
    setTogglingId(place.id);
    try {
      const res = await api.updatePlace(city.id, place.id, {
        isPopular: !place.isPopular,
      });
      const fresh = await api.listPlaces(city.id);
      onPlacesChanged(fresh.places);
      onToast(
        'success',
        `${place.name} ${res.place.isPopular ? 'featured on' : 'removed from'} ${city.name} Home — Saved & synced live to app`
      );
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  const popularPlaces = places.filter((p) => p.isPopular);
  const resolvedPreviewName = cityName.trim() || city.name;
  const resolvedHeroSubtitle = (heroSubtitle || '').replace(/\{city\}/gi, resolvedPreviewName);

  return (
    <div className="space-y-6">
      {/* 2-Column Split: Form Left + Live Mobile Visual Preview Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => void handleSave(e)}
          className="xl:col-span-7 surface-card p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Home & Promo Banner Manager</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Updates <span className="font-mono">cityName</span>,{' '}
                <span className="font-mono">heroSubtitle</span>,{' '}
                <span className="font-mono">headerImageUrl</span> &{' '}
                <span className="font-mono">promoBanner</span> for {city.name}
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Home Hero Header
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  City Name (<span className="font-mono">cityName</span>)
                </label>
                <input
                  type="text"
                  required
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="e.g. Indore"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Header Image URL (<span className="font-mono">headerImageUrl</span>)
                </label>
                <input
                  type="text"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="https://... or /src/assets/images/..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Hero Subtitle (<span className="font-mono">heroSubtitle</span>)
                </label>
                <span className="rounded bg-[#E0F2FE] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#0284C7]">
                  Supports {'{city}'} placeholder
                </span>
              </div>
              <input
                type="text"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="e.g. Discover the best spots across {city}"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Promotional Banner (<span className="font-mono">promoBanner</span>)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional featured callout banner displayed on the mobile Home screen.
                </p>
              </div>
              {hasPromo ? (
                <button
                  type="button"
                  onClick={() => setDeletingPromoOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Banner
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setHasPromo(true);
                    if (!badgeText) setBadgeText('Featured');
                    if (!ctaLabel) setCtaLabel('Explore');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E0F2FE] px-3 py-1.5 text-xs font-semibold text-[#0284C7] hover:bg-sky-200/70 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Promo Banner
                </button>
              )}
            </div>

            {!hasPromo ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                <p className="text-xs font-semibold text-slate-700">
                  No promotional banner active for {resolvedPreviewName}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Click &quot;Create Promo Banner&quot; above to add a campaign card to the Home screen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Promo Badge Text
                  </label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="e.g. Tonight in Indore"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Target Route
                  </label>
                  <select
                    value={targetRoute}
                    onChange={(e) => setTargetRoute(e.target.value as PromoTargetRoute)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    {PROMO_TARGET_ROUTES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} ({r.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Promo Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Banner headline"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Promo Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Supporting description"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    CTA Label
                  </label>
                  <input
                    type="text"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="e.g. Explore Food Trail"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Promo Image URL
                  </label>
                  <input
                    type="text"
                    value={promoImageUrl}
                    onChange={(e) => setPromoImageUrl(e.target.value)}
                    placeholder="https://... or /src/assets/images/..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Right Column: Live Visual Mobile Preview */}
        <div className="xl:col-span-5 surface-card p-5 space-y-4 xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Live App Preview</h3>
                <p className="text-xs text-slate-500">Real-time Hero & Promo Banner</p>
              </div>
            </div>
            {hasPromo && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                {targetRoute}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3.5">
            {/* Hero Card Preview */}
            <div className="relative h-40 w-full overflow-hidden rounded-xl border border-slate-200">
              <SafeImage
                src={heroImageUrl}
                alt={`${resolvedPreviewName} hero preview`}
                className="h-full w-full object-cover"
                fallbackLabel={resolvedPreviewName}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/25 to-transparent" />
              <div className="absolute bottom-3.5 left-4 right-4 text-white">
                <span className="inline-block rounded-md bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white mb-1">
                  {city.state}
                </span>
                <p className="text-lg font-bold leading-tight">{resolvedPreviewName}</p>
                <p className="text-xs text-slate-200 line-clamp-2 mt-0.5">
                  {resolvedHeroSubtitle || 'Add a hero subtitle to preview...'}
                </p>
              </div>
            </div>

            {/* Promo Banner Card Preview */}
            {hasPromo ? (
              <div className="relative h-36 w-full overflow-hidden rounded-xl border border-slate-200">
                <SafeImage
                  src={promoImageUrl}
                  alt={title || 'Promo preview'}
                  className="h-full w-full object-cover"
                  fallbackLabel="Promo Banner"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/60 to-slate-900/20 p-4 flex flex-col justify-between text-white">
                  <div>
                    {badgeText && (
                      <span className="inline-block rounded-full bg-[#0284C7] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        {badgeText}
                      </span>
                    )}
                    <p className="text-sm font-bold leading-snug mt-2">
                      {title || 'Promo Title Preview'}
                    </p>
                    <p className="text-xs text-slate-200 line-clamp-2 mt-0.5">
                      {subtitle || 'Promo subtitle appears here.'}
                    </p>
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                      {ctaLabel || 'Explore'}
                      <ArrowRight className="w-3 h-3 text-[#0284C7]" />
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-center text-xs text-slate-500">
                Promo banner hidden on mobile Home screen
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Home Screen Featured Places Toggle List */}
      <div className="surface-card overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Home &quot;Popular Places&quot; Carousel
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              One-click toggle for <span className="font-mono">isPopular</span> in{' '}
              <span className="font-mono">{city.collectionName}</span>
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#E0F2FE] px-3 py-1 text-xs font-semibold text-[#0284C7] tabular-nums">
            {popularPlaces.length} Featured
          </span>
        </div>

        {places.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No places added in <span className="font-mono">{city.collectionName}</span> yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {places.map((place) => (
              <div
                key={place.id}
                className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-11 w-11 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                    <SafeImage
                      src={place.imageUrl}
                      alt={place.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{place.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {place.category} · ★ {place.rating.toFixed(1)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={togglingId === place.id}
                  onClick={() => void handleTogglePopular(place)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 ${
                    place.isPopular
                      ? 'bg-[#0284C7] text-white hover:bg-[#0369A1]'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {togglingId === place.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Star className={`w-3.5 h-3.5 ${place.isPopular ? 'fill-white' : ''}`} />
                  )}
                  {place.isPopular ? 'Featured' : 'Feature'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deletingPromoOpen}
        title={`Delete promo banner for ${city.name}?`}
        description="Removes promoBanner from this city document and updates connected Android apps immediately."
        confirmLabel="Delete Banner"
        busy={deletingPromoBusy}
        onCancel={() => setDeletingPromoOpen(false)}
        onConfirm={() => void handleConfirmDeletePromo()}
      />
    </div>
  );
}
