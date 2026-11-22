import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { CategoryDoc, CityDoc, TopCategoryKey } from '../../types.ts';
import { FIXED_CATEGORIES } from '../../types.ts';

interface CategoriesTabProps {
  city: CityDoc;
  categories: CategoryDoc[];
  onCategoryUpdated: (updated: CategoryDoc) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

export function CategoriesTab({
  city,
  categories,
  onCategoryUpdated,
  onToast,
}: CategoriesTabProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<TopCategoryKey | null>(null);

  const persistSubCategories = async (
    categoryKey: TopCategoryKey,
    nextSubCategories: string[]
  ) => {
    setSavingKey(categoryKey);
    try {
      const res = await api.updateCategory(city.id, categoryKey, nextSubCategories);
      onCategoryUpdated(res.category);
      onToast('success', `Changes saved to ${city.name}`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddSub = async (categoryKey: TopCategoryKey) => {
    const raw = inputs[categoryKey] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) return;

    const current =
      categories.find((c) => c.category === categoryKey)?.subCategories ?? [];
    if (current.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      onToast('error', `"${trimmed}" already exists in ${categoryKey}`);
      return;
    }

    setInputs((prev) => ({ ...prev, [categoryKey]: '' }));
    await persistSubCategories(categoryKey, [...current, trimmed]);
  };

  const handleRemoveSub = async (categoryKey: TopCategoryKey, tag: string) => {
    const current =
      categories.find((c) => c.category === categoryKey)?.subCategories ?? [];
    const next = current.filter((item) => item !== tag);
    await persistSubCategories(categoryKey, next);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Categories & Dynamic Subcategories
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            6 fixed top-level categories for <span className="font-semibold text-slate-800">{city.name}</span>. Add or remove subcategory chips inline.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-600">
          cityId: {city.id}
        </span>
      </div>

      {/* 2x3 / 3x2 Structured Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {FIXED_CATEGORIES.map((meta) => {
          const doc = categories.find((c) => c.category === meta.category);
          const subCategories = doc?.subCategories ?? [];
          const isSaving = savingKey === meta.category;
          const draftVal = inputs[meta.category] ?? '';

          return (
            <section
              key={meta.category}
              className="surface-card p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{meta.title}</h3>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">{meta.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0284C7]" />}
                    <span className="rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold text-[#0284C7] tabular-nums">
                      {subCategories.length}
                    </span>
                  </div>
                </div>

                {/* Interactive Subcategory Chips */}
                {subCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No subcategories added yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {subCategories.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void handleRemoveSub(meta.category, tag)}
                          className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                          aria-label={`Remove ${tag} from ${meta.title}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Inline + Add Subcategory Input */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <input
                  type="text"
                  value={draftVal}
                  disabled={isSaving}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [meta.category]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddSub(meta.category);
                    }
                  }}
                  placeholder="+ Add subcategory"
                  className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <button
                  type="button"
                  disabled={isSaving || !draftVal.trim()}
                  onClick={() => void handleAddSub(meta.category)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0284C7] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0369A1] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
