import { useEffect, useState } from 'react';
import { Calendar, MessageSquare, Search, Trash2, User } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { CityDoc, TipDoc, TripDoc, TripStatus } from '../../types.ts';
import { ConfirmDialog } from '../ConfirmDialog.tsx';

interface InspectorTabProps {
  city: CityDoc;
  onToast: (type: 'success' | 'error', message: string) => void;
}

function formatDate(ts: number | string): string {
  const num = Number(ts);
  if (!Number.isFinite(num) || num <= 0) return String(ts || '—');
  return new Date(num).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const TRIP_STATUS_OPTIONS: ReadonlyArray<'ALL' | TripStatus> = [
  'ALL',
  'UPCOMING',
  'ONGOING',
  'COMPLETED',
];

export function InspectorTab({ city, onToast }: InspectorTabProps) {
  const [subTab, setSubTab] = useState<'trips' | 'tips'>('trips');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TripStatus>('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [tipSearch, setTipSearch] = useState('');
  const [trips, setTrips] = useState<TripDoc[]>([]);
  const [tips, setTips] = useState<TipDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [deletingTrip, setDeletingTrip] = useState<TripDoc | null>(null);
  const [deletingTip, setDeletingTip] = useState<TipDoc | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadData = async (filterUserId = userSearch) => {
    setLoading(true);
    try {
      const [tripsRes, tipsRes] = await Promise.all([
        api.listTrips(city.id, filterUserId),
        api.listTips(city.id),
      ]);
      setTrips(tripsRes.trips);
      setTips(tipsRes.tips);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.id]);

  const handleConfirmDeleteTrip = async () => {
    if (!deletingTrip) return;
    setDeletingBusy(true);
    try {
      const removedTitle = deletingTrip.title;
      await api.deleteTrip(deletingTrip.id);
      const fresh = await api.listTrips(city.id, userSearch);
      setTrips(fresh.trips);
      onToast('success', `Deleted trip "${removedTitle}" — Saved & synced live to app`);
      setDeletingTrip(null);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleConfirmDeleteTip = async () => {
    if (!deletingTip) return;
    setDeletingBusy(true);
    try {
      const removedPlace = deletingTip.placeName;
      await api.deleteTip(deletingTip.id);
      const fresh = await api.listTips(city.id);
      setTips(fresh.tips);
      onToast('success', `Removed tip for "${removedPlace}" — Saved & synced live to app`);
      setDeletingTip(null);
    } catch (err) {
      onToast('error', (err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  const visibleTrips =
    statusFilter === 'ALL' ? trips : trips.filter((t) => t.status === statusFilter);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          User Trips & Community Tips
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Inspect itineraries and moderate traveler tips scoped to {city.name}.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setSubTab('trips')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'trips'
                ? 'bg-[#E0F2FE] text-[#0284C7]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User Trips ({trips.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('tips')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'tips'
                ? 'bg-[#E0F2FE] text-[#0284C7]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Community Tips ({tips.length})
          </button>
        </div>

        {subTab === 'trips' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadData(userSearch);
            }}
            className="flex gap-2 w-full sm:w-auto"
          >
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Filter by X-User-Id..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Filter
            </button>
          </form>
        ) : (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={tipSearch}
              onChange={(e) => setTipSearch(e.target.value)}
              placeholder="Filter tips by placeId or note..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>
        )}
      </div>

      {subTab === 'trips' && !loading && (
        <div className="flex flex-wrap items-center gap-1.5">
          {TRIP_STATUS_OPTIONS.map((st) => {
            const count =
              st === 'ALL' ? trips.length : trips.filter((t) => t.status === st).length;
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0284C7] text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                }`}
              >
                {st} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="surface-card p-6 space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : subTab === 'trips' ? (
        visibleTrips.length === 0 ? (
          <div className="surface-card border-dashed p-12 text-center">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900">
              {trips.length === 0
                ? `No trips found for ${city.name}`
                : `No ${statusFilter} trips found for ${city.name}`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              User itineraries created in the mobile app for {city.id} appear here.
            </p>
          </div>
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">Trip Title & City</th>
                    <th className="py-3 px-4">User ID</th>
                    <th className="py-3 px-4">Duration & Start Date</th>
                    <th className="py-3 px-4">Checkpoints</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibleTrips.map((trip) => {
                    const totalStops = trip.placeIds.length;
                    const doneStops = trip.completedPlaceIds.length;
                    const pct = totalStops > 0 ? Math.min(100, Math.round((doneStops / totalStops) * 100)) : 0;

                    return (
                      <tr key={trip.id} className="h-16 hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <p className="font-semibold text-slate-900">{trip.title}</p>
                            <span className="inline-flex items-center rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[11px] font-semibold text-[#0284C7]">
                              {trip.cityId}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-400 mt-0.5">{trip.id}</p>
                          {trip.placeIds.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {trip.placeIds.map((pid) => {
                                const done = trip.completedPlaceIds.includes(pid);
                                return (
                                  <span
                                    key={pid}
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                      done
                                        ? 'bg-[#ECFDF5] text-[#059669] border border-emerald-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                    title={done ? 'Completed stop' : 'Pending stop'}
                                  >
                                    {done ? '✓ ' : ''}
                                    {pid}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-700">
                            <User className="w-3 h-3 text-slate-400" />
                            {trip.userId}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                          <span className="font-medium text-slate-900">{trip.duration}</span>
                          <span className="block text-slate-500 tabular-nums mt-0.5">
                            {formatDate(trip.startDateMillis)}
                          </span>
                        </td>

                        <td className="py-3 px-4 min-w-[160px]">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs tabular-nums">
                              <span className="font-mono font-medium text-slate-700">
                                {doneStops}/{totalStops} stops
                              </span>
                              <span className="text-slate-500">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  trip.status === 'COMPLETED'
                                    ? 'bg-[#059669]'
                                    : trip.status === 'ONGOING'
                                      ? 'bg-[#D97706]'
                                      : 'bg-[#0284C7]'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              trip.status === 'COMPLETED'
                                ? 'bg-[#ECFDF5] text-[#059669]'
                                : trip.status === 'ONGOING'
                                  ? 'bg-[#FFFBEB] text-[#D97706]'
                                  : 'bg-[#E0F2FE] text-[#0284C7]'
                            }`}
                          >
                            {trip.status}
                          </span>
                        </td>

                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => setDeletingTrip(trip)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : tips.length === 0 ? (
        <div className="surface-card border-dashed p-12 text-center">
          <MessageSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">No community tips for {city.name}</p>
          <p className="text-xs text-slate-500 mt-1">
            Tips submitted by travelers on places in {city.name} appear here for moderation.
          </p>
        </div>
      ) : (
        <div className="surface-card divide-y divide-slate-100 overflow-hidden">
          {tips
            .filter((tip) => {
              const q = tipSearch.trim().toLowerCase();
              if (!q) return true;
              return (
                tip.placeName.toLowerCase().includes(q) ||
                tip.placeId.toLowerCase().includes(q) ||
                tip.note.toLowerCase().includes(q)
              );
            })
            .map((tip) => (
              <div
                key={tip.id}
                className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="text-sm font-bold text-slate-900">{tip.placeName}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                      {tip.placeId}
                    </span>
                    <span className="rounded-md bg-[#FFFBEB] px-2 py-0.5 font-mono text-xs font-semibold text-[#D97706] tabular-nums">
                      ★ {tip.rating.toFixed(1)}
                    </span>
                    <span className="tabular-nums">{formatDate(tip.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">{tip.note}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setDeletingTip(tip)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Tip
                </button>
              </div>
            ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingTrip)}
        title={`Delete trip "${deletingTrip?.title ?? ''}"?`}
        description="Removes this user trip record from the trips collection."
        busy={deletingBusy}
        onCancel={() => setDeletingTrip(null)}
        onConfirm={() => void handleConfirmDeleteTrip()}
      />

      <ConfirmDialog
        open={Boolean(deletingTip)}
        title={`Remove tip on "${deletingTip?.placeName ?? ''}"?`}
        description="Permanently deletes this community tip from the tips collection."
        busy={deletingBusy}
        onCancel={() => setDeletingTip(null)}
        onConfirm={() => void handleConfirmDeleteTip()}
      />
    </div>
  );
}
