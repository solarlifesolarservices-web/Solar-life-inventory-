import { AppSettings, Category } from '../types/inventory';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getNowISO(): string {
  return new Date().toISOString();
}

export function normalizeSerial(value: string): string {
  return value.trim().toUpperCase();
}

export const SYSTEM_CATEGORIES: Array<{
  id: string;
  name: string;
  requires_serial: boolean;
}> = [
  { id: 'cat-solar-panels', name: 'Solar Panels', requires_serial: true },
  { id: 'cat-solar-inverters', name: 'Solar Inverters', requires_serial: true },
  { id: 'cat-dc-wires', name: 'DC Wires', requires_serial: false },
  { id: 'cat-ac-wires', name: 'AC Wires', requires_serial: false },
  { id: 'cat-acdb', name: 'ACDB', requires_serial: false },
  { id: 'cat-dcdb', name: 'DCDB', requires_serial: false },
  { id: 'cat-solar-structures', name: 'Solar Structures', requires_serial: false },
  { id: 'cat-mc4-connectors', name: 'MC4 Connectors', requires_serial: false },
  { id: 'cat-earthing-materials', name: 'Earthing Materials', requires_serial: false },
  { id: 'cat-other-materials', name: 'Other Materials', requires_serial: false },
];

export function buildDefaultCategories(): Category[] {
  const now = getNowISO();
  return SYSTEM_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    is_system: true,
    requires_serial: c.requires_serial,
    created_at: now,
    updated_at: now,
    sync_status: 'local',
  }));
}

export function buildDefaultSettings(): AppSettings {
  return {
    business_name: 'SOLAR LIFE',
    tagline: 'Solar Services',
    default_low_stock_threshold: 5,
    currency_symbol: '₹',
    device_id: generateId(),
    last_backup_at: null,
  };
}
