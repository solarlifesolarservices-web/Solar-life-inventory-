/**
 * Automated verification of all 9 required inventory workflows against WebPersistentProvider
 * (simulating app close & reopen via localStorage persistence across fresh provider instances).
 */

import assert from 'node:assert/strict';

// Minimal localStorage polyfill for Node test execution
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  get length() {
    return memoryStore.size;
  },
  clear() {
    memoryStore.clear();
  },
  getItem(key: string) {
    return memoryStore.get(key) ?? null;
  },
  key(index: number) {
    return Array.from(memoryStore.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memoryStore.delete(key);
  },
  setItem(key: string, value: string) {
    memoryStore.set(key, value);
  },
};

import { WebPersistentProvider } from '../src/db/WebPersistentProvider';

async function runTests() {
  console.log('--- SOLAR LIFE INVENTORY WORKFLOW TESTS ---');
  let db = new WebPersistentProvider();
  await db.initialize();

  // Check default 10 categories
  let snap = await db.getSnapshot();
  assert.equal(snap.categories.length, 10, 'Should seed 10 default solar categories');

  // 1. Add 10 solar panels with 10 different serial numbers
  const panelSerials = Array.from({ length: 10 }, (_, i) => `SL-PNL-2026-${String(i + 1).padStart(3, '0')}`);
  await db.addStockInward({
    category_id: 'cat-solar-panels',
    product_name: '550W Mono PERC Solar Panel',
    brand: 'Waaree',
    model: 'WS-550',
    quantity: 10,
    serial_numbers: panelSerials,
    supplier_name: 'SunPeak Distributors',
    purchase_date: '2026-11-14',
    purchase_price: 14500,
    invoice_number: 'INV-1001',
    remarks: 'Batch A',
  });
  console.log('1. Added 10 solar panels with 10 unique serial numbers.');

  // Verify duplicate serial rejection
  await assert.rejects(
    async () => {
      await db.addStockInward({
        category_id: 'cat-solar-panels',
        product_name: '550W Mono PERC Solar Panel',
        brand: 'Waaree',
        model: 'WS-550',
        quantity: 1,
        serial_numbers: ['SL-PNL-2026-001'],
        supplier_name: 'SunPeak Distributors',
        purchase_date: '2026-11-14',
        purchase_price: 14500,
        invoice_number: 'INV-1002',
        remarks: 'Duplicate test',
      });
    },
    /Duplicate serial number/,
    'Should reject duplicate serial numbers'
  );
  console.log('   Verified duplicate serial number rejection.');

  // 2. Add 2 inverters with individual serial numbers
  await db.addStockInward({
    category_id: 'cat-solar-inverters',
    product_name: '5kW On-Grid Inverter',
    brand: 'Growatt',
    model: 'MIN 5000TL-X',
    quantity: 2,
    serial_numbers: ['GW-INV-9001', 'GW-INV-9002'],
    supplier_name: 'PowerGrid Supplies',
    purchase_date: '2026-11-14',
    purchase_price: 42000,
    invoice_number: 'INV-1003',
    remarks: 'Inverters batch',
  });
  console.log('2. Added 2 inverters with individual serial numbers.');

  // 3. Issue 4 panels to a customer
  snap = await db.getSnapshot();
  const panelProduct = snap.products.find((p) => p.name.includes('550W'))!;
  const issuedPanelSerials = panelSerials.slice(0, 4);

  await db.issueStockOutward({
    product_id: panelProduct.id,
    quantity: 4,
    serial_numbers: issuedPanelSerials,
    customer_name: 'Arun Sharma',
    customer_mobile: '9876543210',
    installation_location: 'Sector 14, Jaipur',
    technician_name: 'Vikram Singh',
    issue_date: '2026-11-14',
    remarks: 'Phase 1 rooftop mounting',
  });
  console.log('3. Issued 4 solar panels to customer Arun Sharma.');

  // Verify negative stock prevention
  await assert.rejects(
    async () => {
      await db.issueStockOutward({
        product_id: panelProduct.id,
        quantity: 7,
        serial_numbers: panelSerials.slice(4, 10),
        customer_name: 'Test',
        customer_mobile: '9999999999',
        installation_location: 'Test',
        technician_name: 'Vikram Singh',
        issue_date: '2026-11-14',
        remarks: '',
      });
    },
    /Insufficient stock/,
    'Should prevent issuing more than available stock'
  );
  console.log('   Verified negative stock prevention.');

  // 4. Confirm available panel stock becomes 6
  snap = await db.getSnapshot();
  const updatedPanel = snap.products.find((p) => p.id === panelProduct.id)!;
  assert.equal(updatedPanel.available_qty, 6, 'Available panel stock must be 6');
  assert.equal(updatedPanel.issued_qty, 4, 'Issued panel stock must be 4');
  console.log('4. Confirmed available panel stock is 6 (and issued is 4).');

  // 5 & 6. Search an issued panel serial number and confirm customer & issue history
  const searchRes = await db.searchSerial('SL-PNL-2026-001');
  assert.ok(searchRes, 'Serial search should find SL-PNL-2026-001');
  assert.equal(searchRes.item.status, 'Issued');
  assert.equal(searchRes.item.customer_name, 'Arun Sharma');
  assert.equal(searchRes.item.installation_location, 'Sector 14, Jaipur');
  assert.equal(searchRes.history.length, 2, 'Should have INWARD and OUTWARD history');
  console.log('5 & 6. Searched SL-PNL-2026-001 -> Confirmed customer & complete history.');

  // Test Return -> Damaged / Restore to Usable Stock exclusion rule
  await db.updateSerialStatus({
    serialNumber: 'SL-PNL-2026-002',
    newStatus: 'Returned',
    remarks: 'Returned unused from site',
    actionDate: '2026-11-14',
  });
  await db.updateSerialStatus({
    serialNumber: 'SL-PNL-2026-005',
    newStatus: 'Damaged',
    remarks: 'Forklift scratch in warehouse',
    actionDate: '2026-11-14',
  });
  snap = await db.getSnapshot();
  const afterReturnDamage = snap.products.find((p) => p.id === panelProduct.id)!;
  assert.equal(afterReturnDamage.available_qty, 5, 'Damaged unit must NOT count in available stock');
  assert.equal(afterReturnDamage.damaged_qty, 1);
  assert.equal(afterReturnDamage.returned_qty, 1);

  await db.updateSerialStatus({
    serialNumber: 'SL-PNL-2026-002',
    newStatus: 'In Stock',
    remarks: 'Inspected OK, back to stock',
    actionDate: '2026-11-14',
  });
  snap = await db.getSnapshot();
  const afterRestore = snap.products.find((p) => p.id === panelProduct.id)!;
  assert.equal(afterRestore.available_qty, 6, 'Restored unit adds back to available stock');
  console.log('   Verified return, damaged exclusion, and restore-to-usable-stock flows.');

  // 7 & 8. Simulate closing & reopening app by instantiating a brand new WebPersistentProvider
  db = new WebPersistentProvider();
  await db.initialize();
  const reopenedSnap = await db.getSnapshot();
  assert.equal(reopenedSnap.products.length, 2, 'Both products persist after reopen');
  assert.equal(reopenedSnap.serialItems.length, 12, 'All 12 serial items persist after reopen');
  const reopenedPanel = reopenedSnap.products.find((p) => p.id === panelProduct.id)!;
  assert.equal(reopenedPanel.available_qty, 6, 'Available qty persists as 6');
  console.log('7 & 8. Simulated app close & reopen -> All data remained saved.');

  // 9. Export and restore backup
  const backup = await db.exportBackup();
  assert.equal(backup.app, 'Solar Life Inventory');
  assert.equal(backup.data.serial_items.length, 12);

  await db.clearAllData();
  const clearedSnap = await db.getSnapshot();
  assert.equal(clearedSnap.products.length, 0, 'Data cleared prior to restore');

  await db.restoreBackup(backup);
  const restoredSnap = await db.getSnapshot();
  assert.equal(restoredSnap.products.length, 2, 'Products restored from backup');
  assert.equal(restoredSnap.serialItems.length, 12, 'All 12 serials restored from backup');
  console.log('9. Exported JSON backup, cleared DB, and restored backup successfully.');
  console.log('--- ALL WORKFLOW TESTS PASSED ---');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
