import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getTodayISO } from '../db/constants';
import { buildCsvContent, downloadTextFile } from '../utils/csvExport';
import { StatusLabel, TransactionTypeLabel } from '../components/UiPrimitives';

export const ReportsScreen: React.FC = () => {
  const { snapshot, showToast } = useInventory();
  const products = snapshot?.products ?? [];
  const serialItems = snapshot?.serialItems ?? [];
  const transactions = snapshot?.transactions ?? [];

  const [reportTab, setReportTab] = useState<'summary' | 'serials' | 'ledger'>('summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (dateFrom && t.transaction_date < dateFrom) return false;
      if (dateTo && t.transaction_date > dateTo) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo]);

  const exportInventorySummaryCsv = async () => {
    try {
      const headers = [
        'Category',
        'Product Name',
        'Brand',
        'Model',
        'Unit',
        'Available Qty',
        'Issued Qty',
        'Returned Qty',
        'Damaged Qty',
        'Min Alert Level',
        'Low Stock Flag',
      ];
      const rows = products.map((p) => [
        p.category_name,
        p.name,
        p.brand,
        p.model,
        p.unit,
        p.available_qty,
        p.issued_qty,
        p.returned_qty,
        p.damaged_qty,
        p.min_stock_level,
        p.available_qty <= p.min_stock_level ? 'LOW' : 'OK',
      ]);
      const csv = buildCsvContent(headers, rows);
      await downloadTextFile(
        `solar-life-stock-summary-${getTodayISO()}.csv`,
        csv,
        'text/csv;charset=utf-8;'
      );
      showToast('Stock summary CSV exported.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed.', 'error');
    }
  };

  const exportSerialsCsv = async () => {
    try {
      const headers = [
        'Serial Number',
        'Category',
        'Product Name',
        'Brand',
        'Model',
        'Status',
        'Supplier',
        'Purchase Date',
        'Purchase Price',
        'Invoice Number',
        'Customer',
        'Customer Mobile',
        'Installation Location',
        'Technician',
        'Issue Date',
        'Remarks',
      ];
      const rows = serialItems.map((s) => [
        s.serial_number,
        s.category_name,
        s.product_name,
        s.brand,
        s.model,
        s.status,
        s.supplier_name,
        s.purchase_date,
        s.purchase_price,
        s.invoice_number,
        s.customer_name,
        s.customer_mobile,
        s.installation_location,
        s.technician_name,
        s.issue_date,
        s.remarks,
      ]);
      const csv = buildCsvContent(headers, rows);
      await downloadTextFile(
        `solar-life-serials-${getTodayISO()}.csv`,
        csv,
        'text/csv;charset=utf-8;'
      );
      showToast('Serial registry CSV exported.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed.', 'error');
    }
  };

  const exportTransactionsCsv = async () => {
    try {
      const headers = [
        'Date',
        'Type',
        'Category',
        'Product',
        'Brand',
        'Model',
        'Quantity',
        'Serial Numbers',
        'Party (Supplier/Customer)',
        'Mobile',
        'Location',
        'Technician',
        'Reference/Invoice',
        'Unit Price',
        'Remarks',
      ];
      const rows = filteredTransactions.map((t) => [
        t.transaction_date,
        t.type,
        t.category_name,
        t.product_name,
        t.brand,
        t.model,
        t.quantity,
        t.serial_numbers.join(' | '),
        t.party_name,
        t.party_mobile,
        t.location,
        t.technician_name,
        t.reference_number,
        t.unit_price,
        t.remarks,
      ]);
      const csv = buildCsvContent(headers, rows);
      await downloadTextFile(
        `solar-life-transactions-${getTodayISO()}.csv`,
        csv,
        'text/csv;charset=utf-8;'
      );
      showToast('Transaction ledger CSV exported.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports &amp; CSV Exports</h1>
          <p className="text-sm text-slate-600">
            Stock valuation, serial registry, and daily inward/outward reports
          </p>
        </div>
        <button
          type="button"
          onClick={
            reportTab === 'summary'
              ? exportInventorySummaryCsv
              : reportTab === 'serials'
                ? exportSerialsCsv
                : exportTransactionsCsv
          }
          className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Current Report CSV
        </button>
      </div>

      {/* Quick Export Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={exportInventorySummaryCsv}
          className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-blue-300 transition-colors flex items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">Stock Summary CSV</p>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              {products.length} products
            </p>
          </div>
          <FileSpreadsheet className="w-5 h-5 text-blue-700 shrink-0" />
        </button>

        <button
          type="button"
          onClick={exportSerialsCsv}
          className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-blue-300 transition-colors flex items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">Serial Registry CSV</p>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              {serialItems.length} tracked units
            </p>
          </div>
          <FileSpreadsheet className="w-5 h-5 text-blue-700 shrink-0" />
        </button>

        <button
          type="button"
          onClick={exportTransactionsCsv}
          className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-blue-300 transition-colors flex items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">Transaction Ledger CSV</p>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              {filteredTransactions.length} movements
            </p>
          </div>
          <FileSpreadsheet className="w-5 h-5 text-blue-700 shrink-0" />
        </button>
      </div>

      {/* Report Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setReportTab('summary')}
          className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            reportTab === 'summary' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Stock Summary
        </button>
        <button
          type="button"
          onClick={() => setReportTab('serials')}
          className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            reportTab === 'serials' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Serial Registry
        </button>
        <button
          type="button"
          onClick={() => setReportTab('ledger')}
          className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            reportTab === 'ledger' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Movement Ledger
        </button>
      </div>

      {reportTab === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>
        </div>
      )}

      {reportTab === 'summary' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold text-right">Available</th>
                <th className="py-3 px-4 font-semibold text-right">Issued</th>
                <th className="py-3 px-4 font-semibold text-right">Damaged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No inventory products recorded yet.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.brand} {p.model}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{p.category_name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                      {p.available_qty}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-700">
                      {p.issued_qty}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700">
                      {p.damaged_qty}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {reportTab === 'serials' && (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {serialItems.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No serialized panels or inverters recorded yet.
            </p>
          ) : (
            serialItems.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-mono font-bold text-blue-900 truncate">
                    {s.serial_number}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    {s.product_name} ({s.brand})
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {s.customer_name
                      ? `Issued to ${s.customer_name} (${s.issue_date})`
                      : `Supplier: ${s.supplier_name} (${s.purchase_date})`}
                  </p>
                </div>
                <StatusLabel status={s.status} />
              </div>
            ))
          )}
        </div>
      )}

      {reportTab === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {filteredTransactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No transactions match the selected date range.
            </p>
          ) : (
            filteredTransactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <TransactionTypeLabel type={tx.type} />
                    <span className="font-mono tabular-nums text-slate-500">
                      {tx.transaction_date}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {tx.product_name} ({tx.brand})
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {tx.party_name || 'Warehouse'}
                    {tx.location ? ` · ${tx.location}` : ''}
                  </p>
                </div>
                <span className="text-sm font-bold font-mono tabular-nums text-slate-900 shrink-0">
                  {tx.quantity}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
