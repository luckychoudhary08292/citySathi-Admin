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
  promoBanner: PromoBanner;
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
  name: string;
  subtitle: string;
  distanceOrHours: string;
  latitude: number;
  longitude: number;
  phone: string;
}

export interface TripDoc {
  id: string;
  userId: string;
  title: string;
  cityId: string;
  duration: string;
  placeIds: string[];
  completedPlaceIds: string[];
  startDateMillis: number;
  status: 'UPCOMING' | 'COMPLETED';
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

export const PROMO_TARGET_ROUTES: ReadonlyArray<{ value: PromoTargetRoute; label: string }> = [
  { value: 'explore', label: 'Explore Feed' },
  { value: 'plan_trip', label: 'Plan Trip' },
  { value: 'map', label: 'Interactive Map' },
  { value: 'services', label: 'City Services' },
];
