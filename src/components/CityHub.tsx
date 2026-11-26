import { useState } from 'react';
import {
  Check,
  Edit3,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { CityDoc } from '../types.ts';
import { SafeImage } from './SafeImage.tsx';

interface CityHubProps {
  cities: CityDoc[];
  selectedCityId: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  onSelectCity: (city: CityDoc) => void;
  onAddCity: () => void;
  onEditCity: (city: CityDoc) => void;
  onDeleteCity: (city: CityDoc) => void;
}

export function CityHub({
  cities,
  selectedCityId,
  loading,
  isSuperAdmin,
  onSelectCity,
  onAddCity,
  onEditCity,
  onDeleteCity,
}: CityHubProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const filtered = cities.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isSuperAdmin ? 'Cities Registry' : 'Assigned Cities'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Select a city to scope the workspace to its collection, places, services, and map categories.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={onAddCity}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
          >
            <Plus className="w-4 h-4" />
            Add City
          </button>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="rounded-xl border border-sky-200 bg-[#E0F2FE]/50 px-4 py-3 flex items-start gap-3 text-xs text-sky-950">
          <ShieldCheck className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
          <span>
            Sub-Admin scope active: you have full content management permissions inside your assigned {cities.length === 1 ? 'city' : 'cities'}. Creating or deleting cities and managing admins are restricted to the Supreme Admin.
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cities by name, state, or slug..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'city' : 'cities'}
          </span>
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#E0F2FE] text-[#0284C7]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              aria-label="Grid view"
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#E0F2FE] text-[#0284C7]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              aria-label="Table view"
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="surface-card overflow-hidden animate-pulse">
              <div className="aspect-video bg-slate-100" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-1/2 bg-slate-100 rounded" />
                <div className="h-4 w-2/3 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card border-dashed p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0284C7] mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {cities.length === 0
              ? isSuperAdmin
                ? 'No cities configured yet'
                : 'No cities assigned to your account'
              : 'No cities match your search'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {cities.length === 0
              ? isSuperAdmin
                ? 'Create your first city to initialize its dedicated MongoDB collection and 6 fixed categories.'
                : 'Contact the Supreme Admin to assign one or more cities to your Sub-Admin account.'
              : 'Try adjusting your search query.'}
          </p>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={onAddCity}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First City
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">City</th>
                  <th className="py-3 px-4">Collection ID</th>
                  <th className="py-3 px-4">Coordinates</th>
                  <th className="py-3 px-4">Workspace</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((city) => {
                  const isSelected = city.id === selectedCityId;
                  return (
                    <tr
                      key={city.id}
                      className={`h-16 transition-colors ${
                        isSelected ? 'bg-sky-50/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-16 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                            <SafeImage
                              src={city.heroImageUrl}
                              alt={city.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{city.name}</p>
                            <p className="text-xs text-slate-500">{city.state}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700">
                          {city.collectionName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectCity(city)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-[#E0F2FE] text-[#0284C7]'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          {isSelected ? 'Selected' : 'Select City'}
                        </button>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditCity(city)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            aria-label={`Edit ${city.name}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => onDeleteCity(city)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              aria-label={`Delete ${city.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((city) => {
            const isSelected = city.id === selectedCityId;
            return (
              <article
                key={city.id}
                className={`surface-card overflow-hidden flex flex-col transition-all ${
                  isSelected
                    ? 'ring-2 ring-[#0284C7] border-[#0284C7]'
                    : 'hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectCity(city)}
                  className="relative aspect-video w-full overflow-hidden text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                >
                  <SafeImage
                    src={city.heroImageUrl}
                    alt={`${city.name}, ${city.state}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    fallbackLabel={city.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                  {isSelected && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-[#0284C7] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                      <Check className="w-3 h-3" />
                      Selected
                    </span>
                  )}
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <p className="text-xs font-medium text-sky-200">{city.state}</p>
                    <h3 className="text-lg font-bold tracking-tight">{city.name}</h3>
                  </div>
                </button>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                        {city.collectionName}
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {city.heroSubtitle || 'No hero subtitle configured yet.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectCity(city)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#E0F2FE] text-[#0284C7]'
                          : 'bg-[#0284C7] text-white hover:bg-[#0369A1]'
                      }`}
                    >
                      {isSelected ? 'Open Workspace' : 'Select & Manage'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditCity(city)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title={`Edit ${city.name}`}
                        aria-label={`Edit ${city.name}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => onDeleteCity(city)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title={`Delete ${city.name}`}
                          aria-label={`Delete ${city.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
