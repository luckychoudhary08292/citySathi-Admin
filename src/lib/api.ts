import type {
  AdminSessionUser,
  AppGuideDoc,
  CategoryDoc,
  CityDoc,
  CityMapVerification,
  GeocodeResult,
  HealthStatus,
  MapCategoryDoc,
  MapConfigStatus,
  PlaceDoc,
  ServiceDoc,
  SubAdminPublicDoc,
  TipDoc,
  TopCategoryKey,
  TripDoc,
} from '../types.ts';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiBase.replace(/\/api\/v1$/i, '');

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

function extractArray<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Cache-Control', 'no-cache');
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (adminKeyHeader) {
    headers.set('X-Admin-Key', adminKeyHeader);
  }

  const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `${API_BASE}${url}`;
  const res = await fetch(targetUrl, { ...options, headers, cache: 'no-store' });
  const text = await res.text();
  let data: unknown = {};
  let parseFailed = false;
  try {
    data = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    parseFailed = true;
    data = {};
  }

  if (!res.ok) {
    const errRecord = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const errMsg =
      typeof errRecord.error === 'string' && errRecord.error
        ? errRecord.error
        : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  if (parseFailed && text.trim()) {
    throw new Error('Unexpected non-JSON response from API. Check VITE_API_BASE_URL or server routing.');
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
    request<AdminSessionUser & { token: string }>('/api/v1/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (payload: { email?: string; password?: string; adminKey?: string }) =>
    request<AdminSessionUser & { token: string }>('/api/v1/admin/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSession: () =>
    request<AdminSessionUser & { authenticated: boolean }>('/api/v1/admin/session'),

  // Sub-Admins (Supreme Admin only)
  listSubAdmins: async (): Promise<{ subAdmins: SubAdminPublicDoc[] }> => {
    const res = await request<unknown>('/api/v1/admin/sub-admins');
    return { subAdmins: extractArray<SubAdminPublicDoc>(res, 'subAdmins') };
  },

  createSubAdmin: (payload: {
    name: string;
    email: string;
    password: string;
    allowedCityIds: string[];
    isActive: boolean;
  }) =>
    request<{ subAdmin: SubAdminPublicDoc }>('/api/v1/admin/sub-admins', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSubAdmin: (
    subAdminId: string,
    patch: {
      name?: string;
      email?: string;
      password?: string;
      allowedCityIds?: string[];
      isActive?: boolean;
    }
  ) =>
    request<{ subAdmin: SubAdminPublicDoc }>(
      `/api/v1/admin/sub-admins/${encodeURIComponent(subAdminId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    ),

  deleteSubAdmin: (subAdminId: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/v1/admin/sub-admins/${encodeURIComponent(subAdminId)}`,
      { method: 'DELETE' }
    ),

  // Scoped Cities for authenticated admin/sub-admin
  listCities: async (): Promise<{ cities: CityDoc[] }> => {
    const res = await request<unknown>('/api/v1/admin/cities');
    return { cities: extractArray<CityDoc>(res, 'cities') };
  },

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
  listCategories: async (cityId: string): Promise<{ categories: CategoryDoc[] }> => {
    const res = await request<unknown>(`/api/v1/admin/categories/${encodeURIComponent(cityId)}`);
    return { categories: extractArray<CategoryDoc>(res, 'categories') };
  },

  updateCategory: (cityId: string, category: TopCategoryKey, subCategories: string[]) =>
    request<{ category: CategoryDoc }>(
      `/api/v1/admin/categories/${encodeURIComponent(cityId)}/${encodeURIComponent(category)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ subCategories }),
      }
    ),

  // Places
  listPlaces: async (cityId: string): Promise<{ places: PlaceDoc[] }> => {
    const res = await request<unknown>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}/places`);
    return { places: extractArray<PlaceDoc>(res, 'places') };
  },

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
  listServices: async (cityId: string): Promise<{ services: ServiceDoc[] }> => {
    const res = await request<unknown>(`/api/v1/admin/cities/${encodeURIComponent(cityId)}/services`);
    return { services: extractArray<ServiceDoc>(res, 'services') };
  },

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

  // App Guides
  listAppGuides: async (cityId: string): Promise<{ appGuides: AppGuideDoc[] }> => {
    const res = await request<unknown>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/app-guides`
    );
    return { appGuides: extractArray<AppGuideDoc>(res, 'appGuides') };
  },

  createAppGuide: (cityId: string, appGuide: Partial<AppGuideDoc>) =>
    request<{ appGuide: AppGuideDoc }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/app-guides`,
      {
        method: 'POST',
        body: JSON.stringify(appGuide),
      }
    ),

  updateAppGuide: (cityId: string, appId: string, patch: Partial<AppGuideDoc>) =>
    request<{ appGuide: AppGuideDoc }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/app-guides/${encodeURIComponent(appId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    ),

  deleteAppGuide: (cityId: string, appId: string) =>
    request<{ deleted: boolean }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/app-guides/${encodeURIComponent(appId)}`,
      { method: 'DELETE' }
    ),

  // Trips & Tips
  listTrips: async (cityId: string, userId = ''): Promise<{ trips: TripDoc[] }> => {
    const params = new URLSearchParams();
    if (cityId) params.set('cityId', cityId);
    if (userId.trim()) params.set('userId', userId.trim());
    const res = await request<unknown>(`/api/v1/admin/trips?${params.toString()}`);
    return { trips: extractArray<TripDoc>(res, 'trips') };
  },

  deleteTrip: (tripId: string) =>
    request<{ deleted: boolean }>(`/api/v1/admin/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
    }),

  listTips: async (cityId: string): Promise<{ tips: TipDoc[] }> => {
    const res = await request<unknown>(`/api/v1/admin/tips?cityId=${encodeURIComponent(cityId)}`);
    return { tips: extractArray<TipDoc>(res, 'tips') };
  },

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

  // Map Sub-Categories & Verification
  listMapCategories: async (cityId: string): Promise<{ mapCategories: MapCategoryDoc[] }> => {
    const res = await request<unknown>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/map-categories`
    );
    return { mapCategories: extractArray<MapCategoryDoc>(res, 'mapCategories') };
  },

  createMapCategory: (cityId: string, name: string) =>
    request<{ mapCategory: MapCategoryDoc }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/map-categories`,
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      }
    ),

  updateMapCategory: (cityId: string, catId: string, patch: { name?: string; sortOrder?: number }) =>
    request<{ mapCategory: MapCategoryDoc }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/map-categories/${encodeURIComponent(catId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    ),

  reorderMapCategories: (cityId: string, orderedIds: string[]) =>
    request<{ mapCategories: MapCategoryDoc[] }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/map-categories/reorder`,
      {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      }
    ),

  deleteMapCategory: (cityId: string, catId: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/v1/admin/cities/${encodeURIComponent(cityId)}/map-categories/${encodeURIComponent(catId)}`,
      { method: 'DELETE' }
    ),

  getHealth: () => request<HealthStatus>('/api/v1/health'),

  getMapConfig: () => request<MapConfigStatus>('/api/v1/map/config'),

  getCityMapData: (cityId: string) =>
    request<CityMapVerification>(`/api/v1/cities/${encodeURIComponent(cityId)}/map`),

  // Live App Sync
  syncLiveApps: (cityId = '') =>
    request<{ ok: boolean; cityId: string; scope: string }>('/api/admin/sync-apps', {
      method: 'POST',
      body: JSON.stringify({ cityId }),
    }),
};
