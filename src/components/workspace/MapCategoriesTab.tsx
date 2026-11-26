import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Edit3,
  GripVertical,
  Info,
  KeyRound,
  Loader2,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import type {
  CityDoc,
  CityMapVerification,
  HealthStatus,
  MapCategoryDoc,
  MapConfigStatus,
} from '../../types.ts';
import { ConfirmDialog } from '../ConfirmDialog.tsx';

interface MapCategoriesTabProps {
  city: CityDoc;
  cities: CityDoc[];
  mapCategories: MapCategoryDoc[];
  onSelectCity: (city: CityDoc) => void;
  onMapCategoriesChanged: (items: MapCategoryDoc[]) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

export function MapCategoriesTab({
  city,
  cities,
  mapCategories,
  onSelectCity,
  onMapCategoriesChanged,
  onToast,
}: MapCategoriesTabProps) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const [reordering, setReordering] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [deletingItem, setDeletingItem] = useState<MapCategoryDoc | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [mapConfig, setMapConfig] = useState<MapConfigStatus | null>(null);
  const [cityMapData, setCityMapData] = useState<CityMapVerification | null>(null);
  const [verifyingMap, setVerifyingMap] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const fetchVerification = useCallback(async () => {
    setVerifyingMap(true);
    setVerifyError(null);
    try {
      const [healthRes, cfgRes, mapRes] = await Promise.all([
        api.getHealth(),
        api.getMapConfig(),
        api.getCityMapData(city.id),
      ]);
      setHealthStatus(healthRes);
      setMapConfig(cfgRes);
      setCityMapData(mapRes);
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifyingMap(false);
    }
  }, [city.id]);

  const refreshAll = useCallback(async () => {
    const [catsRes] = await Promise.all([
      api.listMapCategories(city.id),
      fetchVerification(),
    ]);
    onMapCategoriesChanged(catsRes.mapCategories);
  }, [city.id, fetchVerification, onMapCategoriesChanged]);

  useEffect(() => {
    setEditingId(null);
    setNewName('');
    setDeletingItem(null);
    setDraggedId(null);
    setDragOverId(null);
    void fetchVerification();
  }, [city.id, fetchVerification]);

  const sortedCategories = [...mapCategories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'all') {
      onToast('error', '"All" is reserved automatically as the first chip on the mobile Map.');
      return;
    }
    if (sortedCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      onToast('error', `"${trimmed}" already exists for ${city.name}.`);
      return;
    }

    setCreating(true);
    try {
      await api.createMapCategory(city.id, trimmed);
      setNewName('');
      await refreshAll();
      onToast('success', `"${trimmed}" — Saved & synced live to app`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startRename = (item: MapCategoryDoc) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const handleSaveRename = async (item: MapCategoryDoc) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      onToast('error', 'Map sub-category name cannot be empty.');
      return;
    }
    if (trimmed.toLowerCase() === 'all') {
      onToast('error', '"All" is reserved automatically on the mobile Map.');
      return;
    }
    if (
      sortedCategories.some(
        (c) => c.id !== item.id && c.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      onToast('error', `"${trimmed}" already exists for ${city.name}.`);
      return;
    }
    if (trimmed === item.name) {
      setEditingId(null);
      return;
    }

    setSavingEditId(item.id);
    try {
      await api.updateMapCategory(city.id, item.id, { name: trimmed });
      setEditingId(null);
      await refreshAll();
      onToast('success', `Renamed to "${trimmed}" — Saved & synced live to app`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setSavingEditId(null);
    }
  };

  const persistOrder = async (nextList: MapCategoryDoc[]) => {
    setReordering(true);
    try {
      await api.reorderMapCategories(
        city.id,
        nextList.map((c) => c.id)
      );
      await refreshAll();
      onToast('success', 'Map chip order updated — Saved & synced live to app');
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setReordering(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sortedCategories.length) return;
    const copy = [...sortedCategories];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    await persistOrder(copy);
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = sortedCategories.findIndex((c) => c.id === draggedId);
    const toIdx = sortedCategories.findIndex((c) => c.id === targetId);
    setDraggedId(null);
    setDragOverId(null);
    if (fromIdx === -1 || toIdx === -1) return;
    const copy = [...sortedCategories];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    await persistOrder(copy);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setDeletingBusy(true);
    try {
      await api.deleteMapCategory(city.id, deletingItem.id);
      const removedName = deletingItem.name;
      setDeletingItem(null);
      await refreshAll();
      onToast('success', `Removed "${removedName}" — Saved & synced live to app`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  const activeMapChips = cityMapData?.mapSubCategories ?? [];

  return (
    <div className="space-y-6">
      {/* Header + Per-City Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Map Sub-Categories Manager
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Configure custom Map filter chips for{' '}
            <span className="font-semibold text-slate-800">{city.name}</span> in{' '}
            <span className="font-mono text-xs">map_categories</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <label htmlFor="map-tab-city-select" className="text-xs font-medium text-slate-600">
            City:
          </label>
          <select
            id="map-tab-city-select"
            value={city.id}
            onChange={(e) => {
              const next = cities.find((c) => c.id === e.target.value);
              if (next) onSelectCity(next);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Helpful Fallback Note */}
      <div className="rounded-xl border border-sky-200 bg-[#E0F2FE]/60 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-700">
        <Info className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
        <p>
          When empty, mobile Map auto-derives sub-categories from this city&apos;s Services.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Manage Custom Chips (7 cols) */}
        <div className="xl:col-span-7 surface-card p-6 space-y-5">
          {/* Quick Add Input */}
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-2">
            <label
              htmlFor="new-map-subcategory-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Add Custom Map Filter Chip
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="new-map-subcategory-input"
                type="text"
                value={newName}
                disabled={creating}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Hospital, Night Food, Metro, ATM, Parking"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-45 transition-colors whitespace-nowrap"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Sub-Category
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Drag rows or use arrows to reorder. Duplicates and &quot;All&quot; are automatically blocked.
            </p>
          </form>

          {/* Custom Map Sub-Categories List */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Custom Map Sub-Categories ({sortedCategories.length})
              </h3>
              {reordering && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving order...
                </span>
              )}
            </div>

            {sortedCategories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                <MapIcon className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  No custom Map sub-categories set for {city.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Currently using Service Name categories fallback. Add a custom chip above to override.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sortedCategories.map((item, idx) => {
                  const isEditing = editingId === item.id;
                  const isDragTarget = dragOverId === item.id && draggedId !== item.id;

                  return (
                    <li
                      key={item.id}
                      draggable={!isEditing && !reordering}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', item.id);
                        setDraggedId(item.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverId !== item.id) setDragOverId(item.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverId === item.id) setDragOverId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        void handleDrop(item.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverId(null);
                      }}
                      className={`flex items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2.5 transition-all ${
                        isDragTarget
                          ? 'border-[#0284C7] bg-[#E0F2FE]/40 ring-2 ring-sky-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 shrink-0"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 font-mono text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                          {idx + 1}
                        </span>

                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <input
                              type="text"
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleSaveRename(item);
                                } else if (e.key === 'Escape') {
                                  setEditingId(null);
                                }
                              }}
                              className="flex-1 min-w-0 rounded-lg border border-[#0284C7] px-2.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                            />
                            <button
                              type="button"
                              disabled={savingEditId === item.id}
                              onClick={() => void handleSaveRename(item)}
                              className="rounded-lg bg-[#0284C7] p-1.5 text-white hover:bg-[#0369A1] disabled:opacity-50"
                              aria-label="Save rename"
                            >
                              {savingEditId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                              aria-label="Cancel rename"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {item.name}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400 truncate">
                              {item.id}
                            </p>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0 || reordering}
                            onClick={() => void handleMove(idx, -1)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0284C7] disabled:opacity-30 transition-colors"
                            aria-label={`Move ${item.name} up`}
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sortedCategories.length - 1 || reordering}
                            onClick={() => void handleMove(idx, 1)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0284C7] disabled:opacity-30 transition-colors"
                            aria-label={`Move ${item.name} down`}
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startRename(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            aria-label={`Rename ${item.name}`}
                            title="Rename"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingItem(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-[#DC2626] transition-colors"
                            aria-label={`Delete ${item.name}`}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Live Active Chip Preview + Map API Health / Config Card (5 cols) */}
        <div className="xl:col-span-5 space-y-5">
          {/* Live Mobile Map Chips Preview */}
          <div className="surface-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Live Mobile Map Chips Order
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Returned by <span className="font-mono">GET /api/v1/cities/{city.id}/map</span>
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                  cityMapData?.usingFallback
                    ? 'bg-[#FFFBEB] text-[#D97706]'
                    : 'bg-[#ECFDF5] text-[#059669]'
                }`}
              >
                {cityMapData?.usingFallback ? 'Service Fallback' : 'Custom Active'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-[#0284C7] px-3 py-1.5 text-xs font-semibold text-white">
                  All
                </span>
                {activeMapChips.length === 0 ? (
                  <span className="text-xs text-slate-400 italic py-1.5 px-2">
                    No sub-category chips returned yet
                  </span>
                ) : (
                  activeMapChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                    >
                      {chip}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Map API Health / Config Verification Panel */}
          <div className="surface-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Map API Health &amp; Config
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verifies <span className="font-mono">/api/v1/health</span>,{' '}
                    <span className="font-mono">/map/config</span> &amp; <span className="font-mono">/map</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void fetchVerification()}
                disabled={verifyingMap}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#0284C7] ${verifyingMap ? 'animate-spin' : ''}`} />
                Verify
              </button>
            </div>

            {verifyError ? (
              <div className="rounded-lg border border-red-200 bg-[#FEF2F2] p-3 text-xs text-[#DC2626] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Backend Health Status */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      API Health (<span className="font-mono">/api/v1/health</span>)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Storage:{' '}
                      <span className="font-mono font-medium text-slate-700">
                        {healthStatus?.dbMode === 'mongodb' ? 'MongoDB' : 'Local JSON Store'}
                      </span>
                    </p>
                  </div>
                  {healthStatus?.ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#059669] shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#DC2626] shrink-0">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Offline
                    </span>
                  )}
                </div>

                {/* MAPS_API_KEY Status */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Backend <span className="font-mono">MAPS_API_KEY</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {mapConfig?.configured
                        ? `Configured (${mapConfig.maskedKey})`
                        : 'Missing / not set in backend environment'}
                    </p>
                  </div>
                  {mapConfig?.configured ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#059669] shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#D97706] shrink-0">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missing
                    </span>
                  )}
                </div>

                {/* Live Mobile Readiness Counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">Default Zoom</p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                      {mapConfig?.defaultZoom ?? 13}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">Places</p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                      {cityMapData?.places.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">Services</p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                      {cityMapData?.services.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">Map Chips</p>
                    <p className="mt-1 text-lg font-bold text-[#0284C7] tabular-nums">
                      {activeMapChips.length}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        title={`Delete "${deletingItem?.name ?? ''}"?`}
        description={`Removes this custom Map sub-category from ${city.name}. If no custom sub-categories remain, the mobile Map falls back to Service Name categories.`}
        busy={deletingBusy}
        onCancel={() => setDeletingItem(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
