import { useCallback, useEffect, useState } from 'react';
import { AdminAuthGate } from './components/AdminAuthGate.tsx';
import { CityModal } from './components/CityModal.tsx';
import { CityWorkspace } from './components/CityWorkspace.tsx';
import { ConfirmDialog } from './components/ConfirmDialog.tsx';
import { ToastContainer } from './components/Toast.tsx';
import type { ToastItem } from './components/Toast.tsx';
import { api, clearAuthCredentials } from './lib/api.ts';
import type { AuthStatusResponse } from './lib/api.ts';
import type { CityDoc } from './types.ts';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ email: string; dbMode: 'mongodb' | 'local' } | null>(
    null
  );

  const [cities, setCities] = useState<CityDoc[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<CityDoc | null>(null);

  const [deletingCity, setDeletingCity] = useState<CityDoc | null>(null);
  const [deletingCityBusy, setDeletingCityBusy] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      pushToast('error', (err as Error).message);
    } finally {
      setAuthChecked(true);
    }
  }, [pushToast]);

  useEffect(() => {
    void checkAuthStatus();
  }, [checkAuthStatus]);

  const loadCities = useCallback(async () => {
    setLoadingCities(true);
    try {
      const res = await api.listCities();
      setCities(res.cities);
      setSelectedCityId((prev) => prev ?? res.cities[0]?.id ?? null);
    } catch (err) {
      pushToast('error', (err as Error).message);
    } finally {
      setLoadingCities(false);
    }
  }, [pushToast]);

  useEffect(() => {
    if (sessionUser) {
      void loadCities();
    }
  }, [sessionUser, loadCities]);

  const selectedCity = cities.find((c) => c.id === selectedCityId) || null;

  const handleLogout = () => {
    clearAuthCredentials();
    setSessionUser(null);
    setSelectedCityId(null);
    void checkAuthStatus();
  };

  const handleConfirmDeleteCity = async () => {
    if (!deletingCity) return;
    setDeletingCityBusy(true);
    try {
      await api.deleteCity(deletingCity.id);
      const remaining = cities.filter((c) => c.id !== deletingCity.id);
      setCities(remaining);
      if (selectedCityId === deletingCity.id) {
        setSelectedCityId(remaining[0]?.id ?? null);
      }
      pushToast('success', `Deleted city "${deletingCity.name}" and ${deletingCity.collectionName}`);
      setDeletingCity(null);
    } catch (err) {
      pushToast('error', (err as Error).message);
    } finally {
      setDeletingCityBusy(false);
    }
  };

  if (!authChecked || !authStatus) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-sm text-slate-500">
        Connecting to City Companion server...
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <>
        <AdminAuthGate
          authStatus={authStatus}
          onAuthenticated={(info) => {
            setSessionUser(info);
            pushToast('success', `Signed in as ${info.email}`);
          }}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <>
      <CityWorkspace
        cities={cities}
        selectedCity={selectedCity}
        loadingCities={loadingCities}
        dbMode={sessionUser.dbMode}
        userEmail={sessionUser.email}
        onSelectCity={(c) => setSelectedCityId(c.id)}
        onCityUpdated={(updated) =>
          setCities((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
        onAddCity={() => {
          setEditingCity(null);
          setCityModalOpen(true);
        }}
        onEditCity={(c) => {
          setEditingCity(c);
          setCityModalOpen(true);
        }}
        onDeleteCity={(c) => setDeletingCity(c)}
        onLogout={handleLogout}
        onToast={pushToast}
      />

      {cityModalOpen && (
        <CityModal
          open={cityModalOpen}
          city={editingCity}
          onClose={() => setCityModalOpen(false)}
          onSaved={(saved, isNew) => {
            if (isNew) {
              setCities((prev) =>
                [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
              );
              setSelectedCityId(saved.id);
              pushToast(
                'success',
                `Created "${saved.name}" with ${saved.collectionName} & 6 fixed categories`
              );
            } else {
              setCities((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
              pushToast('success', `Changes saved to ${saved.name}`);
            }
            setCityModalOpen(false);
          }}
          onError={(msg) => pushToast('error', msg)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingCity)}
        title={`Delete city "${deletingCity?.name ?? ''}"?`}
        description={`This permanently deletes "${deletingCity?.name}" from cities, removes its 6 category documents, and drops collection "${deletingCity?.collectionName}".`}
        confirmLabel="Delete City"
        busy={deletingCityBusy}
        onCancel={() => setDeletingCity(null)}
        onConfirm={() => void handleConfirmDeleteCity()}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
