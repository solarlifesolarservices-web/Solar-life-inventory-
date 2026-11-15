import React, { useMemo, useState } from 'react';
import { Edit2, MapPin, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Customer, Supplier, Technician } from '../types/inventory';
import { ConfirmModal, EmptyState } from '../components/UiPrimitives';

export const CustomersScreen: React.FC = () => {
  const { snapshot, upsertCustomer, deleteCustomer, navigate } = useInventory();
  const customers = snapshot?.customers ?? [];
  const transactions = snapshot?.transactions ?? [];
  const serialItems = snapshot?.serialItems ?? [];

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    try {
      await upsertCustomer({
        id: editing.id,
        name: editing.name ?? '',
        mobile: editing.mobile ?? '',
        address: editing.address ?? '',
        notes: editing.notes ?? '',
      });
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save customer.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-600">
            Solar installation clients and issued material records
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({ name: '', mobile: '', address: '', notes: '' })
          }
          className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer name, mobile, or site address..."
          className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Customers Yet"
          description="Customers are added automatically when you issue stock, or you can add them manually here."
          actionLabel="Add Customer"
          onAction={() => setEditing({ name: '', mobile: '', address: '', notes: '' })}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((customer) => {
            const issuedTxs = transactions.filter(
              (t) =>
                t.type === 'OUTWARD' &&
                (t.party_id === customer.id ||
                  t.party_name.toLowerCase() === customer.name.toLowerCase())
            );
            const assignedSerials = serialItems.filter(
              (s) =>
                s.customer_id === customer.id ||
                s.customer_name.toLowerCase() === customer.name.toLowerCase()
            );

            return (
              <div
                key={customer.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{customer.name}</h3>
                    {customer.mobile && (
                      <p className="text-xs font-mono text-slate-600 flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-blue-700" />
                        {customer.mobile}
                      </p>
                    )}
                    {customer.address && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {customer.address}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(customer)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-blue-700 rounded-lg"
                      aria-label={`Edit ${customer.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(customer.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                      aria-label={`Delete ${customer.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-mono tabular-nums">
                    {issuedTxs.length} issue(s) · {assignedSerials.length} serial item(s)
                  </span>
                  {assignedSerials.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate('scan-serial', {
                          serialQuery: assignedSerials[0].serial_number,
                        })
                      }
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      View Serial
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {editing.id ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={editing.name ?? ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editing.mobile ?? ''}
                  onChange={(e) => setEditing({ ...editing, mobile: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Installation Site Address
                </label>
                <input
                  type="text"
                  value={editing.address ?? ''}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={editing.notes ?? ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title="Delete Customer?"
        message="This removes the customer from your directory. Existing historical transactions and serial records remain intact."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteId) await deleteCustomer(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export const SuppliersScreen: React.FC = () => {
  const { snapshot, upsertSupplier, deleteSupplier } = useInventory();
  const suppliers = snapshot?.suppliers ?? [];
  const transactions = snapshot?.transactions ?? [];

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.mobile.toLowerCase().includes(q) ||
        s.gst_or_ref.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    try {
      await upsertSupplier({
        id: editing.id,
        name: editing.name ?? '',
        mobile: editing.mobile ?? '',
        gst_or_ref: editing.gst_or_ref ?? '',
        address: editing.address ?? '',
        notes: editing.notes ?? '',
      });
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save supplier.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-600">
            Panel, inverter, and electrical material vendors
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({ name: '', mobile: '', gst_or_ref: '', address: '', notes: '' })
          }
          className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier name, mobile, or GST/Ref..."
          className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Suppliers Yet"
          description="Suppliers are added automatically on stock inward, or you can register them here."
          actionLabel="Add Supplier"
          onAction={() =>
            setEditing({ name: '', mobile: '', gst_or_ref: '', address: '', notes: '' })
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((sup) => {
            const inwardTxs = transactions.filter(
              (t) =>
                t.type === 'INWARD' &&
                (t.party_id === sup.id || t.party_name.toLowerCase() === sup.name.toLowerCase())
            );
            const totalUnits = inwardTxs.reduce((sum, t) => sum + t.quantity, 0);

            return (
              <div
                key={sup.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{sup.name}</h3>
                    {sup.mobile && (
                      <p className="text-xs font-mono text-slate-600 mt-0.5">{sup.mobile}</p>
                    )}
                    {sup.gst_or_ref && (
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        GST/Ref: {sup.gst_or_ref}
                      </p>
                    )}
                    {sup.address && (
                      <p className="text-xs text-slate-500 mt-1">{sup.address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(sup)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-blue-700 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(sup.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100 text-xs font-mono tabular-nums text-slate-600">
                  {inwardTxs.length} purchase order(s) · {totalUnits} units supplied
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {editing.id ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={editing.name ?? ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editing.mobile ?? ''}
                  onChange={(e) => setEditing({ ...editing, mobile: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GST / Account Ref
                </label>
                <input
                  type="text"
                  value={editing.gst_or_ref ?? ''}
                  onChange={(e) => setEditing({ ...editing, gst_or_ref: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editing.address ?? ''}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title="Delete Supplier?"
        message="This removes the supplier from your directory. Historical purchase records remain unchanged."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteId) await deleteSupplier(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export const TechniciansScreen: React.FC = () => {
  const { snapshot, upsertTechnician, deleteTechnician } = useInventory();
  const technicians = snapshot?.technicians ?? [];
  const transactions = snapshot?.transactions ?? [];

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Technician> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return technicians;
    return technicians.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.mobile.toLowerCase().includes(q) ||
        t.specialization.toLowerCase().includes(q)
    );
  }, [technicians, search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    try {
      await upsertTechnician({
        id: editing.id,
        name: editing.name ?? '',
        mobile: editing.mobile ?? '',
        specialization: editing.specialization ?? '',
        notes: editing.notes ?? '',
      });
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save technician.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Technicians</h1>
          <p className="text-sm text-slate-600">
            Field installers responsible for solar site dispatches
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              name: '',
              mobile: '',
              specialization: 'Solar Installation',
              notes: '',
            })
          }
          className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Technician
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search technician name, mobile, or role..."
          className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Technicians Yet"
          description="Technicians are recorded automatically when you issue material, or add your field crew here."
          actionLabel="Add Technician"
          onAction={() =>
            setEditing({
              name: '',
              mobile: '',
              specialization: 'Solar Installation',
              notes: '',
            })
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((tech) => {
            const techTxs = transactions.filter(
              (t) =>
                t.type === 'OUTWARD' &&
                t.technician_name.toLowerCase() === tech.name.toLowerCase()
            );
            return (
              <div
                key={tech.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{tech.name}</h3>
                      <p className="text-xs text-slate-500">
                        {tech.specialization || 'Solar Technician'}
                      </p>
                      {tech.mobile && (
                        <p className="text-xs font-mono text-slate-600 mt-0.5">{tech.mobile}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(tech)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-blue-700 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(tech.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100 text-xs font-mono tabular-nums text-slate-600">
                  {techTxs.length} installation dispatch(es)
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {editing.id ? 'Edit Technician' : 'Add Technician'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Technician Name *
                </label>
                <input
                  type="text"
                  required
                  value={editing.name ?? ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editing.mobile ?? ''}
                  onChange={(e) => setEditing({ ...editing, mobile: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specialization
                </label>
                <input
                  type="text"
                  value={editing.specialization ?? ''}
                  onChange={(e) => setEditing({ ...editing, specialization: e.target.value })}
                  placeholder="e.g. Rooftop Mounting, Inverter Commissioning"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl"
                >
                  Save Technician
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title="Delete Technician?"
        message="This removes the technician from your directory. Historical dispatch records stay intact."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteId) await deleteTechnician(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};
