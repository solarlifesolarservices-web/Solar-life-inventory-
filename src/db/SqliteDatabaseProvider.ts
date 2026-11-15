import { CapacitorSQLite } from '@capacitor-community/sqlite';
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
import { SQLITE_SCHEMA_STATEMENTS } from './schema.sql';

const DB_NAME = 'solar_life_inventory';

export class SqliteDatabaseProvider implements IDatabaseProvider {
  public readonly engineName = 'sqlite-capacitor' as const;
  private initialized = false;

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    const isOpen = await CapacitorSQLite.isDBOpen({ database: DB_NAME }).catch(() => ({
      result: false,
    }));

    if (!isOpen.result) {
      await CapacitorSQLite.createConnection({
        database: DB_NAME,
        encrypted: false,
        mode: 'no-encryption',
        version: 1,
        readonly: false,
      }).catch(() => undefined);

      await CapacitorSQLite.open({ database: DB_NAME, readonly: false });
    }

    // Create tables and indexes
    for (const stmt of SQLITE_SCHEMA_STATEMENTS) {
      await CapacitorSQLite.execute({
        database: DB_NAME,
        statements: stmt,
        transaction: false,
      });
    }

    await this.seedDefaultsIfEmpty();
    this.initialized = true;
  }

  private async query<T = Record<string, unknown>>(
    statement: string,
    values: unknown[] = []
  ): Promise<T[]> {
    const res = await CapacitorSQLite.query({
      database: DB_NAME,
      statement,
      values,
    });
    return (res.values ?? []) as T[];
  }

  private async run(statement: string, values: unknown[] = []): Promise<void> {
    await CapacitorSQLite.run({
      database: DB_NAME,
      statement,
      values,
      transaction: false,
    });
  }

  private async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await CapacitorSQLite.beginTransaction({ database: DB_NAME });
    try {
      const result = await fn();
      await CapacitorSQLite.commitTransaction({ database: DB_NAME });
      return result;
    } catch (error) {
      await CapacitorSQLite.rollbackTransaction({ database: DB_NAME }).catch(() => undefined);
      throw error;
    }
  }

  private async seedDefaultsIfEmpty(): Promise<void> {
    const existingCats = await this.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM categories`
    );
    if ((existingCats[0]?.count ?? 0) === 0) {
      const defaults = buildDefaultCategories();
      for (const cat of defaults) {
        await this.run(
          `INSERT INTO categories (id, name, is_system, requires_serial, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.name,
            cat.is_system ? 1 : 0,
            cat.requires_serial ? 1 : 0,
            cat.created_at,
            cat.updated_at,
            cat.sync_status,
          ]
        );
      }
    }

    const existingSettings = await this.query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'app_settings'`
    );
    if (existingSettings.length === 0) {
      const defaults = buildDefaultSettings();
      await this.run(`INSERT INTO app_settings (key, value) VALUES (?, ?)`, [
        'app_settings',
        JSON.stringify(defaults),
      ]);
    }
  }

  private mapCategory(row: Record<string, unknown>): Category {
    return {
      id: String(row.id),
      name: String(row.name),
      is_system: Boolean(row.is_system),
      requires_serial: Boolean(row.requires_serial),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      sync_status: (row.sync_status as Category['sync_status']) ?? 'local',
    };
  }

  private mapProduct(row: Record<string, unknown>): Product {
    return {
      id: String(row.id),
      category_id: String(row.category_id),
      category_name: String(row.category_name),
      name: String(row.name),
      brand: String(row.brand),
      model: String(row.model ?? ''),
      unit: String(row.unit ?? 'pcs'),
      min_stock_level: Number(row.min_stock_level ?? 5),
      available_qty: Number(row.available_qty ?? 0),
      issued_qty: Number(row.issued_qty ?? 0),
      returned_qty: Number(row.returned_qty ?? 0),
      damaged_qty: Number(row.damaged_qty ?? 0),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      sync_status: (row.sync_status as Product['sync_status']) ?? 'local',
    };
  }

  private mapSerialItem(row: Record<string, unknown>): SerialItem {
    return {
      id: String(row.id),
      serial_number: String(row.serial_number),
      product_id: String(row.product_id),
      product_name: String(row.product_name),
      category_name: String(row.category_name),
      brand: String(row.brand),
      model: String(row.model ?? ''),
      status: row.status as SerialStatus,
      supplier_id: row.supplier_id ? String(row.supplier_id) : null,
      supplier_name: String(row.supplier_name ?? ''),
      purchase_date: String(row.purchase_date ?? ''),
      purchase_price: Number(row.purchase_price ?? 0),
      invoice_number: String(row.invoice_number ?? ''),
      customer_id: row.customer_id ? String(row.customer_id) : null,
      customer_name: String(row.customer_name ?? ''),
      customer_mobile: String(row.customer_mobile ?? ''),
      installation_location: String(row.installation_location ?? ''),
      technician_id: row.technician_id ? String(row.technician_id) : null,
      technician_name: String(row.technician_name ?? ''),
      issue_date: String(row.issue_date ?? ''),
      remarks: String(row.remarks ?? ''),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      sync_status: (row.sync_status as SerialItem['sync_status']) ?? 'local',
    };
  }

  private mapTransaction(row: Record<string, unknown>): StockTransaction {
    let serials: string[] = [];
    try {
      serials = JSON.parse(String(row.serial_numbers_json ?? '[]'));
    } catch {
      serials = [];
    }
    return {
      id: String(row.id),
      type: row.type as TransactionType,
      product_id: String(row.product_id),
      product_name: String(row.product_name),
      category_name: String(row.category_name),
      brand: String(row.brand),
      model: String(row.model ?? ''),
      quantity: Number(row.quantity ?? 0),
      serial_numbers: Array.isArray(serials) ? serials : [],
      party_id: row.party_id ? String(row.party_id) : null,
      party_name: String(row.party_name ?? ''),
      party_mobile: String(row.party_mobile ?? ''),
      location: String(row.location ?? ''),
      technician_name: String(row.technician_name ?? ''),
      reference_number: String(row.reference_number ?? ''),
      unit_price: Number(row.unit_price ?? 0),
      transaction_date: String(row.transaction_date),
      remarks: String(row.remarks ?? ''),
      created_at: String(row.created_at),
      sync_status: (row.sync_status as StockTransaction['sync_status']) ?? 'local',
    };
  }

  private mapHistory(row: Record<string, unknown>): SerialHistoryEvent {
    return {
      id: String(row.id),
      serial_number: String(row.serial_number),
      serial_item_id: String(row.serial_item_id),
      transaction_id: row.transaction_id ? String(row.transaction_id) : null,
      event_type: row.event_type as TransactionType,
      status_from: row.status_from ? (row.status_from as SerialStatus) : null,
      status_to: row.status_to as SerialStatus,
      party_name: String(row.party_name ?? ''),
      location: String(row.location ?? ''),
      technician_name: String(row.technician_name ?? ''),
      reference_number: String(row.reference_number ?? ''),
      event_date: String(row.event_date),
      remarks: String(row.remarks ?? ''),
      created_at: String(row.created_at),
    };
  }

  public async getSnapshot(): Promise<InventorySnapshot> {
    await this.initialize();
    const [catRows, prodRows, serialRows, txRows, custRows, supRows, techRows, settingRows] =
      await Promise.all([
        this.query(`SELECT * FROM categories ORDER BY is_system DESC, name ASC`),
        this.query(`SELECT * FROM products ORDER BY name ASC, brand ASC`),
        this.query(`SELECT * FROM serial_items ORDER BY created_at DESC`),
        this.query(`SELECT * FROM transactions ORDER BY transaction_date DESC, created_at DESC`),
        this.query(`SELECT * FROM customers ORDER BY name ASC`),
        this.query(`SELECT * FROM suppliers ORDER BY name ASC`),
        this.query(`SELECT * FROM technicians ORDER BY name ASC`),
        this.query<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'app_settings'`),
      ]);

    const settings: AppSettings = settingRows[0]?.value
      ? { ...buildDefaultSettings(), ...JSON.parse(settingRows[0].value) }
      : buildDefaultSettings();

    return {
      categories: catRows.map((r) => this.mapCategory(r)),
      products: prodRows.map((r) => this.mapProduct(r)),
      serialItems: serialRows.map((r) => this.mapSerialItem(r)),
      transactions: txRows.map((r) => this.mapTransaction(r)),
      customers: custRows as unknown as Customer[],
      suppliers: supRows as unknown as Supplier[],
      technicians: techRows as unknown as Technician[],
      settings,
    };
  }

  public async addCategory(name: string, requiresSerial: boolean): Promise<Category> {
    await this.initialize();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required.');
    const existing = await this.query(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER(?)`,
      [trimmed]
    );
    if (existing.length > 0) {
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
    await this.run(
      `INSERT INTO categories (id, name, is_system, requires_serial, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [category.id, category.name, 0, requiresSerial ? 1 : 0, now, now, 'local']
    );
    return category;
  }

  public async deleteCategory(categoryId: string): Promise<void> {
    await this.initialize();
    const catRows = await this.query(`SELECT * FROM categories WHERE id = ?`, [categoryId]);
    if (catRows.length === 0) throw new Error('Category not found.');
    if (Boolean(catRows[0].is_system)) {
      throw new Error('Default solar categories cannot be deleted.');
    }
    const used = await this.query(`SELECT id FROM products WHERE category_id = ? LIMIT 1`, [
      categoryId,
    ]);
    if (used.length > 0) {
      throw new Error('Cannot delete a category that already has products.');
    }
    await this.run(`DELETE FROM categories WHERE id = ?`, [categoryId]);
  }

  public async updateProductThreshold(productId: string, minStockLevel: number): Promise<void> {
    await this.initialize();
    if (minStockLevel < 0 || !Number.isFinite(minStockLevel)) {
      throw new Error('Low-stock threshold must be 0 or greater.');
    }
    await this.run(`UPDATE products SET min_stock_level = ?, updated_at = ? WHERE id = ?`, [
      Math.floor(minStockLevel),
      getNowISO(),
      productId,
    ]);
  }

  private async ensureSupplierByName(name: string, mobile = ''): Promise<Supplier | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const rows = await this.query(
      `SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [trimmed]
    );
    if (rows.length > 0) {
      return rows[0] as unknown as Supplier;
    }
    const now = getNowISO();
    const supplier: Supplier = {
      id: generateId(),
      name: trimmed,
      mobile: mobile.trim(),
      gst_or_ref: '',
      address: '',
      notes: '',
      created_at: now,
      updated_at: now,
      sync_status: 'local',
    };
    await this.run(
      `INSERT INTO suppliers (id, name, mobile, gst_or_ref, address, notes, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, '', '', '', ?, ?, 'local')`,
      [supplier.id, supplier.name, supplier.mobile, now, now]
    );
    return supplier;
  }

  private async ensureCustomerByName(
    name: string,
    mobile: string,
    address: string
  ): Promise<Customer | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const rows = await this.query(
      `SELECT * FROM customers WHERE LOWER(name) = LOWER(?) AND mobile = ? LIMIT 1`,
      [trimmed, mobile.trim()]
    );
    if (rows.length > 0) {
      return rows[0] as unknown as Customer;
    }
    const now = getNowISO();
    const customer: Customer = {
      id: generateId(),
      name: trimmed,
      mobile: mobile.trim(),
      address: address.trim(),
      notes: '',
      created_at: now,
      updated_at: now,
      sync_status: 'local',
    };
    await this.run(
      `INSERT INTO customers (id, name, mobile, address, notes, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, '', ?, ?, 'local')`,
      [customer.id, customer.name, customer.mobile, customer.address, now, now]
    );
    return customer;
  }

  private async ensureTechnicianByName(name: string): Promise<Technician | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const rows = await this.query(
      `SELECT * FROM technicians WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [trimmed]
    );
    if (rows.length > 0) {
      return rows[0] as unknown as Technician;
    }
    const now = getNowISO();
    const tech: Technician = {
      id: generateId(),
      name: trimmed,
      mobile: '',
      specialization: 'Solar Installation',
      notes: '',
      created_at: now,
      updated_at: now,
      sync_status: 'local',
    };
    await this.run(
      `INSERT INTO technicians (id, name, mobile, specialization, notes, created_at, updated_at, sync_status)
       VALUES (?, ?, '', ?, '', ?, ?, 'local')`,
      [tech.id, tech.name, tech.specialization, now, now]
    );
    return tech;
  }

  public async addStockInward(input: InwardStockInput): Promise<StockTransaction> {
    await this.initialize();
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

    const cleanSerials = input.serial_numbers
      .map(normalizeSerial)
      .filter((s) => s.length > 0);

    const uniqueSet = new Set(cleanSerials);
    if (uniqueSet.size !== cleanSerials.length) {
      throw new Error('Duplicate serial numbers found in your entry list.');
    }

    const catRows = await this.query(`SELECT * FROM categories WHERE id = ?`, [input.category_id]);
    if (catRows.length === 0) throw new Error('Selected category not found.');
    const category = this.mapCategory(catRows[0]);

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

    return this.withTransaction(async () => {
      // Check existing serial numbers for duplicates
      for (const sn of cleanSerials) {
        const dup = await this.query(
          `SELECT serial_number FROM serial_items WHERE serial_number = ? LIMIT 1`,
          [sn]
        );
        if (dup.length > 0) {
          throw new Error(`Duplicate serial number "${sn}" already exists in inventory.`);
        }
      }

      const now = getNowISO();
      const supplier = await this.ensureSupplierByName(supplierName, input.supplier_mobile ?? '');

      // Upsert or update product
      const existingProds = await this.query(
        `SELECT * FROM products
         WHERE category_id = ? AND LOWER(name) = LOWER(?) AND LOWER(brand) = LOWER(?) AND LOWER(model) = LOWER(?)
         LIMIT 1`,
        [category.id, productName, brand, model]
      );

      let productId: string;
      if (existingProds.length > 0) {
        const existing = this.mapProduct(existingProds[0]);
        productId = existing.id;
        await this.run(
          `UPDATE products SET available_qty = available_qty + ?, updated_at = ? WHERE id = ?`,
          [quantity, now, productId]
        );
      } else {
        productId = generateId();
        const settingsRows = await this.query<{ value: string }>(
          `SELECT value FROM app_settings WHERE key = 'app_settings'`
        );
        const defaultThreshold = settingsRows[0]?.value
          ? JSON.parse(settingsRows[0].value).default_low_stock_threshold ?? 5
          : 5;
        await this.run(
          `INSERT INTO products (
            id, category_id, category_name, name, brand, model, unit, min_stock_level,
            available_qty, issued_qty, returned_qty, damaged_qty, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'local')`,
          [
            productId,
            category.id,
            category.name,
            productName,
            brand,
            model,
            input.unit?.trim() || 'pcs',
            input.min_stock_level ?? defaultThreshold,
            quantity,
            now,
            now,
          ]
        );
      }

      const txId = generateId();
      await this.run(
        `INSERT INTO transactions (
          id, type, product_id, product_name, category_name, brand, model,
          quantity, serial_numbers_json, party_id, party_name, party_mobile,
          location, technician_name, reference_number, unit_price, transaction_date,
          remarks, created_at, sync_status
        ) VALUES (?, 'INWARD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, 'local')`,
        [
          txId,
          productId,
          productName,
          category.name,
          brand,
          model,
          quantity,
          JSON.stringify(cleanSerials),
          supplier?.id ?? null,
          supplierName,
          input.supplier_mobile?.trim() ?? '',
          invoiceNumber,
          Number(input.purchase_price) || 0,
          input.purchase_date,
          input.remarks.trim(),
          now,
        ]
      );

      for (const sn of cleanSerials) {
        const serialItemId = generateId();
        await this.run(
          `INSERT INTO serial_items (
            id, serial_number, product_id, product_name, category_name, brand, model,
            status, supplier_id, supplier_name, purchase_date, purchase_price, invoice_number,
            customer_id, customer_name, customer_mobile, installation_location,
            technician_id, technician_name, issue_date, remarks, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'In Stock', ?, ?, ?, ?, ?, NULL, '', '', '', NULL, '', '', ?, ?, ?, 'local')`,
          [
            serialItemId,
            sn,
            productId,
            productName,
            category.name,
            brand,
            model,
            supplier?.id ?? null,
            supplierName,
            input.purchase_date,
            Number(input.purchase_price) || 0,
            invoiceNumber,
            input.remarks.trim(),
            now,
            now,
          ]
        );

        await this.run(
          `INSERT INTO serial_history (
            id, serial_number, serial_item_id, transaction_id, event_type,
            status_from, status_to, party_name, location, technician_name,
            reference_number, event_date, remarks, created_at
          ) VALUES (?, ?, ?, ?, 'INWARD', NULL, 'In Stock', ?, '', '', ?, ?, ?, ?)`,
          [
            generateId(),
            sn,
            serialItemId,
            txId,
            supplierName,
            invoiceNumber,
            input.purchase_date,
            input.remarks.trim() || 'Stock received into warehouse',
            now,
          ]
        );
      }

      const [txRow] = await this.query(`SELECT * FROM transactions WHERE id = ?`, [txId]);
      return this.mapTransaction(txRow);
    });
  }

  public async issueStockOutward(input: OutwardStockInput): Promise<StockTransaction> {
    await this.initialize();
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

    const cleanSerials = input.serial_numbers
      .map(normalizeSerial)
      .filter((s) => s.length > 0);
    if (new Set(cleanSerials).size !== cleanSerials.length) {
      throw new Error('Duplicate serial numbers selected.');
    }

    return this.withTransaction(async () => {
      const prodRows = await this.query(`SELECT * FROM products WHERE id = ?`, [input.product_id]);
      if (prodRows.length === 0) throw new Error('Selected product not found.');
      const product = this.mapProduct(prodRows[0]);

      if (product.available_qty < quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${product.available_qty}, requested: ${quantity}.`
        );
      }

      const catRows = await this.query(`SELECT * FROM categories WHERE id = ?`, [
        product.category_id,
      ]);
      const category = catRows.length > 0 ? this.mapCategory(catRows[0]) : null;
      const serialRowsForProd = await this.query(
        `SELECT COUNT(*) as count FROM serial_items WHERE product_id = ? AND status = 'In Stock'`,
        [product.id]
      );
      const hasInStockSerials = Number(serialRowsForProd[0]?.count ?? 0) > 0;

      if ((category?.requires_serial || hasInStockSerials) && cleanSerials.length !== quantity) {
        throw new Error(
          `Please select or scan ${quantity} serial number(s) for ${product.name} (${cleanSerials.length} selected).`
        );
      }

      const serialItemsToIssue: SerialItem[] = [];
      for (const sn of cleanSerials) {
        const sRows = await this.query(`SELECT * FROM serial_items WHERE serial_number = ?`, [sn]);
        if (sRows.length === 0) {
          throw new Error(`Serial number "${sn}" was not found in inventory.`);
        }
        const item = this.mapSerialItem(sRows[0]);
        if (item.product_id !== product.id) {
          throw new Error(`Serial "${sn}" belongs to ${item.product_name}, not ${product.name}.`);
        }
        if (item.status !== 'In Stock') {
          throw new Error(`Serial "${sn}" is currently "${item.status}" and cannot be issued.`);
        }
        serialItemsToIssue.push(item);
      }

      const now = getNowISO();
      const customer = await this.ensureCustomerByName(customerName, customerMobile, location);
      const technician = await this.ensureTechnicianByName(technicianName);

      await this.run(
        `UPDATE products
         SET available_qty = available_qty - ?, issued_qty = issued_qty + ?, updated_at = ?
         WHERE id = ?`,
        [quantity, quantity, now, product.id]
      );

      const txId = generateId();
      await this.run(
        `INSERT INTO transactions (
          id, type, product_id, product_name, category_name, brand, model,
          quantity, serial_numbers_json, party_id, party_name, party_mobile,
          location, technician_name, reference_number, unit_price, transaction_date,
          remarks, created_at, sync_status
        ) VALUES (?, 'OUTWARD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, ?, ?, ?, 'local')`,
        [
          txId,
          product.id,
          product.name,
          product.category_name,
          product.brand,
          product.model,
          quantity,
          JSON.stringify(cleanSerials),
          customer?.id ?? null,
          customerName,
          customerMobile,
          location,
          technicianName,
          input.issue_date,
          input.remarks.trim(),
          now,
        ]
      );

      for (const item of serialItemsToIssue) {
        await this.run(
          `UPDATE serial_items
           SET status = 'Issued',
               customer_id = ?,
               customer_name = ?,
               customer_mobile = ?,
               installation_location = ?,
               technician_id = ?,
               technician_name = ?,
               issue_date = ?,
               remarks = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            customer?.id ?? null,
            customerName,
            customerMobile,
            location,
            technician?.id ?? null,
            technicianName,
            input.issue_date,
            input.remarks.trim(),
            now,
            item.id,
          ]
        );

        await this.run(
          `INSERT INTO serial_history (
            id, serial_number, serial_item_id, transaction_id, event_type,
            status_from, status_to, party_name, location, technician_name,
            reference_number, event_date, remarks, created_at
          ) VALUES (?, ?, ?, ?, 'OUTWARD', 'In Stock', 'Issued', ?, ?, ?, '', ?, ?, ?)`,
          [
            generateId(),
            item.serial_number,
            item.id,
            txId,
            customerName,
            location,
            technicianName,
            input.issue_date,
            input.remarks.trim() || `Issued to ${customerName}`,
            now,
          ]
        );
      }

      const [txRow] = await this.query(`SELECT * FROM transactions WHERE id = ?`, [txId]);
      return this.mapTransaction(txRow);
    });
  }

  public async searchSerial(serialNumber: string): Promise<SerialSearchResult | null> {
    await this.initialize();
    const sn = normalizeSerial(serialNumber);
    if (!sn) return null;
    const rows = await this.query(`SELECT * FROM serial_items WHERE serial_number = ? LIMIT 1`, [
      sn,
    ]);
    if (rows.length === 0) return null;
    const item = this.mapSerialItem(rows[0]);
    const histRows = await this.query(
      `SELECT * FROM serial_history WHERE serial_item_id = ? ORDER BY created_at DESC`,
      [item.id]
    );
    return {
      item,
      history: histRows.map((h) => this.mapHistory(h)),
    };
  }

  public async updateSerialStatus(params: {
    serialNumber: string;
    newStatus: SerialStatus;
    remarks: string;
    actionDate: string;
    location?: string;
    technicianName?: string;
  }): Promise<SerialSearchResult> {
    await this.initialize();
    const sn = normalizeSerial(params.serialNumber);

    await this.withTransaction(async () => {
      const rows = await this.query(`SELECT * FROM serial_items WHERE serial_number = ? LIMIT 1`, [
        sn,
      ]);
      if (rows.length === 0) throw new Error(`Serial number "${sn}" not found.`);
      const item = this.mapSerialItem(rows[0]);
      const oldStatus = item.status;
      if (oldStatus === params.newStatus) {
        throw new Error(`Serial "${sn}" already has status "${oldStatus}".`);
      }

      const now = getNowISO();
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

      await this.run(
        `UPDATE products
         SET available_qty = MAX(0, available_qty + ?),
             issued_qty = MAX(0, issued_qty + ?),
             returned_qty = MAX(0, returned_qty + ?),
             damaged_qty = MAX(0, damaged_qty + ?),
             updated_at = ?
         WHERE id = ?`,
        [deltaAvailable, deltaIssued, deltaReturned, deltaDamaged, now, item.product_id]
      );

      const txId = generateId();
      await this.run(
        `INSERT INTO transactions (
          id, type, product_id, product_name, category_name, brand, model,
          quantity, serial_numbers_json, party_id, party_name, party_mobile,
          location, technician_name, reference_number, unit_price, transaction_date,
          remarks, created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, '', 0, ?, ?, ?, 'local')`,
        [
          txId,
          eventType,
          item.product_id,
          item.product_name,
          item.category_name,
          item.brand,
          item.model,
          JSON.stringify([sn]),
          item.customer_id,
          item.customer_name || item.supplier_name,
          item.customer_mobile,
          params.location ?? item.installation_location,
          params.technicianName ?? item.technician_name,
          params.actionDate,
          params.remarks.trim(),
          now,
        ]
      );

      const clearCustomer = params.newStatus === 'In Stock';
      await this.run(
        `UPDATE serial_items
         SET status = ?,
             installation_location = ?,
             technician_name = ?,
             customer_id = CASE WHEN ? = 1 THEN NULL ELSE customer_id END,
             customer_name = CASE WHEN ? = 1 THEN '' ELSE customer_name END,
             customer_mobile = CASE WHEN ? = 1 THEN '' ELSE customer_mobile END,
             issue_date = CASE WHEN ? = 1 THEN '' ELSE issue_date END,
             remarks = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          params.newStatus,
          clearCustomer ? '' : (params.location ?? item.installation_location),
          clearCustomer ? '' : (params.technicianName ?? item.technician_name),
          clearCustomer ? 1 : 0,
          clearCustomer ? 1 : 0,
          clearCustomer ? 1 : 0,
          clearCustomer ? 1 : 0,
          params.remarks.trim() || item.remarks,
          now,
          item.id,
        ]
      );

      await this.run(
        `INSERT INTO serial_history (
          id, serial_number, serial_item_id, transaction_id, event_type,
          status_from, status_to, party_name, location, technician_name,
          reference_number, event_date, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`,
        [
          generateId(),
          sn,
          item.id,
          txId,
          eventType,
          oldStatus,
          params.newStatus,
          item.customer_name || item.supplier_name,
          params.location ?? item.installation_location,
          params.technicianName ?? item.technician_name,
          params.actionDate,
          params.remarks.trim() || `Status updated from ${oldStatus} to ${params.newStatus}`,
          now,
        ]
      );
    });

    const updated = await this.searchSerial(sn);
    if (!updated) throw new Error('Failed to load updated serial item.');
    return updated;
  }

  public async recordReturnOrDamage(input: ReturnOrDamageInput): Promise<StockTransaction> {
    await this.initialize();
    const quantity = Math.floor(Number(input.quantity));
    if (!input.product_id) throw new Error('Please select a product.');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0.');

    const cleanSerials = input.serial_numbers
      .map(normalizeSerial)
      .filter((s) => s.length > 0);

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

      let lastTx: StockTransaction | null = null;
      for (const sn of cleanSerials) {
        await this.updateSerialStatus({
          serialNumber: sn,
          newStatus: targetStatus,
          remarks: input.remarks,
          actionDate: input.action_date,
        });
      }
      const txRows = await this.query(
        `SELECT * FROM transactions WHERE product_id = ? ORDER BY created_at DESC LIMIT 1`,
        [input.product_id]
      );
      lastTx = this.mapTransaction(txRows[0]);
      return lastTx;
    }

    return this.withTransaction(async () => {
      const prodRows = await this.query(`SELECT * FROM products WHERE id = ?`, [input.product_id]);
      if (prodRows.length === 0) throw new Error('Product not found.');
      const product = this.mapProduct(prodRows[0]);
      const now = getNowISO();

      if (input.action === 'RETURN') {
        if (product.issued_qty < quantity) {
          throw new Error(
            `Cannot return ${quantity} units; only ${product.issued_qty} issued units exist.`
          );
        }
        await this.run(
          `UPDATE products SET issued_qty = issued_qty - ?, returned_qty = returned_qty + ?, updated_at = ? WHERE id = ?`,
          [quantity, quantity, now, product.id]
        );
      } else if (input.action === 'DAMAGED') {
        if (product.available_qty < quantity) {
          throw new Error(
            `Only ${product.available_qty} available units in stock to mark as damaged.`
          );
        }
        await this.run(
          `UPDATE products SET available_qty = available_qty - ?, damaged_qty = damaged_qty + ?, updated_at = ? WHERE id = ?`,
          [quantity, quantity, now, product.id]
        );
      } else if (input.action === 'RESTORE_STOCK') {
        if (product.returned_qty < quantity) {
          throw new Error(
            `Only ${product.returned_qty} returned units available to restore to usable stock.`
          );
        }
        await this.run(
          `UPDATE products SET returned_qty = returned_qty - ?, available_qty = available_qty + ?, updated_at = ? WHERE id = ?`,
          [quantity, quantity, now, product.id]
        );
      }

      const txId = generateId();
      await this.run(
        `INSERT INTO transactions (
          id, type, product_id, product_name, category_name, brand, model,
          quantity, serial_numbers_json, party_id, party_name, party_mobile,
          location, technician_name, reference_number, unit_price, transaction_date,
          remarks, created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', NULL, ?, '', '', '', '', 0, ?, ?, ?, 'local')`,
        [
          txId,
          input.action,
          product.id,
          product.name,
          product.category_name,
          product.brand,
          product.model,
          quantity,
          input.party_name?.trim() ?? '',
          input.action_date,
          input.remarks.trim(),
          now,
        ]
      );

      const [txRow] = await this.query(`SELECT * FROM transactions WHERE id = ?`, [txId]);
      return this.mapTransaction(txRow);
    });
  }

  public async upsertCustomer(
    input: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ): Promise<Customer> {
    await this.initialize();
    const now = getNowISO();
    const name = input.name.trim();
    if (!name) throw new Error('Customer name is required.');
    const id = input.id || generateId();
    const existing = await this.query(`SELECT created_at FROM customers WHERE id = ?`, [id]);
    if (existing.length > 0) {
      await this.run(
        `UPDATE customers SET name = ?, mobile = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [name, input.mobile.trim(), input.address.trim(), input.notes.trim(), now, id]
      );
    } else {
      await this.run(
        `INSERT INTO customers (id, name, mobile, address, notes, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'local')`,
        [id, name, input.mobile.trim(), input.address.trim(), input.notes.trim(), now, now]
      );
    }
    const [row] = await this.query(`SELECT * FROM customers WHERE id = ?`, [id]);
    return row as unknown as Customer;
  }

  public async deleteCustomer(id: string): Promise<void> {
    await this.initialize();
    await this.run(`DELETE FROM customers WHERE id = ?`, [id]);
  }

  public async upsertSupplier(
    input: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ): Promise<Supplier> {
    await this.initialize();
    const now = getNowISO();
    const name = input.name.trim();
    if (!name) throw new Error('Supplier name is required.');
    const id = input.id || generateId();
    const existing = await this.query(`SELECT created_at FROM suppliers WHERE id = ?`, [id]);
    if (existing.length > 0) {
      await this.run(
        `UPDATE suppliers SET name = ?, mobile = ?, gst_or_ref = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [
          name,
          input.mobile.trim(),
          input.gst_or_ref.trim(),
          input.address.trim(),
          input.notes.trim(),
          now,
          id,
        ]
      );
    } else {
      await this.run(
        `INSERT INTO suppliers (id, name, mobile, gst_or_ref, address, notes, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
        [
          id,
          name,
          input.mobile.trim(),
          input.gst_or_ref.trim(),
          input.address.trim(),
          input.notes.trim(),
          now,
          now,
        ]
      );
    }
    const [row] = await this.query(`SELECT * FROM suppliers WHERE id = ?`, [id]);
    return row as unknown as Supplier;
  }

  public async deleteSupplier(id: string): Promise<void> {
    await this.initialize();
    await this.run(`DELETE FROM suppliers WHERE id = ?`, [id]);
  }

  public async upsertTechnician(
    input: Omit<Technician, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }
  ): Promise<Technician> {
    await this.initialize();
    const now = getNowISO();
    const name = input.name.trim();
    if (!name) throw new Error('Technician name is required.');
    const id = input.id || generateId();
    const existing = await this.query(`SELECT created_at FROM technicians WHERE id = ?`, [id]);
    if (existing.length > 0) {
      await this.run(
        `UPDATE technicians SET name = ?, mobile = ?, specialization = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [name, input.mobile.trim(), input.specialization.trim(), input.notes.trim(), now, id]
      );
    } else {
      await this.run(
        `INSERT INTO technicians (id, name, mobile, specialization, notes, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'local')`,
        [id, name, input.mobile.trim(), input.specialization.trim(), input.notes.trim(), now, now]
      );
    }
    const [row] = await this.query(`SELECT * FROM technicians WHERE id = ?`, [id]);
    return row as unknown as Technician;
  }

  public async deleteTechnician(id: string): Promise<void> {
    await this.initialize();
    await this.run(`DELETE FROM technicians WHERE id = ?`, [id]);
  }

  public async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    await this.initialize();
    const rows = await this.query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'app_settings'`
    );
    const current: AppSettings = rows[0]?.value
      ? { ...buildDefaultSettings(), ...JSON.parse(rows[0].value) }
      : buildDefaultSettings();
    const next = { ...current, ...partial };
    await this.run(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app_settings', ?)`,
      [JSON.stringify(next)]
    );
    return next;
  }

  public async exportBackup(): Promise<BackupPayload> {
    const snap = await this.getSnapshot();
    const histRows = await this.query(`SELECT * FROM serial_history ORDER BY created_at ASC`);
    const now = getNowISO();
    const updatedSettings = await this.updateSettings({ last_backup_at: now });
    return {
      version: 1,
      app: 'Solar Life Inventory',
      exported_at: now,
      data: {
        categories: snap.categories,
        products: snap.products,
        serial_items: snap.serialItems,
        transactions: snap.transactions,
        serial_history: histRows.map((h) => this.mapHistory(h)),
        customers: snap.customers,
        suppliers: snap.suppliers,
        technicians: snap.technicians,
        settings: updatedSettings,
      },
    };
  }

  public async restoreBackup(payload: BackupPayload): Promise<void> {
    await this.initialize();
    if (!payload || payload.app !== 'Solar Life Inventory' || !payload.data) {
      throw new Error('Invalid Solar Life Inventory backup file.');
    }

    await this.withTransaction(async () => {
      await this.run(`DELETE FROM serial_history`);
      await this.run(`DELETE FROM transactions`);
      await this.run(`DELETE FROM serial_items`);
      await this.run(`DELETE FROM products`);
      await this.run(`DELETE FROM customers`);
      await this.run(`DELETE FROM suppliers`);
      await this.run(`DELETE FROM technicians`);
      await this.run(`DELETE FROM categories`);

      for (const c of payload.data.categories ?? []) {
        await this.run(
          `INSERT INTO categories (id, name, is_system, requires_serial, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.name, c.is_system ? 1 : 0, c.requires_serial ? 1 : 0, c.created_at, c.updated_at, c.sync_status ?? 'local']
        );
      }

      for (const p of payload.data.products ?? []) {
        await this.run(
          `INSERT INTO products (id, category_id, category_name, name, brand, model, unit, min_stock_level, available_qty, issued_qty, returned_qty, damaged_qty, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.category_id,
            p.category_name,
            p.name,
            p.brand,
            p.model ?? '',
            p.unit ?? 'pcs',
            p.min_stock_level ?? 5,
            p.available_qty ?? 0,
            p.issued_qty ?? 0,
            p.returned_qty ?? 0,
            p.damaged_qty ?? 0,
            p.created_at,
            p.updated_at,
            p.sync_status ?? 'local',
          ]
        );
      }

      for (const c of payload.data.customers ?? []) {
        await this.run(
          `INSERT INTO customers (id, name, mobile, address, notes, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.name, c.mobile ?? '', c.address ?? '', c.notes ?? '', c.created_at, c.updated_at, c.sync_status ?? 'local']
        );
      }

      for (const s of payload.data.suppliers ?? []) {
        await this.run(
          `INSERT INTO suppliers (id, name, mobile, gst_or_ref, address, notes, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.name, s.mobile ?? '', s.gst_or_ref ?? '', s.address ?? '', s.notes ?? '', s.created_at, s.updated_at, s.sync_status ?? 'local']
        );
      }

      for (const t of payload.data.technicians ?? []) {
        await this.run(
          `INSERT INTO technicians (id, name, mobile, specialization, notes, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.name, t.mobile ?? '', t.specialization ?? '', t.notes ?? '', t.created_at, t.updated_at, t.sync_status ?? 'local']
        );
      }

      for (const item of payload.data.serial_items ?? []) {
        await this.run(
          `INSERT INTO serial_items (id, serial_number, product_id, product_name, category_name, brand, model, status, supplier_id, supplier_name, purchase_date, purchase_price, invoice_number, customer_id, customer_name, customer_mobile, installation_location, technician_id, technician_name, issue_date, remarks, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.serial_number,
            item.product_id,
            item.product_name,
            item.category_name,
            item.brand,
            item.model ?? '',
            item.status,
            item.supplier_id,
            item.supplier_name ?? '',
            item.purchase_date ?? '',
            item.purchase_price ?? 0,
            item.invoice_number ?? '',
            item.customer_id,
            item.customer_name ?? '',
            item.customer_mobile ?? '',
            item.installation_location ?? '',
            item.technician_id,
            item.technician_name ?? '',
            item.issue_date ?? '',
            item.remarks ?? '',
            item.created_at,
            item.updated_at,
            item.sync_status ?? 'local',
          ]
        );
      }

      for (const tx of payload.data.transactions ?? []) {
        await this.run(
          `INSERT INTO transactions (id, type, product_id, product_name, category_name, brand, model, quantity, serial_numbers_json, party_id, party_name, party_mobile, location, technician_name, reference_number, unit_price, transaction_date, remarks, created_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tx.id,
            tx.type,
            tx.product_id,
            tx.product_name,
            tx.category_name,
            tx.brand,
            tx.model ?? '',
            tx.quantity,
            JSON.stringify(tx.serial_numbers ?? []),
            tx.party_id,
            tx.party_name ?? '',
            tx.party_mobile ?? '',
            tx.location ?? '',
            tx.technician_name ?? '',
            tx.reference_number ?? '',
            tx.unit_price ?? 0,
            tx.transaction_date,
            tx.remarks ?? '',
            tx.created_at,
            tx.sync_status ?? 'local',
          ]
        );
      }

      for (const h of payload.data.serial_history ?? []) {
        await this.run(
          `INSERT INTO serial_history (id, serial_number, serial_item_id, transaction_id, event_type, status_from, status_to, party_name, location, technician_name, reference_number, event_date, remarks, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            h.id,
            h.serial_number,
            h.serial_item_id,
            h.transaction_id,
            h.event_type,
            h.status_from,
            h.status_to,
            h.party_name ?? '',
            h.location ?? '',
            h.technician_name ?? '',
            h.reference_number ?? '',
            h.event_date,
            h.remarks ?? '',
            h.created_at,
          ]
        );
      }

      if (payload.data.settings) {
        await this.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app_settings', ?)`, [
          JSON.stringify(payload.data.settings),
        ]);
      }
    });
  }

  public async clearAllData(): Promise<void> {
    await this.initialize();
    await this.withTransaction(async () => {
      await this.run(`DELETE FROM serial_history`);
      await this.run(`DELETE FROM transactions`);
      await this.run(`DELETE FROM serial_items`);
      await this.run(`DELETE FROM products`);
      await this.run(`DELETE FROM customers`);
      await this.run(`DELETE FROM suppliers`);
      await this.run(`DELETE FROM technicians`);
      await this.run(`DELETE FROM categories`);
      await this.run(`DELETE FROM app_settings`);
    });
    await this.seedDefaultsIfEmpty();
  }
}
