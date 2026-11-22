import { useState } from 'react';
import type { FormEvent } from 'react';
import { Edit3, Loader2, Phone, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { CityDoc, GeocodeResult, ServiceDoc, ServiceGroupKey } from '../../types.ts';
import { SERVICE_GROUPS } from '../../types.ts';
import { ConfirmDialog } from '../ConfirmDialog.tsx';
import { LocationPicker } from '../LocationPicker.tsx';

interface ServicesTabProps {
  city: CityDoc;
  services: ServiceDoc[];
  onServicesChanged: (services: ServiceDoc[]) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

function toSlug(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function ServicesTab({
  city,
  services,
  onServicesChanged,
  onToast,
}: ServicesTabProps) {
  const [activeGroup, setActiveGroup] = useState<ServiceGroupKey>('TRANSPORT');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceDoc | null>(null);
  const [deletingService, setDeletingService] = useState<ServiceDoc | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [id, setId] = useState('');
  const [idManual, setIdManual] = useState(false);
  const [group, setGroup] = useState<ServiceGroupKey>('TRANSPORT');
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [distanceOrHours, setDistanceOrHours] = useState('Open 24 Hours');
  const [phone, setPhone] = useState('');
  const [latitude, setLatitude] = useState(String(city.latitude));
  const [longitude, setLongitude] = useState(String(city.longitude));
  const [saving, setSaving] = useState(false);

  const groupServices = services.filter((s) => s.group === activeGroup);

  const openAdd = () => {
    setEditingService(null);
    setId('');
    setIdManual(false);
    setGroup(activeGroup);
    setName('');
    setSubtitle('');
    setDistanceOrHours('Open 24 Hours');
    setPhone('');
    setLatitude(String(city.latitude));
    setLongitude(String(city.longitude));
    setDrawerOpen(true);
  };

  const openEdit = (svc: ServiceDoc) => {
    setEditingService(svc);
    setId(svc.id);
    setIdManual(true);
    setGroup(svc.group);
    setName(svc.name);
    setSubtitle(svc.subtitle);
    setDistanceOrHours(svc.distanceOrHours);
    setPhone(svc.phone);
    setLatitude(String(svc.latitude));
    setLongitude(String(svc.longitude));
    setDrawerOpen(true);
  };

  const handleAutoSelect = (res: GeocodeResult) => {
    if (!name.trim() && res.shortName) {
      setName(res.shortName);
      if (!editingService && !idManual) {
        setId(toSlug(res.shortName));
      }
    }
    if (!subtitle.trim() && res.displayName) {
      setSubtitle(res.displayName.split(',').slice(0, 2).join(', '));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const computedSlug = editingService ? editingService.id : toSlug(id || name);
    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (!name.trim()) {
      onToast('error', 'Service name is required.');
      return;
    }
    if (!computedSlug || !/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(computedSlug)) {
      onToast('error', 'Service ID must be a lowercase slug.');
      return;
    }
    if (
      latitude === '' ||
      longitude === '' ||
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      onToast('error', 'Valid latitude and longitude are required.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<ServiceDoc> = {
        id: computedSlug,
        cityId: city.id,
        docType: 'service',
        group,
        name: name.trim(),
        subtitle: subtitle.trim(),
        distanceOrHours: distanceOrHours.trim(),
        phone: phone.trim(),
        latitude: latNum,
        longitude: lngNum,
      };

      if (editingService) {
        const res = await api.updateService(city.id, editingService.id, payload);
        onServicesChanged(services.map((s) => (s.id === res.service.id ? res.service : s)));
        onToast('success', `Changes saved to ${city.name}`);
      } else {
        const res = await api.createService(city.id, payload);
        onServicesChanged([...services, res.service].sort((a, b) => a.name.localeCompare(b.name)));
        onToast('success', `Changes saved to ${city.name}`);
      }
      setActiveGroup(group);
      setDrawerOpen(false);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingService) return;
    setDeletingBusy(true);
    try {
      await api.deleteService(city.id, deletingService.id);
      onServicesChanged(services.filter((s) => s.id !== deletingService.id));
      onToast('success', `Deleted service "${deletingService.name}"`);
      setDeletingService(null);
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
          <h2 className="text-xl font-bold tracking-tight text-slate-900">City Services</h2>
          <p className="mt-1 text-sm text-slate-600">
            Essential utilities in <span className="font-mono text-xs">{city.collectionName}</span> (<span className="font-mono text-xs">docType: &quot;service&quot;</span>).
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Segmented Tabs */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 overflow-x-auto max-w-full">
        {SERVICE_GROUPS.map((g) => {
          const count = services.filter((s) => s.group === g.value).length;
          const active = activeGroup === g.value;
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => setActiveGroup(g.value)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#E0F2FE] text-[#0284C7]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {g.label} ({count})
            </button>
          );
        })}
      </div>

      {groupServices.length === 0 ? (
        <div className="surface-card border-dashed p-12 text-center">
          <p className="text-sm font-semibold text-slate-900">
            No {activeGroup.toLowerCase()} services in {city.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Add transport hubs, colleges, 24x7 pharmacies, or emergency helplines.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1]"
          >
            <Plus className="w-4 h-4" />
            Add {activeGroup} Service
          </button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Service Name</th>
                  <th className="py-3 px-4">Hours / Distance</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Coordinates</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {groupServices.map((svc) => (
                  <tr key={svc.id} className="h-16 hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-900">{svc.name}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{svc.subtitle || svc.id}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {svc.distanceOrHours || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {svc.phone ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-[#0284C7]" />
                          {svc.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {svc.latitude.toFixed(4)}, {svc.longitude.toFixed(4)}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(svc)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          aria-label={`Edit ${svc.name}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingService(svc)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-[#DC2626] transition-colors"
                          aria-label={`Delete ${svc.name}`}
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

      {/* Slide-Over Service Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[90] flex justify-end bg-slate-900/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-drawer-title"
        >
          <div className="w-full max-w-[560px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shrink-0">
              <div>
                <h2 id="service-drawer-title" className="text-lg font-bold text-slate-900">
                  {editingService
                    ? `Edit Service — ${editingService.name}`
                    : `Add City Service (${city.name})`}
                </h2>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  {city.collectionName} · docType: &quot;service&quot;
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
              id="service-drawer-form"
              onSubmit={(e) => void handleSave(e)}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingService && !idManual) setId(toSlug(e.target.value));
                    }}
                    placeholder="e.g. Indore Junction Railway Station"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Service Slug ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingService)}
                    value={editingService ? editingService.id : id}
                    onChange={(e) => {
                      setIdManual(true);
                      setId(e.target.value.toLowerCase());
                    }}
                    placeholder="indore_junction_railway"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 disabled:text-slate-500 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Group
                  </label>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value as ServiceGroupKey)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    {SERVICE_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label} ({g.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Distance or Hours
                  </label>
                  <input
                    type="text"
                    value={distanceOrHours}
                    onChange={(e) => setDistanceOrHours(e.target.value)}
                    placeholder="e.g. Open 24 Hours"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Short description or locality"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Phone / Helpline
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 108 or +91 731 ..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                defaultCenter={{ lat: city.latitude, lng: city.longitude }}
                onChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
                onSelectSuggestion={handleAutoSelect}
                searchPlaceholder={`Search service address in ${city.name}...`}
                label="Service Location (Auto-Select Search / Map Pin & Manual Entry)"
              />
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
                form="service-drawer-form"
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
        open={Boolean(deletingService)}
        title={`Delete "${deletingService?.name ?? ''}"?`}
        description={`Removes this service record from ${city.collectionName}.`}
        busy={deletingBusy}
        onCancel={() => setDeletingService(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
