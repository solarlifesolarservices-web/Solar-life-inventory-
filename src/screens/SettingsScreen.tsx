import React, { useState } from 'react';
import { Check, Plus, Settings as SettingsIcon, Smartphone, Trash2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ConfirmModal } from '../components/UiPrimitives';

export const SettingsScreen: React.FC = () => {
  const {
    snapshot,
    db,
    updateSettings,
    addCategory,
    deleteCategory,
    clearAllData,
    showToast,
  } = useInventory();

  const [businessName, setBusinessName] = useState(
    snapshot?.settings.business_name ?? 'SOLAR LIFE'
  );
  const [tagline, setTagline] = useState(snapshot?.settings.tagline ?? 'Solar Services');
  const [threshold, setThreshold] = useState(
    String(snapshot?.settings.default_low_stock_threshold ?? 5)
  );
  const [currency, setCurrency] = useState(snapshot?.settings.currency_symbol ?? '₹');

  const [newCatName, setNewCatName] = useState('');
  const [newCatSerial, setNewCatSerial] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      business_name: businessName.trim() || 'SOLAR LIFE',
      tagline: tagline.trim() || 'Solar Services',
      default_low_stock_threshold: Math.max(0, Number(threshold) || 5),
      currency_symbol: currency.trim() || '₹',
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    try {
      await addCategory(newCatName, newCatSerial);
      setNewCatName('');
      setNewCatSerial(false);
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Unable to add category.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cannot delete category.', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings &amp; Categories</h1>
        <p className="text-sm text-slate-600">
          Configure business defaults, custom inventory categories, and offline storage
        </p>
      </div>

      {/* Business Preferences */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-blue-700" />
          <h2 className="text-base font-bold text-slate-900">Business &amp; Alert Preferences</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Service Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Default Low-Stock Alert Threshold
            </label>
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Currency Symbol
            </label>
            <input
              type="text"
              maxLength={4}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Save Preferences
          </button>
        </div>
      </form>

      {/* Inventory Categories Manager */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Inventory Categories</h2>
          <p className="text-xs text-slate-500">
            Includes all 10 standard solar categories plus custom categories you add
          </p>
        </div>

        <form onSubmit={handleAddCategory} className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          {catError && (
            <p className="text-xs text-red-700 font-medium">{catError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New custom category (e.g. Lithium Batteries, SPD)"
              className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={newCatSerial}
              onChange={(e) => setNewCatSerial(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-700"
            />
            Require individual serial numbers for items in this category
          </label>
        </form>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {(snapshot?.categories ?? []).map((cat) => (
            <div
              key={cat.id}
              className="px-4 py-3 flex items-center justify-between gap-2 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{cat.name}</p>
                <p className="text-xs text-slate-500">
                  {cat.is_system ? 'Default category' : 'Custom category'}
                  {cat.requires_serial ? ' · Serial number required' : ''}
                </p>
              </div>
              {!cat.is_system && (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Offline Engine & Future Cloud Sync Readiness */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-700" />
          <h2 className="text-base font-bold text-slate-900">Offline Storage &amp; Device Info</h2>
        </div>
        <div className="text-sm text-slate-600 space-y-1.5">
          <p>
            Active Storage Engine:{' '}
            <span className="font-mono font-semibold text-slate-900">
              {db.engineName === 'sqlite-capacitor'
                ? 'Native Android SQLite (@capacitor-community/sqlite)'
                : 'IndexedDB Persistent Store (Web Preview / Browser)'}
            </span>
          </p>
          <p>
            Device ID:{' '}
            <span className="font-mono text-xs text-slate-700">
              {snapshot?.settings.device_id}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Schema includes UUID primary keys, timestamps, and sync_status flags so a future
            Supabase sync adapter can be added without modifying UI screens.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-3">
          <p className="text-xs text-red-700">
            Danger Zone: Clear all test inventory data on this device.
          </p>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-[44px] px-4 py-2 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-xl hover:bg-red-100 whitespace-nowrap"
          >
            Reset Local Data
          </button>
        </div>
      </section>

      <ConfirmModal
        isOpen={confirmReset}
        title="Clear All Local Inventory Data?"
        message="This permanently deletes all products, serial numbers, transactions, customers, suppliers, and technicians from this device and resets default categories. Export a JSON backup first if you need to keep these records."
        confirmLabel="Yes, Clear Everything"
        danger
        onConfirm={async () => {
          await clearAllData();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};
