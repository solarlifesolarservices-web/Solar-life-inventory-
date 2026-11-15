import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getTodayISO } from '../db/constants';
import { Product } from '../types/inventory';
import { EmptyState, StatusLabel, TransactionTypeLabel } from '../components/UiPrimitives';

export const InventoryScreen: React.FC = () => {
  const {
    snapshot,
    screenParams,
    navigate,
    recordReturnOrDamage,
    updateProductThreshold,
  } = useInventory();

  const categories = snapshot?.categories ?? [];
  const products = snapshot?.products ?? [];
  const serialItems = snapshot?.serialItems ?? [];
  const transactions = snapshot?.transactions ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(screenParams.filter || 'ALL');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const [tab, setTab] = useState<'stock' | 'returns' | 'history'>('stock');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    screenParams.productId || null
  );

  // Return / Damage Modal State
  const [actionProduct, setActionProduct] = useState<Product | null>(null);
  const [actionType, setActionType] = useState<'RETURN' | 'DAMAGED' | 'RESTORE_STOCK'>('RETURN');
  const [actionQty, setActionQty] = useState('1');
  const [actionSerials, setActionSerials] = useState<string[]>([]);
  const [actionDate, setActionDate] = useState(getTodayISO());
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Threshold edit state
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState('');

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category_name !== categoryFilter) return false;
      if (brandFilter !== 'ALL' && p.brand !== brandFilter) return false;
      if (!q) return true;
      const matchesProduct =
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.category_name.toLowerCase().includes(q);
      const matchesSerial = serialItems.some(
        (s) => s.product_id === p.id && s.serial_number.toLowerCase().includes(q)
      );
      return matchesProduct || matchesSerial;
    });
  }, [products, categoryFilter, brandFilter, searchQuery, serialItems]);

  const returnAndDamageHistory = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === 'RETURN' || t.type === 'DAMAGED' || t.type === 'RESTORE_STOCK'
      ),
    [transactions]
  );

  const eligibleSerialsForAction = useMemo(() => {
    if (!actionProduct) return [];
    return serialItems.filter((s) => {
      if (s.product_id !== actionProduct.id) return false;
      if (actionType === 'RETURN') return s.status === 'Issued' || s.status === 'Installed';
      if (actionType === 'DAMAGED')
        return s.status === 'In Stock' || s.status === 'Returned' || s.status === 'Issued';
      if (actionType === 'RESTORE_STOCK')
        return s.status === 'Returned' || s.status === 'Damaged';
      return false;
    });
  }, [actionProduct, actionType, serialItems]);

  const openReturnDamageModal = (
    product: Product,
    defaultAction: 'RETURN' | 'DAMAGED' | 'RESTORE_STOCK'
  ) => {
    setActionProduct(product);
    setActionType(defaultAction);
    setActionQty('1');
    setActionSerials([]);
    setActionDate(getTodayISO());
    setActionRemarks('');
    setActionError(null);
  };

  const toggleActionSerial = (sn: string) => {
    setActionSerials((prev) => {
      const next = prev.includes(sn) ? prev.filter((item) => item !== sn) : [...prev, sn];
      if (next.length > 0) setActionQty(String(next.length));
      return next;
    });
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionProduct) return;
    setActionError(null);
    setActionBusy(true);
    try {
      await recordReturnOrDamage({
        product_id: actionProduct.id,
        action: actionType,
        quantity: Number(actionQty) || 0,
        serial_numbers: actionSerials,
        action_date: actionDate,
        remarks: actionRemarks,
      });
      setActionProduct(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to record update.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory &amp; Stock Control</h1>
          <p className="text-sm text-slate-600">
            Search stock, inspect serials, and handle returns or damaged units
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('add-stock')}
            className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Stock
          </button>
        </div>
      </div>

      {/* Interactive View Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setTab('stock')}
          className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            tab === 'stock'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Current Stock ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('returns')}
          className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            tab === 'returns'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Returns &amp; Damaged ({returnAndDamageHistory.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            tab === 'history'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Movements ({transactions.length})
        </button>
      </div>

      {tab === 'stock' && (
        <>
          {/* Search & Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product, brand, model, or serial..."
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            >
              <option value="ALL">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState
              title="No Matching Products"
              description={
                products.length === 0
                  ? 'Your warehouse inventory is empty. Record your first purchase to begin.'
                  : 'Try clearing your search or category/brand filters.'
              }
              actionLabel={products.length === 0 ? 'Add Stock' : undefined}
              onAction={products.length === 0 ? () => navigate('add-stock') : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => {
                const isExpanded = expandedProductId === product.id;
                const isLow = product.available_qty <= product.min_stock_level;
                const productSerials = serialItems.filter((s) => s.product_id === product.id);

                return (
                  <div
                    key={product.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                  >
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-blue-800">{product.category_name}</span>
                          <span aria-hidden="true">·</span>
                          <span>{product.brand}</span>
                          {product.model && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{product.model}</span>
                            </>
                          )}
                          {isLow && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Low Stock
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {product.name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="grid grid-cols-4 gap-3 text-center">
                          <div>
                            <p className="text-[11px] text-slate-500">Available</p>
                            <p
                              className={`text-base font-bold font-mono tabular-nums ${
                                isLow ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {product.available_qty}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500">Issued</p>
                            <p className="text-base font-bold font-mono tabular-nums text-blue-700">
                              {product.issued_qty}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500">Returned</p>
                            <p className="text-base font-bold font-mono tabular-nums text-amber-700">
                              {product.returned_qty}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500">Damaged</p>
                            <p className="text-base font-bold font-mono tabular-nums text-red-700">
                              {product.damaged_qty}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProductId(isExpanded ? null : product.id)
                          }
                          className="min-h-[44px] px-3.5 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 flex items-center gap-1.5"
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/70 space-y-4">
                        {/* Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            {product.available_qty > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate('issue-stock', { productId: product.id })
                                }
                                className="min-h-[40px] px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-xl hover:bg-blue-800 flex items-center gap-1.5"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Issue Material
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openReturnDamageModal(product, 'RETURN')}
                              className="min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                              Record Return
                            </button>
                            <button
                              type="button"
                              onClick={() => openReturnDamageModal(product, 'DAMAGED')}
                              className="min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 flex items-center gap-1.5"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                              Mark Damaged
                            </button>
                            {product.returned_qty > 0 && (
                              <button
                                type="button"
                                onClick={() => openReturnDamageModal(product, 'RESTORE_STOCK')}
                                className="min-h-[40px] px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800"
                              >
                                Restore to Usable Stock
                              </button>
                            )}
                          </div>

                          {/* Min Stock Threshold Inline Control */}
                          <div className="flex items-center gap-2 text-xs">
                            {editingThresholdId === product.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  value={thresholdInput}
                                  onChange={(e) => setThresholdInput(e.target.value)}
                                  className="w-16 min-h-[36px] px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateProductThreshold(
                                      product.id,
                                      Number(thresholdInput) || 0
                                    );
                                    setEditingThresholdId(null);
                                  }}
                                  className="min-h-[36px] px-2.5 bg-blue-700 text-white rounded-lg font-semibold"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingThresholdId(product.id);
                                  setThresholdInput(String(product.min_stock_level));
                                }}
                                className="text-slate-600 hover:text-blue-700 underline font-mono"
                              >
                                Alert below {product.min_stock_level} {product.unit}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Serial Numbers Table */}
                        {productSerials.length > 0 ? (
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                              <span>Tracked Serial Numbers ({productSerials.length})</span>
                              <span>Tap any serial for full history</span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                              {productSerials.map((sn) => (
                                <button
                                  key={sn.id}
                                  type="button"
                                  onClick={() =>
                                    navigate('scan-serial', { serialQuery: sn.serial_number })
                                  }
                                  className="w-full min-h-[48px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-mono font-semibold text-blue-900 truncate">
                                      {sn.serial_number}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                      {sn.customer_name
                                        ? `Customer: ${sn.customer_name} · ${sn.installation_location}`
                                        : `Supplier: ${sn.supplier_name} · ${sn.purchase_date}`}
                                    </p>
                                  </div>
                                  <StatusLabel status={sn.status} />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Bulk quantity item (no individual serial numbers attached).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'returns' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
            Damaged stock is automatically excluded from Available Stock. Use{' '}
            <strong>Details → Record Return / Mark Damaged / Restore to Usable Stock</strong> on
            any product or scan an individual serial number.
          </div>

          {returnAndDamageHistory.length === 0 ? (
            <EmptyState
              title="No Returns or Damaged Records"
              description="Returned materials and damaged items logged from installations or warehouse inspections will appear here."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {returnAndDamageHistory.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <TransactionTypeLabel type={tx.type} />
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {tx.transaction_date}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {tx.product_name} ({tx.brand})
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {tx.remarks || 'No remarks'}
                      {tx.serial_numbers.length > 0
                        ? ` · Serials: ${tx.serial_numbers.join(', ')}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900 shrink-0">
                    {tx.quantity} units
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No stock movements recorded yet.
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <TransactionTypeLabel type={tx.type} />
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {tx.transaction_date}
                    </span>
                    {tx.reference_number && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-mono text-slate-500">
                          Ref {tx.reference_number}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {tx.product_name} · {tx.brand}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {tx.party_name || 'Warehouse'}
                    {tx.location ? ` · ${tx.location}` : ''}
                    {tx.technician_name ? ` · Tech: ${tx.technician_name}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {tx.quantity}
                  </p>
                  {tx.serial_numbers.length > 0 && (
                    <p className="text-[11px] font-mono text-blue-700">
                      {tx.serial_numbers.length} SN
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Return / Damage / Restore Modal */}
      {actionProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {actionType === 'RETURN'
                    ? 'Record Returned Material'
                    : actionType === 'DAMAGED'
                      ? 'Mark Material as Damaged'
                      : 'Return Inspected Stock to Usable'}
                </h2>
                <p className="text-xs text-slate-500">{actionProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setActionProduct(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) => {
                    setActionType(e.target.value as typeof actionType);
                    setActionSerials([]);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="RETURN">Record Returned Material (Issued → Returned)</option>
                  <option value="DAMAGED">Mark as Damaged (Excludes from Available Stock)</option>
                  <option value="RESTORE_STOCK">
                    Restore Inspected Material to Usable Stock (Returned → In Stock)
                  </option>
                </select>
              </div>

              {eligibleSerialsForAction.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Affected Serial Numbers ({actionSerials.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {eligibleSerialsForAction.map((sn) => {
                      const checked = actionSerials.includes(sn.serial_number);
                      return (
                        <button
                          key={sn.id}
                          type="button"
                          onClick={() => toggleActionSerial(sn.serial_number)}
                          className={`w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between text-left text-xs ${
                            checked ? 'bg-blue-50 font-semibold' : ''
                          }`}
                        >
                          <span className="font-mono">{sn.serial_number}</span>
                          <StatusLabel status={sn.status} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={actionQty}
                    onChange={(e) => setActionQty(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Inspection / Condition Remarks *
                </label>
                <input
                  type="text"
                  required
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  placeholder="Reason for return, damage note, or inspection pass"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionProduct(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="min-h-[44px] px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-50"
                >
                  {actionBusy ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
