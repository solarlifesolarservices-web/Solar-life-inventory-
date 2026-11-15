export type SerialStatus =
  | 'In Stock'
  | 'Issued'
  | 'Installed'
  | 'Returned'
  | 'Damaged';

export type TransactionType =
  | 'INWARD'
  | 'OUTWARD'
  | 'RETURN'
  | 'DAMAGED'
  | 'RESTORE_STOCK'
  | 'INSTALLED';

export type SyncStatus = 'local' | 'pending' | 'synced';

export interface Category {
  id: string;
  name: string;
  is_system: boolean;
  requires_serial: boolean;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Product {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  brand: string;
  model: string;
  unit: string;
  min_stock_level: number;
  available_qty: number;
  issued_qty: number;
  returned_qty: number;
  damaged_qty: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface SerialItem {
  id: string;
  serial_number: string;
  product_id: string;
  product_name: string;
  category_name: string;
  brand: string;
  model: string;
  status: SerialStatus;
  supplier_id: string | null;
  supplier_name: string;
  purchase_date: string;
  purchase_price: number;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_mobile: string;
  installation_location: string;
  technician_id: string | null;
  technician_name: string;
  issue_date: string;
  remarks: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface StockTransaction {
  id: string;
  type: TransactionType;
  product_id: string;
  product_name: string;
  category_name: string;
  brand: string;
  model: string;
  quantity: number;
  serial_numbers: string[];
  party_id: string | null;
  party_name: string;
  party_mobile: string;
  location: string;
  technician_name: string;
  reference_number: string;
  unit_price: number;
  transaction_date: string;
  remarks: string;
  created_at: string;
  sync_status: SyncStatus;
}

export interface SerialHistoryEvent {
  id: string;
  serial_number: string;
  serial_item_id: string;
  transaction_id: string | null;
  event_type: TransactionType;
  status_from: SerialStatus | null;
  status_to: SerialStatus;
  party_name: string;
  location: string;
  technician_name: string;
  reference_number: string;
  event_date: string;
  remarks: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Supplier {
  id: string;
  name: string;
  mobile: string;
  gst_or_ref: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Technician {
  id: string;
  name: string;
  mobile: string;
  specialization: string;
  notes: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface AppSettings {
  business_name: string;
  tagline: string;
  default_low_stock_threshold: number;
  currency_symbol: string;
  device_id: string;
  last_backup_at: string | null;
}

export interface InwardStockInput {
  category_id: string;
  product_name: string;
  brand: string;
  model: string;
  unit?: string;
  min_stock_level?: number;
  quantity: number;
  serial_numbers: string[];
  supplier_name: string;
  supplier_mobile?: string;
  purchase_date: string;
  purchase_price: number;
  invoice_number: string;
  remarks: string;
}

export interface OutwardStockInput {
  product_id: string;
  quantity: number;
  serial_numbers: string[];
  customer_name: string;
  customer_mobile: string;
  installation_location: string;
  technician_name: string;
  issue_date: string;
  remarks: string;
}

export interface ReturnOrDamageInput {
  product_id: string;
  action: 'RETURN' | 'DAMAGED' | 'RESTORE_STOCK';
  quantity: number;
  serial_numbers: string[];
  party_name?: string;
  action_date: string;
  remarks: string;
}

export interface SerialSearchResult {
  item: SerialItem;
  history: SerialHistoryEvent[];
}

export interface BackupPayload {
  version: number;
  app: string;
  exported_at: string;
  data: {
    categories: Category[];
    products: Product[];
    serial_items: SerialItem[];
    transactions: StockTransaction[];
    serial_history: SerialHistoryEvent[];
    customers: Customer[];
    suppliers: Supplier[];
    technicians: Technician[];
    settings: AppSettings;
  };
}

export type ScreenId =
  | 'dashboard'
  | 'add-stock'
  | 'issue-stock'
  | 'inventory'
  | 'scan-serial'
  | 'customers'
  | 'suppliers'
  | 'technicians'
  | 'reports'
  | 'backup'
  | 'settings';
