import {
  AppSettings,
  BackupPayload,
  Category,
  Customer,
  InwardStockInput,
  OutwardStockInput,
  Product,
  ReturnOrDamageInput,
  SerialItem,
  SerialSearchResult,
  SerialStatus,
  StockTransaction,
  Supplier,
  Technician,
} from '../types/inventory';

export interface InventorySnapshot {
  categories: Category[];
  products: Product[];
  serialItems: SerialItem[];
  transactions: StockTransaction[];
  customers: Customer[];
  suppliers: Supplier[];
  technicians: Technician[];
  settings: AppSettings;
}

export interface IDatabaseProvider {
  readonly engineName: 'sqlite-capacitor' | 'indexeddb-web';
  initialize(): Promise<void>;
  getSnapshot(): Promise<InventorySnapshot>;

  // Categories
  addCategory(name: string, requiresSerial: boolean): Promise<Category>;
  deleteCategory(categoryId: string): Promise<void>;

  // Products
  updateProductThreshold(productId: string, minStockLevel: number): Promise<void>;

  // Stock Inward & Outward
  addStockInward(input: InwardStockInput): Promise<StockTransaction>;
  issueStockOutward(input: OutwardStockInput): Promise<StockTransaction>;

  // Serial tracking & lifecycle
  searchSerial(serialNumber: string): Promise<SerialSearchResult | null>;
  updateSerialStatus(params: {
    serialNumber: string;
    newStatus: SerialStatus;
    remarks: string;
    actionDate: string;
    location?: string;
    technicianName?: string;
  }): Promise<SerialSearchResult>;

  // Returns & Damaged (supports both serialized & non-serialized items)
  recordReturnOrDamage(input: ReturnOrDamageInput): Promise<StockTransaction>;

  // Master directories
  upsertCustomer(input: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  upsertSupplier(input: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;
  upsertTechnician(input: Omit<Technician, 'id' | 'created_at' | 'updated_at' | 'sync_status'> & { id?: string }): Promise<Technician>;
  deleteTechnician(id: string): Promise<void>;

  // Settings
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>;

  // Backup & Restore
  exportBackup(): Promise<BackupPayload>;
  restoreBackup(payload: BackupPayload): Promise<void>;
  clearAllData(): Promise<void>;
}
