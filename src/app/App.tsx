import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/pos" element={<PosView />} />
          <Route path="/products" element={<ProductCatalogView />} />
          <Route path="/inventory" element={<InventoryView />} />
          <Route path="/expiry" element={<ExpiryView />} />
          <Route path="/suppliers" element={<SuppliersView />} />
          <Route path="/transactions" element={<TransactionHistoryView />} />
          <Route path="/reports" element={<ReportsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/help" element={<HelpView />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};

export default App;
