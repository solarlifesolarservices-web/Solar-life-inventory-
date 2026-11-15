import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getDatabaseProvider } from '../db/databaseFactory';
import { IDatabaseProvider, InventorySnapshot } from '../db/IDatabaseProvider';
import {
  AppSettings,
  BackupPayload,
  Category,
  Customer,
  InwardStockInput,
  OutwardStockInput,
  ReturnOrDamageInput,
  ScreenId,
  SerialSearchResult,
  SerialStatus,
  StockTransaction,
  Supplier,
  Technician,
} from '../types/inventory';

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface InventoryContextValue {
  db: IDatabaseProvider;
  snapshot: InventorySnapshot | null;
  loading: boolean;
  error: string | null;
  activeScreen: ScreenId;
  screenParams: { serialQuery?: string; productId?: string; filter?: string };
  navigate: (screen: ScreenId, params?: { serialQuery?: string; productId?: string; filter?: string }) => void;
  goBack: () => boolean;
  canGoBack: boolean;
  refresh: () => Promise<void>;
  toast: ToastMessage | null;
  showToast: (message: string, type?: ToastMessage['type']) => void;
  clearToast: () => void;

  // Actions
  addCategory: (name: string, requiresSerial: boolean) => Promise<Category>;
  deleteCategory: (categoryId: string) => Promise<void>;
  updateProductThreshold: (productId: string, minStockLevel: number) => Promise<void>;
  addStockInward: (input: InwardStockInput) => Promise<StockTransaction>;
  issueStockOutward: (input: OutwardStockInput) => Promise<StockTransaction>;
  searchSerial: (serialNumber: string) => Promise<SerialSearchResult | null>;
  updateSerialStatus: (params: {
    serialNumber: string;
    newStatus: SerialStatus;
    remarks: string;
    actionDate: string;
    location?: string;
    technicianName?: string;
  }) => Promise<SerialSearchResult>;
  recordReturnOrDamage: (input: ReturnOrDamageInput) => Promise<StockTransaction>;
  upsertCustomer: (
    input: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
  upsertSupplier: (
    input: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ) => Promise<Supplier>;
  deleteSupplier: (id: string) => Promise<void>;
  upsertTechnician: (
    input: Omit<Technician, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ) => Promise<Technician>;
  deleteTechnician: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  exportBackup: () => Promise<BackupPayload>;
  restoreBackup: (payload: BackupPayload) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

interface HistoryEntry {
  screen: ScreenId;
  params: { serialQuery?: string; productId?: string; filter?: string };
}

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db] = useState<IDatabaseProvider>(() => getDatabaseProvider());
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { screen: 'dashboard', params: {} },
  ]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const currentEntry = history[history.length - 1];

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    setToast({ id: Date.now(), type, message });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const refresh = useCallback(async () => {
    try {
      const next = await db.getSnapshot();
      setSnapshot(next);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load local database.';
      setError(msg);
    }
  }, [db]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await db.initialize();
        const next = await db.getSnapshot();
        if (mounted) {
          setSnapshot(next);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Database initialization failed.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db]);

  const navigate = useCallback(
    (
      screen: ScreenId,
      params: { serialQuery?: string; productId?: string; filter?: string } = {}
    ) => {
      setHistory((prev) => {
        const top = prev[prev.length - 1];
        if (top.screen === screen && JSON.stringify(top.params) === JSON.stringify(params)) {
          return prev;
        }
        return [...prev.slice(-19), { screen, params }];
      });
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    []
  );

  const goBack = useCallback((): boolean => {
    if (history.length <= 1) return false;
    setHistory((prev) => prev.slice(0, -1));
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    return true;
  }, [history.length]);

  // Android hardware back button handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | null = null;
    CapacitorApp.addListener('backButton', ({ canGoBack: webCanGoBack }) => {
      if (history.length > 1) {
        setHistory((prev) => prev.slice(0, -1));
      } else if (webCanGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    }).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, [history.length]);

  const addCategory = useCallback(
    async (name: string, requiresSerial: boolean) => {
      const created = await db.addCategory(name, requiresSerial);
      await refresh();
      showToast(`Category "${created.name}" added.`);
      return created;
    },
    [db, refresh, showToast]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      await db.deleteCategory(categoryId);
      await refresh();
      showToast('Category deleted.');
    },
    [db, refresh, showToast]
  );

  const updateProductThreshold = useCallback(
    async (productId: string, minStockLevel: number) => {
      await db.updateProductThreshold(productId, minStockLevel);
      await refresh();
      showToast('Low-stock threshold updated.');
    },
    [db, refresh, showToast]
  );

  const addStockInward = useCallback(
    async (input: InwardStockInput) => {
      const tx = await db.addStockInward(input);
      await refresh();
      showToast(`Added ${tx.quantity} × ${tx.product_name} to stock.`);
      return tx;
    },
    [db, refresh, showToast]
  );

  const issueStockOutward = useCallback(
    async (input: OutwardStockInput) => {
      const tx = await db.issueStockOutward(input);
      await refresh();
      showToast(`Issued ${tx.quantity} × ${tx.product_name} to ${tx.party_name}.`);
      return tx;
    },
    [db, refresh, showToast]
  );

  const searchSerial = useCallback(
    async (serialNumber: string) => {
      return db.searchSerial(serialNumber);
    },
    [db]
  );

  const updateSerialStatus = useCallback(
    async (params: {
      serialNumber: string;
      newStatus: SerialStatus;
      remarks: string;
      actionDate: string;
      location?: string;
      technicianName?: string;
    }) => {
      const res = await db.updateSerialStatus(params);
      await refresh();
      showToast(`Serial ${res.item.serial_number} marked as ${res.item.status}.`);
      return res;
    },
    [db, refresh, showToast]
  );

  const recordReturnOrDamage = useCallback(
    async (input: ReturnOrDamageInput) => {
      const tx = await db.recordReturnOrDamage(input);
      await refresh();
      showToast(`Recorded ${input.action.toLowerCase().replace('_', ' ')} (${tx.quantity} units).`);
      return tx;
    },
    [db, refresh, showToast]
  );

  const upsertCustomer = useCallback(
    async (input: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }) => {
      const res = await db.upsertCustomer(input);
      await refresh();
      showToast(`Saved customer "${res.name}".`);
      return res;
    },
    [db, refresh, showToast]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      await db.deleteCustomer(id);
      await refresh();
      showToast('Customer deleted.');
    },
    [db, refresh, showToast]
  );

  const upsertSupplier = useCallback(
    async (input: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }) => {
      const res = await db.upsertSupplier(input);
      await refresh();
      showToast(`Saved supplier "${res.name}".`);
      return res;
    },
    [db, refresh, showToast]
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      await db.deleteSupplier(id);
      await refresh();
      showToast('Supplier deleted.');
    },
    [db, refresh, showToast]
  );

  const upsertTechnician = useCallback(
    async (input: Omit<Technician, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }) => {
      const res = await db.upsertTechnician(input);
      await refresh();
      showToast(`Saved technician "${res.name}".`);
      return res;
    },
    [db, refresh, showToast]
  );

  const deleteTechnician = useCallback(
    async (id: string) => {
      await db.deleteTechnician(id);
      await refresh();
      showToast('Technician deleted.');
    },
    [db, refresh, showToast]
  );

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const res = await db.updateSettings(partial);
      await refresh();
      showToast('Settings saved.');
      return res;
    },
    [db, refresh, showToast]
  );

  const exportBackup = useCallback(async () => {
    const payload = await db.exportBackup();
    await refresh();
    return payload;
  }, [db, refresh]);

  const restoreBackup = useCallback(
    async (payload: BackupPayload) => {
      await db.restoreBackup(payload);
      await refresh();
      showToast('Backup restored successfully.');
    },
    [db, refresh, showToast]
  );

  const clearAllData = useCallback(async () => {
    await db.clearAllData();
    await refresh();
    showToast('All local inventory records cleared.', 'info');
  }, [db, refresh, showToast]);

  return (
    <InventoryContext.Provider
      value={{
        db,
        snapshot,
        loading,
        error,
        activeScreen: currentEntry.screen,
        screenParams: currentEntry.params,
        navigate,
        goBack,
        canGoBack: history.length > 1,
        refresh,
        toast,
        showToast,
        clearToast,
        addCategory,
        deleteCategory,
        updateProductThreshold,
        addStockInward,
        issueStockOutward,
        searchSerial,
        updateSerialStatus,
        recordReturnOrDamage,
        upsertCustomer,
        deleteCustomer,
        upsertSupplier,
        deleteSupplier,
        upsertTechnician,
        deleteTechnician,
        updateSettings,
        exportBackup,
        restoreBackup,
        clearAllData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
