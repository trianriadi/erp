import React, { useState, useEffect } from 'react';
    import { NavLink, useLocation, useNavigate } from 'react-router-dom';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Menu, X, LogOut, Settings, User, BarChart2, DollarSign, FileText, Users, Briefcase, Building, FileCheck, Layers, ClipboardList, Package, Landmark } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import WelcomeMessage from '@/components/WelcomeMessage';

    const ROLES = {
      ADMIN: 'admin',
      SALES: 'sales',
      FINANCE: 'finance'
    };

    const navItems = [
      { name: 'Dashboard', path: '/dashboard', icon: BarChart2, roles: [ROLES.ADMIN, ROLES.SALES, ROLES.FINANCE] },
      { name: 'Quotations', path: '/quotations', icon: FileText, roles: [ROLES.ADMIN, ROLES.SALES] },
      { name: 'Invoices', path: '/invoices', icon: FileCheck, roles: [ROLES.ADMIN, ROLES.SALES] },
      { name: 'Customers', path: '/customers', icon: Users, roles: [ROLES.ADMIN, ROLES.SALES] },
      { name: 'Jurnal Umum', path: '/transactions', icon: DollarSign, roles: [ROLES.ADMIN, ROLES.FINANCE] },
      { name: 'Buku Kas & Bank', path: '/cash-bank-book', icon: Landmark, roles: [ROLES.ADMIN, ROLES.FINANCE] },
      { name: 'Daftar Hutang', path: '/liabilities', icon: Briefcase, roles: [ROLES.ADMIN, ROLES.FINANCE] },
      { name: 'Laporan Keuangan', path: '/financial-reports', icon: BarChart2, roles: [ROLES.ADMIN, ROLES.FINANCE] },
      { name: 'Pengaturan', isCollapsible: true, icon: Settings, roles: [ROLES.ADMIN, ROLES.SALES],
        subItems: [
          { name: 'Rekening Kas & Bank', path: '/accounts', icon: Package, roles: [ROLES.ADMIN, ROLES.FINANCE] },
          { name: 'Bagan Akun', path: '/chart-of-accounts', icon: ClipboardList, roles: [ROLES.ADMIN, ROLES.FINANCE] },
          { name: 'Manajemen Pengguna', path: '/users', icon: Users, roles: [ROLES.ADMIN] },
          { name: 'Profil Perusahaan', path: '/company-profile', icon: Building, roles: [ROLES.ADMIN] },
          { name: 'Template Dokumen', path: '/document-templates', icon: Layers, roles: [ROLES.ADMIN, ROLES.SALES] },
          { name: 'Template Syarat', path: '/terms-templates', icon: Layers, roles: [ROLES.ADMIN] },
        ]
      },
    ];

    const Layout = ({ children }) => {
      const [isSidebarOpen, setIsSidebarOpen] = useState(true);
      const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
      const { user, signOut } = useAuth();
      const location = useLocation();
      const navigate = useNavigate();
      const userRole = user?.user_metadata?.role;
      const [openCollapsible, setOpenCollapsible] = useState(null);

      const handleResize = () => {
        if (window.innerWidth < 768) {
          setIsMobile(true);
          setIsSidebarOpen(false);
        } else {
          setIsMobile(false);
          setIsSidebarOpen(true);
        }
      };
      
      useEffect(() => {
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
      }, []);

      useEffect(() => {
        const parentNav = navItems.find(item => item.isCollapsible && item.subItems.some(sub => sub.path === location.pathname));
        if (parentNav) {
          setOpenCollapsible(parentNav.name);
        }
      }, [location.pathname]);

      const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
      };

      const handleSignOut = async () => {
        await signOut();
        navigate('/');
      };
      
      const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));
      const filteredSubItems = (subItems) => subItems.filter(item => item.roles.includes(userRole));
      
      const NavItem = ({ item }) => {
        const isActive = location.pathname === item.path || (item.isCollapsible && item.subItems.some(sub => sub.path === location.pathname));
        const Icon = item.icon;
        
        if(item.isCollapsible) {
          const isParentOpen = openCollapsible === item.name;
          const visibleSubItems = filteredSubItems(item.subItems);
          if (visibleSubItems.length === 0) return null;
          
          return (
            <div>
              <button onClick={() => setOpenCollapsible(isParentOpen ? null : item.name)} className={`w-full flex items-center p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon className="h-5 w-5 mr-3" />
                <span className="font-medium">{item.name}</span>
              </button>
              <AnimatePresence>
                {isParentOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pl-6 mt-1 space-y-1 overflow-hidden">
                    {visibleSubItems.map(subItem => <NavItem key={subItem.name} item={subItem} />)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        return (
          <NavLink
            to={item.path}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-lg transition-colors ${
                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon className="h-5 w-5 mr-3" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        );
      };
      
      return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`fixed top-0 left-0 h-full bg-white z-40 w-64 border-r border-gray-200 shadow-lg ${isMobile ? '' : 'relative'}`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <motion.div
                          initial={{ rotate: 0 }}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <DollarSign className="text-blue-600 h-8 w-8" />
                        </motion.div>
                        <span className="text-xl font-bold text-gray-800">Trimatrakarya</span>
                    </div>
                    {isMobile && (
                        <Button variant="ghost" size="icon" onClick={toggleSidebar}><X /></Button>
                    )}
                  </div>
                  <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {filteredNavItems.map(item => <NavItem key={item.name} item={item} />)}
                  </nav>
                  <div className="p-4 border-t">
                    <div className="flex items-center mb-4">
                      <User className="h-10 w-10 p-2 bg-gray-100 rounded-full text-gray-600 mr-3" />
                      <div>
                        <p className="font-semibold text-sm">{user?.user_metadata?.name || user?.email}</p>
                        <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                        <Menu />
                    </Button>
                    <WelcomeMessage />
                </div>
            </header>
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      );
    };

    export default Layout;