import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { api } from '../lib/api.ts';
import type { CityDoc, GeocodeResult, PromoTargetRoute } from '../types.ts';
import { PROMO_TARGET_ROUTES } from '../types.ts';
import { LocationPicker } from './LocationPicker.tsx';
import { SafeImage } from './SafeImage.tsx';

interface CityModalProps {
  open: boolean;
  city: CityDoc | null;
  onClose: () => void;
  onSaved: (saved: CityDoc, isNew: boolean) => void;
  onError: (msg: string) => void;
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function CityModal({ open, city, onClose, onSaved, onError }: CityModalProps) {
  const isEditing = Boolean(city);

  const [name, setName] = useState(city?.name ?? '');
  const [id, setId] = useState(city?.id ?? '');
  const [idManuallyEdited, setIdManuallyEdited] = useState(Boolean(city));
  const [state, setState] = useState(city?.state ?? '');
  const [latitude, setLatitude] = useState(city ? String(city.latitude) : '22.7196');
  const [longitude, setLongitude] = useState(city ? String(city.longitude) : '75.8577');
  const [heroImageUrl, setHeroImageUrl] = useState(city?.heroImageUrl ?? '');
  const [heroSubtitle, setHeroSubtitle] = useState(city?.heroSubtitle ?? '');

  const [promoId, setPromoId] = useState(city?.promoBanner?.id ?? '');
  const [promoBadgeText, setPromoBadgeText] = useState(city?.promoBanner?.badgeText ?? 'Featured');
  const [promoTitle, setPromoTitle] = useState(city?.promoBanner?.title ?? '');
  const [promoSubtitle, setPromoSubtitle] = useState(city?.promoBanner?.subtitle ?? '');
  const [promoCtaLabel, setPromoCtaLabel] = useState(city?.promoBanner?.ctaLabel ?? 'Explore City');
  const [promoImageUrl, setPromoImageUrl] = useState(city?.promoBanner?.imageUrl ?? '');
  const [promoTargetRoute, setPromoTargetRoute] = useState<PromoTargetRoute>(
    city?.promoBanner?.targetRoute ?? 'explore'
  );

  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const computedSlug = isEditing ? city!.id : toSlug(id || name);
  const collectionName = `city_${computedSlug || 'city_id'}`;

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    if (!isEditing && !idManuallyEdited) {
      setId(toSlug(nextName));
    }
  };

  const handleAutoSelectLocation = (res: GeocodeResult) => {
    if (!name.trim() && (res.city || res.shortName)) {
      handleNameChange(res.city || res.shortName);
    }
    if (!state.trim() && res.state) {
      setState(res.state);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (!name.trim() || !state.trim()) {
      onError('City name and state are required.');
      return;
    }
    if (!computedSlug || !/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(computedSlug)) {
      onError('City ID must be a valid lowercase slug (e.g. indore).');
      return;
    }
    if (
      latitude === '' ||
      longitude === '' ||
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      onError('Enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<CityDoc> = {
        id: computedSlug,
        name: name.trim(),
        state: state.trim(),
        latitude: latNum,
        longitude: lngNum,
        heroImageUrl: heroImageUrl.trim(),
        collectionName: `city_${computedSlug}`,
        heroSubtitle: heroSubtitle.trim(),
        promoBanner: {
          id: toSlug(promoId) || `${computedSlug}_promo`,
          badgeText: promoBadgeText.trim(),
          title: promoTitle.trim(),
          subtitle: promoSubtitle.trim(),
          ctaLabel: promoCtaLabel.trim() || 'Explore',
          imageUrl: promoImageUrl.trim(),
          targetRoute: promoTargetRoute,
        },
      };

      if (isEditing) {
        const res = await api.updateCity(city!.id, payload);
        onSaved(res.city, false);
      } else {
        const res = await api.createCity(payload);
        onSaved(res.city, true);
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="city-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shrink-0">
          <div>
            <h2 id="city-modal-title" className="text-lg font-bold text-slate-900">
              {isEditing ? `Edit City — ${city!.name}` : 'Add New City'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? `Updates cities doc & preserves collection ${collectionName}`
                : `Automatically creates ${collectionName} and 6 fixed category docs`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form id="city-modal-form" onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              City Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  City Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Indore"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  State / Region <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Madhya Pradesh"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  City Slug ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={isEditing ? city!.id : id}
                  onChange={(e) => {
                    setIdManuallyEdited(true);
                    setId(e.target.value.toLowerCase());
                  }}
                  placeholder="indore"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 disabled:text-slate-500 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Personal Collection Name (Auto)
                </label>
                <input
                  type="text"
                  readOnly
                  value={collectionName}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Media & Subtitle
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Home Screen Hero Subtitle
              </label>
              <input
                type="text"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="e.g. Cleanest City & Culinary Capital of Central India"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Hero Image URL
                </label>
                <input
                  type="text"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="https://... or /src/assets/images/..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200">
                <SafeImage
                  src={heroImageUrl}
                  alt={`${name || 'City'} hero preview`}
                  className="h-full w-full object-cover"
                  fallbackLabel="Hero Preview"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
              onSelectSuggestion={handleAutoSelectLocation}
              searchPlaceholder="Search city name (e.g. Udaipur, Rajasthan) to auto-fill coordinates..."
              label="City Center Coordinates (Auto-Select & Manual Entry)"
            />
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Home Promo Banner
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Promo Title
                </label>
                <input
                  type="text"
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  placeholder="e.g. Weekend Food Trail"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Badge Text
                </label>
                <input
                  type="text"
                  value={promoBadgeText}
                  onChange={(e) => setPromoBadgeText(e.target.value)}
                  placeholder="e.g. Tonight in Indore"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Promo Subtitle
                </label>
                <input
                  type="text"
                  value={promoSubtitle}
                  onChange={(e) => setPromoSubtitle(e.target.value)}
                  placeholder="Short description shown on the mobile home promo card"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  CTA Button Label
                </label>
                <input
                  type="text"
                  value={promoCtaLabel}
                  onChange={(e) => setPromoCtaLabel(e.target.value)}
                  placeholder="e.g. Explore Now"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Target Route
                </label>
                <select
                  value={promoTargetRoute}
                  onChange={(e) => setPromoTargetRoute(e.target.value as PromoTargetRoute)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  {PROMO_TARGET_ROUTES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} ({r.value})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Promo Banner ID
                </label>
                <input
                  type="text"
                  value={promoId}
                  onChange={(e) => setPromoId(e.target.value)}
                  placeholder={`${computedSlug || 'city'}_promo`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
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
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/70 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="city-modal-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create City & Initialize'}
          </button>
        </div>
      </div>
    </div>
  );
}
