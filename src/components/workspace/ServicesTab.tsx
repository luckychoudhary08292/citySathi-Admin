import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  Ambulance,
  ArrowDown,
  ArrowUp,
  Banknote,
  Building2,
  Bus,
  Edit3,
  GraduationCap,
  Hospital,
  Loader2,
  MapPin,
  Phone,
  Pill,
  Plus,
  ShieldAlert,
  Smartphone,
  Train,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import type {
  CityDoc,
  GeocodeResult,
  ServiceDoc,
  ServiceGroupKey,
  ServiceMode,
} from '../../types.ts';
import {
  SERVICE_CONTACT_CATEGORIES,
  SERVICE_GROUPS,
  SERVICE_ICON_KEYS,
  SERVICE_SHORTCUT_CATEGORIES,
} from '../../types.ts';
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

function renderServiceIcon(iconKey: string, className = 'w-4 h-4') {
  switch (iconKey) {
    case 'ambulance':
      return <Ambulance className={className} />;
    case 'shield-alert':
      return <ShieldAlert className={className} />;
    case 'hospital':
      return <Hospital className={className} />;
    case 'pill':
      return <Pill className={className} />;
    case 'banknote':
      return <Banknote className={className} />;
    case 'train':
      return <Train className={className} />;
    case 'bus':
      return <Bus className={className} />;
    case 'utensils':
      return <Utensils className={className} />;
    case 'graduation-cap':
      return <GraduationCap className={className} />;
    case 'building-2':
      return <Building2 className={className} />;
    case 'phone':
    default:
      return <Phone className={className} />;
  }
}

function inferGroupFromShortcutCategory(cat: string): ServiceGroupKey {
  const lower = cat.toLowerCase();
  if (lower.includes('pharmacy')) return 'PHARMACY';
  if (lower.includes('transport')) return 'TRANSPORT';
  if (lower.includes('hospital') || lower.includes('emergency')) return 'EMERGENCY';
  return 'TRANSPORT';
}

export function ServicesTab({
  city,
  services,
  onServicesChanged,
  onToast,
}: ServicesTabProps) {
  const [filterMode, setFilterMode] = useState<'ALL' | ServiceMode>('ALL');
  const [activeGroup, setActiveGroup] = useState<'ALL' | ServiceGroupKey>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceDoc | null>(null);
  const [deletingService, setDeletingService] = useState<ServiceDoc | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Drawer form states
  const [serviceMode, setServiceMode] = useState<ServiceMode>('CONTACT');
  const [id, setId] = useState('');
  const [idManual, setIdManual] = useState(false);
  const [group, setGroup] = useState<ServiceGroupKey>('EMERGENCY');
  const [category, setCategory] = useState<string>('Contact');
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [distanceOrHours, setDistanceOrHours] = useState('Open 24 Hours');
  const [highlightNumber, setHighlightNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [iconKey, setIconKey] = useState('phone');
  const [sortOrder, setSortOrder] = useState('1');
  const [includeCoordinates, setIncludeCoordinates] = useState(true);
  const [latitude, setLatitude] = useState(String(city.latitude));
  const [longitude, setLongitude] = useState(String(city.longitude));
  const [saving, setSaving] = useState(false);

  const sortedServices = [...services].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
  );

  const visibleServices = sortedServices.filter((s) => {
    if (filterMode !== 'ALL' && s.serviceMode !== filterMode) return false;
    if (activeGroup !== 'ALL' && s.group !== activeGroup) return false;
    return true;
  });

  const contactItems = sortedServices.filter((s) => s.serviceMode !== 'SERVICE_NAME');
  const shortcutItems = sortedServices.filter((s) => s.serviceMode === 'SERVICE_NAME');

  const openAdd = (mode: ServiceMode = 'CONTACT') => {
    setEditingService(null);
    setServiceMode(mode);
    setId('');
    setIdManual(false);
    if (mode === 'CONTACT') {
      setCategory('Contact');
      setGroup('EMERGENCY');
      setIconKey('phone');
      setIncludeCoordinates(false);
    } else {
      setCategory('Service Name');
      setGroup('TRANSPORT');
      setIconKey('hospital');
      setIncludeCoordinates(false);
    }
    setName('');
    setSubtitle('');
    setDescription('');
    setAddress('');
    setDistanceOrHours('Open 24 Hours');
    setHighlightNumber('');
    setPhone('');
    setActionUrl('');
    setIsUrgent(false);
    setSortOrder(String(services.length + 1));
    setLatitude(String(city.latitude));
    setLongitude(String(city.longitude));
    setDrawerOpen(true);
  };

  const openEdit = (svc: ServiceDoc) => {
    setEditingService(svc);
    const mode = svc.serviceMode === 'SERVICE_NAME' ? 'SERVICE_NAME' : 'CONTACT';
    setServiceMode(mode);
    setId(svc.id);
    setIdManual(true);
    setGroup(svc.group);
    setCategory(svc.category || (mode === 'SERVICE_NAME' ? 'Service Name' : 'Contact'));
    setName(svc.name);
    setSubtitle(svc.subtitle);
    setDescription(svc.description || '');
    setAddress(svc.address || '');
    setDistanceOrHours(svc.distanceOrHours || '');
    setHighlightNumber(svc.highlightNumber || (mode === 'CONTACT' ? svc.phone || '' : ''));
    setPhone(svc.phone || '');
    setActionUrl(svc.actionUrl || '');
    setIsUrgent(Boolean(svc.isUrgent));
    setIconKey(svc.iconKey || 'phone');
    setSortOrder(String(svc.sortOrder ?? 0));
    setIncludeCoordinates(
      Math.abs(svc.latitude - city.latitude) > 0.0001 ||
        Math.abs(svc.longitude - city.longitude) > 0.0001
    );
    setLatitude(String(svc.latitude));
    setLongitude(String(svc.longitude));
    setDrawerOpen(true);
  };

  const handleModeSwitch = (nextMode: ServiceMode) => {
    setServiceMode(nextMode);
    if (nextMode === 'CONTACT') {
      if (
        !SERVICE_CONTACT_CATEGORIES.includes(
          category as (typeof SERVICE_CONTACT_CATEGORIES)[number]
        )
      ) {
        setCategory('Contact');
      }
      if (iconKey === 'hospital' || iconKey === 'banknote') {
        setIconKey('phone');
      }
    } else {
      if (
        !SERVICE_SHORTCUT_CATEGORIES.includes(
          category as (typeof SERVICE_SHORTCUT_CATEGORIES)[number]
        )
      ) {
        setCategory('Service Name');
      }
      if (iconKey === 'phone') {
        setIconKey('hospital');
      }
    }
  };

  const handleAutoSelect = (res: GeocodeResult) => {
    if (!name.trim() && res.shortName) {
      setName(res.shortName);
      if (!editingService && !idManual) {
        setId(toSlug(res.shortName));
      }
    }
    if (!address.trim() && res.displayName) {
      setAddress(res.displayName);
    }
    if (!subtitle.trim() && res.displayName) {
      setSubtitle(res.displayName.split(',').slice(0, 2).join(', '));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const computedSlug = editingService ? editingService.id : toSlug(id || name);
    const latNum = includeCoordinates ? Number(latitude) : city.latitude;
    const lngNum = includeCoordinates ? Number(longitude) : city.longitude;
    const orderNum = Number(sortOrder);

    if (!name.trim()) {
      onToast('error', 'Service name is required.');
      return;
    }
    if (!editingService && (!computedSlug || !/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(computedSlug))) {
      onToast('error', 'Service ID must be a lowercase slug.');
      return;
    }
    if (
      includeCoordinates &&
      (latitude === '' ||
        longitude === '' ||
        !Number.isFinite(latNum) ||
        !Number.isFinite(lngNum) ||
        latNum < -90 ||
        latNum > 90 ||
        lngNum < -180 ||
        lngNum > 180)
    ) {
      onToast('error', 'Valid latitude and longitude are required.');
      return;
    }

    setSaving(true);
    try {
      const cleanPhone = phone.trim();
      const cleanHighlight =
        serviceMode === 'SERVICE_NAME'
          ? highlightNumber.trim()
          : highlightNumber.trim() || cleanPhone;
      const payload: Partial<ServiceDoc> = {
        id: computedSlug,
        cityId: city.id,
        docType: 'service',
        group,
        serviceMode,
        category: category.trim() || (serviceMode === 'SERVICE_NAME' ? 'Service Name' : 'Contact'),
        name: name.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        address: address.trim(),
        distanceOrHours: distanceOrHours.trim(),
        highlightNumber: cleanHighlight,
        phone: cleanPhone,
        actionUrl: actionUrl.trim(),
        isUrgent: serviceMode === 'CONTACT' ? isUrgent : false,
        iconKey: iconKey.trim() || 'phone',
        sortOrder: Number.isFinite(orderNum) ? Math.round(orderNum) : 0,
        latitude: latNum,
        longitude: lngNum,
      };

      const savedName = payload.name || 'Service';
      if (editingService) {
        await api.updateService(city.id, editingService.id, payload);
      } else {
        await api.createService(city.id, payload);
      }
      const fresh = await api.listServices(city.id);
      onServicesChanged(fresh.services);
      onToast('success', `"${savedName}" — Saved & synced live to app`);
      setDrawerOpen(false);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStepOrder = async (svc: ServiceDoc, delta: number) => {
    setReorderingId(svc.id);
    try {
      const nextOrder = Math.max(0, (svc.sortOrder ?? 0) + delta);
      await api.updateService(city.id, svc.id, { sortOrder: nextOrder });
      const fresh = await api.listServices(city.id);
      onServicesChanged(fresh.services);
      onToast('success', `Sort order for "${svc.name}" — Saved & synced live to app`);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setReorderingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingService) return;
    setDeletingBusy(true);
    try {
      const removedName = deletingService.name;
      await api.deleteService(city.id, deletingService.id);
      const fresh = await api.listServices(city.id);
      onServicesChanged(fresh.services);
      onToast('success', `Deleted "${removedName}" — Saved & synced live to app`);
      setDeletingService(null);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            City Hub — Services Manager
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage 2 modes in <span className="font-mono text-xs">{city.collectionName}</span>: Contact Helplines &amp; Map Category Shortcuts.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openAdd('SERVICE_NAME')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#0284C7]" />
            Add Shortcut
          </button>
          <button
            type="button"
            onClick={() => openAdd('CONTACT')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Contact / Helpline
          </button>
        </div>
      </div>

      {/* Mode Filter & Group Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 overflow-x-auto max-w-full">
          {[
            { key: 'ALL' as const, label: `All (${services.length})` },
            { key: 'CONTACT' as const, label: `Mode A: Contact / Helpline (${contactItems.length})` },
            {
              key: 'SERVICE_NAME' as const,
              label: `Mode B: Service Name Shortcuts (${shortcutItems.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterMode(tab.key)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filterMode === tab.key
                  ? 'bg-[#E0F2FE] text-[#0284C7]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={activeGroup}
          onChange={(e) => setActiveGroup(e.target.value as 'ALL' | ServiceGroupKey)}
          aria-label="Filter by group"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="ALL">All Groups ({services.length})</option>
          {SERVICE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label} ({services.filter((s) => s.group === g.value).length})
            </option>
          ))}
        </select>
      </div>

      {/* Quick Mobile App Card Preview */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Mobile App Quick Preview ({city.name} City Hub)
              </h3>
              <p className="text-xs text-slate-500">
                Shows how cards appear under Contact and Service Name sections
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contact / Helplines Preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Contact &amp; Helplines
              </span>
              <span className="text-[11px] font-mono text-slate-400">Mode A</span>
            </div>
            {contactItems.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-3">No contact services added yet.</p>
            ) : (
              <div className="space-y-2">
                {contactItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border bg-white p-3 flex items-center justify-between gap-3 ${
                      item.isUrgent ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                          item.isUrgent
                            ? 'bg-red-100 text-[#DC2626]'
                            : 'bg-[#E0F2FE] text-[#0284C7]'
                        }`}
                      >
                        {renderServiceIcon(item.iconKey, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                          {item.isUrgent && (
                            <span className="rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">
                              URGENT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.subtitle || item.address || item.category}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                        item.isUrgent
                          ? 'bg-[#DC2626] text-white'
                          : 'bg-[#E0F2FE] text-[#0284C7]'
                      }`}
                    >
                      {item.highlightNumber || item.phone || 'Call'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service Name Shortcuts Preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Service Name (Map Shortcuts)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Mode B</span>
            </div>
            {shortcutItems.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-3">
                No map category shortcuts added yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {shortcutItems.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
                        {renderServiceIcon(item.iconKey, 'w-4 h-4')}
                      </div>
                      {item.highlightNumber && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                          {item.highlightNumber}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{item.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Structured Services Table */}
      {visibleServices.length === 0 ? (
        <div className="surface-card border-dashed p-12 text-center">
          <p className="text-sm font-semibold text-slate-900">
            No services match this view in {city.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Add emergency contacts, helplines, or map category shortcuts.
          </p>
          <button
            type="button"
            onClick={() => openAdd('CONTACT')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1]"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Mode &amp; Category</th>
                  <th className="py-3 px-4">Phone / Highlight</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visibleServices.map((svc) => (
                  <tr key={svc.id} className="h-16 hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <span className="font-mono text-xs font-semibold text-slate-700 w-6 text-center tabular-nums">
                          {svc.sortOrder ?? 0}
                        </span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={reorderingId === svc.id || (svc.sortOrder ?? 0) <= 0}
                            onClick={() => void handleStepOrder(svc, -1)}
                            className="p-0.5 text-slate-400 hover:text-[#0284C7] disabled:opacity-30"
                            title="Move earlier (decrease sortOrder)"
                            aria-label={`Decrease sortOrder for ${svc.name}`}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={reorderingId === svc.id}
                            onClick={() => void handleStepOrder(svc, 1)}
                            className="p-0.5 text-slate-400 hover:text-[#0284C7] disabled:opacity-30"
                            title="Move later (increase sortOrder)"
                            aria-label={`Increase sortOrder for ${svc.name}`}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                            svc.isUrgent
                              ? 'bg-[#FEF2F2] text-[#DC2626]'
                              : 'bg-[#E0F2FE] text-[#0284C7]'
                          }`}
                        >
                          {renderServiceIcon(svc.iconKey, 'w-4 h-4')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-900">{svc.name}</p>
                            {svc.isUrgent && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {svc.subtitle || svc.address || svc.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            svc.serviceMode === 'SERVICE_NAME'
                              ? 'bg-sky-50 text-[#0284C7] border border-sky-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {svc.serviceMode === 'SERVICE_NAME' ? 'Service Name' : 'Contact / Helpline'}
                        </span>
                        <span className="text-xs text-slate-500">{svc.category}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {svc.highlightNumber || svc.phone ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800">
                          {svc.highlightNumber || svc.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                        {svc.group}
                      </span>
                    </td>

                    <td className="py-3 px-5 text-right whitespace-nowrap">
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

      {/* Slide-Over 2-Mode Service Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[90] flex justify-end bg-slate-900/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-drawer-title"
        >
          <div className="w-full max-w-[600px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shrink-0">
              <div>
                <h2 id="service-drawer-title" className="text-lg font-bold text-slate-900">
                  {editingService
                    ? `Edit Service — ${editingService.name}`
                    : `Add City Hub Service (${city.name})`}
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
              {/* Clear 2-Mode Toggle */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Service Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('CONTACT')}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                      serviceMode === 'CONTACT'
                        ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0284C7]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold">Mode A: Contact / Helpline</p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      Phone numbers, urgent alerts &amp; addresses
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('SERVICE_NAME')}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                      serviceMode === 'SERVICE_NAME'
                        ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0284C7]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold">Mode B: Service Name</p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      Map Category Shortcut (e.g. Hospital · 14)
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {serviceMode === 'SERVICE_NAME' ? 'Service Shortcut Name' : 'Contact / Helpline Name'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingService && !idManual) setId(toSlug(e.target.value));
                    }}
                    placeholder={
                      serviceMode === 'SERVICE_NAME'
                        ? 'e.g. Hospital'
                        : 'e.g. Ambulance & Trauma Helpline'
                    }
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
                    placeholder="indore_ambulance_108"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 disabled:text-slate-500 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Category
                  </label>
                  {serviceMode === 'CONTACT' ? (
                    <select
                      value={category}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCategory(val);
                        if (val === 'Emergency') setGroup('EMERGENCY');
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    >
                      {SERVICE_CONTACT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input
                        type="text"
                        list="service-shortcut-category-list"
                        value={category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCategory(val);
                          setGroup(inferGroupFromShortcutCategory(val));
                        }}
                        placeholder="e.g. Hospital or Service Name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
                      <datalist id="service-shortcut-category-list">
                        {SERVICE_SHORTCUT_CATEGORIES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Highlight Number / Badge{' '}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={highlightNumber}
                    onChange={(e) => setHighlightNumber(e.target.value)}
                    placeholder={
                      serviceMode === 'SERVICE_NAME' ? 'Optional (e.g. 14 or 24x7)' : 'e.g. 108'
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                {serviceMode === 'CONTACT' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Phone / Contact Number <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (!highlightNumber) setHighlightNumber(e.target.value);
                      }}
                      placeholder="e.g. 108 or +91 731 ..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Subtitle (optional)
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. Nearby emergency hospitals"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Icon Key
                  </label>
                  <select
                    value={iconKey}
                    onChange={(e) => setIconKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    {SERVICE_ICON_KEYS.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label} ({icon.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Sort Order (numeric)
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Action URL <span className="text-slate-400 font-normal">(optional http/https link)</span>
                  </label>
                  <input
                    type="url"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="https://... (optional portal, booking, or helpline page)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              {serviceMode === 'CONTACT' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Subtitle
                      </label>
                      <input
                        type="text"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="Short locality or role"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
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
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="When to call or service notes..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address or landmark"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>

                  <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Urgent / Priority Helpline (<span className="font-mono">isUrgent</span>)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Highlights this card in red on the Android City Hub screen
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isUrgent}
                      onChange={(e) => setIsUrgent(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#DC2626] focus:ring-red-500"
                    />
                  </label>
                </>
              )}

              {/* Live Card Preview inside Drawer */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Mobile Card Preview ({serviceMode === 'CONTACT' ? 'Contact' : 'Service Name'})
                </p>
                {serviceMode === 'CONTACT' ? (
                  <div
                    className={`rounded-xl border bg-white p-3 flex items-center justify-between gap-3 ${
                      isUrgent ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                          isUrgent ? 'bg-red-100 text-[#DC2626]' : 'bg-[#E0F2FE] text-[#0284C7]'
                        }`}
                      >
                        {renderServiceIcon(iconKey, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {name || 'Helpline Name'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {subtitle || address || category}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                        isUrgent ? 'bg-[#DC2626] text-white' : 'bg-[#E0F2FE] text-[#0284C7]'
                      }`}
                    >
                      {highlightNumber || phone || '108'}
                    </span>
                  </div>
                ) : (
                  <div className="w-40 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
                        {renderServiceIcon(iconKey, 'w-4 h-4')}
                      </div>
                      {highlightNumber && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                          {highlightNumber}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {name || 'Hospital'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{category}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Coordinates toggle for both modes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                    Coordinates <span className="text-slate-400 font-normal">(optional)</span>
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCoordinates}
                      onChange={(e) => setIncludeCoordinates(e.target.checked)}
                      className="rounded border-slate-300 text-[#0284C7]"
                    />
                    Specify custom lat/lng
                  </label>
                </div>

                {includeCoordinates && (
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
                )}
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
