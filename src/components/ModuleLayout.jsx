import React, { useState, useEffect } from 'react';
    import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
    import { motion, AnimatePresence } from 'framer-motion';
    import {
      LayoutDashboard, BookOpen, Banknote, Landmark, FileText, Settings, Menu, X, Users, Briefcase, ShoppingCart, Truck, Factory, Package, Send, Folder, Wrench, ChevronDown, CheckSquare, HardHat, List, ImagePlus, ListChecks, Home, TrendingDown, ChevronsRight, Calculator, Monitor, Percent, BookLock
    } from 'lucide-react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import {
      DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
    } from '@/components/ui/dropdown-menu';

    const moduleConfig = {
      finance: {
        title: 'Keuangan',
        icon: Landmark,
        menu: [
          { name: 'Dashboard', path: '/finance/dashboard', icon: LayoutDashboard },
          { name: 'Permintaan Barang', path: '/finance/purchase-requests', icon: CheckSquare, roles: ['finance', 'admin'] },
          { name: 'Jurnal Umum', path: '/finance/transactions', icon: BookOpen },
          { name: 'Buku Kas & Bank', path: '/finance/cash-bank-book', icon: Banknote },
          { name: 'Daftar Hutang', path: '/finance/liabilities', icon: FileText },
          { name: 'Invoice', path: '/finance/invoices', icon: FileText },
          { name: 'Pajak Penghasilan (PPh)', path: '/finance/corporate-tax', icon: Percent },
          { name: 'Standar Biaya Operasional', path: '/finance/operational-costs', icon: TrendingDown },
          { name: 'Laporan Keuangan', path: '/finance/financial-reports', icon: FileText },
          { name: 'Tutup Buku', path: '/finance/close-book', icon: BookLock },
          {
            name: 'Pengaturan',
            icon: Settings,
            sub: [
              { name: 'Bagan Akun (COA)', path: '/finance/chart-of-accounts' },
              { name: 'Rekening Bank/Kas', path: '/finance/accounts' },
              { name: 'Manajemen Pengguna', path: '/finance/users', roles: ['admin'] },
              { name: 'Profil Perusahaan', path: '/finance/company-profile' },
            ]
          }
        ]
      },
      sales: {
        title: 'Penjualan',
        icon: ShoppingCart,
        menu: [
          { name: 'Dashboard', path: '/sales/dashboard', icon: LayoutDashboard },
          { name: 'Produk', path: '/sales/products', icon: Package },
          { name: 'Quotation', path: '/sales/quotations', icon: FileText },
          { name: 'Sales Order', path: '/sales/orders', icon: FileText },
          { name: 'Monitoring Produksi', path: '/sales/monitoring', icon: Monitor },
          { name: 'Invoice', path: '/sales/invoices', icon: FileText },
          { name: 'Pelanggan', path: '/sales/customers', icon: Users },
          { name: 'Laporan Penjualan', path: '/sales/reports', icon: FileText },
        ]
      },
      inventory: {
        title: 'Inventory & Pembelian',
        icon: Package,
        menu: [
            { name: 'Dashboard', path: '/inventory/dashboard', icon: LayoutDashboard },
            { name: 'Permintaan Barang', path: '/inventory/requests', icon: Send },
            { 
              name: 'Master Barang', 
              icon: Package,
              sub: [
                { name: 'Bahan Baku & Lainnya', path: '/inventory/items' },
                { name: 'Kategori Barang', path: '/inventory/categories' },
              ]
            },
            { name: 'Purchase Order', path: '/inventory/purchase-orders', icon: ShoppingCart },
            { name: 'Supplier', path: '/inventory/suppliers', icon: Briefcase },
            { name: 'Penerimaan Barang', path: '/inventory/receipts', icon: Truck },
            { name: 'Pengeluaran Barang', path: '/inventory/material-issues', icon: ChevronsRight },
            { name: 'Work Order', path: '/inventory/work-orders', icon: Wrench, roles: ['admin', 'inventory', 'manufacture', 'engineering'] },
            { name: 'Gudang', path: '/inventory/warehouses', icon: Wrench, roles: ['admin', 'inventory'] },
        ]
      },
      manufacture: {
        title: 'Pabrikasi',
        icon: Factory,
        menu: [
            { name: 'Dashboard', path: '/manufacture/dashboard', icon: LayoutDashboard },
            { name: 'Work Order', path: '/manufacture/work-orders', icon: Wrench },
            { name: 'COGM', path: '/manufacture/cogm', icon: Calculator },
            { name: 'Laporan Produksi', path: '/manufacture/reports', icon: FileText },
        ]
      },
      engineering: {
        title: 'Engineering',
        icon: HardHat,
        menu: [
            { name: 'Dashboard', path: '/engineering/dashboard', icon: LayoutDashboard },
            { name: 'Produk Manufaktur', path: '/engineering/products', icon: List },
            { name: 'Manajemen BOM', path: '/engineering/boms', icon: ListChecks },
            { name: 'Work Order', path: '/engineering/work-orders', icon: Wrench, roles: ['admin', 'engineering'] },
            { name: 'Manajemen Drawing', path: '/engineering/drawings', icon: ImagePlus },
        ]
      }
    };

    const NavItem = ({ item, onClick, userRole }) => {
      const [isOpen, setIsOpen] = useState(false);
      const location = useLocation();
      const isSubActive = item.sub ? item.sub.some(subItem => location.pathname.startsWith(subItem.path)) : false;

      useEffect(() => {
        if (isSubActive) {
            setIsOpen(true);
        }
      }, [isSubActive]);

      if (item.roles && !item.roles.includes(userRole)) {
        return null;
      }
      
      if (item.sub) {
        const visibleSubItems = item.sub.filter(sub => !sub.roles || sub.roles.includes(userRole));
        if (visibleSubItems.length === 0) return null;

        return (
          <div>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`w-full flex justify-between items-center text-left px-3 py-2.5 rounded-lg transition-colors ${isSubActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              <div className="flex items-center">
                <item.icon className="h-5 w-5 mr-3" />
                <span>{item.name}</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pl-8"
                >
                  {visibleSubItems.map(subItem => (
                    <NavLink
                      key={subItem.name}
                      to={subItem.path}
                      onClick={onClick}
                      className={({ isActive }) =>
                        `block px-3 py-2 text-sm rounded-lg transition-colors my-1 ${isActive ? 'bg-gray-700' : 'hover:bg-gray-700'}`
                      }
                    >
                      {subItem.name}
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }

      return (
        <NavLink
          to={item.path}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`
          }
        >
          <item.icon className="h-5 w-5 mr-3" />
          {item.name}
        </NavLink>
      );
    };

    const ModuleLayout = ({ moduleType, children }) => {
      const [sidebarOpen, setSidebarOpen] = useState(false);
      const { user, signOut } = useAuth();
      const userRole = user?.user_metadata?.role;
      const navigate = useNavigate();
      const config = moduleConfig[moduleType] || {};
      const { title, menu = [] } = config;

      const handleSignOut = async () => {
        await signOut();
        navigate('/login');
      };

      return (
        <div className="flex h-screen bg-gray-100">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />
            )}
          </AnimatePresence>
          
          <div
            className={`fixed md:static top-0 left-0 h-full w-64 bg-gray-800 text-white flex-shrink-0 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <Link to="/" className="flex items-center gap-2">
                <img src="https://horizons-cdn.hostinger.com/6b964ebd-fe0f-42aa-b76d-6e3d24348311/539a44a587f54c7f20d1853b01b8fb4f.png" alt="Trimatrakarya Logo" className="h-10 object-contain" />
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 flex flex-col p-4 space-y-2 overflow-y-auto">
              <div className="flex-grow">
                {menu.map((item, index) => <NavItem key={index} item={item} onClick={() => setSidebarOpen(false)} userRole={userRole} />)}
              </div>
              <div className="mt-auto pt-4 border-t border-gray-700">
                <NavLink
                  to="/"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center px-3 py-2.5 rounded-lg transition-colors hover:bg-gray-700"
                >
                  <Home className="h-5 w-5 mr-3" />
                  Home
                </NavLink>
              </div>
            </nav>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white shadow-sm p-4 flex justify-between items-center z-30">
              <div className="flex items-center">
                <button onClick={() => setSidebarOpen(true)} className="md:hidden mr-4 text-gray-600">
                  <Menu className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email} />
                      <AvatarFallback>{user?.email?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.user_metadata?.name || user?.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      );
    };

    export default ModuleLayout;