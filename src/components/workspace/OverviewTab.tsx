import {
  ArrowUpRight,
  Building2,
  Compass,
  FolderTree,
  LayoutTemplate,
  MapPin,
  Route,
  Star,
} from 'lucide-react';
import type { CategoryDoc, CityDoc, PlaceDoc, ServiceDoc, TripDoc } from '../../types.ts';
import { SafeImage } from '../SafeImage.tsx';

export type OverviewTargetTab =
  | 'home'
  | 'places'
  | 'categories'
  | 'services'
  | 'inspector';

interface OverviewTabProps {
  city: CityDoc;
  categories: CategoryDoc[];
  places: PlaceDoc[];
  services: ServiceDoc[];
  trips: TripDoc[];
  onNavigate: (tab: OverviewTargetTab) => void;
  onEditCityMeta: () => void;
}

export function OverviewTab({
  city,
  categories,
  places,
  services,
  trips,
  onNavigate,
  onEditCityMeta,
}: OverviewTabProps) {
  const totalSubCategories = categories.reduce(
    (sum, cat) => sum + cat.subCategories.length,
    0
  );
  const activeTripsCount = trips.filter((t) => t.status === 'UPCOMING').length;
  const popularPlaces = places.filter((p) => p.isPopular);

  const kpis = [
    {
      label: 'Total Places in City',
      value: places.length,
      helper: `${popularPlaces.length} featured on Home`,
      icon: Compass,
      target: 'places' as OverviewTargetTab,
    },
    {
      label: 'Dynamic Subcategories',
      value: totalSubCategories,
      helper: `Across ${categories.length} fixed categories`,
      icon: FolderTree,
      target: 'categories' as OverviewTargetTab,
    },
    {
      label: 'City Services',
      value: services.length,
      helper: 'Transport, Colleges, Pharmacy, Emergency',
      icon: Building2,
      target: 'services' as OverviewTargetTab,
    },
    {
      label: 'Active User Trips',
      value: activeTripsCount,
      helper: `${trips.length} total itineraries logged`,
      icon: Route,
      target: 'inspector' as OverviewTargetTab,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Clean KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigate(kpi.target)}
              className="surface-card p-5 text-left hover:border-sky-300 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-slate-500 flex items-center justify-between">
                <span>{kpi.helper}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0284C7] transition-colors" />
              </p>
            </button>
          );
        })}
      </div>

      {/* 2-Column City Summary & Featured Places */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* City Snapshot Card */}
        <div className="lg:col-span-5 surface-card overflow-hidden">
          <div className="relative h-44 w-full">
            <SafeImage
              src={city.heroImageUrl}
              alt={city.name}
              className="h-full w-full object-cover"
              fallbackLabel={city.name}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 text-white">
              <p className="text-xs font-medium text-sky-200">{city.state}</p>
              <h2 className="text-xl font-bold">{city.name}</h2>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              {city.heroSubtitle || 'Configure a home screen subtitle in City Home & Banner.'}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
              <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono font-medium text-slate-700">
                {city.collectionName}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-slate-500 tabular-nums">
                <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-[#0284C7]" />
                Edit Home Banner
              </button>
              <button
                type="button"
                onClick={onEditCityMeta}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                City Coordinates
              </button>
            </div>
          </div>
        </div>

        {/* Popular & Recent Places List */}
        <div className="lg:col-span-7 surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Featured & Recent Places
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Places synced to the Android app for {city.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('places')}
              className="rounded-lg bg-[#E0F2FE] px-3 py-1.5 text-xs font-semibold text-[#0284C7] hover:bg-sky-200/70 transition-colors whitespace-nowrap"
            >
              Manage Places
            </button>
          </div>

          {places.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-900">No places added yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Open Places & Attractions to add landmarks, food spots, and explore cards.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {places.slice(0, 5).map((place) => (
                <div
                  key={place.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
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
                        {place.category} · {place.openHours || place.address || place.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#D97706] tabular-nums">
                      ★ {place.rating.toFixed(1)}
                    </span>
                    {place.isPopular && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-medium text-[#059669]">
                        <Star className="w-3 h-3 fill-[#059669]" />
                        Popular
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
