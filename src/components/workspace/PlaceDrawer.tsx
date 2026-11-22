import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type {
  CategoryDoc,
  CityDoc,
  GeocodeResult,
  PlaceCategoryKey,
  PlaceDoc,
} from '../../types.ts';
import { PLACE_CATEGORIES } from '../../types.ts';
import { LocationPicker } from '../LocationPicker.tsx';
import { SafeImage } from '../SafeImage.tsx';

interface PlaceDrawerProps {
  open: boolean;
  city: CityDoc;
  categories: CategoryDoc[];
  editingPlace: PlaceDoc | null;
  duplicateSource: PlaceDoc | null;
  onClose: () => void;
  onSaved: (place: PlaceDoc, isNew: boolean) => void;
  onError: (msg: string) => void;
}

function toSlug(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function PlaceDrawer({
  open,
  city,
  categories,
  editingPlace,
  duplicateSource,
  onClose,
  onSaved,
  onError,
}: PlaceDrawerProps) {
  const source = editingPlace || duplicateSource;
  const isEditing = Boolean(editingPlace);

  const [name, setName] = useState(
    editingPlace ? editingPlace.name : duplicateSource ? `${duplicateSource.name} (Copy)` : ''
  );
  const [id, setId] = useState(
    editingPlace
      ? editingPlace.id
      : duplicateSource
        ? `${duplicateSource.id}_copy`
        : ''
  );
  const [idManuallyEdited, setIdManuallyEdited] = useState(Boolean(source));
  const [subtitle, setSubtitle] = useState(source?.subtitle ?? '');
  const [category, setCategory] = useState<PlaceCategoryKey>(source?.category ?? 'HERITAGE');
  const [subCategories, setSubCategories] = useState<string[]>(source?.subCategories ?? []);
  const [customSubInput, setCustomSubInput] = useState('');
  const [tagsText, setTagsText] = useState((source?.tags ?? []).join(', '));
  const [imageUrl, setImageUrl] = useState(source?.imageUrl ?? '');
  const [description, setDescription] = useState(source?.description ?? '');
  const [rating, setRating] = useState(source ? String(source.rating) : '4.5');
  const [reviewCountLabel, setReviewCountLabel] = useState(source?.reviewCountLabel ?? '');
  const [distanceLabel, setDistanceLabel] = useState(source?.distanceLabel ?? '');
  const [openHours, setOpenHours] = useState(source?.openHours ?? '');
  const [phone, setPhone] = useState(source?.phone ?? '');
  const [address, setAddress] = useState(source?.address ?? '');
  const [latitude, setLatitude] = useState(
    source ? String(source.latitude) : String(city.latitude)
  );
  const [longitude, setLongitude] = useState(
    source ? String(source.longitude) : String(city.longitude)
  );
  const [isPopular, setIsPopular] = useState(source?.isPopular ?? false);
  const [isTrending, setIsTrending] = useState(source?.isTrending ?? false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const matchingCategoryDoc = categories.find((c) => c.category === category);
  const availableSubTags = Array.from(
    new Set([...(matchingCategoryDoc?.subCategories ?? []), ...subCategories])
  );

  const computedSlug = isEditing ? editingPlace!.id : toSlug(id || name);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && !idManuallyEdited) {
      setId(toSlug(val));
    }
  };

  const toggleSubCategory = (tag: string) => {
    setSubCategories((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomSub = () => {
    const trimmed = customSubInput.trim();
    if (!trimmed) return;
    if (!subCategories.includes(trimmed)) {
      setSubCategories((prev) => [...prev, trimmed]);
    }
    setCustomSubInput('');
  };

  const handleAutoSelectLocation = (res: GeocodeResult) => {
    if (!name.trim() && res.shortName) {
      handleNameChange(res.shortName);
    }
    if (res.address) {
      setAddress(res.address);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onError('Place name is required.');
      return;
    }
    if (!computedSlug || !/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(computedSlug)) {
      onError('Place ID must be a valid lowercase slug (e.g. rajwada_palace).');
      return;
    }
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
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
      onError('Valid latitude (-90..90) and longitude (-180..180) are required.');
      return;
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      onError('Rating must be between 0.0 and 5.0.');
      return;
    }

    const tags = Array.from(
      new Set(
        tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );

    setSaving(true);
    try {
      const payload: Partial<PlaceDoc> = {
        id: computedSlug,
        cityId: city.id,
        docType: 'place',
        name: name.trim(),
        subtitle: subtitle.trim(),
        category,
        subCategories,
        tags,
        imageUrl: imageUrl.trim(),
        description: description.trim(),
        rating: Math.round(ratingNum * 10) / 10,
        reviewCountLabel: reviewCountLabel.trim(),
        distanceLabel: distanceLabel.trim(),
        openHours: openHours.trim(),
        phone: phone.trim(),
        address: address.trim(),
        latitude: latNum,
        longitude: lngNum,
        isPopular,
        isTrending,
      };

      if (isEditing) {
        const res = await api.updatePlace(city.id, editingPlace!.id, payload);
        onSaved(res.place, false);
      } else {
        const res = await api.createPlace(city.id, payload);
        onSaved(res.place, true);
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-drawer-title"
    >
      <div className="w-full max-w-[640px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Sticky Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shrink-0">
          <div>
            <h2 id="place-drawer-title" className="text-lg font-bold text-slate-900">
              {isEditing
                ? `Edit Place — ${editingPlace!.name}`
                : duplicateSource
                  ? `Duplicate Place in ${city.name}`
                  : `Add Place to ${city.name}`}
            </h2>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              {city.collectionName} · docType: &quot;place&quot;
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Sections */}
        <form
          id="place-drawer-form"
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {/* Section 1: Basic Details */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              1. Basic Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Place Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Rajwada Palace"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Slug ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={isEditing ? editingPlace!.id : id}
                  onChange={(e) => {
                    setIdManuallyEdited(true);
                    setId(e.target.value.toLowerCase());
                  }}
                  placeholder="rajwada_palace"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 disabled:text-slate-500 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Short 1-line subtitle displayed under title"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rich editorial description shown in the Place Detail screen..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Classification */}
          <section className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              2. Classification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PlaceCategoryKey)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="architecture, history, sunset"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
            </div>

            {/* Dynamic Subcategory Multi-Select Chips */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Subcategories ({city.name} → {category})
                </span>
                <span className="text-xs font-medium text-[#0284C7] tabular-nums">
                  {subCategories.length} selected
                </span>
              </div>

              {availableSubTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableSubTags.map((tag) => {
                    const selected = subCategories.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleSubCategory(tag)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                          selected
                            ? 'bg-[#0284C7] text-white'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-sky-300'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSubInput}
                  onChange={(e) => setCustomSubInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSub();
                    }
                  }}
                  placeholder="Type a custom subcategory..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSub}
                  disabled={!customSubInput.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Custom
                </button>
              </div>
            </div>

            {/* Popular & Trending Toggle Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isPopular}
                onClick={() => setIsPopular((v) => !v)}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  isPopular ? 'border-sky-200 bg-[#E0F2FE]/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="text-sm font-semibold text-slate-900 block">Popular</span>
                  <span className="text-xs text-slate-500">Feature on Home screen</span>
                </div>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                    isPopular ? 'bg-[#0284C7]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                      isPopular ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={isTrending}
                onClick={() => setIsTrending((v) => !v)}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  isTrending ? 'border-amber-200 bg-[#FFFBEB]/70' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="text-sm font-semibold text-slate-900 block">Trending</span>
                  <span className="text-xs text-slate-500">Highlight in Explore</span>
                </div>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                    isTrending ? 'bg-[#D97706]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                      isTrending ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            </div>
          </section>

          {/* Section 3: Location & Contact */}
          <section className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              3. Location & Contact
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Rating (0.0 – 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Review Count Label
                </label>
                <input
                  type="text"
                  value={reviewCountLabel}
                  onChange={(e) => setReviewCountLabel(e.target.value)}
                  placeholder="e.g. 2.4k Reviews"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Distance Label
                </label>
                <input
                  type="text"
                  value={distanceLabel}
                  onChange={(e) => setDistanceLabel(e.target.value)}
                  placeholder="e.g. 1.2 km"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Open Hours
                </label>
                <input
                  type="text"
                  value={openHours}
                  onChange={(e) => setOpenHours(e.target.value)}
                  placeholder="9:00 AM – 8:00 PM"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 ..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
            </div>

            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              defaultCenter={{ lat: city.latitude, lng: city.longitude }}
              onChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
              onSelectSuggestion={handleAutoSelectLocation}
              searchPlaceholder={`Search landmark or address in ${city.name}...`}
              label="Location Coordinates (Auto-Select Search / Map Pin & Manual Entry)"
            />
          </section>

          {/* Section 4: Media */}
          <section className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              4. Media
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Image URL
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... or /src/assets/images/..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Displayed on Place cards and the Place Detail screen.
                </p>
              </div>
              <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200">
                <SafeImage
                  src={imageUrl}
                  alt={name || 'Place preview'}
                  className="h-full w-full object-cover"
                  fallbackLabel="Image Preview"
                />
              </div>
            </div>
          </section>
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
            form="place-drawer-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
