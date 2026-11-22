import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  ChevronRight,
  Compass,
  FolderTree,
  Globe2,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Route,
  Search,
  X,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import type { CategoryDoc, CityDoc, PlaceDoc, ServiceDoc, TripDoc } from '../types.ts';
import { CityHub } from './CityHub.tsx';
import { SafeImage } from './SafeImage.tsx';
import { CategoriesTab } from './workspace/CategoriesTab.tsx';
import { HomePromoTab } from './workspace/HomePromoTab.tsx';
import { InspectorTab } from './workspace/InspectorTab.tsx';
import { OverviewTab } from './workspace/OverviewTab.tsx';
import { PlacesTab } from './workspace/PlacesTab.tsx';
import { ServicesTab } from './workspace/ServicesTab.tsx';

export type AdminSectionKey =
  | 'overview'
  | 'home'
  | 'places'
  | 'categories'
  | 'services'
  | 'inspector'
  | 'cities';

interface CityWorkspaceProps {
  cities: CityDoc[];
  selectedCity: CityDoc | null;
  loadingCities: boolean;
  dbMode: 'mongodb' | 'local';
  userEmail: string;
  onSelectCity: (city: CityDoc) => void;
  onCityUpdated: (city: CityDoc) => void;
  onAddCity: () => void;
  onEditCity: (city: CityDoc) => void;
  onDeleteCity: (city: CityDoc) => void;
  onLogout: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const CITY_NAV_ITEMS: ReadonlyArray<{
  key: Exclude<AdminSectionKey, 'cities'>;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'home', label: 'City Home & Banner', icon: LayoutTemplate },
  { key: 'places', label: 'Places & Attractions', icon: Compass },
  { key: 'categories', label: 'Categories & Subcategories', icon: FolderTree },
  { key: 'services', label: 'City Services', icon: Building2 },
  { key: 'inspector', label: 'User Trips', icon: Route },
];

const SECTION_TITLES: Record<AdminSectionKey, string> = {
  overview: 'Overview',
  home: 'City Home & Banner',
  places: 'Places & Attractions',
  categories: 'Categories & Subcategories',
  services: 'City Services',
  inspector: 'User Trips',
  cities: 'Cities Registry',
};

export function CityWorkspace({
  cities,
  selectedCity,
  loadingCities,
  dbMode,
  userEmail,
  onSelectCity,
  onCityUpdated,
  onAddCity,
  onEditCity,
  onDeleteCity,
  onLogout,
  onToast,
}: CityWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<AdminSectionKey>(
    selectedCity ? 'overview' : 'cities'
  );
  const hasAutoOpenedRef = useRef(Boolean(selectedCity));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [addPlaceSignal, setAddPlaceSignal] = useState(0);

  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [places, setPlaces] = useState<PlaceDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [trips, setTrips] = useState<TripDoc[]>([]);
  const [loadingCityData, setLoadingCityData] = useState(false);
  const [syncingApps, setSyncingApps] = useState(false);

  useEffect(() => {
    if (!selectedCity) {
      if (activeSection !== 'cities') setActiveSection('cities');
    } else if (!hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      setActiveSection('overview');
    }
  }, [selectedCity, activeSection]);

  useEffect(() => {
    if (!selectedCity) {
      setCategories([]);
      setPlaces([]);
      setServices([]);
      setTrips([]);
      return;
    }

    let active = true;
    setLoadingCityData(true);
    Promise.all([
      api.listCategories(selectedCity.id),
      api.listPlaces(selectedCity.id),
      api.listServices(selectedCity.id),
      api.listTrips(selectedCity.id, ''),
    ])
      .then(([catRes, placesRes, servicesRes, tripsRes]) => {
        if (!active) return;
        setCategories(catRes.categories);
        setPlaces(placesRes.places);
        setServices(servicesRes.services);
        setTrips(tripsRes.trips);
      })
      .catch((err) => {
        if (!active) return;
        onToast('error', (err as Error).message);
      })
      .finally(() => {
        if (active) setLoadingCityData(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity?.id]);

  const handleTriggerAddPlace = () => {
    if (!selectedCity) {
      onAddCity();
      return;
    }
    setActiveSection('places');
    setAddPlaceSignal((n) => n + 1);
  };

  const handleSyncLiveApps = async () => {
    if (syncingApps) return;
    setSyncingApps(true);
    try {
      await api.syncLiveApps(selectedCity?.id || '');
      onToast('success', 'Live refresh sent to City Companion apps');
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setSyncingApps(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Brand Mark */}
      <div className="h-16 px-4 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0284C7] text-white shrink-0">
          <Compass className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-slate-900 truncate">
            City Companion
          </p>
          <p className="text-[11px] font-medium text-slate-500 leading-none">
            Admin Console
          </p>
        </div>
      </div>

      {/* Prominent Active City Context Card */}
      <div className="p-3.5 border-b border-slate-200">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Active City Context
            </span>
            {selectedCity && (
              <span className="font-mono text-[10px] font-medium text-[#0284C7] bg-[#E0F2FE] px-1.5 py-0.5 rounded">
                {selectedCity.collectionName}
              </span>
            )}
          </div>

          {selectedCity ? (
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                <SafeImage
                  src={selectedCity.heroImageUrl}
                  alt={selectedCity.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {selectedCity.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{selectedCity.state}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>No city selected</span>
            </div>
          )}

          <div>
            <label htmlFor="sidebar-city-switcher" className="sr-only">
              Switch City
            </label>
            <select
              id="sidebar-city-switcher"
              value={selectedCity?.id ?? ''}
              onChange={(e) => {
                const next = cities.find((c) => c.id === e.target.value);
                if (next) {
                  onSelectCity(next);
                  if (activeSection === 'cities') setActiveSection('overview');
                }
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              <option value="" disabled>
                Switch City...
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  Switch: {c.name} ({c.state})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto" aria-label="Workspace navigation">
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            City Workspace
          </p>
          {CITY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            const disabled = !selectedCity;
            return (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setActiveSection(item.key);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors text-left ${
                  active
                    ? 'bg-[#E0F2FE] text-[#0284C7]'
                    : disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#0284C7]' : ''}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-4">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Global
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveSection('cities');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors text-left ${
              activeSection === 'cities'
                ? 'bg-[#E0F2FE] text-[#0284C7]'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Globe2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Cities Registry</span>
            </span>
            <span className="font-mono text-[11px] tabular-nums opacity-75">
              {cities.length}
            </span>
          </button>
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3.5 border-t border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{userEmail}</p>
          <p className="text-[11px] text-slate-500">
            {dbMode === 'mongodb' ? 'MongoDB' : 'Local Store'}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Fixed Left Sidebar (256px on desktop) */}
      <aside className="hidden lg:block w-[256px] shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Collapsible Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[80] flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[260px] max-w-full bg-white h-full border-r border-slate-200 z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Right Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Header (64px height) */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => setActiveSection('cities')}
                className="text-slate-500 hover:text-slate-900 font-medium transition-colors whitespace-nowrap"
              >
                Cities
              </button>
              {selectedCity && activeSection !== 'cities' && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setActiveSection('overview')}
                    className="text-slate-600 hover:text-slate-900 font-medium transition-colors truncate max-w-[140px]"
                  >
                    {selectedCity.name}
                  </button>
                </>
              )}
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900 truncate">
                {SECTION_TITLES[activeSection]}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeSection === 'places' && (
              <div className="relative hidden md:block w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Quick search places..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0284C7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
            )}

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#059669]">
              {dbMode === 'mongodb' ? 'MongoDB Live' : 'Local Synced'}
            </span>

            <button
              type="button"
              onClick={() => void handleSyncLiveApps()}
              disabled={syncingApps}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 transition-colors whitespace-nowrap"
              title="Push instant refresh notification to City Companion Android apps"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0284C7] ${syncingApps ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Live Apps</span>
            </button>

            {activeSection === 'cities' || !selectedCity ? (
              <button
                type="button"
                onClick={onAddCity}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0369A1] transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add City
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTriggerAddPlace}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0369A1] transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Place
              </button>
            )}
          </div>
        </header>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'cities' || !selectedCity ? (
            <CityHub
              cities={cities}
              selectedCityId={selectedCity?.id ?? null}
              loading={loadingCities}
              onSelectCity={(c) => {
                onSelectCity(c);
                setActiveSection('overview');
              }}
              onAddCity={onAddCity}
              onEditCity={onEditCity}
              onDeleteCity={onDeleteCity}
            />
          ) : loadingCityData ? (
            <div className="space-y-5 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="surface-card h-28 bg-white" />
                ))}
              </div>
              <div className="surface-card h-72 bg-white" />
            </div>
          ) : (
            <>
              {activeSection === 'overview' && (
                <OverviewTab
                  city={selectedCity}
                  categories={categories}
                  places={places}
                  services={services}
                  trips={trips}
                  onNavigate={(tab) => setActiveSection(tab)}
                  onEditCityMeta={() => onEditCity(selectedCity)}
                />
              )}

              {activeSection === 'home' && (
                <HomePromoTab
                  city={selectedCity}
                  places={places}
                  onCityUpdated={onCityUpdated}
                  onPlaceUpdated={(updated) =>
                    setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                  }
                  onToast={onToast}
                />
              )}

              {activeSection === 'places' && (
                <PlacesTab
                  city={selectedCity}
                  categories={categories}
                  places={places}
                  externalAddSignal={addPlaceSignal}
                  externalSearch={quickSearch}
                  onPlacesChanged={setPlaces}
                  onToast={onToast}
                />
              )}

              {activeSection === 'categories' && (
                <CategoriesTab
                  city={selectedCity}
                  categories={categories}
                  onCategoryUpdated={(updated) =>
                    setCategories((prev) =>
                      prev.map((c) => (c.category === updated.category ? updated : c))
                    )
                  }
                  onToast={onToast}
                />
              )}

              {activeSection === 'services' && (
                <ServicesTab
                  city={selectedCity}
                  services={services}
                  onServicesChanged={setServices}
                  onToast={onToast}
                />
              )}

              {activeSection === 'inspector' && (
                <InspectorTab city={selectedCity} onToast={onToast} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
