import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import type {
  AppGuideDoc,
  CategoryDoc,
  CityDoc,
  MapCategoryDoc,
  PlaceCategoryKey,
  PlaceDoc,
  ServiceDoc,
  ServiceGroupKey,
  ServiceMode,
  SubAdminPublicDoc,
  TipDoc,
  TopCategoryKey,
  TripDoc,
} from '../src/types.ts';
import { FIXED_CATEGORIES, PLACE_CATEGORIES, SERVICE_GROUPS } from '../src/types.ts';
import { buildDefaultCategoriesForCity, createInitialSeedData } from './seed.ts';
import type { SeedDatabaseState, SubAdminRecord } from './seed.ts';

const VALID_PLACE_CATEGORIES = new Set<string>(PLACE_CATEGORIES.map((c) => c.value));
const VALID_SERVICE_GROUPS = new Set<string>(SERVICE_GROUPS.map((g) => g.value));

function normalizeStringArray(val: unknown): string[] {
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

function normalizePlaceDoc(raw: Record<string, unknown>, fallbackCityId: string): PlaceDoc {
  const rawId =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : raw._id !== undefined && raw._id !== null
        ? String(raw._id)
        : '';
  const cityId =
    typeof raw.cityId === 'string' && raw.cityId.trim() ? raw.cityId.trim() : fallbackCityId;
  const rawCat = typeof raw.category === 'string' ? raw.category.trim().toUpperCase() : 'HERITAGE';
  const category: PlaceCategoryKey = VALID_PLACE_CATEGORIES.has(rawCat)
    ? (rawCat as PlaceCategoryKey)
    : 'HERITAGE';
  const ratingNum = typeof raw.rating === 'number' && Number.isFinite(raw.rating) ? raw.rating : 4.5;
  const latNum = typeof raw.latitude === 'number' && Number.isFinite(raw.latitude) ? raw.latitude : 0;
  const lngNum = typeof raw.longitude === 'number' && Number.isFinite(raw.longitude) ? raw.longitude : 0;

  return {
    id: rawId,
    cityId,
    docType: 'place',
    name: typeof raw.name === 'string' ? raw.name : '',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    category,
    subCategories: normalizeStringArray(raw.subCategories),
    tags: normalizeStringArray(raw.tags),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    rating: ratingNum,
    reviewCountLabel: typeof raw.reviewCountLabel === 'string' ? raw.reviewCountLabel : '',
    distanceLabel: typeof raw.distanceLabel === 'string' ? raw.distanceLabel : '',
    openHours: typeof raw.openHours === 'string' ? raw.openHours : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    latitude: latNum,
    longitude: lngNum,
    isPopular: Boolean(raw.isPopular),
    isTrending: Boolean(raw.isTrending),
  };
}

function normalizeServiceDoc(raw: Record<string, unknown>, fallbackCityId: string): ServiceDoc {
  const rawId =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : raw._id !== undefined && raw._id !== null
        ? String(raw._id)
        : '';
  const cityId =
    typeof raw.cityId === 'string' && raw.cityId.trim() ? raw.cityId.trim() : fallbackCityId;
  const rawGroup = typeof raw.group === 'string' ? raw.group.trim().toUpperCase() : 'TRANSPORT';
  const group: ServiceGroupKey = VALID_SERVICE_GROUPS.has(rawGroup)
    ? (rawGroup as ServiceGroupKey)
    : 'TRANSPORT';
  const latNum = typeof raw.latitude === 'number' && Number.isFinite(raw.latitude) ? raw.latitude : 0;
  const lngNum = typeof raw.longitude === 'number' && Number.isFinite(raw.longitude) ? raw.longitude : 0;

  const rawCategory = typeof raw.category === 'string' ? raw.category.trim() : '';
  const rawMode = typeof raw.serviceMode === 'string' ? raw.serviceMode.trim().toUpperCase() : '';
  const inferredMode: ServiceMode =
    rawMode === 'SERVICE_NAME' || rawCategory.toLowerCase() === 'service name'
      ? 'SERVICE_NAME'
      : 'CONTACT';
  const defaultCategory = group === 'EMERGENCY' ? 'Emergency' : 'Contact';
  const category = rawCategory || (inferredMode === 'SERVICE_NAME' ? 'Service Name' : defaultCategory);
  const sortOrder =
    typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0;

  const phone =
    typeof raw.phone === 'string' && raw.phone.trim()
      ? raw.phone
      : typeof raw.contactNumber === 'string'
        ? raw.contactNumber
        : '';

  return {
    id: rawId,
    cityId,
    docType: 'service',
    group,
    serviceMode: inferredMode,
    category,
    name: typeof raw.name === 'string' ? raw.name : '',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    distanceOrHours: typeof raw.distanceOrHours === 'string' ? raw.distanceOrHours : '',
    highlightNumber:
      typeof raw.highlightNumber === 'string' && raw.highlightNumber.trim()
        ? raw.highlightNumber
        : inferredMode === 'CONTACT'
          ? phone
          : '',
    phone,
    actionUrl: typeof raw.actionUrl === 'string' ? raw.actionUrl : '',
    isUrgent: Boolean(raw.isUrgent),
    iconKey: typeof raw.iconKey === 'string' && raw.iconKey.trim() ? raw.iconKey : 'phone',
    sortOrder,
    latitude: latNum,
    longitude: lngNum,
  };
}

function normalizeMapCategoryDoc(
  raw: Record<string, unknown>,
  fallbackCityId: string
): MapCategoryDoc {
  const rawId =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : raw._id !== undefined && raw._id !== null
        ? String(raw._id)
        : '';
  const cityId =
    typeof raw.cityId === 'string' && raw.cityId.trim() ? raw.cityId.trim() : fallbackCityId;
  const sortOrder =
    typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0;
  return {
    id: rawId,
    cityId,
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    sortOrder,
  };
}

function normalizeAppGuideDoc(raw: Record<string, unknown>, fallbackCityId: string): AppGuideDoc {
  const rawId =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : raw._id !== undefined && raw._id !== null
        ? String(raw._id)
        : '';
  const cityId =
    typeof raw.cityId === 'string' && raw.cityId.trim() ? raw.cityId.trim() : fallbackCityId;
  const sortOrder =
    typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0;

  return {
    id: rawId,
    cityId,
    docType: 'app_guide',
    appName: typeof raw.appName === 'string' ? raw.appName : '',
    taskCategory: typeof raw.taskCategory === 'string' ? raw.taskCategory : 'Civic Help',
    highlightTag: typeof raw.highlightTag === 'string' ? raw.highlightTag : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    howToUse: typeof raw.howToUse === 'string' ? raw.howToUse : '',
    iconUrl: typeof raw.iconUrl === 'string' ? raw.iconUrl : '',
    iconKey: typeof raw.iconKey === 'string' && raw.iconKey.trim() ? raw.iconKey : 'smartphone',
    packageName: typeof raw.packageName === 'string' ? raw.packageName : '',
    playStoreUrl: typeof raw.playStoreUrl === 'string' ? raw.playStoreUrl : '',
    websiteUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : '',
    sortOrder,
  };
}

function buildItemIdFilter(
  itemId: string,
  docType: 'place' | 'service' | 'app_guide'
): Record<string, unknown> {
  if (ObjectId.isValid(itemId)) {
    return {
      docType,
      $or: [{ id: itemId }, { _id: new ObjectId(itemId) }],
    };
  }
  return { id: itemId, docType };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'city-companion-db.json');

export interface AdminConfigRecord {
  email: string;
  passwordHash: string;
  createdAt: number;
}

export class CityCompanionStore {
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private mode: 'mongodb' | 'local' = 'local';
  private localState: SeedDatabaseState | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.initializeInternal();
    return this.initPromise;
  }

  private async initializeInternal(): Promise<void> {
    const uri = process.env.MONGODB_URI?.trim();
    const dbName = process.env.MONGODB_DB_NAME?.trim() || 'city_companion';

    if (uri) {
      try {
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const db = client.db(dbName);
        await db.command({ ping: 1 });
        this.mongoClient = client;
        this.mongoDb = db;
        this.mode = 'mongodb';
        await this.ensureMongoCollectionsInitialized(db);
        console.log(`[db] Connected to MongoDB database "${dbName}"`);
        return;
      } catch (err) {
        console.warn('[db] MongoDB connection failed, falling back to persistent local store:', (err as Error).message);
      }
    }

    this.mode = 'local';
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LOCAL_DB_PATH)) {
      try {
        const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as SeedDatabaseState;
        if (!Array.isArray(parsed.mapCategories)) {
          parsed.mapCategories = [];
        }
        if (!Array.isArray(parsed.subAdmins)) {
          parsed.subAdmins = [];
        }
        this.localState = parsed;
      } catch {
        this.localState = createInitialSeedData();
        this.persistLocal();
      }
    } else {
      this.localState = createInitialSeedData();
      this.persistLocal();
    }
    console.log(`[db] Using persistent local store at ${LOCAL_DB_PATH}`);
  }

  private async ensureMongoCollectionsInitialized(db: Db): Promise<void> {
    const existing = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = new Set(existing.map((c) => c.name));
    if (!names.has('cities')) {
      await db.createCollection('cities');
    }
    if (!names.has('categories')) {
      await db.createCollection('categories');
    }
    if (!names.has('map_categories')) {
      await db.createCollection('map_categories');
    }
    if (!names.has('trips')) {
      await db.createCollection('trips');
    }
    if (!names.has('tips')) {
      await db.createCollection('tips');
    }
    if (!names.has('sub_admins')) {
      await db.createCollection('sub_admins');
    }
    await db.collection('sub_admins').createIndex({ id: 1 }, { unique: true });
    await db.collection('sub_admins').createIndex({ email: 1 }, { unique: true });
  }

  private persistLocal(): void {
    if (!this.localState) return;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(this.localState, null, 2), 'utf-8');
  }

  getMode(): 'mongodb' | 'local' {
    return this.mode;
  }

  async getAdminConfig(): Promise<AdminConfigRecord | null> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const doc = await this.mongoDb
        .collection<AdminConfigRecord & { _id?: unknown }>('admin_config')
        .findOne({ key: 'primary_admin' } as Record<string, unknown>);
      return doc ? { email: doc.email, passwordHash: doc.passwordHash, createdAt: doc.createdAt } : null;
    }
    return this.localState?.adminConfig ?? null;
  }

  async setAdminConfigIfEmpty(record: AdminConfigRecord): Promise<boolean> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const col = this.mongoDb.collection('admin_config');
      const existing = await col.findOne({ key: 'primary_admin' });
      if (existing) return false;
      await col.insertOne({ key: 'primary_admin', ...record });
      return true;
    }
    if (!this.localState) return false;
    if (this.localState.adminConfig) return false;
    this.localState.adminConfig = record;
    this.persistLocal();
    return true;
  }

  // Cities
  async listCities(): Promise<CityDoc[]> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      return this.mongoDb
        .collection<CityDoc>('cities')
        .find({}, { projection: { _id: 0 } })
        .sort({ name: 1 })
        .toArray();
    }
    return [...(this.localState?.cities ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCity(cityId: string): Promise<CityDoc | null> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      return this.mongoDb.collection<CityDoc>('cities').findOne({ id: cityId }, { projection: { _id: 0 } });
    }
    return this.localState?.cities.find((c) => c.id === cityId) ?? null;
  }

  async createCity(city: CityDoc): Promise<CityDoc> {
    await this.init();
    const collectionName = `city_${city.id}`;
    const doc: CityDoc = { ...city, collectionName };

    if (this.mode === 'mongodb' && this.mongoDb) {
      const existing = await this.mongoDb.collection<CityDoc>('cities').findOne({ id: doc.id });
      if (existing) {
        throw new Error(`City with id "${doc.id}" already exists`);
      }
      await this.mongoDb.collection<CityDoc>('cities').insertOne({ ...doc });

      // Initialize personal city_<cityId> collection
      const existingCols = await this.mongoDb.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
      if (existingCols.length === 0) {
        await this.mongoDb.createCollection(collectionName);
      }
      await this.mongoDb.collection(collectionName).createIndex({ id: 1 }, { unique: true });
      await this.mongoDb.collection(collectionName).createIndex({ docType: 1 });

      // Create the 6 fixed category documents
      const defaultCats = buildDefaultCategoriesForCity(doc.id);
      const catCol = this.mongoDb.collection<CategoryDoc>('categories');
      for (const cat of defaultCats) {
        await catCol.updateOne(
          { cityId: doc.id, category: cat.category },
          { $setOnInsert: cat },
          { upsert: true }
        );
      }
      return doc;
    }

    if (!this.localState) throw new Error('Database not initialized');
    if (this.localState.cities.some((c) => c.id === doc.id)) {
      throw new Error(`City with id "${doc.id}" already exists`);
    }
    this.localState.cities.push(doc);
    if (!this.localState.cityCollections[collectionName]) {
      this.localState.cityCollections[collectionName] = [];
    }
    const existingCats = this.localState.categories.filter((c) => c.cityId === doc.id);
    if (existingCats.length === 0) {
      this.localState.categories.push(...buildDefaultCategoriesForCity(doc.id));
    }
    this.persistLocal();
    return doc;
  }

  async updateCity(cityId: string, patch: Partial<CityDoc>): Promise<CityDoc | null> {
    await this.init();
    const safePatch = { ...patch };
    delete safePatch.id;
    delete safePatch.collectionName;

    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb
        .collection<CityDoc>('cities')
        .findOneAndUpdate(
          { id: cityId },
          { $set: safePatch },
          { returnDocument: 'after', projection: { _id: 0 } }
        );
      return res ?? null;
    }

    if (!this.localState) return null;
    const idx = this.localState.cities.findIndex((c) => c.id === cityId);
    if (idx === -1) return null;
    const updated: CityDoc = {
      ...this.localState.cities[idx],
      ...safePatch,
      id: cityId,
      collectionName: `city_${cityId}`,
    };
    this.localState.cities[idx] = updated;
    this.persistLocal();
    return updated;
  }

  async deleteCity(cityId: string): Promise<boolean> {
    await this.init();
    const collectionName = `city_${cityId}`;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const delRes = await this.mongoDb.collection<CityDoc>('cities').deleteOne({ id: cityId });
      if (delRes.deletedCount === 0) return false;
      await this.mongoDb.collection<CategoryDoc>('categories').deleteMany({ cityId });
      await this.mongoDb.collection<MapCategoryDoc>('map_categories').deleteMany({ cityId });
      await this.mongoDb
        .collection<SubAdminRecord>('sub_admins')
        .updateMany({ allowedCityIds: cityId }, { $pull: { allowedCityIds: cityId } });
      const cols = await this.mongoDb.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
      if (cols.length > 0) {
        await this.mongoDb.dropCollection(collectionName);
      }
      return true;
    }

    if (!this.localState) return false;
    const before = this.localState.cities.length;
    this.localState.cities = this.localState.cities.filter((c) => c.id !== cityId);
    if (this.localState.cities.length === before) return false;
    this.localState.categories = this.localState.categories.filter((c) => c.cityId !== cityId);
    this.localState.mapCategories = (this.localState.mapCategories ?? []).filter(
      (c) => c.cityId !== cityId
    );
    this.localState.subAdmins = (this.localState.subAdmins ?? []).map((sa) => ({
      ...sa,
      allowedCityIds: sa.allowedCityIds.filter((cid) => cid !== cityId),
    }));
    delete this.localState.cityCollections[collectionName];
    this.persistLocal();
    return true;
  }

  // Categories
  async listCategories(cityId: string): Promise<CategoryDoc[]> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const catCol = this.mongoDb.collection<CategoryDoc>('categories');
      let docs = await catCol.find({ cityId }, { projection: { _id: 0 } }).toArray();
      if (docs.length < FIXED_CATEGORIES.length) {
        const defaults = buildDefaultCategoriesForCity(cityId);
        const present = new Set(docs.map((d) => d.category));
        for (const def of defaults) {
          if (!present.has(def.category)) {
            await catCol.updateOne(
              { cityId, category: def.category },
              { $setOnInsert: def },
              { upsert: true }
            );
          }
        }
        docs = await catCol.find({ cityId }, { projection: { _id: 0 } }).toArray();
      }
      const order = new Map(FIXED_CATEGORIES.map((c, idx) => [c.category, idx]));
      return docs.sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99));
    }

    if (!this.localState) return [];
    let docs = this.localState.categories.filter((c) => c.cityId === cityId);
    if (docs.length < FIXED_CATEGORIES.length) {
      const defaults = buildDefaultCategoriesForCity(cityId);
      const present = new Set(docs.map((d) => d.category));
      let added = false;
      for (const def of defaults) {
        if (!present.has(def.category)) {
          this.localState.categories.push(def);
          added = true;
        }
      }
      if (added) this.persistLocal();
      docs = this.localState.categories.filter((c) => c.cityId === cityId);
    }
    const order = new Map(FIXED_CATEGORIES.map((c, idx) => [c.category, idx]));
    return docs.sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99));
  }

  async updateCategorySubCategories(
    cityId: string,
    category: TopCategoryKey,
    subCategories: string[]
  ): Promise<CategoryDoc | null> {
    await this.init();
    const fixedMeta = FIXED_CATEGORIES.find((f) => f.category === category);
    if (!fixedMeta) return null;

    if (this.mode === 'mongodb' && this.mongoDb) {
      const catCol = this.mongoDb.collection<CategoryDoc>('categories');
      const id = `${cityId}_${category.toLowerCase()}`;
      const res = await catCol.findOneAndUpdate(
        { cityId, category },
        {
          $set: { subCategories, title: fixedMeta.title },
          $setOnInsert: { id, cityId, category },
        },
        { upsert: true, returnDocument: 'after', projection: { _id: 0 } }
      );
      return res ?? null;
    }

    if (!this.localState) return null;
    const idx = this.localState.categories.findIndex(
      (c) => c.cityId === cityId && c.category === category
    );
    if (idx === -1) {
      const created: CategoryDoc = {
        id: `${cityId}_${category.toLowerCase()}`,
        cityId,
        category,
        title: fixedMeta.title,
        subCategories,
      };
      this.localState.categories.push(created);
      this.persistLocal();
      return created;
    }
    this.localState.categories[idx] = {
      ...this.localState.categories[idx],
      subCategories,
    };
    this.persistLocal();
    return this.localState.categories[idx];
  }

  // Places (city_<cityId>, docType: "place")
  async listPlaces(cityId: string): Promise<PlaceDoc[]> {
    await this.init();
    const collectionName = `city_${cityId}`;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const docs = await this.mongoDb
        .collection(collectionName)
        .find({ docType: 'place' })
        .sort({ name: 1 })
        .toArray();
      return docs.map((d) => normalizePlaceDoc(d as unknown as Record<string, unknown>, cityId));
    }
    const items = this.localState?.cityCollections[collectionName] ?? [];
    return items
      .filter((item): item is PlaceDoc => item.docType === 'place')
      .map((d) => normalizePlaceDoc(d as unknown as Record<string, unknown>, cityId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createPlace(cityId: string, place: PlaceDoc): Promise<PlaceDoc> {
    await this.init();
    const collectionName = `city_${cityId}`;
    const doc = normalizePlaceDoc({ ...place, cityId, docType: 'place' }, cityId);

    if (this.mode === 'mongodb' && this.mongoDb) {
      const col = this.mongoDb.collection<PlaceDoc | ServiceDoc>(collectionName);
      const existing = await col.findOne({ id: doc.id });
      if (existing) {
        throw new Error(`Item with id "${doc.id}" already exists in ${collectionName}`);
      }
      const insertRes = await col.insertOne({ ...doc });
      if (!doc.id && insertRes.insertedId) {
        doc.id = insertRes.insertedId.toString();
      }
      return doc;
    }

    if (!this.localState) throw new Error('Database not initialized');
    if (!this.localState.cityCollections[collectionName]) {
      this.localState.cityCollections[collectionName] = [];
    }
    if (this.localState.cityCollections[collectionName].some((i) => i.id === doc.id)) {
      throw new Error(`Item with id "${doc.id}" already exists in ${collectionName}`);
    }
    this.localState.cityCollections[collectionName].push(doc);
    this.persistLocal();
    return doc;
  }

  async bulkInsertPlaces(
    cityId: string,
    places: PlaceDoc[]
  ): Promise<{ inserted: PlaceDoc[]; skipped: Array<{ id: string; reason: string }> }> {
    await this.init();
    const inserted: PlaceDoc[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const p of places) {
      try {
        const created = await this.createPlace(cityId, p);
        inserted.push(created);
      } catch (err) {
        skipped.push({ id: p.id, reason: (err as Error).message });
      }
    }
    return { inserted, skipped };
  }

  async updatePlace(
    cityId: string,
    placeId: string,
    patch: Partial<PlaceDoc>
  ): Promise<PlaceDoc | null> {
    await this.init();
    const collectionName = `city_${cityId}`;
    const safePatch: Partial<PlaceDoc> = { ...patch, cityId, docType: 'place' as const };
    if (safePatch.category) {
      const upperCat = String(safePatch.category).trim().toUpperCase();
      safePatch.category = VALID_PLACE_CATEGORIES.has(upperCat)
        ? (upperCat as PlaceCategoryKey)
        : 'HERITAGE';
    }
    if (safePatch.subCategories !== undefined) {
      safePatch.subCategories = normalizeStringArray(safePatch.subCategories);
    }
    delete safePatch.id;

    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb
        .collection(collectionName)
        .findOneAndUpdate(
          buildItemIdFilter(placeId, 'place'),
          { $set: safePatch },
          { returnDocument: 'after' }
        );
      return res ? normalizePlaceDoc(res as unknown as Record<string, unknown>, cityId) : null;
    }

    const items = this.localState?.cityCollections[collectionName];
    if (!items) return null;
    const idx = items.findIndex((i) => i.id === placeId && i.docType === 'place');
    if (idx === -1) return null;
    const updated = normalizePlaceDoc(
      {
        ...(items[idx] as PlaceDoc),
        ...safePatch,
        id: placeId,
        cityId,
        docType: 'place',
      } as unknown as Record<string, unknown>,
      cityId
    );
    items[idx] = updated;
    this.persistLocal();
    return updated;
  }

  async deletePlace(cityId: string, placeId: string): Promise<boolean> {
    await this.init();
    const collectionName = `city_${cityId}`;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb
        .collection(collectionName)
        .deleteOne(buildItemIdFilter(placeId, 'place'));
      return res.deletedCount > 0;
    }
    const items = this.localState?.cityCollections[collectionName];
    if (!items) return false;
    const before = items.length;
    this.localState!.cityCollections[collectionName] = items.filter(
      (i) => !(i.id === placeId && i.docType === 'place')
    );
    const deleted = this.localState!.cityCollections[collectionName].length < before;
    if (deleted) this.persistLocal();
    return deleted;
  }

  // Services (city_<cityId>, docType: "service")
  async listServices(cityId: string): Promise<ServiceDoc[]> {
    await this.init();
    const collectionName = `city_${cityId}`;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const docs = await this.mongoDb
        .collection(collectionName)
        .find({ docType: 'service' })
        .sort({ sortOrder: 1, name: 1 })
        .toArray();
      return docs
        .map((d) => normalizeServiceDoc(d as unknown as Record<string, unknown>, cityId))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    const items = this.localState?.cityCollections[collectionName] ?? [];
    return items
      .filter((item): item is ServiceDoc => item.docType === 'service')
      .map((d) => normalizeServiceDoc(d as unknown as Record<string, unknown>, cityId))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async createService(cityId: string, service: ServiceDoc): Promise<ServiceDoc> {
    await this.init();
    const collectionName = `city_${cityId}`;
    const doc = normalizeServiceDoc({ ...service, cityId, docType: 'service' }, cityId);

    if (this.mode === 'mongodb' && this.mongoDb) {
      const col = this.mongoDb.collection<PlaceDoc | ServiceDoc | AppGuideDoc>(collectionName);
      const existing = await col.findOne({ id: doc.id });
      if (existing) {
        throw new Error(`Item with id "${doc.id}" already exists in ${collectionName}`);
      }
      const insertRes = await col.insertOne({ ...doc });
      if (!doc.id && insertRes.insertedId) {
        doc.id = insertRes.insertedId.toString();
      }
      return doc;
    }

    if (!this.localState) throw new Error('Database not initialized');
    if (!this.localState.cityCollections[collectionName]) {
      this.localState.cityCollections[collectionName] = [];
    }
    if (this.localState.cityCollections[collectionName].some((i) => i.id === doc.id)) {
      throw new Error(`Item with id "${doc.id}" already exists in ${collectionName}`);
    }
    this.localState.cityCollections[collectionName].push(doc);
    this.persistLocal();
    return doc;
  }

  async updateService(
    cityId: string,
    serviceId: string,
    patch: Partial<ServiceDoc>
  ): Promise<ServiceDoc | null> {
    await this.init();
    const collectionName = `city_${cityId}`;
    const safePatch: Partial<ServiceDoc> = { ...patch, cityId, docType: 'service' as const };
    if (safePatch.group) {
      const upperGroup = String(safePatch.group).trim().toUpperCase();
      safePatch.group = VALID_SERVICE_GROUPS.has(upperGroup)
        ? (upperGroup as ServiceGroupKey)
        : 'TRANSPORT';
    }
    delete safePatch.id;

    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb
        .collection(collectionName)
        .findOneAndUpdate(
          buildItemIdFilter(serviceId, 'service'),
          { $set: safePatch },
          { returnDocument: 'after' }
        );
      return res ? normalizeServiceDoc(res as unknown as Record<string, unknown>, cityId) : null;
    }

    const items = this.localState?.cityCollections[collectionName];
    if (!items) return null;
    const idx = items.findIndex((i) => i.id === serviceId && i.docType === 'service');
    if (idx === -1) return null;
    const updated = normalizeServiceDoc(
      {
        ...(items[idx] as ServiceDoc),
        ...safePatch,
        id: serviceId,
        cityId,
        docType: 'service',
      } as unknown as Record<string, unknown>,
      cityId
    );
    items[idx] = updated;
    this.persistLocal();
    return updated;
  }

  async deleteService(cityId: string, serviceId: string): Promise<boolean> {
    await this.init();
    const collectionName = `city_${cityId}`;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb
        .collection(collectionName)
        .deleteOne(buildItemIdFilter(serviceId, 'service'));
      return res.deletedCount > 0;
    }
    const items = this.localState?.cityCollections[collectionName];
    if (!items) return false;
    const before = items.length;
    this.localState!.cityCollections[collectionName] = items.filter(
      (i) => !(i.id === serviceId && i.docType === 'service')
    );
    const deleted = this.localState!.cityCollections[collectionName].length < before;
    if (deleted) this.persistLocal();
    return deleted;
  }

  // App Guides (city_<cityId>, docType: "app_guide")
  async listAppGuides(cityId: string): Promise<AppGuideDoc[]> {
    await this.init();
    const collectionName = `city_${cityId}`;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const docs = await this.mongoDb
        .collection(collectionName)
        .find({ docType: 'app_guide' })
        .sort({ sortOrder: 1, appName: 1 })
        .toArray();
      return docs
        .map((d) => normalizeAppGuideDoc(d as unknown as Record<string, unknown>, cityId))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.appName.localeCompare(b.appName));
    }
    const items = this.localState?.cityCollections[collectionName] ?? [];
    return items
      .filter((item): item is AppGuideDoc => item.docType === 'app_guide')
      .map((d) => normalizeAppGuideDoc(d as unknown as Record<string, unknown>, cityId))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.appName.localeCompare(b.appName));
  }

  async createAppGuide(cityId: string, appGuide: AppGuideDoc): Promise<AppGuideDoc> {
    await this.init();
    const collectionName = `city_${cityId}`;
    const doc = normalizeAppGuideDoc({ ...appGuide, cityId, docType: 'app_guide' }, cityId);

    if (this.mode === 'mongodb' && this.mongoDb) {
      const col = this.mongoDb.collection<PlaceDoc | ServiceDoc | AppGuideDoc>(collectionName);
      const existing = await col.findOne({ id: doc.id });
      if (existing) {
        throw new Error(`Item with id "${doc.id}" already exists in ${collectionName}`);
      }
      const insertRes = await col.insertOne({ ...doc });
      if (!doc.id && insertRes.insertedId) {
        doc.id = insertRes.insertedId.toString();
      }
      return doc;
    }

    if (!this.localState) throw new Error('Database not initialized');
    if (!this.localState.cityCollections[collectionName]) {
      this.localState.cityCollections[collectionName] = [];
    }
    if (this.localState.cityCollections[collectionName].some((i) => i.id === doc.id)) {
      throw new Error(`Item with id "${doc.id}" already exists in ${collectionName}`);
    }
    this.localState.cityCollections[collectionName].push(doc);
    this.persistLocal();
    return doc;
  }

  async updateAppGuide(
    cityId: string,
    appId: string,
    patch: Partial<AppGuideDoc>
  ): Promise<AppGuideDoc | null> {
    await this.init();
    const collectionName = `city_${cityId}`;
    const safePatch: Partial<AppGuideDoc> = { ...patch, cityId, docType: 'app_guide' as const };
    delete safePatch.id;

    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb
        .collection(collectionName)
        .findOneAndUpdate(
          buildItemIdFilter(appId, 'app_guide'),
          { $set: safePatch },
          { returnDocument: 'after' }
        );
      return res ? normalizeAppGuideDoc(res as unknown as Record<string, unknown>, cityId) : null;
    }

    const items = this.localState?.cityCollections[collectionName];
    if (!items) return null;
    const idx = items.findIndex((i) => i.id === appId && i.docType === 'app_guide');
    if (idx === -1) return null;
    const updated = normalizeAppGuideDoc(
      {
        ...(items[idx] as AppGuideDoc),
        ...safePatch,
        id: appId,
        cityId,
        docType: 'app_guide',
      } as unknown as Record<string, unknown>,
      cityId
    );
    items[idx] = updated;
    this.persistLocal();
    return updated;
  }

  async deleteAppGuide(cityId: string, appId: string): Promise<boolean> {
    await this.init();
    const collectionName = `city_${cityId}`;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb
        .collection(collectionName)
        .deleteOne(buildItemIdFilter(appId, 'app_guide'));
      return res.deletedCount > 0;
    }
    const items = this.localState?.cityCollections[collectionName];
    if (!items) return false;
    const before = items.length;
    this.localState!.cityCollections[collectionName] = items.filter(
      (i) => !(i.id === appId && i.docType === 'app_guide')
    );
    const deleted = this.localState!.cityCollections[collectionName].length < before;
    if (deleted) this.persistLocal();
    return deleted;
  }

  // Trips
  async listTrips(filter: { cityId?: string; userId?: string }): Promise<TripDoc[]> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const query: Record<string, unknown> = {};
      if (filter.cityId) query.cityId = filter.cityId;
      if (filter.userId) {
        const escaped = filter.userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.userId = { $regex: escaped, $options: 'i' };
      }
      return this.mongoDb
        .collection<TripDoc>('trips')
        .find(query, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
    }

    let list = [...(this.localState?.trips ?? [])];
    if (filter.cityId) {
      list = list.filter((t) => t.cityId === filter.cityId);
    }
    if (filter.userId) {
      const needle = filter.userId.toLowerCase();
      list = list.filter((t) => t.userId.toLowerCase().includes(needle));
    }
    return list.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }

  async deleteTrip(tripId: string): Promise<boolean> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb.collection<TripDoc>('trips').deleteOne({ id: tripId });
      return res.deletedCount > 0;
    }
    if (!this.localState) return false;
    const before = this.localState.trips.length;
    this.localState.trips = this.localState.trips.filter((t) => t.id !== tripId);
    const deleted = this.localState.trips.length < before;
    if (deleted) this.persistLocal();
    return deleted;
  }

  // Map Sub-Categories (map_categories collection)
  async listMapCategories(cityId: string): Promise<MapCategoryDoc[]> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const docs = await this.mongoDb
        .collection('map_categories')
        .find({ cityId })
        .sort({ sortOrder: 1, name: 1 })
        .toArray();
      return docs
        .map((d) => normalizeMapCategoryDoc(d as unknown as Record<string, unknown>, cityId))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    const items = (this.localState?.mapCategories ?? []).filter((c) => c.cityId === cityId);
    return items
      .map((d) => normalizeMapCategoryDoc(d as unknown as Record<string, unknown>, cityId))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async createMapCategory(cityId: string, name: string): Promise<MapCategoryDoc> {
    await this.init();
    const trimmed = name.trim();
    if (!trimmed || trimmed.toLowerCase() === 'all') {
      throw new Error('Map sub-category name cannot be empty or "All"');
    }

    const existing = await this.listMapCategories(cityId);
    if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Map sub-category "${trimmed}" already exists for this city`);
    }

    const maxOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const uniqueSuffix = Date.now().toString(36).slice(-4);
    const doc: MapCategoryDoc = {
      id: `${cityId}_map_${slug || 'cat'}_${uniqueSuffix}`,
      cityId,
      name: trimmed,
      sortOrder: maxOrder + 1,
    };

    if (this.mode === 'mongodb' && this.mongoDb) {
      await this.mongoDb.collection('map_categories').insertOne({ ...doc });
      return doc;
    }

    if (!this.localState) throw new Error('Database not initialized');
    if (!Array.isArray(this.localState.mapCategories)) {
      this.localState.mapCategories = [];
    }
    this.localState.mapCategories.push(doc);
    this.persistLocal();
    return doc;
  }

  async updateMapCategory(
    cityId: string,
    categoryId: string,
    patch: { name?: string; sortOrder?: number }
  ): Promise<MapCategoryDoc | null> {
    await this.init();
    const existingList = await this.listMapCategories(cityId);
    const target = existingList.find((c) => c.id === categoryId);
    if (!target) return null;

    const safePatch: Partial<MapCategoryDoc> = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed || trimmed.toLowerCase() === 'all') {
        throw new Error('Map sub-category name cannot be empty or "All"');
      }
      if (
        existingList.some(
          (c) => c.id !== categoryId && c.name.toLowerCase() === trimmed.toLowerCase()
        )
      ) {
        throw new Error(`Map sub-category "${trimmed}" already exists for this city`);
      }
      safePatch.name = trimmed;
    }
    if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)) {
      safePatch.sortOrder = Math.round(patch.sortOrder);
    }

    if (this.mode === 'mongodb' && this.mongoDb) {
      const idFilter = ObjectId.isValid(categoryId)
        ? { cityId, $or: [{ id: categoryId }, { _id: new ObjectId(categoryId) }] }
        : { cityId, id: categoryId };
      const res = await this.mongoDb
        .collection('map_categories')
        .findOneAndUpdate(idFilter, { $set: safePatch }, { returnDocument: 'after' });
      return res
        ? normalizeMapCategoryDoc(res as unknown as Record<string, unknown>, cityId)
        : null;
    }

    if (!this.localState) return null;
    const idx = (this.localState.mapCategories ?? []).findIndex(
      (c) => c.cityId === cityId && c.id === categoryId
    );
    if (idx === -1) return null;
    const updated: MapCategoryDoc = {
      ...this.localState.mapCategories[idx],
      ...safePatch,
    };
    this.localState.mapCategories[idx] = updated;
    this.persistLocal();
    return updated;
  }

  async reorderMapCategories(cityId: string, orderedIds: string[]): Promise<MapCategoryDoc[]> {
    await this.init();
    const existingList = await this.listMapCategories(cityId);
    const byId = new Map(existingList.map((c) => [c.id, c]));
    const ordered: MapCategoryDoc[] = [];

    orderedIds.forEach((cid) => {
      const found = byId.get(cid);
      if (found) {
        ordered.push(found);
        byId.delete(cid);
      }
    });
    for (const remaining of byId.values()) {
      ordered.push(remaining);
    }

    if (this.mode === 'mongodb' && this.mongoDb) {
      const col = this.mongoDb.collection('map_categories');
      for (let i = 0; i < ordered.length; i++) {
        const item = ordered[i];
        const idFilter = ObjectId.isValid(item.id)
          ? { cityId, $or: [{ id: item.id }, { _id: new ObjectId(item.id) }] }
          : { cityId, id: item.id };
        await col.updateOne(idFilter, { $set: { sortOrder: i + 1 } });
        item.sortOrder = i + 1;
      }
      return ordered;
    }

    if (!this.localState) return ordered;
    const orderMap = new Map(ordered.map((item, idx) => [item.id, idx + 1]));
    this.localState.mapCategories = (this.localState.mapCategories ?? []).map((item) => {
      if (item.cityId !== cityId) return item;
      const nextOrder = orderMap.get(item.id);
      return nextOrder !== undefined ? { ...item, sortOrder: nextOrder } : item;
    });
    this.persistLocal();
    return this.listMapCategories(cityId);
  }

  async deleteMapCategory(cityId: string, categoryId: string): Promise<boolean> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const idFilter = ObjectId.isValid(categoryId)
        ? { cityId, $or: [{ id: categoryId }, { _id: new ObjectId(categoryId) }] }
        : { cityId, id: categoryId };
      const res = await this.mongoDb.collection('map_categories').deleteOne(idFilter);
      return res.deletedCount > 0;
    }

    if (!this.localState) return false;
    const list = this.localState.mapCategories ?? [];
    const next = list.filter((c) => !(c.cityId === cityId && c.id === categoryId));
    if (next.length === list.length) return false;
    this.localState.mapCategories = next;
    this.persistLocal();
    return true;
  }

  // Tips
  async listTips(cityId?: string): Promise<TipDoc[]> {
    await this.init();
    let placeIdsForCity: Set<string> | null = null;
    if (cityId) {
      const places = await this.listPlaces(cityId);
      placeIdsForCity = new Set(places.map((p) => p.id));
    }

    let allTips: TipDoc[];
    if (this.mode === 'mongodb' && this.mongoDb) {
      allTips = await this.mongoDb
        .collection<TipDoc>('tips')
        .find({}, { projection: { _id: 0 } })
        .sort({ timestamp: -1 })
        .toArray();
    } else {
      allTips = [...(this.localState?.tips ?? [])].sort(
        (a, b) => Number(b.timestamp) - Number(a.timestamp)
      );
    }

    if (!cityId) return allTips;
    return allTips.filter(
      (tip) => tip.cityId === cityId || (placeIdsForCity !== null && placeIdsForCity.has(tip.placeId))
    );
  }

  async getTripById(tripId: string): Promise<TripDoc | null> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      return this.mongoDb
        .collection<TripDoc>('trips')
        .findOne({ id: tripId }, { projection: { _id: 0 } });
    }
    return this.localState?.trips.find((t) => t.id === tripId) ?? null;
  }

  async getTipById(tipId: string): Promise<TipDoc | null> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      return this.mongoDb
        .collection<TipDoc>('tips')
        .findOne({ id: tipId }, { projection: { _id: 0 } });
    }
    return this.localState?.tips.find((t) => t.id === tipId) ?? null;
  }

  async deleteTip(tipId: string): Promise<boolean> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb.collection<TipDoc>('tips').deleteOne({ id: tipId });
      return res.deletedCount > 0;
    }
    if (!this.localState) return false;
    const before = this.localState.tips.length;
    this.localState.tips = this.localState.tips.filter((t) => t.id !== tipId);
    const deleted = this.localState.tips.length < before;
    if (deleted) this.persistLocal();
    return deleted;
  }

  // Sub-Admins (sub_admins collection)
  private toPublicSubAdmin(record: SubAdminRecord): SubAdminPublicDoc {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      allowedCityIds: Array.isArray(record.allowedCityIds) ? [...record.allowedCityIds] : [],
      isActive: Boolean(record.isActive),
      createdAt: Number(record.createdAt) || 0,
      updatedAt: Number(record.updatedAt) || 0,
    };
  }

  async listSubAdmins(): Promise<SubAdminPublicDoc[]> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const docs = await this.mongoDb
        .collection<SubAdminRecord>('sub_admins')
        .find({}, { projection: { _id: 0, passwordHash: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      return docs.map((d) => this.toPublicSubAdmin(d as SubAdminRecord));
    }
    return [...(this.localState?.subAdmins ?? [])]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((d) => this.toPublicSubAdmin(d));
  }

  async getSubAdminAuthByEmail(email: string): Promise<SubAdminRecord | null> {
    await this.init();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const doc = await this.mongoDb
        .collection<SubAdminRecord>('sub_admins')
        .findOne({ email: normalized }, { projection: { _id: 0 } });
      return doc ?? null;
    }
    return (this.localState?.subAdmins ?? []).find((s) => s.email.toLowerCase() === normalized) ?? null;
  }

  async getSubAdminAuthById(id: string): Promise<SubAdminRecord | null> {
    await this.init();
    if (!id) return null;
    if (this.mode === 'mongodb' && this.mongoDb) {
      const doc = await this.mongoDb
        .collection<SubAdminRecord>('sub_admins')
        .findOne({ id }, { projection: { _id: 0 } });
      return doc ?? null;
    }
    return (this.localState?.subAdmins ?? []).find((s) => s.id === id) ?? null;
  }

  async createSubAdmin(record: SubAdminRecord): Promise<SubAdminPublicDoc> {
    await this.init();
    const normalized: SubAdminRecord = {
      ...record,
      email: record.email.trim().toLowerCase(),
      allowedCityIds: normalizeStringArray(record.allowedCityIds),
    };

    if (this.mode === 'mongodb' && this.mongoDb) {
      const col = this.mongoDb.collection<SubAdminRecord>('sub_admins');
      const existing = await col.findOne({
        $or: [{ id: normalized.id }, { email: normalized.email }],
      });
      if (existing) {
        throw new Error(`Sub-admin with email "${normalized.email}" already exists`);
      }
      await col.insertOne({ ...normalized });
      return this.toPublicSubAdmin(normalized);
    }

    if (!this.localState) throw new Error('Database not initialized');
    if (!Array.isArray(this.localState.subAdmins)) {
      this.localState.subAdmins = [];
    }
    if (
      this.localState.subAdmins.some(
        (s) => s.id === normalized.id || s.email.toLowerCase() === normalized.email
      )
    ) {
      throw new Error(`Sub-admin with email "${normalized.email}" already exists`);
    }
    this.localState.subAdmins.push(normalized);
    this.persistLocal();
    return this.toPublicSubAdmin(normalized);
  }

  async updateSubAdmin(
    id: string,
    patch: Partial<Pick<SubAdminRecord, 'name' | 'email' | 'passwordHash' | 'allowedCityIds' | 'isActive' | 'updatedAt'>>
  ): Promise<SubAdminPublicDoc | null> {
    await this.init();
    const safePatch: Partial<SubAdminRecord> = { ...patch, updatedAt: Date.now() };
    if (safePatch.email !== undefined) {
      safePatch.email = safePatch.email.trim().toLowerCase();
    }
    if (safePatch.allowedCityIds !== undefined) {
      safePatch.allowedCityIds = normalizeStringArray(safePatch.allowedCityIds);
    }

    if (this.mode === 'mongodb' && this.mongoDb) {
      const col = this.mongoDb.collection<SubAdminRecord>('sub_admins');
      if (safePatch.email) {
        const collision = await col.findOne({ email: safePatch.email, id: { $ne: id } });
        if (collision) {
          throw new Error(`Sub-admin with email "${safePatch.email}" already exists`);
        }
      }
      const res = await col.findOneAndUpdate(
        { id },
        { $set: safePatch },
        { returnDocument: 'after', projection: { _id: 0, passwordHash: 0 } }
      );
      return res ? this.toPublicSubAdmin(res as SubAdminRecord) : null;
    }

    if (!this.localState) return null;
    const list = this.localState.subAdmins ?? [];
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    if (
      safePatch.email &&
      list.some((s) => s.id !== id && s.email.toLowerCase() === safePatch.email)
    ) {
      throw new Error(`Sub-admin with email "${safePatch.email}" already exists`);
    }
    const updated: SubAdminRecord = {
      ...list[idx],
      ...safePatch,
    };
    list[idx] = updated;
    this.localState.subAdmins = list;
    this.persistLocal();
    return this.toPublicSubAdmin(updated);
  }

  async deleteSubAdmin(id: string): Promise<boolean> {
    await this.init();
    if (this.mode === 'mongodb' && this.mongoDb) {
      const res = await this.mongoDb.collection<SubAdminRecord>('sub_admins').deleteOne({ id });
      return res.deletedCount > 0;
    }
    if (!this.localState) return false;
    const list = this.localState.subAdmins ?? [];
    const next = list.filter((s) => s.id !== id);
    if (next.length === list.length) return false;
    this.localState.subAdmins = next;
    this.persistLocal();
    return true;
  }
}

export const store = new CityCompanionStore();
