import { useEffect, useState } from 'react';
import {
  Copy,
  Edit3,
  FileJson,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { CategoryDoc, CityDoc, PlaceCategoryKey, PlaceDoc } from '../../types.ts';
import { FIXED_CATEGORIES, PLACE_CATEGORIES } from '../../types.ts';
import { ConfirmDialog } from '../ConfirmDialog.tsx';
import { SafeImage } from '../SafeImage.tsx';
import { BulkImportModal } from './BulkImportModal.tsx';
import { PlaceDrawer } from './PlaceDrawer.tsx';

interface PlacesTabProps {
  city: CityDoc;
  categories: CategoryDoc[];
  places: PlaceDoc[];
  externalAddSignal?: number;
  externalSearch?: string;
  onPlacesChanged: (places: PlaceDoc[]) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

const CORE_CATEGORY_KEYS = FIXED_CATEGORIES.map((c) => c.category);
const MAP_CATEGORY_KEYS: PlaceCategoryKey[] = [
  'HOSPITAL',
  'ATM',
  'PHARMACY',
  'TRANSPORT',
  'EMERGENCY',
];

export function PlacesTab({
  city,
  categories,
  places,
  externalAddSignal = 0,
  externalSearch = '',
  onPlacesChanged,
  onToast,
}: PlacesTabProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PlaceCategoryKey>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [onlyPopular, setOnlyPopular] = useState(false);
  const [onlyTrending, setOnlyTrending] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<PlaceDoc | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<PlaceDoc | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deletingPlace, setDeletingPlace] = useState<PlaceDoc | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    if (externalAddSignal > 0) {
      setEditingPlace(null);
      setDuplicateSource(null);
      setDrawerOpen(true);
    }
  }, [externalAddSignal]);

  const effectiveSearch = (search || externalSearch).trim().toLowerCase();

  // Dynamic subcategories available for filter dropdown
  const allSubCategories = Array.from(
    new Set([
      ...categories.flatMap((c) => c.subCategories),
      ...places.flatMap((p) => p.subCategories),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const filtered = places.filter((p) => {
    if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
    if (subCategoryFilter !== 'ALL' && !p.subCategories.includes(subCategoryFilter)) return false;
    if (onlyPopular && !p.isPopular) return false;
    if (onlyTrending && !p.isTrending) return false;
    if (!effectiveSearch) return true;
    return (
      p.name.toLowerCase().includes(effectiveSearch) ||
      p.id.toLowerCase().includes(effectiveSearch) ||
      p.subtitle.toLowerCase().includes(effectiveSearch) ||
      p.subCategories.some((s) => s.toLowerCase().includes(effectiveSearch)) ||
      p.tags.some((t) => t.toLowerCase().includes(effectiveSearch))
    );
  });

  const openAdd = () => {
    setEditingPlace(null);
    setDuplicateSource(null);
    setDrawerOpen(true);
  };

  const openEdit = (place: PlaceDoc) => {
    setDuplicateSource(null);
    setEditingPlace(place);
    setDrawerOpen(true);
  };

  const openDuplicate = (place: PlaceDoc) => {
    setEditingPlace(null);
    setDuplicateSource(place);
    setDrawerOpen(true);
  };

  const handleSaved = (saved: PlaceDoc, isNew: boolean) => {
    if (isNew) {
      onPlacesChanged([...places, saved].sort((a, b) => a.name.localeCompare(b.name)));
      onToast('success', `Changes saved to ${city.name}`);
    } else {
      onPlacesChanged(places.map((p) => (p.id === saved.id ? saved : p)));
      onToast('success', `Changes saved to ${city.name}`);
    }
    setDrawerOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlace) return;
    setDeletingBusy(true);
    try {
      await api.deletePlace(city.id, deletingPlace.id);
      onPlacesChanged(places.filter((p) => p.id !== deletingPlace.id));
      onToast('success', `Deleted "${deletingPlace.name}" from ${city.name}`);
      setDeletingPlace(null);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Places & Attractions
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage <span className="font-mono text-xs">{city.collectionName}</span> items with <span className="font-mono text-xs">docType: &quot;place&quot;</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileJson className="w-4 h-4 text-[#0284C7]" />
            Bulk Import
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Place
          </button>
        </div>
      </div>

      {/* Clean Filter Toolbar */}
      <div className="surface-card p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search places in ${city.name}...`}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Subcategory Filter Dropdown */}
            <select
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              aria-label="Filter by subcategory"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              <option value="ALL">All Subcategories</option>
              {allSubCategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            {/* Popular & Trending Quick Toggles */}
            <button
              type="button"
              onClick={() => setOnlyPopular((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                onlyPopular
                  ? 'bg-[#E0F2FE] text-[#0284C7] border border-sky-200'
                  : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyPopular ? 'fill-[#0284C7]' : ''}`} />
              Popular
            </button>

            <button
              type="button"
              onClick={() => setOnlyTrending((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                onlyTrending
                  ? 'bg-[#FFFBEB] text-[#D97706] border border-amber-200'
                  : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Trending
            </button>
          </div>
        </div>

        {/* Category Filter Pills (All + 6 Core Categories + Map Category Selector) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              categoryFilter === 'ALL'
                ? 'bg-[#0284C7] text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({places.length})
          </button>

          {CORE_CATEGORY_KEYS.map((key) => {
            const count = places.filter((p) => p.category === key).length;
            const active = categoryFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0284C7] text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {key} ({count})
              </button>
            );
          })}

          <select
            value={MAP_CATEGORY_KEYS.includes(categoryFilter as PlaceCategoryKey) ? categoryFilter : ''}
            onChange={(e) => {
              const val = e.target.value as PlaceCategoryKey | '';
              setCategoryFilter(val || 'ALL');
            }}
            aria-label="Filter by map utility category"
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:border-[#0284C7] focus:outline-none ${
              MAP_CATEGORY_KEYS.includes(categoryFilter as PlaceCategoryKey)
                ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0284C7] font-semibold'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <option value="">Map Pins (Hospital / ATM / ...)</option>
            {PLACE_CATEGORIES.filter((c) => MAP_CATEGORY_KEYS.includes(c.value)).map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({places.filter((p) => p.category === c.value).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Structured Data Table (64px+ Row Height) */}
      {filtered.length === 0 ? (
        <div className="surface-card border-dashed p-12 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {places.length === 0
              ? `No places in ${city.collectionName} yet`
              : 'No places match your active filters'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Add a place with auto-selecting location search or import a JSON array.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1]"
          >
            <Plus className="w-4 h-4" />
            Add First Place
          </button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Place</th>
                  <th className="py-3 px-4">Category & Subcategories</th>
                  <th className="py-3 px-4">Rating & Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((place) => (
                  <tr
                    key={place.id}
                    className="min-h-[68px] hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3.5 min-w-[230px]">
                        <div className="h-11 w-11 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                          <SafeImage
                            src={place.imageUrl}
                            alt={place.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{place.name}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[260px]">
                            {place.subtitle || place.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="inline-flex items-center rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[11px] font-semibold text-[#0284C7]">
                          {place.category}
                        </span>
                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                          {place.subCategories.slice(0, 3).map((sub) => (
                            <span
                              key={sub}
                              className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
                            >
                              {sub}
                            </span>
                          ))}
                          {place.subCategories.length > 3 && (
                            <span className="text-[11px] text-slate-400 px-1">
                              +{place.subCategories.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#D97706] tabular-nums">
                          ★ {place.rating.toFixed(1)}
                        </span>
                        <p className="text-xs text-slate-500 whitespace-nowrap">
                          {place.openHours || 'Hours not set'}
                        </p>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {place.isPopular && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-medium text-[#059669]">
                            Popular
                          </span>
                        )}
                        {place.isTrending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#D97706]">
                            Trending
                          </span>
                        )}
                        {!place.isPopular && !place.isTrending && (
                          <span className="text-xs text-slate-400">Standard</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(place)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="Edit place"
                          aria-label={`Edit ${place.name}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDuplicate(place)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0284C7] transition-colors"
                          title="Duplicate place"
                          aria-label={`Duplicate ${place.name}`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPlace(place)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-[#DC2626] transition-colors"
                          title="Delete place"
                          aria-label={`Delete ${place.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawerOpen && (
        <PlaceDrawer
          open={drawerOpen}
          city={city}
          categories={categories}
          editingPlace={editingPlace}
          duplicateSource={duplicateSource}
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
          onError={(msg) => onToast('error', msg)}
        />
      )}

      {bulkOpen && (
        <BulkImportModal
          open={bulkOpen}
          city={city}
          onClose={() => setBulkOpen(false)}
          onImported={(inserted, skippedCount) => {
            onPlacesChanged(
              [...places, ...inserted].sort((a, b) => a.name.localeCompare(b.name))
            );
            onToast(
              'success',
              `Imported ${inserted.length} place(s) to ${city.name}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`
            );
            setBulkOpen(false);
          }}
          onError={(msg) => onToast('error', msg)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingPlace)}
        title={`Delete "${deletingPlace?.name ?? ''}"?`}
        description={`This removes the document permanently from ${city.collectionName}.`}
        busy={deletingBusy}
        onCancel={() => setDeletingPlace(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
