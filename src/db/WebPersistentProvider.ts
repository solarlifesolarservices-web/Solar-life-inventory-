import {
  AppSettings,
  BackupPayload,
  Category,
  Customer,
  InwardStockInput,
  OutwardStockInput,
  Product,
  ReturnOrDamageInput,
  SerialHistoryEvent,
  SerialItem,
  SerialSearchResult,
  SerialStatus,
  StockTransaction,
  Supplier,
  Technician,
  TransactionType,
} from '../types/inventory';
import {
  buildDefaultCategories,
  buildDefaultSettings,
  generateId,
  getNowISO,
  normalizeSerial,
} from './constants';
import { IDatabaseProvider, InventorySnapshot } from './IDatabaseProvider';

const IDB_NAME = 'solar_life_inventory_db';
const IDB_VERSION = 1;
const IDB_STORE = 'database_state';
const STATE_KEY = 'singleton_state';
const LS_FALLBACK_KEY = 'solar_life_inventory_fallback_v1';

interface PersistedState {
  categories: Category[];
  products: Product[];
  serial_items: SerialItem[];
  transactions: StockTransaction[];
  serial_history: SerialHistoryEvent[];
  customers: Customer[];
  suppliers: Supplier[];
  technicians: Technician[];
  settings: AppSettings;
}

function createInitialState(): PersistedState {
  return {
    categories: buildDefaultCategories(),
    products: [],
    serial_items: [],
    transactions: [],
    serial_history: [],
    customers: [],
    suppliers: [],
    technicians: [],
    settings: buildDefaultSettings(),
  };
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function readFromIDB(): Promise<PersistedState | null> {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as PersistedState | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      return raw ? (JSON.parse(raw) as PersistedState) : null;
    } catch {
      return null;
    }
  }
}

async function writeToIDB(state: PersistedState): Promise<void> {
  // Mirror to localStorage as extra safety for browser reloads, primary in IndexedDB
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors on mirror
  }

  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(state, STATE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // localStorage fallback already written above
  }
}

export class WebPersistentProvider implements IDatabaseProvider {
  public readonly engineName = 'indexeddb-web' as const;
  private state: PersistedState | null = null;
  private initPromise: Promise<void> | null = null;

  public async initialize(): Promise<void> {
    if (this.state) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const stored = await readFromIDB();
        if (stored && Array.isArray(stored.categories) && stored.categories.length > 0) {
          this.state = {
            ...createInitialState(),
            ...stored,
            settings: { ...buildDefaultSettings(), ...(stored.settings ?? {}) },
          };
        } else {
          this.state = createInitialState();
          await writeToIDB(this.state);
        }
      })();
    }
    await this.initPromise;
  }

  private async getState(): Promise<PersistedState> {
    await this.initialize();
    return this.state!;
  }

  private async commit(nextState: PersistedState): Promise<void> {
    this.state = nextState;
    await writeToIDB(nextState);
  }

  public async getSnapshot(): Promise<InventorySnapshot> {
    const s = await this.getState();
    return {
      categories: [...s.categories].sort((a, b) =>
        a.is_system === b.is_system ? a.name.localeCompare(b.name) : a.is_system ? -1 : 1
      ),
      products: [...s.products].sort((a, b) => a.name.localeCompare(b.name)),
      serialItems: [...s.serial_items].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      transactions: [...s.transactions].sort((a, b) =>
        b.transaction_date === a.transaction_date
          ? b.created_at.localeCompare(a.created_at)
          : b.transaction_date.localeCompare(a.transaction_date)
      ),
      customers: [...s.customers].sort((a, b) => a.name.localeCompare(b.name)),
      suppliers: [...s.suppliers].sort((a, b) => a.name.localeCompare(b.name)),
      technicians: [...s.technicians].sort((a, b) => a.name.localeCompare(b.name)),
      settings: { ...s.settings },
    };
  }

  public async addCategory(name: string, requiresSerial: boolean): Promise<Category> {
    const s = await this.getState();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required.');
    if (s.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Category "${trimmed}" already exists.`);
    }
    const now = getNowISO();
    const category: Category = {
      id: generateId(),
      name: trimmed,
      is_system: false,
      requires_serial: requiresSerial,
      created_at: now,
      updated_at: now,
      sync_status: 'local',
    };
    await this.commit({ ...s, categories: [...s.categories, category] });
    return category;
  }

  public async deleteCategory(categoryId: string): Promise<void> {
    const s = await this.getState();
    const cat = s.categories.find((c) => c.id === categoryId);
    if (!cat) throw new Error('Category not found.');
    if (cat.is_system) throw new Error('Default solar categories cannot be deleted.');
    if (s.products.some((p) => p.category_id === categoryId)) {
      throw new Error('Cannot delete a category that already has products.');
    }
    await this.commit({
      ...s,
      categories: s.categories.filter((c) => c.id !== categoryId),
    });
  }

  public async updateProductThreshold(productId: string, minStockLevel: number): Promise<void> {
    const s = await this.getState();
    if (minStockLevel < 0 || !Number.isFinite(minStockLevel)) {
      throw new Error('Low-stock threshold must be 0 or greater.');
    }
    const now = getNowISO();
    await this.commit({
      ...s,
      products: s.products.map((p) =>
        p.id === productId
          ? { ...p, min_stock_level: Math.floor(minStockLevel), updated_at: now }
          : p
      ),
    });
  }

  public async addStockInward(input: InwardStockInput): Promise<StockTransaction> {
    const s = await this.getState();
    const productName = input.product_name.trim();
    const brand = input.brand.trim();
    const model = input.model.trim();
    const supplierName = input.supplier_name.trim();
    const invoiceNumber = input.invoice_number.trim();
    const quantity = Math.floor(Number(input.quantity));

    if (!input.category_id) throw new Error('Product category is required.');
    if (!productName) throw new Error('Product name is required.');
    if (!brand) throw new Error('Brand is required.');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0.');
    if (!supplierName) throw new Error('Supplier name is required.');
    if (!input.purchase_date) throw new Error('Purchase date is required.');

    const category = s.categories.find((c) => c.id === input.category_id);
    if (!category) throw new Error('Selected category not found.');

    const cleanSerials = input.serial_numbers
      .map(normalizeSerial)
      .filter((sn) => sn.length > 0);
    if (new Set(cleanSerials).size !== cleanSerials.length) {
      throw new Error('Duplicate serial numbers found in your entry list.');
    }

    if (category.requires_serial && cleanSerials.length !== quantity) {
      throw new Error(
        `${category.name} require individual serial numbers matching quantity (${cleanSerials.length} entered for quantity ${quantity}).`
      );
    }

    if (cleanSerials.length > 0 && cleanSerials.length !== quantity) {
      throw new Error(
        `Serial number count (${cleanSerials.length}) must match quantity (${quantity}).`
      );
    }

    const existingSerialSet = new Set(s.serial_items.map((i) => i.serial_number));
    for (const sn of cleanSerials) {
      if (existingSerialSet.has(sn)) {
        throw new Error(`Duplicate serial number "${sn}" already exists in inventory.`);
      }
    }

    const now = getNowISO();
    let suppliers = [...s.suppliers];
    let supplier = suppliers.find((sup) => sup.name.toLowerCase() === supplierName.toLowerCase());
    if (!supplier) {
      supplier = {
        id: generateId(),
        name: supplierName,
        mobile: input.supplier_mobile?.trim() ?? '',
        gst_or_ref: '',
        address: '',
        notes: '',
        created_at: now,
        updated_at: now,
        sync_status: 'local',
      };
      suppliers = [...suppliers, supplier];
    }

    let products = [...s.products];
    let product = products.find(
      (p) =>
        p.category_id === category.id &&
        p.name.toLowerCase() === productName.toLowerCase() &&
        p.brand.toLowerCase() === brand.toLowerCase() &&
        p.model.toLowerCase() === model.toLowerCase()
    );

    if (product) {
      product = {
        ...product,
        available_qty: product.available_qty + quantity,
        updated_at: now,
      };
      products = products.map((p) => (p.id === product!.id ? product! : p));
    } else {
      product = {
        id: generateId(),
        category_id: category.id,
        category_name: category.name,
        name: productName,
        brand,
        model,
        unit: input.unit?.trim() || 'pcs',
        min_stock_level: input.min_stock_level ?? s.settings.default_low_stock_threshold ?? 5,
        available_qty: quantity,
        issued_qty: 0,
        returned_qty: 0,
        damaged_qty: 0,
        created_at: now,
        updated_at: now,
        sync_status: 'local',
      };
      products = [...products, product];
    }

    const tx: StockTransaction = {
      id: generateId(),
      type: 'INWARD',
      product_id: product.id,
      product_name: product.name,
      category_name: category.name,
      brand: product.brand,
      model: product.model,
      quantity,
      serial_numbers: cleanSerials,
      party_id: supplier.id,
      party_name: supplier.name,
      party_mobile: input.supplier_mobile?.trim() ?? supplier.mobile,
      location: '',
      technician_name: '',
      reference_number: invoiceNumber,
      unit_price: Number(input.purchase_price) || 0,
      transaction_date: input.purchase_date,
      remarks: input.remarks.trim(),
      created_at: now,
      sync_status: 'local',
    };

    const newSerialItems: SerialItem[] = [];
    const newHistEvents: SerialHistoryEvent[] = [];

    for (const sn of cleanSerials) {
      const serialId = generateId();
      newSerialItems.push({
        id: serialId,
        serial_number: sn,
        product_id: product.id,
        product_name: product.name,
        category_name: category.name,
        brand: product.brand,
        model: product.model,
        status: 'In Stock',
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        purchase_date: input.purchase_date,
        purchase_price: Number(input.purchase_price) || 0,
        invoice_number: invoiceNumber,
        customer_id: null,
        customer_name: '',
        customer_mobile: '',
        installation_location: '',
        technician_id: null,
        technician_name: '',
        issue_date: '',
        remarks: input.remarks.trim(),
        created_at: now,
        updated_at: now,
        sync_status: 'local',
      });

      newHistEvents.push({
        id: generateId(),
        serial_number: sn,
        serial_item_id: serialId,
        transaction_id: tx.id,
        event_type: 'INWARD',
        status_from: null,
        status_to: 'In Stock',
        party_name: supplier.name,
        location: '',
        technician_name: '',
        reference_number: invoiceNumber,
        event_date: input.purchase_date,
        remarks: input.remarks.trim() || 'Stock received into warehouse',
        created_at: now,
      });
    }

    await this.commit({
      ...s,
      suppliers,
      products,
      transactions: [tx, ...s.transactions],
      serial_items: [...newSerialItems, ...s.serial_items],
      serial_history: [...s.serial_history, ...newHistEvents],
    });

    return tx;
  }

  public async issueStockOutward(input: OutwardStockInput): Promise<StockTransaction> {
    const s = await this.getState();
    const quantity = Math.floor(Number(input.quantity));
    const customerName = input.customer_name.trim();
    const customerMobile = input.customer_mobile.trim();
    const location = input.installation_location.trim();
    const technicianName = input.technician_name.trim();

    if (!input.product_id) throw new Error('Please select a product to issue.');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0.');
    if (!customerName) throw new Error('Customer name is required.');
    if (!location) throw new Error('Installation location is required.');
    if (!technicianName) throw new Error('Technician name is required.');
    if (!input.issue_date) throw new Error('Issue date is required.');

    const product = s.products.find((p) => p.id === input.product_id);
    if (!product) throw new Error('Selected product not found.');

    if (product.available_qty < quantity) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${product.available_qty}, requested: ${quantity}.`
      );
    }

    const cleanSerials = input.serial_numbers
      .map(normalizeSerial)
      .filter((sn) => sn.length > 0);
    if (new Set(cleanSerials).size !== cleanSerials.length) {
      throw new Error('Duplicate serial numbers selected.');
    }

    const category = s.categories.find((c) => c.id === product.category_id);
    const hasInStockSerials = s.serial_items.some(
      (i) => i.product_id === product.id && i.status === 'In Stock'
    );

    if ((category?.requires_serial || hasInStockSerials) && cleanSerials.length !== quantity) {
      throw new Error(
        `Please select or scan ${quantity} serial number(s) for ${product.name} (${cleanSerials.length} selected).`
      );
    }

    const itemsToIssue: SerialItem[] = [];
    for (const sn of cleanSerials) {
      const item = s.serial_items.find((i) => i.serial_number === sn);
      if (!item) throw new Error(`Serial number "${sn}" was not found in inventory.`);
      if (item.product_id !== product.id) {
        throw new Error(`Serial "${sn}" belongs to ${item.product_name}, not ${product.name}.`);
      }
      if (item.status !== 'In Stock') {
        throw new Error(`Serial "${sn}" is currently "${item.status}" and cannot be issued.`);
      }
      itemsToIssue.push(item);
    }

    const now = getNowISO();
    let customers = [...s.customers];
    let customer = customers.find(
      (c) => c.name.toLowerCase() === customerName.toLowerCase() && c.mobile === customerMobile
    );
    if (!customer) {
      customer = {
        id: generateId(),
        name: customerName,
        mobile: customerMobile,
        address: location,
        notes: '',
        created_at: now,
        updated_at: now,
        sync_status: 'local',
      };
      customers = [...customers, customer];
    }

    let technicians = [...s.technicians];
    let technician = technicians.find(
      (t) => t.name.toLowerCase() === technicianName.toLowerCase()
    );
    if (!technician) {
      technician = {
        id: generateId(),
        name: technicianName,
        mobile: '',
        specialization: 'Solar Installation',
        notes: '',
        created_at: now,
        updated_at: now,
        sync_status: 'local',
      };
      technicians = [...technicians, technician];
    }

    const updatedProduct: Product = {
      ...product,
      available_qty: product.available_qty - quantity,
      issued_qty: product.issued_qty + quantity,
      updated_at: now,
    };

    const tx: StockTransaction = {
      id: generateId(),
      type: 'OUTWARD',
      product_id: product.id,
      product_name: product.name,
      category_name: product.category_name,
      brand: product.brand,
      model: product.model,
      quantity,
      serial_numbers: cleanSerials,
      party_id: customer.id,
      party_name: customer.name,
      party_mobile: customerMobile,
      location,
      technician_name: technician.name,
      reference_number: '',
      unit_price: 0,
      transaction_date: input.issue_date,
      remarks: input.remarks.trim(),
      created_at: now,
      sync_status: 'local',
    };

    const issuedSet = new Set(cleanSerials);
    const updatedSerials = s.serial_items.map((item) =>
      issuedSet.has(item.serial_number)
        ? {
            ...item,
            status: 'Issued' as SerialStatus,
            customer_id: customer!.id,
            customer_name: customer!.name,
            customer_mobile: customerMobile,
            installation_location: location,
            technician_id: technician!.id,
            technician_name: technician!.name,
            issue_date: input.issue_date,
            remarks: input.remarks.trim(),
            updated_at: now,
          }
        : item
    );

    const newHistEvents: SerialHistoryEvent[] = itemsToIssue.map((item) => ({
      id: generateId(),
      serial_number: item.serial_number,
      serial_item_id: item.id,
      transaction_id: tx.id,
      event_type: 'OUTWARD',
      status_from: 'In Stock',
      status_to: 'Issued',
      party_name: customer!.name,
      location,
      technician_name: technician!.name,
      reference_number: '',
      event_date: input.issue_date,
      remarks: input.remarks.trim() || `Issued to ${customer!.name}`,
      created_at: now,
    }));

    await this.commit({
      ...s,
      customers,
      technicians,
      products: s.products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
      transactions: [tx, ...s.transactions],
      serial_items: updatedSerials,
      serial_history: [...s.serial_history, ...newHistEvents],
    });

    return tx;
  }

  public async searchSerial(serialNumber: string): Promise<SerialSearchResult | null> {
    const s = await this.getState();
    const sn = normalizeSerial(serialNumber);
    if (!sn) return null;
    const item = s.serial_items.find((i) => i.serial_number === sn);
    if (!item) return null;
    const history = s.serial_history
      .filter((h) => h.serial_item_id === item.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { item, history };
  }

  public async updateSerialStatus(params: {
    serialNumber: string;
    newStatus: SerialStatus;
    remarks: string;
    actionDate: string;
    location?: string;
    technicianName?: string;
  }): Promise<SerialSearchResult> {
    const s = await this.getState();
    const sn = normalizeSerial(params.serialNumber);
    const item = s.serial_items.find((i) => i.serial_number === sn);
    if (!item) throw new Error(`Serial number "${sn}" not found.`);
    const oldStatus = item.status;
    if (oldStatus === params.newStatus) {
      throw new Error(`Serial "${sn}" already has status "${oldStatus}".`);
    }

    let eventType: TransactionType = 'INSTALLED';
    let deltaAvailable = 0;
    let deltaIssued = 0;
    let deltaReturned = 0;
    let deltaDamaged = 0;

    if (params.newStatus === 'Installed') {
      if (oldStatus !== 'Issued') {
        throw new Error('Only Issued items can be marked as Installed.');
      }
      eventType = 'INSTALLED';
    } else if (params.newStatus === 'Returned') {
      if (oldStatus !== 'Issued' && oldStatus !== 'Installed') {
        throw new Error('Only Issued or Installed items can be marked as Returned.');
      }
      eventType = 'RETURN';
      deltaIssued = -1;
      deltaReturned = 1;
    } else if (params.newStatus === 'Damaged') {
      eventType = 'DAMAGED';
      if (oldStatus === 'In Stock') deltaAvailable = -1;
      else if (oldStatus === 'Issued' || oldStatus === 'Installed') deltaIssued = -1;
      else if (oldStatus === 'Returned') deltaReturned = -1;
      deltaDamaged = 1;
    } else if (params.newStatus === 'In Stock') {
      if (oldStatus !== 'Returned' && oldStatus !== 'Damaged') {
        throw new Error('Only Returned or Damaged items can be restored to In Stock.');
      }
      eventType = 'RESTORE_STOCK';
      if (oldStatus === 'Returned') deltaReturned = -1;
      if (oldStatus === 'Damaged') deltaDamaged = -1;
      deltaAvailable = 1;
    }

    const now = getNowISO();
    const products = s.products.map((p) =>
      p.id === item.product_id
        ? {
            ...p,
            available_qty: Math.max(0, p.available_qty + deltaAvailable),
            issued_qty: Math.max(0, p.issued_qty + deltaIssued),
            returned_qty: Math.max(0, p.returned_qty + deltaReturned),
            damaged_qty: Math.max(0, p.damaged_qty + deltaDamaged),
            updated_at: now,
          }
        : p
    );

    const tx: StockTransaction = {
      id: generateId(),
      type: eventType,
      product_id: item.product_id,
      product_name: item.product_name,
      category_name: item.category_name,
      brand: item.brand,
      model: item.model,
      quantity: 1,
      serial_numbers: [sn],
      party_id: item.customer_id,
      party_name: item.customer_name || item.supplier_name,
      party_mobile: item.customer_mobile,
      location: params.location ?? item.installation_location,
      technician_name: params.technicianName ?? item.technician_name,
      reference_number: '',
      unit_price: 0,
      transaction_date: params.actionDate,
      remarks: params.remarks.trim(),
      created_at: now,
      sync_status: 'local',
    };

    const clearCustomer = params.newStatus === 'In Stock';
    const updatedItem: SerialItem = {
      ...item,
      status: params.newStatus,
      customer_id: clearCustomer ? null : item.customer_id,
      customer_name: clearCustomer ? '' : item.customer_name,
      customer_mobile: clearCustomer ? '' : item.customer_mobile,
      installation_location: clearCustomer ? '' : (params.location ?? item.installation_location),
      technician_id: clearCustomer ? null : item.technician_id,
      technician_name: clearCustomer ? '' : (params.technicianName ?? item.technician_name),
      issue_date: clearCustomer ? '' : item.issue_date,
      remarks: params.remarks.trim() || item.remarks,
      updated_at: now,
    };

    const histEvent: SerialHistoryEvent = {
      id: generateId(),
      serial_number: sn,
      serial_item_id: item.id,
      transaction_id: tx.id,
      event_type: eventType,
      status_from: oldStatus,
      status_to: params.newStatus,
      party_name: item.customer_name || item.supplier_name,
      location: params.location ?? item.installation_location,
      technician_name: params.technicianName ?? item.technician_name,
      reference_number: '',
      event_date: params.actionDate,
      remarks: params.remarks.trim() || `Status updated from ${oldStatus} to ${params.newStatus}`,
      created_at: now,
    };

    await this.commit({
      ...s,
      products,
      transactions: [tx, ...s.transactions],
      serial_items: s.serial_items.map((i) => (i.id === item.id ? updatedItem : i)),
      serial_history: [...s.serial_history, histEvent],
    });

    const result = await this.searchSerial(sn);
    if (!result) throw new Error('Failed to load updated serial.');
    return result;
  }

  public async recordReturnOrDamage(input: ReturnOrDamageInput): Promise<StockTransaction> {
    const s = await this.getState();
    const quantity = Math.floor(Number(input.quantity));
    if (!input.product_id) throw new Error('Please select a product.');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0.');

    const cleanSerials = input.serial_numbers
      .map(normalizeSerial)
      .filter((sn) => sn.length > 0);

    if (cleanSerials.length > 0) {
      if (cleanSerials.length !== quantity) {
        throw new Error(
          `Serial number count (${cleanSerials.length}) must match quantity (${quantity}).`
        );
      }
      const targetStatus: SerialStatus =
        input.action === 'RETURN'
          ? 'Returned'
          : input.action === 'DAMAGED'
            ? 'Damaged'
            : 'In Stock';

      for (const sn of cleanSerials) {
        await this.updateSerialStatus({
          serialNumber: sn,
          newStatus: targetStatus,
          remarks: input.remarks,
          actionDate: input.action_date,
        });
      }
      const latest = (await this.getState()).transactions[0];
      return latest;
    }

    const product = s.products.find((p) => p.id === input.product_id);
    if (!product) throw new Error('Product not found.');
    const now = getNowISO();
    let updatedProduct = { ...product, updated_at: now };

    if (input.action === 'RETURN') {
      if (product.issued_qty < quantity) {
        throw new Error(
          `Cannot return ${quantity} units; only ${product.issued_qty} issued units exist.`
        );
      }
      updatedProduct.issued_qty -= quantity;
      updatedProduct.returned_qty += quantity;
    } else if (input.action === 'DAMAGED') {
      if (product.available_qty < quantity) {
        throw new Error(
          `Only ${product.available_qty} available units in stock to mark as damaged.`
        );
      }
      updatedProduct.available_qty -= quantity;
      updatedProduct.damaged_qty += quantity;
    } else if (input.action === 'RESTORE_STOCK') {
      if (product.returned_qty < quantity) {
        throw new Error(
          `Only ${product.returned_qty} returned units available to restore to usable stock.`
        );
      }
      updatedProduct.returned_qty -= quantity;
      updatedProduct.available_qty += quantity;
    }

    const tx: StockTransaction = {
      id: generateId(),
      type: input.action,
      product_id: product.id,
      product_name: product.name,
      category_name: product.category_name,
      brand: product.brand,
      model: product.model,
      quantity,
      serial_numbers: [],
      party_id: null,
      party_name: input.party_name?.trim() ?? '',
      party_mobile: '',
      location: '',
      technician_name: '',
      reference_number: '',
      unit_price: 0,
      transaction_date: input.action_date,
      remarks: input.remarks.trim(),
      created_at: now,
      sync_status: 'local',
    };

    await this.commit({
      ...s,
      products: s.products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
      transactions: [tx, ...s.transactions],
    });

    return tx;
  }

  public async upsertCustomer(
    input: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ): Promise<Customer> {
    const s = await this.getState();
    const name = input.name.trim();
    if (!name) throw new Error('Customer name is required.');
    const now = getNowISO();
    const id = input.id || generateId();
    const existing = s.customers.find((c) => c.id === id);
    const customer: Customer = {
      id,
      name,
      mobile: input.mobile.trim(),
      address: input.address.trim(),
      notes: input.notes.trim(),
      created_at: existing?.created_at ?? now,
      updated_at: now,
      sync_status: 'local',
    };
    const customers = existing
      ? s.customers.map((c) => (c.id === id ? customer : c))
      : [...s.customers, customer];
    await this.commit({ ...s, customers });
    return customer;
  }

  public async deleteCustomer(id: string): Promise<void> {
    const s = await this.getState();
    await this.commit({ ...s, customers: s.customers.filter((c) => c.id !== id) });
  }

  public async upsertSupplier(
    input: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ): Promise<Supplier> {
    const s = await this.getState();
    const name = input.name.trim();
    if (!name) throw new Error('Supplier name is required.');
    const now = getNowISO();
    const id = input.id || generateId();
    const existing = s.suppliers.find((sup) => sup.id === id);
    const supplier: Supplier = {
      id,
      name,
      mobile: input.mobile.trim(),
      gst_or_ref: input.gst_or_ref.trim(),
      address: input.address.trim(),
      notes: input.notes.trim(),
      created_at: existing?.created_at ?? now,
      updated_at: now,
      sync_status: 'local',
    };
    const suppliers = existing
      ? s.suppliers.map((sup) => (sup.id === id ? supplier : sup))
      : [...s.suppliers, supplier];
    await this.commit({ ...s, suppliers });
    return supplier;
  }

  public async deleteSupplier(id: string): Promise<void> {
    const s = await this.getState();
    await this.commit({ ...s, suppliers: s.suppliers.filter((sup) => sup.id !== id) });
  }

  public async upsertTechnician(
    input: Omit<Technician, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ): Promise<Technician> {
    const s = await this.getState();
    const name = input.name.trim();
    if (!name) throw new Error('Technician name is required.');
    const now = getNowISO();
    const id = input.id || generateId();
    const existing = s.technicians.find((t) => t.id === id);
    const technician: Technician = {
      id,
      name,
      mobile: input.mobile.trim(),
      specialization: input.specialization.trim(),
      notes: input.notes.trim(),
      created_at: existing?.created_at ?? now,
      updated_at: now,
      sync_status: 'local',
    };
    const technicians = existing
      ? s.technicians.map((t) => (t.id === id ? technician : t))
      : [...s.technicians, technician];
    await this.commit({ ...s, technicians });
    return technician;
  }

  public async deleteTechnician(id: string): Promise<void> {
    const s = await this.getState();
    await this.commit({ ...s, technicians: s.technicians.filter((t) => t.id !== id) });
  }

  public async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const s = await this.getState();
    const next = { ...s.settings, ...partial };
    await this.commit({ ...s, settings: next });
    return next;
  }

  public async exportBackup(): Promise<BackupPayload> {
    const s = await this.getState();
    const now = getNowISO();
    const settings = await this.updateSettings({ last_backup_at: now });
    return {
      version: 1,
      app: 'Solar Life Inventory',
      exported_at: now,
      data: {
        categories: s.categories,
        products: s.products,
        serial_items: s.serial_items,
        transactions: s.transactions,
        serial_history: s.serial_history,
        customers: s.customers,
        suppliers: s.suppliers,
        technicians: s.technicians,
        settings,
      },
    };
  }

  public async restoreBackup(payload: BackupPayload): Promise<void> {
    if (!payload || payload.app !== 'Solar Life Inventory' || !payload.data) {
      throw new Error('Invalid Solar Life Inventory backup file.');
    }
    const nextState: PersistedState = {
      categories: Array.isArray(payload.data.categories) && payload.data.categories.length > 0
        ? payload.data.categories
        : buildDefaultCategories(),
      products: payload.data.products ?? [],
      serial_items: payload.data.serial_items ?? [],
      transactions: payload.data.transactions ?? [],
      serial_history: payload.data.serial_history ?? [],
      customers: payload.data.customers ?? [],
      suppliers: payload.data.suppliers ?? [],
      technicians: payload.data.technicians ?? [],
      settings: { ...buildDefaultSettings(), ...(payload.data.settings ?? {}) },
    };
    await this.commit(nextState);
  }

  public async clearAllData(): Promise<void> {
    await this.commit(createInitialState());
  }
}
