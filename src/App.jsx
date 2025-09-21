import React from 'react';
    import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
    import { Helmet } from 'react-helmet';
    import { Toaster } from '@/components/ui/toaster';
    import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
    import { hasModuleAccess } from '@/lib/role-permissions';
    import LoginPage from '@/pages/LoginPage';
    import RegisterPage from '@/pages/RegisterPage';
    import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
    import HomePage from '@/pages/HomePage';
    import ModuleLayout from '@/components/ModuleLayout';
    import MainLayout from '@/components/MainLayout';
    import { DataProvider } from '@/contexts/DataContext';
    import PlaceholderPage from '@/components/PlaceholderPage';

    import FinanceDashboard from '@/pages/FinanceDashboard';
    import SalesDashboard from '@/pages/SalesDashboard';
    import InventoryDashboard from '@/pages/InventoryDashboard';
    import ManufactureDashboard from '@/pages/ManufactureDashboard';
    import EngineeringDashboard from '@/pages/EngineeringDashboard';
    import TransactionsPage from '@/pages/TransactionsPage';
    import LiabilitiesPage from '@/pages/LiabilitiesPage';
    import FinancialReportsPage from '@/pages/FinancialReportsPage';
    import AccountsPage from '@/pages/AccountsPage';
    import ChartOfAccountsPage from '@/pages/ChartOfAccountsPage';
    import CashBankBookPage from '@/pages/CashBankBookPage';
    import UsersPage from '@/pages/UsersPage';
    import CustomersPage from '@/pages/CustomersPage';
    import QuotationsPage from '@/pages/QuotationsPage';
    import InvoicesPage from '@/pages/InvoicesPage';
    import CompanyProfilePage from '@/pages/CompanyProfilePage';
    import DocumentTemplatesPage from '@/pages/DocumentTemplatesPage';
    import SalesOrderPage from '@/pages/SalesOrderPage';
    import ItemsPage from '@/pages/ItemsPage';
    import ItemCategoriesPage from '@/pages/ItemCategoriesPage';
    import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage';
    import WorkOrdersPage from '@/pages/WorkOrdersPage';
    import SuppliersPage from '@/pages/SuppliersPage';
    import PurchaseRequestsPage from '@/pages/PurchaseRequestsPage';
    import FinancePurchaseRequestsPage from '@/pages/FinancePurchaseRequestsPage';
    import GoodsReceiptsPage from '@/pages/GoodsReceiptsPage';
    import EngineeringProductsPage from '@/pages/EngineeringProductsPage';
    import DrawingPage from '@/pages/DrawingPage';
    import ManageBOMPage from '@/pages/ManageBOMPage';
    import SalesProductsPage from '@/pages/SalesProductsPage';
    import WarehousesPage from '@/pages/WarehousesPage';
    import OperationalCostsPage from '@/pages/OperationalCostsPage';
    import FinanceSettingsPage from '@/pages/FinanceSettingsPage';
    import MaterialIssuesPage from '@/pages/MaterialIssuesPage';
    import COGMPage from '@/pages/COGMPage';
    import ProductionReportPage from '@/pages/ProductionReportPage';
    import ProductionMonitorPage from '@/pages/ProductionMonitorPage';
    import CorporateTaxPage from '@/pages/CorporateTaxPage';
    import CloseBookPage from '@/pages/CloseBookPage';


    function ProtectedRoute({ children }) {
      const { session, loading } = useAuth();

      if (loading) {
        return <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-700">Memuat Sesi...</div>;
      }

      if (!session) {
        return <Navigate to="/login" replace />;
      }

      return children;
    }
    
    function RoleProtectedRoute({ moduleType, children }) {
        const { user, loading } = useAuth();
        const userRole = user?.user_metadata?.role;
    
        if (loading) {
            return <div className="flex h-screen items-center justify-center">Memuat...</div>;
        }

        if (!hasModuleAccess(userRole, moduleType)) {
            return <Navigate to="/" replace />;
        }

        return children;
    }

    function PublicRoute({ children }) {
      const { session, loading } = useAuth();
      if (loading) {
        return <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-700">Memuat Sesi...</div>;
      }

      if (session) {
        return <Navigate to="/" replace />;
      }

      return children;
    }
    
    const ModuleWrapper = ({ moduleType, routes }) => {
      const renderableRoutes = routes.flatMap(route => {
        if (route.path && route.element) return [route];
        if (route.sub) return route.sub.filter(subRoute => subRoute.path && subRoute.element);
        return [];
      });

      return (
        <ProtectedRoute>
          <RoleProtectedRoute moduleType={moduleType}>
              <DataProvider>
                <ModuleLayout moduleType={moduleType}>
                  <Routes>
                      {renderableRoutes.map(route => <Route key={route.path} path={route.path.substring(route.path.lastIndexOf('/') + 1)} element={route.element} />)}
                      {renderableRoutes.length > 0 && <Route path="*" element={<Navigate to={renderableRoutes[0].path} replace />} />}
                  </Routes>
                </ModuleLayout>
              </DataProvider>
          </RoleProtectedRoute>
        </ProtectedRoute>
      );
    };

    const financeRoutes = [
      { path: '/finance/dashboard', element: <FinanceDashboard /> },
      { path: '/finance/transactions', element: <TransactionsPage /> },
      { path: '/finance/liabilities', element: <LiabilitiesPage /> },
      { path: '/finance/invoices', element: <InvoicesPage /> },
      { path: '/finance/purchase-requests', element: <FinancePurchaseRequestsPage /> },
      { path: '/finance/corporate-tax', element: <CorporateTaxPage /> },
      { path: '/finance/financial-reports', element: <FinancialReportsPage /> },
      { path: '/finance/close-book', element: <CloseBookPage /> },
      { path: '/finance/operational-costs', element: <OperationalCostsPage /> },
      { path: '/finance/accounts', element: <AccountsPage /> },
      { path: '/finance/chart-of-accounts', element: <ChartOfAccountsPage /> },
      { path: '/finance/cash-bank-book', element: <CashBankBookPage /> },
      { path: '/finance/users', element: <UsersPage /> },
      { path: '/finance/company-profile', element: <CompanyProfilePage /> },
      { path: '/finance/document-templates', element: <DocumentTemplatesPage /> },
      { path: '/finance/settings', element: <FinanceSettingsPage /> },
    ];

    const salesRoutes = [
      { path: '/sales/dashboard', element: <SalesDashboard /> },
      { path: '/sales/products', element: <SalesProductsPage /> },
      { path: '/sales/quotations', element: <QuotationsPage /> },
      { path: '/sales/orders', element: <SalesOrderPage /> },
      { path: '/sales/monitoring', element: <ProductionMonitorPage /> },
      { path: '/sales/invoices', element: <InvoicesPage /> },
      { path: '/sales/customers', element: <CustomersPage /> },
      { path: '/sales/reports', element: <PlaceholderPage title="Laporan Penjualan" /> },
      { path: '/sales/document-templates', element: <DocumentTemplatesPage /> },
    ];

    const inventoryRoutes = [
      { path: '/inventory/dashboard', element: <InventoryDashboard /> },
      { path: '/inventory/requests', element: <PurchaseRequestsPage /> },
      { 
        name: 'Master Barang', 
        sub: [
          { name: 'Bahan Baku & Lainnya', path: '/inventory/items', element: <ItemsPage /> },
          { name: 'Kategori Barang', path: '/inventory/categories', element: <ItemCategoriesPage /> },
        ]
      },
      { path: '/inventory/purchase-orders', element: <PurchaseOrdersPage /> },
      { path: '/inventory/suppliers', element: <SuppliersPage /> },
      { path: '/inventory/receipts', element: <GoodsReceiptsPage /> },
      { path: '/inventory/material-issues', element: <MaterialIssuesPage /> },
      { path: '/inventory/work-orders', element: <WorkOrdersPage /> },
      { path: '/inventory/warehouses', element: <WarehousesPage /> },
      { path: '/inventory/boms', element: <ManageBOMPage /> },
      { path: '/inventory/reports', element: <PlaceholderPage title="Laporan Penerimaan" /> },
    ];
    
    const manufactureRoutes = [
      { path: '/manufacture/dashboard', element: <ManufactureDashboard /> },
      { path: '/manufacture/work-orders', element: <WorkOrdersPage /> },
      { path: '/manufacture/cogm', element: <COGMPage /> },
      { path: '/manufacture/material-issues', element: <MaterialIssuesPage /> },
      { path: '/manufacture/boms', element: <ManageBOMPage /> },
      { path: '/manufacture/items', element: <ItemsPage /> },
      { path: '/manufacture/routing', element: <PlaceholderPage title="Proses Produksi" /> },
      { path: '/manufacture/reports', element: <ProductionReportPage /> },
    ];

    const engineeringRoutes = [
      { path: '/engineering/dashboard', element: <EngineeringDashboard /> },
      { path: '/engineering/products', element: <EngineeringProductsPage /> },
      { path: '/engineering/boms', element: <ManageBOMPage /> },
      { path: '/engineering/work-orders', element: <WorkOrdersPage /> },
      { path: '/engineering/items', element: <ItemsPage /> },
      { path: '/engineering/drawings', element: <DrawingPage /> },
    ];

    function App() {
      return (
        <AuthProvider>
          <Router>
            <Helmet>
              <title>Sistem ERP Trimatrakarya</title>
              <meta name="description" content="Aplikasi manajemen ERP untuk Trimatrakarya." />
            </Helmet>
            <div className="min-h-screen">
              <Routes>
                <Route path="/" element={<ProtectedRoute><MainLayout><HomePage /></MainLayout></ProtectedRoute>} />
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
                
                <Route path="/finance/*" element={<ModuleWrapper moduleType="finance" routes={financeRoutes} />} />
                <Route path="/sales/*" element={<ModuleWrapper moduleType="sales" routes={salesRoutes} />} />
                <Route path="/inventory/*" element={<ModuleWrapper moduleType="inventory" routes={inventoryRoutes} />} />
                <Route path="/manufacture/*" element={<ModuleWrapper moduleType="manufacture" routes={manufactureRoutes} />} />
                <Route path="/engineering/*" element={<ModuleWrapper moduleType="engineering" routes={engineeringRoutes} />} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Toaster />
            </div>
          </Router>
        </AuthProvider>
      );
    }

    export default App;