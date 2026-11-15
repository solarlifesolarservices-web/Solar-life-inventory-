import React, { useMemo, useState } from 'react';
import { Check, Plus, QrCode, Trash2, AlertCircle } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getTodayISO, normalizeSerial } from '../db/constants';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

export const AddStockScreen: React.FC = () => {
  const { snapshot, addStockInward, navigate } = useInventory();
  const categories = snapshot?.categories ?? [];
  const products = snapshot?.products ?? [];
  const suppliers = snapshot?.suppliers ?? [];
  const existingSerialSet = useMemo(
    () => new Set((snapshot?.serialItems ?? []).map((s) => s.serial_number)),
    [snapshot?.serialItems]
  );

  const [categoryId, setCategoryId] = useState<string>(
    categories[0]?.id ?? 'cat-solar-panels'
  );
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minStockLevel, setMinStockLevel] = useState(
    String(snapshot?.settings.default_low_stock_threshold ?? 5)
  );
  const [quantity, setQuantity] = useState('1');
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [singleSerialInput, setSingleSerialInput] = useState('');
  const [bulkSerialText, setBulkSerialText] = useState('');
  const [showBulkBox, setShowBulkBox] = useState(false);

  const [supplierName, setSupplierName] = useState('');
  const [supplierMobile, setSupplierMobile] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayISO());
  const [purchasePrice, setPurchasePrice] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [serialWarning, setSerialWarning] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? categories[0];

  const categoryProducts = useMemo(
    () => products.filter((p) => p.category_id === categoryId),
    [products, categoryId]
  );

  const handleSelectExistingProduct = (prodId: string) => {
    const found = products.find((p) => p.id === prodId);
    if (!found) return;
    setProductName(found.name);
    setBrand(found.brand);
    setModel(found.model);
    setUnit(found.unit);
    setMinStockLevel(String(found.min_stock_level));
  };

  const addSerialToList = (raw: string) => {
    const sn = normalizeSerial(raw);
    if (!sn) return;
    setSerialWarning(null);

    if (serialNumbers.includes(sn)) {
      setSerialWarning(`"${sn}" is already in this inward list.`);
      return;
    }
    if (existingSerialSet.has(sn)) {
      setSerialWarning(`"${sn}" already exists in the database. Duplicate serials are not allowed.`);
      return;
    }

    const updated = [...serialNumbers, sn];
    setSerialNumbers(updated);
    // Helpful auto-sync if user hasn't typed a larger quantity
    const qtyNum = Number(quantity) || 0;
    if (updated.length > qtyNum) {
      setQuantity(String(updated.length));
    }
  };

  const handleAddSingleSerial = () => {
    if (!singleSerialInput.trim()) return;
    addSerialToList(singleSerialInput);
    setSingleSerialInput('');
  };

  const handleImportBulkSerials = () => {
    const tokens = bulkSerialText
      .split(/[\n,;]+/)
      .map(normalizeSerial)
      .filter(Boolean);

    const added: string[] = [...serialNumbers];
    const skipped: string[] = [];

    for (const token of tokens) {
      if (added.includes(token) || existingSerialSet.has(token)) {
        skipped.push(token);
      } else {
        added.push(token);
      }
    }

    setSerialNumbers(added);
    if (added.length > (Number(quantity) || 0)) {
      setQuantity(String(added.length));
    }
    setBulkSerialText('');
    setShowBulkBox(false);
    if (skipped.length > 0) {
      setSerialWarning(`Skipped ${skipped.length} duplicate serial(s): ${skipped.slice(0, 3).join(', ')}`);
    }
  };

  const removeSerial = (sn: string) => {
    setSerialNumbers((prev) => prev.filter((item) => item !== sn));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await addStockInward({
        category_id: categoryId,
        product_name: productName,
        brand,
        model,
        unit,
        min_stock_level: Number(minStockLevel) || 5,
        quantity: Number(quantity) || 0,
        serial_numbers: serialNumbers,
        supplier_name: supplierName,
        supplier_mobile: supplierMobile,
        purchase_date: purchaseDate,
        purchase_price: Number(purchasePrice) || 0,
        invoice_number: invoiceNumber,
        remarks,
      });
      navigate('inventory');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save stock inward entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Add Stock (Inward)</h1>
          <p className="text-sm text-slate-600">
            Receive new solar materials and register serial numbers
          </p>
        </div>
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
        {/* Product Details Card */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-blue-900">1. Product Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Product Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                    {cat.requires_serial ? ' (Serial Required)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {categoryProducts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Quick-Fill Existing Product (Optional)
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => handleSelectExistingProduct(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                >
                  <option value="">-- Enter new or select existing --</option>
                  {categoryProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.brand} {p.model}) · Stock: {p.available_qty}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. 550W Mono PERC Solar Panel"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Brand *
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Waaree, Adani, Growatt, Luminous"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. WS-550 / MIN 5000TL-X"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Qty *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Unit
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pcs / m"
                  className="w-full min-h-[44px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Min Alert
                </label>
                <input
                  type="number"
                  min={0}
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Serial Numbers Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-blue-900">
                2. Serial Numbers{' '}
                {selectedCategory?.requires_serial ? '(Required for this category)' : '(Optional)'}
              </h2>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                Entered {serialNumbers.length} of {Number(quantity) || 0} units
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBulkBox((v) => !v)}
                className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                {showBulkBox ? 'Hide Bulk Paste' : 'Bulk Paste'}
              </button>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="min-h-[44px] px-3.5 py-2 text-xs font-semibold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                Scan Barcode / QR
              </button>
            </div>
          </div>

          {serialWarning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
              {serialWarning}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={singleSerialInput}
              onChange={(e) => setSingleSerialInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSingleSerial();
                }
              }}
              placeholder="Enter serial number & tap Add"
              className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <button
              type="button"
              onClick={handleAddSingleSerial}
              className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {showBulkBox && (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                Paste multiple serial numbers (one per line or comma-separated)
              </label>
              <textarea
                rows={4}
                value={bulkSerialText}
                onChange={(e) => setBulkSerialText(e.target.value)}
                placeholder={'SL-PNL-001\nSL-PNL-002\nSL-PNL-003'}
                className="w-full p-3 text-sm font-mono uppercase bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleImportBulkSerials}
                  className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-xl hover:bg-blue-800"
                >
                  Import Serials
                </button>
              </div>
            </div>
          )}

          {serialNumbers.length > 0 && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {serialNumbers.map((sn, idx) => (
                <div
                  key={sn}
                  className="px-3.5 py-2 flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-mono tabular-nums text-slate-400 w-6">
                      #{idx + 1}
                    </span>
                    <span className="font-mono font-medium text-slate-900 truncate">{sn}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSerial(sn)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                    aria-label={`Remove serial ${sn}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Supplier & Invoice Card */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-blue-900">3. Supplier &amp; Purchase Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Supplier Name *
              </label>
              <input
                type="text"
                required
                list="supplier-suggestions"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  const match = suppliers.find(
                    (s) => s.name.toLowerCase() === e.target.value.toLowerCase()
                  );
                  if (match && match.mobile) setSupplierMobile(match.mobile);
                }}
                placeholder="e.g. SunPeak Distributors"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              <datalist id="supplier-suggestions">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Supplier Mobile (Optional)
              </label>
              <input
                type="tel"
                value={supplierMobile}
                onChange={(e) => setSupplierMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Purchase Date *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Purchase Price (Per Unit, {snapshot?.settings.currency_symbol ?? '₹'})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-041"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Batch notes, condition, etc."
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
            <Check className="w-4 h-4" />
            {submitting ? 'Saving Stock...' : 'Save Stock Inward'}
          </button>
        </div>
      </form>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        title="Scan Inward Serial Numbers"
        multiScan
        existingSerials={serialNumbers}
        onScan={addSerialToList}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
};
