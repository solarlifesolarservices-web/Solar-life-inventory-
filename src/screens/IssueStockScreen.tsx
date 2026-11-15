import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, QrCode, Search } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getTodayISO, normalizeSerial } from '../db/constants';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { EmptyState } from '../components/UiPrimitives';

export const IssueStockScreen: React.FC = () => {
  const { snapshot, screenParams, issueStockOutward, navigate } = useInventory();
  const products = useMemo(
    () => (snapshot?.products ?? []).filter((p) => p.available_qty > 0),
    [snapshot?.products]
  );
  const customers = snapshot?.customers ?? [];
  const technicians = snapshot?.technicians ?? [];

  const [selectedProductId, setSelectedProductId] = useState<string>(
    screenParams.productId || products[0]?.id || ''
  );
  const [quantity, setQuantity] = useState('1');
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [serialFilter, setSerialFilter] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [installationLocation, setInstallationLocation] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [issueDate, setIssueDate] = useState(getTodayISO());
  const [remarks, setRemarks] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  useEffect(() => {
    if (screenParams.productId && products.some((p) => p.id === screenParams.productId)) {
      setSelectedProductId(screenParams.productId);
    } else if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  }, [screenParams.productId, products, selectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  const availableSerials = useMemo(() => {
    if (!snapshot || !selectedProduct) return [];
    return snapshot.serialItems.filter(
      (s) => s.product_id === selectedProduct.id && s.status === 'In Stock'
    );
  }, [snapshot, selectedProduct]);

  const filteredSerials = useMemo(() => {
    const q = serialFilter.trim().toUpperCase();
    if (!q) return availableSerials;
    return availableSerials.filter((s) => s.serial_number.includes(q));
  }, [availableSerials, serialFilter]);

  const requiresSerialSelection = useMemo(() => {
    if (!snapshot || !selectedProduct) return false;
    const cat = snapshot.categories.find((c) => c.id === selectedProduct.category_id);
    return Boolean(cat?.requires_serial) || availableSerials.length > 0;
  }, [snapshot, selectedProduct, availableSerials.length]);

  const handleProductChange = (newId: string) => {
    setSelectedProductId(newId);
    setSelectedSerials([]);
    setSerialFilter('');
    setFormError(null);
    setScanNotice(null);
  };

  const toggleSerial = (sn: string) => {
    setFormError(null);
    setScanNotice(null);
    setSelectedSerials((prev) => {
      const next = prev.includes(sn) ? prev.filter((item) => item !== sn) : [...prev, sn];
      if (next.length > 0) {
        setQuantity(String(next.length));
      }
      return next;
    });
  };

  const handleScannedSerial = (raw: string) => {
    const sn = normalizeSerial(raw);
    setScanNotice(null);
    if (!selectedProduct) return;

    const match = availableSerials.find((s) => s.serial_number === sn);
    if (!match) {
      setScanNotice(
        `Serial "${sn}" is not available in stock for ${selectedProduct.name}.`
      );
      return;
    }
    if (selectedSerials.includes(sn)) {
      setScanNotice(`Serial "${sn}" is already selected.`);
      return;
    }
    const next = [...selectedSerials, sn];
    setSelectedSerials(next);
    setQuantity(String(next.length));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedProduct) {
      setFormError('Please select a product with available stock.');
      return;
    }

    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      setFormError('Quantity must be greater than 0.');
      return;
    }
    if (qty > selectedProduct.available_qty) {
      setFormError(
        `Cannot issue ${qty} units. Only ${selectedProduct.available_qty} available in stock.`
      );
      return;
    }

    setSubmitting(true);
    try {
      await issueStockOutward({
        product_id: selectedProduct.id,
        quantity: qty,
        serial_numbers: selectedSerials,
        customer_name: customerName,
        customer_mobile: customerMobile,
        installation_location: installationLocation,
        technician_name: technicianName,
        issue_date: issueDate,
        remarks,
      });
      navigate('inventory');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to issue stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (products.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-xl font-bold text-slate-900">Issue Stock (Outward)</h1>
        <EmptyState
          title="No Available Stock to Issue"
          description="Add incoming solar panels, inverters, or accessories first before issuing material to customers."
          actionLabel="Go to Add Stock"
          onAction={() => navigate('add-stock')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Issue Stock (Outward)</h1>
        <p className="text-sm text-slate-600">
          Assign solar materials and serial numbers to a customer installation
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product Selection */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-blue-900">1. Material Selection</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Product *
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.brand}
                    {p.model ? ` (${p.model})` : ''} · Available: {p.available_qty} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Brand
              </label>
              <input
                type="text"
                readOnly
                value={selectedProduct?.brand ?? ''}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Quantity to Issue * (Max: {selectedProduct?.available_qty ?? 0})
              </label>
              <input
                type="number"
                min={1}
                max={selectedProduct?.available_qty ?? 1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Serial Number Picker */}
          {requiresSerialSelection && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Select Serial Numbers ({selectedSerials.length} of {Number(quantity) || 0} selected)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tap serials below or scan labels with camera
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="min-h-[44px] px-3.5 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl hover:bg-amber-300 flex items-center gap-1.5"
                >
                  <QrCode className="w-4 h-4" />
                  Scan to Select
                </button>
              </div>

              {scanNotice && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                  {scanNotice}
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={serialFilter}
                  onChange={(e) => setSerialFilter(e.target.value)}
                  placeholder="Filter available serial numbers..."
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredSerials.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 text-center">
                    No matching In Stock serial numbers found.
                  </p>
                ) : (
                  filteredSerials.map((item) => {
                    const checked = selectedSerials.includes(item.serial_number);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSerial(item.serial_number)}
                        className={`w-full min-h-[48px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors ${
                          checked ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-semibold text-slate-900 truncate">
                            {item.serial_number}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            Received {item.purchase_date} · {item.supplier_name}
                          </p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-blue-700 border-blue-700 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checked && <Check className="w-4 h-4" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>

        {/* Customer & Installation Details */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-blue-900">2. Customer &amp; Installation Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Customer Name *
              </label>
              <input
                type="text"
                required
                list="customer-suggestions"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  const match = customers.find(
                    (c) => c.name.toLowerCase() === e.target.value.toLowerCase()
                  );
                  if (match) {
                    if (match.mobile) setCustomerMobile(match.mobile);
                    if (match.address) setInstallationLocation(match.address);
                  }
                }}
                placeholder="e.g. Rajesh Kumar"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              <datalist id="customer-suggestions">
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Customer Mobile
              </label>
              <input
                type="tel"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Installation Location *
              </label>
              <input
                type="text"
                required
                value={installationLocation}
                onChange={(e) => setInstallationLocation(e.target.value)}
                placeholder="Site address / city / project site"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Technician Name *
              </label>
              <input
                type="text"
                required
                list="technician-suggestions"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Lead technician on site"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              <datalist id="technician-suggestions">
                {technicians.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Issue Date *
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. 5kW rooftop system phase 1"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="min-h-[48px] px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[48px] px-6 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            {submitting ? 'Issuing Stock...' : 'Confirm & Issue Stock'}
          </button>
        </div>
      </form>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        title="Scan Serial Numbers to Issue"
        multiScan
        existingSerials={selectedSerials}
        onScan={handleScannedSerial}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
};
