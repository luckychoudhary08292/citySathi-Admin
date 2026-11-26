import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  ExternalLink,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { AppGuideDoc, CityDoc } from '../../types.ts';
import { APP_TASK_CATEGORIES, SERVICE_ICON_KEYS } from '../../types.ts';
import { ConfirmDialog } from '../ConfirmDialog.tsx';
import { SafeImage } from '../SafeImage.tsx';

interface AppGuideTabProps {
  city: CityDoc;
  appGuides: AppGuideDoc[];
  onAppGuidesChanged: (items: AppGuideDoc[]) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

function toSlug(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function AppGuideTab({
  city,
  appGuides,
  onAppGuidesChanged,
  onToast,
}: AppGuideTabProps) {
  const [taskFilter, setTaskFilter] = useState<string>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppGuideDoc | null>(null);
  const [deletingApp, setDeletingApp] = useState<AppGuideDoc | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const [id, setId] = useState('');
  const [idManual, setIdManual] = useState(false);
  const [appName, setAppName] = useState('');
  const [taskCategory, setTaskCategory] = useState<string>('Metro & Bus');
  const [highlightTag, setHighlightTag] = useState('Official');
  const [description, setDescription] = useState('');
  const [howToUse, setHowToUse] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [iconKey, setIconKey] = useState('smartphone');
  const [packageName, setPackageName] = useState('');
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [saving, setSaving] = useState(false);

  const sortedApps = [...appGuides].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.appName.localeCompare(b.appName)
  );

  const allTaskCategories = Array.from(
    new Set([...APP_TASK_CATEGORIES, ...appGuides.map((a) => a.taskCategory).filter(Boolean)])
  );

  const visibleApps =
    taskFilter === 'ALL'
      ? sortedApps
      : sortedApps.filter((a) => a.taskCategory === taskFilter);

  const openAdd = () => {
    setEditingApp(null);
    setId('');
    setIdManual(false);
    setAppName('');
    setTaskCategory('Metro & Bus');
    setHighlightTag('Official');
    setDescription('');
    setHowToUse('');
    setIconUrl('');
    setIconKey('smartphone');
    setPackageName('');
    setPlayStoreUrl('');
    setWebsiteUrl('');
    setSortOrder(String(appGuides.length + 1));
    setDrawerOpen(true);
  };

  const openEdit = (item: AppGuideDoc) => {
    setEditingApp(item);
    setId(item.id);
    setIdManual(true);
    setAppName(item.appName);
    setTaskCategory(item.taskCategory || 'Civic Help');
    setHighlightTag(item.highlightTag || '');
    setDescription(item.description || '');
    setHowToUse(item.howToUse || '');
    setIconUrl(item.iconUrl || '');
    setIconKey(item.iconKey || 'smartphone');
    setPackageName(item.packageName || '');
    setPlayStoreUrl(item.playStoreUrl || '');
    setWebsiteUrl(item.websiteUrl || '');
    setSortOrder(String(item.sortOrder ?? 0));
    setDrawerOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const computedSlug = editingApp ? editingApp.id : toSlug(id || appName);
    const orderNum = Number(sortOrder);

    if (!appName.trim()) {
      onToast('error', 'App name is required.');
      return;
    }
    if (!editingApp && (!computedSlug || !/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(computedSlug))) {
      onToast('error', 'App Guide ID must be a lowercase slug.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<AppGuideDoc> = {
        id: computedSlug,
        cityId: city.id,
        docType: 'app_guide',
        appName: appName.trim(),
        taskCategory: taskCategory.trim() || 'Civic Help',
        highlightTag: highlightTag.trim(),
        description: description.trim(),
        howToUse: howToUse.trim(),
        iconUrl: iconUrl.trim(),
        iconKey: iconKey.trim() || 'smartphone',
        packageName: packageName.trim(),
        playStoreUrl: playStoreUrl.trim(),
        websiteUrl: websiteUrl.trim(),
        sortOrder: Number.isFinite(orderNum) ? Math.round(orderNum) : 0,
      };

      const savedName = payload.appName || 'App Guide';
      if (editingApp) {
        await api.updateAppGuide(city.id, editingApp.id, payload);
      } else {
        await api.createAppGuide(city.id, payload);
      }
      const fresh = await api.listAppGuides(city.id);
      onAppGuidesChanged(fresh.appGuides);
      onToast('success', `"${savedName}" — Saved & synced live to app`);
      setDrawerOpen(false);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStepOrder = async (item: AppGuideDoc, delta: number) => {
    setReorderingId(item.id);
    try {
      const nextOrder = Math.max(0, (item.sortOrder ?? 0) + delta);
      await api.updateAppGuide(city.id, item.id, { sortOrder: nextOrder });
      const fresh = await api.listAppGuides(city.id);
      onAppGuidesChanged(fresh.appGuides);
      onToast('success', `Sort order for "${item.appName}" — Saved & synced live to app`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setReorderingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingApp) return;
    setDeletingBusy(true);
    try {
      const removedName = deletingApp.appName;
      await api.deleteAppGuide(city.id, deletingApp.id);
      const fresh = await api.listAppGuides(city.id);
      onAppGuidesChanged(fresh.appGuides);
      onToast('success', `Deleted "${removedName}" — Saved & synced live to app`);
      setDeletingApp(null);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            City Hub — App Guide Manager
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage city-specific utility apps (<span className="font-mono text-xs">{city.collectionName}</span> · <span className="font-mono text-xs">docType: &quot;app_guide&quot;</span>).
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Utility App
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 overflow-x-auto max-w-full">
        <button
          type="button"
          onClick={() => setTaskFilter('ALL')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            taskFilter === 'ALL'
              ? 'bg-[#E0F2FE] text-[#0284C7]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          All ({appGuides.length})
        </button>
        {allTaskCategories.map((cat) => {
          const count = appGuides.filter((a) => a.taskCategory === cat).length;
          if (count === 0 && !APP_TASK_CATEGORIES.includes(cat as (typeof APP_TASK_CATEGORIES)[number])) {
            return null;
          }
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setTaskFilter(cat)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                taskFilter === cat
                  ? 'bg-[#E0F2FE] text-[#0284C7]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {visibleApps.length === 0 ? (
        <div className="surface-card border-dashed p-12 text-center">
          <Smartphone className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">
            No utility apps configured for {city.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Add metro, bus, cab, civic helpline, or food delivery apps recommended to travelers.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1]"
          >
            <Plus className="w-4 h-4" />
            Add First Utility App
          </button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">App &amp; Description</th>
                  <th className="py-3 px-4">Task Category</th>
                  <th className="py-3 px-4">Package / Links</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visibleApps.map((item) => (
                  <tr key={item.id} className="h-16 hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <span className="font-mono text-xs font-semibold text-slate-700 w-6 text-center tabular-nums">
                          {item.sortOrder ?? 0}
                        </span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={reorderingId === item.id || (item.sortOrder ?? 0) <= 0}
                            onClick={() => void handleStepOrder(item, -1)}
                            className="p-0.5 text-slate-400 hover:text-[#0284C7] disabled:opacity-30"
                            aria-label={`Decrease sortOrder for ${item.appName}`}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={reorderingId === item.id}
                            onClick={() => void handleStepOrder(item, 1)}
                            className="p-0.5 text-slate-400 hover:text-[#0284C7] disabled:opacity-30"
                            aria-label={`Increase sortOrder for ${item.appName}`}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 min-w-[230px]">
                        <div className="h-10 w-10 rounded-xl overflow-hidden border border-slate-200 bg-sky-50 flex items-center justify-center shrink-0">
                          {item.iconUrl ? (
                            <SafeImage
                              src={item.iconUrl}
                              alt={item.appName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Smartphone className="w-4 h-4 text-[#0284C7]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{item.appName}</p>
                            {item.highlightTag && (
                              <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#059669]">
                                {item.highlightTag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1 max-w-md">
                            {item.description || item.howToUse || item.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold text-[#0284C7]">
                        {item.taskCategory}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {item.packageName && (
                          <p className="font-mono text-[11px] text-slate-600">
                            {item.packageName}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          {item.playStoreUrl && (
                            <a
                              href={item.playStoreUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#0284C7] hover:underline"
                            >
                              Play Store <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {item.websiteUrl && (
                            <a
                              href={item.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-slate-600 hover:underline"
                            >
                              Website <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          aria-label={`Edit ${item.appName}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingApp(item)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-[#DC2626] transition-colors"
                          aria-label={`Delete ${item.appName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-Over App Guide Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[90] flex justify-end bg-slate-900/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-guide-drawer-title"
        >
          <div className="w-full max-w-[580px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shrink-0">
              <div>
                <h2 id="app-guide-drawer-title" className="text-lg font-bold text-slate-900">
                  {editingApp
                    ? `Edit App Guide — ${editingApp.appName}`
                    : `Add Utility App (${city.name})`}
                </h2>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  {city.collectionName} · docType: &quot;app_guide&quot;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="app-guide-drawer-form"
              onSubmit={(e) => void handleSave(e)}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    App Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => {
                      setAppName(e.target.value);
                      if (!editingApp && !idManual) setId(toSlug(e.target.value));
                    }}
                    placeholder="e.g. Indore 311"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Slug ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingApp)}
                    value={editingApp ? editingApp.id : id}
                    onChange={(e) => {
                      setIdManual(true);
                      setId(e.target.value.toLowerCase());
                    }}
                    placeholder="indore_311_app"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 disabled:text-slate-500 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Task Category
                  </label>
                  <input
                    type="text"
                    list="app-task-category-suggestions"
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value)}
                    placeholder="Metro & Bus, Cab Booking..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                  <datalist id="app-task-category-suggestions">
                    {APP_TASK_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Highlight Tag
                  </label>
                  <input
                    type="text"
                    value={highlightTag}
                    onChange={(e) => setHighlightTag(e.target.value)}
                    placeholder="e.g. Official, Live Tracking"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Fallback Icon Key
                  </label>
                  <select
                    value={iconKey}
                    onChange={(e) => setIconKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    <option value="smartphone">Smartphone (smartphone)</option>
                    {SERVICE_ICON_KEYS.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label} ({icon.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this utility app helps travelers do in the city..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  How To Use (Step-by-step tip)
                </label>
                <textarea
                  rows={2}
                  value={howToUse}
                  onChange={(e) => setHowToUse(e.target.value)}
                  placeholder="e.g. Select origin & destination bus stop to view live ETA..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Android Package Name
                  </label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="e.g. in.gov.imc.indore311"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Icon Image URL (optional)
                  </label>
                  <input
                    type="text"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Play Store URL
                  </label>
                  <input
                    type="url"
                    value={playStoreUrl}
                    onChange={(e) => setPlayStoreUrl(e.target.value)}
                    placeholder="https://play.google.com/store/apps/..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/70 px-6 py-4 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="app-guide-drawer-form"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingApp)}
        title={`Delete "${deletingApp?.appName ?? ''}"?`}
        description={`Removes this app guide entry from ${city.collectionName}.`}
        busy={deletingBusy}
        onCancel={() => setDeletingApp(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
