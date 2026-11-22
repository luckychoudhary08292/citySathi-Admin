import type {
  CategoryDoc,
  CityDoc,
  GeocodeResult,
  PlaceDoc,
  ServiceDoc,
  TipDoc,
  TopCategoryKey,
  TripDoc,
} from '../types.ts';

// Held strictly in JS memory (never localStorage/sessionStorage)
let authToken: string | null = null;
let adminKeyHeader: string | null = null;

export function setAuthCredentials(creds: { token?: string; adminKey?: string }) {
  authToken = creds.token ?? null;
  adminKeyHeader = creds.adminKey ?? null;
}

export function clearAuthCredentials() {
  authToken = null;
  adminKeyHeader = null;
}

export function hasAuthCredentials(): boolean {
  return Boolean(authToken || adminKeyHeader);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (adminKeyHeader) {
    headers.set('X-Admin-Key', adminKeyHeader);
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const errMsg =
      typeof data.error === 'string' && data.error
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export interface AuthStatusResponse {
  needsSetup: boolean;
  hasApiKeyConfigured: boolean;
  dbMode: 'mongodb' | 'local';
  emailHint?: string;
}

export const api = {
  getAuthStatus: () => request<AuthStatusResponse>('/api/v1/admin/auth/status'),

  setupAdmin: (email: string, password: string) =>
    request<{ token: string; email: string; dbMode: 'mongodb' | 'local' }>('/api/v1/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (payload: { email?: string; password?: string; adminKey?: string }) =>
    request<{ token: string; email: string; dbMode: 'mongodb' | 'local' }>('/api/v1/admin/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Cities
  listCities: () => request<{ cities: CityDoc[] }>('/api/v1/cities'),

  createCity: (city: Partial<CityDoc>) =>
    request<{ city: CityDoc }>('/api/v1/admin/cities', {
      method: 'POST',
      body: JSON.stringify(city),
    }),

  updateCity: (cityId: string, patch: Partial<CityDoc>) =>
    request<{ city: CityDoc }>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteCity: (cityId: string) =>
    request<{ deleted: boolean; cityId: string }>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}`, {
      method: 'DELETE',
    }),

  // Categories
  listCategories: (cityId: string) =>
    request<{ categories: CategoryDoc[] }>(`/api/v1/admin/categories/${encodeURIComponent(cityId)}`),

  updateCategory: (cityId: string, category: TopCategoryKey, subCategories: string[]) =>
    request<{ category: CategoryDoc }>(
      `/api/v1/admin/categories/${encodeURIComponent(cityId)}/${encodeURIComponent(category)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ subCategories }),
      }
    ),

  // Places
  listPlaces: (cityId: string) =>
    request<{ places: PlaceDoc[] }>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}/places`),

  createPlace: (cityId: string, place: Partial<PlaceDoc>) =>
    request<{ place: PlaceDoc }>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}/places`, {
      method: 'POST',
      body: JSON.stringify(place),
    }),

  bulkImportPlaces: (cityId: string, places: unknown[]) =>
    request<{
      insertedCount: number;
      inserted: PlaceDoc[];
      skipped: Array<{ id: string; reason: string }>;
      validationErrors: Array<{ index: number; error: string }>;
    }>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}/places/bulk`, {
      method: 'POST',
      body: JSON.stringify({ places }),
    }),

  updatePlace: (cityId: string, placeId: string, patch: Partial<PlaceDoc>) =>
    request<{ place: PlaceDoc }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/places/${encodeURIComponent(placeId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    ),

  deletePlace: (cityId: string, placeId: string) =>
    request<{ deleted: boolean }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/places/${encodeURIComponent(placeId)}`,
      { method: 'DELETE' }
    ),

  // Services
  listServices: (cityId: string) =>
    request<{ services: ServiceDoc[] }>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}/services`),

  createService: (cityId: string, service: Partial<ServiceDoc>) =>
    request<{ service: ServiceDoc }>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}/services`, {
      method: 'POST',
      body: JSON.stringify(service),
    }),

  updateService: (cityId: string, serviceId: string, patch: Partial<ServiceDoc>) =>
    request<{ service: ServiceDoc }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/services/${encodeURIComponent(serviceId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    ),

  deleteService: (cityId: string, serviceId: string) =>
    request<{ deleted: boolean }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/services/${encodeURIComponent(serviceId)}`,
      { method: 'DELETE' }
    ),

  // Trips & Tips
  listTrips: (cityId: string, userId = '') => {
    const params = new URLSearchParams();
    if (cityId) params.set('cityId', cityId);
    if (userId.trim()) params.set('userId', userId.trim());
    return request<{ trips: TripDoc[] }>(`/api/v1/admin/trips?${params.toString()}`);
  },

  deleteTrip: (tripId: string) =>
    request<{ deleted: boolean }>(`/api/v1/admin/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
    }),

  listTips: (cityId: string) =>
    request<{ tips: TipDoc[] }>(`/api/v1/admin/tips?cityId=${encodeURIComponent(cityId)}`),

  deleteTip: (tipId: string) =>
    request<{ deleted: boolean }>(`/api/v1/admin/tips/${encodeURIComponent(tipId)}`, {
      method: 'DELETE',
    }),

  // Geocoding (Auto-selecting location picker)
  geocode: (query: string) =>
    request<{ results: GeocodeResult[] }>(
      `/api/v1/admin/geocode?q=${encodeURIComponent(query)}`
    ),

  reverseGeocode: (lat: number, lng: number) =>
    request<{ result: GeocodeResult }>(
      `/api/v1/admin/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
    ),

  // Live App Sync
  syncLiveApps: (cityId = '') =>
    request<{ ok: boolean; cityId: string; scope: string }>('/api/admin/sync-apps', {
      method: 'POST',
      body: JSON.stringify({ cityId }),
    }),
};
