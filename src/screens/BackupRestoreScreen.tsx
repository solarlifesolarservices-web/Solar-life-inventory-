import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Database,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getTodayISO } from '../db/constants';
import { BackupPayload } from '../types/inventory';
import { buildCsvContent, downloadTextFile } from '../utils/csvExport';
import { ConfirmModal } from '../components/UiPrimitives';

export const BackupRestoreScreen: React.FC = () => {
  const { snapshot, db, exportBackup, restoreBackup, showToast } = useInventory();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteJson, setPasteJson] = useState('');
  const [busy, setBusy] = useState(false);

  const handleExportJson = async () => {
    setBusy(true);
    try {
      const payload = await exportBackup();
      const filename = `solar-life-backup-${getTodayISO()}.json`;
      const method = await downloadTextFile(
        filename,
        JSON.stringify(payload, null, 2),
        'application/json'
      );
      showToast(
        method === 'shared'
          ? `Shared backup ${filename}`
          : method === 'copied'
            ? 'Backup JSON copied to clipboard.'
            : `Backup exported as ${filename}`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyBackupJson = async () => {
    setBusy(true);
    try {
      const payload = await exportBackup();
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showToast('Full JSON backup copied to clipboard.');
    } catch {
      showToast('Could not access clipboard. Use Export All Data (.JSON) instead.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsvAll = async () => {
    if (!snapshot) return;
    const headers = [
      'Category',
      'Product Name',
      'Brand',
      'Model',
      'Available Qty',
      'Issued Qty',
      'Returned Qty',
      'Damaged Qty',
      'Min Stock Alert',
    ];
    const rows = snapshot.products.map((p) => [
      p.category_name,
      p.name,
      p.brand,
      p.model,
      p.available_qty,
      p.issued_qty,
      p.returned_qty,
      p.damaged_qty,
      p.min_stock_level,
    ]);
    const csv = buildCsvContent(headers, rows);
    await downloadTextFile(
      `solar-life-inventory-${getTodayISO()}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
    showToast('Inventory report exported to CSV.');
  };

  const parseAndStageBackup = (rawText: string) => {
    const parsed = JSON.parse(rawText) as BackupPayload;
    if (!parsed || parsed.app !== 'Solar Life Inventory' || !parsed.data) {
      throw new Error('This is not a valid Solar Life Inventory JSON backup.');
    }
    setPendingPayload(parsed);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      parseAndStageBackup(text);
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : 'Could not read the selected JSON backup file.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteRestore = () => {
    setRestoreError(null);
    try {
      parseAndStageBackup(pasteJson);
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : 'Invalid JSON backup text.'
      );
    }
  };

  const confirmRestore = async () => {
    if (!pendingPayload) return;
    setBusy(true);
    try {
      await restoreBackup(pendingPayload);
      setPendingPayload(null);
      setPasteMode(false);
      setPasteJson('');
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed.');
      setPendingPayload(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Backup &amp; Restore</h1>
        <p className="text-sm text-slate-600">
          Protect your offline solar inventory data with local JSON backups and CSV reports
        </p>
      </div>

      {/* Mandatory Data Safety Warning */}
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm text-amber-950">
          <p className="font-bold">Important Offline Data Warning</p>
          <p className="leading-relaxed">
            All inventory, serial numbers, customer issues, and transaction logs are stored locally
            on this device (
            {db.engineName === 'sqlite-capacitor'
              ? 'Android SQLite Database'
              : 'Local Persistent Browser Storage'}
            ).{' '}
            <strong>
              Uninstalling the app or clearing app data/storage in Android Settings will permanently
              delete all local records.
            </strong>{' '}
            Export a JSON backup regularly and keep a copy in Google Drive, WhatsApp, or your
            computer.
          </p>
        </div>
      </div>

      {/* Current Database Footprint */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">Local Database Summary</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Last backup:{' '}
            {snapshot?.settings.last_backup_at
              ? new Date(snapshot.settings.last_backup_at).toLocaleString()
              : 'Never'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500">Products</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {snapshot?.products.length ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500">Tracked Serials</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {snapshot?.serialItems.length ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500">Transactions</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {snapshot?.transactions.length ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500">Parties</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {(snapshot?.customers.length ?? 0) +
                (snapshot?.suppliers.length ?? 0) +
                (snapshot?.technicians.length ?? 0)}
            </p>
          </div>
        </div>
      </section>

      {/* Export & Restore Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-900">Export Full JSON Backup</h2>
            <p className="text-sm text-slate-600">
              Save or share every category, product, serial number, transaction history, customer,
              supplier, and technician as a portable JSON backup.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleExportJson}
              className="w-full min-h-[48px] px-4 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export / Share Backup (.JSON)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleCopyBackupJson}
              className="w-full min-h-[44px] px-4 py-2 bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-200 flex items-center justify-center gap-2"
            >
              <ClipboardCopy className="w-4 h-4" />
              Copy Backup JSON to Clipboard
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-900">Restore from JSON Backup</h2>
            <p className="text-sm text-slate-600">
              Select a previously exported Solar Life Inventory JSON file or paste backup JSON text.
              You will be asked to confirm before overwriting current data.
            </p>
            {restoreError && (
              <p className="text-xs font-medium text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {restoreError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[48px] px-4 py-2.5 bg-amber-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-amber-300 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Choose Backup File (.JSON)
            </button>
            <button
              type="button"
              onClick={() => setPasteMode((v) => !v)}
              className="w-full min-h-[44px] px-4 py-2 bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              {pasteMode ? 'Hide Paste JSON' : 'Paste Backup JSON Text'}
            </button>
          </div>
        </section>
      </div>

      {pasteMode && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <label className="block text-sm font-bold text-slate-900">
            Paste Solar Life Backup JSON
          </label>
          <textarea
            rows={5}
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            placeholder='{"version":1,"app":"Solar Life Inventory",...}'
            className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePasteRestore}
              className="min-h-[44px] px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800"
            >
              Validate &amp; Restore
            </button>
          </div>
        </section>
      )}

      {/* CSV Quick Export */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Export Inventory Report (CSV)</h2>
          </div>
          <p className="text-sm text-slate-600">
            Open your current stock counts in Excel or Google Sheets.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsvAll}
          className="min-h-[44px] px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 flex items-center justify-center gap-2 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Download CSV
        </button>
      </section>

      <ConfirmModal
        isOpen={Boolean(pendingPayload)}
        title="Overwrite Local Data with Backup?"
        message={
          pendingPayload
            ? `This will replace all current inventory records with the backup exported on ${new Date(
                pendingPayload.exported_at
              ).toLocaleString()} (${pendingPayload.data.products.length} products, ${
                pendingPayload.data.serial_items.length
              } serial numbers, ${pendingPayload.data.transactions.length} transactions). This action cannot be undone.`
            : ''
        }
        confirmLabel="Yes, Restore & Overwrite"
        danger
        onConfirm={confirmRestore}
        onCancel={() => setPendingPayload(null)}
      />
    </div>
  );
};
