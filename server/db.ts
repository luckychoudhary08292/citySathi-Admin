import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import type {
  CategoryDoc,
  CityDoc,
  PlaceCategoryKey,
  PlaceDoc,
  ServiceDoc,
  ServiceGroupKey,
  TipDoc,
  TopCategoryKey,
  TripDoc,
} from '../src/types.ts';
import { FIXED_CATEGORIES, PLACE_CATEGORIES, SERVICE_GROUPS } from '../src/types.ts';
import { buildDefaultCategoriesForCity, createInitialSeedData } from './seed.ts';
import type { SeedDatabaseState } from './seed.ts';

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

  return {
    id: rawId,
    cityId,
    docType: 'service',
    group,
    name: typeof raw.name === 'string' ? raw.name : '',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    distanceOrHours: typeof raw.distanceOrHours === 'string' ? raw.distanceOrHours : '',
    latitude: latNum,
    longitude: lngNum,
    phone: typeof raw.phone === 'string' ? raw.phone : '',
  };
}

function buildItemIdFilter(itemId: string, docType: 'place' | 'service'): Record<string, unknown> {
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
        this.localState = JSON.parse(raw) as SeedDatabaseState;
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
    if (!names.has('trips')) {
      await db.createCollection('trips');
    }
    if (!names.has('tips')) {
      await db.createCollection('tips');
    }
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
        .sort({ name: 1 })
        .toArray();
      return docs.map((d) => normalizeServiceDoc(d as unknown as Record<string, unknown>, cityId));
    }
    const items = this.localState?.cityCollections[collectionName] ?? [];
    return items
      .filter((item): item is ServiceDoc => item.docType === 'service')
      .map((d) => normalizeServiceDoc(d as unknown as Record<string, unknown>, cityId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createService(cityId: string, service: ServiceDoc): Promise<ServiceDoc> {
    await this.init();
    const collectionName = `city_${cityId}`;
    const doc = normalizeServiceDoc({ ...service, cityId, docType: 'service' }, cityId);

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
}

export const store = new CityCompanionStore();
