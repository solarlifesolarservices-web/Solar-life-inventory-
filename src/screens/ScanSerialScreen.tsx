import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  History,
  MapPin,
  Package,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  User,
  Wrench,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getTodayISO, normalizeSerial } from '../db/constants';
import { SerialSearchResult, SerialStatus } from '../types/inventory';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { StatusLabel, TransactionTypeLabel } from '../components/UiPrimitives';

export const ScanSerialScreen: React.FC = () => {
  const { snapshot, screenParams, searchSerial, updateSerialStatus } = useInventory();
  const [query, setQuery] = useState(screenParams.serialQuery ?? '');
  const [result, setResult] = useState<SerialSearchResult | null>(null);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (raw: string) => {
      const sn = normalizeSerial(raw);
      setQuery(sn);
      setStatusError(null);
      if (!sn) {
        setResult(null);
        setSearchedOnce(false);
        return;
      }
      const found = await searchSerial(sn);
      setResult(found);
      setSearchedOnce(true);
    },
    [searchSerial]
  );

  useEffect(() => {
    if (screenParams.serialQuery) {
      runSearch(screenParams.serialQuery);
    }
  }, [screenParams.serialQuery, runSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const handleStatusChange = async (newStatus: SerialStatus) => {
    if (!result) return;
    setStatusError(null);
    setUpdatingStatus(true);
    try {
      const updated = await updateSerialStatus({
        serialNumber: result.item.serial_number,
        newStatus,
        remarks:
          statusNote.trim() || `Status changed to ${newStatus} via Serial Lookup`,
        actionDate: getTodayISO(),
      });
      setResult(updated);
      setStatusNote('');
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const recentSerials = (snapshot?.serialItems ?? []).slice(0, 8);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Serial Number Tracking</h1>
        <p className="text-sm text-slate-600">
          Scan or search any panel or inverter serial number for complete lifecycle history
        </p>
      </div>

      {/* Search & Scan Bar */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter serial number (e.g. SL-PNL-001)"
              className="w-full min-h-[48px] pl-10 pr-3.5 py-2 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 sm:flex-initial min-h-[48px] px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2 bg-amber-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-amber-300 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <QrCode className="w-4 h-4" />
              Scan Camera
            </button>
          </div>
        </div>

        {recentSerials.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
            <span>Quick lookup:</span>
            {recentSerials.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => runSearch(item.serial_number)}
                className="font-mono text-blue-700 hover:underline px-1.5 py-0.5 rounded bg-blue-50"
              >
                {item.serial_number}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Not Found State */}
      {searchedOnce && !result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2">
          <Package className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Serial Number Not Found</h2>
          <p className="text-sm text-slate-600">
            No solar panel, inverter, or component matches{' '}
            <span className="font-mono font-semibold text-slate-900">{query}</span>.
          </p>
        </div>
      )}

      {/* Found Serial Detail */}
      {result && (
        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-blue-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-amber-300 font-medium">{result.item.category_name}</p>
                <h2 className="text-lg sm:text-xl font-bold font-mono tracking-tight">
                  {result.item.serial_number}
                </h2>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-xl">
                <StatusLabel status={result.item.status} />
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Product Name</p>
                <p className="font-semibold text-slate-900">{result.item.product_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Brand &amp; Model</p>
                <p className="font-semibold text-slate-900">
                  {result.item.brand}
                  {result.item.model ? ` · ${result.item.model}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Received Date</p>
                <p className="font-mono tabular-nums text-slate-900">
                  {result.item.purchase_date || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Supplier &amp; Invoice</p>
                <p className="text-slate-900">
                  {result.item.supplier_name || '—'}
                  {result.item.invoice_number ? ` · ${result.item.invoice_number}` : ''}
                </p>
              </div>

              <div className="sm:col-span-2 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Customer</p>
                    <p className="font-semibold text-slate-900">
                      {result.item.customer_name || 'Not issued yet'}
                    </p>
                    {result.item.customer_mobile && (
                      <p className="text-xs font-mono text-slate-600">
                        {result.item.customer_mobile}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Installation Location</p>
                    <p className="font-semibold text-slate-900">
                      {result.item.installation_location || 'In Warehouse'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Wrench className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Technician</p>
                    <p className="font-semibold text-slate-900">
                      {result.item.technician_name || '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Issue Date</p>
                  <p className="font-mono tabular-nums font-semibold text-slate-900">
                    {result.item.issue_date || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Lifecycle Status Actions */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-700">Update Serial Status</p>

              {statusError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                  {statusError}
                </div>
              )}

              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Optional note (e.g. Installed on rooftop, glass cracked, tested OK)..."
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <div className="flex flex-wrap gap-2">
                {result.item.status === 'Issued' && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('Installed')}
                    className="min-h-[44px] px-4 py-2 bg-indigo-700 text-white text-xs font-semibold rounded-xl hover:bg-indigo-800 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Installed
                  </button>
                )}

                {(result.item.status === 'Issued' || result.item.status === 'Installed') && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('Returned')}
                    className="min-h-[44px] px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl hover:bg-amber-300 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Mark Returned
                  </button>
                )}

                {(result.item.status === 'Returned' || result.item.status === 'Damaged') && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('In Stock')}
                    className="min-h-[44px] px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Return to Usable Stock
                  </button>
                )}

                {result.item.status !== 'Damaged' && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('Damaged')}
                    className="min-h-[44px] px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Mark Damaged
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Complete Transaction History */}
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-700" />
              <h3 className="text-base font-bold text-slate-900">
                Complete Transaction History ({result.history.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {result.history.map((event) => (
                <div key={event.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TransactionTypeLabel type={event.event_type} />
                      <span className="text-xs text-slate-500">
                        {event.status_from ? `${event.status_from} → ` : ''}
                        <strong>{event.status_to}</strong>
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {event.event_date}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800">{event.remarks}</p>
                  <p className="text-xs text-slate-500">
                    {event.party_name ? `Party: ${event.party_name}` : ''}
                    {event.location ? ` · Site: ${event.location}` : ''}
                    {event.technician_name ? ` · Tech: ${event.technician_name}` : ''}
                    {event.reference_number ? ` · Ref: ${event.reference_number}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={scannerOpen}
        title="Scan Serial Number Label"
        onScan={(sn) => runSearch(sn)}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
};
