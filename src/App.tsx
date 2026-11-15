import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  DatabaseBackup,
  HardHat,
  LayoutDashboard,
  Menu,
  Package,
  PlusCircle,
  QrCode,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ScreenId } from './types/inventory';
import { DashboardScreen } from './screens/DashboardScreen';
import { AddStockScreen } from './screens/AddStockScreen';
import { IssueStockScreen } from './screens/IssueStockScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { ScanSerialScreen } from './screens/ScanSerialScreen';
import {
  CustomersScreen,
  SuppliersScreen,
  TechniciansScreen,
} from './screens/PartiesScreens';
import { ReportsScreen } from './screens/ReportsScreen';
import { BackupRestoreScreen } from './screens/BackupRestoreScreen';
import { SettingsScreen } from './screens/SettingsScreen';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'add-stock', label: 'Add Stock', icon: PlusCircle },
  { id: 'issue-stock', label: 'Issue Stock', icon: ArrowUpRight },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'scan-serial', label: 'Scan Serial Number', icon: QrCode },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Building2 },
  { id: 'technicians', label: 'Technicians', icon: HardHat },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'backup', label: 'Backup and Restore', icon: DatabaseBackup },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const AppShell: React.FC = () => {
  const {
    activeScreen,
    navigate,
    goBack,
    canGoBack,
    loading,
    error,
    toast,
    clearToast,
  } = useInventory();

  const [menuOpen, setMenuOpen] = useState(false);

  const currentNav = ALL_NAV_ITEMS.find((n) => n.id === activeScreen);

  const handleSelectScreen = (id: ScreenId) => {
    navigate(id);
    setMenuOpen(false);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'add-stock':
        return <AddStockScreen />;
      case 'issue-stock':
        return <IssueStockScreen />;
      case 'inventory':
        return <InventoryScreen />;
      case 'scan-serial':
        return <ScanSerialScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'suppliers':
        return <SuppliersScreen />;
      case 'technicians':
        return <TechniciansScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'backup':
        return <BackupRestoreScreen />;
      case 'settings':
        return <SettingsScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar Rail */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-blue-950 text-white border-r border-blue-900">
        <div className="px-5 py-5 border-b border-blue-900 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight truncate">Solar Life Inventory</p>
            <p className="text-[11px] text-amber-300 truncate">SOLAR LIFE | Solar Services</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Primary Navigation">
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectScreen(item.id)}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-blue-100 hover:bg-blue-900 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Compact Mobile Top Header (Hidden on Desktop where sidebar handles navigation) */}
        <header className="lg:hidden sticky top-0 z-30 h-14 pt-safe bg-blue-900 text-white px-3 flex items-center justify-between gap-2 border-b border-blue-800">
          <div className="flex items-center gap-2 min-w-0">
            {canGoBack && activeScreen !== 'dashboard' ? (
              <button
                type="button"
                onClick={goBack}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-blue-800"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 ml-1 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                <Sun className="w-5 h-5" />
              </div>
            )}
            <span className="text-base font-bold tracking-tight truncate">
              {activeScreen === 'dashboard' ? 'Solar Life Inventory' : currentNav?.label}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleSelectScreen('inventory')}
            className="min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-blue-800 text-amber-300 rounded-xl border border-blue-700 whitespace-nowrap shrink-0"
          >
            Stock List
          </button>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                Opening Local Inventory Database...
              </p>
              <p className="text-xs text-slate-500">
                Preparing offline SQLite storage on device
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-900 space-y-2">
              <p className="font-bold">Database Error</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            renderScreen()
          )}
        </main>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50"
        >
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center justify-between gap-3 text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : toast.type === 'info'
                  ? 'bg-slate-900 text-white border-slate-700'
                  : 'bg-blue-950 text-white border-blue-800'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={clearToast}
              className="p-1 text-slate-300 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation (Thumb Zone) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          <button
            type="button"
            onClick={() => handleSelectScreen('dashboard')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeScreen === 'dashboard' ? 'text-blue-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[11px] tracking-tight">Home</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectScreen('add-stock')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeScreen === 'add-stock' ? 'text-blue-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[11px] tracking-tight">Add Stock</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectScreen('scan-serial')}
            className="h-full flex flex-col items-center justify-center"
            aria-label="Scan Serial Number"
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
                activeScreen === 'scan-serial'
                  ? 'bg-blue-700 text-white'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              <QrCode className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectScreen('issue-stock')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeScreen === 'issue-stock' ? 'text-blue-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <ArrowUpRight className="w-5 h-5" />
            <span className="text-[11px] tracking-tight">Issue</span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              menuOpen ||
              ['inventory', 'customers', 'suppliers', 'technicians', 'reports', 'backup', 'settings'].includes(
                activeScreen
              )
                ? 'text-blue-700 font-semibold'
                : 'text-slate-500'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[11px] tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Bottom Sheet for All 11 Screens */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="All Screens Navigation"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl border-t border-slate-200 p-5 pb-8 space-y-4 max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Solar Life Inventory</h2>
                <p className="text-xs text-slate-500">All 11 Screens</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {ALL_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectScreen(item.id)}
                    className={`min-h-[52px] px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5 text-left text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-amber-300' : 'text-blue-700'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <AppShell />
    </InventoryProvider>
  );
}
