import { useCallback, useEffect, useState } from 'react';
import { AdminAuthGate } from './components/AdminAuthGate.tsx';
import { CityModal } from './components/CityModal.tsx';
import { CityWorkspace } from './components/CityWorkspace.tsx';
import { ConfirmDialog } from './components/ConfirmDialog.tsx';
import { ToastContainer } from './components/Toast.tsx';
import type { ToastItem } from './components/Toast.tsx';
import { api, clearAuthCredentials } from './lib/api.ts';
import type { AuthStatusResponse } from './lib/api.ts';
import type { AdminSessionUser, CityDoc } from './types.ts';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState<AdminSessionUser | null>(null);
  const isSuperAdmin = sessionUser?.role === 'SUPER_ADMIN';

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
      const cityList = Array.isArray(res?.cities) ? res.cities : [];
      setCities(cityList);
      setSelectedCityId((prev) => prev ?? cityList[0]?.id ?? null);
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
    if (!deletingCity || !isSuperAdmin) return;
    setDeletingCityBusy(true);
    try {
      const removedName = deletingCity.name;
      const removedId = deletingCity.id;
      await api.deleteCity(removedId);
      const res = await api.listCities();
      const cityList = Array.isArray(res?.cities) ? res.cities : [];
      setCities(cityList);
      if (selectedCityId === removedId) {
        setSelectedCityId(cityList[0]?.id ?? null);
      }
      pushToast('success', `Deleted "${removedName}" — Saved & synced live to app`);
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
        sessionUser={sessionUser}
        onSelectCity={(c) => setSelectedCityId(c.id)}
        onCitiesRefresh={loadCities}
        onAddCity={() => {
          if (!isSuperAdmin) return;
          setEditingCity(null);
          setCityModalOpen(true);
        }}
        onEditCity={(c) => {
          setEditingCity(c);
          setCityModalOpen(true);
        }}
        onDeleteCity={(c) => {
          if (!isSuperAdmin) return;
          setDeletingCity(c);
        }}
        onLogout={handleLogout}
        onToast={pushToast}
      />

      {cityModalOpen && (isSuperAdmin || Boolean(editingCity)) && (
        <CityModal
          open={cityModalOpen}
          city={editingCity}
          onClose={() => setCityModalOpen(false)}
          onSaved={(saved, isNew) => {
            void loadCities().then(() => {
              if (isNew) {
                setSelectedCityId(saved.id);
              }
              pushToast('success', `"${saved.name}" — Saved & synced live to app`);
            });
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
