import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type {
  AdminRole,
  AppGuideDoc,
  CityDoc,
  GeocodeResult,
  PlaceCategoryKey,
  PlaceDoc,
  PromoBanner,
  PromoTargetRoute,
  ServiceDoc,
  ServiceGroupKey,
  ServiceMode,
  TopCategoryKey,
} from './src/types.ts';
import { FIXED_CATEGORIES, PLACE_CATEGORIES, PROMO_TARGET_ROUTES, SERVICE_GROUPS } from './src/types.ts';
import { store } from './server/db.ts';
import type { SubAdminRecord } from './server/seed.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const VALID_TOP_CATEGORIES = new Set<string>(FIXED_CATEGORIES.map((c) => c.category));
const VALID_PLACE_CATEGORIES = new Set<string>(PLACE_CATEGORIES.map((c) => c.value));
const VALID_SERVICE_GROUPS = new Set<string>(SERVICE_GROUPS.map((g) => g.value));
const VALID_PROMO_ROUTES = new Set<string>(PROMO_TARGET_ROUTES.map((r) => r.value));
const SLUG_REGEX = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

async function notifyAppBackend(cityId: string, scope: string): Promise<void> {
  const rawBaseUrl = process.env.APP_BACKEND_URL?.trim();
  if (!rawBaseUrl) return;

  let endpoint: string;
  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    endpoint = `${rawBaseUrl.replace(/\/+$/, '')}/api/v1/internal/notify-change`;
  } catch {
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const internalSecret = process.env.INTERNAL_SYNC_SECRET?.trim();
    if (internalSecret) {
      headers['X-Internal-Secret'] = internalSecret;
    }
    await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cityId, scope }),
      signal: controller.signal,
    });
  } catch {
    // Non-blocking: silently ignore unreachable or timed-out app backend
  } finally {
    clearTimeout(timer);
  }
}

function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sanitizeSlug(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val.trim() : fallback;
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return Array.from(
    new Set(
      val
        .filter((item): item is string => typeof item === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function asNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isValidLatLng(lat: number | null, lng: number | null): boolean {
  return (
    lat !== null &&
    lng !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function sanitizeImageUrl(raw: unknown): string {
  const url = asString(raw);
  if (!url) return '';
  if (url.startsWith('/src/assets/') || url.startsWith('/assets/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    return '';
  }
  return '';
}

function sanitizeHttpUrl(raw: unknown): string {
  const url = asString(raw);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    return '';
  }
  return '';
}

function maskApiKey(rawKey: string): string {
  const key = rawKey.trim();
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}••••`;
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function validatePromoBanner(raw: unknown, cityId: string, fallback?: PromoBanner): PromoBanner {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const routeRaw = asString(obj.targetRoute, fallback?.targetRoute ?? 'explore');
  const targetRoute: PromoTargetRoute = VALID_PROMO_ROUTES.has(routeRaw)
    ? (routeRaw as PromoTargetRoute)
    : 'explore';
  return {
    id: sanitizeSlug(obj.id) || fallback?.id || `${cityId}_promo`,
    badgeText: asString(obj.badgeText, fallback?.badgeText ?? ''),
    title: asString(obj.title, fallback?.title ?? ''),
    subtitle: asString(obj.subtitle, fallback?.subtitle ?? ''),
    ctaLabel: asString(obj.ctaLabel, fallback?.ctaLabel ?? 'Explore'),
    imageUrl: obj.imageUrl !== undefined ? sanitizeImageUrl(obj.imageUrl) : fallback?.imageUrl ?? '',
    targetRoute,
  };
}

function validatePlacePayload(
  raw: unknown,
  cityId: string,
  requireId = true
): { ok: true; data: PlaceDoc } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid place payload object' };
  }
  const obj = raw as Record<string, unknown>;
  const name = asString(obj.name);
  if (!name) return { ok: false, error: 'Place name is required' };

  const id = requireId
    ? sanitizeSlug(obj.id || name)
    : asString(obj.id) || sanitizeSlug(name);
  if (requireId && (!id || !SLUG_REGEX.test(id))) {
    return { ok: false, error: 'Place id must be a valid lowercase slug' };
  }
  if (!requireId && !id) {
    return { ok: false, error: 'Place id must be a non-empty string' };
  }

  const catRaw = asString(obj.category, 'HERITAGE').toUpperCase();
  if (!VALID_PLACE_CATEGORIES.has(catRaw)) {
    return { ok: false, error: `Invalid category: ${catRaw}` };
  }

  const lat = asNumber(obj.latitude);
  const lng = asNumber(obj.longitude);
  if (!isValidLatLng(lat, lng)) {
    return { ok: false, error: 'Valid latitude (-90..90) and longitude (-180..180) are required' };
  }

  const ratingRaw = asNumber(obj.rating);
  const rating = ratingRaw === null ? 4.5 : ratingRaw;
  if (rating < 0 || rating > 5) {
    return { ok: false, error: 'Rating must be between 0.0 and 5.0' };
  }

  const imageUrlRaw = asString(obj.imageUrl);
  const safeImageUrl = imageUrlRaw ? sanitizeImageUrl(imageUrlRaw) : '';
  if (imageUrlRaw && !safeImageUrl) {
    return { ok: false, error: 'imageUrl must be an http/https URL or valid asset path' };
  }

  return {
    ok: true,
    data: {
      id,
      cityId,
      docType: 'place',
      name,
      subtitle: asString(obj.subtitle),
      category: catRaw as PlaceCategoryKey,
      subCategories: asStringArray(obj.subCategories),
      tags: asStringArray(obj.tags),
      imageUrl: safeImageUrl,
      description: asString(obj.description),
      rating: Math.round(rating * 10) / 10,
      reviewCountLabel: asString(obj.reviewCountLabel),
      distanceLabel: asString(obj.distanceLabel),
      openHours: asString(obj.openHours),
      phone: asString(obj.phone),
      address: asString(obj.address),
      latitude: lat!,
      longitude: lng!,
      isPopular: Boolean(obj.isPopular),
      isTrending: Boolean(obj.isTrending),
    },
  };
}

function validateServicePayload(
  raw: unknown,
  city: CityDoc,
  requireSlugId = true
): { ok: true; data: ServiceDoc } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid service payload object' };
  }
  const obj = raw as Record<string, unknown>;
  const name = asString(obj.name);
  if (!name) return { ok: false, error: 'Service name is required' };

  const id = requireSlugId
    ? sanitizeSlug(obj.id || name)
    : asString(obj.id) || sanitizeSlug(name);
  if (requireSlugId && (!id || !SLUG_REGEX.test(id))) {
    return { ok: false, error: 'Service id must be a valid lowercase slug' };
  }
  if (!requireSlugId && !id) {
    return { ok: false, error: 'Service id must be a non-empty string' };
  }

  const rawMode = asString(obj.serviceMode, 'CONTACT').toUpperCase();
  const serviceMode: ServiceMode = rawMode === 'SERVICE_NAME' ? 'SERVICE_NAME' : 'CONTACT';

  const groupRaw = asString(obj.group, 'TRANSPORT').toUpperCase();
  if (!VALID_SERVICE_GROUPS.has(groupRaw)) {
    return { ok: false, error: `Invalid service group: ${groupRaw}` };
  }

  const latRaw = asNumber(obj.latitude);
  const lngRaw = asNumber(obj.longitude);
  const lat = latRaw !== null ? latRaw : city.latitude;
  const lng = lngRaw !== null ? lngRaw : city.longitude;
  if (!isValidLatLng(lat, lng)) {
    return { ok: false, error: 'Valid latitude (-90..90) and longitude (-180..180) are required' };
  }

  const sortOrderRaw = asNumber(obj.sortOrder);
  const sortOrder = sortOrderRaw !== null ? Math.round(sortOrderRaw) : 0;

  const defaultCat =
    serviceMode === 'SERVICE_NAME'
      ? 'Service Name'
      : groupRaw === 'EMERGENCY'
        ? 'Emergency'
        : 'Contact';
  const category = asString(obj.category, defaultCat) || defaultCat;
  const phone = asString(obj.phone) || asString(obj.contactNumber);
  const highlightNumber =
    serviceMode === 'SERVICE_NAME'
      ? asString(obj.highlightNumber)
      : asString(obj.highlightNumber, phone);
  const actionUrlRaw = asString(obj.actionUrl);
  const actionUrl = actionUrlRaw ? sanitizeHttpUrl(actionUrlRaw) : '';
  if (actionUrlRaw && !actionUrl) {
    return { ok: false, error: 'actionUrl must be a valid http/https URL' };
  }

  return {
    ok: true,
    data: {
      id,
      cityId: city.id,
      docType: 'service',
      group: groupRaw as ServiceGroupKey,
      serviceMode,
      category,
      name,
      subtitle: asString(obj.subtitle),
      description: asString(obj.description),
      address: asString(obj.address),
      distanceOrHours: asString(obj.distanceOrHours),
      highlightNumber,
      phone,
      actionUrl,
      isUrgent: Boolean(obj.isUrgent),
      iconKey: asString(obj.iconKey, 'phone') || 'phone',
      sortOrder,
      latitude: lat,
      longitude: lng,
    },
  };
}

function validateAppGuidePayload(
  raw: unknown,
  cityId: string,
  requireSlugId = true
): { ok: true; data: AppGuideDoc } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid app guide payload object' };
  }
  const obj = raw as Record<string, unknown>;
  const appName = asString(obj.appName);
  if (!appName) return { ok: false, error: 'App name is required' };

  const id = requireSlugId
    ? sanitizeSlug(obj.id || appName)
    : asString(obj.id) || sanitizeSlug(appName);
  if (requireSlugId && (!id || !SLUG_REGEX.test(id))) {
    return { ok: false, error: 'App Guide id must be a valid lowercase slug' };
  }
  if (!requireSlugId && !id) {
    return { ok: false, error: 'App Guide id must be a non-empty string' };
  }

  const iconUrlRaw = asString(obj.iconUrl);
  const iconUrl = iconUrlRaw ? sanitizeImageUrl(iconUrlRaw) : '';
  if (iconUrlRaw && !iconUrl) {
    return { ok: false, error: 'iconUrl must be an http/https URL or valid asset path' };
  }

  const playStoreRaw = asString(obj.playStoreUrl);
  const playStoreUrl = playStoreRaw ? sanitizeImageUrl(playStoreRaw) : '';
  if (playStoreRaw && !playStoreUrl) {
    return { ok: false, error: 'playStoreUrl must be a valid http/https URL' };
  }

  const websiteRaw = asString(obj.websiteUrl);
  const websiteUrl = websiteRaw ? sanitizeImageUrl(websiteRaw) : '';
  if (websiteRaw && !websiteUrl) {
    return { ok: false, error: 'websiteUrl must be a valid http/https URL' };
  }

  const sortOrderRaw = asNumber(obj.sortOrder);
  const sortOrder = sortOrderRaw !== null ? Math.round(sortOrderRaw) : 0;

  return {
    ok: true,
    data: {
      id,
      cityId,
      docType: 'app_guide',
      appName,
      taskCategory: asString(obj.taskCategory, 'Civic Help') || 'Civic Help',
      highlightTag: asString(obj.highlightTag),
      description: asString(obj.description),
      howToUse: asString(obj.howToUse),
      iconUrl,
      iconKey: asString(obj.iconKey, 'smartphone') || 'smartphone',
      packageName: asString(obj.packageName),
      playStoreUrl,
      websiteUrl,
      sortOrder,
    },
  };
}

interface AdminAuthContext {
  role: AdminRole;
  email: string;
  name: string;
  subAdminId?: string;
  allowedCityIds: string[];
}

const authContextMap = new WeakMap<Request, AdminAuthContext>();

function getAuthContext(req: Request): AdminAuthContext | null {
  return authContextMap.get(req) ?? null;
}

function hasCityAccess(req: Request, cityId: string): boolean {
  const auth = getAuthContext(req);
  if (!auth) return false;
  if (auth.role === 'SUPER_ADMIN') return true;
  return Boolean(cityId && auth.allowedCityIds.includes(cityId));
}

function assertCityAccess(req: Request, res: Response, cityId: string): boolean {
  if (!hasCityAccess(req, cityId)) {
    res.status(403).json({ error: 'Access denied: you are not assigned to this city' });
    return false;
  }
  return true;
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuthContext(req);
  if (!auth || auth.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Access denied: Supreme Admin privileges required' });
    return;
  }
  next();
}

async function getAuthConfigurationState() {
  const envSecret = process.env.ADMIN_SECRET?.trim() || '';
  const envPassword = process.env.ADMIN_PASSWORD?.trim() || '';
  const envEmail = process.env.ADMIN_EMAIL?.trim() || 'admin@citycompanion.app';
  const dbAdmin = await store.getAdminConfig();
  const hasEnvAuth = Boolean(envSecret || envPassword);
  const needsSetup = !hasEnvAuth && !dbAdmin;
  return {
    envSecret,
    envPassword,
    envEmail,
    dbAdmin,
    hasEnvAuth,
    needsSetup,
  };
}

async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminKeyHeader = req.header('X-Admin-Key')?.trim();
  const authHeader = req.header('Authorization')?.trim();
  const config = await getAuthConfigurationState();

  if (adminKeyHeader && config.envSecret && timingSafeStringEqual(adminKeyHeader, config.envSecret)) {
    authContextMap.set(req, {
      role: 'SUPER_ADMIN',
      email: 'API Key Admin',
      name: 'Supreme Admin',
      allowedCityIds: [],
    });
    next();
    return;
  }

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET) as {
        role?: string;
        email?: string;
        subAdminId?: string;
      };
      if (payload && (payload.role === 'SUPER_ADMIN' || payload.role === 'admin')) {
        authContextMap.set(req, {
          role: 'SUPER_ADMIN',
          email: payload.email || 'Supreme Admin',
          name: 'Supreme Admin',
          allowedCityIds: [],
        });
        next();
        return;
      }
      if (payload && payload.role === 'SUB_ADMIN' && typeof payload.subAdminId === 'string') {
        const subAdmin = await store.getSubAdminAuthById(payload.subAdminId);
        if (!subAdmin) {
          res.status(401).json({ error: 'Sub-admin account no longer exists' });
          return;
        }
        if (!subAdmin.isActive) {
          res.status(403).json({ error: 'Your sub-admin access has been disabled by the Supreme Admin' });
          return;
        }
        authContextMap.set(req, {
          role: 'SUB_ADMIN',
          subAdminId: subAdmin.id,
          email: subAdmin.email,
          name: subAdmin.name,
          allowedCityIds: subAdmin.allowedCityIds,
        });
        next();
        return;
      }
    } catch {
      res.status(401).json({ error: 'Invalid or expired admin session token' });
      return;
    }
  }

  res.status(401).json({ error: 'Admin authentication required' });
}

async function startServer(): Promise<void> {
  await store.init();
  const app = express();
  app.use((req, res, next) => {
    const allowedRaw = process.env.ALLOWED_ORIGINS?.trim();
    const origin = req.header('Origin');
    if (allowedRaw) {
      const allowedList = allowedRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (origin && allowedList.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      if (origin) res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Admin-Key, Cache-Control'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  // Public health & cities endpoint (Android app compatibility)
  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true, dbMode: store.getMode() });
  });

  app.get('/api/v1/cities', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const cities = await store.listCities();
      res.json({ cities });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/categories', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const cityId = sanitizeSlug(req.query.cityId);
      if (cityId) {
        const categories = await store.listCategories(cityId);
        res.json({ categories });
        return;
      }
      const cities = await store.listCities();
      const all = await Promise.all(cities.map((c) => store.listCategories(c.id)));
      res.json({ categories: all.flat() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/cities/:cityId/home', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const cityId = sanitizeSlug(req.params.cityId);
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const places = await store.listPlaces(cityId);
      res.json({
        city,
        cityName: city.name,
        heroSubtitle: city.heroSubtitle,
        headerImageUrl: city.heroImageUrl,
        promoBanner: city.promoBanner ?? null,
        popularPlaces: places.filter((p) => p.isPopular),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/cities/:cityId/explore', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const cityId = sanitizeSlug(req.params.cityId);
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const [categories, places] = await Promise.all([
        store.listCategories(cityId),
        store.listPlaces(cityId),
      ]);
      res.json({ city, categories, places });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/cities/:cityId/services', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const cityId = sanitizeSlug(req.params.cityId);
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const services = await store.listServices(cityId);
      res.json({ services });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/cities/:cityId/apps', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const cityId = sanitizeSlug(req.params.cityId);
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const apps = await store.listAppGuides(cityId);
      res.json({ apps, appGuides: apps });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/v1/map/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const rawKey = process.env.MAPS_API_KEY?.trim() || '';
    const zoomRaw = Number(process.env.MAP_DEFAULT_ZOOM || 13);
    const defaultZoom = Number.isFinite(zoomRaw) && zoomRaw >= 1 && zoomRaw <= 22 ? zoomRaw : 13;
    res.json({
      configured: Boolean(rawKey),
      maskedKey: maskApiKey(rawKey),
      defaultZoom,
    });
  });

  app.get('/api/v1/cities/:cityId/map', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const cityId = sanitizeSlug(req.params.cityId);
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const [places, services, customMapCats] = await Promise.all([
        store.listPlaces(cityId),
        store.listServices(cityId),
        store.listMapCategories(cityId),
      ]);

      const usingFallback = customMapCats.length === 0;
      const mapSubCategories = usingFallback
        ? Array.from(
            new Set(
              services
                .filter((s) => s.serviceMode === 'SERVICE_NAME')
                .map((s) => {
                  const cat = s.category.trim();
                  if (cat && cat.toLowerCase() !== 'service name') return cat;
                  return s.name.trim();
                })
                .filter(Boolean)
            )
          )
        : customMapCats.map((c) => c.name);

      res.json({
        city,
        places,
        services,
        mapSubCategories,
        usingFallback,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Auth status & initial bootstrap / login
  app.get('/api/v1/admin/auth/status', async (_req, res) => {
    try {
      const cfg = await getAuthConfigurationState();
      res.json({
        needsSetup: cfg.needsSetup,
        hasApiKeyConfigured: Boolean(cfg.envSecret),
        dbMode: store.getMode(),
        emailHint: cfg.dbAdmin?.email || (cfg.envPassword ? cfg.envEmail : undefined),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/v1/admin/setup', async (req, res) => {
    try {
      const cfg = await getAuthConfigurationState();
      if (!cfg.needsSetup) {
        res.status(403).json({ error: 'Admin account is already configured' });
        return;
      }
      const email = asString(req.body?.email).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !email.includes('@')) {
        res.status(400).json({ error: 'Valid admin email is required' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }
      const passwordHash = hashPasswordScrypt(password);
      const claimed = await store.setAdminConfigIfEmpty({
        email,
        passwordHash,
        createdAt: Date.now(),
      });
      if (!claimed) {
        res.status(403).json({ error: 'Admin account already claimed' });
        return;
      }
      const token = jwt.sign({ role: 'SUPER_ADMIN', email }, JWT_SECRET, { expiresIn: '12h' });
      res.status(201).json({
        token,
        role: 'SUPER_ADMIN' as AdminRole,
        email,
        name: 'Supreme Admin',
        allowedCityIds: [],
        dbMode: store.getMode(),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/v1/admin/login', async (req, res) => {
    try {
      const cfg = await getAuthConfigurationState();
      if (cfg.needsSetup) {
        res.status(409).json({ error: 'Initial admin setup required before login', needsSetup: true });
        return;
      }

      const adminKey = typeof req.body?.adminKey === 'string' ? req.body.adminKey.trim() : '';
      if (adminKey) {
        if (cfg.envSecret && timingSafeStringEqual(adminKey, cfg.envSecret)) {
          const token = jwt.sign({ role: 'SUPER_ADMIN', authType: 'key' }, JWT_SECRET, {
            expiresIn: '12h',
          });
          res.json({
            token,
            role: 'SUPER_ADMIN' as AdminRole,
            email: 'API Key Admin',
            name: 'Supreme Admin',
            allowedCityIds: [],
            dbMode: store.getMode(),
          });
          return;
        }
        res.status(401).json({ error: 'Invalid ADMIN_SECRET key' });
        return;
      }

      const email = asString(req.body?.email).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) {
        res.status(400).json({ error: 'Email/username and password are required' });
        return;
      }

      // 1. Check configured env Supreme Admin credentials
      if (cfg.hasEnvAuth) {
        const envEmailMatch =
          email === cfg.envEmail.toLowerCase() || email === 'admin';
        const envPassMatch =
          (cfg.envPassword && timingSafeStringEqual(password, cfg.envPassword)) ||
          (cfg.envSecret && timingSafeStringEqual(password, cfg.envSecret));
        if (envEmailMatch && envPassMatch) {
          const token = jwt.sign({ role: 'SUPER_ADMIN', email }, JWT_SECRET, { expiresIn: '12h' });
          res.json({
            token,
            role: 'SUPER_ADMIN' as AdminRole,
            email,
            name: 'Supreme Admin',
            allowedCityIds: [],
            dbMode: store.getMode(),
          });
          return;
        }
      }

      // 2. Check claimed DB Supreme Admin account when env password is not overriding
      if (!cfg.hasEnvAuth && cfg.dbAdmin) {
        if (
          email === cfg.dbAdmin.email.toLowerCase() &&
          verifyPasswordScrypt(password, cfg.dbAdmin.passwordHash)
        ) {
          const token = jwt.sign(
            { role: 'SUPER_ADMIN', email: cfg.dbAdmin.email },
            JWT_SECRET,
            { expiresIn: '12h' }
          );
          res.json({
            token,
            role: 'SUPER_ADMIN' as AdminRole,
            email: cfg.dbAdmin.email,
            name: 'Supreme Admin',
            allowedCityIds: [],
            dbMode: store.getMode(),
          });
          return;
        }
      }

      // 3. Check City Sub-Admin accounts
      const subAdmin = await store.getSubAdminAuthByEmail(email);
      if (subAdmin && verifyPasswordScrypt(password, subAdmin.passwordHash)) {
        if (!subAdmin.isActive) {
          res
            .status(403)
            .json({ error: 'Your sub-admin account is disabled. Contact the Supreme Admin.' });
          return;
        }
        const token = jwt.sign(
          { role: 'SUB_ADMIN', subAdminId: subAdmin.id, email: subAdmin.email },
          JWT_SECRET,
          { expiresIn: '12h' }
        );
        res.json({
          token,
          role: 'SUB_ADMIN' as AdminRole,
          email: subAdmin.email,
          name: subAdmin.name,
          allowedCityIds: subAdmin.allowedCityIds,
          dbMode: store.getMode(),
        });
        return;
      }

      res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Protected Admin Router
  const admin = express.Router();
  admin.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  admin.use(requireAdminAuth);

  admin.get('/session', (req, res) => {
    const auth = getAuthContext(req);
    res.json({
      authenticated: true,
      role: auth?.role ?? 'SUB_ADMIN',
      email: auth?.email ?? '',
      name: auth?.name ?? '',
      allowedCityIds: auth?.allowedCityIds ?? [],
      dbMode: store.getMode(),
    });
  });

  // Sub-Admin Management (Supreme Admin only)
  admin.get('/sub-admins', requireSuperAdmin, async (_req, res) => {
    try {
      const subAdmins = await store.listSubAdmins();
      res.json({ subAdmins });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.post('/sub-admins', requireSuperAdmin, async (req, res) => {
    try {
      const rawName = asString(req.body?.name);
      const email = asString(req.body?.email).toLowerCase();
      const name = rawName || (email.includes('@') ? email.split('@')[0] : '');
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const rawCityIds = asStringArray(req.body?.allowedCityIds).map((cid) => sanitizeSlug(cid)).filter(Boolean);
      const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;

      if (!email || !email.includes('@')) {
        res.status(400).json({ error: 'Valid sub-admin email is required' });
        return;
      }
      if (!name) {
        res.status(400).json({ error: 'Sub-admin name is required' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      const cfg = await getAuthConfigurationState();
      if (
        email === cfg.envEmail.toLowerCase() ||
        (cfg.dbAdmin && email === cfg.dbAdmin.email.toLowerCase()) ||
        email === 'admin'
      ) {
        res.status(409).json({ error: 'Cannot create a sub-admin using the Supreme Admin email' });
        return;
      }

      const allCities = await store.listCities();
      const validCitySet = new Set(allCities.map((c) => c.id));
      const allowedCityIds = Array.from(new Set(rawCityIds.filter((cid) => validCitySet.has(cid))));
      if (allowedCityIds.length === 0) {
        res.status(400).json({ error: 'Assign at least one valid city to this sub-admin' });
        return;
      }

      const now = Date.now();
      const record: SubAdminRecord = {
        id: `sa_${now.toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        name,
        email,
        passwordHash: hashPasswordScrypt(password),
        allowedCityIds,
        isActive,
        createdAt: now,
        updatedAt: now,
      };
      const created = await store.createSubAdmin(record);
      res.status(201).json({ subAdmin: created });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(msg.includes('already exists') ? 409 : 500).json({ error: msg });
    }
  });

  admin.put('/sub-admins/:subAdminId', requireSuperAdmin, async (req, res) => {
    try {
      const subAdminId = asString(req.params.subAdminId);
      if (!subAdminId || subAdminId.includes('$')) {
        res.status(400).json({ error: 'Invalid sub-admin id' });
        return;
      }
      const existing = await store.getSubAdminAuthById(subAdminId);
      if (!existing) {
        res.status(404).json({ error: 'Sub-admin not found' });
        return;
      }

      const patch: Partial<Pick<SubAdminRecord, 'name' | 'email' | 'passwordHash' | 'allowedCityIds' | 'isActive'>> = {};
      if (req.body?.name !== undefined) {
        const name = asString(req.body.name);
        if (!name) {
          res.status(400).json({ error: 'Sub-admin name cannot be empty' });
          return;
        }
        patch.name = name;
      }
      if (req.body?.email !== undefined) {
        const email = asString(req.body.email).toLowerCase();
        if (!email || !email.includes('@')) {
          res.status(400).json({ error: 'Valid sub-admin email is required' });
          return;
        }
        const cfg = await getAuthConfigurationState();
        if (
          email === cfg.envEmail.toLowerCase() ||
          (cfg.dbAdmin && email === cfg.dbAdmin.email.toLowerCase()) ||
          email === 'admin'
        ) {
          res.status(409).json({ error: 'Cannot use the Supreme Admin email for a sub-admin' });
          return;
        }
        patch.email = email;
      }
      if (typeof req.body?.password === 'string' && req.body.password.length > 0) {
        if (req.body.password.length < 8) {
          res.status(400).json({ error: 'New password must be at least 8 characters' });
          return;
        }
        patch.passwordHash = hashPasswordScrypt(req.body.password);
      }
      if (req.body?.allowedCityIds !== undefined) {
        const rawCityIds = asStringArray(req.body.allowedCityIds)
          .map((cid) => sanitizeSlug(cid))
          .filter(Boolean);
        const allCities = await store.listCities();
        const validCitySet = new Set(allCities.map((c) => c.id));
        const allowedCityIds = Array.from(new Set(rawCityIds.filter((cid) => validCitySet.has(cid))));
        if (allowedCityIds.length === 0) {
          res.status(400).json({ error: 'Assign at least one valid city to this sub-admin' });
          return;
        }
        patch.allowedCityIds = allowedCityIds;
      }
      if (req.body?.isActive !== undefined) {
        patch.isActive = Boolean(req.body.isActive);
      }

      const updated = await store.updateSubAdmin(subAdminId, patch);
      if (!updated) {
        res.status(404).json({ error: 'Sub-admin not found' });
        return;
      }
      res.json({ subAdmin: updated });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(msg.includes('already exists') ? 409 : 500).json({ error: msg });
    }
  });

  admin.delete('/sub-admins/:subAdminId', requireSuperAdmin, async (req, res) => {
    try {
      const subAdminId = asString(req.params.subAdminId);
      if (!subAdminId || subAdminId.includes('$')) {
        res.status(400).json({ error: 'Invalid sub-admin id' });
        return;
      }
      const deleted = await store.deleteSubAdmin(subAdminId);
      if (!deleted) {
        res.status(404).json({ error: 'Sub-admin not found' });
        return;
      }
      res.json({ deleted: true, id: subAdminId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Scoped Cities list for Admin Console
  admin.get('/cities', async (req, res) => {
    try {
      const auth = getAuthContext(req);
      const cities = await store.listCities();
      if (auth?.role === 'SUB_ADMIN') {
        const allowed = new Set(auth.allowedCityIds);
        res.json({ cities: cities.filter((c) => allowed.has(c.id)) });
        return;
      }
      res.json({ cities });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Server-side Nominatim Geocode & Reverse Geocode Proxy (auto-selecting location search)
  admin.get('/geocode', async (req, res) => {
    const q = asString(req.query.q);
    if (q.length < 2) {
      res.json({ results: [] });
      return;
    }
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '6');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'CityCompanionAdmin/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(502).json({ error: 'Location search service unavailable' });
        return;
      }

      const rawList = (await upstream.json()) as Array<Record<string, unknown>>;
      const results: GeocodeResult[] = rawList
        .map((item) => {
          const addr = (item.address as Record<string, string | undefined>) || {};
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          const shortName =
            asString(item.name) ||
            addr.amenity ||
            addr.tourism ||
            addr.road ||
            addr.city ||
            addr.town ||
            asString(item.display_name).split(',')[0] ||
            'Selected Location';
          const state = addr.state || addr.region || '';
          const city = addr.city || addr.town || addr.village || addr.state_district || '';
          return {
            displayName: asString(item.display_name),
            shortName,
            state,
            city,
            address: asString(item.display_name),
            latitude: Math.round(lat * 1000000) / 1000000,
            longitude: Math.round(lng * 1000000) / 1000000,
          };
        })
        .filter((r) => isValidLatLng(r.latitude, r.longitude));

      res.json({ results });
    } catch (err) {
      res.status(502).json({ error: `Location lookup failed: ${(err as Error).message}` });
    }
  });

  admin.get('/reverse-geocode', async (req, res) => {
    const lat = asNumber(req.query.lat);
    const lng = asNumber(req.query.lng);
    if (!isValidLatLng(lat, lng)) {
      res.status(400).json({ error: 'Valid lat and lng query parameters required' });
      return;
    }
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'CityCompanionAdmin/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(502).json({ error: 'Reverse geocoding unavailable' });
        return;
      }
      const item = (await upstream.json()) as Record<string, unknown>;
      const addr = (item.address as Record<string, string | undefined>) || {};
      const result: GeocodeResult = {
        displayName: asString(item.display_name),
        shortName:
          asString(item.name) ||
          addr.road ||
          addr.suburb ||
          addr.city ||
          addr.town ||
          'Pinned Location',
        state: addr.state || addr.region || '',
        city: addr.city || addr.town || addr.village || '',
        address: asString(item.display_name),
        latitude: lat!,
        longitude: lng!,
      };
      res.json({ result });
    } catch (err) {
      res.status(502).json({ error: `Reverse geocoding failed: ${(err as Error).message}` });
    }
  });

  // Cities CRUD (Create/Delete restricted to Supreme Admin)
  admin.post('/cities', requireSuperAdmin, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const name = asString(body.name);
      const state = asString(body.state);
      const id = sanitizeSlug(body.id || name);
      if (!name || !state) {
        res.status(400).json({ error: 'City name and state are required' });
        return;
      }
      if (!id || !SLUG_REGEX.test(id)) {
        res.status(400).json({ error: 'City id must be a lowercase slug (e.g. indore)' });
        return;
      }
      const lat = asNumber(body.latitude);
      const lng = asNumber(body.longitude);
      if (!isValidLatLng(lat, lng)) {
        res.status(400).json({ error: 'Valid latitude (-90..90) and longitude (-180..180) are required' });
        return;
      }
      const heroImageRaw = asString(body.heroImageUrl);
      const heroImageUrl = heroImageRaw ? sanitizeImageUrl(heroImageRaw) : '';
      if (heroImageRaw && !heroImageUrl) {
        res.status(400).json({ error: 'Invalid heroImageUrl' });
        return;
      }

      const city: CityDoc = {
        id,
        name,
        state,
        latitude: lat!,
        longitude: lng!,
        heroImageUrl,
        collectionName: `city_${id}`,
        heroSubtitle: asString(body.heroSubtitle),
        promoBanner: validatePromoBanner(body.promoBanner, id),
      };

      const created = await store.createCity(city);
      void notifyAppBackend('', 'cities');
      res.status(201).json({ city: created });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(msg.includes('already exists') ? 409 : 500).json({ error: msg });
    }
  });

  admin.put('/cities/:cityId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const existing = await store.getCity(cityId);
      if (!existing) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const patch: Partial<CityDoc> = {};

      if (body.name !== undefined) {
        const name = asString(body.name);
        if (!name) {
          res.status(400).json({ error: 'City name cannot be empty' });
          return;
        }
        patch.name = name;
      }
      if (body.state !== undefined) {
        const state = asString(body.state);
        if (!state) {
          res.status(400).json({ error: 'State cannot be empty' });
          return;
        }
        patch.state = state;
      }
      if (body.latitude !== undefined || body.longitude !== undefined) {
        const lat = body.latitude !== undefined ? asNumber(body.latitude) : existing.latitude;
        const lng = body.longitude !== undefined ? asNumber(body.longitude) : existing.longitude;
        if (!isValidLatLng(lat, lng)) {
          res.status(400).json({ error: 'Valid latitude and longitude are required' });
          return;
        }
        patch.latitude = lat!;
        patch.longitude = lng!;
      }
      if (body.heroImageUrl !== undefined) {
        const raw = asString(body.heroImageUrl);
        const safe = raw ? sanitizeImageUrl(raw) : '';
        if (raw && !safe) {
          res.status(400).json({ error: 'Invalid heroImageUrl' });
          return;
        }
        patch.heroImageUrl = safe;
      }
      if (body.heroSubtitle !== undefined) {
        patch.heroSubtitle = asString(body.heroSubtitle);
      }
      if (body.promoBanner !== undefined) {
        patch.promoBanner =
          body.promoBanner === null
            ? null
            : validatePromoBanner(body.promoBanner, cityId, existing.promoBanner ?? undefined);
      }

      const updated = await store.updateCity(cityId, patch);
      void notifyAppBackend(cityId, 'home');
      if (
        patch.name !== undefined ||
        patch.state !== undefined ||
        patch.latitude !== undefined ||
        patch.longitude !== undefined
      ) {
        void notifyAppBackend('', 'cities');
      }
      res.json({ city: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.delete('/cities/:cityId', requireSuperAdmin, async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      const deleted = await store.deleteCity(cityId);
      if (!deleted) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      void notifyAppBackend('', 'cities');
      res.json({ deleted: true, cityId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Per-City Custom Map Sub-Categories (map_categories collection)
  admin.get('/cities/:cityId/map-categories', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const mapCategories = await store.listMapCategories(cityId);
      res.json({ mapCategories });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.post('/cities/:cityId/map-categories', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const name = asString(req.body?.name);
      if (!name) {
        res.status(400).json({ error: 'Map sub-category name is required' });
        return;
      }
      const created = await store.createMapCategory(cityId, name);
      void notifyAppBackend(cityId, 'map_categories');
      res.status(201).json({ mapCategory: created });
    } catch (err) {
      const msg = (err as Error).message;
      res
        .status(msg.includes('already exists') ? 409 : msg.includes('cannot be empty') ? 400 : 500)
        .json({ error: msg });
    }
  });

  admin.put('/cities/:cityId/map-categories/reorder', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const orderedIds = asStringArray(req.body?.orderedIds);
      if (orderedIds.length === 0) {
        res.status(400).json({ error: 'orderedIds array is required' });
        return;
      }
      const mapCategories = await store.reorderMapCategories(cityId, orderedIds);
      void notifyAppBackend(cityId, 'map_categories');
      res.json({ mapCategories });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.put('/cities/:cityId/map-categories/:catId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const catId = asString(req.params.catId);
      if (!catId || catId.includes('$')) {
        res.status(400).json({ error: 'Invalid map sub-category id' });
        return;
      }
      const patch: { name?: string; sortOrder?: number } = {};
      if (req.body?.name !== undefined) {
        patch.name = asString(req.body.name);
      }
      if (req.body?.sortOrder !== undefined) {
        const order = asNumber(req.body.sortOrder);
        if (order !== null) patch.sortOrder = order;
      }
      const updated = await store.updateMapCategory(cityId, catId, patch);
      if (!updated) {
        res.status(404).json({ error: 'Map sub-category not found' });
        return;
      }
      void notifyAppBackend(cityId, 'map_categories');
      res.json({ mapCategory: updated });
    } catch (err) {
      const msg = (err as Error).message;
      res
        .status(msg.includes('already exists') ? 409 : msg.includes('cannot be empty') ? 400 : 500)
        .json({ error: msg });
    }
  });

  admin.delete('/cities/:cityId/map-categories/:catId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const catId = asString(req.params.catId);
      if (!catId || catId.includes('$')) {
        res.status(400).json({ error: 'Invalid map sub-category id' });
        return;
      }
      const deleted = await store.deleteMapCategory(cityId, catId);
      if (!deleted) {
        res.status(404).json({ error: 'Map sub-category not found' });
        return;
      }
      void notifyAppBackend(cityId, 'map_categories');
      res.json({ deleted: true, id: catId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Categories
  admin.get('/categories/:cityId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const categories = await store.listCategories(cityId);
      res.json({ categories });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.put('/categories/:cityId/:category', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const category = asString(req.params.category).toUpperCase();
      if (!VALID_TOP_CATEGORIES.has(category)) {
        res.status(400).json({ error: 'Invalid fixed top-level category' });
        return;
      }
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const subCategories = asStringArray(req.body?.subCategories);
      const updated = await store.updateCategorySubCategories(
        cityId,
        category as TopCategoryKey,
        subCategories
      );
      void notifyAppBackend(cityId, 'categories');
      res.json({ category: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Places in city_<cityId>
  admin.get('/cities/:cityId/places', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const places = await store.listPlaces(cityId);
      res.json({ places });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.post('/cities/:cityId/places', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const validated = validatePlacePayload(req.body, cityId, true);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const created = await store.createPlace(cityId, validated.data);
      void notifyAppBackend(cityId, 'places');
      res.status(201).json({ place: created });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(msg.includes('already exists') ? 409 : 500).json({ error: msg });
    }
  });

  admin.post('/cities/:cityId/places/bulk', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const rawItems = Array.isArray(req.body) ? req.body : req.body?.places;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        res.status(400).json({ error: 'Provide a non-empty JSON array of places' });
        return;
      }

      const validPlaces: PlaceDoc[] = [];
      const errors: Array<{ index: number; error: string }> = [];
      rawItems.forEach((item, index) => {
        const resVal = validatePlacePayload(item, cityId, true);
        if (resVal.ok) {
          validPlaces.push(resVal.data);
        } else {
          errors.push({ index, error: resVal.error });
        }
      });

      if (errors.length > 0 && validPlaces.length === 0) {
        res.status(400).json({ error: 'All items failed validation', errors });
        return;
      }

      const result = await store.bulkInsertPlaces(cityId, validPlaces);
      if (result.inserted.length > 0) {
        void notifyAppBackend(cityId, 'places');
      }
      res.status(201).json({
        insertedCount: result.inserted.length,
        inserted: result.inserted,
        skipped: result.skipped,
        validationErrors: errors,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.put('/cities/:cityId/places/:placeId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const placeId = asString(req.params.placeId);
      if (!placeId || placeId.includes('$')) {
        res.status(400).json({ error: 'Invalid place id' });
        return;
      }
      const places = await store.listPlaces(cityId);
      const existing = places.find((p) => p.id === placeId);
      if (!existing) {
        res.status(404).json({ error: 'Place not found' });
        return;
      }
      const merged = { ...existing, ...(req.body as Record<string, unknown>), id: existing.id };
      const validated = validatePlacePayload(merged, cityId, false);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const updated = await store.updatePlace(cityId, placeId, validated.data);
      void notifyAppBackend(cityId, 'places');
      res.json({ place: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.delete('/cities/:cityId/places/:placeId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const placeId = asString(req.params.placeId);
      if (!placeId || placeId.includes('$')) {
        res.status(400).json({ error: 'Invalid place id' });
        return;
      }
      const deleted = await store.deletePlace(cityId, placeId);
      if (!deleted) {
        res.status(404).json({ error: 'Place not found' });
        return;
      }
      void notifyAppBackend(cityId, 'places');
      res.json({ deleted: true, placeId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Services in city_<cityId>
  admin.get('/cities/:cityId/services', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const services = await store.listServices(cityId);
      res.json({ services });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.post('/cities/:cityId/services', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const validated = validateServicePayload(req.body, city, true);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const created = await store.createService(cityId, validated.data);
      void notifyAppBackend(cityId, 'services');
      res.status(201).json({ service: created });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(msg.includes('already exists') ? 409 : 500).json({ error: msg });
    }
  });

  admin.put('/cities/:cityId/services/:serviceId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const serviceId = asString(req.params.serviceId);
      if (!serviceId || serviceId.includes('$')) {
        res.status(400).json({ error: 'Invalid service id' });
        return;
      }
      const services = await store.listServices(cityId);
      const existing = services.find((s) => s.id === serviceId);
      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      const merged = { ...existing, ...(req.body as Record<string, unknown>), id: existing.id };
      const validated = validateServicePayload(merged, city, false);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const updated = await store.updateService(cityId, serviceId, validated.data);
      void notifyAppBackend(cityId, 'services');
      res.json({ service: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.delete('/cities/:cityId/services/:serviceId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const serviceId = asString(req.params.serviceId);
      if (!serviceId || serviceId.includes('$')) {
        res.status(400).json({ error: 'Invalid service id' });
        return;
      }
      const deleted = await store.deleteService(cityId, serviceId);
      if (!deleted) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      void notifyAppBackend(cityId, 'services');
      res.json({ deleted: true, serviceId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // App Guides in city_<cityId>
  admin.get('/cities/:cityId/app-guides', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const appGuides = await store.listAppGuides(cityId);
      res.json({ appGuides });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.post('/cities/:cityId/app-guides', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const validated = validateAppGuidePayload(req.body, cityId, true);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const created = await store.createAppGuide(cityId, validated.data);
      void notifyAppBackend(cityId, 'app_guides');
      res.status(201).json({ appGuide: created });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(msg.includes('already exists') ? 409 : 500).json({ error: msg });
    }
  });

  admin.put('/cities/:cityId/app-guides/:appId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const city = await store.getCity(cityId);
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
      const appId = asString(req.params.appId);
      if (!appId || appId.includes('$')) {
        res.status(400).json({ error: 'Invalid app guide id' });
        return;
      }
      const existingList = await store.listAppGuides(cityId);
      const existing = existingList.find((a) => a.id === appId);
      if (!existing) {
        res.status(404).json({ error: 'App guide entry not found' });
        return;
      }
      const merged = { ...existing, ...(req.body as Record<string, unknown>), id: existing.id };
      const validated = validateAppGuidePayload(merged, cityId, false);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const updated = await store.updateAppGuide(cityId, appId, validated.data);
      void notifyAppBackend(cityId, 'app_guides');
      res.json({ appGuide: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.delete('/cities/:cityId/app-guides/:appId', async (req, res) => {
    try {
      const cityId = sanitizeSlug(req.params.cityId);
      if (!assertCityAccess(req, res, cityId)) return;
      const appId = asString(req.params.appId);
      if (!appId || appId.includes('$')) {
        res.status(400).json({ error: 'Invalid app guide id' });
        return;
      }
      const deleted = await store.deleteAppGuide(cityId, appId);
      if (!deleted) {
        res.status(404).json({ error: 'App guide entry not found' });
        return;
      }
      void notifyAppBackend(cityId, 'app_guides');
      res.json({ deleted: true, appId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Trips & Tips moderation
  admin.get('/trips', async (req, res) => {
    try {
      const auth = getAuthContext(req);
      const cityId = sanitizeSlug(req.query.cityId);
      const userId = asString(req.query.userId);
      if (cityId && !assertCityAccess(req, res, cityId)) return;
      let trips = await store.listTrips({
        cityId: cityId || undefined,
        userId: userId || undefined,
      });
      if (!cityId && auth?.role === 'SUB_ADMIN') {
        const allowed = new Set(auth.allowedCityIds);
        trips = trips.filter((t) => allowed.has(t.cityId));
      }
      res.json({ trips });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.delete('/trips/:tripId', async (req, res) => {
    try {
      const tripId = asString(req.params.tripId);
      const trip = await store.getTripById(tripId);
      if (!trip) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      if (!assertCityAccess(req, res, trip.cityId)) return;
      const deleted = await store.deleteTrip(tripId);
      if (!deleted) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      void notifyAppBackend(trip.cityId, 'trips');
      res.json({ deleted: true, tripId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.get('/tips', async (req, res) => {
    try {
      const auth = getAuthContext(req);
      const cityId = sanitizeSlug(req.query.cityId);
      if (cityId) {
        if (!assertCityAccess(req, res, cityId)) return;
        const tips = await store.listTips(cityId);
        res.json({ tips });
        return;
      }
      if (auth?.role === 'SUB_ADMIN') {
        const perCity = await Promise.all(auth.allowedCityIds.map((cid) => store.listTips(cid)));
        const uniqueMap = new Map<string, (typeof perCity)[number][number]>();
        for (const list of perCity) {
          for (const tip of list) {
            uniqueMap.set(tip.id, tip);
          }
        }
        const tips = Array.from(uniqueMap.values()).sort(
          (a, b) => Number(b.timestamp) - Number(a.timestamp)
        );
        res.json({ tips });
        return;
      }
      const tips = await store.listTips(undefined);
      res.json({ tips });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  admin.delete('/tips/:tipId', async (req, res) => {
    try {
      const auth = getAuthContext(req);
      const tipId = asString(req.params.tipId);
      const tip = await store.getTipById(tipId);
      if (!tip) {
        res.status(404).json({ error: 'Tip not found' });
        return;
      }
      if (auth?.role === 'SUB_ADMIN') {
        let permitted = Boolean(tip.cityId && auth.allowedCityIds.includes(tip.cityId));
        if (!permitted && tip.placeId) {
          const allowedPlaces = await Promise.all(
            auth.allowedCityIds.map((cid) => store.listPlaces(cid))
          );
          permitted = allowedPlaces.some((list) => list.some((p) => p.id === tip.placeId));
        }
        if (!permitted) {
          res.status(403).json({ error: 'Access denied: you are not assigned to this tip city' });
          return;
        }
      }
      const deleted = await store.deleteTip(tipId);
      if (!deleted) {
        res.status(404).json({ error: 'Tip not found' });
        return;
      }
      void notifyAppBackend(tip.cityId || '', 'tips');
      res.json({ deleted: true, tipId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Manual full live-sync push endpoint
  const handleManualSyncApps = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    const cityId = req.body?.cityId ? sanitizeSlug(req.body.cityId) : '';
    if (auth?.role === 'SUB_ADMIN') {
      if (!cityId) {
        res.status(403).json({ error: 'Sub-admins must specify an assigned city to sync' });
        return;
      }
      if (!assertCityAccess(req, res, cityId)) return;
    }
    await notifyAppBackend(cityId, 'all');
    res.json({ ok: true, cityId, scope: 'all' });
  };

  admin.post('/sync-apps', handleManualSyncApps);

  app.use('/api/v1/admin', admin);
  app.post('/api/admin/sync-apps', requireAdminAuth, handleManualSyncApps);

  // Vite dev middleware or production static serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const distAssets = path.join(distDir, 'src/assets');
    if (fs.existsSync(distAssets)) {
      app.use('/src/assets', express.static(distAssets));
    }
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`City Companion Admin server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
