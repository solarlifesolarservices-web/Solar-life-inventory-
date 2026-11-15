import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Cpu,
  Layers,
  Package,
  Plus,
  QrCode,
  Sun,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getTodayISO } from '../db/constants';
import { EmptyState, TransactionTypeLabel } from '../components/UiPrimitives';

export const DashboardScreen: React.FC = () => {
  const { snapshot, navigate } = useInventory();

  const metrics = useMemo(() => {
    if (!snapshot) {
      return {
        totalProducts: 0,
        totalAvailableStock: 0,
        solarPanelStock: 0,
        inverterStock: 0,
        todayInwardCount: 0,
        todayInwardUnits: 0,
        todayOutwardCount: 0,
        todayOutwardUnits: 0,
        lowStockProducts: [],
        recentTransactions: [],
      };
    }

    const today = getTodayISO();
    const totalProducts = snapshot.products.length;
    const totalAvailableStock = snapshot.products.reduce((sum, p) => sum + p.available_qty, 0);

    const solarPanelStock = snapshot.products
      .filter((p) => p.category_name.toLowerCase().includes('panel'))
      .reduce((sum, p) => sum + p.available_qty, 0);

    const inverterStock = snapshot.products
      .filter((p) => p.category_name.toLowerCase().includes('inverter'))
      .reduce((sum, p) => sum + p.available_qty, 0);

    const todayInward = snapshot.transactions.filter(
      (t) => t.type === 'INWARD' && t.transaction_date === today
    );
    const todayOutward = snapshot.transactions.filter(
      (t) => t.type === 'OUTWARD' && t.transaction_date === today
    );

    const lowStockProducts = snapshot.products.filter(
      (p) => p.available_qty <= p.min_stock_level
    );

    return {
      totalProducts,
      totalAvailableStock,
      solarPanelStock,
      inverterStock,
      todayInwardCount: todayInward.length,
      todayInwardUnits: todayInward.reduce((s, t) => s + t.quantity, 0),
      todayOutwardCount: todayOutward.length,
      todayOutwardUnits: todayOutward.reduce((s, t) => s + t.quantity, 0),
      lowStockProducts,
      recentTransactions: snapshot.transactions.slice(0, 8),
    };
  }, [snapshot]);

  return (
    <div className="space-y-6">
      {/* Primary Hero Banner + Quick Actions */}
      <section className="bg-blue-900 text-white rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-300">
              {snapshot?.settings.business_name || 'SOLAR LIFE'} · {snapshot?.settings.tagline || 'Solar Services'}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Warehouse &amp; Field Stock Overview
            </h1>
            <p className="text-sm text-blue-100">
              Offline local inventory · Every panel and inverter tracked by serial number
            </p>
          </div>
          <div className="grid grid-cols-3 sm:flex gap-2">
            <button
              type="button"
              onClick={() => navigate('add-stock')}
              className="min-h-[44px] px-3.5 py-2 bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl hover:bg-amber-300 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Add Stock
            </button>
            <button
              type="button"
              onClick={() => navigate('issue-stock')}
              className="min-h-[44px] px-3.5 py-2 bg-white text-blue-950 font-semibold text-xs sm:text-sm rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <ArrowUpRight className="w-4 h-4 shrink-0" />
              Issue
            </button>
            <button
              type="button"
              onClick={() => navigate('scan-serial')}
              className="min-h-[44px] px-3.5 py-2 bg-blue-800 text-white border border-blue-700 font-semibold text-xs sm:text-sm rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <QrCode className="w-4 h-4 shrink-0 text-amber-300" />
              Scan
            </button>
          </div>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section aria-label="Stock summary metrics" className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => navigate('inventory')}
          className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Products</span>
            <Layers className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.totalProducts}
          </p>
          <p className="text-xs text-slate-500 mt-1">Active SKUs in catalog</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('inventory')}
          className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Available Stock</span>
            <Package className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.totalAvailableStock}
          </p>
          <p className="text-xs text-slate-500 mt-1">Usable units (excl. damaged)</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('inventory', { filter: 'Solar Panels' })}
          className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Solar Panel Stock</span>
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-blue-900">
            {metrics.solarPanelStock}
          </p>
          <p className="text-xs text-slate-500 mt-1">Panels ready to issue</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('inventory', { filter: 'Solar Inverters' })}
          className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Inverter Stock</span>
            <Cpu className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-blue-900">
            {metrics.inverterStock}
          </p>
          <p className="text-xs text-slate-500 mt-1">Inverters ready to issue</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('reports')}
          className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Today&apos;s Inward</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700">
            +{metrics.todayInwardUnits}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {metrics.todayInwardCount} {metrics.todayInwardCount === 1 ? 'entry' : 'entries'} today
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('reports')}
          className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Today&apos;s Outward</span>
            <ArrowUpRight className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-blue-700">
            -{metrics.todayOutwardUnits}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {metrics.todayOutwardCount} {metrics.todayOutwardCount === 1 ? 'issue' : 'issues'} today
          </p>
        </button>
      </section>

      {/* Two-Column Detail Workspace on Desktop, Stacked on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low-Stock Alerts */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">Low-Stock Alerts</h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {metrics.lowStockProducts.length} flagged
            </span>
          </div>

          {metrics.lowStockProducts.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {metrics.totalProducts === 0
                ? 'No products added yet. Tap "Add Stock" to record incoming solar equipment.'
                : 'All products are above their minimum stock threshold.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.lowStockProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => navigate('inventory', { productId: product.id })}
                  className="w-full min-h-[56px] px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {product.category_name} · {product.brand}
                      {product.model ? ` · ${product.model}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono tabular-nums text-amber-700">
                        {product.available_qty} {product.unit}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        Min {product.min_stock_level}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
            <button
              type="button"
              onClick={() => navigate('reports')}
              className="text-xs font-semibold text-blue-700 hover:underline min-h-[36px] px-2"
            >
              View Ledger
            </button>
          </div>

          {metrics.recentTransactions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No Stock Movements Yet"
                description="Record your first solar panel or inverter purchase to start tracking stock and serial numbers."
                actionLabel="Add First Stock"
                onAction={() => navigate('add-stock')}
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3"
                >
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
                      {tx.party_name || 'Warehouse'}
                      {tx.serial_numbers.length > 0
                        ? ` · ${tx.serial_numbers.length} serial(s)`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-bold font-mono tabular-nums ${
                        tx.type === 'INWARD' || tx.type === 'RESTORE_STOCK'
                          ? 'text-emerald-700'
                          : tx.type === 'DAMAGED'
                            ? 'text-red-700'
                            : 'text-blue-700'
                      }`}
                    >
                      {tx.type === 'INWARD' || tx.type === 'RESTORE_STOCK' ? '+' : '-'}
                      {tx.quantity}
                    </p>
                    {tx.serial_numbers.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate('scan-serial', { serialQuery: tx.serial_numbers[0] })
                        }
                        className="text-[11px] font-mono text-blue-700 hover:underline"
                      >
                        {tx.serial_numbers[0]}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
