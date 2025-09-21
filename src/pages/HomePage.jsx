import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { modulePermissions } from '@/lib/role-permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, ShoppingCart, Package, Factory, HardHat, Tv } from 'lucide-react';
import { Helmet } from 'react-helmet';

const moduleConfig = {
  finance: { name: 'Keuangan', path: '/finance/dashboard', icon: Landmark, color: 'from-blue-500 to-blue-600' },
  sales: { name: 'Penjualan', path: '/sales/dashboard', icon: ShoppingCart, color: 'from-green-500 to-green-600' },
  inventory: { name: 'Inventory & Pembelian', path: '/inventory/dashboard', icon: Package, color: 'from-yellow-500 to-yellow-600' },
  manufacture: { name: 'Pabrikasi', path: '/manufacture/dashboard', icon: Factory, color: 'from-purple-500 to-purple-600' },
  engineering: { name: 'Engineering', path: '/engineering/products', icon: HardHat, color: 'from-red-500 to-red-600' },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut"
    }
  })
};

const ModuleCard = ({ moduleKey, index }) => {
  const config = moduleConfig[moduleKey];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
    >
      <Link to={config.path}>
        <Card className={`text-white overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-gradient-to-br ${config.color}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-bold">{config.name}</CardTitle>
            <Icon className="h-8 w-8 text-white/80" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-white/90">Akses modul {config.name.toLowerCase()}</p>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};

const HomePage = () => {
  const { user, loading } = useAuth();
  const userRole = user?.user_metadata?.role;

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Memuat...</div>;
  }

  const accessibleModules = modulePermissions[userRole] || [];

  return (
    <>
      <Helmet>
        <title>Homepage | ERP Trimatrakarya</title>
        <meta name="description" content="Pilih modul untuk memulai pekerjaan Anda." />
      </Helmet>
      <div className="container mx-auto p-4 md:p-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Selamat Datang, {user?.user_metadata?.name || user?.email}!</h1>
          <p className="text-lg text-gray-600 mb-8">Pilih modul di bawah ini untuk memulai pekerjaan Anda.</p>
        </motion.div>

        {accessibleModules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessibleModules.map((moduleKey, index) => (
              <ModuleCard key={moduleKey} moduleKey={moduleKey} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-xl text-gray-500">Anda tidak memiliki akses ke modul manapun. Silakan hubungi administrator.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default HomePage;