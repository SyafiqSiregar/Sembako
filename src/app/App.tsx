import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { RouteGuard } from '@/components/shared/RouteGuard';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { ProductCatalogView } from '@/features/catalog/ProductCatalogView';
import { PosView } from '@/features/pos/PosView';
import { TransactionHistoryView } from '@/features/transactions/TransactionHistoryView';
import { InventoryView } from '@/features/inventory/InventoryView';
import { SuppliersView } from '@/features/suppliers/SuppliersView';
import { ExpiryView } from '@/features/expiry/ExpiryView';
import { ReportsView } from '@/features/reports/ReportsView';
import { SettingsView } from '@/features/settings/SettingsView';
import { HelpView } from '@/features/help/HelpView';

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route
      path="/"
      element={
        <RouteGuard permission="dashboard.view" title="Ringkasan Toko">
          <DashboardView />
        </RouteGuard>
      }
    />
    <Route
      path="/pos"
      element={
        <RouteGuard permission="sale.create" title="Kasir POS">
          <PosView />
        </RouteGuard>
      }
    />
    <Route
      path="/products"
      element={
        <RouteGuard permission="catalog.view" title="Katalog Produk">
          <ProductCatalogView />
        </RouteGuard>
      }
    />
    <Route
      path="/inventory"
      element={
        <RouteGuard permission="inventory.view" title="Inventaris & Stok">
          <InventoryView />
        </RouteGuard>
      }
    />
    <Route
      path="/expiry"
      element={
        <RouteGuard permission="expiry.view" title="Monitoring Kedaluwarsa">
          <ExpiryView />
        </RouteGuard>
      }
    />
    <Route
      path="/suppliers"
      element={
        <RouteGuard permission="receiving.create" title="Pemasok & Penerimaan">
          <SuppliersView />
        </RouteGuard>
      }
    />
    <Route
      path="/transactions"
      element={
        <RouteGuard permission="sale.history_own" title="Riwayat Transaksi">
          <TransactionHistoryView />
        </RouteGuard>
      }
    />
    <Route
      path="/reports"
      element={
        <RouteGuard permission="reports.sales_profit" title="Laporan & Analitik">
          <ReportsView />
        </RouteGuard>
      }
    />
    <Route
      path="/settings"
      element={
        <RouteGuard allowedRoles={['owner', 'supervisor']} title="Pengaturan Sistem">
          <SettingsView />
        </RouteGuard>
      }
    />
    <Route path="/help" element={<HelpView />} />
  </Routes>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
