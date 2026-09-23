import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoginView } from './modules/auth/LoginView';
import { CEODashboardView } from './modules/ceo-dashboard/CEODashboardView';
import { POSView } from './modules/pos/POSView';
import { ProductsView } from './modules/catalog/ProductsView';
import { InventoryView } from './modules/inventory/InventoryView';
import { PurchasesView } from './modules/purchases/PurchasesView';
import { SalesView } from './modules/sales/SalesView';
import { CustomersView } from './modules/customers/CustomersView';
import { SuppliersView } from './modules/suppliers/SuppliersView';
import { AccountingView } from './modules/accounting/AccountingView';
import { UsersView } from './modules/admin/UsersView';
import { BranchesView } from './modules/admin/BranchesView';
import { SettingsPage } from './modules/settings/SettingsPage';
import { useAuthStore } from './store/authStore';
import { DesignSystemPage } from './design-system/DesignSystemPage';
import { getInitialTheme, applyTheme } from './lib/theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui';
import { SettingsProvider } from './contexts/SettingsContext';
import { LoyaltyView } from './modules/loyalty/LoyaltyView';

export const App: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const getDefaultRoute = () => {
    if (!user) return '/login';
    if (user.role === 'CASHIER') return '/pos';
    return '/ceo-dashboard';
  };

  React.useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={!isAuthenticated ? <LoginView /> : <Navigate to={getDefaultRoute()} replace />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
                <Route path="/ceo-dashboard" element={<CEODashboardView />} />
                <Route path="/pos" element={<POSView />} />
                <Route path="/products" element={<ProductsView />} />
                <Route path="/inventory" element={<InventoryView />} />
                <Route path="/purchases" element={<PurchasesView />} />
                <Route path="/sales" element={<SalesView />} />
                <Route path="/customers" element={<CustomersView />} />
                <Route path="/loyalty" element={<LoyaltyView />} />
                <Route path="/suppliers" element={<SuppliersView />} />
                <Route path="/accounting" element={<AccountingView />} />
                <Route path="/admin/users" element={<UsersView />} />
                <Route path="/admin/branches" element={<BranchesView />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {import.meta.env.DEV && <Route path="/design-system" element={<DesignSystemPage />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
