export const SQLITE_SCHEMA_STATEMENTS: string[] = [
  `PRAGMA foreign_keys = ON;`,

  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    is_system INTEGER NOT NULL DEFAULT 0,
    requires_serial INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local'
  );`,

  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'pcs',
    min_stock_level INTEGER NOT NULL DEFAULT 5,
    available_qty INTEGER NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
    issued_qty INTEGER NOT NULL DEFAULT 0 CHECK (issued_qty >= 0),
    returned_qty INTEGER NOT NULL DEFAULT 0 CHECK (returned_qty >= 0),
    damaged_qty INTEGER NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local',
    FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_identity
    ON products(category_id, LOWER(name), LOWER(brand), LOWER(model));`,

  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local'
  );`,

  `CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL DEFAULT '',
    gst_or_ref TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local'
  );`,

  `CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL DEFAULT '',
    specialization TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local'
  );`,

  `CREATE TABLE IF NOT EXISTS serial_items (
    id TEXT PRIMARY KEY NOT NULL,
    serial_number TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('In Stock', 'Issued', 'Installed', 'Returned', 'Damaged')),
    supplier_id TEXT,
    supplier_name TEXT NOT NULL DEFAULT '',
    purchase_date TEXT NOT NULL DEFAULT '',
    purchase_price REAL NOT NULL DEFAULT 0,
    invoice_number TEXT NOT NULL DEFAULT '',
    customer_id TEXT,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_mobile TEXT NOT NULL DEFAULT '',
    installation_location TEXT NOT NULL DEFAULT '',
    technician_id TEXT,
    technician_name TEXT NOT NULL DEFAULT '',
    issue_date TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local',
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_serial_items_product ON serial_items(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_serial_items_status ON serial_items(status);`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INWARD', 'OUTWARD', 'RETURN', 'DAMAGED', 'RESTORE_STOCK', 'INSTALLED')),
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    serial_numbers_json TEXT NOT NULL DEFAULT '[]',
    party_id TEXT,
    party_name TEXT NOT NULL DEFAULT '',
    party_mobile TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    technician_name TEXT NOT NULL DEFAULT '',
    reference_number TEXT NOT NULL DEFAULT '',
    unit_price REAL NOT NULL DEFAULT 0,
    transaction_date TEXT NOT NULL,
    remarks TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local',
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC, created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS serial_history (
    id TEXT PRIMARY KEY NOT NULL,
    serial_number TEXT NOT NULL,
    serial_item_id TEXT NOT NULL,
    transaction_id TEXT,
    event_type TEXT NOT NULL,
    status_from TEXT,
    status_to TEXT NOT NULL,
    party_name TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    technician_name TEXT NOT NULL DEFAULT '',
    reference_number TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL,
    remarks TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (serial_item_id) REFERENCES serial_items(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_serial_history_serial ON serial_history(serial_number);`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );`,
];
