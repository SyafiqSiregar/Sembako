import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { ProductCatalogView } from '@/features/catalog/ProductCatalogView';
import { PosView } from '@/features/pos/PosView';
import { TransactionHistoryView } from '@/features/transactions/TransactionHistoryView';
import { InventoryView } from '@/features/inventory/InventoryView';
import { SuppliersView } from '@/features/suppliers/SuppliersView';
import { ComingSoonView } from '@/components/shared/ComingSoonView';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/pos" element={<PosView />} />
          <Route path="/products" element={<ProductCatalogView />} />
          <Route path="/inventory" element={<InventoryView />} />
          <Route
            path="/expiry"
            element={<ComingSoonView moduleName="Kedaluwarsa" phase="Fase 4 (Batch & Kedaluwarsa)" />}
          />
          <Route path="/suppliers" element={<SuppliersView />} />
          <Route path="/transactions" element={<TransactionHistoryView />} />
          <Route
            path="/reports"
            element={<ComingSoonView moduleName="Laporan" phase="Fase 4 (Batch & Laporan)" />}
          />
          <Route
            path="/settings"
            element={<ComingSoonView moduleName="Pengaturan" phase="Fase 5 (Backup & Pengaturan)" />}
          />
          <Route
            path="/help"
            element={<ComingSoonView moduleName="Bantuan" phase="Dokumentasi Sistem" />}
          />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};

export default App;
