export type PromoTargetRoute = 'plan_trip' | 'explore' | 'map' | 'services';

export type TopCategoryKey =
  | 'HERITAGE'
  | 'FOOD'
  | 'SHOPPING'
  | 'ENTERTAINMENT'
  | 'NATURE'
  | 'CULTURE';

export type PlaceCategoryKey =
  | TopCategoryKey
  | 'HOSPITAL'
  | 'ATM'
  | 'PHARMACY'
  | 'TRANSPORT'
  | 'EMERGENCY';

export type ServiceGroupKey = 'TRANSPORT' | 'COLLEGES' | 'PHARMACY' | 'EMERGENCY';

export type ServiceMode = 'CONTACT' | 'SERVICE_NAME';

export interface PromoBanner {
  id: string;
  badgeText: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string;
  targetRoute: PromoTargetRoute;
}

export interface CityDoc {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  heroImageUrl: string;
  collectionName: string;
  heroSubtitle: string;
  promoBanner: PromoBanner | null;
}

export interface CategoryDoc {
  id: string;
  cityId: string;
  category: TopCategoryKey;
  title: string;
  subCategories: string[];
}

export interface PlaceDoc {
  id: string;
  cityId: string;
  docType: 'place';
  name: string;
  subtitle: string;
  category: PlaceCategoryKey;
  subCategories: string[];
  tags: string[];
  imageUrl: string;
  description: string;
  rating: number;
  reviewCountLabel: string;
  distanceLabel: string;
  openHours: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  isPopular: boolean;
  isTrending: boolean;
}

export interface ServiceDoc {
  id: string;
  cityId: string;
  docType: 'service';
  group: ServiceGroupKey;
  serviceMode: ServiceMode;
  category: string;
  name: string;
  subtitle: string;
  description: string;
  address: string;
  distanceOrHours: string;
  highlightNumber: string;
  phone: string;
  actionUrl: string;
  isUrgent: boolean;
  iconKey: string;
  sortOrder: number;
  latitude: number;
  longitude: number;
}

export interface MapCategoryDoc {
  id: string;
  cityId: string;
  name: string;
  sortOrder: number;
}

export interface HealthStatus {
  ok: boolean;
  dbMode: 'mongodb' | 'local';
}

export interface MapConfigStatus {
  configured: boolean;
  maskedKey: string;
  defaultZoom: number;
}

export interface CityMapVerification {
  city: CityDoc;
  places: PlaceDoc[];
  services: ServiceDoc[];
  mapSubCategories: string[];
  usingFallback: boolean;
}

export interface AppGuideDoc {
  id: string;
  cityId: string;
  docType: 'app_guide';
  appName: string;
  taskCategory: string;
  highlightTag: string;
  description: string;
  howToUse: string;
  iconUrl: string;
  iconKey: string;
  packageName: string;
  playStoreUrl: string;
  websiteUrl: string;
  sortOrder: number;
}

export type TripStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED';

export interface TripDoc {
  id: string;
  userId: string;
  title: string;
  cityId: string;
  duration: string;
  placeIds: string[];
  completedPlaceIds: string[];
  startDateMillis: number;
  status: TripStatus;
  createdAt: number | string;
}

export interface TipDoc {
  id: string;
  cityId?: string;
  placeId: string;
  placeName: string;
  note: string;
  rating: number;
  timestamp: number | string;
}

export interface GeocodeResult {
  displayName: string;
  shortName: string;
  state: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const FIXED_CATEGORIES: ReadonlyArray<{
  category: TopCategoryKey;
  title: string;
  defaultSubs: string[];
}> = [
  {
    category: 'HERITAGE',
    title: 'Places & Attractions',
    defaultSubs: ['Palaces', 'Forts', 'Monuments', 'Museums'],
  },
  {
    category: 'FOOD',
    title: 'Food & Dining',
    defaultSubs: ['Street Food', 'Night Markets', 'Cafes', 'Sweets & Namkeen'],
  },
  {
    category: 'SHOPPING',
    title: 'Shopping & Markets',
    defaultSubs: ['Bazaars', 'Handicrafts', 'Malls', 'Textiles'],
  },
  {
    category: 'ENTERTAINMENT',
    title: 'Fun & Entertainment',
    defaultSubs: ['Gaming Zones', 'Cinemas', 'Live Music', 'Water Parks'],
  },
  {
    category: 'NATURE',
    title: 'Nature & Outdoors',
    defaultSubs: ['Lakes', 'Parks', 'Waterfalls', 'Viewpoints'],
  },
  {
    category: 'CULTURE',
    title: 'Culture & Events',
    defaultSubs: ['Temples', 'Art Galleries', 'Festivals', 'Theaters'],
  },
];

export const PLACE_CATEGORIES: ReadonlyArray<{ value: PlaceCategoryKey; label: string }> = [
  { value: 'HERITAGE', label: 'Heritage — Places & Attractions' },
  { value: 'FOOD', label: 'Food — Food & Dining' },
  { value: 'SHOPPING', label: 'Shopping — Shopping & Markets' },
  { value: 'ENTERTAINMENT', label: 'Entertainment — Fun & Entertainment' },
  { value: 'NATURE', label: 'Nature — Nature & Outdoors' },
  { value: 'CULTURE', label: 'Culture — Culture & Events' },
  { value: 'HOSPITAL', label: 'Map — Hospital' },
  { value: 'ATM', label: 'Map — ATM' },
  { value: 'PHARMACY', label: 'Map — Pharmacy' },
  { value: 'TRANSPORT', label: 'Map — Transport Hub' },
  { value: 'EMERGENCY', label: 'Map — Emergency Service' },
];

export const SERVICE_GROUPS: ReadonlyArray<{ value: ServiceGroupKey; label: string }> = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'COLLEGES', label: 'Colleges' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

export const SERVICE_CONTACT_CATEGORIES = ['Contact', 'Emergency', 'Helpline'] as const;

export const SERVICE_SHORTCUT_CATEGORIES = [
  'Service Name',
  'Hospital',
  'Pharmacy',
  'ATM',
  'Transport',
  'Food',
  'Emergency',
] as const;

export const SERVICE_ICON_KEYS = [
  { value: 'phone', label: 'Phone / Helpline' },
  { value: 'ambulance', label: 'Ambulance / Medical' },
  { value: 'shield-alert', label: 'Emergency / Police' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'pill', label: 'Pharmacy' },
  { value: 'banknote', label: 'ATM / Banking' },
  { value: 'train', label: 'Train / Metro' },
  { value: 'bus', label: 'Bus / Transit' },
  { value: 'utensils', label: 'Food' },
  { value: 'graduation-cap', label: 'College / University' },
  { value: 'building-2', label: 'Civic Office' },
] as const;

export const APP_TASK_CATEGORIES = [
  'Metro & Bus',
  'Cab Booking',
  'Food Delivery',
  'Civic Help',
  'Healthcare & Pharmacy',
  'Local Events & Tickets',
] as const;

export const PROMO_TARGET_ROUTES: ReadonlyArray<{ value: PromoTargetRoute; label: string }> = [
  { value: 'explore', label: 'Explore Feed' },
  { value: 'plan_trip', label: 'Plan Trip' },
  { value: 'map', label: 'Interactive Map' },
  { value: 'services', label: 'City Services' },
];

export type AdminRole = 'SUPER_ADMIN' | 'SUB_ADMIN';

export interface SubAdminPublicDoc {
  id: string;
  name: string;
  email: string;
  allowedCityIds: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminSessionUser {
  role: AdminRole;
  email: string;
  name: string;
  allowedCityIds: string[];
  dbMode: 'mongodb' | 'local';
}

