import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Check,
  Edit3,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { CityDoc, SubAdminPublicDoc } from '../../types.ts';
import { ConfirmDialog } from '../ConfirmDialog.tsx';

interface SubAdminsTabProps {
  cities: CityDoc[];
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function SubAdminsTab({ cities, onToast }: SubAdminsTabProps) {
  const [subAdmins, setSubAdmins] = useState<SubAdminPublicDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubAdminPublicDoc | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [allowedCityIds, setAllowedCityIds] = useState<string[]>([]);
  const [showMultiCityPicker, setShowMultiCityPicker] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<SubAdminPublicDoc | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const cityNameMap = new Map(cities.map((c) => [c.id, `${c.name}, ${c.state}`]));

  const loadSubAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listSubAdmins();
      setSubAdmins(Array.isArray(res?.subAdmins) ? res.subAdmins : []);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void loadSubAdmins();
  }, [loadSubAdmins]);

  const openCreateModal = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setAllowedCityIds(cities[0]?.id ? [cities[0].id] : []);
    setShowMultiCityPicker(false);
    setIsActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (sa: SubAdminPublicDoc) => {
    setEditing(sa);
    setName(sa.name);
    setEmail(sa.email);
    setPassword('');
    setAllowedCityIds([...sa.allowedCityIds]);
    setShowMultiCityPicker(sa.allowedCityIds.length > 1);
    setIsActive(sa.isActive);
    setFormError('');
    setModalOpen(true);
  };

  const handlePrimaryCityChange = (cityId: string) => {
    if (!cityId) {
      setAllowedCityIds([]);
      return;
    }
    if (cityId === '__multiple__') {
      setShowMultiCityPicker(true);
      return;
    }
    setAllowedCityIds([cityId]);
  };

  const toggleCitySelection = (cityId: string) => {
    setAllowedCityIds((prev) =>
      prev.includes(cityId) ? prev.filter((id) => id !== cityId) : [...prev, cityId]
    );
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanName =
      name.trim() || (cleanEmail.includes('@') ? cleanEmail.split('@')[0] : '');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (!cleanName) {
      setFormError('Sub-admin display name is required.');
      return;
    }
    if (!editing && password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (editing && password.length > 0 && password.length < 8) {
      setFormError('New password must be at least 8 characters.');
      return;
    }
    if (allowedCityIds.length === 0) {
      setFormError('Assign at least one city from the city dropdown.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const patch: {
          name: string;
          email: string;
          allowedCityIds: string[];
          isActive: boolean;
          password?: string;
        } = {
          name: cleanName,
          email: cleanEmail,
          allowedCityIds,
          isActive,
        };
        if (password) {
          patch.password = password;
        }
        await api.updateSubAdmin(editing.id, patch);
        onToast('success', `Updated sub-admin "${cleanName}"`);
      } else {
        await api.createSubAdmin({
          name: cleanName,
          email: cleanEmail,
          password,
          allowedCityIds,
          isActive,
        });
        onToast('success', `Created sub-admin "${cleanName}"`);
      }
      setModalOpen(false);
      await loadSubAdmins();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (sa: SubAdminPublicDoc) => {
    setTogglingId(sa.id);
    try {
      const updated = await api.updateSubAdmin(sa.id, { isActive: !sa.isActive });
      setSubAdmins((prev) =>
        prev.map((item) => (item.id === sa.id ? updated.subAdmin : item))
      );
      onToast(
        'success',
        `${sa.name} is now ${updated.subAdmin.isActive ? 'Active' : 'Disabled'}`
      );
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    setDeletingBusy(true);
    try {
      const removedName = deletingTarget.name;
      await api.deleteSubAdmin(deletingTarget.id);
      setDeletingTarget(null);
      await loadSubAdmins();
      onToast('success', `Deleted sub-admin "${removedName}"`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  const filtered = subAdmins.filter((sa) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      sa.name.toLowerCase().includes(q) ||
      sa.email.toLowerCase().includes(q) ||
      sa.allowedCityIds.some((cid) => cid.toLowerCase().includes(q))
    );
  });

  const dropdownValue =
    allowedCityIds.length > 1 ? '__multiple__' : (allowedCityIds[0] ?? '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Admin Management
            </h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[11px] font-semibold text-[#0284C7]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Super Admin Only
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Create Sub-Admin accounts and assign them to specific cities. Sub-Admins can perform full CRUD operations only within their assigned city scope.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={cities.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Sub-Admin
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sub-admins by name, email, or city..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>
        <span className="text-xs font-medium text-slate-500 tabular-nums self-end sm:self-auto">
          {filtered.length} {filtered.length === 1 ? 'sub-admin' : 'sub-admins'}
        </span>
      </div>

      {/* Sub-Admins Scope Table */}
      {loading ? (
        <div className="surface-card p-6 space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-14 rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card border-dashed p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0284C7] mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {subAdmins.length === 0
              ? 'No City Sub-Admins created yet'
              : 'No Sub-Admins match your search'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {subAdmins.length === 0
              ? 'Delegate city content management by creating a Sub-Admin account assigned to specific cities.'
              : 'Try adjusting your search query.'}
          </p>
          {subAdmins.length === 0 && cities.length > 0 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Sub-Admin
            </button>
          )}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Sub-Admin Account</th>
                  <th className="py-3 px-4">Assigned City Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((sa) => (
                  <tr key={sa.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{sa.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{sa.email}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {sa.allowedCityIds.length === 0 ? (
                        <span className="text-xs text-amber-600 font-medium">
                          No cities assigned
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {sa.allowedCityIds.map((cid) => (
                            <span
                              key={cid}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              <MapPin className="w-3 h-3 text-[#0284C7]" />
                              {cityNameMap.get(cid) || cid}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        disabled={togglingId === sa.id}
                        onClick={() => void handleToggleActive(sa)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                          sa.isActive
                            ? 'bg-[#ECFDF5] text-[#059669] hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title="Click to toggle access"
                      >
                        {togglingId === sa.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : sa.isActive ? (
                          <UserCheck className="w-3 h-3" />
                        ) : (
                          <UserX className="w-3 h-3" />
                        )}
                        {sa.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(sa)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          aria-label={`Edit ${sa.name}`}
                          title="Edit Sub-Admin"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTarget(sa)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          aria-label={`Delete ${sa.name}`}
                          title="Delete Sub-Admin"
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

      {/* Centered Create / Edit Sub-Admin Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-subadmin-modal-title"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => !saving && setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3
                  id="create-subadmin-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {editing ? 'Edit Sub-Admin' : 'Create Sub-Admin'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sub-admins can perform CRUD operations only for their assigned city scope.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="subadmin-modal-form"
              onSubmit={(e) => void handleSave(e)}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="subadmin-email"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="subadmin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="indore.admin@citycompanion.app"
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="subadmin-password"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  {editing ? 'New Password (optional)' : 'Password * (min 8 chars)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="subadmin-password"
                    type="password"
                    required={!editing}
                    minLength={editing ? undefined : 8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      editing
                        ? 'Leave blank to keep existing password'
                        : 'Enter password (min 8 characters)'
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="subadmin-city-select"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Assigned City *
                  </label>
                  {cities.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowMultiCityPicker((v) => !v)}
                      className="text-[11px] font-semibold text-[#0284C7] hover:underline"
                    >
                      {showMultiCityPicker
                        ? 'Use single dropdown'
                        : `Assign multiple cities (${allowedCityIds.length})`}
                    </button>
                  )}
                </div>

                <select
                  id="subadmin-city-select"
                  value={dropdownValue}
                  onChange={(e) => handlePrimaryCityChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value="" disabled>
                    Select assigned city...
                  </option>
                  {allowedCityIds.length > 1 && (
                    <option value="__multiple__">
                      Multiple cities selected ({allowedCityIds.length})
                    </option>
                  )}
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}, {c.state} ({c.id})
                    </option>
                  ))}
                </select>

                {showMultiCityPicker && cities.length > 1 && (
                  <div className="mt-2.5 rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-44 overflow-y-auto">
                    {cities.map((city) => {
                      const checked = allowedCityIds.includes(city.id);
                      return (
                        <label
                          key={city.id}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                            checked ? 'bg-sky-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCitySelection(city.id)}
                              className="h-4 w-4 rounded border-slate-300 text-[#0284C7] focus:ring-sky-500"
                            />
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {city.name}, {city.state}
                            </span>
                          </div>
                          {checked && <Check className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="subadmin-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Display Name (optional)
                </label>
                <input
                  id="subadmin-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-filled from email if left blank"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-900">Account Active</p>
                  <p className="text-[11px] text-slate-500">
                    Disabled accounts are immediately blocked by the API.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0284C7] focus:ring-sky-500"
                />
              </label>

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </p>
              )}
            </form>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="subadmin-modal-form"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0369A1] disabled:opacity-60"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Sub-Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingTarget)}
        title={`Delete sub-admin "${deletingTarget?.name ?? ''}"?`}
        description={`This immediately revokes dashboard access for ${deletingTarget?.email}. Their edited city content remains intact.`}
        confirmLabel="Delete Sub-Admin"
        busy={deletingBusy}
        onCancel={() => setDeletingTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
