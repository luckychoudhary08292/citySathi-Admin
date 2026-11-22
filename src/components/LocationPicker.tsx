import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import { api } from '../lib/api.ts';
import type { GeocodeResult } from '../types.ts';

interface LocationPickerProps {
  latitude: number | string;
  longitude: number | string;
  onChange: (lat: string, lng: string) => void;
  onSelectSuggestion?: (result: GeocodeResult) => void;
  defaultCenter?: { lat: number; lng: number };
  searchPlaceholder?: string;
  label?: string;
}

const DEFAULT_FALLBACK_CENTER = { lat: 22.7196, lng: 75.8577 };

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  onSelectSuggestion,
  defaultCenter,
  searchPlaceholder = 'Search location, landmark, or city to auto-fill...',
  label = 'Location Coordinates (Auto-Select & Manual Entry)',
}: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState('');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelectSuggestion);
  onChangeRef.current = onChange;
  onSelectRef.current = onSelectSuggestion;

  const parsedLat = Number(latitude);
  const parsedLng = Number(longitude);
  const hasValidCoords =
    latitude !== '' &&
    longitude !== '' &&
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  const initialCenter = hasValidCoords
    ? { lat: parsedLat, lng: parsedLng }
    : defaultCenter || DEFAULT_FALLBACK_CENTER;

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: hasValidCoords ? 14 : 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.circleMarker([initialCenter.lat, initialCenter.lng], {
      radius: 9,
      fillColor: '#0284C7',
      color: '#FFFFFF',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickedLat = Math.round(e.latlng.lat * 1000000) / 1000000;
      const clickedLng = Math.round(e.latlng.lng * 1000000) / 1000000;
      marker.setLatLng([clickedLat, clickedLng]);
      onChangeRef.current(String(clickedLat), String(clickedLng));
    });

    mapRef.current = map;
    markerRef.current = marker;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !hasValidCoords) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - parsedLat) > 0.000005 || Math.abs(current.lng - parsedLng) > 0.000005) {
      markerRef.current.setLatLng([parsedLat, parsedLng]);
      mapRef.current.panTo([parsedLat, parsedLng], { animate: true });
    }
  }, [hasValidCoords, parsedLat, parsedLng]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const res = await api.geocode(trimmed);
      setResults(res.results);
      setShowDropdown(true);
    } catch (err) {
      setSearchError((err as Error).message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePickResult = (item: GeocodeResult) => {
    const latStr = String(item.latitude);
    const lngStr = String(item.longitude);
    onChange(latStr, lngStr);
    onSelectSuggestion?.(item);
    setQuery(item.shortName);
    setShowDropdown(false);
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([item.latitude, item.longitude]);
      mapRef.current.setView([item.latitude, item.longitude], 15, { animate: true });
    }
  };

  const handleReverseLookup = async () => {
    if (!hasValidCoords) return;
    setReversing(true);
    setSearchError('');
    try {
      const res = await api.reverseGeocode(parsedLat, parsedLng);
      onSelectSuggestion?.(res.result);
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setReversing(false);
    }
  };

  const handleCenterOnCity = () => {
    if (!defaultCenter) return;
    onChange(String(defaultCenter.lat), String(defaultCenter.lng));
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([defaultCenter.lat, defaultCenter.lng]);
      mapRef.current.setView([defaultCenter.lat, defaultCenter.lng], 13, { animate: true });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-800">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {defaultCenter && (
            <button
              type="button"
              onClick={handleCenterOnCity}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
            >
              <Crosshair className="w-3.5 h-3.5 text-sky-600" />
              City Center
            </button>
          )}
          {onSelectSuggestion && (
            <button
              type="button"
              onClick={handleReverseLookup}
              disabled={!hasValidCoords || reversing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
            >
              {reversing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Auto-Fill Address from Pin
            </button>
          )}
        </div>
      </div>

      {/* Mode 1: Auto-Selecting Location Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching || query.trim().length < 2}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find Place
          </button>
        </div>

        {searchError && (
          <p className="mt-1.5 text-xs text-red-600">{searchError}</p>
        )}

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500">
                No matching locations found. Try adding the city name or click directly on the map below.
              </div>
            ) : (
              results.map((item, idx) => (
                <button
                  key={`${item.latitude}_${item.longitude}_${idx}`}
                  type="button"
                  onClick={() => handlePickResult(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-sky-50/70 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.shortName}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{item.displayName}</p>
                  </div>
                  <span className="font-mono text-xs text-sky-700 tabular-nums shrink-0 pt-0.5">
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Interactive Click-to-Pin Map */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <div ref={mapContainerRef} className="h-48 w-full" />
      </div>
      <p className="text-xs text-slate-500">
        Click anywhere on the map to drop the pin, search above to auto-select, or enter coordinates manually below.
      </p>

      {/* Mode 2: Manual Latitude & Longitude Entry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Latitude (Manual Entry) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => onChange(e.target.value, String(longitude))}
            placeholder="e.g. 22.7196"
            className={`w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 ${
              latitude !== '' && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-200 focus:border-sky-600 focus:ring-sky-500/30'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Longitude (Manual Entry) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => onChange(String(latitude), e.target.value)}
            placeholder="e.g. 75.8577"
            className={`w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 ${
              longitude !== '' && (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180)
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-200 focus:border-sky-600 focus:ring-sky-500/30'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
